import type { SQLiteDatabase } from "expo-sqlite";
import type { Pack } from "../pack/types";
import { PACK_VERSION } from "../pack/version.generated";

let bundled: Pack | undefined;
function loadPack(): Pack {
  // Required lazily: only evaluated when an import is actually needed.
  bundled ??= require("../../assets/pack/pack.json") as Pack;
  return bundled;
}

export async function installedPackVersion(db: SQLiteDatabase): Promise<string | undefined> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'pack_version'");
  return row?.value;
}

/**
 * Replace the question table with the bundled pack when its version differs
 * from the installed one. Progress is untouched: questions keep stable ids.
 */
export async function importPackIfNeeded(
  db: SQLiteDatabase,
  { version = PACK_VERSION, load = loadPack }: { version?: string; load?: () => Pack } = {},
): Promise<void> {
  if ((await installedPackVersion(db)) === version) return;
  const pack = load();
  // A pack from before the quiz format (no questions array) imports as empty.
  const questions = Array.isArray(pack.questions) ? pack.questions : [];
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync("DELETE FROM questions;");
    const insert = await txn.prepareAsync("INSERT INTO questions (id, category, difficulty, data) VALUES (?, ?, ?, ?)");
    try {
      for (const q of questions) await insert.executeAsync(q.id, q.category, q.difficulty, JSON.stringify(q));
    } finally {
      await insert.finalizeAsync();
    }
    await txn.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('pack_version', ?)", pack.version);
  });
}
