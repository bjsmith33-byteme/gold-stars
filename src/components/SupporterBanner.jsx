import Card from "react-bootstrap/Card";

function joinNames(names) {
  if (names.length <= 1) return names[0] ?? "";
  return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
}

/** Secondary recognition (below the winner/leaderboard): the month's top kudos-giver.
 *  Renders nothing if no one awarded a star that month. A cream card matching the theme. */
export function SupporterBanner({ supporters, period }) {
  if (supporters.length === 0) return null;

  const isTie = supporters.length > 1;
  const given = supporters[0].given;

  return (
    <Card body className="d-flex flex-row align-items-center gap-3">
      <span style={{ fontSize: "1.5rem" }} aria-hidden="true">
        🙌
      </span>
      <div>
        <div className="text-uppercase small fw-semibold text-body-secondary">
          {isTie ? "Supporters" : "Supporter"} of the Month · {period}
        </div>
        <div className="fw-bold">
          {joinNames(supporters.map((s) => s.name))}
          <span className="fw-normal text-body-secondary"> — {given} kudos given</span>
        </div>
      </div>
    </Card>
  );
}
