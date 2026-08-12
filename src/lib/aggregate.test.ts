import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  ALUM_ROLE,
  displayRole,
  isAlum,
  isPodRole,
  joinSubTopics,
  personStats,
  primarySubTopic,
  ROLES,
  splitSubTopics,
  subTopicsOf,
  toCsvRow,
  type StarEvent,
} from "./aggregate.ts";

// These tests run against the LIVE src/config/team.config.ts, so they double as a
// check that the config is coherent. This template configures `roles.podRoles: []`
// — one unified board — which is what the pod-split cases below assert.

function ev(over: Partial<StarEvent> = {}): StarEvent {
  return {
    date: "2026-06-01",
    recipient: "Aisha Okafor",
    role: "Frontend",
    category: "React",
    note: "",
    source: "Manual",
    awarded_by: "Diego Hernandez",
    sub_topic: "",
    ...over,
  };
}

test("isPodRole accepts everyone while podRoles is empty (one unified board)", () => {
  assert.equal(isPodRole("Frontend"), true);
  assert.equal(isPodRole("Backend"), true);
  assert.equal(isPodRole(" Mobile "), true); // trimmed
  assert.equal(isPodRole(""), true, "a blank role still competes");
  assert.equal(isPodRole("Visiting Contractor"), true, "an unknown role still competes");
});

test("aggregate puts everyone on one board and leaves the friends list empty", () => {
  const agg = aggregate([
    ev({ recipient: "Aisha Okafor", role: "Frontend" }),
    ev({ recipient: "Kenji Tanaka", role: "Backend" }),
    ev({ recipient: "Pat Visitor", role: "Guest" }),
    ev({ recipient: "Sam Newcomer", role: "" }),
  ]);

  assert.deepEqual(
    agg.allTime.map((t) => t.name).sort(),
    ["Aisha Okafor", "Kenji Tanaka", "Pat Visitor", "Sam Newcomer"],
    "every earner is on the leaderboard",
  );
  assert.deepEqual(agg.friendsAllTime, [], "no separate friends board when podRoles is []");
  assert.equal(agg.allTimeTotal, 4, "all-time total counts every star");
});

test("Supporter of the Month = top kudos-giver (awarded_by), tie-aware", () => {
  const agg = aggregate([
    ev({ date: "2026-06-02", recipient: "Aisha Okafor", awarded_by: "Priya Nair" }),
    ev({ date: "2026-06-03", recipient: "Kenji Tanaka", awarded_by: "Priya Nair" }),
    // a kudos to someone off the roster still counts toward the giver's tally
    ev({ date: "2026-06-04", recipient: "Pat Visitor", role: "", awarded_by: "Priya Nair" }),
    ev({ date: "2026-06-05", recipient: "Aisha Okafor", awarded_by: "Sofia Rossi" }),
    // blank awarded_by (self-research) is ignored
    ev({ date: "2026-06-06", recipient: "Aisha Okafor", awarded_by: "" }),
  ]);
  const june = agg.months.find((m) => m.key === "2026-06")!;
  assert.deepEqual(
    june.supporters.map((s) => s.name),
    ["Priya Nair"],
  );
  assert.equal(june.supporters[0].given, 3);
});

test("Supporter of the Month reports co-supporters on a tie", () => {
  const agg = aggregate([
    ev({ date: "2026-06-02", recipient: "Aisha Okafor", awarded_by: "Priya Nair" }),
    ev({ date: "2026-06-03", recipient: "Kenji Tanaka", awarded_by: "Sofia Rossi" }),
  ]);
  const june = agg.months.find((m) => m.key === "2026-06")!;
  assert.deepEqual(
    june.supporters.map((s) => s.name).sort(),
    ["Priya Nair", "Sofia Rossi"],
  );
});

test("monthly competition and By Knowledge Area both include everyone", () => {
  const agg = aggregate([
    ev({ date: "2026-06-02", recipient: "Aisha Okafor", category: "React" }),
    ev({ date: "2026-06-03", recipient: "Pat Visitor", role: "", category: "React" }),
  ]);

  const june = agg.months.find((m) => m.key === "2026-06")!;
  assert.deepEqual(
    june.tallies.map((t) => t.name).sort(),
    ["Aisha Okafor", "Pat Visitor"],
    "month winners include every earner",
  );
  assert.equal(june.total, 2);

  const react = agg.byCategory.find((c) => c.category === "React")!;
  assert.equal(react.total, 2, "knowledge area counts every star");
});

