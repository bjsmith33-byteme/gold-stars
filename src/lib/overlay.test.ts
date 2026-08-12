import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { toCsvRow } from "./aggregate.ts";
import {
  DRAFT_KEY,
  OVERLAY_VERSION,
  validateDraftRow,
  loadOverlay,
  saveOverlay,
  buildBatchBody,
  type DraftRow,
} from "./overlay.ts";

// Minimal in-memory localStorage stub (node --test has no DOM). overlay.ts only touches
// localStorage inside functions at call time, so setting it here is enough.
class MemStore {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemStore();
});

/** A valid staged row for THIS team's config (web areas, specialty roles). */
function good(over: Record<string, string> = {}) {
  return {
    date: "2026-06-01",
    recipient: "Aisha Okafor",
    role: "Frontend",
    category: "React",
    note: "The list wouldn't re-render — the key needed to be stable across updates",
    source: "Email",
    awarded_by: "Diego Hernandez",
    sub_topic: "Hooks",
    ...over,
  };
}

test("validateDraftRow accepts a good row, trims, and mints an id", () => {
  const res = validateDraftRow(good({ recipient: "  Aisha Okafor  " }));
  assert.equal(res.ok, true);
  assert.ok(res.ok && res.row.recipient === "Aisha Okafor");
  assert.ok(res.ok && /^d_/.test(res.row.id));
});

test("validateDraftRow preserves an existing id", () => {
  const res = validateDraftRow(good({ id: "keepme" }));
  assert.equal(res.ok, true);
  assert.ok(res.ok && res.row.id === "keepme");
});

test("validateDraftRow rejects empty recipient and bad date", () => {
  assert.equal(validateDraftRow(good({ recipient: "" })).ok, false);
  assert.equal(validateDraftRow(good({ date: "2026-6-1" })).ok, false);
  assert.equal(validateDraftRow(good({ date: "not-a-date" })).ok, false);
});

test("validateDraftRow enforces category / role / source against the team config", () => {
  assert.equal(validateDraftRow(good({ category: "Ruby" })).ok, false);
  assert.equal(validateDraftRow(good({ role: "Wizard" })).ok, false);
  assert.equal(validateDraftRow(good({ role: "" })).ok, true); // blank role allowed
  assert.equal(validateDraftRow(good({ source: "Carrier Pigeon" })).ok, false);
  // This template's SOURCES is ["Email", "Manual"] — no chat auto-tally — so "Teams"
  // must NOT validate. Asserts the rule follows config, not a hardcoded list: a team
  // that adds "Teams" to sources gets it accepted with no code change.
  assert.equal(validateDraftRow(good({ source: "Teams" })).ok, false);
  assert.equal(validateDraftRow(good({ source: "Email" })).ok, true);
});

test("validateDraftRow blocks formula-injection prefixes in any field", () => {
  // Trimming neutralizes leading tab/CR, so the ones that survive (= + - @) are what
  // matter, including when preceded by whitespace.
  for (const bad of ["=1+1", "+1", "-1", "@x", "  =1+1"]) {
    assert.equal(validateDraftRow(good({ note: bad })).ok, false, `note ${JSON.stringify(bad)}`);
  }
  assert.equal(validateDraftRow(good({ recipient: "=cmd" })).ok, false);
});

test("loadOverlay returns empty when absent / invalid JSON / wrong shape / version mismatch", () => {
  assert.deepEqual(loadOverlay().rows, []);

  localStorage.setItem(DRAFT_KEY, "not json{");
  assert.deepEqual(loadOverlay().rows, []);

  localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: OVERLAY_VERSION, rows: "nope" }));
  assert.deepEqual(loadOverlay().rows, []);

  localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 999, rows: [good()] }));
  assert.deepEqual(loadOverlay().rows, []);
});

test("loadOverlay drops only the invalid entries from a mixed array", () => {
  saveOverlay([
    good({ id: "a" }),
    { recipient: "", date: "x" },
    good({ id: "b" }),
  ] as unknown as DraftRow[]);
  const rows = loadOverlay().rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["a", "b"],
  );
});

test("saveOverlay -> loadOverlay round-trips valid data", () => {
  saveOverlay([good({ id: "x" })] as unknown as DraftRow[]);
  const rows = loadOverlay().rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipient, "Aisha Okafor");
  assert.equal(rows[0].id, "x");
});

test("buildBatchBody has one CSV row per entry plus admin instructions", () => {
  const rows = [
    good({ recipient: "Aisha Okafor" }),
    good({ recipient: "Kenji Tanaka" }),
  ] as unknown as DraftRow[];
  const body = buildBatchBody(rows);
  assert.ok(body.includes(toCsvRow(rows[0])));
  assert.ok(body.includes(toCsvRow(rows[1])));
  assert.ok(body.includes("public/gold-stars.csv"));
});
