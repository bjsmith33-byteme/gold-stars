import { useMemo, useState } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import { AREA_EMOJI, CATEGORIES, type StarEvent } from "../lib/aggregate";

// Re-exported because KnowledgeBasePreview has always imported it from here.
export { AREA_EMOJI };

const KNOWN: readonly string[] = CATEGORIES;

/** Every star whose `note` is filled is a knowledge-base entry. Shared by the full
 *  KB page and the home-page preview so both agree on what counts as an entry. */
export function kbEntries(events: StarEvent[]): StarEvent[] {
  return events.filter((e) => e.note.trim());
}

/** Browsable knowledge base built from the CSV: every star whose `note` is filled is
 *  an entry. Searchable, filterable by area, grouped area → sub-topic. The recipient
 *  is the person who solved it (your go-to expert). `initialQuery` pre-fills the search
 *  (e.g. when arriving from the home-page preview's search box). */
export function KnowledgeBase({
  events,
  initialQuery = "",
}: {
  events: StarEvent[];
  initialQuery?: string;
}) {
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
    const byCat = new Map<string, StarEvent[]>();
    for (const e of filtered) {
      const c = e.category || "Uncategorized";
      (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(e);
    }
    const order = [...areas, ...[...byCat.keys()].filter((c) => !areas.includes(c))];
    return order
      .filter((c) => byCat.has(c))
      .map((category) => {
        const byTopic = new Map<string, StarEvent[]>();
        for (const e of byCat.get(category)!) {
          const t = e.sub_topic.trim() || "General";
          (byTopic.get(t) ?? byTopic.set(t, []).get(t)!).push(e);
        }
        const topics = [...byTopic.entries()]
          .map(([topic, items]) => ({
            topic,
            items: items.sort((a, b) => b.date.localeCompare(a.date)),
          }))
          // "General" (untagged) sinks to the bottom; the rest alphabetical.
          .sort((a, b) =>
            a.topic === "General" ? 1 : b.topic === "General" ? -1 : a.topic.localeCompare(b.topic),
          );
        return { category, count: byCat.get(category)!.length, topics };
      });
  }, [filtered, areas]);

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
      <InputGroup>
        <Form.Control
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search problems, solutions, sub-topics, people…"
          aria-label="Search the knowledge base"
        />
        <Form.Select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={{ maxWidth: "12rem" }}
          aria-label="Filter by area"
        >
          <option value="All">All areas</option>
          {areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Form.Select>
      </InputGroup>

      {grouped.length === 0 ? (
        <p className="text-body-secondary fst-italic mb-0">No entries match your search.</p>
      ) : (
        grouped.map((cat) => (
          <Card key={cat.category}>
            <Card.Header className="fw-semibold">
              {AREA_EMOJI[cat.category] ?? "✨"} {cat.category}{" "}
              <span className="fw-normal small text-body-secondary">· {cat.count}</span>
            </Card.Header>
            <Card.Body className="d-flex flex-column gap-3">
              {cat.topics.map((t) => (
                <div key={t.topic}>
                  <div className="small fw-semibold text-uppercase text-body-secondary mb-1">
                    {t.topic}
                  </div>
                  <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                    {t.items.map((e, i) => (
                      <li key={i}>
                        <div>{e.note}</div>
                        <div className="small text-body-secondary">
                          — {e.recipient} · {e.date}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );
}
