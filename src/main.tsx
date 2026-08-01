import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
// Bootstrap first, then our overrides — custom.css must win the cascade.
import "bootstrap/dist/css/bootstrap.min.css";
import "./custom.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
