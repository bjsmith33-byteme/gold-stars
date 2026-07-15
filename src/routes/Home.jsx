import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import Accordion from "react-bootstrap/Accordion";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import { currentMonthKey, monthLabel, getMonth } from "../lib/aggregate.js";
import { Leaderboard } from "../components/Leaderboard.jsx";
import { WinnerBanner } from "../components/WinnerBanner.jsx";
import { SupporterBanner } from "../components/SupporterBanner.jsx";
import { MonthSection } from "../components/MonthSection.jsx";
import { CategoryBreakdown } from "../components/CategoryBreakdown.jsx";
import { UserStats } from "../components/UserStats.jsx";
import { KnowledgeBasePreview } from "../components/KnowledgeBasePreview.jsx";
import { AwardStarModal } from "../components/AwardStarModal.jsx";
import { ReviewChangesPanel } from "../components/ReviewChangesPanel.jsx";
import StarChartPosterboard from "../components/StarChartPosterboard.jsx";

export function Home() {
  const { events, agg, error, previewMode, draft, addDraft, updateDraft, removeDraft, clearDraft } =
    useOutletContext();
  const [showAward, setShowAward] = useState(false);
  const [person, setPerson] = useState("");
  const [editRow, setEditRow] = useState(null);

  const jumpToPerson = (name) => {
    setPerson(name);
    document.getElementById("my-stats")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error) return <Alert variant="danger">⚠ {error}</Alert>;
  if (!agg) {
    return (
      <div className="text-body-secondary">
        <Spinner size="sm" animation="border" className="me-2" />
        Loading gold stars…
      </div>
    );
  }

  const curKey = currentMonthKey();
  const curLabel = monthLabel(curKey);
  const curMonth = getMonth(agg, curKey);
  const pastMonths = agg.months.filter((m) => m.key !== curKey);
  const subTopics = [...new Set(events.map((e) => e.sub_topic).filter(Boolean))].sort();

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <header>
        <Row className="align-items-center g-3 g-md-4">
          <Col xs={12} md={6}>
            <StarChartPosterboard
              className="poster-panel"
              style={{
                padding: "0.5rem",
                borderRadius: "0.5rem",
                boxShadow: "0 1px 6px rgba(0, 0, 0, 0.15)",
              }}
            />
          </Col>
          <Col xs={12} md={6} className="d-flex flex-column gap-3 text-center text-md-start">
        <h1 className="fw-bold mb-0">⭐ Gold Stars</h1>
        <p className="text-body-secondary mb-0">The more you know...</p>
        <Accordion>
          <Accordion.Item eventKey="how">
            <Accordion.Header>How to earn a gold star ⭐</Accordion.Header>
            <Accordion.Body className="text-start">
              <p>
                Help a teammate <strong>troubleshoot an issue</strong>, make a{" "}
                <strong>recommendation</strong>, or answer a question about{" "}
                <strong>how or why something works</strong> — demonstrating deep knowledge and
                sharing it to lift up the whole team. It counts across{" "}
                <strong>React</strong>, <strong>JavaScript</strong>, <strong>CSS</strong>, and{" "}
                <strong>SwiftUI</strong>.
              </p>
              <p className="mb-0">
                Answering your <em>own</em> question counts too, as long as you did the research to
                get there. And good <strong>questions</strong> are welcome — they grow the shared
                knowledge base for everyone.
              </p>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
        <div>
          <Button
            variant="warning"
            size="lg"
            className="fw-bold"
            onClick={() => {
              setEditRow(null);
              setShowAward(true);
            }}
          >
            <span
              aria-hidden="true"
              style={{
                textShadow:
                  "-1px -1px 0 #5c4600, 1px -1px 0 #5c4600, -1px 1px 0 #5c4600, 1px 1px 0 #5c4600",
              }}
            >
              ⭐
            </span>{" "}
            {previewMode ? "Add a star to draft" : "Award a Star"}
          </Button>
        </div>
          </Col>
        </Row>
      </header>

      {/* Review changes (Preview mode only) */}
      {previewMode && (
        <ReviewChangesPanel
          draft={draft}
          onEdit={(r) => {
            setEditRow(r);
            setShowAward(true);
          }}
          onRemove={removeDraft}
          onClear={clearDraft}
        />
      )}

      {/* My Stats */}
      <section id="my-stats" className="d-flex flex-column gap-2" style={{ scrollMarginTop: "5rem" }}>
        <h2 className="h4 fw-bold mb-0">📈 My Stats</h2>
        <p className="text-body-secondary small mb-1">
          Pick yourself to see your stars and how your expertise is growing.
        </p>
        <UserStats events={events} selected={person} onSelect={setPerson} />
      </section>

      {/* All-Time Leaderboard */}
      <section className="d-flex flex-column gap-2">
        <h2 className="h4 fw-bold mb-0">🌟 All-Time Leaderboard</h2>
        <div className="border rounded overflow-hidden pop-surface">
          <Leaderboard tallies={agg.allTime} onSelectPerson={jumpToPerson} cap />
        </div>
      </section>

      {/* By Knowledge Area */}
      <section className="d-flex flex-column gap-2">
        <h2 className="h4 fw-bold mb-0">🧭 By Knowledge Area</h2>
        <p className="text-body-secondary small mb-1">These are our experts in each area. Answer more questions to rise on the board.</p>
        <CategoryBreakdown categories={agg.byCategory} onSelectPerson={jumpToPerson} />
      </section>

      {/* Knowledge Base preview */}
      <section className="d-flex flex-column gap-2">
        <h2 className="h4 fw-bold mb-0">📚 Knowledge Base</h2>
        <p className="text-body-secondary small mb-1">
          Recent questions &amp; solutions — search or browse before re-asking.
        </p>
        <Card body>
          <KnowledgeBasePreview events={events} />
        </Card>
      </section>

      {/* This Month — same card layout as the past-month cards below. */}
      <section className="d-flex flex-column gap-2">
        <h2 className="h4 fw-bold mb-0">📅 This Month · {curLabel}</h2>
        <Card>
          <Card.Body className="d-flex flex-column gap-3">
            <WinnerBanner winners={curMonth?.winners ?? []} period={curLabel} />
            <Leaderboard tallies={curMonth?.tallies ?? []} onSelectPerson={jumpToPerson} />
            <SupporterBanner supporters={curMonth?.supporters ?? []} period={curLabel} />
          </Card.Body>
        </Card>
      </section>

      {/* Past Months */}
      <section className="d-flex flex-column gap-2">
        <h2 className="h4 fw-bold mb-0">🗂 Past Months</h2>
        {pastMonths.length === 0 ? (
          <p className="text-body-secondary fst-italic mb-0">No past months yet.</p>
        ) : (
          <Accordion alwaysOpen>
            {pastMonths.map((m) => (
              <MonthSection key={m.key} month={m} />
            ))}
          </Accordion>
        )}
      </section>

      <AwardStarModal
        show={showAward}
        onClose={() => {
          setShowAward(false);
          setEditRow(null);
        }}
        subTopics={subTopics}
        mode={previewMode ? "stage" : "email"}
        initialRow={editRow}
        onStage={editRow ? (r) => updateDraft(editRow.id, r) : addDraft}
      />
    </div>
  );
}
