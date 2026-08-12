import { lazy, Suspense, useMemo, useState } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Button from "react-bootstrap/Button";
import ListGroup from "react-bootstrap/ListGroup";
import { AREA_EMOJI, displayRole, personStats, type StarEvent } from "../lib/aggregate";
import { dateBounds, todayYmd, uniqueSorted } from "../lib/search";
import { ROSTER, roleFor } from "../config/roster";
import { SpecialtyBadge } from "./SpecialtyBadge";
import TEAM from "../config/team.config";

// Lazy so Chart.js (and this chart) land in a separate async chunk, fetched only when a
// person is selected — keeps the initial page bundle from pulling in the chart lib.
const DynamicGraphs = lazy(() => import("./DynamicGraphs"));

type PeriodKey = "30d" | "90d" | "ytd" | "all" | "custom";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "This year" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom…" },
];

/** The window a period selection means — both ends inclusive, `undefined` for unbounded.
 *  The quick buttons only ever set a start; "custom" is the one that can also close off the
 *  right-hand end (a review of "what did I do in Q2"). */
function rangeFor(
  period: PeriodKey,
  custom: { from: string; to: string },
): { cutoff?: string; until?: string } {
  if (period === "all") return {};
  if (period === "custom") return { cutoff: custom.from || undefined, until: custom.to || undefined };
  if (period === "ytd") return { cutoff: `${new Date().getFullYear()}-01-01` };
  const d = new Date();
  d.setDate(d.getDate() - (period === "30d" ? 30 : 90));
  return { cutoff: todayYmd(d) };
}

