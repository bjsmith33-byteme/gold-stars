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

// ── Sub-topic tags ───────────────────────────────────────────────────────────
// One entry can be ABOUT several things, so the `sub_topic` CSV cell holds a LIST:
// "Forms; Validation". The column stays a plain string, which is what keeps this additive —
// parseCsv, toCsvRow, overlay.ts and teams.ts are untouched, and a legacy single-value
// cell is simply a one-element list.
//
// Semicolon rather than comma because `sub_topic` is the LAST CSV column: a comma would
// force the cell to stay quoted, and a hand-edit in the GitLab web editor that drops the
// quote silently turns an 8-field row into 9 and shifts every column. A semicolon needs no
// quoting either way, so the row survives being hand-typed.
//
// This lives HERE, in the config-free module, rather than in aggregate.ts — the sub_topic
// facet can't be built without it, and search.test.ts has to stay config-free (see the
// header). aggregate.ts re-exports all four names, so every importer still reads them from
// there and there is only ever one implementation.

/** The separator WRITTEN between tags. Parsing accepts ";" with any surrounding space. */
export const SUB_TOPIC_SEP = "; ";

/** Split a raw `sub_topic` cell into its tags: trimmed, blanks dropped, de-duped
 *  case-insensitively keeping the first casing seen (so "Forms" and "forms" can't show up as two
 *  facet options for one thing). Order is preserved, and the FIRST tag is the entry's home
 *  in the knowledge-base tree — the rest are cross-references. */
export function splitSubTopics(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(";")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** One event's sub-topic tags. */
export function subTopicsOf(e: StarEvent): string[] {
  return splitSubTopics(e.sub_topic);
}

/** The tag an entry is FILED under in the KB tree — its first — or "" when untagged. */
export function primarySubTopic(e: StarEvent): string {
  return subTopicsOf(e)[0] ?? "";
}

/** Serialize tags back into a `sub_topic` cell. Round-trips through the splitter, so a tag
 *  that itself contains a ";" is divided rather than smuggling a delimiter into the cell,
 *  and joinSubTopics(splitSubTopics(x)) is a fixed point. */
export function joinSubTopics(tags: Iterable<string>): string {
  return splitSubTopics([...tags].join(";")).join(SUB_TOPIC_SEP);
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

/** The value(s) a facet matches on — a list because `sub_topic` holds several tags. Every
 *  other facet yields exactly one, so the multi-value code paths below degenerate to the
 *  single-value behavior for them. Trimmed so it agrees with the grouping pass in
 *  KnowledgeBase. An untagged row yields [""], i.e. it behaves exactly like a row with one
 *  blank value and lands in the "General" option as before. */
function facetValues(e: StarEvent, key: FacetKey): string[] {
  if (key === "sub_topic") {
    const tags = subTopicsOf(e);
    return tags.length ? tags : [""];
  }
  return [e[key].trim()];
}

/** Is this row filtered OUT by one facet?
 *
 *  For a multi-valued facet the row is dropped only when EVERY one of its values is
 *  excluded. That "every", not "some", is load-bearing: the chips express "show me
 *  Forms" by excluding every OTHER tag, so `some` would hide the very entry tagged
 *  "Validation; Forms" that the Forms chip was clicked to find. Read the other way round,
 *  a row survives as long as it is still about something you didn't rule out.
 *
 *  Single-valued facets have one element, so `every` is the old `includes` test verbatim. */
function failsFacet(e: StarEvent, key: FacetKey, excluded: readonly string[]): boolean {
  if (excluded.length === 0) return false; // keeps the predicate total
  return facetValues(e, key).every((v) => excluded.includes(v));
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
  const present = new Set(events.flatMap((e) => facetValues(e, key)));
  const hasBlank = present.delete("");
  const values = order ? orderedByKnown(present, order) : uniqueSorted(present);
  if (hasBlank) values.push("");
  return values.map((value) => ({ value, label: value || BLANK_LABEL[key] }));
}

// ── The keyword query ────────────────────────────────────────────────────────
// Typing a question into the box used to fail silently: every whitespace-separated word had
// to appear somewhere, so "how do I fix a broken form" required "how", "do" and "fix"
// as substrings and returned nothing. Two fixes, both in compileQuery so the chips
// under the box and the predicate can't drift:
//
//   * function words are dropped, and
//   * a term can be satisfied by any of its team-vocabulary synonyms.
//
// Both only ever WIDEN the result set — dropping a conjunct and OR-ing alternatives into one
// can't reject a row that used to pass — so the guarantee that no existing ?q= link loses a
// result still holds.

/** Team vocabulary: the words people type → the tag they actually mean. `canonical` should
 *  be an existing sub-topic tag, so a synonym hit and a chip click reach the same entries. */
export interface SynonymGroup {
  canonical: string;
  aliases: string[];
}

/** One conjunct of the query: satisfied when the literal OR any expansion is found in any
 *  searched field, and every term must be satisfied.
 *
 *  The two lists are tested DIFFERENTLY on purpose. `literal` is what the user typed and gets
 *  the same permissive substring test as always, so no existing ?q= link can lose a result.
 *  `expansions` are words this module added on the user's behalf, and they're matched on word
 *  boundaries — otherwise expanding "javascript" to a short tag like "js" would quietly match
 *  "jsx", and the synonym map would cost more precision than it bought recall.
 *
 *  `canonical` is set only when a synonym group matched, so the UI can show "typed → Tag"
 *  instead of leaving a surprising hit looking like a bug. */
export interface QueryTerm {
  text: string; // exactly what the user typed for this term
  literal: string; // lowercased `text`, substring-tested
  expansions: string[]; // lowercased synonyms, whole-word-tested
  canonical?: string; // the group's display form, when one matched
}

export interface CompiledQuery {
  terms: QueryTerm[];
  ignored: string[]; // function words dropped from the query
}

/** English function words. Generic to the language, not to any team, so they live here
 *  rather than in team.config. Dropping them matters most for the one-letter ones: "i" and
 *  "a" are substrings of nearly every write-up, so they constrain nothing while making the
 *  query look like it did something. */
const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "but", "by", "can", "could", "did", "do",
  "does", "for", "from", "get", "had", "has", "have", "how", "i", "if", "in", "into", "is",
  "it", "its", "me", "my", "of", "on", "or", "our", "should", "that", "the", "their", "then",
  "there", "these", "this", "to", "was", "we", "were", "what", "when", "where", "which",
  "who", "why", "will", "with", "would", "you", "your",
]);

