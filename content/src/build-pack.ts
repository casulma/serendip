import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBank, ROOT } from "./bank.js";
import { Pack } from "./schema.js";

// Bumped by hand when the content changes in a way the app should notice.
const VERSION = (await readFile(join(ROOT, "PACK_VERSION"), "utf8")).trim();

const { questions, issues } = await loadBank();
const errors = issues.filter((i) => i.level === "erreur");
if (errors.length > 0) {
  for (const e of errors) console.error(`[pack] ${e.id} : ${e.message}`);
  throw new Error(`${errors.length} erreurs dans la banque : corrigez-les avant de construire le pack`);
}

// Only questions backed by their Wikipédia article (pnpm verify) are shipped.
const verdicts: Record<string, string> = JSON.parse(await readFile(join(ROOT, "out", "verification.json"), "utf8"));
const shipped = questions.filter((q) => verdicts[q.id] === "ok");

const pack = Pack.parse({ version: VERSION, questions: shipped });
await writeFile(join(ROOT, "out", "pack.json"), JSON.stringify(pack) + "\n");
console.log(`[pack] v${pack.version} : ${shipped.length} questions (${questions.length - shipped.length} non vérifiées écartées) → out/pack.json`);
