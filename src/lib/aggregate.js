import Papa from "papaparse";

// One gold-star event = one row in gold-stars.csv. Shape:
//   date        YYYY-MM-DD
//   recipient   who is recognized
//   role        cosmetic specialty badge — see ROLES (optional, blank ok)
//   category    knowledge area — see CATEGORIES
//   note        problem & solution summary; its presence = "in the knowledge base"
//   source      how the row was entered — see SOURCES
//   awarded_by  who recognized them (optional; blank for self-research)
//   sub_topic   optional free-text sub-division of the category, e.g. "hooks"

/** Allowed values for the categorical fields — single source of truth shared by
 *  the parser, the docs, and the "Award a Star" form dropdowns. */
export const ROLES = ["Frontend", "Backend", "Mobile", "Full-stack"];

/** Knowledge areas this board tracks. */
export const CATEGORIES = ["React", "JavaScript", "CSS", "SwiftUI"];

/** How a star reached the CSV: "Email" when submitted via the form, "Manual" otherwise. */
export const SOURCES = ["Email", "Manual"];

/** The CSV column order — kept in one place so toCsvRow and the header agree. */
export const CSV_COLUMNS = [
  "date", "recipient", "role", "category", "note", "source", "awarded_by", "sub_topic",
];

/** Serialize one event to a single CSV line matching gold-stars.csv's column order.
 *  Uses papaparse so commas/quotes/newlines in fields (e.g. notes) are RFC-4180
 *  escaped correctly instead of hand-rolling the quoting. No trailing newline. */
