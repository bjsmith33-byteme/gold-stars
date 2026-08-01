import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Deploy shape comes from the team config so a new team changes it in one place.
import TEAM from "./src/config/team.config.ts";

// Public build for GitHub Pages project site at https://<user>.github.io/gold-stars/.
// `deploy.base` MUST match the repo name so asset URLs resolve under the /gold-stars/ path.
// Output goes to `docs/` (committed) — GitHub Pages serves from /docs, so a build alone
// changes nothing live; publishing happens only when you commit + push docs/.
export default defineConfig({
  plugins: [react()],
  base: TEAM.deploy.base,
  build: {
    outDir: TEAM.deploy.outDir,
    // docs/ is a committed build output, so clear it each build rather than layering
    // new hashed assets on top of stale ones.
    emptyOutDir: true,
  },
  server: {
    watch: {
      // Don't watch image/binary assets — the app imports none (the poster is inline SVG),
      // and editing/generating a locked image in the project folder crashes the dev
      // file-watcher on Windows (EBUSY).
      ignored: [
        "**/*.png",
        "**/*.svg",
        "**/*.jpg",
        "**/*.jpeg",
        "**/*.gif",
        "**/*.pdf",
        "**/*.zip",
      ],
    },
  },
});
