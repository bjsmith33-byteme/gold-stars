import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Public build for GitHub Pages project site at https://<user>.github.io/gold-stars/.
// `base` MUST match the repo name so asset URLs resolve under the /gold-stars/ path.
// Output goes to `docs/` (committed) — GitHub Pages serves from /docs, so a build alone
// changes nothing live; publishing happens only when you commit + push docs/.
export default defineConfig({
  plugins: [react()],
  base: "/gold-stars/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
  server: {
    watch: {
      // Don't watch image/binary assets — the app imports none (the favicon is static),
      // and editing/generating a locked image in the project folder was crashing the dev
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