export function UserStats({
  events,
  selected,
  onSelect,
}: {
  events: StarEvent[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const today = todayYmd();
  const name = selected; // controlled by the parent so leaderboard clicks can set it
  const [period, setPeriod] = useState<PeriodKey>("90d");
  // Kept while other periods are selected, so flipping back to Custom doesn't lose the dates.
  const [custom, setCustom] = useState({ from: "", to: "" });

  // Every roster member plus anyone who has a star but isn't on the roster.
  const names = useMemo(
    () => uniqueSorted([...Object.keys(ROSTER), ...events.map((e) => e.recipient)]),
    [events],
  );

  // Has this person EVER earned a star (ignoring the period)? Drives the zero-state.
  const hasAnyEver = useMemo(
    () => !!name && events.some((e) => e.recipient === name),
    [events, name],
  );

  // The pickers' outer limits: earliest recorded star → today (or a future-dated draft).
  const bounds = useMemo(() => dateBounds(events, today), [events, today]);
  const range = rangeFor(period, custom);

  const stats = useMemo(
    () => (name ? personStats(events, name, { ...range, today }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `range` is derived from these
    [events, name, period, custom.from, custom.to, today],
  );

  const periodLabel =
    period === "custom"
      ? `${range.cutoff ?? bounds.min} → ${range.until ?? bounds.max}`
      : PERIODS.find((p) => p.key === period)!.label.toLowerCase();
  const reversed = period === "custom" && !!custom.from && !!custom.to && custom.from > custom.to;
  const monthMax = stats ? Math.max(1, ...stats.byMonth.map((m) => m.count)) : 1;
  const catMax = stats ? Math.max(1, ...stats.byCategory.map((c) => c.count)) : 1;

  return (
    <Card className="p-3">
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <Form.Select
          value={name}
          onChange={(e) => onSelect(e.target.value)}
          style={{ maxWidth: "16rem" }}
        >
          <option value="" disabled>
            Pick your name…
          </option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Form.Select>
        <ButtonGroup size="sm" role="group" aria-label="Time range">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              variant={period === p.key ? "outline-secondary-selected" : "outline-secondary"}
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {/* The custom range. Same controls as the Knowledge Base's advanced search — an
          <input type="date"> reads back as "YYYY-MM-DD", which is the format the CSV stores
          and everything here compares, so there's no conversion step. Blank means "open at
          that end", which is why neither field is required. */}
      {period === "custom" && (
        <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          <Form.Label htmlFor="stats-from" className="mb-0 small text-body-secondary">
            From
          </Form.Label>
          <Form.Control
            id="stats-from"
            type="date"
            size="sm"
            value={custom.from}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            style={{ maxWidth: "10rem" }}
          />
          <Form.Label htmlFor="stats-to" className="mb-0 small text-body-secondary">
            To
          </Form.Label>
          <Form.Control
            id="stats-to"
            type="date"
            size="sm"
            value={custom.to}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            style={{ maxWidth: "10rem" }}
          />
          {reversed && (
            <span className="small text-body-secondary fst-italic">
              The end date is before the start date.
            </span>
          )}
        </div>
      )}

      {!stats ? (
        <p className="text-body-secondary fst-italic mb-0">
          Pick your name to see your stars and how they're growing over time.
        </p>
      ) : (
        <>
          {/* Headline */}
          <div className="d-flex flex-wrap align-items-baseline gap-2 mb-3">
            <span className="fs-5 fw-bold">{stats.name}</span>
            {/* roster role if they've no stars yet; ALUM_ROLE for a former member */}
            <SpecialtyBadge role={displayRole(stats.name, stats.role || roleFor(stats.name))} />
            <span>
              <strong>{stats.total}</strong> ⭐ · {periodLabel}
              {stats.total > 0 && stats.peers > 1 && (
                <span className="text-body-secondary">
                  {" "}
                  · #{stats.rank} of {stats.peers}
                </span>
              )}
            </span>
          </div>

          {stats.total === 0 ? (
            hasAnyEver ? (
              <p className="text-body-secondary fst-italic mb-0">
                No stars in this window — try a longer period.
              </p>
            ) : (
              <Card body className="bg-body-tertiary">
                <p className="fw-semibold mb-1">No stars yet — your slate's wide open! ⭐</p>
                <p className="mb-0">
                  Learn something new and share it with the team — help a teammate troubleshoot an
                  issue, make a build recommendation, or explain how or why something works. Your
                  first gold star is waiting.
                </p>
              </Card>
            )
          ) : (
            <>
              {/* Growth over time + knowledge-area split — interactive line/bar, toggling
                  between one aggregate series and one series per area. Lazy-loaded so
                  Chart.js only downloads once a person is picked. Teams that turn
                  features.charts off keep the dependency-free CSS bars below. */}
              {TEAM.features.charts ? (
                <Suspense
                  fallback={
                    <div className="text-body-secondary small mb-3" style={{ height: "12rem" }}>
                      Loading chart…
                    </div>
                  }
                >
                  <DynamicGraphs stats={stats} />
                </Suspense>
              ) : (
                <div className="mb-3">
                  <div className="small fw-semibold text-body-secondary mb-1">Stars over time</div>
                  <div className="d-flex align-items-end gap-1" style={{ height: "6rem" }}>
                    {stats.byMonth.map((m) => (
                      <div
                        key={m.key}
                        className="flex-fill d-flex flex-column align-items-center justify-content-end gap-1 min-w-0"
                        title={`${m.label}: ${m.count}`}
                      >
                        <span className="text-body-secondary lh-1" style={{ fontSize: "0.625rem" }}>
                          {m.count || ""}
                        </span>
                        <div
                          className="stat-bar w-100"
                          style={{ maxWidth: "28px", height: `${(m.count / monthMax) * 100}%` }}
                        />
                        <span
                          className="text-body-secondary text-truncate w-100 text-center lh-1"
                          style={{ fontSize: "0.625rem" }}
                        >
                          {m.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By knowledge area. Always shown when charts are off (it's the fallback
                  area view); otherwise it's opt-in, since the chart's By-area facet covers
                  the same ground for teams that find both redundant. */}
              {(!TEAM.features.charts || TEAM.features.areaBars) && (
                <div className="mb-3">
                  <div className="small fw-semibold text-body-secondary mb-1">
                    By knowledge area
                  </div>
                  <div className="d-flex flex-column gap-1">
                    {stats.byCategory.map((c) => (
                      <div key={c.category} className="d-flex align-items-center gap-2">
                        <span className="text-truncate flex-shrink-0" style={{ width: "10rem" }}>
                          {AREA_EMOJI[c.category] ?? "✨"} {c.category}
                        </span>
                        <div className="stat-bar-track flex-fill" style={{ height: "0.75rem" }}>
                          <div
                            className="stat-bar"
                            style={{ height: "0.75rem", width: `${(c.count / catMax) * 100}%` }}
                          />
                        </div>
                        <span className="text-end fw-semibold" style={{ width: "1.5rem" }}>
                          {c.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent stars */}
              <div>
                <div className="small fw-semibold text-body-secondary mb-1">Recent stars</div>
                <ListGroup variant="flush">
                  {stats.recent.slice(0, 15).map((e, i) => (
                    <ListGroup.Item key={i} className="d-flex gap-2 px-0 py-1">
                      <span className="text-body-secondary text-nowrap" style={{ width: "5.5rem" }}>
                        {e.date}
                      </span>
                      <span className="text-nowrap">
                        {AREA_EMOJI[e.category] ?? "✨"} {e.category || "—"}
                      </span>
                      <span className="min-w-0">
                        {e.note || <em className="text-body-secondary">no note</em>}
                      </span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}
