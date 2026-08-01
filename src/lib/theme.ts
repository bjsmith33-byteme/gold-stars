import { useSyncExternalStore } from "react";

export type BsTheme = "light" | "dark";

/** Read the app's current Bootstrap theme from <html data-bs-theme>. Defaults to light. */
function currentTheme(): BsTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light";
}

/** Notify on any change to <html>'s data-bs-theme (e.g. the ThemeToggle flipping it). */
function subscribe(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const obs = new MutationObserver(callback);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-bs-theme"],
  });
  return () => obs.disconnect();
}

/** Reactive "light" | "dark" for the app theme. Stays in sync with the ThemeToggle without
 *  needing shared context — it observes the attribute the toggle already writes. */
export function useBsTheme(): BsTheme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light" as const);
}
