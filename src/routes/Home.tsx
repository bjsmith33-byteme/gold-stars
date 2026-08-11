import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Accordion from "react-bootstrap/Accordion";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import { currentMonthKey, monthLabel, getMonth } from "../lib/aggregate";
import { uniqueSorted } from "../lib/search";
import type { DraftRow } from "../lib/overlay";
import { Leaderboard } from "../components/Leaderboard";
import { WinnerBanner } from "../components/WinnerBanner";
import { SupporterBanner } from "../components/SupporterBanner";
import { MonthSection } from "../components/MonthSection";
import { CategoryBreakdown } from "../components/CategoryBreakdown";
import { UserStats } from "../components/UserStats";
import { KnowledgeBasePreview } from "../components/KnowledgeBasePreview";
import { AwardStarModal } from "../components/AwardStarModal";
import { ReviewChangesPanel } from "../components/ReviewChangesPanel";
import StarChartPosterboard from "../components/StarChartPosterboard";
import { useBoard, FRIENDS_PAGE_ENABLED, HAS_ALUMNI } from "./Layout";
import { HOW_TO_EARN } from "../config/copy";
import TEAM from "../config/team.config";

export function Home() {
  const { events, agg, error, previewMode, draft, addDraft, updateDraft, removeDraft, clearDraft } =
    useBoard();

  // Deep link: "#/?award=1&chat=qm" opens the composer with a chat preselected. This is the
  // entry point from a pinned Teams tab / pinned link, so it must keep working. Before the
  // router landed this was parsed by a hand-rolled parseRoute() in App.tsx; useSearchParams
  // reads the same query string out of the hash.
  const [searchParams] = useSearchParams();
  const awardParam = searchParams.has("award");
  const chatParam = searchParams.get("chat") ?? undefined;
  // "#/?person=Aisha+Okafor" preselects My Stats and scrolls to it — how the Friends page
  // hands a name back to the board, since My Stats only lives here.
  const personParam = searchParams.get("person") ?? "";

  const [showAward, setShowAward] = useState(awardParam);
  const [awardChat, setAwardChat] = useState<string | undefined>(chatParam);
  const [person, setPerson] = useState(personParam);
  const [editRow, setEditRow] = useState<DraftRow | null>(null);

  // Re-open when the query changes (Back/Forward, or following another ?award= link while
  // already on the board).
  useEffect(() => {
    if (awardParam) {
      setAwardChat(chatParam);
      setEditRow(null);
      setShowAward(true);
    }
  }, [awardParam, chatParam]);

  const jumpToPerson = (name: string) => {
    setPerson(name);
    document.getElementById("my-stats")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Arriving from /friends with ?person=. Deferred one tick because Layout's scroll-to-top
  // effect is a PARENT effect, so it runs after this one on mount and would otherwise undo
  // the scroll.
  useEffect(() => {
    if (!personParam) return;
    setPerson(personParam);
    const t = setTimeout(
      () =>
        document
          .getElementById("my-stats")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
    return () => clearTimeout(t);
  }, [personParam]);

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
  const subTopics = uniqueSorted(events.map((e) => e.sub_topic).filter(Boolean));

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
            <div>
              <h1 className="fw-bold mb-1">⭐ {TEAM.branding.appName}</h1>
              <p className="text-body-secondary fw-medium mb-0">{TEAM.branding.tagline}</p>
              {TEAM.branding.subtitle && (
                <p className="text-body-secondary small mb-0">{TEAM.branding.subtitle}</p>
              )}
            </div>
            <Accordion>
              <Accordion.Item eventKey="how">
                <Accordion.Header>How to earn a gold star ⭐</Accordion.Header>
                <Accordion.Body className="text-start">{HOW_TO_EARN}</Accordion.Body>
              </Accordion.Item>
            </Accordion>
            <div>
              <Button
                variant="warning"
                size="lg"
                className="fw-bold"
                onClick={() => {
                  setEditRow(null);
                  setAwardChat(undefined); // the button opens with the default chat
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
      <section
        id="my-stats"
        className="d-flex flex-column gap-2"
        style={{ scrollMarginTop: "5rem" }}
      >
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
        <p className="text-body-secondary small mb-1">
          Growing our experts across each area — all-time.
        </p>
        <CategoryBreakdown categories={agg.byCategory} onSelectPerson={jumpToPerson} />
      </section>

      {/* Knowledge Base preview */}
      {TEAM.features.knowledgeBase && (
        <section className="d-flex flex-column gap-2">
          <h2 className="h4 fw-bold mb-0">📚 Knowledge Base</h2>
          <p className="text-body-secondary small mb-1">
            Recent questions &amp; solutions — search or browse the full base before re-asking.
          </p>
          <Card body>
            <KnowledgeBasePreview events={events} />
          </Card>
        </section>
      )}

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

      {/* The Friends and Alumni boards used to sit here. They live on /friends now — this
          page is for who's currently competing. Absent entirely in this template, since
          both switches are off by default. */}
      {FRIENDS_PAGE_ENABLED && (
        <p className="text-body-secondary small mb-0">
          Looking for someone off the leaderboard? See{" "}
          <Link to="/friends">
            {TEAM.roles.friendsLabel ?? "Friends"}
            {HAS_ALUMNI && ` & ${TEAM.roles.alumniLabel ?? "alumni"}`}
          </Link>
          .
        </p>
      )}

      <AwardStarModal
        key={awardChat ?? "default"} // remount so a new ?chat= preselect takes effect
        show={showAward}
        onClose={() => {
          setShowAward(false);
          setEditRow(null);
        }}
        subTopics={subTopics}
        initialChat={awardChat}
        mode={previewMode ? "stage" : "email"}
        initialRow={editRow}
        onStage={editRow ? (r) => updateDraft(editRow.id, r) : addDraft}
      />
    </div>
  );
}