/** Split a query into comparable tokens. Leading/trailing punctuation is stripped so
 *  "plan?" finds "plan", but inner characters survive — "read-only" and "63000" have to stay
 *  whole to be worth searching. */
function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

/** Compile the keyword box into the conjuncts the predicate tests and the chips display.
 *
 *  Synonym phrases are matched LONGEST-FIRST, which is what makes multi-word aliases work:
 *  "view only" has to be recognized as one term before its words are considered separately,
 *  or "only" would be filtered as a function word and "view" left to fend for itself.
 *
 *  If filtering would leave nothing (the query was all function words), the raw tokens are
 *  restored instead — a typed query must never quietly become "show everything". */
export function compileQuery(q: string, groups: readonly SynonymGroup[] = []): CompiledQuery {
  const tokens = tokenize(q);
  if (tokens.length === 0) return { terms: [], ignored: [] };

  // phrase (as tokens joined by " ") → the group that claims it.
  const byPhrase = new Map<string, SynonymGroup>();
  let longest = 1;
  for (const g of groups) {
    for (const phrase of [g.canonical, ...g.aliases]) {
      const key = tokenize(phrase).join(" ");
      if (!key) continue;
      if (!byPhrase.has(key)) byPhrase.set(key, g);
      longest = Math.max(longest, key.split(" ").length);
    }
  }

  const terms: QueryTerm[] = [];
  const ignored: string[] = [];

  for (let i = 0; i < tokens.length; ) {
    let matched = false;
    for (let len = Math.min(longest, tokens.length - i); len >= 1 && !matched; len--) {
      const slice = tokens.slice(i, i + len);
      const g = byPhrase.get(slice.join(" "));
      if (!g) continue;
      const text = slice.join(" ");
      terms.push({
        text,
        literal: text,
        // Every OTHER phrasing of the group, so "RO" also reaches a row that spells out
        // "view only" and not just one that says "read-only".
        expansions: uniqueSorted(
          [g.canonical, ...g.aliases].map((p) => p.toLowerCase()).filter((p) => p !== text),
        ),
        canonical: g.canonical,
      });
      i += len;
      matched = true;
    }
    if (matched) continue;

    const token = tokens[i++];
    if (STOPWORDS.has(token)) ignored.push(token);
    else terms.push({ text: token, literal: token, expansions: [] });
  }

  if (terms.length === 0) {
    return { terms: tokens.map((t) => ({ text: t, literal: t, expansions: [] })), ignored: [] };
  }
  return { terms, ignored };
}

