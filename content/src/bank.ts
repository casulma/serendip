import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.js";
import { normalize } from "./normalize.js";
import { QuestionFile, type PackQuestion } from "./schema.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "questions");

export type Issue = { id: string; level: "erreur" | "alerte"; message: string };

// Words too common to count as "the answer leaks into the question".
const STOP = new Set(["le", "la", "les", "un", "une", "des", "de", "du", "et", "en", "au", "aux", "l", "d"]);

/** Editorial checks from docs/charte-questions.md that a machine can do. */
export function checkQuestion(q: PackQuestion): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ id: q.id, level: "erreur", message });
  const warn = (message: string) => issues.push({ id: q.id, level: "alerte", message });

  if (!q.id.startsWith(`${q.category}-`)) err("identifiant hors catégorie");
  if (/en quelle ann[ée]e (est|fut) n[ée]/i.test(q.question)) err("date de naissance (interdit par la charte)");
  if (q.answer.split(/\s+/).length > 4) warn("réponse de plus de 4 mots");

  const good = [q.answer, ...q.accept].map(normalize);
  const choices = q.choices.map(normalize);
  if (new Set(choices).size !== 3) err("propositions en double");
  if (choices.some((c) => good.includes(c))) err("une proposition est une bonne réponse");

  const questionWords = new Set(normalize(q.question).split(" "));
  const leak = normalize(q.answer)
    .split(" ")
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .find((w) => questionWords.has(w));
  if (leak) warn(`la question contient un mot de la réponse (« ${leak} »)`);
  return issues;
}

/** Every question file, with categories inlined and checked. */
export async function loadBank(): Promise<{ questions: PackQuestion[]; issues: Issue[] }> {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".json")).sort();
  const questions: PackQuestion[] = [];
  const issues: Issue[] = [];
  for (const f of files) {
    const parsed = QuestionFile.safeParse(JSON.parse(await readFile(join(DIR, f), "utf8")));
    if (!parsed.success) {
      issues.push({ id: f, level: "erreur", message: `fichier invalide : ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}` });
      continue;
    }
    // One or more files per category: histoire.json, histoire-2.json…
    if (!new RegExp(`^${parsed.data.category}(-\\d+)?\\.json$`).test(f)) issues.push({ id: f, level: "erreur", message: "nom de fichier ≠ catégorie" });
    for (const q of parsed.data.questions) questions.push({ ...q, category: parsed.data.category });
  }

  const seen = new Map<string, string>();
  for (const q of questions) {
    if (seen.has(q.id)) issues.push({ id: q.id, level: "erreur", message: "identifiant en double" });
    seen.set(q.id, q.id);
    issues.push(...checkQuestion(q));
  }
  // Same question text twice, across categories.
  const texts = new Map<string, string>();
  for (const q of questions) {
    const k = normalize(q.question);
    const other = texts.get(k);
    if (other) issues.push({ id: q.id, level: "erreur", message: `même énoncé que ${other}` });
    texts.set(k, q.id);
  }
  return { questions, issues };
}

export function proportions(questions: PackQuestion[]) {
  return CATEGORIES.map((c) => {
    const own = questions.filter((q) => q.category === c.id);
    return { ...c, count: own.length, byDifficulty: [1, 2, 3].map((d) => own.filter((q) => q.difficulty === d).length) };
  });
}
