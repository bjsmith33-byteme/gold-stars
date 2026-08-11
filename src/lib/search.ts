// Advanced search for the Knowledge Base: facet options, the filter predicate, per-option
// counts, and the URL codec. Pure — no React, no DOM, no config.
//
// The StarEvent import is TYPE-ONLY on purpose. Type imports are elided at runtime, so this
// module never pulls in team.config.ts — which means search.test.ts is config-free, and its
// assertions hold whatever areas or roles a team has configured. The flip side: nothing here
// can know the board's category order or the role column's human label — ordering is injected
// via `facetOptions(…, order)` and labels live in the components.
import type { StarEvent } from "./aggregate.ts";

/** The CSV columns you can filter on with a checkbox facet. */
export type FacetKey = "recipient" | "role" | "category" | "sub_topic" | "awarded_by";

export const FACET_KEYS: readonly FacetKey[] = [
  "recipient",
  "role",
  "category",
  "sub_topic",
  "awarded_by",
];

/** Query-string key per facet. The `x` prefix reads as "excluded" in the address bar. */
export const FACET_PARAM: Record<FacetKey, string> = {
  recipient: "xrecipient",
  role: "xrole",
  category: "xarea",
  sub_topic: "xtopic",
  awarded_by: "xawarder",
};

/** What a blank value is CALLED in each facet's checkbox list. `sub_topic` must stay in
 *  step with the group heading KnowledgeBase renders for untagged entries — a facet saying
 *  "(none)" beside a heading saying "General" for the same rows is a bug report waiting to
 *  happen, so both sites read this constant. */
export const BLANK_LABEL: Record<FacetKey, string> = {
  recipient: "(none)",
  role: "(none)",
  category: "Uncategorized",
  sub_topic: "General",
  awarded_by: "(none)",
};

/** Every query-string key this module owns. encodeSearch clears exactly these from the
 *  params it is handed, so unrelated params on the same route survive. */
export const SEARCH_PARAM_KEYS: readonly string[] = [
  "q",
  "from",
  "to",
  "all",
  ...FACET_KEYS.map((k) => FACET_PARAM[k]),
];

/** Filter state.
 *
 *  `excluded` holds the values a facet is filtering OUT, not the ones it keeps. That
 *  inversion is the load-bearing choice here, for three reasons:
 *
 *  1. The predicate is total. `[]` passes everything and "every present value" passes
 *     nothing, with no branch on cardinality — so the "does empty mean all or nothing?"
 *     ambiguity that plagues inclusion sets cannot arise.
 *  2. New CSV values default to visible. A bookmarked "everyone except one person" still
 *     means that after three more recipients appear; an inclusion set would silently freeze
 *     the facet against future data.
 *  3. The default state encodes to nothing, so an unfiltered board's URL is a bare `#/kb`.
 *
 *  The cost is that narrowing to 1-of-N encodes N-1 values. If that ever gets unwieldy,
 *  encodeSearch/decodeSearch are the ONLY two functions that know the wire format — they
 *  could emit whichever of inclusion/exclusion is shorter without the predicate or the UI
 *  changing at all. */
export interface SearchState {
  q: string;
  from: string; // "" = use bounds.min
  to: string; // "" = use bounds.max
  includeNoNote: boolean; // widen the corpus past "has a write-up"
  excluded: Record<FacetKey, string[]>; // canonical: deduped + sorted; [] = no filter
}

export interface DateBounds {
  min: string;
  max: string;
}

