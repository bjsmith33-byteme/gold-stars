import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  personStats,
  personChartSeries,
  parseCsv,
  toCsvRow,
  monthLabel,
  currentMonthKey,
  getMonth,
} from "./aggregate.js";

function ev(over = {}) {
  return {
    date: "2025-06-01",
    recipient: "Priya Nair",
    role: "Full-stack",
    category: "React",
    note: "",
    source: "Manual",
    awarded_by: "Diego Hernandez",
    sub_topic: "",
    ...over,
  };
}

test("aggregate builds one all-time leaderboard, sorted by stars desc then name", () => {
  const agg = aggregate([
    ev({ recipient: "Priya Nair" }),
    ev({ recipient: "Priya Nair" }),
    ev({ recipient: "Aisha Okafor" }),
    ev({ recipient: "Zoe Anderson" }),
  ]);
  assert.deepEqual(
    agg.allTime.map((t) => `${t.name}:${t.stars}`),
    ["Priya Nair:2", "Aisha Okafor:1", "Zoe Anderson:1"],
  );
  assert.equal(agg.allTimeTotal, 4);
});

test("latest non-blank role wins in a tally", () => {
  const agg = aggregate([
    ev({ recipient: "Priya Nair", date: "2025-06-01", role: "Frontend" }),
    ev({ recipient: "Priya Nair", date: "2025-06-05", role: "Full-stack" }),
  ]);
  assert.equal(agg.allTime[0].role, "Full-stack");
});

test("monthly winners are tie-aware", () => {
  const agg = aggregate([
    ev({ date: "2025-06-02", recipient: "Priya Nair" }),
    ev({ date: "2025-06-03", recipient: "Aisha Okafor" }),
  ]);
  const june = getMonth(agg, "2025-06");
  assert.deepEqual(june.winners.map((w) => w.name).sort(), ["Aisha Okafor", "Priya Nair"]);
  assert.equal(june.total, 2);
});

test("Supporter of the Month = top awarded_by, tie-aware, blanks ignored", () => {
  const agg = aggregate([
    ev({ date: "2025-06-02", recipient: "Priya Nair", awarded_by: "Diego Hernandez" }),
    ev({ date: "2025-06-03", recipient: "Aisha Okafor", awarded_by: "Diego Hernandez" }),
    ev({ date: "2025-06-04", recipient: "Zoe Anderson", awarded_by: "" }),
  ]);
  const june = getMonth(agg, "2025-06");
  assert.deepEqual(june.supporters.map((s) => s.name), ["Diego Hernandez"]);
  assert.equal(june.supporters[0].given, 2);
});

test("By Knowledge Area groups by category in CATEGORIES order", () => {
  const agg = aggregate([
    ev({ category: "CSS", recipient: "Aisha Okafor" }),
    ev({ category: "React", recipient: "Priya Nair" }),
    ev({ category: "React", recipient: "Zoe Anderson" }),
  ]);
  assert.deepEqual(agg.byCategory.map((c) => c.category), ["React", "CSS"]);
  assert.equal(agg.byCategory.find((c) => c.category === "React").total, 2);
});

test("personStats returns total, rank, category mix, and recent (newest first)", () => {
  const events = [
    ev({ date: "2025-05-01", recipient: "Priya Nair", category: "React" }),
    ev({ date: "2025-06-01", recipient: "Priya Nair", category: "CSS" }),
    ev({ date: "2025-06-02", recipient: "Aisha Okafor", category: "React" }),
  ];
  const s = personStats(events, "Priya Nair", { today: "2025-06-15" });
  assert.equal(s.total, 2);
  assert.equal(s.rank, 1);
  assert.equal(s.recent[0].date, "2025-06-01");
  assert.deepEqual(s.byCategory.map((c) => c.category).sort(), ["CSS", "React"]);
});

test("personChartSeries aligns aggregate and faceted counts to one month axis", () => {
  const events = [
    ev({ date: "2025-05-10", recipient: "Priya Nair", category: "React" }),
    ev({ date: "2025-06-05", recipient: "Priya Nair", category: "React" }),
    ev({ date: "2025-06-20", recipient: "Priya Nair", category: "CSS" }),
  ];
  const s = personStats(events, "Priya Nair", { cutoff: "2025-05-01", today: "2025-06-15" });
  const series = personChartSeries(s);

  // May, June axis; aggregate = 1 in May, 2 in June.
  assert.deepEqual(series.labels, s.byMonth.map((m) => m.label));
  assert.deepEqual(series.aggregate, [1, 2]);

  // Faceted: React 1/1 across May/June, CSS 0/1 — each aligned to the same axis.
  const react = series.faceted.find((f) => f.category === "React");
  const css = series.faceted.find((f) => f.category === "CSS");
  assert.deepEqual(react.counts, [1, 1]);
  assert.deepEqual(css.counts, [0, 1]);
  // Every faceted series is the same length as the month axis.
  for (const f of series.faceted) assert.equal(f.counts.length, series.labels.length);
});

test("parseCsv drops rows missing a recipient or a valid date, and trims", () => {
  const csv = [
    "date,recipient,role,category,note,source,awarded_by,sub_topic",
    "2025-06-01, Priya Nair ,Full-stack,React,note,Manual,Diego Hernandez,hooks",
    "not-a-date,Aisha Okafor,Frontend,CSS,,Manual,,",
    "2025-06-02,,Backend,JavaScript,,Manual,,",
  ].join("\n");
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipient, "Priya Nair");
  assert.equal(rows[0].sub_topic, "hooks");
});

test("toCsvRow round-trips through parseCsv", () => {
  const row = ev({ note: 'Has a comma, and "quotes"' });
  const csv = "date,recipient,role,category,note,source,awarded_by,sub_topic\n" + toCsvRow(row);
  const [parsed] = parseCsv(csv);
  assert.equal(parsed.note, 'Has a comma, and "quotes"');
  assert.equal(parsed.recipient, "Priya Nair");
});

test("monthLabel and currentMonthKey format correctly", () => {
  assert.equal(monthLabel("2025-06"), "June 2025");
  assert.equal(monthLabel("garbage"), "garbage");
  assert.equal(currentMonthKey(new Date(2025, 5, 15)), "2025-06");
});
