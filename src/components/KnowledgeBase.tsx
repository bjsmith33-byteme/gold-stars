import { useMemo } from "react";
import Card from "react-bootstrap/Card";
import { AREA_EMOJI, primarySubTopic, subTopicsOf, type StarEvent } from "../lib/aggregate";
import { BLANK_LABEL, corpusFor, orderedByKnown } from "../lib/search";

// Re-exported because KnowledgeBasePreview has always imported it from here.
export { AREA_EMOJI };

/** Every star whose `note` is filled is a knowledge-base entry. Shared by the full KB page
 *  and the home-page preview so both agree on what counts as an entry. The logic now lives
 *  in lib/search.ts (as `corpusFor`, which can also widen past this); this stays as the
 *  name the preview already imports. */
export function kbEntries(events: StarEvent[]): StarEvent[] {
  return corpusFor(events, false);
}

/** The browsable knowledge base, grouped area → sub-topic with the newest entry first. The
 *  recipient is the person who solved it (your go-to expert).
 *
 *  An entry can carry several sub-topic tags, but it's filed under its FIRST one only, so it
 *  appears exactly once in the tree and each area's count still adds up. The remaining tags
 *  ride along on the entry as muted cross-references — that's how browsing (rather than
 *  searching) surfaces the fact that a "Read-only" entry is also a "configuration" one.
 *
 *  Presentational: the page owns the search state and hands down the already-filtered
 *  `entries` plus the area ordering to group by. */
export function KnowledgeBase({
  entries,
  areaOrder,
}: {
  entries: StarEvent[];
  areaOrder: string[];
}) {
  const grouped = useMemo(() => {
    const byCat = new Map<string, StarEvent[]>();
    for (const e of entries) {
      const c = e.category || BLANK_LABEL.category;
      (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(e);
    }
    const order = orderedByKnown(byCat.keys(), areaOrder);
    return order
      .filter((c) => byCat.has(c))
      .map((category) => {
        const byTopic = new Map<string, StarEvent[]>();
        for (const e of byCat.get(category)!) {
          const t = primarySubTopic(e) || BLANK_LABEL.sub_topic;
          (byTopic.get(t) ?? byTopic.set(t, []).get(t)!).push(e);
        }
        const topics = [...byTopic.entries()]
          .map(([topic, items]) => ({
            topic,
            items: items.sort((a, b) => b.date.localeCompare(a.date)),
          }))
          // The untagged bucket sinks to the bottom; the rest alphabetical.
          .sort((a, b) =>
            a.topic === BLANK_LABEL.sub_topic
              ? 1
              : b.topic === BLANK_LABEL.sub_topic
                ? -1
                : a.topic.localeCompare(b.topic),
          );
        return { category, count: byCat.get(category)!.length, topics };
      });
  }, [entries, areaOrder]);

  if (grouped.length === 0) {
    return <p className="text-body-secondary fst-italic mb-0">No entries match your search.</p>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {grouped.map((cat) => (
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
                      {/* Only reachable with "include stars without a write-up" on. */}
                      <div>
                        {e.note || (
                          <em className="text-body-secondary">(no write-up yet)</em>
                        )}
                      </div>
                      <div className="small text-body-secondary">
                        — {e.recipient} · {e.date}
                        {/* Cross-references: the tags this entry ISN'T filed under here. */}
                        {subTopicsOf(e)
                          .slice(1)
                          .map((tag) => (
                            <span key={tag} className="ms-2 badge text-body-secondary border">
                              {tag}
                            </span>
                          ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}
