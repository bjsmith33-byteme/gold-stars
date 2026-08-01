import { useSearchParams, Link } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import { KnowledgeBase } from "../components/KnowledgeBase";
import { useBoard } from "./Layout";

export function KnowledgeBasePage() {
  const { events, agg, error } = useBoard();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  if (error) return <Alert variant="danger">⚠ {error}</Alert>;
  if (!agg) {
    return (
      <div className="text-body-secondary">
        <Spinner size="sm" animation="border" className="me-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <Link to="/" className="text-decoration-none">
        ← Back to the board
      </Link>
      <div>
        <h1 className="fw-bold mb-1">📚 Knowledge Base</h1>
        <p className="text-body-secondary mb-0">
          Questions &amp; solutions from the team — search or browse by area before
          re-asking.
        </p>
      </div>
      <KnowledgeBase events={events} initialQuery={initialQuery} />
    </div>
  );
}
