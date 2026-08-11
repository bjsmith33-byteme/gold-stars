import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import type { FacetOption } from "../lib/search";

/** One checkbox facet: a compact toggle whose label summarizes the selection, opening a
 *  scrollable list of every value present in the data with its result count.
 *
 *  Purely presentational — it knows nothing about StarEvent, and takes the EXCLUDED values
 *  rather than the selected ones so it mirrors SearchState exactly (see the note on
 *  SearchState in lib/search.ts for why that inversion is the right way round). */
export function FacetDropdown({
  id,
  label,
  options,
  counts,
  excluded,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  options: FacetOption[];
  counts: Map<string, number>;
  excluded: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const selected = options.filter((o) => !excluded.includes(o.value)).length;
  const filtered = selected < options.length;
  const summary = filtered ? `${selected} of ${options.length}` : "All";

  const toggle = (value: string) =>
    onChange(
      excluded.includes(value) ? excluded.filter((v) => v !== value) : [...excluded, value],
    );

  return (
    <Dropdown autoClose="outside">
      <Dropdown.Toggle
        size="sm"
        // The custom "…-selected" variant is the board's established idiom for an active
        // toggle (see UserStats' period buttons) and is already tuned for both themes.
        variant={filtered ? "outline-secondary-selected" : "outline-secondary"}
        id={`facet-toggle-${id}`}
        disabled={disabled || options.length === 0}
        aria-label={`Filter by ${label.toLowerCase()}, ${summary} selected`}
      >
        {label}: {summary}
      </Dropdown.Toggle>

      <Dropdown.Menu style={{ minWidth: "15rem" }}>
        <div className="d-flex gap-2 px-3 pb-2">
          <Button size="sm" variant="outline-secondary" onClick={() => onChange([])}>
            Select all
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => onChange(options.map((o) => o.value))}
          >
            Clear
          </Button>
        </div>
        <Dropdown.Divider />
        {/* Real checkboxes in plain divs rather than Dropdown.Items — those are anchors
            that close the menu and swallow the activation. */}
        <div
          role="group"
          aria-label={label}
          style={{ maxHeight: "16rem", overflowY: "auto" }}
        >
          {options.map((o, i) => (
            <div key={o.value} className="facet-option px-3 py-1">
              <Form.Check
                id={`facet-${id}-${i}`} // by index: values contain spaces and punctuation
                checked={!excluded.includes(o.value)}
                onChange={() => toggle(o.value)}
                label={
                  <>
                    <span>{o.label}</span>
                    {/* Zero-count options stay visible and muted: hiding them would make
                        the list reflow under the cursor, and disabling them would trap
                        anyone trying to UNcheck one. */}
                    <span className="text-body-secondary small">{counts.get(o.value) ?? 0}</span>
                  </>
                }
              />
            </div>
          ))}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
}
