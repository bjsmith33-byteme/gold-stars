import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeFilterCount,
  applySearch,
  corpusFor,
  dateBounds,
  decodeSearch,
  emptySearchState,
  encodeSearch,
  facetCounts,
  facetOptions,
  isDefaultState,
  matchesSearch,
  orderedByKnown,
  todayYmd,
  uniqueSorted,
  type DateBounds,
  type FacetKey,
  type SearchState,
} from "./search.ts";
import type { StarEvent } from "./aggregate.ts";

function ev(over: Partial<StarEvent> = {}): StarEvent {
  return {
    date: "2026-06-01",
    recipient: "Aisha Okafor",
    role: "Frontend",
    category: "React",
    note: "a write-up",
    source: "Teams",
    awarded_by: "Sofia Rossi",
    sub_topic: "",
    ...over,
  };
}

type StateOver = Partial<Omit<SearchState, "excluded">> & {
  excluded?: Partial<Record<FacetKey, string[]>>;
};

function st(over: StateOver = {}): SearchState {
  const base = emptySearchState();
  return { ...base, ...over, excluded: { ...base.excluded, ...(over.excluded ?? {}) } };
}

// Four rows chosen to cover every awkward case at once: a blank sub_topic (E1), a blank
// awarded_by (E3), a row with no write-up (E4), and an `awarded_by` value that appears
// nowhere else so we can prove the keyword box doesn't search it.
const E1 = ev({
  date: "2026-05-26",
  recipient: "Aisha Okafor",
  category: "React",
  note: "useEffect runs twice in StrictMode",
  awarded_by: "Sofia Rossi",
  sub_topic: "",
});
const E2 = ev({
  date: "2026-06-03",
  recipient: "Priya Nair",
  category: "React",
  note: "Fragment shorthand avoids a wrapper div",
  awarded_by: "Kenji Tanaka",
  sub_topic: "Read-only",
});
const E3 = ev({
  date: "2026-07-01",
  recipient: "Diego Hernandez",
  role: "Backend",
  category: "SwiftUI",
  note: "NavigationStack replaced NavigationView",
  awarded_by: "",
  sub_topic: "Nav stacks",
});
const E4 = ev({
  date: "2026-08-06",
  recipient: "Aisha Okafor",
  category: "JavaScript",
  note: "",
  awarded_by: "Kenji Tanaka",
  sub_topic: "configuration",
});
const EVENTS = [E1, E2, E3, E4];

const WIDE: DateBounds = { min: "0000-01-01", max: "9999-12-31" };

// ── Primitives ───────────────────────────────────────────────────────────────

test("todayYmd zero-pads and stays on the local date", () => {
  assert.equal(todayYmd(new Date(2026, 8, 5)), "2026-09-05");
  // 00:30 local on Jan 1 is still Dec 31 in UTC for anyone west of Greenwich —
  // toISOString() would report the wrong day here. That's why the helper exists.
  assert.equal(todayYmd(new Date(2026, 0, 1, 0, 30)), "2026-01-01");
});

test("uniqueSorted dedupes, sorts by locale, and keeps blanks", () => {
  // Bare .sort() would strand "configuration" after every capitalized value.
  assert.deepEqual(uniqueSorted(["Tasks", "IP", "configuration", "Validation", "IP"]), [
    "configuration",
    "IP",
    "Tasks",
    "Validation",
  ]);
  assert.deepEqual(uniqueSorted(["b", "", "a"]), ["", "a", "b"]);
});

test("orderedByKnown puts known values first, then unrecognized ones alphabetically", () => {
  assert.deepEqual(
    orderedByKnown(["Zebra", "SwiftUI", "React", "Apple"], [
      "React",
      "CSS",
      "SwiftUI",
    ]),
    ["React", "SwiftUI", "Apple", "Zebra"],
  );
});

// ── Corpus, bounds, options ──────────────────────────────────────────────────

test("corpusFor keeps only written-up stars unless widened", () => {
  assert.deepEqual(corpusFor(EVENTS, false), [E1, E2, E3]);
  assert.deepEqual(corpusFor(EVENTS, true), EVENTS);
  assert.deepEqual(corpusFor([ev({ note: "   " })], false), []);
});

