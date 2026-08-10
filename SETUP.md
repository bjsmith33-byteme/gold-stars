# Setting up Gold Stars for your team

This walks through turning this template into your team's own recognition board. Everything
team-specific lives in **`src/config/`** — four files and one `<title>`. No backend, no
database: the data is one CSV you edit by hand.

Budget about 30 minutes for a first pass, most of it deciding your knowledge areas.

> Already running and just want the field reference? `src/config/types.ts` documents every
> option, and `src/config/team.config.example.ts` is a clean starting point you can copy
> over `team.config.ts`.

---

## 0. What you need

- **Node 20+** (`node --version`). Node 22+ runs the tests directly from TypeScript.
- A **GitHub account**, for hosting on GitHub Pages. Any static host works, but the
  publish step below is Pages-specific.

Get it running locally before changing anything:

```bash
npm install
npm run dev      # http://localhost:5173/gold-stars/#/
npm test         # 43 data-layer tests
```

If the board loads with 20 invented names and React/JavaScript/CSS/SwiftUI areas, you're
ready. Those are placeholders — all of it gets replaced below.

---

## 1. Fork and rename

Fork or copy this repo, then rename it to whatever your board should be called.

**Then immediately update `deploy.base` in `src/config/team.config.ts` to match the new
repo name:**

```ts
deploy: {
  base: "/your-repo-name/",   // must match the repo name, with both slashes
  outDir: "docs",
},
```

This is the single most common way to end up with a blank white page. GitHub Pages serves a
project site from `https://<user>.github.io/<repo>/`, and every asset URL is built relative
to `base`. Get it wrong and the HTML loads while the JS and CSS 404.

`vite.config.mts` reads `base` and `outDir` straight from the config, so this is the only
place to change it.

---

## 2. `src/config/team.config.ts`

The main file. Each block, in order:

### `branding`

```ts
branding: {
  appName: "Gold Stars",                       // shown in the navbar and the page header
  tagline: "A lightweight team recognition board.",
  subtitle: "Optional third line",             // optional — omit for a single-line header
  pageTitle: "Gold Stars — Dev Team Recognition",
},
```

