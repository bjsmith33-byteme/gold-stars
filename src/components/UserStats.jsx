import { useMemo, useState } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Button from "react-bootstrap/Button";
import ListGroup from "react-bootstrap/ListGroup";
import { personStats } from "../lib/aggregate.js";
import { ROSTER, roleFor } from "../lib/roster.js";
import { AREA_EMOJI } from "./KnowledgeBase.jsx";
import { SpecialtyBadge } from "./SpecialtyBadge.jsx";

const PERIODS = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "This year" },
  { key: "all", label: "All time" },
];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** cutoff date ("YYYY-MM-DD") for a period, or undefined for all-time. */
function cutoffFor(period) {
  if (period === "all") return undefined;
  if (period === "ytd") return `${new Date().getFullYear()}-01-01`;
  const d = new Date();
  d.setDate(d.getDate() - (period === "30d" ? 30 : 90));
  return ymd(d);
}

export function UserStats({ events, selected, onSelect }) {
  const today = ymd(new Date());
  const name = selected; // controlled by the parent so leaderboard clicks can set it
  const [period, setPeriod] = useState("90d");

  // Every roster member plus anyone who has a star but isn't on the roster.
  const names = useMemo(
    () =>
      [...new Set([...Object.keys(ROSTER), ...events.map((e) => e.recipient)])].sort((a, b) =>
        a.localeCompare(b),
      ),
    [events],
  );

  const hasAnyEver = useMemo(
    () => !!name && events.some((e) => e.recipient === name),
    [events, name],
  );

  const stats = useMemo(
    () => (name ? personStats(events, name, { cutoff: cutoffFor(period), today }) : null),
    [events, name, period, today],
  );

  const periodLabel = PERIODS.find((p) => p.key === period).label.toLowerCase();
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
        <ButtonGroup size="sm">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              variant={period === p.key ? "warning" : "outline-secondary"}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {!stats ? (
        <p className="text-body-secondary fst-italic mb-0">
          Pick your name to see your stars and how they're growing over time.
        </p>
      ) : (
        <>
          <div className="d-flex flex-wrap align-items-baseline gap-2 mb-3">
            <span className="fs-5 fw-bold">{stats.name}</span>
            <SpecialtyBadge role={stats.role || roleFor(stats.name)} />
            <span>
              <strong>{stats.total}</strong> ⭐ in the {periodLabel}
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
                  issue, make a recommendation, or explain how or why something works. Your first
                  gold star is waiting.
                </p>
              </Card>
            )
          ) : (
            <>
              {/* Growth over time */}
              <div className="mb-3">
                <div className="small fw-semibold text-body-secondary mb-1">Stars over time</div>
                <div className="d-flex align-items-end gap-1" style={{ height: "6rem" }}>
                  {stats.byMonth.map((m) => (
                    <div
                      key={m.key}
                      className="flex-fill d-flex flex-column align-items-center justify-content-end gap-1"
                      style={{ minWidth: 0 }}
                      title={`${m.label}: ${m.count}`}
                    >
                      <span className="text-body-secondary" style={{ fontSize: "0.65rem", lineHeight: 1 }}>
                        {m.count || ""}
                      </span>
                      <div
                        className="stat-bar w-100"
                        style={{ maxWidth: "28px", height: `${(m.count / monthMax) * 100}%` }}
                      />
                      <span
                        className="text-body-secondary text-truncate w-100 text-center"
                        style={{ fontSize: "0.65rem", lineHeight: 1 }}
                      >
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By knowledge area */}
              <div className="mb-3">
                <div className="small fw-semibold text-body-secondary mb-1">By knowledge area</div>
                <div className="d-flex flex-column gap-1">
                  {stats.byCategory.map((c) => (
                    <div key={c.category} className="d-flex align-items-center gap-2">
                      <span className="text-truncate" style={{ width: "10rem", flexShrink: 0 }}>
                        {AREA_EMOJI[c.category] ?? "✨"} {c.category}
                      </span>
                      <div className="stat-bar-track flex-fill" style={{ height: "0.75rem" }}>
                        <div
                          className="stat-bar"
                          style={{ height: "0.75rem", width: `${(c.count / catMax) * 100}%` }}
                        />
                      </div>
                      <span className="fw-semibold text-end" style={{ width: "1.5rem" }}>
                        {c.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

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