test("facetOptions offers only values present in the data", () => {
  // "CSS" is a configured area no star has used — it must not be offered.
  // This is the portability guarantee: options come from the CSV, never from config.
  const opts = facetOptions(corpusFor(EVENTS, false), "category", [
    "React",
    "CSS",
    "SwiftUI",
  ]);
  assert.deepEqual(
    opts.map((o) => o.value),
    ["React", "SwiftUI"],
  );
});

test("facetOptions dedupes and sorts blanks last with a per-facet label", () => {
  const topics = facetOptions(corpusFor(EVENTS, false), "sub_topic");
  assert.deepEqual(topics, [
    { value: "Nav stacks", label: "Nav stacks" },
    { value: "Read-only", label: "Read-only" },
    { value: "", label: "General" }, // blank last, labelled to match the group heading
  ]);

  const awarders = facetOptions(corpusFor(EVENTS, false), "awarded_by");
  assert.deepEqual(awarders[awarders.length - 1], { value: "", label: "(none)" });

  const people = facetOptions(corpusFor(EVENTS, false), "recipient");
  assert.equal(people.filter((o) => o.value === "Aisha Okafor").length, 1);
});

test("dateBounds runs earliest recorded date → today", () => {
  assert.deepEqual(dateBounds(EVENTS, "2026-08-10"), { min: "2026-05-26", max: "2026-08-10" });
});

test("dateBounds stretches past today for a future-dated star", () => {
  // Preview mode can stage a future-dated draft; a flat `today` would hide it and break
  // "reset to defaults means show everything".
  const withFuture = [...EVENTS, ev({ date: "2026-12-01" })];
  assert.equal(dateBounds(withFuture, "2026-08-10").max, "2026-12-01");
});

test("dateBounds collapses to today when there are no events", () => {
  assert.deepEqual(dateBounds([], "2026-08-10"), { min: "2026-08-10", max: "2026-08-10" });
});

// ── Predicate ────────────────────────────────────────────────────────────────

test("keyword matching is case-insensitive across the four searched fields", () => {
  const hits = (q: string) => applySearch(EVENTS, st({ q }), WIDE);
  assert.deepEqual(hits("FRAGMENT"), [E2]); // note
  assert.deepEqual(hits("read-only"), [E2]); // sub_topic
  assert.deepEqual(hits("diego"), [E3]); // recipient
  assert.deepEqual(hits("swiftui"), [E3]); // category
});

test("keyword does not search awarded_by or role", () => {
  // Both have dedicated facets now; searching role would make "frontend" match most of
  // the board.
  assert.deepEqual(applySearch(EVENTS, st({ q: "Tanaka" }), WIDE), []);
  assert.deepEqual(applySearch(EVENTS, st({ q: "Backend" }), WIDE), []);
});

test("multi-term keyword ANDs, with terms free to land in different fields", () => {
  // "fragment" is in the note, "priya" in the recipient — no single field holds both, so
  // the old single-substring match returned nothing for this.
  assert.deepEqual(applySearch(EVENTS, st({ q: "fragment priya" }), WIDE), [E2]);
  assert.deepEqual(applySearch(EVENTS, st({ q: "fragment diego" }), WIDE), []);
});

test("a whitespace-only keyword filters nothing", () => {
  assert.deepEqual(applySearch(EVENTS, st({ q: "   " }), WIDE), [E1, E2, E3]);
});

test("date range is inclusive at both ends and falls back to the bounds", () => {
  const b = dateBounds(EVENTS, "2026-08-10");
  assert.deepEqual(applySearch(EVENTS, st({ from: "2026-06-03", to: "2026-07-01" }), b), [E2, E3]);
  assert.deepEqual(applySearch(EVENTS, st({ from: "2026-06-03" }), b), [E2, E3]);
  assert.deepEqual(applySearch(EVENTS, st({ to: "2026-05-26" }), b), [E1]);
  assert.deepEqual(applySearch(EVENTS, st(), b), [E1, E2, E3]);
});

test("an inverted date range yields nothing", () => {
  const b = dateBounds(EVENTS, "2026-08-10");
  assert.deepEqual(applySearch(EVENTS, st({ from: "2026-07-01", to: "2026-06-01" }), b), []);
});

test("includeNoNote widens the predicate to stars without a write-up", () => {
  assert.deepEqual(applySearch(EVENTS, st({ includeNoNote: true }), WIDE), EVENTS);
});

test("an empty exclusion list filters nothing", () => {
  assert.deepEqual(applySearch(EVENTS, st({ excluded: { recipient: [] } }), WIDE), [E1, E2, E3]);
});

