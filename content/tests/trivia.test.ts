import { describe, expect, it } from "vitest";
import { rng, sample } from "../src/lib/random.js";
import { difficultyScale, pickDistractors } from "../src/trivia/family.js";
import { yearDistractors } from "../src/trivia/families/naissance.js";

describe("rng / sample", () => {
  it("is deterministic per seed", () => {
    expect([rng("a")(), rng("a")()]).toEqual([rng("a")(), rng("a")()]);
    expect(rng("a")()).not.toBe(rng("b")());
    expect(sample([1, 2, 3, 4, 5], 3, "x")).toEqual(sample([1, 2, 3, 4, 5], 3, "x"));
  });

  it("returns distinct items", () => {
    const s = sample([1, 2, 3, 4, 5], 5, "y");
    expect(new Set(s).size).toBe(5);
  });
});

describe("pickDistractors", () => {
  it("never repeats a label nor returns the answer", () => {
    const picks = pickDistractors(["Lyon", "Lyon", "lyon", "Annecy", "Privas", "Valence", "Clermont-Ferrand"], "Clermont-Ferrand", "s");
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.toLowerCase())).size).toBe(3);
    expect(picks).not.toContain("Clermont-Ferrand");
  });

  it("does not depend on pool order", () => {
    expect(pickDistractors(["a", "b", "c", "d"], "z", "s")).toEqual(pickDistractors(["d", "c", "b", "a"], "z", "s"));
  });

  it("returns fewer than three when the pool is too small", () => {
    expect(pickDistractors(["a", "b"], "z", "s")).toHaveLength(2);
  });
});

describe("yearDistractors", () => {
  it("gives three years in the same era, well apart from the answer and each other", () => {
    for (const y of [1802, 5, 2020, 1950]) {
      const d = yearDistractors(y, `t${y}`);
      expect(d).toHaveLength(3);
      const all = [y, ...d];
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) expect(Math.abs(all[i]! - all[j]!)).toBeGreaterThanOrEqual(8);
      for (const x of d) {
        expect(Math.abs(x - y)).toBeLessThanOrEqual(40);
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThanOrEqual(2026);
      }
    }
  });
});

describe("difficultyScale", () => {
  it("splits by thirds of sitelinks, most linked = easiest", () => {
    const d = difficultyScale([300, 200, 100, 90, 80, 70, 10, 5, 1]);
    expect(d(300)).toBe(1);
    expect(d(80)).toBe(2);
    expect(d(1)).toBe(3);
  });
});
