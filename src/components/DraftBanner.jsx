import Alert from "react-bootstrap/Alert";

/** Unmistakable "you're viewing a local draft" banner, shown across all pages while
 *  Preview mode is on. localStorage is per-browser, so these changes are visible only
 *  to this viewer until an admin commits them. */
export function DraftBanner({ count }) {
  return (
    <Alert variant="warning" className="mb-0 rounded-0 border-0 border-bottom text-center py-2">
      ✎ <strong>Preview mode — local draft, not published.</strong> Only you can see these
      changes. {count} staged {count === 1 ? "star" : "stars"} — review &amp; submit them on the
      Home page.
    </Alert>
  );
}
