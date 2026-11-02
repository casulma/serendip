import type { SQLiteDatabase } from "expo-sqlite";
import { dayKey, type DayKey } from "../domain/dates";
import { initialState, review, type Box, type ReviewState } from "../domain/leitner";
import { interleave } from "../domain/quiz";
import { DEFAULT_FACTS_PER_DAY, feedRemaining } from "../domain/quota";
import { CATEGORIES, type CategoryId, type Credit, type Origin, type Question } from "../pack/types";

export type Settings = {
  factsPerDay: number;
  notificationsPerDay: number;
  categories: CategoryId[];
  /** Wikipédia « Le saviez-vous ? » anecdotes, more cryptic: opt-in. */
  wikipediaAnecdotes: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  factsPerDay: DEFAULT_FACTS_PER_DAY,
  notificationsPerDay: 0,
  categories: CATEGORIES.map((c) => c.id),
  wikipediaAnecdotes: false,
};

export const enabledOrigins = (s: Settings): Origin[] => (s.wikipediaAnecdotes ? ["oqdb", "lsv"] : ["oqdb"]);

export type FactView = {
  id: string;
  origin: Origin;
  credit?: Credit;
  /** For OpenQuizzDB facts, the question the fact answers (shown first, answer hidden). */
  question?: Question;
  text: string;
  category: CategoryId;
  source: string;
  tags: string[];
  receivedDay: DayKey;
  via: "feed" | "notification";
  favorite: boolean;
  known: boolean;
  unclear: boolean;
  box: number;
  dueDay: DayKey;
};

type FactRow = {
  id: string;
  origin: Origin;
  credit: string | null;
  question: string | null;
  text: string;
  category: CategoryId;
  source: string;
  tags: string;
  received_day: string;
  via: "feed" | "notification";
  favorite: number;
  known: number;
  unclear_at: string | null;
  box: number;
  due_day: string;
};

const SELECT_RECEIVED = `
  SELECT f.id, f.origin, f.credit, f.question, f.text, f.category, f.source, f.tags, u.received_day, u.via, u.favorite, u.known, u.unclear_at, u.box, u.due_day
  FROM user_facts u JOIN facts f ON f.id = u.fact_id`;

const toView = (r: FactRow): FactView => ({
  id: r.id,
  origin: r.origin,
  credit: r.credit ? (JSON.parse(r.credit) as Credit) : undefined,
  // Wikipédia facts carry a generated cloze question for reviews, not for display.
  question: r.origin === "oqdb" && r.question ? (JSON.parse(r.question) as Question) : undefined,
  text: r.text,
  category: r.category,
  source: r.source,
  tags: JSON.parse(r.tags) as string[],
  receivedDay: r.received_day,
  via: r.via,
  favorite: r.favorite === 1,
  known: r.known === 1,
  unclear: r.unclear_at !== null,
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
    // Facts flagged "pas clair" are replaced for free: they do not use up the quota.
    "SELECT COUNT(*) AS n FROM user_facts WHERE received_day = ? AND via = 'feed' AND unclear_at IS NULL",
    day,
  );
  return row?.n ?? 0;
}

