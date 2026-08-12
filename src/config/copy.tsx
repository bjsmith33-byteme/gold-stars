// Team-specific PROSE. Split out from team.config.ts because this file contains JSX,
// and team.config.ts is imported by Node-run tooling (which strips types but cannot
// compile JSX).
//
// Edit these to describe what earns a star on YOUR team.
import type { ReactNode } from "react";

/** The expanded "How to earn a gold star" explainer on the home page. */
export const HOW_TO_EARN: ReactNode = (
  <>
    <p>
      Help a teammate <strong>troubleshoot an issue</strong>, make a{" "}
      <strong>recommendation</strong>, or answer a question about{" "}
      <strong>how or why something works</strong> — demonstrating deep knowledge and sharing it
      to lift up the whole team. It counts across <strong>React</strong>,{" "}
      <strong>JavaScript</strong>, <strong>CSS</strong>, and <strong>SwiftUI</strong>.
    </p>
    <p className="mb-0">
      Answering your <em>own</em> question counts too, as long as you did the research to get
      there. And good <strong>questions</strong> are welcome — they grow the shared knowledge
      base for everyone.
    </p>
  </>
);

/** Placeholder for the Award form's "Sub-topic" tag entry — ONE example of the finer labels
 *  your team uses within an area. Deliberately singular and comma-free: the field takes
 *  several tags now, and a comma here would read as "type them like this". */
export const SUB_TOPIC_PLACEHOLDER = "e.g. hooks";

/** The "How search works" explainer on the Knowledge Base page. Describes the search's real
 *  behavior, so keep it in step with `compileQuery`/`matchesSearch` in src/lib/search.ts — and
 *  with the `search.synonyms` you configure, since the second paragraph promises they exist. */
export const KEYWORD_SEARCH_HELP: ReactNode = (
  <>
    <p>
      The box matches <strong>every</strong> word you type, so each word you add narrows the
      results. The chips underneath show exactly what's being searched — drop one with{" "}
      <strong>⨯</strong> if it's cutting too much. Words can land in different places: a search
      for <em>memo aisha</em> finds an entry where "memo" is in the write-up and "Aisha" is the
      person who solved it.
    </p>
    <p>
      Common words (<em>how</em>, <em>the</em>, <em>a</em>, <em>is</em>…) are ignored, so you can
      type a question the way you'd ask it. Some words are also mapped to the team's{" "}
      <strong>sub-topics</strong> — searching <em>usestate</em> finds entries tagged{" "}
      <strong>hooks</strong> even when they never use that word. The chip shows it when that
      happens.
    </p>
    <p className="mb-0">
      The <strong>sub-topic chips</strong> are exact: they match how entries are actually tagged,
      while the box searches the write-up text. An entry can carry several tags, so it shows up
      under each of them — click a chip to see everything on that subject.
    </p>
  </>
);

/** The short reminder shown at the top of the Award-a-Star form (both modes). */
export const WHAT_EARNS_A_STAR: ReactNode = (
  <p className="mb-0">
    Stars recognize helping a teammate <strong>troubleshoot an issue</strong>, make a{" "}
    <strong>recommendation</strong>, or explain <strong>how or why something works</strong> —
    sharing deep knowledge to lift up the team.
  </p>
);