test("excluding a value drops exactly its rows", () => {
  assert.deepEqual(applySearch(EVENTS, st({ excluded: { recipient: ["Aisha Okafor"] } }), WIDE), [E2, E3]);
  assert.deepEqual(applySearch(EVENTS, st({ excluded: { role: ["Backend"] } }), WIDE), [E1, E2]);
});

test("excluding every present value yields zero results, not 'no filter'", () => {
  // The edge case that sinks inclusion-set designs. Here it needs no special handling.
  const all = ["Aisha Okafor", "Priya Nair", "Diego Hernandez"];
  assert.deepEqual(applySearch(EVENTS, st({ excluded: { recipient: all } }), WIDE), []);
});

test("excluding a value that isn't in the data is a no-op", () => {
  assert.deepEqual(applySearch(EVENTS, st({ excluded: { recipient: ["Nobody"] } }), WIDE), [
    E1,
    E2,
    E3,
  ]);
});

test("the blank facet value excludes exactly the rows with that field empty", () => {
  assert.deepEqual(applySearch(EVENTS, st({ excluded: { awarded_by: [""] } }), WIDE), [E1, E2]);
  assert.deepEqual(applySearch(EVENTS, st({ excluded: { sub_topic: [""] } }), WIDE), [E2, E3]);
});

test("facets AND together", () => {
  const s = st({ excluded: { role: ["Backend"], recipient: ["Aisha Okafor"] } });
  assert.deepEqual(applySearch(EVENTS, s, WIDE), [E2]);
});

test("matchesSearch agrees with applySearch row by row", () => {
  const s = st({ q: "react", excluded: { category: ["SwiftUI"] } });
  assert.equal(matchesSearch(E1, s, WIDE), true);
  assert.equal(matchesSearch(E3, s, WIDE), false);
  assert.equal(matchesSearch(E4, s, WIDE), false); // no write-up
});

test("applySearch preserves input order", () => {
  const shuffled = [E3, E1, E2];
  assert.deepEqual(applySearch(shuffled, st(), WIDE), [E3, E1, E2]);
});

// ── Counts ───────────────────────────────────────────────────────────────────

test("counts with no filters are plain per-value totals", () => {
  const c = facetCounts(EVENTS, st(), WIDE);
  assert.equal(c.recipient.get("Aisha Okafor"), 1); // E4 has no write-up
  assert.equal(c.category.get("React"), 2);
  assert.equal(c.awarded_by.get(""), 1);
});

test("a facet's own exclusions do not constrain its own counts", () => {
  // The number beside an unchecked box answers "how many rows if I re-check this" — it
  // would be useless if the facet filtered itself.
  const c = facetCounts(EVENTS, st({ excluded: { recipient: ["Aisha Okafor"] } }), WIDE);
  assert.equal(c.recipient.get("Aisha Okafor"), 1);
  assert.equal(c.recipient.get("Priya Nair"), 1);
});

test("other facets do constrain a facet's counts", () => {
  const c = facetCounts(EVENTS, st({ excluded: { role: ["Backend"] } }), WIDE);
  assert.equal(c.recipient.get("Diego Hernandez"), 0); // dropped by the role facet
  assert.equal(c.role.get("Backend"), 1); // but role's own count survives
  assert.equal(c.recipient.get("Aisha Okafor"), 1);
});

test("keyword and date constrain every facet's counts", () => {
  const c = facetCounts(EVENTS, st({ q: "fragment" }), WIDE);
  assert.equal(c.recipient.get("Priya Nair"), 1);
  assert.equal(c.recipient.get("Aisha Okafor"), 0);
  assert.equal(c.category.get("SwiftUI"), 0);

  const b = dateBounds(EVENTS, "2026-08-10");
  const byDate = facetCounts(EVENTS, st({ from: "2026-07-01" }), b);
  assert.equal(byDate.recipient.get("Diego Hernandez"), 1);
  assert.equal(byDate.recipient.get("Aisha Okafor"), 0);
});

test("a filtered-out value keeps a zero entry instead of vanishing", () => {
  // Options must not reflow under the cursor, so every present value stays in the map.
  const c = facetCounts(EVENTS, st({ q: "fragment" }), WIDE);
  assert.equal(c.recipient.has("Diego Hernandez"), true);
  assert.equal(c.recipient.get("Diego Hernandez"), 0);
});

