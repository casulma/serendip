import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { fakeDb } from "./fakeSqlite";

import type { Pack } from "../src/pack/types";

// A tiny pack instead of the real 6 MB one.
const PACK: Pack = {
  version: "9.9.9",
  facts: Array.from({ length: 15 }, (_, i) => ({
    id: `f${i}`,
    text: `Fait numéro ${i}`,
    category: i < 12 ? "histoire" : "sport",
    source: `https://fr.wikipedia.org/wiki/F${i}`,
    tags: i === 0 ? ["peut-changer"] : [],
    questions: [],
  })),
  trivia: [
    { id: "t1", category: "geographie", family: "capitale", wikidata: "https://www.wikidata.org/wiki/Q142", prompt: "?", answer: { kind: "text", text: "Paris" }, distractors: [], difficulty: 1 },
  ],
};
const tinyPack = { version: PACK.version, load: () => PACK };

const { migrate } = await import("../src/db/schema");
const { importPackIfNeeded, installedPackVersion } = await import("../src/db/importPack");
const repo = await import("../src/db/repo");

let db: SQLiteDatabase;
beforeEach(async () => {
  db = fakeDb();
  await migrate(db);
  await importPackIfNeeded(db, tinyPack);
});

const at = (h: number, day = 27) => new Date(2026, 9, day, h);

describe("migrations and pack import", () => {
  it("imports the pack once and records its version", async () => {
    expect(await installedPackVersion(db)).toBe("9.9.9");
    expect((await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM facts"))!.n).toBe(15);
    let loads = 0;
    await importPackIfNeeded(db, { version: PACK.version, load: () => (loads++, PACK) });
    expect(loads).toBe(0);
    expect((await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM trivia"))!.n).toBe(1);
  });

  it("imports the real bundled pack", async () => {
    const real = fakeDb();
    await migrate(real);
    await importPackIfNeeded(real);
    const n = (await real.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM facts"))!.n;
    expect(n).toBeGreaterThan(10_000);
  });

  it("is idempotent across app launches", async () => {
    await migrate(db);
    expect((await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(1);
  });
});

describe("daily feed", () => {
  it("reveals distinct facts up to the daily quota", async () => {
    await repo.saveSettings(db, { ...repo.DEFAULT_SETTINGS, factsPerDay: 3 });
    const ids = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const r = await repo.revealNextFact(db, at(9 + i));
      expect("fact" in r).toBe(true);
      if ("fact" in r) ids.add(r.fact.id);
    }
    expect(ids.size).toBe(3);
    expect(await repo.revealNextFact(db, at(13))).toEqual({ reason: "quota" });
    expect(await repo.feedRemainingToday(db, at(14))).toBe(0);
    // A new day, a new quota.
    expect("fact" in (await repo.revealNextFact(db, at(8, 28)))).toBe(true);
  });

  it("subtracts notifications from the feed quota", async () => {
    await repo.saveSettings(db, { ...repo.DEFAULT_SETTINGS, factsPerDay: 4, notificationsPerDay: 3 });
    expect("fact" in (await repo.revealNextFact(db, at(9)))).toBe(true);
    expect(await repo.revealNextFact(db, at(10))).toEqual({ reason: "quota" });
  });

  it("only draws from enabled categories and reports exhaustion", async () => {
    await repo.saveSettings(db, { ...repo.DEFAULT_SETTINGS, factsPerDay: 30, categories: ["sport"] });
    const got = [];
    for (let i = 0; i < 4; i++) got.push(await repo.revealNextFact(db, at(9)));
    expect(got.slice(0, 3).every((r) => "fact" in r && r.fact.category === "sport")).toBe(true);
    expect(got[3]).toEqual({ reason: "exhausted" });
  });

  it("sets up Leitner box 1, due the next day", async () => {
    const r = await repo.revealNextFact(db, at(9));
    if (!("fact" in r)) throw new Error("no fact");
    expect(r.fact).toMatchObject({ box: 1, receivedDay: "2026-10-27", dueDay: "2026-10-28", via: "feed", favorite: false, known: false });
  });
});

describe("notebook", () => {
  it("lists received facts, newest first, with favorite and known flags", async () => {
    const a = await repo.revealNextFact(db, at(9));
    const b = await repo.revealNextFact(db, at(10));
    if (!("fact" in a) || !("fact" in b)) throw new Error("no fact");
    await repo.setFavorite(db, a.fact.id, true);
    await repo.setKnown(db, b.fact.id, true);
    const list = await repo.receivedFacts(db);
    expect(list.map((f) => f.id)).toEqual([b.fact.id, a.fact.id]);
    expect(list[1]!.favorite).toBe(true);
    expect(list[0]!.known).toBe(true);
    expect((await repo.lastReceivedFact(db))!.id).toBe(b.fact.id);
    expect(await repo.countReceived(db)).toBe(2);
    await repo.setKnown(db, b.fact.id, false);
    expect((await repo.receivedFact(db, b.fact.id))!.known).toBe(false);
  });
});
