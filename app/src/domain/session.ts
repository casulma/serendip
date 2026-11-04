// Composing a game: a few questions to retry (missed before) mixed with new
// ones, categories taken in turn so that a game always feels varied.

export const SESSION_SIZES = [5, 10, 20] as const;
export const DEFAULT_SESSION_SIZE = 10;
/** Share of a game given to questions missed in earlier games. */
export const RETRY_SHARE = 0.3;

export type Candidate = { id: string; category: string };

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** One item per category in turn, categories in random order, until n items. */
export function roundRobin<T extends Candidate>(items: T[], n: number, random: () => number = Math.random): T[] {
  const byCategory = new Map<string, T[]>();
  for (const it of shuffle(items, random)) byCategory.set(it.category, [...(byCategory.get(it.category) ?? []), it]);
  const queues = shuffle([...byCategory.values()], random);
  const out: T[] = [];
  for (let round = 0; out.length < n; round++) {
    let took = false;
    for (const q of queues) {
      if (round < q.length && out.length < n) {
        out.push(q[round]!);
        took = true;
      }
    }
    if (!took) break;
  }
  return out;
}

/**
 * The ids of a game: up to 30 % retries, then fresh questions, then (when
 * fresh ones run out) questions already answered right, oldest first.
 */
export function composeGame(
  { retries, fresh, replay }: { retries: Candidate[]; fresh: Candidate[]; replay: Candidate[] },
  size: number,
  random: () => number = Math.random,
): string[] {
  const retryCount = Math.min(retries.length, Math.ceil(size * RETRY_SHARE));
  const picked = roundRobin(retries, retryCount, random);
  picked.push(...roundRobin(fresh, size - picked.length, random));
  if (picked.length < size) picked.push(...replay.slice(0, size - picked.length));
  return shuffle(picked, random).map((c) => c.id);
}

/** Points: 2 for a typed answer, 1 when the choices were shown, 0 otherwise. */
export const points = (correct: boolean, hinted: boolean) => (correct ? (hinted ? 1 : 2) : 0);

export function scoreMessage(score: number, max: number): string {
  if (max === 0) return "";
  const r = score / max;
  return r === 1 ? "Sans faute, champion !" : r >= 0.75 ? "Superbe partie." : r >= 0.5 ? "Belle partie." : r >= 0.25 ? "Pas mal, on continue." : "Les erreurs reviendront : c'est comme ça qu'on apprend.";
}
