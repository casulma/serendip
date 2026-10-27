import type { SQLiteDatabase } from "expo-sqlite";
import type { Pack } from "../pack/types";
import { PACK_VERSION } from "../pack/version.generated";

let bundled: Pack | undefined;
function loadPack(): Pack {
  // Required lazily: the 6 MB module is only evaluated when an import is needed.
  bundled ??= require("../../assets/pack/pack.json") as Pack;
  return bundled;
}

export async function installedPackVersion(db: SQLiteDatabase): Promise<string | undefined> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'pack_version'");
  return row?.value;
}

/**
 * Replace content tables with the bundled pack when its version differs from
 * the installed one. User tables are untouched: facts are referenced by stable ids.
 */
export async function importPackIfNeeded(
  db: SQLiteDatabase,
  { version = PACK_VERSION, load = loadPack }: { version?: string; load?: () => Pack } = {},
): Promise<void> {
  if ((await installedPackVersion(db)) === version) return;
  const pack = load();

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync("DELETE FROM facts; DELETE FROM trivia;");
    const insertFact = await txn.prepareAsync(
      "INSERT INTO facts (id, text, category, source, published_on, tags, question) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    try {
      for (const f of pack.facts) {
        const q = f.questions[0];
        await insertFact.executeAsync(f.id, f.text, f.category, f.source, f.publishedOn ?? null, JSON.stringify(f.tags), q ? JSON.stringify(q) : null);
      }
    } finally {
      await insertFact.finalizeAsync();
    }
    const insertTrivia = await txn.prepareAsync("INSERT INTO trivia (id, category, family, wikidata, question) VALUES (?, ?, ?, ?, ?)");
    try {
      for (const t of pack.trivia) {
        const { category, family, wikidata, ...question } = t;
        await insertTrivia.executeAsync(t.id, category, family, wikidata, JSON.stringify(question));
      }
    } finally {
      await insertTrivia.finalizeAsync();
    }
    await txn.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('pack_version', ?)", pack.version);
  });
}
