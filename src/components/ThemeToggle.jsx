import { useState } from "react";
import Button from "react-bootstrap/Button";

/** Light/dark toggle. Flips Bootstrap's `data-bs-theme` on <html> and persists the
 *  choice; index.html applies the saved theme pre-paint to avoid a flash. */
export function ThemeToggle() {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-bs-theme") === "dark",
  );

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-bs-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return (
    <Button
      variant="outline-secondary"
      size="sm"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? "☀️" : "🌙"}
    </Button>
  );
}
