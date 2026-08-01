import { useState } from "react";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import type { Tally } from "../lib/aggregate";
import { SpecialtyBadge } from "./SpecialtyBadge";
import TEAM from "../config/team.config";

type SortKey = "rank" | "name" | "role" | "stars";

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "");

export function Leaderboard({
  tallies,
  onSelectPerson,
  cap = false,
}: {
  tallies: Tally[];
  onSelectPerson?: (name: string) => void;
  /** Show only the top places (all-time board). Off by default — monthly boards show
   *  everyone. Wired up on the all-time board in migration step 4. */
  cap?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [asc, setAsc] = useState(true);

  if (tallies.length === 0) {
    return (
      <p className="text-center text-body-secondary fst-italic py-4 mb-0">
        No gold stars yet — be the first! ⭐
      </p>
    );
  }

  // Rank is always by stars desc, independent of the column the user sorts by.
  // Standard competition ranking ("1224"): equal star counts share a rank, so
  // co-leaders are both #1 (🥇). The next distinct count skips the tied slots.
  const byStars = [...tallies].sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
  const ranked = byStars.map((t, i) => ({
    ...t,
    rank: i > 0 && byStars[i - 1].stars === t.stars ? -1 : i + 1,
  }));
  for (let i = 1; i < ranked.length; i++) {
    if (ranked[i].rank === -1) ranked[i].rank = ranked[i - 1].rank;
  }

  // When `cap` is set, show at most the top 4 places (by rank) — but if 4th place is
  // tied (more than one person sharing rank 4), drop it and show only the top 3 rather
  // than a crowded tie.
  let capped = ranked;
  if (cap) {
    const tieAtFourth = ranked.filter((t) => t.rank === 4).length > 1;
    const maxPlace = tieAtFourth ? 3 : 4;
    capped = ranked.filter((t) => t.rank <= maxPlace);
  }

  const sorted = [...capped].sort((a, b) => {
    let cmp: number;
    switch (sortKey) {
      case "name": cmp = a.name.localeCompare(b.name); break;
      case "role": cmp = a.role.localeCompare(b.role) || b.stars - a.stars; break;
      case "stars": cmp = a.stars - b.stars || a.name.localeCompare(b.name); break;
      default: cmp = a.rank - b.rank; break;
    }
    return asc ? cmp : -cmp;
  });

  const setSort = (k: SortKey) => {
    if (k === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(k);
      // Text columns default A→Z; numeric columns default high→low.
      setAsc(k === "name" || k === "role");
    }
  };

  const arrow = (k: SortKey) => (sortKey === k ? (asc ? " ▲" : " ▼") : "");
  const thStyle = { cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" } as const;

  return (
    <Table striped hover responsive size="sm" className="align-middle mb-0">
      <thead>
        <tr>
          <th style={thStyle} onClick={() => setSort("rank")}>#{arrow("rank")}</th>
          <th style={thStyle} onClick={() => setSort("name")}>Name{arrow("name")}</th>
          <th style={thStyle} onClick={() => setSort("role")}>
            {TEAM.roles.label}
            {arrow("role")}
          </th>
          <th style={{ ...thStyle, textAlign: "right" }} onClick={() => setSort("stars")}>
            Stars{arrow("stars")}
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => (
          <tr key={t.name}>
            <td className="medal-cell">{medal(t.rank - 1) || t.rank}</td>
            <td className="fw-medium">
              {onSelectPerson ? (
                <Button
                  variant="link"
                  className="p-0 text-decoration-none"
                  onClick={() => onSelectPerson(t.name)}
                  title={`See ${t.name}'s stats`}
                >
                  {t.name}
                </Button>
              ) : (
                t.name
              )}
            </td>
            <td>
              <SpecialtyBadge role={t.role} />
            </td>
            <td className="text-end fw-semibold" style={{ whiteSpace: "nowrap" }}>
              ⭐ {t.stars}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
