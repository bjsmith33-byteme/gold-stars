import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./routes/Layout.jsx";
import { Home } from "./routes/Home.jsx";
import { KnowledgeBasePage } from "./routes/KnowledgeBasePage.jsx";
import { About } from "./routes/About.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="kb" element={<KnowledgeBasePage />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