// ── Alumni ───────────────────────────────────────────────────────────────────
// This template ships `roles.alumni: []`, so the feature is dormant: nobody is an
// alum, the alumni board is empty, and no one is held out of the cumulative board.
// These assert that dormant state — the same way the podRoles cases above do.
// Populate roles.alumni and the behavior asserted in the last test kicks in.

test("nobody is an alum while roles.alumni is empty", () => {
  assert.equal(isAlum("Aisha Okafor"), false);
  assert.equal(isAlum("Grace Mueller"), false);
  assert.equal(isAlum(""), false);
});

test("displayRole passes the role through untouched while there are no alumni", () => {
  assert.equal(displayRole("Aisha Okafor", "Frontend"), "Frontend");
  assert.equal(displayRole("Grace Mueller", "Mobile"), "Mobile");
  assert.equal(displayRole("Pat Visitor", ""), "");
});

test("no alumni board, and nobody held out of the cumulative totals", () => {
  const agg = aggregate([
    ev({ date: "2026-05-04", recipient: "Grace Mueller", role: "Frontend" }),
    ev({ date: "2026-06-01", recipient: "Aisha Okafor", role: "Frontend" }),
  ]);

  assert.deepEqual(agg.alumniAllTime, [], "empty roles.alumni means no alumni board");
  assert.deepEqual(
    agg.allTime.map((t) => t.name).sort(),
    ["Aisha Okafor", "Grace Mueller"],
    "everyone stays on the leaderboard",
  );
  assert.equal(agg.allTimeTotal, 2, "no stars are excluded");
});

test("ALUM_ROLE is not one of roles.values — an alum can't be awarded in it", () => {
  // Award rows are validated against roles.values (see validateDraftRow in overlay.ts),
  // so ALUM_ROLE must stay outside it or a staged row for an alum would be rejected.
  assert.equal(ROLES.includes(ALUM_ROLE), false);
});

// ── personStats windows ──────────────────────────────────────────────────────

const SPREAD = [
  ev({ date: "2026-03-15", recipient: "Aisha Okafor" }),
  ev({ date: "2026-05-02", recipient: "Aisha Okafor" }),
  ev({ date: "2026-06-20", recipient: "Aisha Okafor" }),
  ev({ date: "2026-08-01", recipient: "Aisha Okafor" }),
  ev({ date: "2026-06-21", recipient: "Diego Hernandez", role: "Backend" }),
];

test("personStats without bounds covers everything up to today", () => {
  const s = personStats(SPREAD, "Aisha Okafor", { today: "2026-08-11" });
  assert.equal(s.total, 4);
  assert.equal(s.byMonth[0].key, "2026-03", "axis starts at the first star");
  assert.equal(s.byMonth[s.byMonth.length - 1].key, "2026-08");
});

test("`until` closes the window at the right-hand end, axis included", () => {
  // The point of a custom range: the chart has to STOP, not just drop rows off a fixed axis.
  const s = personStats(SPREAD, "Aisha Okafor", {
    cutoff: "2026-05-01",
    until: "2026-06-30",
    today: "2026-08-11",
  });
  assert.equal(s.total, 2, "May 2 and Jun 20; Mar 15 and Aug 1 are outside");
  assert.deepEqual(s.byMonth.map((m) => m.key), ["2026-05", "2026-06"]);
  assert.deepEqual(s.recent.map((e) => e.date), ["2026-06-20", "2026-05-02"]);
});

test("both bounds are inclusive", () => {
  const s = personStats(SPREAD, "Aisha Okafor", {
    cutoff: "2026-05-02",
    until: "2026-06-20",
    today: "2026-08-11",
  });
  assert.equal(s.total, 2);
});

