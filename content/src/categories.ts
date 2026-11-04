// The 12 question categories, with the share of the question bank each should hold.
export const CATEGORIES = [
  { id: "histoire", label: "Histoire", target: 120 },
  { id: "geographie", label: "Géographie", target: 120 },
  { id: "sciences", label: "Sciences & techniques", target: 110 },
  { id: "nature", label: "Nature & animaux", target: 90 },
  { id: "arts-litterature", label: "Arts & littérature", target: 100 },
  { id: "musique", label: "Musique", target: 70 },
  { id: "cinema-tv", label: "Cinéma & télévision", target: 80 },
  { id: "sport", label: "Sport & jeux", target: 80 },
  { id: "langue", label: "Langue & expressions", target: 70 },
  { id: "mythologie", label: "Mythologies & religions", target: 50 },
  { id: "gastronomie", label: "Gastronomie & vie quotidienne", target: 60 },
  { id: "societe", label: "Société, politique & économie", target: 50 },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
