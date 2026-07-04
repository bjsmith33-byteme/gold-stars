// Team roster -- maps a person's full name to their specialty. The Award-a-Star form
// looks the specialty up from here instead of asking, so it stays consistent and is
// one less field. Lookup is case-insensitive and trims spaces; anyone not listed gets
// a blank specialty (the board shows a dash) until added.
//
// This is DUMMY data for the public template — replace with your own team.
export const ROSTER = {
  "Aisha Okafor": "Frontend",
  "Diego Hernandez": "Backend",
  "Mei Lin Chen": "Frontend",
  "Priya Nair": "Full-stack",
  "Jamal Washington": "Backend",
  "Sofia Rossi": "Mobile",
  "Kenji Tanaka": "Backend",
  "Fatima Al-Sayed": "Frontend",
  "Liam O'Brien": "Full-stack",
  "Ana Silva": "Mobile",
  "Raj Patel": "Backend",
  "Yuki Sato": "Frontend",
  "Zoe Anderson": "Full-stack",
  "Omar Haddad": "Backend",
  "Ingrid Larsson": "Frontend",
  "Carlos Mendez": "Mobile",
  "Nina Petrova": "Full-stack",
  "Kwame Mensah": "Backend",
  "Hana Kim": "Mobile",
  "Grace Mueller": "Frontend",
};

const byNormalizedName = new Map(
  Object.entries(ROSTER).map(([name, role]) => [name.trim().toLowerCase(), role]),
);

/** Specialty for a name, or "" if they're not on the roster yet. */
export function roleFor(name) {
  return byNormalizedName.get(name.trim().toLowerCase()) ?? "";
}
