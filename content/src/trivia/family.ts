import { sample } from "../lib/random.js";
import type { CategoryId } from "../categories.js";
import type { Trivia } from "../schema.js";

export type Rejection = { id: string; reason: string };

export type FamilyResult = { items: Trivia[]; rejected: Rejection[] };

/** A family = one SPARQL query + one prompt template + one distractor rule. */
export type Family = {
  id: string;
  label: string;
  category: CategoryId;
  build(): Promise<FamilyResult>;
};

/**
 * Difficulty from Wikidata sitelink counts (a popularity proxy): the most
 * linked third of the family is easy (1), the least linked third hard (3).
 */
export function difficultyScale(sitelinks: number[]): (n: number) => 1 | 2 | 3 {
  const sorted = [...sitelinks].sort((a, b) => b - a);
  const hi = sorted[Math.floor(sorted.length / 3)] ?? 0;
  const lo = sorted[Math.floor((2 * sorted.length) / 3)] ?? 0;
  return (n) => (n >= hi ? 1 : n >= lo ? 2 : 3);
}

export const text = (t: string) => ({ kind: "text" as const, text: t });

/** Group SPARQL rows by a key, preserving first-seen order. */
export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k);
    if (g) g.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export const distinct = <T>(xs: (T | undefined)[]) => [...new Set(xs.filter((x): x is T => x !== undefined && x !== ""))];

/**
 * Three distinct distractor labels, none equal to the answer (case-insensitive).
 * Returns fewer than three when the pool is too small: callers must reject then.
 */
export function pickDistractors(pool: string[], answer: string, seed: string): string[] {
  const norm = (s: string) => s.toLocaleLowerCase("fr");
  const seen = new Set([norm(answer)]);
  const unique: string[] = [];
  for (const p of [...pool].sort()) {
    if (!seen.has(norm(p))) {
      seen.add(norm(p));
      unique.push(p);
    }
  }
  return sample(unique, 3, seed);
}
