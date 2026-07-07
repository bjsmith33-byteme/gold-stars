import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { toCsvRow } from "./aggregate.js";
import {
  DRAFT_KEY,
  OVERLAY_VERSION,
  validateDraftRow,
  loadOverlay,
  saveOverlay,
  buildBatchBody,
} from "./overlay.js";

// Minimal in-memory localStorage stub (node --test has no DOM). overlay.js only touches
// localStorage inside functions at call time, so setting it here is enough.
class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
beforeEach(() => { globalThis.localStorage = new MemStore(); });

function good(over = {}) {
  return {
    date: "2025-06-01",
    recipient: "Priya Nair",
    role: "Full-stack",
    category: "React",
    note: "useMemo caches an expensive value between renders",
    source: "Email",
    awarded_by: "Diego Hernandez",
    sub_topic: "hooks",
    ...over,
  };
}

test("validateDraftRow accepts a good row, trims, and mints an id", () => {
  const res = validateDraftRow(good({ recipient: "  Priya Nair  " }));
  assert.equal(res.ok, true);
  assert.equal(res.row.recipient, "Priya Nair");
  assert.match(res.row.id, /^d_/);
});

test("validateDraftRow preserves an existing id", () => {
  const res = validateDraftRow(good({ id: "keepme" }));
  assert.equal(res.ok, true);
  assert.equal(res.row.id, "keepme");
});

test("validateDraftRow rejects empty recipient and bad date", () => {
  assert.equal(validateDraftRow(good({ recipient: "" })).ok, false);
  assert.equal(validateDraftRow(good({ date: "2025-6-1" })).ok, false);
  assert.equal(validateDraftRow(good({ date: "not-a-date" })).ok, false);
});

test("validateDraftRow enforces category / role / source", () => {
  assert.equal(validateDraftRow(good({ category: "Ruby" })).ok, false);
  assert.equal(validateDraftRow(good({ role: "Wizard" })).ok, false);
  assert.equal(validateDraftRow(good({ role: "" })).ok, true); // blank role allowed
  assert.equal(validateDraftRow(good({ source: "Teams" })).ok, false);
});

test("validateDraftRow blocks formula-injection prefixes in any field", () => {
  // Trimming neutralizes leading tab/CR, so the ones that survive (= + - @) are what matter,
  // including when preceded by whitespace.
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
  saveOverlay([good({ id: "a" }), { recipient: "", date: "x" }, good({ id: "b" })]);
  const rows = loadOverlay().rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.id), ["a", "b"]);
});

test("saveOverlay -> loadOverlay round-trips valid data", () => {
  saveOverlay([good({ id: "x" })]);
  const rows = loadOverlay().rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipient, "Priya Nair");
  assert.equal(rows[0].id, "x");
});

test("buildBatchBody has one CSV row per entry plus admin instructions", () => {
  const rows = [good({ recipient: "Priya Nair" }), good({ recipient: "Aisha Okafor" })];
  const body = buildBatchBody(rows);
  assert.ok(body.includes(toCsvRow(rows[0])));
  assert.ok(body.includes(toCsvRow(rows[1])));
  assert.ok(body.includes("public/gold-stars.csv"));
});
