import Papa from "papaparse";
// Explicit .ts extension so Node's test runner (type-stripping) resolves this at
// runtime; tsc/vite accept it via allowImportingTsExtensions.
import TEAM from "../config/team.config.ts";

/** One gold-star event = one row in gold-stars.csv. */
export interface StarEvent {
  date: string; // YYYY-MM-DD
  recipient: string;
  role: string; // one of ROLES — see roles.values in team.config
  category: string; // knowledge area — see CATEGORIES
  note: string; // problem & solution summary; its presence = "in the knowledge base"
  source: string; // how the row was entered — see SOURCES
  awarded_by: string; // optional; blank for self-research
  sub_topic: string; // optional "; "-separated tags within the category (emergent) — see subTopicsOf
}

export interface Tally {
  name: string;
  role: string;
  stars: number;
}

/** A "supporter" = someone who recognizes others; tallied from `awarded_by`. */
export interface Supporter {
  name: string;
  given: number; // how many stars this person awarded that period
}

// ── Values derived from the team config ──────────────────────────────────────
// These were literals here until the config seam landed. They stay exported from
// this module so every existing importer is unchanged; edit src/config/team.config.ts
// to change them.

/** Allowed values for the role column — the "Award a Star" form's dropdown, and what
 *  the roster may assign. */
export const ROLES: string[] = TEAM.roles.values;

/** Roles that count as "on the team" for the competitive leaderboard. Anyone who earns
 *  a star with a role outside this list (blank, or e.g. "TS") is a "friend" — tracked
 *  separately, off the main board. An EMPTY podRoles means one unified board: everyone
 *  qualifies and the friends list comes back empty. */
export function isPodRole(role: string): boolean {
  if (TEAM.roles.podRoles.length === 0) return true;
  return TEAM.roles.podRoles.includes(role.trim());
}

/** Badge text for a former member. */
export const ALUM_ROLE: string = TEAM.roles.alumniRole ?? "Alum";

const ALUMNI = new Set((TEAM.roles.alumni ?? []).map((n) => n.trim().toLowerCase()));

/** Has this person left the team? Alumni are matched by NAME, not by role, because their
 *  historical CSV rows still carry the role they held at the time (that's deliberate — it
 *  keeps past months accurate). Name matching is what lets one person be counted in the
 *  months they earned stars and excluded from the cumulative board. */
export function isAlum(name: string): boolean {
  return ALUMNI.has(name.trim().toLowerCase());
}

/** The role to DISPLAY for someone — `ALUM_ROLE` for a former member, otherwise the role
 *  passed in (their latest event's role, or a roster lookup). Alumni win so a badge never
 *  shows the role they held before leaving. */
export function displayRole(name: string, role: string): string {
  return isAlum(name) ? ALUM_ROLE : role;
}

/** Knowledge areas, in board order. */
export const CATEGORIES: string[] = TEAM.categories.map((c) => c.name);

/** The emoji that signals each area in a chat kudos message. Single source of truth for
 *  the in-app composer — matches the earliest-signal patterns the auto-tally recognizes
 *  (see CATEGORY_RULES in teams.ts). Areas with no emoji ("") fall through to the
 *  configured fallback category when the tally reads the message. */
export const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  TEAM.categories.map((c) => [c.name, c.kudosEmoji ?? ""]),
);

/** The glyph shown beside each area on the board and in the knowledge base. Unlike
 *  CATEGORY_EMOJI, every area has one — it's display-only and never parsed. */
export const AREA_EMOJI: Record<string, string> = Object.fromEntries(
  TEAM.categories.map((c) => [c.name, c.emoji]),
);

// How a star reached the CSV (not where the help happened): "Teams" from the
// ⭐ auto-tally, "Email" when emailed in via the form, "Manual" otherwise.
export const SOURCES: string[] = TEAM.sources;

