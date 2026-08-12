import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeFilterCount,
  applySearch,
  compileQuery,
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
  assert.deepEqual(uniqueSorted(["Forms", "JSX", "hooks", "Validation", "JSX"]), [
    "Forms",
    "hooks",
    "JSX",
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

// ── Query compiler: stopwords + synonyms ─────────────────────────────────────

const SYN = [
  { canonical: "hooks", aliases: ["hook", "usestate", "use effect"] },
  // A canonical short enough to sit INSIDE another word ("js" is a substring of "jsx"),
  // which is what the whole-word rule below has to defend against.
  { canonical: "js", aliases: ["javascript"] },
];

/** The terms' typed text, for compact assertions. */
const termTexts = (q: string, groups = SYN) => compileQuery(q, groups).terms.map((t) => t.text);

test("compileQuery drops function words and keeps the rest as terms", () => {
  const c = compileQuery("how do I fix a broken effect", []);
  assert.deepEqual(c.terms.map((t) => t.text), ["fix", "broken", "effect"]);
  assert.deepEqual(c.ignored, ["how", "do", "i", "a"]);
});

test("compileQuery strips edge punctuation but keeps hyphens and digits whole", () => {
  assert.deepEqual(compileQuery("re-render?", []).terms.map((t) => t.literal), ["re-render"]);
  assert.deepEqual(compileQuery("(React 19).", []).terms.map((t) => t.literal), ["react", "19"]);
});

test("an all-function-word query keeps its raw tokens rather than matching everything", () => {
  // Silently turning a typed query into "show everything" would read as a bug, not a feature.
  const c = compileQuery("how do i", []);
  assert.deepEqual(c.terms.map((t) => t.text), ["how", "do", "i"]);
  assert.deepEqual(c.ignored, [], "nothing was dropped, because dropping all of it isn't an option");
});

test("an empty query compiles to no terms, which the predicate treats as no filter", () => {
  assert.deepEqual(compileQuery("   ", SYN), { terms: [], ignored: [] });
  assert.deepEqual(applySearch(EVENTS, st({ q: "   " }), WIDE, SYN), [E1, E2, E3]);
});

test("a synonym term carries the canonical tag and the group's other phrasings", () => {
  const [term] = compileQuery("usestate", SYN).terms;
  assert.equal(term.text, "usestate");
  assert.equal(term.canonical, "hooks", "drives the 'usestate → hooks' chip");
  assert.deepEqual(term.expansions, ["hook", "hooks", "use effect"], "minus what was typed");
});

test("multi-word aliases are matched longest-first, before their words are split up", () => {
  assert.deepEqual(termTexts("use effect"), ["use effect"]);
  assert.deepEqual(termTexts("use effect forms"), ["use effect", "forms"]);
  // A leading word that isn't part of any phrase must not swallow the phrase after it.
  assert.deepEqual(termTexts("stale use effect"), ["stale", "use effect"]);
});

test("a synonym reaches entries that use a different phrasing", () => {
  // E1's note says "useEffect runs twice in StrictMode" — it contains neither "hooks" nor
  // "use effect" as written, and nothing on the board says "usestate".
  const withTag = ev({ note: "cleanup runs on unmount", sub_topic: "hooks" });
  assert.deepEqual(applySearch([withTag], st({ q: "usestate" }), WIDE, SYN), [withTag]);
  assert.deepEqual(applySearch([withTag], st({ q: "use effect" }), WIDE, SYN), [withTag]);
  assert.deepEqual(applySearch([withTag], st({ q: "usestate" }), WIDE), [], "no groups, no expansion");
});

test("expansions match whole words only, so a short tag can't match inside another word", () => {
  // The reason expansions aren't substring-tested: "js" would otherwise hit "jsx" the moment
  // anyone searched "javascript".
  const jsx = ev({ note: "jsx needs one root element", sub_topic: "jsx" });
  assert.deepEqual(applySearch([jsx], st({ q: "javascript" }), WIDE, SYN), []);
  const js = ev({ note: "plain js has no JSX step", sub_topic: "" });
  assert.deepEqual(applySearch([js], st({ q: "javascript" }), WIDE, SYN), [js]);
});

test("what the user typed is still substring-matched, so no old ?q= link loses a result", () => {
  // "js" typed directly keeps its permissive behavior even though it's also a canonical tag.
  const jsx = ev({ note: "jsx needs one root element", sub_topic: "jsx" });
  assert.deepEqual(applySearch([jsx], st({ q: "js" }), WIDE, SYN), [jsx]);
});

test("a chatty question finds exactly what its content words find", () => {
  // The whole point: asking in a sentence must not do worse than typing the keywords. Same
  // content words on both sides — only the function words differ.
  const keywords = applySearch(EVENTS, st({ q: "runs twice" }), WIDE, SYN);
  const question = applySearch(EVENTS, st({ q: "why does it run runs twice?" }), WIDE, SYN);
  assert.deepEqual(question, keywords);
  assert.ok(keywords.length > 0, "and it isn't vacuously equal");
  // Before stopword filtering the question returned nothing, because no row says "why".
  assert.deepEqual(applySearch(EVENTS, st({ q: "why" }), WIDE, SYN), [], "a lone one stays literal");
});

test("facetCounts uses the same synonyms as the results", () => {
  const tagged = ev({ recipient: "Priya Nair", note: "cleanup on unmount", sub_topic: "hooks" });
  const c = facetCounts([tagged, E1], st({ q: "usestate" }), WIDE, SYN);
  assert.equal(c.recipient.get("Priya Nair"), 1, "counted via the synonym");
  assert.equal(c.recipient.get("Aisha Okafor"), 0);
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

// ── Sub-topic tags (multi-value facet) ───────────────────────────────────────
// A separate corpus so the single-value expectations above keep their exact values.
// T1/T2 both carry "hooks", but only T1 has it as a SECONDARY tag.
const T1 = ev({ recipient: "Priya Nair", note: "wrap expensive children in memo", sub_topic: "performance; hooks" });
const T2 = ev({ recipient: "Diego Hernandez", note: "the functional updater avoids a stale value", sub_topic: "hooks; state" });
const T3 = ev({ recipient: "Aisha Okafor", note: "gap spaces children without margin hacks", sub_topic: "flexbox" });
const T4 = ev({ recipient: "Sofia Rossi", note: "no tags on this one", sub_topic: "" });
const TAGGED = [T1, T2, T3, T4];

/** What a chip click encodes: keep one tag by excluding every other present value. */
function keepOnlyTag(tag: string): SearchState {
  const all = facetOptions(TAGGED, "sub_topic").map((o) => o.value);
  return st({ excluded: { sub_topic: all.filter((v) => v !== tag) } });
}

test("facetOptions lists individual tags, not whole cells", () => {
  assert.deepEqual(
    facetOptions(TAGGED, "sub_topic").map((o) => o.value),
    ["flexbox", "hooks", "performance", "state", ""],
    "one option per tag, blank last",
  );
});

test("a chip keeps every entry carrying that tag, primary or not", () => {
  // THE regression this design exists to prevent: "hooks" encodes as "exclude flexbox,
  // performance, state, blank", and T1 is excluded on one of those — but it is still ABOUT
  // hooks, so it must survive.
  assert.deepEqual(applySearch(TAGGED, keepOnlyTag("hooks"), WIDE), [T1, T2]);
  assert.deepEqual(applySearch(TAGGED, keepOnlyTag("flexbox"), WIDE), [T3]);
  assert.deepEqual(applySearch(TAGGED, keepOnlyTag(""), WIDE), [T4], "the General chip");
});

test("a tagged row is dropped only when EVERY one of its tags is excluded", () => {
  // Excluding one tag of two leaves the row reachable by the other.
  assert.deepEqual(applySearch(TAGGED, st({ excluded: { sub_topic: ["hooks"] } }), WIDE), [
    T1,
    T2,
    T3,
    T4,
  ]);
  // Both of T1's tags gone -> T1 goes. T2 keeps "state" and stays.
  assert.deepEqual(
    applySearch(TAGGED, st({ excluded: { sub_topic: ["hooks", "performance"] } }), WIDE),
    [T2, T3, T4],
  );
});

test("an untagged row behaves exactly like one blank value", () => {
  assert.deepEqual(applySearch(TAGGED, st({ excluded: { sub_topic: [""] } }), WIDE), [T1, T2, T3]);
});

test("excluding every present tag still yields nothing", () => {
  const all = facetOptions(TAGGED, "sub_topic").map((o) => o.value);
  assert.deepEqual(applySearch(TAGGED, st({ excluded: { sub_topic: all } }), WIDE), []);
});

test("a multi-tag row counts under each of its tags", () => {
  const c = facetCounts(TAGGED, st(), WIDE);
  assert.equal(c.sub_topic.get("hooks"), 2, "T2 primary + T1 secondary");
  assert.equal(c.sub_topic.get("performance"), 1);
  assert.equal(c.sub_topic.get("state"), 1);
  assert.equal(c.sub_topic.get(""), 1, "the untagged bucket");
});

test("chip counts survive the chips' own selection but follow other facets", () => {
  const own = facetCounts(TAGGED, keepOnlyTag("flexbox"), WIDE);
  assert.equal(own.sub_topic.get("hooks"), 2, "still answers 'what comes back if I click it'");
  assert.equal(own.sub_topic.get("flexbox"), 1);

  const other = facetCounts(TAGGED, st({ excluded: { recipient: ["Priya Nair"] } }), WIDE);
  assert.equal(other.sub_topic.get("performance"), 0, "T1's recipient is filtered out");
  assert.equal(other.sub_topic.get("hooks"), 1, "only T2 is left carrying it");
});

test("the keyword box still substring-matches the raw tag cell", () => {
  // Precision lives in the chips; the box stays a fuzzy fallback over the same text.
  assert.deepEqual(applySearch(TAGGED, st({ q: "performance" }), WIDE), [T1]);
  assert.deepEqual(applySearch(TAGGED, st({ q: "state" }), WIDE), [T2]);
});

test("a chip selection round-trips through the URL", () => {
  const s = keepOnlyTag("hooks");
  const back = decodeSearch(new URLSearchParams(encodeSearch(s).toString()));
  // The codec canonicalizes (uniqueSorted, so the blank leads); what has to survive is the
  // SET of excluded tags and therefore the results.
  assert.deepEqual(back.excluded.sub_topic, uniqueSorted(s.excluded.sub_topic));
  assert.deepEqual(applySearch(TAGGED, back, WIDE), [T1, T2]);
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
    excluded: { sub_topic: ["Read-only", "Reusable components"], role: ["Backend"] },
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
