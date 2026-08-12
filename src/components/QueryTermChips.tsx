import Button from "react-bootstrap/Button";
import type { CompiledQuery } from "../lib/search";

/** The typed keyword box, shown back as chips.
 *
 *  The box hides three things a first-time searcher can't guess, and each one is a real
 *  usability-test complaint:
 *    - terms are AND-ed, so every word you add narrows further. With chips you can see which
 *      word is killing the result count, and drop it with one click.
 *    - function words are ignored. Saying so beats leaving people to wonder whether "how"
 *      was taken literally.
 *    - synonyms expand to a tag ("ro → Read-only"), so a hit that contains none of the typed
 *      letters reads as intended rather than as a bug.
 *
 *  Driven by the SAME CompiledQuery the predicate ran, so it can't drift from the results. */
export function QueryTermChips({
  query,
  onRemoveTerm,
}: {
  query: CompiledQuery;
  onRemoveTerm: (text: string) => void;
}) {
  if (query.terms.length === 0 && query.ignored.length === 0) return null;

  return (
    <div className="d-flex flex-column gap-1">
      {query.terms.length > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="small text-body-secondary">Searching for</span>
          {query.terms.map((t) => (
            <Button
              key={t.text}
              size="sm"
              variant="outline-secondary-selected"
              className="rounded-pill py-0"
              onClick={() => onRemoveTerm(t.text)}
              // The button removes the term, so that's what the label has to say — a chip
              // reading "read-only" would otherwise announce as "read-only, button".
              aria-label={`Remove ${t.text} from the search`}
              title={
                t.canonical
                  ? `"${t.text}" also matches entries tagged ${t.canonical}`
                  : `Remove "${t.text}"`
              }
            >
              {t.text}
              {t.canonical && t.canonical.toLowerCase() !== t.text && (
                <span className="opacity-75"> → {t.canonical}</span>
              )}
              <span aria-hidden="true" className="ms-1">
                ⨯
              </span>
            </Button>
          ))}
          {query.terms.length > 1 && (
            <span className="small text-body-secondary fst-italic">
              — entries must match all of these
            </span>
          )}
        </div>
      )}
      {query.ignored.length > 0 && (
        <div className="small text-body-secondary">Ignored common words: {query.ignored.join(", ")}</div>
      )}
    </div>
  );
}