export function toCsvRow(e) {
  return Papa.unparse([CSV_COLUMNS.map((c) => e[c])], { header: false });
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Inclusive list of "YYYY-MM" keys from startKey to endKey. */
function monthRange(startKey, endKey) {
  const out = [];
  let [y, m] = startKey.split("-").map(Number);
  const [ey, em] = endKey.split("-").map(Number);
  while ((y < ey || (y === ey && m <= em)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/** Stats for one person over a time window — total, rank, a month-by-month trend,
 *  their category mix, and their recent stars. `cutoff` ("YYYY-MM-DD") bounds the
 *  window (omit for all-time); `today` ("YYYY-MM-DD") sets the trend's right edge. */
export function personStats(events, name, { cutoff, today }) {
  const periodEvents = events.filter((e) => !cutoff || e.date >= cutoff);
  const mine = periodEvents
    .filter((e) => e.recipient === name)
    .sort((a, b) => a.date.localeCompare(b.date));

  const role = [...mine].reverse().find((e) => e.role)?.role ?? "";

  // Rank among everyone with stars in the window (standard competition ranking).
  const tallies = tallyEvents(periodEvents);
  const mineStars = mine.length;
  const rank = mineStars > 0 ? tallies.filter((t) => t.stars > mineStars).length + 1 : 0;

  // Continuous month axis: from the window start (or first star) to today.
  const endKey = today.slice(0, 7);
  const startKey = (cutoff ?? mine[0]?.date ?? today).slice(0, 7);
  const keys = monthRange(startKey > endKey ? endKey : startKey, endKey);
  const spansYears = keys.length > 0 && keys[0].slice(0, 4) !== keys[keys.length - 1].slice(0, 4);
  const byMonth = keys.map((key) => {
    const [, m] = key.split("-").map(Number);
    return {
      key,
      label: spansYears ? `${SHORT_MONTHS[m - 1]} '${key.slice(2, 4)}` : SHORT_MONTHS[m - 1],
      count: mine.filter((e) => e.date.slice(0, 7) === key).length,
    };
  });

  const catMap = new Map();
  for (const e of mine) {
    const c = e.category || "Uncategorized";
    catMap.set(c, (catMap.get(c) ?? 0) + 1);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  return {
    name,
    role,
    total: mineStars,
    rank,
    peers: tallies.length,
    byMonth,
    byCategory,
    recent: [...mine].reverse(),
  };
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return `${MONTHS[m - 1]} ${y}`;
}

export function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse raw CSV text into StarEvents. Rows missing a recipient or a well-formed
 *  date are dropped rather than crashing the page. */
export function parseCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return result.data
    .map((r) => ({
      date: (r.date ?? "").trim(),
      recipient: (r.recipient ?? "").trim(),
      role: (r.role ?? "").trim(),
      category: (r.category ?? "").trim(),
      note: (r.note ?? "").trim(),
      source: (r.source ?? "").trim(),
      awarded_by: (r.awarded_by ?? "").trim(),
      sub_topic: (r.sub_topic ?? "").trim(),
    }))
    .filter((e) => e.recipient && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
}

/** Events are assumed pre-sorted ascending by date so the latest role wins. */
function tallyEvents(events) {
  const byPerson = new Map();
  for (const e of events) {
    const existing = byPerson.get(e.recipient);
    if (existing) {
      existing.stars += 1;
      if (e.role) existing.role = e.role;
    } else {
      byPerson.set(e.recipient, { name: e.recipient, role: e.role, stars: 1 });
    }
  }
  return [...byPerson.values()].sort(
    (a, b) => b.stars - a.stars || a.name.localeCompare(b.name),
  );
}

/** Per-knowledge-area tallies. Areas are listed in CATEGORIES order, then any other
 *  category values seen in the data, and only areas with at least one star are
 *  returned. Within an area, people are sorted by stars desc. */
function tallyByCategory(events) {
  const byCat = new Map();
  for (const e of events) {
    const cat = e.category || "Uncategorized";
    (byCat.get(cat) ?? byCat.set(cat, []).get(cat)).push(e);
  }
  const known = [...CATEGORIES];
  const order = [...known, ...[...byCat.keys()].filter((c) => !known.includes(c))];
  return order
    .filter((c) => byCat.has(c))
    .map((category) => {
      const evs = byCat.get(category);
      return { category, tallies: tallyEvents(evs), total: evs.length };
    });
}

function winnersOf(tallies) {
  if (tallies.length === 0) return [];
  const max = tallies[0].stars;
  if (max === 0) return [];
  return tallies.filter((t) => t.stars === max);
}

/** Tally kudos-givers (from `awarded_by`, blanks ignored), most first. */
function tallySupporters(events) {
  const by = new Map();
  for (const e of events) {
    const n = e.awarded_by.trim();
    if (n) by.set(n, (by.get(n) ?? 0) + 1);
  }
  return [...by.entries()]
    .map(([name, given]) => ({ name, given }))
    .sort((a, b) => b.given - a.given || a.name.localeCompare(b.name));
}

/** Tie-aware top supporter(s) — everyone sharing the max kudos-given count. */
function topSupporters(events) {
  const all = tallySupporters(events);
  if (all.length === 0) return [];
  const max = all[0].given;
  return all.filter((s) => s.given === max);
}

/** Aggregate all star events into the shapes the UI needs: one all-time leaderboard,
 *  per-category tallies, and per-month sections (each with winners + supporter of the
 *  month). Everyone is on one board — no pod/non-pod split. */
export function aggregate(events) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  const byMonth = new Map();
  for (const e of sorted) {
    const key = e.date.slice(0, 7);
    const arr = byMonth.get(key) ?? [];
    arr.push(e);
    byMonth.set(key, arr);
  }

  const months = [...byMonth.entries()]
    .map(([key, evs]) => {
      const tallies = tallyEvents(evs);
      return {
        key,
        label: monthLabel(key),
        tallies,
        winners: winnersOf(tallies),
        supporters: topSupporters(evs),
        total: evs.length,
        events: evs,
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));

  return {
    allTime: tallyEvents(sorted),
    allTimeTotal: sorted.length,
    byCategory: tallyByCategory(sorted),
    months,
  };
}

export function getMonth(agg, key) {
  return agg.months.find((m) => m.key === key);
}
