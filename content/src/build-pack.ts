import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pack } from "./schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

// Bumped by hand when the content changes in a way the app should notice.
const VERSION = (await readFile(join(ROOT, "PACK_VERSION"), "utf8")).trim();

// OpenQuizzDB questions first: they are the main source; Wikipédia anecdotes are opt-in in the app.
const facts = [
  ...JSON.parse(await readFile(join(OUT, "oqdb.json"), "utf8")),
  ...JSON.parse(await readFile(join(OUT, "facts.json"), "utf8")),
];
const trivia = JSON.parse(await readFile(join(OUT, "trivia.json"), "utf8"));
const pack = Pack.parse({ version: VERSION, facts, trivia });

const ids = new Set<string>();
for (const id of [...pack.facts.map((f) => f.id), ...pack.facts.flatMap((f) => f.questions.map((q) => q.id)), ...pack.trivia.map((t) => t.id)]) {
  if (ids.has(id)) throw new Error(`duplicate id ${id}`);
  ids.add(id);
}

await writeFile(join(OUT, "pack.json"), JSON.stringify(pack) + "\n");
const withQ = pack.facts.filter((f) => f.questions.length > 0).length;
const oqdb = pack.facts.filter((f) => f.origin === "oqdb").length;
console.log(
  `[pack] v${pack.version} : ${oqdb} questions OpenQuizzDB, ${pack.facts.length - oqdb} anecdotes Wikipédia (${withQ} faits avec question au total), ${pack.trivia.length} questions aléatoires → out/pack.json`,
);
