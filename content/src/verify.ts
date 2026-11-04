import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBank, proportions, ROOT, type Issue } from "./bank.js";
import { normalizeTitle, rawPages } from "./lib/mediawiki.js";
import { normalize } from "./normalize.js";
import type { PackQuestion } from "./schema.js";

// Questions are written by Claude: each must be backed by its Wikipédia article.
// The check is mechanical: the answer (or an accepted variant) must appear in
// the article's text. It catches invented answers and wrong articles; it does
// not prove the question is right, so failures are reviewed by hand.

export type Verdict = "ok" | "article introuvable" | "réponse absente de l'article";

export async function verify(questions: PackQuestion[]): Promise<Map<string, Verdict>> {
  const pages = await rawPages(
    questions.map((q) => q.wikipedia),
    (done, total) => console.log(`[verify] articles ${done}/${total}`),
  );
  const normalized = new Map<string, string>();
  const out = new Map<string, Verdict>();
  for (const q of questions) {
    const page = pages.get(normalizeTitle(q.wikipedia));
    if (!page) {
      out.set(q.id, "article introuvable");
      continue;
    }
    let text = normalized.get(page.title);
    if (text === undefined) {
      text = ` ${normalize(page.text)} `;
      normalized.set(page.title, text);
    }
    const found = [q.answer, ...q.accept].some((a) => text!.includes(` ${normalize(a)} `));
    out.set(q.id, found ? "ok" : "réponse absente de l'article");
  }
  return out;
}

async function main() {
  const { questions, issues } = await loadBank();
  const verdicts = await verify(questions);
  await mkdir(join(ROOT, "out"), { recursive: true });
  await writeFile(join(ROOT, "out", "verification.json"), JSON.stringify(Object.fromEntries(verdicts), null, 1) + "\n");
  await writeFile(join(ROOT, "out", "report-questions.md"), report(questions, issues, verdicts));
  const ok = [...verdicts.values()].filter((v) => v === "ok").length;
  console.log(`[verify] ${ok}/${questions.length} vérifiées, ${issues.filter((i) => i.level === "erreur").length} erreurs → out/report-questions.md`);
}

function report(questions: PackQuestion[], issues: Issue[], verdicts: Map<string, Verdict>): string {
  const lines = ["# Rapport — banque de questions", ""];
  const ok = questions.filter((q) => verdicts.get(q.id) === "ok").length;
  lines.push(`- Questions : **${questions.length}**`, `- Vérifiées contre Wikipédia : **${ok}**`, "");
  lines.push("## Par catégorie", "", "| Catégorie | Questions | Objectif | Niv. 1 / 2 / 3 | Vérifiées |", "|---|---:|---:|---|---:|");
  for (const c of proportions(questions)) {
    const v = questions.filter((q) => q.category === c.id && verdicts.get(q.id) === "ok").length;
    lines.push(`| ${c.label} | ${c.count} | ${c.target} | ${c.byDifficulty.join(" / ")} | ${v} |`);
  }
  const errors = issues.filter((i) => i.level === "erreur");
  const warnings = issues.filter((i) => i.level === "alerte");
  lines.push("", `## Erreurs (${errors.length})`, "", ...errors.map((i) => `- \`${i.id}\` ${i.message}`));
  lines.push("", `## Alertes (${warnings.length})`, "", ...warnings.map((i) => `- \`${i.id}\` ${i.message}`));
  const failed = questions.filter((q) => verdicts.get(q.id) !== "ok");
  lines.push("", `## Non vérifiées (${failed.length}) — exclues du pack tant qu'elles ne sont pas corrigées`, "");
  for (const q of failed) lines.push(`- \`${q.id}\` ${verdicts.get(q.id)} : ${q.question} → **${q.answer}** (article « ${q.wikipedia} »)`);
  return lines.join("\n") + "\n";
}

if (process.argv[1]?.endsWith("verify.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
