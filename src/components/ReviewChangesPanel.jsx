import { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import ListGroup from "react-bootstrap/ListGroup";
import Alert from "react-bootstrap/Alert";
import { ADMIN_EMAIL, buildBatchBody } from "../lib/overlay.js";

/** Manage the local draft: list staged stars (edit/remove), submit the batch by email, or
 *  clear it. Presentational — draft + handlers come from Home (which owns the modal). */
export function ReviewChangesPanel({ draft, onEdit, onRemove, onClear }) {
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const body = draft.length ? buildBatchBody(draft) : "";
  const subject = `Gold Stars — ${draft.length} staged star${draft.length === 1 ? "" : "s"} to add`;
  const href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const tooLong = href.length > 1800;

  const copyRows = () => {
    try {
      navigator.clipboard
        .writeText(body)
        .then(() => setCopied(true))
        .catch(() => {});
    } catch {
      /* ignore */
    }
  };

  const clear = () => {
    if (window.confirm("Discard all staged changes? This can't be undone.")) {
      onClear();
      setSubmitted(false);
    }
  };

  return (
    <Card border="warning">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold">✎ Review changes ({draft.length})</span>
        {draft.length > 0 && (
          <Button variant="outline-danger" size="sm" onClick={clear}>
            Cancel / Clear
          </Button>
        )}
      </Card.Header>

      {draft.length === 0 ? (
        <Card.Body className="text-body-secondary">
          No staged stars yet — use <strong>Add a star to draft</strong> above to add one. Staged
          stars are a local draft only you can see, until an admin commits them.
        </Card.Body>
      ) : (
        <>
          <ListGroup variant="flush">
            {draft.map((r) => (
              <ListGroup.Item key={r.id} className="d-flex justify-content-between align-items-start gap-2">
                <div style={{ minWidth: 0 }}>
                  <div className="fw-medium">
                    {r.recipient}{" "}
                    <span className="text-body-secondary">
                      · {r.category}
                      {r.sub_topic ? ` · ${r.sub_topic}` : ""}
                    </span>
                  </div>
                  <div className="small text-body-secondary text-truncate">
                    {r.date}
                    {r.note ? ` — ${r.note}` : ""}
                  </div>
                </div>
                <div className="d-flex gap-1 flex-shrink-0">
                  <Button variant="outline-secondary" size="sm" onClick={() => onEdit(r)}>
                    Edit
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={() => onRemove(r.id)}>
                    Remove
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>

          <Card.Body className="d-flex flex-column gap-2">
            {tooLong && (
              <Alert variant="info" className="mb-0 small">
                This batch is large and may be truncated by your email client. Use{" "}
                <strong>Copy rows</strong> and paste them into the email, or copy from the box below.
              </Alert>
            )}
            <div className="d-flex flex-wrap gap-2">
              <Button variant="warning" href={href} onClick={() => setSubmitted(true)}>
                ✉ Submit changes (email admin)
              </Button>
              <Button variant="outline-secondary" onClick={copyRows}>
                {copied ? "✓ Copied" : "Copy rows"}
              </Button>
            </div>
            {submitted && (
              <Alert variant="success" className="mb-0 small">
                Email opened. Once the admin has committed your changes, click{" "}
                <strong>Cancel / Clear</strong> so they aren't counted twice on your device.
              </Alert>
            )}
            <details>
              <summary className="small text-body-secondary">Show rows (manual copy)</summary>
              <pre
                className="border rounded bg-body-tertiary p-2 mt-2 mb-0"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.75rem" }}
              >
                {body}
              </pre>
            </details>
          </Card.Body>
        </>
      )}
    </Card>
  );
}
