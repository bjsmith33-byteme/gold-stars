import { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Nav from "react-bootstrap/Nav";
import { CATEGORIES, toCsvRow, type StarEvent } from "../lib/aggregate";
import { buildTeamsNomination, MONITORED_CHATS, teamsChatUrl, chatByKey } from "../lib/teams";
import type { DraftRow } from "../lib/overlay";
import { ROSTER, roleFor } from "../config/roster";
import { SUB_TOPIC_PLACEHOLDER, WHAT_EARNS_A_STAR } from "../config/copy";
import TEAM from "../config/team.config";

// Sentinel select value for "not on the roster — type a name".
const OTHER = "__other__";

const CSV_EDIT_URL = TEAM.contact.csvEditUrl;
const AWARD_EMAIL = TEAM.contact.adminEmail;
// The chat composer needs somewhere to post; both must be configured for the tab to show.
const CHAT_ENABLED = TEAM.features.chatComposer && MONITORED_CHATS.length > 0;

/** How the star is handed off:
 *  - "email" (default): compose a nomination and email it in, or shout out on chat.
 *  - "stage": add/edit a star in the local Preview draft. */
export type HandoffMode = "email" | "stage";

// Within "email" mode: shout out on chat (the auto-tally ingests it) vs. log a CSV row
// for a star that happened over email / in person.
type Tab = "teams" | "log";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** The free-text fields a user edits — recipient is a roster dropdown (handled
 *  separately), date is "now", and role is looked up, so none are exposed here. */
type FormFields = Pick<StarEvent, "category" | "note" | "awarded_by" | "sub_topic">;

export function AwardStarModal({
  show,
  onClose,
  subTopics = [],
  initialChat,
  mode = "email",
  initialRow = null,
  onStage,
}: {
  show: boolean;
  onClose: () => void;
  subTopics?: string[]; // existing sub-topics, for autocomplete
  initialChat?: string; // a MONITORED_CHATS key to preselect (from the ?chat= deep link)
  mode?: HandoffMode;
  initialRow?: DraftRow | null; // pre-fill when editing a staged entry
  onStage?: (row: Omit<DraftRow, "id">) => string | null;
}) {
  // Staging is the whole point in Preview mode, so the chat composer steps aside there.
  const tabsVisible = mode === "email" && CHAT_ENABLED;
  const [tab, setTab] = useState<Tab>(CHAT_ENABLED ? "teams" : "log");
  const [chatKey, setChatKey] = useState<string>(() => chatByKey(initialChat).key);
  const [form, setForm] = useState<FormFields>({
    category: CATEGORIES[0],
    note: "",
    awarded_by: "",
    sub_topic: "",
  });
  // Recipient: a roster name, "" (nothing picked), or OTHER (then customName is used).
  const [recipientSel, setRecipientSel] = useState("");
  const [customName, setCustomName] = useState("");
  const [copied, setCopied] = useState(false); // CSV row copied (log mode)
  const [msgCopied, setMsgCopied] = useState(false); // chat message copied
  const [stageError, setStageError] = useState("");

  const rosterNames = useMemo(() => Object.keys(ROSTER).sort((a, b) => a.localeCompare(b)), []);

  // (Re)initialize the form each time the modal opens — blank for a new star, or
  // pre-filled from initialRow when editing a staged entry.
  useEffect(() => {
    if (!show) return;
    const r = initialRow;
    setForm({
      category: r?.category ?? CATEGORIES[0],
      note: r?.note ?? "",
      awarded_by: r?.awarded_by ?? "",
      sub_topic: r?.sub_topic ?? "",
    });
    if (r?.recipient && rosterNames.includes(r.recipient)) {
      setRecipientSel(r.recipient);
      setCustomName("");
    } else if (r?.recipient) {
      setRecipientSel(OTHER);
      setCustomName(r.recipient);
    } else {
      setRecipientSel("");
      setCustomName("");
    }
    setStageError("");
    setCopied(false);
    setMsgCopied(false);
    if (mode === "stage") setTab("log");
  }, [show, initialRow, rosterNames, mode]);

  const recipient = (recipientSel === OTHER ? customName : recipientSel).trim();

  const clearCopied = () => {
    setCopied(false);
    setMsgCopied(false);
    setStageError("");
  };
  const set = (k: keyof FormFields, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    clearCopied();
  };

  // The chat composer only needs a recipient; the CSV/email/stage paths also need the
  // note (the problem+solution summary that feeds the knowledge base).
  const teamsValid = recipient !== "";
  const valid = recipient !== "" && form.note.trim() !== "";

  // The ready-to-paste chat kudos — built by the same lib the auto-tally parses, so what
  // we hand people always resolves back to this recipient + area.
  const teamsMessage = buildTeamsNomination({
    recipient,
    category: form.category,
    detail: form.note,
  });

  // Date defaults to today (entry time) but is preserved when editing a staged row;
  // role is derived from the roster.
  const rowObject: Omit<DraftRow, "id"> = {
    date: initialRow?.date || todayIso(),
    recipient,
    role: roleFor(recipient),
    category: form.category,
    note: form.note,
    source: initialRow?.source || "Email",
    awarded_by: form.awarded_by.trim(),
    sub_topic: form.sub_topic.trim(),
  };
  const row = toCsvRow({ ...rowObject, source: mode === "stage" ? rowObject.source : "Manual" });

  const copyTeamsMessage = () => {
    navigator.clipboard
      .writeText(teamsMessage)
      .then(() => setMsgCopied(true))
      .catch(() => {});
  };

  // Copy the row, then open the CSV editor in a new tab — so the row is on the clipboard
  // ready to paste when they land there. window.open is called synchronously (within the
  // click gesture) so it isn't popup-blocked; the copy fires alongside it.
  const copyRowAndOpenEditor = () => {
    navigator.clipboard
      .writeText(row)
      .then(() => setCopied(true))
      .catch(() => {});
    if (CSV_EDIT_URL) window.open(CSV_EDIT_URL, "_blank", "noopener,noreferrer");
  };

  const mailtoHref = () => {
    const emailRow = toCsvRow({ ...rowObject, source: "Email" });
    const subject = `Gold star for ${recipient}`;
    const body =
      `Please add this row to public/gold-stars.csv:\n\n${emailRow}\n\n` +
      `(Generated from the ${TEAM.branding.appName} "Award a Star" form.)`;
    return `mailto:${AWARD_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleStage = () => {
    const reason = onStage?.(rowObject);
    if (reason) setStageError(reason);
    else onClose();
  };

  const editing = mode === "stage" && !!initialRow;
  const showChatComposer = tabsVisible && tab === "teams";

  return (
    <Modal show={show} onHide={onClose} centered scrollable size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{editing ? "✎ Edit staged star" : "⭐ Award a Gold Star"}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="d-flex flex-column gap-3">
        {tabsVisible && (
          <Nav variant="tabs" activeKey={tab} onSelect={(k) => k && setTab(k as Tab)}>
            <Nav.Item>
              <Nav.Link eventKey="teams">💬 Shout out on Teams</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="log">✉ Log an email / in-person win</Nav.Link>
            </Nav.Item>
          </Nav>
        )}

        <Alert variant="secondary" className="mb-0">
          {mode === "stage" ? (
            <>
              <p className="fw-semibold mb-1">How recognition works</p>
              <p className="mb-0">
                Add this star to your <strong>local draft</strong>. It's visible only to you in
                Preview mode until you submit the batch from <strong>Review changes</strong> for an
                admin to commit.
              </p>
            </>
          ) : (
            WHAT_EARNS_A_STAR
          )}
        </Alert>

        <Form className="d-flex flex-column gap-3">
          <Form.Group>
            <Form.Label className="small fw-semibold">Recipient *</Form.Label>
            <Form.Select
              value={recipientSel}
              onChange={(e) => {
                setRecipientSel(e.target.value);
                clearCopied();
              }}
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
                onChange={(e) => {
                  setCustomName(e.target.value);
                  clearCopied();
                }}
                placeholder="Full name"
              />
            )}
          </Form.Group>

          <Form.Group>
            <Form.Label className="small fw-semibold">Area</Form.Label>
            <Form.Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {showChatComposer ? (
            /* ---- Chat composer ---- */
            <>
              <Form.Group>
                <Form.Label className="small fw-semibold">
                  What knowledge did they share?{" "}
                  <span className="fw-normal text-body-secondary">(optional)</span>
                </Form.Label>
                <Form.Control
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                  placeholder="Brief recap of context to add to KB"
                />
              </Form.Group>

              <div>
                <div className="small fw-semibold mb-1">Message to post</div>
                <pre
                  className="border rounded bg-body-tertiary px-3 py-2 mb-0"
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word" }}
                >
                  {teamsMessage}
                </pre>
              </div>

              <Form.Group>
                <Form.Label className="small fw-semibold">Post in</Form.Label>
                <Form.Select value={chatKey} onChange={(e) => setChatKey(e.target.value)}>
                  {MONITORED_CHATS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <p className="small text-body-secondary mb-0">
                Copy the message, open the chat, and paste. Then retype{" "}
                <strong>@{recipient ? recipient.split(" ")[0] : "name"}</strong> so they get a real
                @mention ping (a paste can't carry one). It gets tallied automatically.
              </p>

              <div className="d-flex flex-wrap gap-2">
                <Button variant="warning" onClick={copyTeamsMessage} disabled={!teamsValid}>
                  {msgCopied ? "✓ Copied — paste in Teams" : "Copy message"}
                </Button>
                <Button
                  variant="outline-secondary"
                  href={teamsChatUrl(chatByKey(chatKey).id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 Open chat ↗
                </Button>
              </div>
              {!teamsValid && (
                <div className="small text-danger">Choose a recipient to enable this.</div>
              )}
            </>
          ) : (
            /* ---- Log a win / stage to draft (both write a CSV row) ---- */
            <>
              <Form.Group>
                <Form.Label className="small fw-semibold">
                  Sub-topic <span className="fw-normal text-body-secondary">(optional)</span>
                </Form.Label>
                <Form.Control
                  list="subtopic-suggestions"
                  value={form.sub_topic}
                  onChange={(e) => set("sub_topic", e.target.value)}
                  placeholder={SUB_TOPIC_PLACEHOLDER}
                />
                <datalist id="subtopic-suggestions">
                  {subTopics.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <Form.Text>
                  A finer label within the area — pick an existing one or type a new one.
                </Form.Text>
              </Form.Group>

              <Form.Group>
                <Form.Label className="small fw-semibold">Problem &amp; solution *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                  placeholder="Briefly: what was the problem, and how was it solved?"
                />
                <Form.Text>
                  A short summary feeds the knowledge base so the team can learn from it later.
                </Form.Text>
              </Form.Group>

              <Form.Group>
                <Form.Label className="small fw-semibold">
                  Awarded by{" "}
                  <span className="fw-normal text-body-secondary">
                    (optional, not shown on the board)
                  </span>
                </Form.Label>
                <Form.Control
                  value={form.awarded_by}
                  onChange={(e) => set("awarded_by", e.target.value)}
                  placeholder="Your name"
                />
              </Form.Group>

              <div>
                <div className="small fw-semibold text-body-secondary mb-1">CSV row preview</div>
                <pre
                  className="border rounded bg-body-tertiary px-3 py-2 mb-0"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.75rem" }}
                >
                  {row}
                </pre>
              </div>

              {mode === "stage" ? (
                <>
                  <Button variant="warning" onClick={handleStage} disabled={!valid}>
                    {editing ? "Save changes" : "Add to draft"}
                  </Button>
                  {stageError && <div className="small text-danger">{stageError}</div>}
                </>
              ) : (
                <>
                  <p className="small text-body-secondary mb-0">
                    Email the star to be added — it lands after a quick human check, which keeps{" "}
                    <code>gold-stars.csv</code> clean.
                  </p>
                  <div>
                    <Button
                      variant="warning"
                      href={valid ? mailtoHref() : undefined}
                      disabled={!valid}
                    >
                      ✉ Email this star to be added
                    </Button>
                  </div>
                </>
              )}

              {!valid && (
                <div className="small text-danger">
                  Choose a recipient and add a problem &amp; solution summary to enable this.
                </div>
              )}

              {/* Hidden entirely when the team hasn't configured a csvEditUrl, and in stage
                  mode (where the draft is the hand-off). */}
              {CSV_EDIT_URL && mode !== "stage" && (
                <details>
                  <summary className="small text-body-secondary" style={{ cursor: "pointer" }}>
                    Advanced: add it to the CSV yourself
                  </summary>
                  <div className="mt-2 ps-3 border-start d-flex flex-column gap-2">
                    <p className="small text-body-secondary mb-0">
                      The button copies the row and opens <code>gold-stars.csv</code> in GitLab —
                      then <strong>paste it as a new line at the end and commit</strong>. Paste only
                      this exact row, so a stray comma or pasted formula can't slip into the data.
                    </p>
                    <div>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={copyRowAndOpenEditor}
                        disabled={!valid}
                      >
                        {copied
                          ? "✓ Row copied — paste in GitLab & commit"
                          : "Copy row & open CSV in GitLab ↗"}
                      </Button>
                    </div>
                  </div>
                </details>
              )}
            </>
          )}
        </Form>
      </Modal.Body>
    </Modal>
  );
}
