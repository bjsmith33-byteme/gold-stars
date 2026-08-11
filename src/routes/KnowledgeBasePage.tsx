import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Collapse from "react-bootstrap/Collapse";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Spinner from "react-bootstrap/Spinner";
import { KnowledgeBase, kbEntries } from "../components/KnowledgeBase";
import { AdvancedSearchPanel } from "../components/AdvancedSearchPanel";
import { CATEGORIES } from "../lib/aggregate";
import {
  activeFilterCount,
  applySearch,
  corpusFor,
  dateBounds,
  decodeSearch,
  encodeSearch,
  facetCounts,
  facetOptions,
  FACET_KEYS,
  isDefaultState,
  todayYmd,
  type FacetKey,
  type FacetOption,
  type SearchState,
} from "../lib/search";
import { useBoard } from "./Layout";

// Sentinels for the quick area picker. Deliberately not "" — that's a real value (the
// blank/Uncategorized area).
const ALL_AREAS = "__all__";
const MULTI_AREAS = "__multi__";

export function KnowledgeBasePage() {
  const { events, agg, error } = useBoard();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<SearchState>(() => decodeSearch(searchParams));
  // Open on arrival when the link carries filters, so a shared URL shows WHY it's filtered.
  const [open, setOpen] = useState(() => !isDefaultState(decodeSearch(searchParams)));

  const today = todayYmd();
  const allEntries = useMemo(() => kbEntries(events), [events]);
  const corpus = useMemo(
    () => corpusFor(events, state.includeNoNote),
    [events, state.includeNoNote],
  );
  const bounds = useMemo(() => dateBounds(corpus, today), [corpus, today]);
  const filtered = useMemo(() => applySearch(events, state, bounds), [events, state, bounds]);
  const counts = useMemo(() => facetCounts(events, state, bounds), [events, state, bounds]);
  const options = useMemo(() => {
    const built = {} as Record<FacetKey, FacetOption[]>;
    for (const key of FACET_KEYS) {
      // Only the area facet has a meaningful configured order; the rest are emergent.
      built[key] = facetOptions(corpus, key, key === "category" ? CATEGORIES : undefined);
    }
    return built;
  }, [corpus]);

  // ── URL binding ────────────────────────────────────────────────────────────
  // Both directions compare the state as OUR codec would write it. Because encoding is
  // canonical, that string comparison is self-echo-guarding — no write-tracking ref, and
  // no ping-pong between the two effects.
  const encoded = encodeSearch(state).toString();
  const urlEncoded = encodeSearch(decodeSearch(searchParams)).toString();

  // local → URL. Debounced: without it, typing in the search box hits the browser's
  // replaceState rate limit. `replace` because a filter tweak isn't a navigation — pushing
  // would turn Back into "undo one keystroke" and trap the user on the page.
  useEffect(() => {
    if (urlEncoded === encoded) return;
    const t = setTimeout(() => {
      setSearchParams((prev) => encodeSearch(state, prev), { replace: true });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `encoded` stands in for `state`
  }, [encoded, urlEncoded, setSearchParams]);

  // URL → local, for Back/Forward and inbound links. Keyed on the URL alone so it can't
  // clobber what the user is typing while the write above is still debouncing.
  useEffect(() => {
    setState((prev) => (encodeSearch(prev).toString() === urlEncoded ? prev : decodeSearch(searchParams)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL is the only trigger
  }, [urlEncoded]);

  // ── Quick area picker: same state as the Area facet, one source of truth ───
  const areaOptions = options.category;
  const keptAreas = areaOptions.filter((o) => !state.excluded.category.includes(o.value));
  const areaValue =
    keptAreas.length === areaOptions.length
      ? ALL_AREAS
      : keptAreas.length === 1
        ? keptAreas[0].value
        : MULTI_AREAS;

  const pickArea = (value: string) => {
    if (value === MULTI_AREAS) return; // display-only; the facet owns that state
    const excluded =
      value === ALL_AREAS ? [] : areaOptions.map((o) => o.value).filter((v) => v !== value);
    setState({ ...state, excluded: { ...state.excluded, category: excluded } });
  };

  if (error) return <Alert variant="danger">⚠ {error}</Alert>;
  if (!agg) {
    return (
      <div className="text-body-secondary">
        <Spinner size="sm" animation="border" className="me-2" />
        Loading…
      </div>
    );
  }

  const activeCount = activeFilterCount(state);

  return (
    <div className="d-flex flex-column gap-3">
      <Link to="/" className="text-decoration-none">
        ← Back to the board
      </Link>
      <div>
        <h1 className="fw-bold mb-1">📚 Knowledge Base</h1>
        <p className="text-body-secondary mb-0">
          Questions &amp; solutions from the team — search or browse by area before re-asking.
        </p>
      </div>

      {allEntries.length === 0 ? (
        <p className="text-body-secondary fst-italic">
          No entries yet — add a <strong>problem &amp; solution</strong> summary to a star (via the
          Award form, or by filling in a Teams star's note) and it shows up here.
        </p>
      ) : (
        <>
          <InputGroup>
            <Form.Control
              value={state.q}
              onChange={(e) => setState({ ...state, q: e.target.value })}
              placeholder="Search problems, solutions, sub-topics, people…"
              aria-label="Search the knowledge base"
            />
            <Form.Select
              value={areaValue}
              onChange={(e) => pickArea(e.target.value)}
              // Only one area control is live at a time: the multi-select facet takes over
              // while the panel is open, since a single-select can't express "2 of 4".
              disabled={open}
              title={open ? "Use the Area filter in advanced search" : undefined}
              style={{ maxWidth: "12rem" }}
              aria-label="Filter by area"
            >
              <option value={ALL_AREAS}>All areas</option>
              {areaOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              {/* A single-select can't express "2 of 4" (or "none") — when the facet is in
                  such a state this read-only entry stands in for it. */}
              {areaValue === MULTI_AREAS && (
                <option value={MULTI_AREAS}>
                  {keptAreas.length === 0 ? "No areas" : "Multiple areas"}
                </option>
              )}
            </Form.Select>
          </InputGroup>

          <div>
            <Button
              size="sm"
              variant={activeCount > 0 ? "outline-secondary-selected" : "outline-secondary"}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="kb-advanced-search"
            >
              Advanced search {activeCount > 0 && `(${activeCount})`} {open ? "▴" : "▾"}
            </Button>
          </div>

          <Collapse in={open}>
            <div id="kb-advanced-search">
              <AdvancedSearchPanel
                state={state}
                onChange={setState}
                bounds={bounds}
                options={options}
                counts={counts}
                resultCount={filtered.length}
                totalCount={corpus.length}
              />
            </div>
          </Collapse>

          <KnowledgeBase entries={filtered} areaOrder={CATEGORIES} />
        </>
      )}
    </div>
  );
}