test("rank and peers follow the custom window", () => {
  // Diego's only star is Jun 21 — inside the window below, outside the one after it.
  const june = personStats(SPREAD, "Aisha Okafor", {
    cutoff: "2026-06-01",
    until: "2026-06-30",
    today: "2026-08-11",
  });
  assert.equal(june.peers, 2, "both earned one in June");
  assert.equal(june.rank, 1, "tied at one star each, so competition rank is 1");

  const may = personStats(SPREAD, "Aisha Okafor", {
    cutoff: "2026-05-01",
    until: "2026-05-31",
    today: "2026-08-11",
  });
  assert.equal(may.peers, 1, "Diego's star is outside this window");
});

test("an inverted custom range yields an empty window, not a crash", () => {
  const s = personStats(SPREAD, "Aisha Okafor", {
    cutoff: "2026-07-01",
    until: "2026-04-01",
    today: "2026-08-11",
  });
  assert.equal(s.total, 0);
  assert.equal(s.rank, 0);
  // The axis clamps to the end month rather than counting backwards to the 120-month cap.
  assert.deepEqual(s.byMonth.map((m) => m.key), ["2026-04"]);
  assert.equal(s.byMonth[0].count, 0);
});

// ── Sub-topic tags ───────────────────────────────────────────────────────────

test("splitSubTopics splits on ';' with or without spaces, and trims", () => {
  assert.deepEqual(splitSubTopics("hooks; state"), ["hooks", "state"]);
  assert.deepEqual(splitSubTopics("hooks;state"), ["hooks", "state"]);
  assert.deepEqual(splitSubTopics("  hooks ;  state  "), ["hooks", "state"]);
  assert.deepEqual(splitSubTopics("data flow; controlled inputs"), [
    "data flow",
    "controlled inputs",
  ]);
});

test("a legacy single-value cell is just a one-element tag list", () => {
  assert.deepEqual(splitSubTopics("hooks"), ["hooks"]);
  assert.deepEqual(splitSubTopics(" hooks"), ["hooks"], "a stray leading space is trimmed");
});

test("splitSubTopics drops blanks and de-dupes case-insensitively, keeping the first casing", () => {
  assert.deepEqual(splitSubTopics(""), []);
  assert.deepEqual(splitSubTopics("   "), []);
  assert.deepEqual(splitSubTopics(";;"), []);
  assert.deepEqual(splitSubTopics("jsx;;state;"), ["jsx", "state"], "empty segments vanish");
  assert.deepEqual(splitSubTopics("JSX; jsx; Jsx"), ["JSX"], "one option per thing");
  assert.deepEqual(splitSubTopics("jsx; JSX"), ["jsx"], "first casing seen wins");
});

test("subTopicsOf / primarySubTopic read the tags off an event", () => {
  assert.deepEqual(subTopicsOf(ev({ sub_topic: "hooks; state" })), ["hooks", "state"]);
  assert.equal(primarySubTopic(ev({ sub_topic: "hooks; state" })), "hooks", "first = home");
  assert.equal(primarySubTopic(ev({ sub_topic: "" })), "", "untagged has no home");
});

test("joinSubTopics round-trips and can't smuggle a delimiter into the cell", () => {
  const cell = "hooks; state; forms";
  assert.equal(joinSubTopics(splitSubTopics(cell)), cell, "join(split(x)) is a fixed point");
  assert.equal(joinSubTopics(["hooks", "state"]), "hooks; state");
  assert.equal(joinSubTopics([" hooks ", "", "state"]), "hooks; state", "trimmed, blanks gone");
  assert.equal(
    joinSubTopics(["hooks; state"]),
    "hooks; state",
    "a tag containing ';' is divided, not embedded",
  );
  // The round-trip is what keeps toCsvRow honest: whatever the form hands us, the cell it
  // writes parses back to the same tags.
  assert.deepEqual(splitSubTopics(joinSubTopics(["a", "b;c"])), ["a", "b", "c"]);
});

test("a joined cell survives toCsvRow without needing quotes", () => {
  const row = toCsvRow(ev({ note: "", sub_topic: "hooks; state" }));
  assert.ok(row.endsWith(",hooks; state"), `no quoting needed, got: ${row}`);
});
