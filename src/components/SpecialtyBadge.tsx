/** The member's role/specialty. De-emphasized as plain muted text rather than a colored
 *  badge — it's supplementary information, not a headline. Replaces the three separate
 *  copies of roleBadge() that Leaderboard, UserStats and CategoryBreakdown each carried. */
export function SpecialtyBadge({ role }: { role: string }) {
  return <span className="text-body-secondary small">{role || "—"}</span>;
}