`tagline` is also used in prose elsewhere ("Folks outside the *{tagline}* who jumped in to
help"), so phrase it as a name for the group where you can.

### `contact`

```ts
contact: {
  adminEmail: "you@example.com",     // where nominations are emailed
  feedbackEmail: "you@example.com",  // where "Send feedback" goes
  // csvEditUrl: "https://github.com/<you>/<repo>/edit/main/public/gold-stars.csv",
},
```

**Change both of these.** The template ships with the original author's address, so an
un-edited fork emails nominations to a stranger.

`csvEditUrl` is optional and omitted by default. Set it and the Award form offers a
"copy the row and open the CSV" self-serve path; leave it out and every nomination goes
through email review. Omit it for a public board.

### `roles`

The "specialty" concept — a cosmetic badge next to each name, and optionally a way to split
the leaderboard.

```ts
roles: {
  label: "Specialty",                                    // the column header
  values: ["Frontend", "Backend", "Mobile", "Full-stack"],
  podRoles: [],                                          // see below
  alumni: [],                                            // see §6
},
```

- **`label`** — whatever your team calls it: "Specialty", "Role", "Discipline", "Team".
- **`values`** — every role someone can hold. `roster.ts` may only assign these, and the
  Award form validates against them.
- **`podRoles`** — leave `[]` unless you want a split board. See §6.

### `categories`

Your knowledge areas — the heart of the board, and the part worth thinking about. These are
what stars get filed under and what "growing our experts" is measured across.

```ts
categories: [
  { name: "React", emoji: "⚛️", kudosEmoji: "⚛️", tallyPatterns: [/⚛️/, /\breact\b/i] },
  { name: "Anything else", emoji: "😎" },   // emoji only: never auto-detected
],
```

- **`name`** — appears on the board and in the Award form's dropdown.
- **`emoji`** — display glyph. Every area needs one.
- **`kudosEmoji`** and **`tallyPatterns`** — only used by the chat auto-tally (§6). Omit
  both for areas you never want auto-detected from a message.

Order matters twice: it's the order areas appear on the board, and it breaks ties when two
areas' patterns match at the same position in a message.

Aim for 3–6 areas. A catch-all at the end ("Anything else", "General") saves arguments.

### `sources`

```ts
sources: ["Email", "Manual"],
```

How a row reached the CSV, not where the help happened. Add `"Teams"` **only** if you enable
the chat auto-tally — the parser stamps rows with that source, and rows with a source outside
this list are rejected.

### `features`

Switch whole features off without deleting their code — see §6.

### `deploy`

Covered in §1.

---

## 3. `src/config/roster.ts`

Maps each person's full name to their role:

```ts
export const ROSTER: Record<string, string> = {
  "Ada Lovelace": "Backend",
  "Grace Hopper": "Full-stack",
};
```

- Every value must be one of `roles.values`.
- Lookup is case-insensitive and trims spaces.
- Anyone **not** listed can still earn a star — they just show a dash instead of a badge.
  So you don't need everyone on day one.

The roster drives the Award form's recipient dropdown, so listing people is mostly about
saving typing and keeping spelling consistent.

---

## 4. Empty out `public/gold-stars.csv`

Delete the sample rows, **keep the header**:

```
date,recipient,role,category,note,source,awarded_by,sub_topic
```

| Column | What it is |
|---|---|
| `date` | `YYYY-MM-DD`. Rows with a malformed date are silently dropped. |
| `recipient` | Who's recognized. Required. |
| `role` | Their badge. Blank is fine. Must be in `roles.values` if set. |
| `category` | One of your `categories` names. |
| `note` | The problem & solution summary. **Its presence is what puts the row in the Knowledge Base** — this is the field that makes the whole thing worth keeping. |
| `source` | One of `sources`. |
| `awarded_by` | Who gave the kudos. Feeds Supporter of the Month. Blank for self-research. |
| `sub_topic` | Optional finer label within the area, e.g. `hooks`, `flexbox`. |

Fields with commas, quotes, or newlines need standard CSV quoting. The Award form generates
correctly-escaped rows for you, so the easiest path is to use the app itself and paste the
result.

An empty board (header only) renders fine — it just says there are no stars yet.

---

## 5. `index.html` and `src/config/copy.tsx`

**`index.html`** — update `<title>` by hand to match `branding.pageTitle`. HTML can't read
the TypeScript config, so these two drift unless you keep them in sync.

**`src/config/copy.tsx`** — the prose, kept separate from `team.config.ts` because it
contains JSX:

- `HOW_TO_EARN` — the expanded "How to earn a gold star" explainer on the home page.
- `WHAT_EARNS_A_STAR` — the short reminder at the top of the Award form.
- `SUB_TOPIC_PLACEHOLDER` — placeholder text for the sub-topic field, e.g.
  `"e.g. hooks, flexbox"`.

Rewrite these in your team's own words. The default text describes what earns a star on a
web-dev team; the wording is what tells people whether to bother nominating.

---

## 6. Optional features

All in `features` in `team.config.ts`.

| Flag | Default | What it does |
|---|---|---|
| `previewMode` | `true` | Stage stars locally and preview the board before emailing a batch. |
| `charts` | `true` | Chart.js graphs in My Stats. Lazy-loaded, so `false` means never downloaded. |
| `areaBars` | `false` | CSS per-area bars in My Stats. Forced on when `charts` is off — they're the dependency-free fallback. Both on is fine; they answer different questions. |
| `knowledgeBase` | `true` | The searchable Knowledge Base page and its home-page preview. |
| `friendsOfThePod` | `false` | The Friends board on `/friends`. See below. |
| `chatComposer` | `false` | The "shout out on chat" tab. Needs a `chat` block. |

### Friends and Alumni (the `/friends` page)

Two boards for people who aren't on the main leaderboard. **Both ship off**, so `/friends`
doesn't exist at all — no route, no menu item.

**Friends** are helpers from outside the team. Turning this on takes **two** settings, and
this is the trap:

```ts
roles:    { podRoles: ["Frontend", "Backend"] },   // who counts as ON the team
features: { friendsOfThePod: true },
```

With `podRoles: []` everyone counts as on-team, so the Friends board would always be empty
no matter how the flag is set. `podRoles` is the switch that gives "outside the team" a
meaning; the flag only decides whether to show the board.

**Alumni** are former members. This one needs no flag — just names:

```ts
roles: { alumni: ["Grace Mueller"] },
```

An alum keeps every star they earned, and stays the winner of any month they won. What
changes: they come off the cumulative leaderboard, out of the Award-a-Star dropdown, and
onto their own board. They still count in By Knowledge Area — what they taught the team
outlives their membership.

Alumni are matched by **name**, not role, and are listed in `team.config.ts` rather than
`roster.ts` on purpose: their historical CSV rows still carry the role they held at the
time, which is what keeps past months honest. Keep `roster.ts` to who's on the team today.

Optional labels: `alumniRole` (badge text, defaults to `"Alum"`) and `alumniLabel` (heading,
defaults to `"Alumni"`).

### Chat auto-tally

`src/lib/teams.ts` turns `⭐ @someone ⚛️ thanks for the help` chat messages into CSV rows. It
ships **off**, with a placeholder `chat` block that exists to document the shape and to give
the parser tests something real to run against. To enable:

1. Put real chat ids in `chat.monitoredChats` — for Teams, the `19:…@thread.v2` segment of a
   "Copy link to chat" URL.
2. Set `features.chatComposer: true`.
3. Add `"Teams"` to `sources`, or every row the parser produces gets rejected.

Fetching the messages is a scheduled job you supply — this repo parses them, it doesn't
collect them.

---

## 7. Publish to GitHub Pages

```bash
npm run build    # type-checks, then writes the site to docs/
```

**Building does not publish.** `docs/` is committed to the repo and GitHub Pages serves it,
so the deploy happens when you push:

```bash
git add docs && git commit -m "Publish" && git push
```

One-time GitHub setup: **Settings → Pages → Deploy from a branch → `main` / `/docs`**.

Your site: `https://<your-username>.github.io/<your-repo>/`

Adding a star later is the same loop: edit `public/gold-stars.csv`, `npm run build`, commit
both the CSV and `docs/`, push.

---

## 8. Checklist

- [ ] `deploy.base` matches the repo name, with leading and trailing slashes
- [ ] `contact.adminEmail` and `feedbackEmail` are **yours**
- [ ] `roles.values` reflects your specialties, and `roster.ts` only uses those values
- [ ] `categories` are your knowledge areas, each with an `emoji`
- [ ] `public/gold-stars.csv` has your data (or just the header)
- [ ] `index.html` `<title>` matches `branding.pageTitle`
- [ ] `copy.tsx` is in your team's words
- [ ] `npm run build` passes and `npm test` is green
- [ ] GitHub Pages is pointed at `main` / `/docs`
- [ ] `docs/` is committed and pushed

## Troubleshooting

**Blank white page on the deployed site.** `deploy.base` doesn't match the repo name. Check
the browser console for 404s on `/assets/…`.

**The live site doesn't show a star I added.** You built but didn't commit `docs/`. The CSV
in `public/` is the source; the CSV inside `docs/` is the published copy, and only a build
plus a push updates it.

**Someone shows a dash instead of a badge.** They're not in `roster.ts`, or their CSV `role`
isn't in `roles.values`. Harmless — they still count.

**A whole row is missing from the board.** `parseCsv` drops rows with no recipient or a
malformed date, rather than crashing the page. Check the `date` is `YYYY-MM-DD`.

**No "Friends" item in the menu.** Expected unless `features.friendsOfThePod` is true or
`roles.alumni` is non-empty. If Friends is on but the board is empty, `podRoles` is still
`[]` — see §6.

**`npm test` fails right after editing the config.** The tests assert against the *live*
config on purpose, so config and behavior can't drift apart. If you changed `podRoles`,
`roles.alumni`, or `sources`, the expectations in `src/lib/aggregate.test.ts` need updating
to match your setup — the failure is the test doing its job.
