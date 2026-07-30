import Card from "react-bootstrap/Card";

const CONTACT_EMAIL = "bjsmith33@wisc.edu";

export function About() {
  return (
    <div className="d-flex flex-column gap-3" style={{ maxWidth: "44rem" }}>
      <h1 className="fw-bold mb-0">About Gold Stars</h1>
      <p className="text-body-secondary mb-0">
        A lightweight team recognition board.
      </p>

      <Card body>
        <h2 className="h5">What it does</h2>
        <p className="mb-2">
          Gold Stars celebrates the people who help teammates learn — by troubleshooting an issue,
          making a recommendation, or explaining how or why something works. Each star also captures
          a short <strong>problem &amp; solution</strong> note, which builds a searchable{" "}
          <strong>Knowledge Base</strong> the whole team can learn from.
        </p>
        <p className="mb-0">
          The board highlights an all-time leaderboard, monthly winners, a{" "}
          <strong>Supporter of the Month</strong> (whoever gives the most kudos), and per-area
          expertise across <strong>React</strong>, <strong>JavaScript</strong>, <strong>CSS</strong>,
          and <strong>SwiftUI</strong>.
        </p>
      </Card>

      <Card body>
        <h2 className="h5">How to nominate someone</h2>
        <p className="mb-0">
          Use <strong>Award a Star</strong> on the home page. Since this site is static, the form
          composes the nomination and hands it off by <strong>email</strong> — a quick human review
          keeps the data clean before it appears on the board.
        </p>
      </Card>

      <Card body>
        <h2 className="h5">How the data works</h2>
        <p className="mb-0">
          Everything is read live from a single hand-editable file, <code>public/gold-stars.csv</code>
          — one row per star. It's a static site built with Vite + React + React-Bootstrap and
          published on GitHub Pages.
        </p>
      </Card>

      <Card body>
        <h2 className="h5">Contact</h2>
        <p className="mb-0">
          Questions, ideas, or want your own team's board? Reach out at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Card>
    </div>
  );
}
