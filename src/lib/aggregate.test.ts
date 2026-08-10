import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  ALUM_ROLE,
  displayRole,
  isAlum,
  isPodRole,
  ROLES,
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
