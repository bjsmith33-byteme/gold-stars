import Button from "react-bootstrap/Button";
import { FACET_LABELS } from "./AdvancedSearchPanel";
import type { FacetOption } from "../lib/search";

/** The sub-topic tag row under the Knowledge Base search box.
 *
 *  This OWNS the sub_topic facet state — the advanced panel deliberately has no Sub-topic
 *  dropdown, so there's exactly one control per piece of state and none of the "which one
 *  wins while the panel is open" awkwardness the Area quick-picker has to work around.
 *
 *  Chips read as INCLUSION ("show me these") while the state underneath is exclusion, the
 *  same inversion `pickArea` does on the page. Two rules keep that honest:
 *    - nothing excluded ≡ everything selected, so an unfiltered board highlights no chip
 *      rather than all of them;
 *    - releasing the last selected chip returns to "no filter" instead of "no results",
 *      because a row of chips with none lit is how you'd expect to say "show everything".
 *
 *  Counts come from `facetCounts`, which doesn't let this facet constrain itself — so a
 *  chip's number always answers "how many entries come back if I click this". Zero-count
 *  chips stay put (and stay clickable) so the row can't reflow under the cursor. */
export function SubTopicChips({
  options,
  counts,
  excluded,
  onChange,
}: {
  options: FacetOption[];
  counts: Map<string, number>;
  excluded: string[];
  onChange: (nextExcluded: string[]) => void;
}) {
  if (options.length === 0) return null;

  const values = options.map((o) => o.value);
  const selected = values.filter((v) => !excluded.includes(v));
  const filtered = selected.length !== values.length;
  const isOn = (value: string) => filtered && !excluded.includes(value);

  const toggle = (value: string) => {
    // From "no filter", the first click narrows to the one tag rather than removing it.
    if (!filtered) return onChange(values.filter((v) => v !== value));
    const next = isOn(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    if (next.length === 0 || next.length === values.length) return onChange([]);
    onChange(values.filter((v) => !next.includes(v)));
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-baseline gap-2 mb-1">
        <span className="small fw-semibold text-body-secondary">{FACET_LABELS.sub_topic}</span>
        {filtered && (
          <Button variant="link" size="sm" className="p-0 small" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </div>
      <div className="d-flex flex-wrap gap-2" role="group" aria-label="Filter by sub-topic">
        {options.map((o) => {
          const on = isOn(o.value);
          return (
            <Button
              key={o.value}
              size="sm"
              className="rounded-pill"
              variant={on ? "outline-secondary-selected" : "outline-secondary"}
              aria-pressed={on}
              onClick={() => toggle(o.value)}
            >
              {o.label} <span className="opacity-75">{counts.get(o.value) ?? 0}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
