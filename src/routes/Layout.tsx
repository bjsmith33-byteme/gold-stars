import { useEffect, useMemo, useState } from "react";
import { Outlet, Link, NavLink, useLocation, useOutletContext } from "react-router-dom";
import Navbar from "react-bootstrap/Navbar";
import Nav from "react-bootstrap/Nav";
import Offcanvas from "react-bootstrap/Offcanvas";
import Container from "react-bootstrap/Container";
import { aggregate, parseCsv, type Aggregated, type StarEvent } from "../lib/aggregate";
import {
  loadOverlay,
  saveOverlay,
  loadPreviewMode,
  savePreviewMode,
  validateDraftRow,
  type DraftRow,
} from "../lib/overlay";
import { ThemeToggle } from "../components/ThemeToggle";
import { PreviewToggle } from "../components/PreviewToggle";
import { DraftBanner } from "../components/DraftBanner";
import { Footer } from "../components/Footer";
import TEAM from "../config/team.config";

/** Everything Layout shares with the routed pages via Outlet context. */
export interface BoardContext {
  events: StarEvent[];
  agg: Aggregated | null;
  error: string | null;
  previewMode: boolean;
  setPreviewMode: (on: boolean) => void;
  draft: DraftRow[];
  /** null on success, or a reason string to show inline. */
  addDraft: (row: unknown) => string | null;
  updateDraft: (id: string, patch: Partial<DraftRow>) => string | null;
  removeDraft: (id: string) => void;
  clearDraft: () => void;
}

/** Typed accessor for the Outlet context — saves every page casting it. */
export function useBoard(): BoardContext {
  return useOutletContext<BoardContext>();
}

const PREVIEW_ENABLED = TEAM.features.previewMode;

/** App shell: an offcanvas ("sheet") side-nav, theme + preview toggles, the routed page,
 *  and a constant footer. Owns the single CSV fetch AND the local "draft" overlay, merging
 *  them (only while Preview mode is on) before aggregating, and shares everything via
 *  Outlet context so pages don't re-fetch or re-merge. */
export function Layout() {
  const [csvEvents, setCsvEvents] = useState<StarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<DraftRow[]>(() => (PREVIEW_ENABLED ? loadOverlay().rows : []));
  const [previewMode, setPreviewModeState] = useState(
    () => PREVIEW_ENABLED && loadPreviewMode(),
  );
  const location = useLocation();

  useEffect(() => {
    // Cache-bust so a successful deploy / freshly-committed star shows immediately —
    // GitLab Pages + the browser will otherwise serve a stale CSV until a hard refresh.
    fetch(`${import.meta.env.BASE_URL}gold-stars.csv?t=${Date.now()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load gold-stars.csv (${r.status})`);
        return r.text();
      })
      .then((text) => {
        setCsvEvents(parseCsv(text));
        setLoaded(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Scroll to top on route change.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  // Merge the local draft on top of the published CSV ONLY while previewing; otherwise the
  // board is published-only (the draft stays in localStorage, just hidden). aggregate()
  // sorts by date, so staged rows land in the right month automatically.
  const events = useMemo(
    () => (previewMode ? [...csvEvents, ...draft] : csvEvents),
    [csvEvents, draft, previewMode],
  );
  const agg = useMemo(() => (loaded ? aggregate(events) : null), [loaded, events]);

  const setPreviewMode = (next: boolean) => {
    setPreviewModeState(next);
    savePreviewMode(next);
  };

  // Mutators persist immediately. addDraft/updateDraft return null on success or a reason
  // string on validation failure (the Award modal surfaces it inline).
  const addDraft = (rowObject: unknown): string | null => {
    const res = validateDraftRow(rowObject);
    if (!res.ok) return res.reason;
    const next = [...draft, res.row];
    setDraft(next);
    saveOverlay(next);
    return null;
  };

  const updateDraft = (id: string, patch: Partial<DraftRow>): string | null => {
    const current = draft.find((r) => r.id === id);
    if (!current) return "That staged entry no longer exists.";
    const res = validateDraftRow({ ...current, ...patch, id });
    if (!res.ok) return res.reason;
    const next = draft.map((r) => (r.id === id ? res.row : r));
    setDraft(next);
    saveOverlay(next);
    return null;
  };

  const removeDraft = (id: string) => {
    const next = draft.filter((r) => r.id !== id);
    setDraft(next);
    saveOverlay(next);
  };

  const clearDraft = () => {
    setDraft([]);
    saveOverlay([]);
  };

  const closeNav = () => setExpanded(false);

  const context: BoardContext = {
    events,
    agg,
    error,
    previewMode,
    setPreviewMode,
    draft,
    addDraft,
    updateDraft,
    removeDraft,
    clearDraft,
  };

  return (
    <>
      <Navbar
        expand={false}
        expanded={expanded}
        onToggle={setExpanded}
        bg="body-tertiary"
        className="border-bottom"
        sticky="top"
      >
        <Container>
          <Navbar.Brand as={Link} to="/" className="fw-bold">
            ⭐ {TEAM.branding.appName}
          </Navbar.Brand>
          <div className="d-flex align-items-center gap-2">
            {PREVIEW_ENABLED && location.pathname !== "/about" && (
              <PreviewToggle on={previewMode} onChange={setPreviewMode} count={draft.length} />
            )}
            <ThemeToggle />
            <Navbar.Toggle aria-controls="main-nav" />
          </div>
          <Navbar.Offcanvas id="main-nav" aria-labelledby="main-nav-title" placement="end">
            <Offcanvas.Header closeButton>
              <Offcanvas.Title id="main-nav-title">Menu</Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body>
              <Nav className="flex-column">
                <Nav.Link as={NavLink} to="/" end onClick={closeNav}>
                  Home
                </Nav.Link>
                {TEAM.features.knowledgeBase && (
                  <Nav.Link as={NavLink} to="/kb" onClick={closeNav}>
                    Knowledge Base
                  </Nav.Link>
                )}
                <Nav.Link as={NavLink} to="/about" onClick={closeNav}>
                  About
                </Nav.Link>
              </Nav>
            </Offcanvas.Body>
          </Navbar.Offcanvas>
        </Container>
      </Navbar>

      {previewMode && <DraftBanner count={draft.length} />}

      <Container className="py-4" style={{ maxWidth: "56rem" }}>
        <Outlet context={context} />
      </Container>

      <Footer />
    </>
  );
}
