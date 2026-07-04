import Alert from "react-bootstrap/Alert";

function joinNames(names) {
  if (names.length <= 1) return names[0] ?? "";
  return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
}

export function WinnerBanner({ winners, period }) {
  if (winners.length === 0) {
    return (
      <Alert variant="secondary" className="py-2 mb-0">
        No stars yet for {period} — the race is wide open.
      </Alert>
    );
  }

  const isTie = winners.length > 1;
  const stars = winners[0].stars;

  return (
    <Alert variant="warning" className="d-flex align-items-center gap-3 mb-0">
      <span style={{ fontSize: "1.75rem" }} aria-hidden="true">
        🏆
      </span>
      <div>
        <div className="text-uppercase small fw-bold">
          {isTie ? "Co-winners" : "Winner"} · {period}
        </div>
        <div className="fs-5 fw-bold">
          {joinNames(winners.map((w) => w.name))}
          <span className="fw-semibold"> — {stars} ⭐</span>
        </div>
      </div>
    </Alert>
  );
}
