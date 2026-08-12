import { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Nav from "react-bootstrap/Nav";
import {
  CATEGORIES,
  isAlum,
  joinSubTopics,
  splitSubTopics,
  toCsvRow,
  type StarEvent,
} from "../lib/aggregate";
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
 *  separately), date is "now", and role is looked up, so none are exposed here.
 *  Sub-topics are held as a LIST here and joined into the CSV cell on the way out. */
type FormFields = Pick<StarEvent, "category" | "note" | "awarded_by"> & { subTopics: string[] };

/** Tag entry for sub-topics: a suggestion-backed text box that turns what you type into
 *  removable chips. Enter, a comma or a semicolon commits; so does leaving the field, which
 *  is what makes Tab work without hijacking it. Backspace on an empty box takes back the last
 *  tag. The FIRST tag is the entry's home in the knowledge base, so it's called out once
 *  there's more than one to order. */
function SubTopicTagInput({
  tags,
  suggestions,
  onChange,
}: {
  tags: string[];
  suggestions: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    setDraft("");
    // splitSubTopics does the sanitizing: trims, drops blanks, and divides a pasted
    // "Forms; Validation" into two tags rather than storing a delimiter inside one.
    const next = joinSubTopics([...tags, raw]);
    if (next !== joinSubTopics(tags)) onChange(splitSubTopics(next));
  };

  return (
    <>
      {tags.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {tags.map((tag, i) => (
            <Button
              key={tag}
              size="sm"
              variant="outline-secondary-selected"
              className="rounded-pill py-0"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Remove the ${tag} sub-topic`}
              title={
                i === 0 && tags.length > 1
                  ? `"${tag}" is where this lands in the knowledge base`
                  : `Remove "${tag}"`
              }
            >
              {tag}
              {i === 0 && tags.length > 1 && <span className="opacity-75"> · filed here</span>}
              <span aria-hidden="true" className="ms-1">
                ⨯
              </span>
            </Button>
          ))}
        </div>
      )}
      <Form.Control
        list="subtopic-suggestions"
        value={draft}
        placeholder={SUB_TOPIC_PLACEHOLDER}
        onChange={(e) => {
          // A comma is how people naturally separate tags, so accept it as a commit key. It
          // becomes the real delimiter rather than whitespace, so typing (or pasting)
          // "Forms, Validation" yields TWO tags instead of one called "Forms Validation".
          const v = e.target.value;
          if (/[,;]/.test(v)) commit(v.replace(/,/g, ";"));
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // don't submit the form
            commit(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
      />
      <datalist id="subtopic-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

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
    subTopics: [],
  });
  // Recipient: a roster name, "" (nothing picked), or OTHER (then customName is used).
  const [recipientSel, setRecipientSel] = useState("");
  const [customName, setCustomName] = useState("");
  const [copied, setCopied] = useState(false); // CSV row copied (log mode)
  const [msgCopied, setMsgCopied] = useState(false); // chat message copied
  const [stageError, setStageError] = useState("");

  // Alumni are filtered out — you can't nominate someone who's left. (They can still be
  // reached through OTHER if a star genuinely needs backdating for them.)
  const rosterNames = useMemo(
    () =>
      Object.keys(ROSTER)
        .filter((n) => !isAlum(n))
        .sort((a, b) => a.localeCompare(b)),
    [],
  );

  // (Re)initialize the form each time the modal opens — blank for a new star, or
  // pre-filled from initialRow when editing a staged entry.
  useEffect(() => {
    if (!show) return;
    const r = initialRow;
    setForm({
      category: r?.category ?? CATEGORIES[0],
      note: r?.note ?? "",
      awarded_by: r?.awarded_by ?? "",
      subTopics: splitSubTopics(r?.sub_topic ?? ""),
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
  const set = (k: "category" | "note" | "awarded_by", v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    clearCopied();
  };
  const setSubTopics = (subTopics: string[]) => {
    setForm((f) => ({ ...f, subTopics }));
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
    subTopics: form.subTopics,
  });

  // Date defaults to today (entry time) but is preserved when editing a staged row;
  // role is derived from the roster.
  const rowObject: Omit<DraftRow, "id"> = {
    date: initialRow?.date || todayIso(),
    recipient,
    // Alumni aren't in ROSTER, so this is blank for them — same as any off-roster name,
    // and it keeps a late-arriving star out of the monthly competition. Deliberately NOT
    // ALUM_ROLE: that isn't in roles.values, so validateDraftRow would reject the row.
    // The alumni board badges them by name anyway (see displayRole).
    role: roleFor(recipient),
    category: form.category,
    note: form.note,
    source: initialRow?.source || "Email",
    awarded_by: form.awarded_by.trim(),
    sub_topic: joinSubTopics(form.subTopics),
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

  // The write-up is what feeds the knowledge base, so both tabs ask for it the same way —
  // same label, same shape, same placeholder. Only the requirement differs: a CSV row without
  // a write-up is a dead knowledge-base entry, while blocking a quick chat shout-out on
  // paperwork is how you stop people saying thank you.
  const csvPreview = (
    <pre
      className="border rounded bg-body-tertiary px-3 py-2 mb-0"
      style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.75rem" }}
    >
      {row}
    </pre>
  );

  const noteRequired = !showChatComposer;
  const noteField = (
    <Form.Group>
      <Form.Label className="small fw-semibold">
        Problem &amp; solution{" "}
        {noteRequired ? "*" : <span className="fw-normal text-body-secondary">(optional)</span>}
      </Form.Label>
      <Form.Control
        as="textarea"
        rows={2}
        value={form.note}
        onChange={(e) => set("note", e.target.value)}
        placeholder="Briefly: what was the problem, and how was it solved?"
      />
      <Form.Text>
        A short summary feeds the knowledge base so the team can learn from it later.
        {!noteRequired && " It rides along in the message you post, so the tally can file it."}
      </Form.Text>
    </Form.Group>
  );

  return (
    <Modal show={show} onHide={onClose} centered scrollable size="lg">
      <Modal.Header closeButton>
        {/* "Award a Star" verbatim — the button that opens this, About, the README and the
            mailto body all say that, and a title that renames it mid-flow reads as a
            different feature. */}
        <Modal.Title>{editing ? "✎ Edit staged star" : "⭐ Award a Star"}</Modal.Title>
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

          {/* Sub-topics and the write-up are asked for identically on both tabs — the chat
              message carries them through to the CSV just as the emailed row does. */}
          <Form.Group>
            <Form.Label className="small fw-semibold">
              Sub-topics <span className="fw-normal text-body-secondary">(optional)</span>
            </Form.Label>
            <SubTopicTagInput
              tags={form.subTopics}
              suggestions={subTopics}
              onChange={setSubTopics}
            />
            <Form.Text>
              Finer labels within the area — pick existing ones or type new ones, as many as fit.
              {form.subTopics.length > 1 && " The first is where it's filed; the rest cross-reference it."}
            </Form.Text>
          </Form.Group>

          {noteField}

          {showChatComposer ? (
            /* ---- Chat composer ---- */
            <>
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

              {/* The CSV row lives in here rather than sitting open above the button: it's
                  plumbing, and nobody filling in the form needs to read it. Putting it beside
                  the copy-and-paste flow also settles which row it's showing — `source` is
                  "Manual" for a row you paste yourself and "Email" for the one the mail button
                  sends, so out here the preview didn't match either hand-off.
                  Hidden entirely when the team hasn't configured a csvEditUrl. */}
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
                    {csvPreview}
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

              {/* Stage mode has no GitLab hand-off to hang the preview off, but the row is
                  still worth being able to check before it joins the draft. */}
              {mode === "stage" && (
                <details>
                  <summary className="small text-body-secondary" style={{ cursor: "pointer" }}>
                    Advanced: see the CSV row this writes
                  </summary>
                  <div className="mt-2 ps-3 border-start">{csvPreview}</div>
                </details>
              )}
            </>
          )}
        </Form>
      </Modal.Body>
    </Modal>
  );
}