test("counts follow the corpus toggle", () => {
  const c = facetCounts(EVENTS, st({ includeNoNote: true }), WIDE);
  assert.equal(c.recipient.get("Aisha Okafor"), 2);
  assert.equal(c.sub_topic.get("configuration"), 1);
});

// ── URL codec ────────────────────────────────────────────────────────────────

test("the default state encodes to an empty query string", () => {
  assert.equal(encodeSearch(emptySearchState()).toString(), "");
});

test("state survives a round-trip through the query string", () => {
  const s = st({
    q: "react hooks",
    from: "2026-06-01",
    to: "2026-07-01",
    includeNoNote: true,
    excluded: { recipient: ["Aisha Okafor"], awarded_by: [""], category: ["React"] },
  });
  assert.deepEqual(decodeSearch(new URLSearchParams(encodeSearch(s).toString())), s);
});

test("encode(decode(encode(s))) is a fixed point", () => {
  // This is what proves the URL-sync effects can't ping-pong: the writer and reader compare
  // encoded strings, so encoding has to be stable under a round-trip.
  const s = st({
    q: "fragment",
    to: "2026-07-01",
    excluded: { sub_topic: ["Read-only", "HH Visit sets"], role: ["Backend"] },
  });
  const once = encodeSearch(s).toString();
  assert.equal(encodeSearch(decodeSearch(new URLSearchParams(once))).toString(), once);
});

test("states differing only in array order or duplicates encode identically", () => {
  const a = st({ excluded: { recipient: ["Aisha Okafor", "Priya Nair"] } });
  const b = st({ excluded: { recipient: ["Priya Nair", "Aisha Okafor", "Aisha Okafor"] } });
  assert.equal(encodeSearch(a).toString(), encodeSearch(b).toString());
});

test("awkward characters survive the wire format", () => {
  // Repeated keys instead of a delimiter is exactly what buys this — no escape scheme.
  const values = uniqueSorted(["a&b", "c=d", "e+f", "g%h", "i,j", "k#l", "m n", "Read-only"]);
  const s = st({ excluded: { sub_topic: values } });
  const back = decodeSearch(new URLSearchParams(encodeSearch(s).toString()));
  assert.deepEqual(back.excluded.sub_topic, values);
});

test("the blank facet value survives without a sentinel", () => {
  const s = st({ excluded: { awarded_by: [""] } });
  const encoded = encodeSearch(s).toString();
  assert.equal(encoded, "xawarder=");
  assert.deepEqual(decodeSearch(new URLSearchParams(encoded)).excluded.awarded_by, [""]);
});

test("an old ?q= deep link still decodes", () => {
  const s = decodeSearch(new URLSearchParams("q=hooks"));
  assert.deepEqual(s, st({ q: "hooks" }));
});

test("a malformed date param is dropped rather than poisoning comparisons", () => {
  const s = decodeSearch(new URLSearchParams("from=yesterday&to=2026-13"));
  assert.equal(s.from, "");
  assert.equal(s.to, "");
});

test("encodeSearch preserves unrelated params and clears stale ones it owns", () => {
  const base = new URLSearchParams("keep=1&q=stale&xrole=Frontend");
  const p = encodeSearch(st({ q: "fresh" }), base);
  assert.equal(p.get("keep"), "1");
  assert.equal(p.get("q"), "fresh");
  assert.equal(p.getAll("xrole").length, 0);
});

test("isDefaultState and activeFilterCount track each deviation", () => {
  assert.equal(isDefaultState(emptySearchState()), true);
  assert.equal(activeFilterCount(emptySearchState()), 0);
  assert.equal(isDefaultState(st({ q: "   " })), true); // whitespace isn't a filter

  for (const over of [
    { q: "react" },
    { from: "2026-06-01" },
    { to: "2026-06-01" },
    { includeNoNote: true },
    { excluded: { role: ["Backend"] } },
  ] satisfies StateOver[]) {
    assert.equal(isDefaultState(st(over)), false);
    assert.equal(activeFilterCount(st(over)), 1);
  }

  // Each facet counts once no matter how many values it excludes.
  assert.equal(activeFilterCount(st({ excluded: { role: ["Backend", "Frontend"] } })), 1);
  assert.equal(activeFilterCount(st({ q: "a", excluded: { role: ["Backend"], recipient: ["x"] } })), 3);
});
