import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./routes/Layout";
import { Home } from "./routes/Home";
import { KnowledgeBasePage } from "./routes/KnowledgeBasePage";
import { About } from "./routes/About";
import TEAM from "./config/team.config";

/** Hash routing (see main.tsx) so the routes work on static hosting — GitLab/GitHub Pages
 *  have no single-page-app fallback, and "#/kb" needs no server config or 404 redirect.
 *
 *  The board also honors "#/?award=1&chat=<key>" to open the Award composer with a chat
 *  preselected — handled in Home via useSearchParams. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        {TEAM.features.knowledgeBase && <Route path="kb" element={<KnowledgeBasePage />} />}
        <Route path="about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
