import Card from "react-bootstrap/Card";
import { CATEGORIES } from "../lib/aggregate";
import { MONITORED_CHATS } from "../lib/teams";
import TEAM from "../config/team.config";

/** Joins area names into readable prose: "A, B, C, and D". */
function areaList(): string {
  if (CATEGORIES.length <= 1) return CATEGORIES[0] ?? "";
  if (CATEGORIES.length === 2) return `${CATEGORIES[0]} and ${CATEGORIES[1]}`;
  return `${CATEGORIES.slice(0, -1).join(", ")}, and ${CATEGORIES[CATEGORIES.length - 1]}`;
}

export function About() {
  const chatEnabled = TEAM.features.chatComposer && MONITORED_CHATS.length > 0;

  return (
    <div className="d-flex flex-column gap-3" style={{ maxWidth: "44rem" }}>
      <div>
        <h1 className="fw-bold mb-1">About {TEAM.branding.appName}</h1>
        <p className="text-body-secondary mb-0">A lightweight team recognition board.</p>
      </div>

      <Card body>
        <h2 className="h5">What it does</h2>
        <p className="mb-2">
          {TEAM.branding.appName} celebrates the people who help teammates learn — by
          troubleshooting an issue, making a recommendation, or explaining how or why
          something works. Each star also captures a short{" "}
          <strong>problem &amp; solution</strong> note, which builds a searchable{" "}
          <strong>Knowledge Base</strong> the whole team can learn from.
        </p>
        <p className="mb-0">
          The board highlights an all-time leaderboard, monthly winners, a{" "}
          <strong>Supporter of the Month</strong> (whoever gives the most kudos), and per-area
          expertise across {areaList()}.
        </p>
      </Card>

      <Card body>
        <h2 className="h5">How to nominate someone</h2>
        <p className={chatEnabled ? "mb-2" : "mb-0"}>
          Use <strong>Award a Star</strong> on the home page.
          {chatEnabled
            ? " It composes a kudos message you paste into the team chat — the auto-tally picks it up and adds the row for you."
            : " Since this site is static, the form composes the nomination and hands it off by email — a quick human review keeps the data clean before it appears on the board."}
        </p>
        {chatEnabled && (
          <p className="mb-0">
            For a star that happened over <strong>email</strong> or <strong>in person</strong>, the
            second tab logs it directly instead.
          </p>
        )}
      </Card>

      {TEAM.features.previewMode && (
        <Card body>
          <h2 className="h5">Preview mode</h2>
          <p className="mb-0">
            The <strong>✎ Preview</strong> toggle in the navbar lets you stage stars locally and see
            how the board would look with them included. Staged stars live only in your browser
            until you submit the batch from <strong>Review changes</strong> and an admin commits
            them — nobody else sees them in the meantime.
          </p>
        </Card>
      )}

      <Card body>
        <h2 className="h5">How the data works</h2>
        <p className="mb-0">
          Everything is read live from a single hand-editable file,{" "}
          <code>public/gold-stars.csv</code> — one row per star. Totals are never stored; they're
          computed in the browser at render time, so adding a star is always just appending a row.
          It's a static site built with Vite + React + React-Bootstrap.
        </p>
      </Card>

      <Card body>
        <h2 className="h5">Adopting this for your team</h2>
        <p className="mb-0">
          Everything team-specific lives in <code>src/config/</code> — the roster, knowledge areas,
          roles, emails, branding, and which features are switched on. Copy{" "}
          <code>team.config.example.ts</code> over <code>team.config.ts</code> and edit it; the rest
          of the app reads from there.
        </p>
      </Card>

      <Card body>
        <h2 className="h5">Contact</h2>
        <p className="mb-0">
          Questions, ideas, or want your own team's board? Reach out at{" "}
          <a href={`mailto:${TEAM.contact.feedbackEmail}`}>{TEAM.contact.feedbackEmail}</a>.
        </p>
      </Card>
    </div>
  );
}
