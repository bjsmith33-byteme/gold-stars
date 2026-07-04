import { useState } from "react";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import { SpecialtyBadge } from "./SpecialtyBadge.jsx";

const medal = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "");

export function Leaderboard({ tallies, onSelectPerson, cap = false }) {
  const [sortKey, setSortKey] = useState("rank");
  const [asc, setAsc] = useState(true);

  if (tallies.length === 0) {
    return <p className="text-center text-body-secondary fst-italic py-4 mb-0">No gold stars yet — be the first! ⭐</p>;
  }

  // Rank is always by stars desc. Standard competition ranking ("1224"): equal star
  // counts share a rank, so co-leaders are both #1 (🥇); the next distinct count skips.
  const byStars = [...tallies].sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
  const ranked = byStars.map((t, i) => ({
    ...t,
    rank: i > 0 && byStars[i - 1].stars === t.stars ? -1 : i + 1,
  }));
  for (let i = 1; i < ranked.length; i++) {
    if (ranked[i].rank === -1) ranked[i].rank = ranked[i - 1].rank;
  }

  // When `cap` is set (the all-time board), show at most the top 4 places (by rank) —
  // but if 4th place is tied (more than one person sharing rank 4), drop it and show
  // only the top 3 rather than a crowded tie. Monthly boards pass cap=false (show all).
  let capped = ranked;
  if (cap) {
    const tieAtFourth = ranked.filter((t) => t.rank === 4).length > 1;
    const maxPlace = tieAtFourth ? 3 : 4;
    capped = ranked.filter((t) => t.rank <= maxPlace);
  }

  const sorted = [...capped].sort((a, b) => {
    let cmp;
    switch (sortKey) {
      case "name": cmp = a.name.localeCompare(b.name); break;
      case "role": cmp = a.role.localeCompare(b.role) || b.stars - a.stars; break;
      case "stars": cmp = a.stars - b.stars || a.name.localeCompare(b.name); break;
      default: cmp = a.rank - b.rank; break;
    }
    return asc ? cmp : -cmp;
  });

  const setSort = (k) => {
    if (k === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(k);
      setAsc(k === "name" || k === "role"); // text A→Z, numeric high→low
    }
  };

  const arrow = (k) => (sortKey === k ? (asc ? " ▲" : " ▼") : "");
  const thStyle = { cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };

  return (
    <Table striped hover responsive size="sm" className="align-middle mb-0">
      <thead>
        <tr>
          <th style={thStyle} onClick={() => setSort("rank")}>#{arrow("rank")}</th>
          <th style={thStyle} onClick={() => setSort("name")}>Name{arrow("name")}</th>
          <th style={thStyle} onClick={() => setSort("role")}>Specialty{arrow("role")}</th>
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
            <td><SpecialtyBadge role={t.role} /></td>
            <td className="text-end fw-semibold" style={{ whiteSpace: "nowrap" }}>⭐ {t.stars}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
