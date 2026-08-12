// The contract between the Gold Stars app and the team adopting it.
//
// Everything team-specific lives behind this interface, so a new team edits
// `team.config.ts` (+ `roster.ts`, + `copy.tsx`) and nothing else. See
// `team.config.example.ts` for a documented starting point.
//
// TYPES ONLY — this file must stay free of runtime values so it can be imported
// from anywhere, including the Node-run tally scripts.

/** One knowledge area the board tracks. */
export interface CategoryConfig {
  /** Display name. This is the literal string stored in the CSV's `category` column. */
  name: string;
  /** Glyph shown next to the area on the board / in the knowledge base. */
  emoji: string;
  /** Emoji embedded in a composed chat kudos so the auto-tally can recognize the area.
   *  Omit for areas with no distinctive signal — those fall through to the fallback. */
  kudosEmoji?: string;
  /** Patterns the auto-tally matches to infer this area from a chat message. The
   *  EARLIEST match across all areas wins, so order within the array is irrelevant but
   *  order across `categories` breaks ties. Omit for areas that are never auto-detected. */
  tallyPatterns?: RegExp[];
}

/** A chat the auto-tally watches, and that the composer can hand the user off to. */
export interface MonitoredChat {
  /** Short URL-safe slug used in the composer's `?chat=` deep link. */
  key: string;
  /** Platform chat id — for Teams, the `19:…@thread.v2` segment of a "Copy link to chat" URL. */
  id: string;
  /** Human label shown in the composer's chat picker. */
  label: string;
}

export interface TeamConfig {
  branding: {
    /** Short name used in headings and email subjects. */
    appName: string;
    /** One-line descriptor under the title (usually the team name). */
    tagline: string;
    /** Optional second line under the tagline. */
    subtitle?: string;
    /** Full `<title>`. Keep index.html's <title> in sync — HTML can't read this file. */
    pageTitle: string;
  };

  contact: {
    /** Where nominations and staged batches are emailed for review + commit. */
    adminEmail: string;
    /** Where "Send feedback" goes. Often the same as adminEmail. */
    feedbackEmail: string;
    /** Direct link to edit the CSV in your git host's web editor. Omit to hide the
     *  "add it to the CSV yourself" path entirely. */
    csvEditUrl?: string;
  };

  roles: {
    /** Column header for the role/specialty column ("Role", "Specialty", …). */
    label: string;
    /** Every role a member can have. */
    values: string[];
    /** Roles that count as "on the team" for the competitive leaderboard. Anyone with a
     *  star whose role is outside this list is tracked separately as a "friend".
     *  LEAVE EMPTY for one unified board with no split — the common case. */
    podRoles: string[];
    /** Heading for the non-pod board. Only used when `podRoles` is non-empty. */
    friendsLabel?: string;
    /** Former members, by full name. Listed HERE rather than in roster.ts so the roster
     *  can stay a plain list of who's on the team today (and, on teams that generate it
     *  from a staff directory, so it survives regeneration). Their past stars stay in the
     *  months they were earned, but they drop off the cumulative leaderboard and out of
     *  the Award-a-Star picker. Matching is case-insensitive and trims spaces.
     *  Empty = no alumni board. */
    alumni?: string[];
    /** Badge text for an alum. Deliberately NOT one of `values` — a role you can't be
     *  awarded in. Defaults to "Alum". */
    alumniRole?: string;
    /** Heading for the alumni board. Only used when `alumni` is non-empty. */
    alumniLabel?: string;
  };

  /** Knowledge areas, in the order they should appear on the board. */
  categories: CategoryConfig[];

  /** Allowed values for the CSV `source` column (how a row got entered). */
  sources: string[];

  /** Chat integration. Omit entirely for a team with no chat auto-tally; the composer
   *  and the `?chat=` deep link disappear and `teams.ts` goes unused (but stays in the
   *  repo, ready to wire up later). */
  chat?: {
    provider: "teams";
    /** Area assigned when a kudos matches no `tallyPatterns`. Must be a category name. */
    fallbackCategory: string;
    monitoredChats: MonitoredChat[];
  };

  /** Knowledge-Base search tuning. Omit for none — the box still works, it just takes
   *  people's words literally. */
  search?: {
    /** Your team's vocabulary: what people type → the sub-topic tag they mean. `canonical`
     *  should be a tag that's actually in use, so a synonym hit and a chip click land on the
     *  same entries. Matched longest-phrase-first, so multi-word aliases are fine. Add an
     *  alias the first time someone searches for a thing by the wrong name and finds
     *  nothing. The shape is declared structurally here (rather than imported) to keep this
     *  config module free of imports from `lib/` — see `SynonymGroup` in src/lib/search.ts. */
    synonyms: { canonical: string; aliases: string[] }[];
  };

  /** Turn whole features on/off without deleting their code. */
  features: {
    /** Stage stars locally and preview the board before submitting a batch. */
    previewMode: boolean;
    /** Chart.js graphs in My Stats (lazy-loaded; off = never downloaded). */
    charts: boolean;
    /** The CSS "By knowledge area" bars in My Stats. Redundant with the chart's By-area
     *  facet, so a team using charts may prefer them off. Forced ON when `charts` is
     *  false — they're the dependency-free fallback. */
    areaBars: boolean;
    /** The searchable Knowledge Base page + home-page preview. */
    knowledgeBase: boolean;
    /** The separate non-pod board. Ignored when `roles.podRoles` is empty. */
    friendsOfThePod: boolean;
    /** The "shout out on chat" composer tab. Requires `chat` to be set. */
    chatComposer: boolean;
  };

  /** Build/deploy shape. Consumed by vite.config.mts. */
  deploy: {
    /** Public base path. "/" for a root-hosted site, "/repo-name/" for a project page. */
    base: string;
    /** Build output directory. */
    outDir: string;
  };
}
