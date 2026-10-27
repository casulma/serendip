// Closed list of categories, shared by facts and trivia. Labels are user-facing (French).
export const CATEGORIES = [
  { id: "histoire", label: "Histoire" },
  { id: "geographie", label: "Géographie" },
  { id: "sciences", label: "Sciences" },
  { id: "nature", label: "Nature & animaux" },
  { id: "arts-litterature", label: "Arts & littérature" },
  { id: "musique-cinema", label: "Musique & cinéma" },
  { id: "sport", label: "Sport" },
  { id: "societe-politique", label: "Société & politique" },
  { id: "langue", label: "Langue" },
  { id: "divers", label: "Divers" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
