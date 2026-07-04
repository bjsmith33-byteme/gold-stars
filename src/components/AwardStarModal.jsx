import { useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { CATEGORIES, toCsvRow } from "../lib/aggregate.js";
import { ROSTER, roleFor } from "../lib/roster.js";

// Sentinel select value for "not on the roster — type a name".
const OTHER = "__other__";

// PLACEHOLDER: the address nominations are emailed to. Replace with your own.
const AWARD_EMAIL = "you@example.com";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Award a Star" form. Since the site is static and public, the form only *composes*
 *  a nomination and hands it off by email — a human reviews it before it lands in the
 *  CSV. No direct data access, no chat integration. */
export function AwardStarModal({ show, onClose, subTopics = [] }) {
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    note: "",
    awarded_by: "",
    sub_topic: "",
  });
  const [recipientSel, setRecipientSel] = useState("");
  const [customName, setCustomName] = useState("");

  const rosterNames = useMemo(() => Object.keys(ROSTER).sort((a, b) => a.localeCompare(b)), []);
  const recipient = (recipientSel === OTHER ? customName : recipientSel).trim();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Note is required: it's the problem+solution summary that feeds the knowledge base.
  const valid = recipient !== "" && form.note.trim() !== "";

  const row = toCsvRow({
    date: todayIso(),
    recipient,
    role: roleFor(recipient),
    category: form.category,
    note: form.note,
    source: "Email",
    awarded_by: form.awarded_by.trim(),
    sub_topic: form.sub_topic.trim(),
  });

  const mailtoHref = () => {
    const subject = `Gold star for ${recipient}`;
    const body =
      `Please add this row to public/gold-stars.csv:\n\n${row}\n\n` +
      `(Generated from the Gold Stars "Award a Star" form.)`;
    return `mailto:${AWARD_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Modal show={show} onHide={onClose} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>⭐ Award a Gold Star</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        <Alert variant="secondary" className="mb-0">
          <p className="fw-semibold mb-1">How recognition works</p>
          <p className="mb-0">
            Gold stars celebrate helping a teammate <strong>troubleshoot an issue</strong>, make a{" "}
            <strong>recommendation</strong>, or explain <strong>how or why something works</strong> —
            sharing knowledge to lift up the team. Fill in the star below and email it in; a quick
            human check keeps the data clean before it appears on the board.
          </p>
        </Alert>

        <Form className="d-flex flex-column gap-3">
          <Form.Group>
            <Form.Label className="small fw-semibold">Recipient *</Form.Label>
            <Form.Select
              value={recipientSel}
              onChange={(e) => setRecipientSel(e.target.value)}
              autoFocus
            >
              <option value="" disabled>
                Select a person…
              </option>
              {rosterNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={OTHER}>Other…</option>
            </Form.Select>
            {recipientSel === OTHER && (
              <Form.Control
                className="mt-2"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Full name"
              />
            )}
          </Form.Group>

          <Form.Group>
            <Form.Label className="small fw-semibold">Category</Form.Label>
            <Form.Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group>
            <Form.Label className="small fw-semibold">
              Sub-topic <span className="fw-normal text-body-secondary">(optional)</span>
            </Form.Label>
            <Form.Control
              list="subtopic-suggestions"
              value={form.sub_topic}
              onChange={(e) => set("sub_topic", e.target.value)}
              placeholder="e.g. hooks, flexbox, async"
            />
            <datalist id="subtopic-suggestions">
              {subTopics.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Form.Text>A finer label within the area — pick an existing one or type a new one.</Form.Text>
          </Form.Group>

          <Form.Group>
            <Form.Label className="small fw-semibold">Problem &amp; solution *</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Briefly: what was the question, and what was the answer?"
            />
            <Form.Text>A short summary feeds the knowledge base so the team can learn from it later.</Form.Text>
          </Form.Group>

          <Form.Group>
            <Form.Label className="small fw-semibold">
              Awarded by{" "}
              <span className="fw-normal text-body-secondary">(optional, not shown on the board)</span>
            </Form.Label>
            <Form.Control
              value={form.awarded_by}
              onChange={(e) => set("awarded_by", e.target.value)}
              placeholder="Your name"
            />
          </Form.Group>
        </Form>

        <div>
          <div className="small fw-semibold text-body-secondary mb-1">CSV row preview</div>
          <pre className="border rounded bg-body-tertiary px-3 py-2 mb-0" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.75rem" }}>
            {row}
          </pre>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex-column align-items-stretch">
        <Button
          variant="warning"
          href={valid ? mailtoHref() : undefined}
          disabled={!valid}
          className="w-100"
        >
          ✉ Email this star to be added
        </Button>
        {!valid && (
          <div className="small text-danger">
            Choose a recipient and add a problem &amp; solution summary to enable this.
          </div>
        )}
      </Modal.Footer>
    </Modal>
  );
}
