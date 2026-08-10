import { useMemo, useState, type FormEvent } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import ListGroup from "react-bootstrap/ListGroup";
import type { StarEvent } from "../lib/aggregate";
import { AREA_EMOJI, kbEntries } from "./KnowledgeBase";

const RECENT_COUNT = 4;

/** Home-page teaser for the Knowledge Base: the few most-recent entries plus a search
 *  box and a "Browse all" link — both navigate to the dedicated KB page (#/kb), the
 *  search carrying its query so the full page opens pre-filtered.
 *  (Migration step 4 swaps the raw hash writes for React Router's useNavigate.) */
export function KnowledgeBasePreview({ events }: { events: StarEvent[] }) {
  const [query, setQuery] = useState("");

  const entries = useMemo(
    () => kbEntries(events).sort((a, b) => b.date.localeCompare(a.date)),
    [events],
  );
  const recent = entries.slice(0, RECENT_COUNT);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    window.location.hash = q ? `/kb?q=${encodeURIComponent(q)}` : "/kb";
  };

  if (entries.length === 0) {
    return (
      <p className="text-body-secondary fst-italic">
        No entries yet — add a <strong>problem &amp; solution</strong> summary to a star (via the
        Award form, or by filling in a Teams star's note) and it shows up here.
      </p>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <Form onSubmit={search}>
        <InputGroup>
          <Form.Control
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the knowledge base…"
            aria-label="Search the knowledge base"
          />
          <Button type="submit" variant="outline-secondary">
            Search
          </Button>
        </InputGroup>
      </Form>

      <ListGroup>
        {recent.map((e, i) => (
          <ListGroup.Item key={i}>
            <div>{e.note}</div>
            <div className="small text-body-secondary">
              {AREA_EMOJI[e.category] ?? "✨"} {e.category || "Uncategorized"}
              {e.sub_topic.trim() ? ` · ${e.sub_topic.trim()}` : ""} — {e.recipient} · {e.date}
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>

      <div className="text-end">
        <a href="#/kb">Browse all {entries.length} entries →</a>
      </div>
    </div>
  );
}
