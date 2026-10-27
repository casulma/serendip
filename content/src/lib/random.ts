import { createHash } from "node:crypto";

/** mulberry32 seeded from a string: same seed, same sequence, on every run. */
export function rng(seed: string): () => number {
  let a = createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick `n` distinct items, deterministically for a given seed. */
export function sample<T>(items: readonly T[], n: number, seed: string): T[] {
  const r = rng(seed);
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(r() * pool.length);
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}
