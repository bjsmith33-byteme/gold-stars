import { useNavigate, Link } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import { Leaderboard } from "../components/Leaderboard";
import { useBoard, FRIENDS_ENABLED, HAS_ALUMNI } from "./Layout";
import TEAM from "../config/team.config";

/** The two boards that sit OFF the main leaderboard: helpers from outside the team, and
 *  former members. The home board is for who's currently competing.
 *
 *  Both sections are config-gated, and this template ships with both switched off
 *  (`features.friendsOfThePod: false`, `roles.alumni: []`), so App doesn't even register
 *  the route. See SETUP.md. */
export function FriendsPage() {
  const { agg, error } = useBoard();
  const navigate = useNavigate();

  // Names stay clickable. My Stats lives on the board, so hand off via ?person= rather
  // than duplicating it here.
  const showPerson = (name: string) => navigate(`/?person=${encodeURIComponent(name)}`);

  if (error) return <Alert variant="danger">⚠ {error}</Alert>;
  if (!agg) {
    return (
      <div className="text-body-secondary">
        <Spinner size="sm" animation="border" className="me-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-4">
      <Link to="/" className="text-decoration-none">
        ← Back to the board
      </Link>
      <div>
        <h1 className="fw-bold mb-1">🤝 Friends{HAS_ALUMNI && " & Alumni"}</h1>
        <p className="text-body-secondary mb-0">
          Everyone who's earned a star from outside the main leaderboard — people who jumped
          in to help{HAS_ALUMNI && ", and members who've since moved on"}.
        </p>
      </div>

      {FRIENDS_ENABLED && (
        <section className="d-flex flex-column gap-2">
          <h2 className="h4 fw-bold mb-0">
            🤝 {TEAM.roles.friendsLabel ?? "Friends of the Team"}
          </h2>
          <p className="text-body-secondary small mb-1">
            Folks outside the {TEAM.branding.tagline} who jumped in to help — recognized here,
            separate from the main leaderboard.
          </p>
          {agg.friendsAllTime.length > 0 ? (
            <div className="border rounded overflow-hidden pop-surface">
              <Leaderboard tallies={agg.friendsAllTime} onSelectPerson={showPerson} />
            </div>
          ) : (
            <p className="text-body-secondary fst-italic mb-0">
              No {TEAM.roles.friendsLabel ?? "friends"} have earned a star yet.
            </p>
          )}
        </section>
      )}

      {HAS_ALUMNI && (
        <section className="d-flex flex-column gap-2">
          <h2 className="h4 fw-bold mb-0">🎓 {TEAM.roles.alumniLabel ?? "Alumni"}</h2>
          <p className="text-body-secondary small mb-1">
            Former members of the {TEAM.branding.tagline}. Their stars still count toward the
            month they were earned — they're just no longer in the running.
          </p>
          {agg.alumniAllTime.length > 0 ? (
            <div className="border rounded overflow-hidden pop-surface">
              <Leaderboard tallies={agg.alumniAllTime} onSelectPerson={showPerson} />
            </div>
          ) : (
            <p className="text-body-secondary fst-italic mb-0">
              No {TEAM.roles.alumniLabel ?? "alumni"} have earned a star yet.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
