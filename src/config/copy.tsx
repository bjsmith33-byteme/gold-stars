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

/** Placeholder for the Award form's free-text "Sub-topic" field — two examples of the
 *  finer labels your team uses within an area. */
export const SUB_TOPIC_PLACEHOLDER = "e.g. hooks, flexbox";

/** The short reminder shown at the top of the Award-a-Star form (both modes). */
export const WHAT_EARNS_A_STAR: ReactNode = (
  <p className="mb-0">
    Stars recognize helping a teammate <strong>troubleshoot an issue</strong>, make a{" "}
    <strong>recommendation</strong>, or explain <strong>how or why something works</strong> —
    sharing deep knowledge to lift up the team.
  </p>
);
