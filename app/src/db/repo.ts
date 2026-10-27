import type { SQLiteDatabase } from "expo-sqlite";
import { dayKey, type DayKey } from "../domain/dates";
import { initialState } from "../domain/leitner";
import { DEFAULT_FACTS_PER_DAY, feedRemaining } from "../domain/quota";
import { CATEGORIES, type CategoryId } from "../pack/types";

export type Settings = {
  factsPerDay: number;
  notificationsPerDay: number;
  categories: CategoryId[];
};

export const DEFAULT_SETTINGS: Settings = {
  factsPerDay: DEFAULT_FACTS_PER_DAY,
  notificationsPerDay: 0,
  categories: CATEGORIES.map((c) => c.id),
};

export type FactView = {
  id: string;
  text: string;
  category: CategoryId;
  source: string;
  tags: string[];
  receivedDay: DayKey;
  via: "feed" | "notification";
  favorite: boolean;
  known: boolean;
  box: number;
  dueDay: DayKey;
};

type FactRow = {
  id: string;
  text: string;
  category: CategoryId;
  source: string;
  tags: string;
  received_day: string;
  via: "feed" | "notification";
  favorite: number;
  known: number;
  box: number;
  due_day: string;
};

const SELECT_RECEIVED = `
  SELECT f.id, f.text, f.category, f.source, f.tags, u.received_day, u.via, u.favorite, u.known, u.box, u.due_day
  FROM user_facts u JOIN facts f ON f.id = u.fact_id`;

const toView = (r: FactRow): FactView => ({
  id: r.id,
  text: r.text,
  category: r.category,
  source: r.source,
  tags: JSON.parse(r.tags) as string[],
  receivedDay: r.received_day,
  via: r.via,
  favorite: r.favorite === 1,
  known: r.known === 1,
  box: r.box,
  dueDay: r.due_day,
});

// ---------------------------------------------------------------- settings

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'settings'");
  return row ? { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<Settings>) } : DEFAULT_SETTINGS;
}

export async function saveSettings(db: SQLiteDatabase, settings: Settings): Promise<void> {
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('settings', ?)", JSON.stringify(settings));
}

// ---------------------------------------------------------------- daily feed

export async function feedCountOn(db: SQLiteDatabase, day: DayKey): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM user_facts WHERE received_day = ? AND via = 'feed'",
    day,
  );
  return row?.n ?? 0;
}

/** Facts received on a given day (feed and notifications), oldest first. */
export async function factsReceivedOn(db: SQLiteDatabase, day: DayKey): Promise<FactView[]> {
  const rows = await db.getAllAsync<FactRow>(`${SELECT_RECEIVED} WHERE u.received_day = ? ORDER BY u.received_at`, day);
  return rows.map(toView);
}

export async function feedRemainingToday(db: SQLiteDatabase, now = new Date()): Promise<number> {
  const s = await getSettings(db);
  return feedRemaining(s.factsPerDay, s.notificationsPerDay, await feedCountOn(db, dayKey(now)));
}

export type RevealResult = { fact: FactView } | { reason: "quota" | "exhausted" };

/**
 * Reveal one new fact in the feed: random, never seen before, from the enabled
 * categories, within today's quota. Checked and written in one transaction so
 * that two quick scrolls cannot exceed the quota.
 */
export async function revealNextFact(db: SQLiteDatabase, now = new Date()): Promise<RevealResult> {
  const today = dayKey(now);
  let result: RevealResult = { reason: "quota" };
  await db.withExclusiveTransactionAsync(async (txn) => {
    const s = await getSettings(txn);
    if (feedRemaining(s.factsPerDay, s.notificationsPerDay, await feedCountOn(txn, today)) <= 0) return;
    const placeholders = s.categories.map(() => "?").join(", ");
    const pick = await txn.getFirstAsync<{ id: string }>(
      `SELECT id FROM facts
       WHERE category IN (${placeholders}) AND id NOT IN (SELECT fact_id FROM user_facts)
       ORDER BY random() LIMIT 1`,
      ...s.categories,
    );
    if (!pick) {
      result = { reason: "exhausted" };
      return;
    }
    const review = initialState(today);
    await txn.runAsync(
      "INSERT INTO user_facts (fact_id, received_at, received_day, via, box, due_day) VALUES (?, ?, ?, 'feed', ?, ?)",
      pick.id,
      now.toISOString(),
      today,
      review.box,
      review.dueDay,
    );
    const row = await txn.getFirstAsync<FactRow>(`${SELECT_RECEIVED} WHERE u.fact_id = ?`, pick.id);
    result = { fact: toView(row!) };
  });
  return result;
}

// ---------------------------------------------------------------- notebook

export async function lastReceivedFact(db: SQLiteDatabase): Promise<FactView | undefined> {
  const row = await db.getFirstAsync<FactRow>(`${SELECT_RECEIVED} ORDER BY u.received_at DESC LIMIT 1`);
  return row ? toView(row) : undefined;
}

export async function receivedFacts(db: SQLiteDatabase): Promise<FactView[]> {
  const rows = await db.getAllAsync<FactRow>(`${SELECT_RECEIVED} ORDER BY u.received_at DESC`);
  return rows.map(toView);
}

export async function receivedFact(db: SQLiteDatabase, id: string): Promise<FactView | undefined> {
  const row = await db.getFirstAsync<FactRow>(`${SELECT_RECEIVED} WHERE u.fact_id = ?`, id);
  return row ? toView(row) : undefined;
}

export async function countReceived(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM user_facts");
  return row?.n ?? 0;
}

export async function setFavorite(db: SQLiteDatabase, id: string, favorite: boolean): Promise<void> {
  await db.runAsync("UPDATE user_facts SET favorite = ? WHERE fact_id = ?", favorite ? 1 : 0, id);
}

/** "Je le savais déjà": the fact leaves the review queue (reversible). */
export async function setKnown(db: SQLiteDatabase, id: string, known: boolean): Promise<void> {
  await db.runAsync("UPDATE user_facts SET known = ? WHERE fact_id = ?", known ? 1 : 0, id);
}
