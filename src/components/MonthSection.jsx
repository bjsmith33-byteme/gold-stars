import Accordion from "react-bootstrap/Accordion";
import { WinnerBanner } from "./WinnerBanner.jsx";
import { SupporterBanner } from "./SupporterBanner.jsx";
import { Leaderboard } from "./Leaderboard.jsx";

/** One collapsible past-month card: winner + leaderboard + supporter of the month. */
export function MonthSection({ month }) {
  const winnerSummary =
    month.winners.length === 0
      ? "—"
      : `${month.winners.map((w) => w.name).join(" & ")} (${month.winners[0].stars} ⭐)`;

  return (
    <Accordion.Item eventKey={month.key}>
      <Accordion.Header>
        <span className="d-flex flex-wrap align-items-center justify-content-between w-100 pe-2 gap-2">
          <span className="fw-semibold">{month.label}</span>
          <span className="small text-body-secondary">
            🏆 {winnerSummary} · {month.total} {month.total === 1 ? "star" : "stars"}
          </span>
        </span>
      </Accordion.Header>
      <Accordion.Body className="d-flex flex-column gap-3">
        <WinnerBanner winners={month.winners} period={month.label} />
        <Leaderboard tallies={month.tallies} />
        <SupporterBanner supporters={month.supporters} period={month.label} />
      </Accordion.Body>
    </Accordion.Item>
  );
}
