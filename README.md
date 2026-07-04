# Gold Stars

A lightweight, static recognition board that promotes knowledge- and skill-sharing on a team.
It highlights an all-time leaderboard, monthly winners, a **Supporter of the Month**, per-area
expertise (React / JavaScript / CSS / SwiftUI), and a searchable **Knowledge Base** built from the
short "problem & solution" note attached to each star.

Built with **Vite + React (plain JSX) + React-Bootstrap + React Router** (declarative, `HashRouter`).
No backend — all data is read live from one hand-editable CSV.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173/gold-stars/#/
npm test         # data-layer unit tests (node --test)
```

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

Edit the CSV by hand to add/adjust stars. The roster of names → specialties lives in
`src/lib/roster.js`.

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

If you rename the repo, update `base` in `vite.config.js` to match (`/<repo>/`).

## Replace these placeholders

- **Contact / nomination email:** `you@example.com` in `src/components/Footer.jsx`,
  `src/components/AwardStarModal.jsx`, and `src/routes/About.jsx`.
- **Roster & data:** the fake names in `src/lib/roster.js` and the sample rows in
  `public/gold-stars.csv`.

## Project layout

```
public/gold-stars.csv     the data (hand-editable)
docs/                     built site (committed; served by GitHub Pages)
src/
  main.jsx                mounts <HashRouter><App/></HashRouter>
  App.jsx                 routes
  routes/                 Layout (nav + footer + data fetch), Home, KnowledgeBasePage, About
  components/             Leaderboard, banners, MonthSection, CategoryBreakdown,
                          UserStats, KnowledgeBase(+Preview), AwardStarModal, ThemeToggle, Footer
  lib/                    aggregate.js (data model + tallies), roster.js, aggregate.test.js
```
