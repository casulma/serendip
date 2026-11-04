import type { SQLiteDatabase } from "expo-sqlite";

// Each entry upgrades the schema by one version. Never edit a shipped entry:
// add a new one, so existing installs keep their data.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

  -- Content from the pack; replaced wholesale when the pack version changes.
  CREATE TABLE questions (
    id TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL,
    difficulty INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX questions_category ON questions(category, difficulty);

  -- User progress, keyed by stable question ids: never touched by imports.
  -- retry = 1: missed last time, comes back with the "à revoir" badge.
  CREATE TABLE progress (
    question_id TEXT PRIMARY KEY NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    successes INTEGER NOT NULL DEFAULT 0,
    retry INTEGER NOT NULL DEFAULT 0,
    last_day TEXT NOT NULL,
    last_at TEXT NOT NULL
  );
  CREATE INDEX progress_retry ON progress(retry, last_day);
  CREATE TABLE answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL,
    category TEXT NOT NULL,
    correct INTEGER NOT NULL,
    hinted INTEGER NOT NULL,
    was_retry INTEGER NOT NULL,
    answered_at TEXT NOT NULL
  );
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]!);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
}
