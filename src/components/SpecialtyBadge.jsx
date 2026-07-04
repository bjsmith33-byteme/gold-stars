/** The cosmetic "specialty" badge (Frontend/Backend/Mobile/Full-stack). Colors come
 *  from custom.css (.badge-<specialty>); an unknown/blank specialty shows a muted dash. */
export function SpecialtyBadge({ role }) {
  if (!role) return <span className="badge text-bg-secondary">—</span>;
  return <span className={`badge badge-specialty badge-${role}`}>{role}</span>;
}
