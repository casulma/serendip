import type { SQLiteDatabase } from "expo-sqlite";

// Each entry upgrades the schema by one version. Never edit a shipped entry:
// add a new one, so existing installs keep their data.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

  -- Content from the pack; replaced wholesale when the pack version changes.
  CREATE TABLE facts (
    id TEXT PRIMARY KEY NOT NULL,
    text TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT NOT NULL,
    published_on TEXT,
    tags TEXT NOT NULL,
    question TEXT
  );
  CREATE INDEX facts_category ON facts(category);
  CREATE TABLE trivia (
    id TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL,
    family TEXT NOT NULL,
    wikidata TEXT NOT NULL,
    question TEXT NOT NULL
  );

  -- User data: never touched by pack imports.
  CREATE TABLE user_facts (
    fact_id TEXT PRIMARY KEY NOT NULL,
    received_at TEXT NOT NULL,
    received_day TEXT NOT NULL,
    via TEXT NOT NULL CHECK (via IN ('feed', 'notification')),
    favorite INTEGER NOT NULL DEFAULT 0,
    known INTEGER NOT NULL DEFAULT 0,
    box INTEGER NOT NULL DEFAULT 1,
    due_day TEXT NOT NULL
  );
  CREATE INDEX user_facts_day ON user_facts(received_day);
  CREATE TABLE answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL CHECK (mode IN ('revision', 'aleatoire')),
    item_id TEXT NOT NULL,
    category TEXT NOT NULL,
    correct INTEGER NOT NULL,
    answered_at TEXT NOT NULL
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
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
