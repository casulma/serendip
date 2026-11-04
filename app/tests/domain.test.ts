import { describe, expect, it } from "vitest";
import { addDays, dayKey, formatDay } from "../src/domain/dates";
import { acceptedForms, canonical, checkAnswer, editDistance } from "../src/domain/answer";
import { composeGame, points, roundRobin } from "../src/domain/session";

describe("dates", () => {
  it("uses local calendar days", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(formatDay("2026-11-01")).toBe("1er novembre 2026");
  });
});

describe("checkAnswer", () => {
  it("ignores case, accents, articles and punctuation", () => {
    expect(checkAnswer("la joconde", "La Joconde")).toEqual({ correct: true, exact: true });
    expect(checkAnswer("Pérou", "Perou").correct).toBe(true);
    expect(checkAnswer("l'Ornithorynque", "ornithorynque").exact).toBe(true);
    expect(checkAnswer("  Œdipe ! ", "Oedipe").exact).toBe(true);
  });

  it("tolerates small typos on long words only", () => {
    expect(checkAnswer("Toutankamon", "Toutânkhamon")).toEqual({ correct: true, exact: false });
    expect(checkAnswer("Canbera", "Canberra").correct).toBe(true);
    expect(checkAnswer("Ra", "Râ").correct).toBe(true);
    expect(checkAnswer("Rome", "Lima").correct).toBe(false);
    expect(checkAnswer("or", "os").correct).toBe(false);
  });

  it("is strict on numbers but reads number words", () => {
    expect(checkAnswer("1798", "1789").correct).toBe(false);
    expect(checkAnswer("trois", "3").correct).toBe(true);
    expect(checkAnswer("3", "Trois").correct).toBe(true);
  });

  it("accepts a surname alone and listed variants", () => {
    expect(checkAnswer("Einstein", "Albert Einstein").correct).toBe(true);
    expect(checkAnswer("USA", "États-Unis", ["USA", "Etats-Unis d'Amérique"]).correct).toBe(true);
    expect(acceptedForms("ornithorynque", [])).toEqual(["ornithorynque"]);
    expect(checkAnswer("Louis", "Louis XIV").correct).toBe(false);
  });

  it("rejects empty input", () => {
    expect(checkAnswer("   ", "Paris").correct).toBe(false);
  });

  it("computes edit distances with adjacent swaps", () => {
    expect(editDistance("abcd", "abdc")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(canonical("Les Misérables (roman)")).toBe("miserables");
  });
});

describe("game composition", () => {
  const seq = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const mk = (n: number, cat: string, p: string) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, category: cat }));

  it("alternates categories", () => {
    const picked = roundRobin([...mk(10, "a", "a"), ...mk(10, "b", "b"), ...mk(1, "c", "c")], 5, seq(1));
    const cats = picked.map((p) => p.category);
    expect(new Set(cats.slice(0, 3)).size).toBe(3);
  });

  it("keeps retries to 30 % and fills with fresh then replayed questions", () => {
    const game = composeGame({ retries: mk(8, "a", "r"), fresh: mk(20, "b", "f"), replay: [] }, 10, seq(2));
    expect(game).toHaveLength(10);
    expect(game.filter((id) => id.startsWith("r"))).toHaveLength(3);
    const short = composeGame({ retries: [], fresh: mk(2, "b", "f"), replay: mk(5, "c", "p") }, 5, seq(3));
    expect(short.sort()).toEqual(["f0", "f1", "p0", "p1", "p2"]);
  });

  it("scores typed answers above hinted ones", () => {
    expect([points(true, false), points(true, true), points(false, false)]).toEqual([2, 1, 0]);
  });
});
