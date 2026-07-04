import { useMemo, useState } from "react";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Card from "react-bootstrap/Card";
import ListGroup from "react-bootstrap/ListGroup";
import { CATEGORIES } from "../lib/aggregate.js";

export const AREA_EMOJI = {
  React: "⚛️",
  JavaScript: "🟨",
  CSS: "🎨",
  SwiftUI: "📱",
};

const KNOWN = CATEGORIES;

/** Every star whose `note` is filled is a knowledge-base entry. Shared by the full
 *  KB page and the home-page preview so both agree on what counts as an entry. */
export function kbEntries(events) {
  return events.filter((e) => e.note.trim());
}

/** Browsable knowledge base: searchable, filterable by area, grouped area → sub-topic.
 *  The recipient is the person who solved it (your go-to expert). `initialQuery`
 *  pre-fills the search (e.g. arriving from the home-page preview's search box). */
export function KnowledgeBase({ events, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [area, setArea] = useState("All");

  const entries = useMemo(() => kbEntries(events), [events]);

  const areas = useMemo(() => {
    const present = new Set(entries.map((e) => e.category || "Uncategorized"));
    const known = KNOWN.filter((c) => present.has(c));
    const extra = [...present].filter((c) => !KNOWN.includes(c)).sort();
    return [...known, ...extra];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (area !== "All" && (e.category || "Uncategorized") !== area) return false;
      if (!q) return true;
      return [e.note, e.sub_topic, e.recipient, e.category].some((f) => f.toLowerCase().includes(q));
    });
  }, [entries, area, query]);

  const grouped = useMemo(() => {
    const byCat = new Map();
    for (const e of filtered) {
      const c = e.category || "Uncategorized";
      (byCat.get(c) ?? byCat.set(c, []).get(c)).push(e);
    }
    const order = [...areas, ...[...byCat.keys()].filter((c) => !areas.includes(c))];
    return order
      .filter((c) => byCat.has(c))
      .map((category) => {
        const byTopic = new Map();
        for (const e of byCat.get(category)) {
          const t = e.sub_topic.trim() || "General";
          (byTopic.get(t) ?? byTopic.set(t, []).get(t)).push(e);
        }
        const topics = [...byTopic.entries()]
          .map(([topic, items]) => ({
            topic,
            items: items.sort((a, b) => b.date.localeCompare(a.date)),
          }))
          .sort((a, b) =>
            a.topic === "General" ? 1 : b.topic === "General" ? -1 : a.topic.localeCompare(b.topic),
          );
        return { category, count: byCat.get(category).length, topics };
      });
  }, [filtered, areas]);

  if (entries.length === 0) {
    return (
      <p className="text-body-secondary fst-italic">
        No entries yet — add a <strong>problem &amp; solution</strong> summary to a star (via the
        Award form) and it shows up here.
      </p>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <Row className="g-2">
        <Col xs={12} sm>
          <Form.Control
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems, solutions, sub-topics, people…"
          />
        </Col>
        <Col xs={12} sm="auto">
          <Form.Select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="All">All areas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      {grouped.length === 0 ? (
        <p className="text-body-secondary fst-italic">No entries match your search.</p>
      ) : (
        grouped.map((cat) => (
          <Card key={cat.category}>
            <Card.Header className="fw-semibold">
              {AREA_EMOJI[cat.category] ?? "✨"} {cat.category}{" "}
              <span className="fw-normal small text-body-secondary">· {cat.count}</span>
            </Card.Header>
            <ListGroup variant="flush">
              {cat.topics.map((t) => (
                <ListGroup.Item key={t.topic}>
                  <div className="text-uppercase small fw-semibold text-body-secondary mb-1">
                    {t.topic}
                  </div>
                  {t.items.map((e, i) => (
                    <div key={i} className="mb-2">
                      <div>{e.note}</div>
                      <div className="small text-body-secondary">
                        — {e.recipient} · {e.date}
                      </div>
                    </div>
                  ))}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        ))
      )}
    </div>
  );
}
