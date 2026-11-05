import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import type { Pack, Question } from "../src/pack/types";
import { fakeDb } from "./fakeSqlite";

const CATS = ["histoire", "geographie", "sciences"] as const;
const QUESTIONS: Question[] = CATS.flatMap((category) =>
  Array.from({ length: 10 }, (_, i) => ({
    id: `${category}-${String(i + 1).padStart(3, "0")}`,
    category,
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    question: `Question ${category} ${i} ?`,
    answer: `Réponse ${i}`,
    accept: [],
    choices: ["A", "B", "C"],
    explanation: "Une explication suffisamment longue pour le test.",
    wikipedia: "Test",
  })),
);
const PACK: Pack = { version: "9.9.9", questions: QUESTIONS };
const tiny = { version: PACK.version, load: () => PACK };

const { migrate } = await import("../src/db/schema");
const { importPackIfNeeded, installedPackVersion } = await import("../src/db/importPack");
const repo = await import("../src/db/repo");

let db: SQLiteDatabase;
beforeEach(async () => {
  db = fakeDb();
  await migrate(db);
  await importPackIfNeeded(db, tiny);
});

const day = (d: number, h = 12) => new Date(2026, 10, d, h);
let s = 7;
const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

describe("pack import", () => {
  it("imports once and records its version", async () => {
    expect(await installedPackVersion(db)).toBe("9.9.9");
    let loads = 0;
    await importPackIfNeeded(db, { version: "9.9.9", load: () => (loads++, PACK) });
    expect(loads).toBe(0);
    expect((await repo.overview(db)).total).toBe(30);
  });

  it("imports the real bundled pack", async () => {
    const real = fakeDb();
    await migrate(real);
    await importPackIfNeeded(real);
    expect((await repo.overview(real)).total).toBeGreaterThanOrEqual(5700);
  });
});

describe("games", () => {
  it("serves unseen questions across categories, within the settings", async () => {
    const game = await repo.newGame(db, day(4), rand);
    expect(game).toHaveLength(10);
    expect(new Set(game.map((q) => q.category)).size).toBe(3);
    expect(game.every((q) => !q.retry)).toBe(true);

    await repo.saveSettings(db, { ...repo.DEFAULT_SETTINGS, categories: ["histoire"], difficulties: [1], sessionSize: 5 });
    const only = await repo.newGame(db, day(4), rand);
    expect(only.every((q) => q.category === "histoire" && q.difficulty === 1)).toBe(true);
    expect(only).toHaveLength(4); // 4 easy history questions in the test pack
  });

  it("brings missed questions back the next day with the retry flag, then clears them", async () => {
    const [first, second] = await repo.newGame(db, day(4), rand);
    await repo.recordAnswer(db, first!, { correct: false, hinted: false }, day(4));
    await repo.recordAnswer(db, second!, { correct: true, hinted: false }, day(4));
    expect((await repo.overview(db)).toReview).toBe(1);

    // Not on the same day…
    expect((await repo.newGame(db, day(4, 18), rand)).some((q) => q.id === first!.id)).toBe(false);
    // …but the next day, flagged.
    const next = await repo.newGame(db, day(5), rand);
    const back = next.find((q) => q.id === first!.id);
    expect(back?.retry).toBe(true);
    expect(next.some((q) => q.id === second!.id)).toBe(false);

    await repo.recordAnswer(db, back!, { correct: true, hinted: false }, day(5));
    expect((await repo.overview(db)).toReview).toBe(0);
    const answers = await db.getAllAsync<{ was_retry: number }>("SELECT was_retry FROM answers ORDER BY id");
    expect(answers.map((a) => a.was_retry)).toEqual([0, 0, 1]);
  });

  it("keeps a question found only with the 4 choices in the review pile", async () => {
    const [q] = await repo.newGame(db, day(4), rand);
    await repo.recordAnswer(db, q!, { correct: true, hinted: true }, day(4));
    expect((await repo.overview(db)).toReview).toBe(1);
    expect((await repo.overview(db)).correct).toBe(1);

    const back = (await repo.newGame(db, day(5), rand)).find((x) => x.id === q!.id);
    expect(back?.retry).toBe(true);
    // Hinted again: still to review. Typed: caught up.
    await repo.recordAnswer(db, back!, { correct: true, hinted: true }, day(5));
    expect((await repo.overview(db)).toReview).toBe(1);
    await repo.recordAnswer(db, back!, { correct: true, hinted: false }, day(6));
    expect((await repo.overview(db)).toReview).toBe(0);
  });

  it("lets the player review mistakes at any time and override a verdict", async () => {
    const [q] = await repo.newGame(db, day(4), rand);
    await repo.recordAnswer(db, q!, { correct: false, hinted: false }, day(4));
    const review = await repo.retryGame(db, rand);
    expect(review.map((x) => x.id)).toEqual([q!.id]);
    expect(review[0]!.retry).toBe(true);

    await repo.overrideAsCorrect(db, q!);
    expect((await repo.overview(db)).toReview).toBe(0);
    expect((await repo.overview(db)).correct).toBe(1);
  });

  it("reports stats per category", async () => {
    const game = await repo.newGame(db, day(4), rand);
    for (const q of game) await repo.recordAnswer(db, q, { correct: q.category === "histoire", hinted: false }, day(4));
    const stats = await repo.statsByCategory(db);
    const h = stats.find((c) => c.category === "histoire")!;
    expect(h.total).toBe(10);
    expect(h.correct).toBe(h.answered);
    expect(stats.reduce((n, c) => n + c.seen, 0)).toBe(10);
  });
});
