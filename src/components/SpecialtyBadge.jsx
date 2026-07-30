/** The cosmetic "specialty" (Frontend/Backend/Mobile/Full-stack). De-emphasized as plain
 *  muted text rather than a colored badge — it's supplementary, not a headline. */
export function SpecialtyBadge({ role }) {
  return <span className="text-body-secondary small">{role || "—"}</span>;
}
