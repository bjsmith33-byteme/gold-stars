// ─────────────────────────────────────────────────────────────────────────────
// THE file to edit when adopting Gold Stars for a new team.
//
// Also edit:  roster.ts  (who's on the team)  ·  copy.tsx  (the prose)
// And keep index.html's <title> in sync with branding.pageTitle — HTML can't read
// this file.
//
// See team.config.example.ts for a documented starting point, and types.ts for
// what each field means.
//
// This is the PUBLIC template's own configuration: dummy roster, dummy data, and
// the web-dev knowledge areas. Everything here is a placeholder to replace.
//
// RUNTIME NOTE: this module is imported by Node-run tooling, so it must stay free of
// JSX and browser-only APIs. UI prose lives in copy.tsx instead.
// ─────────────────────────────────────────────────────────────────────────────
import type { TeamConfig } from "./types.ts";

const config: TeamConfig = {
  branding: {
    appName: "Gold Stars",
    tagline: "A lightweight team recognition board.",
    // subtitle is optional — omitted here for a single-line header.
    pageTitle: "Gold Stars — Dev Team Recognition",
  },

  contact: {
    adminEmail: "bjsmith33@wisc.edu",
    feedbackEmail: "bjsmith33@wisc.edu",
    // csvEditUrl is deliberately OMITTED: this is a public site, so every nomination
    // goes through email review rather than exposing direct write access to the data.
    // Set it to your git host's web editor URL to offer the self-serve path instead.
  },

  roles: {
    label: "Specialty",
    values: ["Frontend", "Backend", "Mobile", "Full-stack"],
    // EMPTY = one unified board. Everyone competes together and no "friends" section
    // appears. Fill this in only if you want a subset of roles on the main leaderboard
    // with everyone else tracked separately.
    podRoles: [],
    // Former members, by full name. Their stars stay in the months they earned them, but
    // they come off the cumulative leaderboard, drop out of the Award-a-Star picker, and
    // move to their own board on /friends. EMPTY = no alumni, and the page's alumni
    // section doesn't render. To use it:
    //   alumni: ["Grace Mueller", "Omar Haddad"],
    // `alumniRole` ("Alum") and `alumniLabel` ("Alumni") are the badge and heading text;
    // both are optional and defaulted, so they're left out here.
    alumni: [],
  },

  // Order here is the order areas appear on the board, and it breaks ties when two
  // areas' tallyPatterns match at the same position in a message.
  categories: [
    { name: "React", emoji: "⚛️", kudosEmoji: "⚛️", tallyPatterns: [/⚛️/, /\breact\b/i, /\bhooks?\b/i] },
    {
      name: "JavaScript",
      emoji: "🟨",
      kudosEmoji: "🟨",
      tallyPatterns: [/🟨/, /\bjavascript\b/i, /\bpromises?\b/i],
    },
    { name: "CSS", emoji: "🎨", kudosEmoji: "🎨", tallyPatterns: [/🎨/, /\bcss\b/i, /\bflexbox\b/i] },
    {
      name: "SwiftUI",
      emoji: "📱",
      kudosEmoji: "📱",
      tallyPatterns: [/📱/, /\bswiftui\b/i, /\bswift\b/i],
    },
  ],

  sources: ["Email", "Manual"],

  // Chat auto-tally: PLACEHOLDER wiring, switched off. `features.chatComposer` is false,
  // so the composer tab and the ?chat= deep link never appear and nothing here is used
  // by the running app — it's here as worked documentation of the shape, and to give
  // src/lib/teams.test.ts real rules to exercise the parser against. To turn it on:
  // replace the ids with real ones (the `19:…@thread.v2` segment of a Teams "Copy link
  // to chat" URL), set features.chatComposer to true, and add "Teams" to `sources` —
  // the parser stamps rows with source "Teams", so it must be an allowed value.
  chat: {
    provider: "teams",
    fallbackCategory: "JavaScript",
    monitoredChats: [
      { key: "team", id: "19:00000000000000000000000000000001@thread.v2", label: "Team chat" },
      { key: "web", id: "19:00000000000000000000000000000002@thread.v2", label: "Web chat" },
      { key: "mobile", id: "19:00000000000000000000000000000003@thread.v2", label: "Mobile chat" },
    ],
  },

  features: {
    // Stage stars locally and preview the board before submitting a batch by email.
    previewMode: true,
    // Chart.js graphs in My Stats. Lazy-loaded, so off means never downloaded — a team
    // that turns this off falls back to dependency-free CSS bars.
    charts: true,
    // Off: the chart's By-area facet already covers this ground.
    areaBars: false,
    knowledgeBase: true,
    // The Friends board on /friends. Needs a non-empty roles.podRoles to be useful: with
    // podRoles empty everyone counts as on-team, so the board would always be empty.
    // Together with roles.alumni this also decides whether /friends exists at all.
    friendsOfThePod: false,
    chatComposer: false, // no real chat wired up; nominations are email-only
  },

  deploy: {
    // GitHub Pages project site: base must match the repo name.
    base: "/gold-stars/",
    // docs/ is committed and served by Pages — building does not publish.
    outDir: "docs",
  },
};

export default config;
