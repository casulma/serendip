import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "../categories.js";
import { Trivia } from "../schema.js";
import type { Family, Rejection } from "./family.js";
import { auteur } from "./families/auteur.js";
import { capitale } from "./families/capitale.js";
import { chefLieu } from "./families/chef-lieu.js";
import { drapeau } from "./families/drapeau.js";
import { naissance } from "./families/naissance.js";
import { superficie } from "./families/superficie.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "out");

// Order matters only for the output file; each family is independent.
const FAMILIES: Family[] = [capitale, drapeau, chefLieu, superficie, naissance, auteur];

async function main() {
  const items: Trivia[] = [];
  const results: { family: Family; count: number; rejected: Rejection[]; error?: string }[] = [];

  for (const family of FAMILIES) {
    console.log(`[trivia] ${family.id}…`);
    try {
      const r = await family.build();
      const valid = r.items.map((i) => Trivia.parse(i));
      items.push(...valid);
      results.push({ family, count: valid.length, rejected: r.rejected });
      console.log(`[trivia] ${family.id}: ${valid.length} questions, ${r.rejected.length} rejets`);
    } catch (e) {
      // One failing family (e.g. a host blocked) must not block the others.
      results.push({ family, count: 0, rejected: [], error: String(e).slice(0, 200) });
      console.error(`[trivia] ${family.id} a échoué : ${e}`);
    }
  }

  const ids = new Set<string>();
  for (const i of items) {
    if (ids.has(i.id)) throw new Error(`duplicate trivia id ${i.id}`);
    ids.add(i.id);
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "trivia.json"), JSON.stringify(items, null, 1) + "\n");
  await writeFile(join(OUT, "report-trivia.md"), report(items, results));
  console.log(`[trivia] ${items.length} questions → out/report-trivia.md`);
}

function report(items: Trivia[], results: { family: Family; count: number; rejected: Rejection[]; error?: string }[]): string {
  const lines = ["# Rapport — quiz aléatoire (Wikidata)", "", `Total : **${items.length}** questions`, ""];
  lines.push("## Par famille", "", "| Famille | Questions | Rejets | Facile / moyen / difficile |", "|---|---:|---:|---|");
  for (const r of results) {
    const own = items.filter((i) => i.family === r.family.id);
    const d = [1, 2, 3].map((n) => own.filter((i) => i.difficulty === n).length).join(" / ");
    lines.push(`| ${r.family.label} | ${r.error ? `échec : ${r.error.replace(/\|/g, "\\|")}` : r.count} | ${r.rejected.length} | ${d} |`);
  }
  lines.push("", "## Par catégorie", "", "| Catégorie | Questions |", "|---|---:|");
  for (const c of CATEGORIES) lines.push(`| ${c.label} | ${items.filter((i) => i.category === c.id).length} |`);

  lines.push("", "## Rejets par raison", "");
  for (const r of results) {
    if (r.rejected.length === 0) continue;
    const reasons = new Map<string, number>();
    for (const x of r.rejected) reasons.set(x.reason, (reasons.get(x.reason) ?? 0) + 1);
    lines.push(`### ${r.family.label}`, "");
    for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) lines.push(`- ${reason} : ${n}`);
    lines.push("");
  }

  lines.push("## Échantillon (5 par famille)", "");
  const show = (c: Trivia["answer"]) => (c.kind === "text" ? c.text : `[image ${c.alt}]`);
  for (const r of results) {
    const own = items.filter((i) => i.family === r.family.id);
    const step = Math.max(1, Math.floor(own.length / 5));
    for (const i of own.filter((_, k) => k % step === 0).slice(0, 5)) {
      const img = i.promptImage ? ` [image ${i.promptImage}]` : "";
      lines.push(`- (${i.difficulty}) ${i.prompt}${img} → **${show(i.answer)}** — ${i.distractors.map(show).join(" / ")}`);
    }
  }
  return lines.join("\n") + "\n";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
