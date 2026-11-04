// The 12 question categories, with the share of the question bank each should hold.
export const CATEGORIES = [
  { id: "histoire", label: "Histoire", target: 600 },
  { id: "geographie", label: "Géographie", target: 600 },
  { id: "sciences", label: "Sciences & techniques", target: 550 },
  { id: "nature", label: "Nature & animaux", target: 450 },
  { id: "arts-litterature", label: "Arts & littérature", target: 500 },
  { id: "musique", label: "Musique", target: 350 },
  { id: "cinema-tv", label: "Cinéma & télévision", target: 400 },
  { id: "sport", label: "Sport & jeux", target: 400 },
  { id: "langue", label: "Langue & expressions", target: 350 },
  { id: "mythologie", label: "Mythologies & religions", target: 250 },
  { id: "gastronomie", label: "Gastronomie & vie quotidienne", target: 300 },
  { id: "societe", label: "Société, politique & économie", target: 250 },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