/** Is `needle` in `haystack` as a whole word? Used for synonyms this module added rather than
 *  the user typed — see QueryTerm. Hand-rolled instead of a RegExp so compileQuery's output
 *  stays plain data (comparable with deepEqual, and cheap to build per keystroke). */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const wordChar = /[\p{L}\p{N}]/u;
  for (let from = 0; ; ) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) return false;
    const before = haystack[i - 1];
    const after = haystack[i + needle.length];
    if (!(before && wordChar.test(before)) && !(after && wordChar.test(after))) return true;
    from = i + 1;
  }
}

/** Does one row satisfy every term of the compiled query? */
function matchesQuery(e: StarEvent, q: CompiledQuery): boolean {
  if (q.terms.length === 0) return true;
  const fields = KEYWORD_FIELDS.map((f) => e[f].toLowerCase());
  return q.terms.every((t) =>
    fields.some((f) => f.includes(t.literal) || t.expansions.some((x) => containsWord(f, x))),
  );
}

// ── The predicate ────────────────────────────────────────────────────────────

/** Does one row survive the whole filter? Total — every criterion is a plain conjunct, and
 *  an empty exclusion list is simply a test nothing fails.
 *
 *  `q` is the PRE-compiled keyword query. It's a parameter rather than derived here so the
 *  collection-level functions compile once per call instead of once per row, and so the chip
 *  row can render the exact object the predicate used. Omit it and the query is compiled from
 *  `s.q` with no team synonyms — stopword filtering still applies, since that's generic. */
export function matchesSearch(
  e: StarEvent,
  s: SearchState,
  b: DateBounds,
  q: CompiledQuery = compileQuery(s.q),
): boolean {
  if (!s.includeNoNote && !e.note.trim()) return false;

  const from = s.from || b.min;
  const to = s.to || b.max;
  if (e.date < from || e.date > to) return false;

  for (const k of FACET_KEYS) {
    if (failsFacet(e, k, s.excluded[k])) return false;
  }

  // Multi-term AND: every term must be satisfied in at least one field, though different
  // terms may land in different fields. A strict superset of matching the query as one
  // substring — any row containing a phrase also contains each of its words — so no existing
  // ?q= link can lose a result, while a query whose words are split across two fields starts
  // working instead of matching nothing. Within a term it's an OR over the synonyms.
  return matchesQuery(e, q);
}

/** Filter, preserving input order — the caller's grouping pass sorts within its own buckets
 *  and relies on nothing else, but stable order keeps the change invisible. */
export function applySearch(
  events: StarEvent[],
  s: SearchState,
  b: DateBounds,
  synonyms?: readonly SynonymGroup[],
): StarEvent[] {
  const q = compileQuery(s.q, synonyms);
  return events.filter((e) => matchesSearch(e, s, b, q));
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
  synonyms?: readonly SynonymGroup[],
): Record<FacetKey, Map<string, number>> {
  const corpus = corpusFor(events, s.includeNoNote);
  const q = compileQuery(s.q, synonyms);

  const counts = {} as Record<FacetKey, Map<string, number>>;
  for (const k of FACET_KEYS) {
    counts[k] = new Map(corpus.flatMap((e) => facetValues(e, k).map((v): [string, number] => [v, 0])));
  }

  // Everything except the facets: whatever survives here is what the facets get to divide up.
  const bare: SearchState = { ...s, excluded: emptySearchState().excluded };

  for (const e of corpus) {
    if (!matchesSearch(e, bare, b, q)) continue;

    let failed: FacetKey | null = null;
    let failures = 0;
    for (const k of FACET_KEYS) {
      if (failsFacet(e, k, s.excluded[k])) {
        failed = k;
        if (++failures > 1) break;
      }
    }

    // A multi-tag row counts under EVERY tag it carries, so a chip's number reads as
    // "entries tagged this, given the other criteria".
    const bump = (k: FacetKey) => {
      for (const v of facetValues(e, k)) counts[k].set(v, (counts[k].get(v) ?? 0) + 1);
    };

    if (failures === 0) {
      for (const k of FACET_KEYS) bump(k);
    } else if (failures === 1) {
      bump(failed!);
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
