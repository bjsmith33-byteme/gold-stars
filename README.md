# Gold Stars

A lightweight, static recognition board that promotes knowledge- and skill-sharing on a team.
It highlights an all-time leaderboard, monthly winners, a **Supporter of the Month**, per-area
expertise (React / JavaScript / CSS / SwiftUI), and a searchable **Knowledge Base** built from the
short "problem & solution" note attached to each star.

Built with **Vite + React + TypeScript + React-Bootstrap + React Router** (declarative,
`HashRouter`). No backend — all data is read live from one hand-editable CSV.

Everything team-specific lives behind a config seam in **`src/config/`**, so adopting this for
your own team means editing a handful of files, not hunting through components. See
[Adopt this for your team](#adopt-this-for-your-team).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173/gold-stars/#/
npm test         # data-layer unit tests (node --test)
npm run build    # tsc + vite build -> docs/  (does NOT publish)
```

The tests run against the **live** `src/config/team.config.ts`, so they double as a check that
your configuration is coherent — change the areas or roles and the tests tell you what that
implies.

## Data

All content is one row per star in **`public/gold-stars.csv`**:

```
date,recipient,role,category,note,source,awarded_by,sub_topic
```

- **date** `YYYY-MM-DD` · **recipient** who's recognized · **role** cosmetic specialty
  (Frontend/Backend/Mobile/Full-stack) · **category** React/JavaScript/CSS/SwiftUI ·
  **note** the problem & solution summary (its presence adds the row to the Knowledge Base) ·
  **source** Email/Manual · **awarded_by** who gave the kudos (feeds Supporter of the Month) ·
  **sub_topic** optional finer label (e.g. hooks, flexbox).

Edit the CSV by hand to add/adjust stars. Totals are never stored — they're computed in the
browser at render time, so adding a star is always just appending a row.

## Adopt this for your team

Four files, then you're done:

| File | What you change |
|---|---|
| `src/config/team.config.ts` | branding, contact emails, roles, knowledge areas, sources, which features are on, deploy paths |
| `src/config/roster.ts` | your people → their role/specialty |
| `src/config/copy.tsx` | the prose: what earns a star on your team |
| `index.html` | `<title>` — HTML can't read the config, so keep it in sync with `branding.pageTitle` |

Then clear the sample rows from `public/gold-stars.csv` (keep the header).

`src/config/team.config.example.ts` is a documented starting point — copy it over
`team.config.ts` and edit. `src/config/types.ts` is the contract, with a comment on every field.

A few things worth knowing:

- **`roles.podRoles: []`** (the default here) means one unified board. Fill it in to keep a
  subset of roles on the competitive leaderboard and track everyone else separately.
- **`features.*`** switches whole features off without deleting their code — Preview mode,
  charts, the Knowledge Base, the chat composer.
- **Chat auto-tally:** `src/lib/teams.ts` turns "⭐ @someone 🎨" chat messages into rows. It
  ships **switched off** with a placeholder `chat` block; the parser is fully tested against it.
  To enable, put real chat ids in `chat.monitoredChats`, set `features.chatComposer: true`, and
  add `"Teams"` to `sources`. Fetching the messages is a scheduled job you supply.

## Build & publish (GitHub Pages from `/docs`)

```bash
npm run build    # writes the site to docs/  (does NOT publish)
```

`docs/` is committed to the repo, and GitHub Pages is configured to serve from
**`main` → `/docs`**. So a build only changes local files — **publishing happens when you commit
and push `docs/`**:

```bash
git add docs && git commit -m "Publish" && git push
```

One-time GitHub setup: **Settings → Pages → Deploy from a branch → `main` / `/docs`**.
Site URL: `https://<your-username>.github.io/gold-stars/`.

If you rename the repo, update `deploy.base` in `src/config/team.config.ts` to match
(`/<repo>/`) — `vite.config.mts` reads it from there.

## Project layout

```
public/gold-stars.csv     the data (hand-editable)
docs/                     built site (committed; served by GitHub Pages)
src/
  main.tsx                mounts <HashRouter><App/></HashRouter>
  App.tsx                 routes
  config/                 THE seam: types, team.config(+example), roster, copy
  routes/                 Layout (nav + footer + data fetch), Home, KnowledgeBasePage, About
  components/             Leaderboard, banners, MonthSection, CategoryBreakdown, UserStats,
                          KnowledgeBase(+Preview), AwardStarModal, DynamicGraphs, ThemeToggle,
                          StarChartPosterboard, Footer
  lib/                    aggregate.ts (data model + tallies), overlay.ts (Preview mode),
                          teams.ts (chat parser, off by default), theme.ts, + their tests
```