/** The CSV column order — kept in one place so toCsvRow and any header writer agree. */
// Order matters and is the CSV header. `sub_topic` is APPENDED so older 7-column rows
// still parse correctly (they just get an empty sub_topic).
export const CSV_COLUMNS: (keyof StarEvent)[] = [
  "date", "recipient", "role", "category", "note", "source", "awarded_by", "sub_topic",
];

/** Serialize one event to a single CSV line matching gold-stars.csv's column order.
 *  Uses papaparse so commas/quotes/newlines in fields (e.g. notes) are RFC-4180
 *  escaped correctly instead of hand-rolling the quoting. No trailing newline. */
export function toCsvRow(e: StarEvent): string {
  return Papa.unparse([CSV_COLUMNS.map((c) => e[c])], { header: false });
}

// ── Sub-topic tags ───────────────────────────────────────────────────────────
// The `sub_topic` cell holds a "; "-separated LIST of tags, the first of which is the
// entry's home in the knowledge-base tree. The implementation lives in lib/search.ts (the
// config-free module — the sub_topic facet is built on it and search.test.ts must not pull
// in team.config), and is re-exported here so every caller reads the CSV column's helpers
// from the CSV module.
export {
  SUB_TOPIC_SEP,
  splitSubTopics,
  subTopicsOf,
  primarySubTopic,
  joinSubTopics,
} from "./search.ts";

export interface MonthData {
  key: string; // "2026-05"
  label: string; // "May 2026"
  tallies: Tally[]; // sorted by stars desc
  winners: Tally[]; // tie-aware (everyone sharing the max)
  supporters: Supporter[]; // tie-aware top nominator(s) that month — "Supporter of the Month"
  total: number;
  events: StarEvent[];
}

export interface CategoryTally {
  category: string;
  tallies: Tally[]; // people with stars in this area, sorted by stars desc
  total: number;
}

