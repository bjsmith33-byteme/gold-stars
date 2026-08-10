// ─────────────────────────────────────────────────────────────────────────────
// Starting point for a new team. Copy over team.config.ts and edit.
//
// This example is the SIMPLE case: one unified leaderboard, no chat integration,
// email-only nominations. Compare with the live team.config.ts to see what a fuller
// setup (role-based pod split + Teams auto-tally) looks like.
//
// Don't forget:
//   · roster.ts        — your people
//   · copy.tsx         — what earns a star on your team
//   · index.html       — <title> must match branding.pageTitle
//   · public/gold-stars.csv — clear the sample rows, keep the header
// ─────────────────────────────────────────────────────────────────────────────
import type { TeamConfig } from "./types.ts";

const config: TeamConfig = {
  branding: {
    appName: "Gold Stars",
    tagline: "Platform Team",
    // subtitle is optional — omit for a single-line header.
    pageTitle: "Gold Stars — Platform Team Recognition",
  },

  contact: {
    adminEmail: "you@example.com",
    feedbackEmail: "you@example.com",
    // Omit csvEditUrl to hide the "add it to the CSV yourself" path and force every
    // nomination through email review.
    csvEditUrl: "https://github.com/your-org/your-repo/edit/main/public/gold-stars.csv",
  },

  roles: {
    label: "Specialty",
    values: ["Frontend", "Backend", "Mobile", "Full-stack"],
    // EMPTY = one unified board. Everyone competes together and no "friends" section
    // appears. Fill this in only if you want a subset of roles on the main leaderboard
    // with everyone else tracked separately.
    podRoles: [],
    // Former members, by full name. Their past stars stay in the months they were earned,
    // but they drop off the cumulative leaderboard and can't be nominated.
    // EMPTY = no alumni board appears.
    alumni: [],
  },

  categories: [
    { name: "React", emoji: "⚛️" },
    { name: "JavaScript", emoji: "🟨" },
    { name: "CSS", emoji: "🎨" },
    { name: "SwiftUI", emoji: "📱" },
  ],

  sources: ["Email", "Manual"],

  // No `chat` block: the auto-tally and the composer tab are simply absent. src/lib/
  // teams.ts stays in the repo, unused, if you want to wire up a chat platform later.

  features: {
    previewMode: true,
    charts: true,
    areaBars: false, // the chart's By-area facet already covers this
    knowledgeBase: true,
    friendsOfThePod: false, // ignored anyway while roles.podRoles is empty
    chatComposer: false, // requires a `chat` block
  },

  deploy: {
    // For a GitHub/GitLab *project* page, base must match the repo name.
    base: "/your-repo/",
    outDir: "dist",
  },
};

export default config;