/** Facts received on a given day (feed and notifications), oldest first, without flagged ones. */
export async function factsReceivedOn(db: SQLiteDatabase, day: DayKey): Promise<FactView[]> {
  const rows = await db.getAllAsync<FactRow>(
    `${SELECT_RECEIVED} WHERE u.received_day = ? AND u.unclear_at IS NULL ORDER BY u.received_at`,
    day,
  );
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
    const origins = enabledOrigins(s);
    const pick = await txn.getFirstAsync<{ id: string }>(
      `SELECT id FROM facts
       WHERE category IN (${s.categories.map(() => "?").join(", ")})
         AND origin IN (${origins.map(() => "?").join(", ")})
         AND id NOT IN (SELECT fact_id FROM user_facts)
       ORDER BY random() LIMIT 1`,
      ...s.categories,
      ...origins,
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
  const row = await db.getFirstAsync<FactRow>(`${SELECT_RECEIVED} WHERE u.unclear_at IS NULL ORDER BY u.received_at DESC LIMIT 1`);
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

/** "Pas clair": flag (or unflag) a fact. Flagged facts leave reviews and the daily quota. */
export async function setUnclear(db: SQLiteDatabase, id: string, unclear: boolean, now = new Date()): Promise<void> {
  await db.runAsync("UPDATE user_facts SET unclear_at = ? WHERE fact_id = ?", unclear ? now.toISOString() : null, id);
}

export type UnclearExport = { app: "serendip"; kind: "faits-pas-clairs"; exportedAt: string; facts: { id: string; flaggedAt: string; text: string; source: string }[] };

/** Flagged facts, in a form the content pipeline can read back (content/mappings/exclusions.json). */
export async function exportUnclear(db: SQLiteDatabase, now = new Date()): Promise<UnclearExport> {
  const rows = await db.getAllAsync<{ id: string; unclear_at: string; text: string; source: string }>(
    "SELECT f.id, u.unclear_at, f.text, f.source FROM user_facts u JOIN facts f ON f.id = u.fact_id WHERE u.unclear_at IS NOT NULL ORDER BY u.unclear_at",
  );
  return {
    app: "serendip",
    kind: "faits-pas-clairs",
    exportedAt: now.toISOString(),
    facts: rows.map((r) => ({ id: r.id, flaggedAt: r.unclear_at, text: r.text, source: r.source })),
  };
}

export async function countUnclear(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM user_facts WHERE unclear_at IS NOT NULL");
  return row?.n ?? 0;
}

// ---------------------------------------------------------------- quizzes

export const REVIEW_SESSION_SIZE = 20;
export const RANDOM_SESSION_SIZE = 10;

/** A fact due for review, with the question to ask (a flashcard when it has none). */
export type ReviewItem = { fact: FactView; question?: Question };

const REVIEWABLE = "u.known = 0 AND u.unclear_at IS NULL AND u.due_day <= ?";

export async function countDueReviews(db: SQLiteDatabase, now = new Date()): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM user_facts u WHERE ${REVIEWABLE}`, dayKey(now));
  return row?.n ?? 0;
}

/** Facts whose Leitner due day has come, most overdue first. */
export async function dueReviews(db: SQLiteDatabase, now = new Date(), limit = REVIEW_SESSION_SIZE): Promise<ReviewItem[]> {
  const rows = await db.getAllAsync<FactRow>(
    `${SELECT_RECEIVED} WHERE ${REVIEWABLE} ORDER BY u.due_day, u.received_at LIMIT ?`,
    dayKey(now),
    limit,
  );
  return rows.map((r) => ({ fact: toView(r), question: r.question ? (JSON.parse(r.question) as Question) : undefined }));
}

/** Record a review answer and move the fact between Leitner boxes. */
export async function answerReview(db: SQLiteDatabase, factId: string, success: boolean, now = new Date()): Promise<ReviewState> {
  const today = dayKey(now);
  let next: ReviewState = initialState(today);
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<{ box: number; due_day: string; category: string }>(
      "SELECT u.box, u.due_day, f.category FROM user_facts u JOIN facts f ON f.id = u.fact_id WHERE u.fact_id = ?",
      factId,
    );
    if (!row) return;
    next = review({ box: row.box as Box, dueDay: row.due_day }, success, today);
    await txn.runAsync("UPDATE user_facts SET box = ?, due_day = ? WHERE fact_id = ?", next.box, next.dueDay, factId);
    await txn.runAsync(
      "INSERT INTO answers (mode, item_id, category, correct, answered_at) VALUES ('revision', ?, ?, ?, ?)",
      factId,
      row.category,
      success ? 1 : 0,
      now.toISOString(),
    );
  });
  return next;
}

export type TriviaItem = { id: string; category: CategoryId; family: string; wikidata: string; question: Question };

// Per-family limits for a random session. Birth years are hard even with spaced
// choices: one per session, famous people only. Authors: not the most obscure.
const FAMILY_RULES: Record<string, { max: number; maxDifficulty: number }> = {
  naissance: { max: 1, maxDifficulty: 1 },
  auteur: { max: 2, maxDifficulty: 2 },
};

/**
 * A varied random session: families taken in turn (capitals, flags, areas…),
 * within the enabled categories, never-answered questions first.
 */
export async function randomTrivia(db: SQLiteDatabase, n = RANDOM_SESSION_SIZE, random: () => number = Math.random): Promise<TriviaItem[]> {
  const s = await getSettings(db);
  const families = (await db.getAllAsync<{ family: string }>("SELECT DISTINCT family FROM trivia ORDER BY family")).map((r) => r.family);
  const groups: TriviaItem[][] = [];
  for (const family of families) {
    const rule = FAMILY_RULES[family] ?? { max: n, maxDifficulty: 3 };
    const rows = await db.getAllAsync<{ id: string; category: CategoryId; family: string; wikidata: string; question: string }>(
      `SELECT id, category, family, wikidata, question FROM trivia
       WHERE family = ? AND category IN (${s.categories.map(() => "?").join(", ")})
         AND json_extract(question, '$.difficulty') <= ?
       ORDER BY id IN (SELECT item_id FROM answers WHERE mode = 'aleatoire'), random()
       LIMIT ?`,
      family,
      ...s.categories,
      rule.maxDifficulty,
      rule.max,
    );
    if (rows.length > 0) groups.push(rows.map((r) => ({ ...r, question: JSON.parse(r.question) as Question })));
  }
  // Shuffle family order so sessions do not always open with the same family.
  for (let i = groups.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [groups[i], groups[j]] = [groups[j]!, groups[i]!];
  }
  return interleave(groups, n);
}

export async function answerTrivia(db: SQLiteDatabase, item: TriviaItem, correct: boolean, now = new Date()): Promise<void> {
  await db.runAsync(
    "INSERT INTO answers (mode, item_id, category, correct, answered_at) VALUES ('aleatoire', ?, ?, ?, ?)",
    item.id,
    item.category,
    correct ? 1 : 0,
    now.toISOString(),
  );
}
