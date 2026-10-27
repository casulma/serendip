// Mirror of content/src/schema.ts (the pack is validated there, at build time).

export type CategoryId =
  | "histoire"
  | "geographie"
  | "sciences"
  | "nature"
  | "arts-litterature"
  | "musique-cinema"
  | "sport"
  | "societe-politique"
  | "langue"
  | "divers";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
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
];

export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export type Choice = { kind: "text"; text: string } | { kind: "image"; image: string; alt: string };

export type Question = {
  id: string;
  prompt: string;
  promptImage?: string;
  answer: Choice;
  distractors: Choice[];
  difficulty: 1 | 2 | 3;
};

export type Fact = {
  id: string;
  text: string;
  category: CategoryId;
  source: string;
  publishedOn?: string;
  tags: string[];
  questions: Question[];
};

export type Trivia = Question & { category: CategoryId; family: string; wikidata: string };

export type Pack = { version: string; facts: Fact[]; trivia: Trivia[] };