export interface FacetOption {
  value: string; // matched against the CSV; "" for blank
  label: string; // shown to humans; BLANK_LABEL[key] when value is ""
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The four fields the keyword box searches. `role` and `awarded_by` are deliberately NOT
 *  here — both have their own facet now, and including `role` would make a two-letter role
 *  abbreviation match most of the board. */
const KEYWORD_FIELDS: (keyof StarEvent)[] = ["note", "sub_topic", "recipient", "category"];

// ── Shared primitives ────────────────────────────────────────────────────────

/** Local-date "YYYY-MM-DD". Built from getFullYear/getMonth/getDate rather than
 *  toISOString() — the latter converts to UTC and reports yesterday for anyone west of
 *  Greenwich after 5pm. Dodging that is the whole reason this helper exists. */
export function todayYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dedupe + sort, blanks kept. localeCompare (not bare .sort()) so lowercase values like
 *  "configuration" land among their peers instead of after every capitalized one. */
export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/** Values in `known` order first (only those actually present), then anything unrecognized,
 *  alphabetically. The board's category order wins where it applies; emergent values from
 *  the CSV follow. */
export function orderedByKnown(present: Iterable<string>, known: readonly string[]): string[] {
  const set = new Set(present);
  const inOrder = known.filter((k) => set.has(k));
  const extra = uniqueSorted([...set].filter((v) => !known.includes(v)));
  return [...inOrder, ...extra];
}

// ── State ────────────────────────────────────────────────────────────────────

export function emptySearchState(): SearchState {
  return {
    q: "",
    from: "",
    to: "",
    includeNoNote: false,
    excluded: { recipient: [], role: [], category: [], sub_topic: [], awarded_by: [] },
  };
}

/** True when nothing deviates from "show everything" — i.e. "Reset to defaults" is a no-op
 *  and the URL should carry no query string. */
export function isDefaultState(s: SearchState): boolean {
  return (
    !s.q.trim() &&
    !s.from &&
    !s.to &&
    !s.includeNoNote &&
    FACET_KEYS.every((k) => s.excluded[k].length === 0)
  );
}

/** How many criteria deviate from the default — the badge on the collapsed panel. Each facet
 *  counts once no matter how many values it excludes. */
export function activeFilterCount(s: SearchState): number {
  let n = 0;
  if (s.q.trim()) n++;
  if (s.from) n++;
  if (s.to) n++;
  if (s.includeNoNote) n++;
  for (const k of FACET_KEYS) if (s.excluded[k].length > 0) n++;
  return n;
}

// ── Corpus, bounds, options ──────────────────────────────────────────────────

/** The rows in play. A star is a knowledge-base entry when it has a write-up; the toggle
 *  widens that to every star so the recipient/role/awarder/date facets can reach rows that
 *  were never written up. */
export function corpusFor(events: StarEvent[], includeNoNote: boolean): StarEvent[] {
  return includeNoNote ? events : events.filter((e) => e.note.trim());
}

/** The date range the pickers default to: earliest recorded date → today.
 *
 *  `max` is max(today, latest event) rather than a flat today because Preview mode merges
 *  staged draft rows into the board and a staged star can be future-dated. A hard `today`
 *  would hide it, and then "reset to defaults" would stop meaning "show all". Normally the
 *  latest event is in the past and this is just today, which is what the picker displays. */
export function dateBounds(events: StarEvent[], today: string): DateBounds {
  let min = "";
  let max = today;
  for (const e of events) {
    if (!e.date) continue;
    if (!min || e.date < min) min = e.date;
    if (e.date > max) max = e.date;
  }
  return { min: min || today, max };
}

/** The value a facet matches on. Trimmed so it agrees with the grouping pass in
 *  KnowledgeBase, which trims sub_topic before bucketing. */
function facetValue(e: StarEvent, key: FacetKey): string {
  return e[key].trim();
}

/** The checkbox list for one facet: every value PRESENT in the given rows, and nothing else.
 *
 *  Deriving options from data rather than from config is what keeps this portable — a team
 *  whose config lists an area no star has used yet simply doesn't see it offered, with no
 *  config edit and no per-repo special case. Pass `order` (e.g. CATEGORIES) to have known
 *  values lead in board order; emergent ones follow alphabetically. Blank sorts last
 *  regardless, so "General"/"(none)" doesn't wander into the alphabetical run. */
export function facetOptions(
  events: StarEvent[],
  key: FacetKey,
  order?: readonly string[],
): FacetOption[] {
  const present = new Set(events.map((e) => facetValue(e, key)));
  const hasBlank = present.delete("");
  const values = order ? orderedByKnown(present, order) : uniqueSorted(present);
  if (hasBlank) values.push("");
  return values.map((value) => ({ value, label: value || BLANK_LABEL[key] }));
}

// ── The predicate ────────────────────────────────────────────────────────────

/** Does one row survive the whole filter? Total — every criterion is a plain conjunct, and
 *  an empty exclusion list is simply a test nothing fails. */
export function matchesSearch(e: StarEvent, s: SearchState, b: DateBounds): boolean {
  if (!s.includeNoNote && !e.note.trim()) return false;

  const from = s.from || b.min;
  const to = s.to || b.max;
  if (e.date < from || e.date > to) return false;

  for (const k of FACET_KEYS) {
    if (s.excluded[k].includes(facetValue(e, k))) return false;
  }

  // Multi-term AND: every whitespace-separated term must appear in at least one field,
  // though different terms may land in different fields. A strict superset of matching the
  // query as one substring — any row containing a phrase also contains each of its words —
  // so no existing ?q= link can lose a result, while a query whose words are split across
  // two fields starts working instead of matching nothing.
  const terms = s.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const fields = KEYWORD_FIELDS.map((f) => e[f].toLowerCase());
  return terms.every((t) => fields.some((f) => f.includes(t)));
}

/** Filter, preserving input order — the caller's grouping pass sorts within its own buckets
 *  and relies on nothing else, but stable order keeps the change invisible. */
export function applySearch(events: StarEvent[], s: SearchState, b: DateBounds): StarEvent[] {
  return events.filter((e) => matchesSearch(e, s, b));
}

/** How many rows each facet option would yield, as the number to show beside its checkbox.
 *
 *  A facet's own exclusions do NOT constrain its own counts; every other criterion does.
 *  That's the standard drill-down convention and it's required here: the number beside an
 *  UNCHECKED option has to answer "how many rows come back if I re-check this", and under
 *  the alternative it would always read 0 and tell the user nothing.
 *
 *  One pass, not five: a row that fails no facet counts everywhere, a row that fails exactly
 *  one counts only in the facet it failed, and a row failing two or more counts nowhere.
 *  Every present value is seeded at 0, so a value that's currently filtered out shows "0"
 *  rather than vanishing and reflowing the list. */
export function facetCounts(
  events: StarEvent[],
  s: SearchState,
  b: DateBounds,
): Record<FacetKey, Map<string, number>> {
  const corpus = corpusFor(events, s.includeNoNote);

  const counts = {} as Record<FacetKey, Map<string, number>>;
  for (const k of FACET_KEYS) {
    counts[k] = new Map(corpus.map((e) => [facetValue(e, k), 0]));
  }

  // Everything except the facets: whatever survives here is what the facets get to divide up.
  const bare: SearchState = { ...s, excluded: emptySearchState().excluded };

  for (const e of corpus) {
    if (!matchesSearch(e, bare, b)) continue;

    let failed: FacetKey | null = null;
    let failures = 0;
    for (const k of FACET_KEYS) {
      if (s.excluded[k].includes(facetValue(e, k))) {
        failed = k;
        if (++failures > 1) break;
      }
    }

    if (failures === 0) {
      for (const k of FACET_KEYS) {
        const v = facetValue(e, k);
        counts[k].set(v, (counts[k].get(v) ?? 0) + 1);
      }
    } else if (failures === 1) {
      const k = failed!;
      const v = facetValue(e, k);
      counts[k].set(v, (counts[k].get(v) ?? 0) + 1);
    }
  }

  return counts;
}

// ── URL codec ────────────────────────────────────────────────────────────────

/** Serialize to query params. Repeated keys (`?xrecipient=A&xrecipient=B`) rather than a
 *  delimited list: recipients and sub-topics contain spaces, mixed case and hyphens, so any
 *  separator character would need an escape scheme and would still be a bet that no future
 *  category contains it. URLSearchParams already percent-encodes, and it gives blank values
 *  a free representation (`xawarder=` round-trips as [""]) with no sentinel to collide with.
 *
 *  Only non-default fields are emitted, in a fixed key order over canonicalized arrays, so a
 *  given state always produces byte-identical output. The URL-sync effects rely on that:
 *  comparing encoded strings is what keeps them from ping-ponging. `base` is copied and its
 *  unrelated params preserved; stale keys we own are cleared. */
export function encodeSearch(s: SearchState, base?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  for (const key of SEARCH_PARAM_KEYS) p.delete(key);

  if (s.q.trim()) p.set("q", s.q);
  if (s.from) p.set("from", s.from);
  if (s.to) p.set("to", s.to);
  if (s.includeNoNote) p.set("all", "1");
  for (const k of FACET_KEYS) {
    for (const v of uniqueSorted(s.excluded[k])) p.append(FACET_PARAM[k], v);
  }

  return p;
}

/** Parse query params back into state. Unrecognized params are ignored; a malformed date is
 *  dropped rather than allowed to poison the comparisons. Exclusion arrays come back
 *  canonical so encode(decode(x)) is a fixed point. */
export function decodeSearch(params: URLSearchParams): SearchState {
  const date = (key: string): string => {
    const v = params.get(key) ?? "";
    return ISO_DATE.test(v) ? v : "";
  };

  const excluded = {} as Record<FacetKey, string[]>;
  for (const k of FACET_KEYS) {
    excluded[k] = uniqueSorted(params.getAll(FACET_PARAM[k]));
  }

  return {
    q: params.get("q") ?? "",
    from: date("from"),
    to: date("to"),
    includeNoNote: params.get("all") === "1",
    excluded,
  };
}
