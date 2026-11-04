// Mirror of content/src/schema.ts and content/src/categories.ts.

export const CATEGORIES = [
  { id: "histoire", label: "Histoire", glyph: "🏛" },
  { id: "geographie", label: "Géographie", glyph: "🌍" },
  { id: "sciences", label: "Sciences & techniques", glyph: "🔬" },
  { id: "nature", label: "Nature & animaux", glyph: "🌿" },
  { id: "arts-litterature", label: "Arts & littérature", glyph: "🎨" },
  { id: "musique", label: "Musique", glyph: "🎵" },
  { id: "cinema-tv", label: "Cinéma & télévision", glyph: "🎬" },
  { id: "sport", label: "Sport & jeux", glyph: "⚽" },
  { id: "langue", label: "Langue & expressions", glyph: "✒" },
  { id: "mythologie", label: "Mythologies & religions", glyph: "⚡" },
  { id: "gastronomie", label: "Gastronomie & vie quotidienne", glyph: "🧀" },
  { id: "societe", label: "Société, politique & économie", glyph: "⚖" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const category = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

export type Difficulty = 1 | 2 | 3;
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { 1: "Facile", 2: "Moyen", 3: "Expert" };

export type Question = {
  id: string;
  category: CategoryId;
  difficulty: Difficulty;
  question: string;
  answer: string;
  accept: string[];
  choices: string[];
  explanation: string;
  wikipedia: string;
};

export type Pack = { version: string; questions: Question[] };
