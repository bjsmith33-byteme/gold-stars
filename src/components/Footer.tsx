import TEAM from "../config/team.config";

// Constant contact footer shown below the board.
const FEEDBACK_HREF =
  `mailto:${TEAM.contact.feedbackEmail}?subject=` +
  encodeURIComponent(`${TEAM.branding.appName} — feedback`) +
  "&body=" +
  encodeURIComponent(
    "What's working well:\n\n\nWhat's confusing or broken:\n\n\nAn idea to make it better:\n\n",
  );

export function Footer() {
  return (
    <footer className="app-footer border-top mt-5 py-4 text-center small">
      <p className="mb-2">
        <a href={FEEDBACK_HREF} className="btn btn-sm btn-warning">
          💬 Send feedback
        </a>
      </p>
      <p className="mb-0 text-body-secondary">
        Found a bug or have an idea? Let us know. Tallies are read live from{" "}
        <code>gold-stars.csv</code>; use <strong>Award a Star</strong> above to add one.
      </p>
    </footer>
  );
}
