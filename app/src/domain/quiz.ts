import type { Choice, Question } from "../pack/types";

export type QuizChoice = Choice & { correct: boolean };

/** The 4 choices of a question, shuffled (Fisher–Yates). */
export function shuffledChoices(q: Question, random: () => number = Math.random): QuizChoice[] {
  const all: QuizChoice[] = [{ ...q.answer, correct: true }, ...q.distractors.map((d) => ({ ...d, correct: false }))];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all;
}

export const choiceLabel = (c: Choice) => (c.kind === "text" ? c.text : c.alt);

export type SessionResult = { total: number; correct: number };

export function scoreMessage({ total, correct }: SessionResult): string {
  if (total === 0) return "";
  const r = correct / total;
  return r === 1 ? "Sans faute !" : r >= 0.7 ? "Très bien." : r >= 0.4 ? "Pas mal, on continue." : "On révisera ça.";
}

/**
 * Round-robin over groups (one item from each in turn) until `n` items:
 * keeps a session varied whatever the size of each group.
 */
export function interleave<T>(groups: T[][], n: number): T[] {
  const out: T[] = [];
  for (let round = 0; out.length < n; round++) {
    let took = false;
    for (const g of groups) {
      if (round < g.length && out.length < n) {
        out.push(g[round]!);
        took = true;
      }
    }
    if (!took) break;
  }
  return out;
}