export interface Aggregated {
  allTime: Tally[]; // current isPodRole earners — the competitive leaderboard (no alumni)
  allTimeTotal: number; // current pod stars only (no alumni)
  friendsAllTime: Tally[]; // non-pod star-earners ("friends"); empty when podRoles is []
  alumniAllTime: Tally[]; // former members' stars; empty when roles.alumni is []
  byCategory: CategoryTally[]; // all-time, per knowledge area (areas with >=1 star); includes everyone
  months: MonthData[]; // sorted by key desc (newest first); pod-only competition
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface MonthCount {
  key: string; // "2026-05"
  label: string; // "May" (with year if the range spans years)
  count: number;
}

export interface PersonStats {
  name: string;
  role: string;
  total: number;
  rank: number; // competition rank among people with stars in the period (1 = most); 0 if none
  peers: number; // how many people earned stars in the period
  byMonth: MonthCount[]; // continuous month axis across the period (zeros included) for the trend
  byCategory: { category: string; count: number }[]; // their areas, most first
  recent: StarEvent[]; // their stars in the period, newest first
}

/** Inclusive list of "YYYY-MM" keys from startKey to endKey. */
function monthRange(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  let [y, m] = startKey.split("-").map(Number);
  const [ey, em] = endKey.split("-").map(Number);
  while ((y < ey || (y === ey && m <= em)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/** Stats for one person over a time window — total, pod rank, a month-by-month trend,
 *  their category mix, and their recent stars.
 *
 *  `cutoff` and `until` ("YYYY-MM-DD", both optional and both inclusive) bound the window;
 *  omit both for all-time. `today` sets the trend's right edge unless `until` moves it in,
 *  which is what makes a custom range shorten the chart at BOTH ends rather than just
 *  filtering rows out of a fixed axis. Rank and peers come from the same window, so they
 *  follow whatever range is asked for. */
export function personStats(
  events: StarEvent[],
  name: string,
  { cutoff, until, today }: { cutoff?: string; until?: string; today: string },
): PersonStats {
  const periodEvents = events.filter(
    (e) => (!cutoff || e.date >= cutoff) && (!until || e.date <= until),
  );
  const mine = periodEvents
    .filter((e) => e.recipient === name)
    .sort((a, b) => a.date.localeCompare(b.date));

  const role = [...mine].reverse().find((e) => e.role)?.role ?? "";

  // Rank among everyone with stars in the window (standard competition ranking).
  const tallies = tallyEvents(periodEvents);
  const mineStars = mine.length;
  const rank = mineStars > 0 ? tallies.filter((t) => t.stars > mineStars).length + 1 : 0;

  // Continuous month axis: from the window start (or first star) to the window end.
  const endKey = (until ?? today).slice(0, 7);
  const startKey = (cutoff ?? mine[0]?.date ?? until ?? today).slice(0, 7);
  const keys = monthRange(startKey > endKey ? endKey : startKey, endKey);
  const spansYears = keys.length > 0 && keys[0].slice(0, 4) !== keys[keys.length - 1].slice(0, 4);
  const byMonth: MonthCount[] = keys.map((key) => {
    const [, m] = key.split("-").map(Number);
    return {
      key,
      label: spansYears ? `${SHORT_MONTHS[m - 1]} '${key.slice(2, 4)}` : SHORT_MONTHS[m - 1],
      count: mine.filter((e) => e.date.slice(0, 7) === key).length,
    };
  });

  const catMap = new Map<string, number>();
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

export interface PersonChartSeries {
  labels: string[]; // shared month axis
  aggregate: number[]; // total stars per month
  faceted: { category: string; counts: number[] }[]; // one series per area, aligned to labels
}

/** Chart-ready series derived from personStats() output — the shapes a chart wants
 *  (parallel label/count arrays) rather than the row-per-month shape the CSS bars use.
 *  Returns a single shared month axis plus two views of the same window:
 *    - `aggregate`: one total-stars count per month.
 *    - `faceted`:   one series per knowledge area, each an array of monthly counts
 *                   aligned to `labels`, so the areas can stack onto one month axis.
 *  The month×category matrix is built here (one pass over the window's events) instead
 *  of in personStats, so it's only computed when a chart actually needs it. */
export function personChartSeries(stats: PersonStats): PersonChartSeries {
  const labels = stats.byMonth.map((m) => m.label);
  const monthKeys = stats.byMonth.map((m) => m.key);
  const totals = stats.byMonth.map((m) => m.count);

  // month → category → count. The "YYYY-MM cat" key is unambiguous: a month key has no space.
  const counts = new Map<string, number>();
  for (const e of stats.recent) {
    const key = `${e.date.slice(0, 7)} ${e.category || "Uncategorized"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Read out in byCategory's existing order (stars desc) so series colors are stable.
  const faceted = stats.byCategory.map(({ category }) => ({
    category,
    counts: monthKeys.map((mk) => counts.get(`${mk} ${category}`) ?? 0),
  }));

  return { labels, aggregate: totals, faceted };
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return `${MONTHS[m - 1]} ${y}`;
}

export function currentMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse raw CSV text into validated StarEvents. Rows missing a recipient or a
 *  well-formed date are dropped rather than crashing the page. */
export function parseCsv(text: string): StarEvent[] {
  const result = Papa.parse<Record<string, string>>(text, {
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
function tallyEvents(events: StarEvent[]): Tally[] {
  const byPerson = new Map<string, Tally>();
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
 *  category values seen in the data (e.g. legacy/unknown), and only areas with at
 *  least one star are returned. Within an area, people are sorted by stars desc. */
function tallyByCategory(events: StarEvent[]): CategoryTally[] {
  const byCat = new Map<string, StarEvent[]>();
  for (const e of events) {
    const cat = e.category || "Uncategorized";
    (byCat.get(cat) ?? byCat.set(cat, []).get(cat)!).push(e);
  }
  const known = [...CATEGORIES] as string[];
  const order = [...known, ...[...byCat.keys()].filter((c) => !known.includes(c))];
  return order
    .filter((c) => byCat.has(c))
    .map((category) => {
      const evs = byCat.get(category)!;
      return { category, tallies: tallyEvents(evs), total: evs.length };
    });
}

function winnersOf(tallies: Tally[]): Tally[] {
  if (tallies.length === 0) return [];
  const max = tallies[0].stars;
  if (max === 0) return [];
  return tallies.filter((t) => t.stars === max);
}

/** Tally kudos-givers (from `awarded_by`, blanks ignored), most first. */
function tallySupporters(events: StarEvent[]): Supporter[] {
  const by = new Map<string, number>();
  for (const e of events) {
    const n = e.awarded_by.trim();
    if (n) by.set(n, (by.get(n) ?? 0) + 1);
  }
  return [...by.entries()]
    .map(([name, given]) => ({ name, given }))
    .sort((a, b) => b.given - a.given || a.name.localeCompare(b.name));
}

/** Tie-aware top supporter(s) — everyone sharing the max kudos-given count. */
function topSupporters(events: StarEvent[]): Supporter[] {
  const all = tallySupporters(events);
  if (all.length === 0) return [];
  const max = all[0].given;
  return all.filter((s) => s.given === max);
}

export function aggregate(events: StarEvent[]): Aggregated {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  // The leaderboard + monthly competition are limited to roles.podRoles. Non-pod
  // earners are surfaced separately as "friends" (and when podRoles is empty, everyone
  // is pod and that list is empty). Knowledge views (By Knowledge Area, the
  // Knowledge Base, My Stats) intentionally include everyone — broadening shared
  // knowledge is the whole point of watching the cross-team chats.
  //
  // Alumni are a third bucket, split off by NAME. `podEvents` still includes their old
  // stars so PAST MONTHS are unchanged — someone who won May stays May's winner after
  // they leave. The cumulative board reads `currentPodEvents` instead, which drops them.
  const alumniEvents = sorted.filter((e) => isAlum(e.recipient));
  const podEvents = sorted.filter((e) => isPodRole(e.role));
  const currentPodEvents = podEvents.filter((e) => !isAlum(e.recipient));
  // An alum is never also a "friend", whatever role their rows carry.
  const friendEvents = sorted.filter((e) => !isPodRole(e.role) && !isAlum(e.recipient));

  const byMonth = new Map<string, StarEvent[]>();
  for (const e of podEvents) {
    const key = e.date.slice(0, 7);
    const arr = byMonth.get(key) ?? [];
    arr.push(e);
    byMonth.set(key, arr);
  }

  // Supporter of the Month is tallied over ALL of a month's stars (pod + friends) —
  // recognizing someone is worth celebrating regardless of who was cheered.
  const byMonthAll = new Map<string, StarEvent[]>();
  for (const e of sorted) {
    const key = e.date.slice(0, 7);
    (byMonthAll.get(key) ?? byMonthAll.set(key, []).get(key)!).push(e);
  }

  const months: MonthData[] = [...byMonth.entries()]
    .map(([key, evs]) => {
      const tallies = tallyEvents(evs);
      return {
        key,
        label: monthLabel(key),
        tallies,
        winners: winnersOf(tallies),
        supporters: topSupporters(byMonthAll.get(key) ?? evs),
        total: evs.length,
        events: evs,
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));

  return {
    allTime: tallyEvents(currentPodEvents),
    allTimeTotal: currentPodEvents.length,
    friendsAllTime: tallyEvents(friendEvents),
    // Badge the alumni board with ALUM_ROLE rather than the role their last star carried.
    alumniAllTime: tallyEvents(alumniEvents).map((t) => ({ ...t, role: ALUM_ROLE })),
    byCategory: tallyByCategory(sorted),
    months,
  };
}

export function getMonth(agg: Aggregated, key: string): MonthData | undefined {
  return agg.months.find((m) => m.key === key);
}
