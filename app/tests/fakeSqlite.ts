// Minimal stand-in for expo-sqlite's SQLiteDatabase on top of node:sqlite,
// covering only the methods the app uses. Lets tests run the real SQL.
import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

type Params = (string | number | null)[];

const flat = (params: unknown[]): Params => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as Params;
const plain = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : null);

export function fakeDb(): SQLiteDatabase {
  const raw = new DatabaseSync(":memory:");
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: unknown[]) => {
      const r = raw.prepare(sql).run(...flat(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getFirstAsync: async <T>(sql: string, ...params: unknown[]) => plain<T>(raw.prepare(sql).get(...flat(params))),
    getAllAsync: async <T>(sql: string, ...params: unknown[]) => raw.prepare(sql).all(...flat(params)).map((r) => plain<T>(r)!),
    prepareAsync: async (sql: string) => {
      const st = raw.prepare(sql);
      return { executeAsync: async (...params: unknown[]) => st.run(...flat(params)), finalizeAsync: async () => undefined };
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec("BEGIN");
      try {
        await task();
        raw.exec("COMMIT");
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
    withExclusiveTransactionAsync: async (task: (txn: unknown) => Promise<void>) => {
      await db.withTransactionAsync(() => task(db));
    },
  };
  return db as unknown as SQLiteDatabase;
}
