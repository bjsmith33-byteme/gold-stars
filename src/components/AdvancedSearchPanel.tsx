import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { FacetDropdown } from "./FacetDropdown";
import {
  emptySearchState,
  FACET_KEYS,
  isDefaultState,
  type DateBounds,
  type FacetKey,
  type FacetOption,
  type SearchState,
} from "../lib/search";
import TEAM from "../config/team.config";

/** Human labels for the facets. These live here rather than in lib/search.ts because that
 *  module is deliberately config-free — and the role column's label is a team setting
 *  ("Role" here, "Specialty" in other boards). */
const FACET_LABELS: Record<FacetKey, string> = {
  recipient: "Recipient",
  role: TEAM.roles.label,
  category: "Area",
  sub_topic: "Sub-topic",
  awarded_by: "Awarder",
};

/** The advanced-search body: date range, corpus toggle, the five facets, and a live count
 *  of what the current criteria will return. Fully controlled — every change goes back up
 *  through `onChange` so the page can mirror it into the URL. */
export function AdvancedSearchPanel({
  state,
  onChange,
  bounds,
  options,
  counts,
  resultCount,
  totalCount,
}: {
  state: SearchState;
  onChange: (next: SearchState) => void;
  bounds: DateBounds;
  options: Record<FacetKey, FacetOption[]>;
  counts: Record<FacetKey, Map<string, number>>;
  resultCount: number;
  totalCount: number;
}) {
  const from = state.from || bounds.min;
  const to = state.to || bounds.max;

  return (
    <div className="d-flex flex-column gap-3 border rounded p-3">
      <div className="d-flex flex-wrap gap-2 align-items-center">
        {FACET_KEYS.map((key) => (
          <FacetDropdown
            key={key}
            id={key}
            label={FACET_LABELS[key]}
            options={options[key]}
            counts={counts[key]}
            excluded={state.excluded[key]}
            onChange={(next) =>
              onChange({ ...state, excluded: { ...state.excluded, [key]: next } })
            }
          />
        ))}
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center">
        <Form.Label htmlFor="kb-from" className="mb-0 small text-body-secondary">
          From
        </Form.Label>
        <Form.Control
          id="kb-from"
          type="date"
          size="sm"
          // <input type="date"> reads back as "YYYY-MM-DD", which is exactly the format the
          // CSV stores and the whole app compares lexicographically — no conversion needed.
          value={from}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => onChange({ ...state, from: e.target.value })}
          style={{ maxWidth: "10rem" }}
        />
        <Form.Label htmlFor="kb-to" className="mb-0 small text-body-secondary">
          To
        </Form.Label>
        <Form.Control
          id="kb-to"
          type="date"
          size="sm"
          value={to}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => onChange({ ...state, to: e.target.value })}
          style={{ maxWidth: "10rem" }}
        />
        {from > to && (
          <span className="small text-body-secondary fst-italic">
            The end date is before the start date.
          </span>
        )}
      </div>

      <Form.Check
        id="kb-include-no-note"
        checked={state.includeNoNote}
        onChange={(e) => onChange({ ...state, includeNoNote: e.target.checked })}
        label="Include stars without a write-up"
      />

      <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between">
        <span className="small text-body-secondary" aria-live="polite" aria-atomic="true">
          Showing {resultCount} of {totalCount} {totalCount === 1 ? "entry" : "entries"}
        </span>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => onChange(emptySearchState())}
          disabled={isDefaultState(state)}
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
