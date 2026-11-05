// The 12 question categories, with the share of the question bank each should hold.
export const CATEGORIES = [
  { id: "histoire", label: "Histoire", target: 745 },
  { id: "geographie", label: "Géographie", target: 800 },
  { id: "sciences", label: "Sciences & techniques", target: 560 },
  { id: "nature", label: "Nature & animaux", target: 500 },
  { id: "arts-litterature", label: "Arts & littérature", target: 610 },
  { id: "musique", label: "Musique", target: 410 },
  { id: "cinema-tv", label: "Cinéma & télévision", target: 422 },
  { id: "sport", label: "Sport & jeux", target: 432 },
  { id: "langue", label: "Langue & expressions", target: 390 },
  { id: "mythologie", label: "Mythologies & religions", target: 310 },
  { id: "gastronomie", label: "Gastronomie & vie quotidienne", target: 300 },
  { id: "societe", label: "Société, politique & économie", target: 275 },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
