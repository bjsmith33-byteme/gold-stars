import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Card from "react-bootstrap/Card";
import ListGroup from "react-bootstrap/ListGroup";
import Button from "react-bootstrap/Button";
import { AREA_EMOJI } from "./KnowledgeBase.jsx";
import { SpecialtyBadge } from "./SpecialtyBadge.jsx";

/** One card per knowledge area, listing who's earned stars there (most first).
 *  Everyone tied for the top count in an area gets a 🥇 — the goal is to surface the
 *  growing experts per area, not crown a single winner. */
export function CategoryBreakdown({ categories, onSelectPerson }) {
  if (categories.length === 0) {
    return <p className="text-body-secondary fst-italic">No stars yet to break down by area.</p>;
  }

  return (
    <Row className="g-3">
      {categories.map((c) => {
        const top = c.tallies[0]?.stars ?? 0;
        return (
          <Col key={c.category} xs={12} sm={6}>
            <Card className="h-100">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span className="fw-semibold">
                  {AREA_EMOJI[c.category] ?? "✨"} {c.category}
                </span>
                <span className="small text-body-secondary text-nowrap">
                  {c.total} ⭐ · {c.tallies.length} {c.tallies.length === 1 ? "person" : "people"}
                </span>
              </Card.Header>
              <ListGroup variant="flush">
                {c.tallies.map((t) => (
                  <ListGroup.Item
                    key={t.name}
                    className="d-flex justify-content-between align-items-center gap-2"
                  >
                    <span className="d-flex align-items-center gap-2 min-w-0">
                      <span style={{ width: "1.25rem", textAlign: "center" }}>
                        {t.stars === top ? "🥇" : ""}
                      </span>
                      {onSelectPerson ? (
                        <Button
                          variant="link"
                          className="p-0 text-decoration-none fw-medium"
                          onClick={() => onSelectPerson(t.name)}
                          title={`See ${t.name}'s stats`}
                        >
                          {t.name}
                        </Button>
                      ) : (
                        <span className="fw-medium">{t.name}</span>
                      )}
                      <SpecialtyBadge role={t.role} />
                    </span>
                    <span className="fw-semibold text-nowrap">⭐ {t.stars}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
