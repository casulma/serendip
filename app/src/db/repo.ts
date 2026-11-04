import type { SQLiteDatabase } from "expo-sqlite";
import { dayKey } from "../domain/dates";
import { composeGame, DEFAULT_SESSION_SIZE, shuffle, type Candidate } from "../domain/session";
import { CATEGORY_IDS, type CategoryId, type Difficulty, type Question } from "../pack/types";

// ---------------------------------------------------------------- settings

export type Settings = {
  categories: CategoryId[];
  difficulties: Difficulty[];
  sessionSize: number;
};

export const DEFAULT_SETTINGS: Settings = {
  categories: [...CATEGORY_IDS],
  difficulties: [1, 2, 3],
  sessionSize: DEFAULT_SESSION_SIZE,
};

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'settings'");
  return row ? { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<Settings>) } : DEFAULT_SETTINGS;
}

export async function saveSettings(db: SQLiteDatabase, s: Settings): Promise<void> {
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('settings', ?)", JSON.stringify(s));
}

// ---------------------------------------------------------------- games

/** A question in a game, flagged when it comes back after a miss. */
export type GameQuestion = Question & { retry: boolean };

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

function filterSql(s: Settings) {
  return {
    sql: `q.category IN (${placeholders(s.categories.length)}) AND q.difficulty IN (${placeholders(s.difficulties.length)})`,
    params: [...s.categories, ...s.difficulties],
  };
}

async function load(db: SQLiteDatabase, ids: string[]): Promise<GameQuestion[]> {
  if (ids.length === 0) return [];
  const rows = await db.getAllAsync<{ id: string; data: string; retry: number | null }>(
    `SELECT q.id, q.data, p.retry FROM questions q LEFT JOIN progress p ON p.question_id = q.id WHERE q.id IN (${placeholders(ids.length)})`,
    ...ids,
  );
  const byId = new Map(rows.map((r) => [r.id, { ...(JSON.parse(r.data) as Question), retry: r.retry === 1 }]));
  return ids.map((id) => byId.get(id)).filter((q): q is GameQuestion => q !== undefined);
}

/**
 * A new game: questions missed before (from a previous day) come back, mixed
 * with never-seen ones from the enabled categories and levels.
 */
export async function newGame(db: SQLiteDatabase, now = new Date(), random: () => number = Math.random): Promise<GameQuestion[]> {
  const s = await getSettings(db);
  const f = filterSql(s);
  const today = dayKey(now);
  const retries = await db.getAllAsync<Candidate>(
    `SELECT q.id, q.category FROM questions q JOIN progress p ON p.question_id = q.id
     WHERE p.retry = 1 AND p.last_day < ? AND ${f.sql}`,
    today,
    ...f.params,
  );
  const fresh = await db.getAllAsync<Candidate>(
    `SELECT q.id, q.category FROM questions q WHERE ${f.sql} AND q.id NOT IN (SELECT question_id FROM progress)`,
    ...f.params,
  );
  // When everything has been seen: replay questions answered right, oldest first.
  const replay = await db.getAllAsync<Candidate>(
    `SELECT q.id, q.category FROM questions q JOIN progress p ON p.question_id = q.id
     WHERE p.retry = 0 AND ${f.sql} ORDER BY p.last_at LIMIT ?`,
    ...f.params,
    s.sessionSize,
  );
  return load(db, composeGame({ retries, fresh, replay }, s.sessionSize, random));
}

/** Only the questions to review, whatever the day they were missed. */
export async function retryGame(db: SQLiteDatabase, random: () => number = Math.random): Promise<GameQuestion[]> {
  const s = await getSettings(db);
  const rows = await db.getAllAsync<{ id: string }>("SELECT question_id AS id FROM progress WHERE retry = 1 ORDER BY last_at");
  return load(db, shuffle(rows.map((r) => r.id), random).slice(0, s.sessionSize));
}

/**
 * Record an answer. A miss, or a success found only with the 4 choices, puts the
 * question in the "à revoir" pile; a typed success takes it out.
 */
export async function recordAnswer(
  db: SQLiteDatabase,
  q: GameQuestion,
  { correct, hinted }: { correct: boolean; hinted: boolean },
  now = new Date(),
): Promise<void> {
  const at = now.toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO progress (question_id, attempts, successes, retry, last_day, last_at) VALUES (?, 1, ?, ?, ?, ?)
       ON CONFLICT(question_id) DO UPDATE SET
         attempts = attempts + 1, successes = successes + excluded.successes,
         retry = excluded.retry, last_day = excluded.last_day, last_at = excluded.last_at`,
      q.id,
      correct ? 1 : 0,
      correct && !hinted ? 0 : 1,
      dayKey(now),
      at,
    );
    await txn.runAsync(
      "INSERT INTO answers (question_id, category, correct, hinted, was_retry, answered_at) VALUES (?, ?, ?, ?, ?, ?)",
      q.id,
      q.category,
      correct ? 1 : 0,
      hinted ? 1 : 0,
      q.retry ? 1 : 0,
      at,
    );
  });
}

/** Correct a verdict: the player says the typed answer was in fact right. */
export async function overrideAsCorrect(db: SQLiteDatabase, q: GameQuestion): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync("UPDATE progress SET successes = successes + 1, retry = 0 WHERE question_id = ?", q.id);
    await txn.runAsync(
      "UPDATE answers SET correct = 1 WHERE id = (SELECT MAX(id) FROM answers WHERE question_id = ?)",
      q.id,
    );
  });
}

// ---------------------------------------------------------------- stats

export type Overview = { total: number; seen: number; toReview: number; answered: number; correct: number };

export async function overview(db: SQLiteDatabase): Promise<Overview> {
  const r = await db.getFirstAsync<Overview>(
    `SELECT
       (SELECT COUNT(*) FROM questions) AS total,
       (SELECT COUNT(*) FROM progress p JOIN questions q ON q.id = p.question_id) AS seen,
       (SELECT COUNT(*) FROM progress p JOIN questions q ON q.id = p.question_id WHERE p.retry = 1) AS toReview,
       (SELECT COUNT(*) FROM answers) AS answered,
       (SELECT COUNT(*) FROM answers WHERE correct = 1) AS correct`,
  );
  return r ?? { total: 0, seen: 0, toReview: 0, answered: 0, correct: 0 };
}

export type CategoryStats = { category: CategoryId; total: number; seen: number; answered: number; correct: number };

export async function statsByCategory(db: SQLiteDatabase): Promise<CategoryStats[]> {
  return db.getAllAsync<CategoryStats>(
    `SELECT q.category AS category, COUNT(*) AS total, COUNT(p.question_id) AS seen,
       COALESCE((SELECT COUNT(*) FROM answers a WHERE a.category = q.category), 0) AS answered,
       COALESCE((SELECT COUNT(*) FROM answers a WHERE a.category = q.category AND a.correct = 1), 0) AS correct
     FROM questions q LEFT JOIN progress p ON p.question_id = q.id
     GROUP BY q.category ORDER BY q.category`,
  );
}

export async function countAvailable(db: SQLiteDatabase): Promise<number> {
  const s = await getSettings(db);
  const f = filterSql(s);
  const r = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM questions q WHERE ${f.sql}`, ...f.params);
  return r?.n ?? 0;
}
