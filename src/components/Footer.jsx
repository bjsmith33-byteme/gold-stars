// Constant contact footer shown on every page (rendered by Layout).
// PLACEHOLDERS: replace the email and links below with your own.
const CONTACT_EMAIL = "you@example.com";

const FEEDBACK_HREF =
  "mailto:" +
  CONTACT_EMAIL +
  "?subject=" +
  encodeURIComponent("Gold Stars — feedback") +
  "&body=" +
  encodeURIComponent(
    "What's working well:\n\n\nWhat's confusing or broken:\n\n\nAn idea to make it better:\n\n",
  );

export function Footer() {
  return (
    <footer className="border-top mt-5 py-4 text-center small text-body-secondary">
      <p className="mb-2">
        <a href={FEEDBACK_HREF} className="btn btn-sm btn-outline-secondary">
          💬 Send feedback
        </a>
      </p>
      <p className="mb-1">
        Questions or ideas? Contact{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p className="mb-0">
        Gold Stars — a team recognition board. Data is read live from{" "}
        <code>gold-stars.csv</code>.
      </p>
    </footer>
  );
}
