import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CATEGORIES } from "../categories.js";
import { mayChange } from "../facts/categorize.js";
import { Category, Fact } from "../schema.js";
import { listQuizzes, quizJson, quizPage } from "./fetch.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "out");

const QuizFile = z.object({
  "rédacteur": z.string(),
  "thème": z.string(),
  quizz: z.array(
    z.object({
      id: z.number(),
      question: z.string(),
      propositions: z.array(z.string()),
      "réponse": z.string(),
      "wikipédia": z.string().optional(),
      anecdote: z.string().optional(),
    }),
  ),
});

type Rejection = { id: string; reason: string; detail?: string };

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/\s+([?!:;»])/g, " $1").trim();

async function loadJson<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(JSON.parse(await readFile(join(ROOT, "mappings", file), "utf8")));
}

async function main() {
  const categories = await loadJson("oqdb-categories.json", z.object({ map: z.record(z.string(), Category.nullable()) }));
  const exclusions = await loadJson("exclusions.json", z.object({ facts: z.array(z.object({ id: z.string() })) }));
  const excluded = new Set(exclusions.facts.map((f) => f.id));

  const refs = await listQuizzes();
  console.log(`[oqdb] ${refs.length} quiz`);
  const facts: Fact[] = [];
  const rejected: Rejection[] = [];
  const unmapped = new Map<string, number>();
  const byQuizCategory = new Map<string, number>();

  for (const ref of refs) {
    const page = await quizPage(ref);
    if (!page) {
      rejected.push({ id: `oqdb-${ref.id}`, reason: "quiz sans fichier JSON", detail: ref.title });
      continue;
    }
    byQuizCategory.set(page.category, (byQuizCategory.get(page.category) ?? 0) + 1);
    const category = categories.map[page.category];
    if (category === undefined) unmapped.set(page.category, (unmapped.get(page.category) ?? 0) + 1);
    const parsed = QuizFile.safeParse(await quizJson(page));
    if (!parsed.success) {
      rejected.push({ id: `oqdb-${ref.id}`, reason: "fichier JSON invalide", detail: ref.title });
      continue;
    }

    for (const q of parsed.data.quizz) {
      const id = `oqdb-${ref.id}-${q.id}`;
      const reject = (reason: string, detail?: string) => rejected.push({ id, reason, detail: detail ?? clean(q.question) });
      if (!category) { reject(category === null ? "catégorie écartée" : "catégorie non reconnue", page.category); continue; }
      if (excluded.has(id)) { reject("signalé « pas clair » dans l'appli"); continue; }

      const question = clean(q.question);
      const answer = clean(q["réponse"]);
      const propositions = q.propositions.map(clean);
      const anecdote = clean(q.anecdote ?? "");
      const distinct = new Set(propositions.map((p) => p.toLocaleLowerCase("fr")));
      if (propositions.length !== 4 || distinct.size !== 4) { reject("propositions invalides"); continue; }
      if (!propositions.includes(answer)) { reject("réponse absente des propositions"); continue; }
      // Word games put a bare "-" where the anecdote goes.
      if (anecdote.replace(/[-–—.\s]/g, "").length < 15) { reject("pas d'anecdote"); continue; }
      const source = q["wikipédia"]?.trim();
      if (!source || !/^https:\/\/[a-z]+\.wikipedia\.org\/wiki\/\S+$/.test(source)) { reject("lien Wikipédia absent ou invalide", source); continue; }

      const time = mayChange(`${question} ${anecdote}`);
      facts.push(
        Fact.parse({
          id,
          origin: "oqdb",
          credit: {
            author: clean(parsed.data["rédacteur"] || ref.author),
            work: `Quiz « ${ref.title} »`,
            provider: "OpenQuizzDB",
            url: "https://www.openquizzdb.org",
          },
          text: anecdote,
          category,
          source,
          tags: time ? ["peut-changer"] : [],
          questions: [
            {
              id: `${id}-q`,
              prompt: question,
              answer: { kind: "text", text: answer },
              distractors: propositions.filter((p) => p !== answer).map((text) => ({ kind: "text", text })),
              // The free files carry no level: every question is "moyen".
              difficulty: 2,
            },
          ],
        }),
      );
    }
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "oqdb.json"), JSON.stringify(facts, null, 1) + "\n");
  await writeFile(join(OUT, "report-oqdb.md"), report(refs.length, facts, rejected, unmapped, byQuizCategory));
  console.log(`[oqdb] ${facts.length} questions retenues, ${rejected.length} rejets → out/report-oqdb.md`);
}

function report(
  quizCount: number,
  facts: Fact[],
  rejected: Rejection[],
  unmapped: Map<string, number>,
  byQuizCategory: Map<string, number>,
): string {
  const lines = ["# Rapport — OpenQuizzDB", ""];
  lines.push(`- Quiz lus : ${quizCount}`, `- Questions retenues : **${facts.length}**`, `- Rejets : **${rejected.length}**`);
  lines.push(`- Tag \`peut-changer\` : ${facts.filter((f) => f.tags.includes("peut-changer")).length}`, "");
  lines.push("## Par catégorie (Serendip)", "", "| Catégorie | Questions |", "|---|---:|");
  for (const c of CATEGORIES) lines.push(`| ${c.label} | ${facts.filter((f) => f.category === c.id).length} |`);
  lines.push("", "## Catégories OpenQuizzDB (nombre de quiz)", "", "| Catégorie | Quiz |", "|---|---:|");
  for (const [c, n] of [...byQuizCategory].sort((a, b) => b[1] - a[1])) lines.push(`| ${c || "(vide)"} | ${n} |`);
  if (unmapped.size > 0) {
    lines.push("", "**Non reconnues** (à ajouter dans `mappings/oqdb-categories.json`) : " + [...unmapped.keys()].join(", "));
  }
  const reasons = new Map<string, Rejection[]>();
  for (const r of rejected) reasons.set(r.reason, [...(reasons.get(r.reason) ?? []), r]);
  lines.push("", "## Rejets par raison", "", "| Raison | Nombre | Exemples |", "|---|---:|---|");
  for (const [reason, rs] of [...reasons].sort((a, b) => b[1].length - a[1].length)) {
    const ex = rs.slice(0, 2).map((r) => `\`${r.id}\` ${(r.detail ?? "").replace(/\|/g, "\\|").slice(0, 80)}`).join("<br>");
    lines.push(`| ${reason} | ${rs.length} | ${ex} |`);
  }
  lines.push("", "## Échantillon (1 question sur 100)", "");
  facts.forEach((f, i) => {
    if (i % 100 !== 0) return;
    const q = f.questions[0]!;
    const t = (c: (typeof q)["answer"]) => (c.kind === "text" ? c.text : c.alt);
    lines.push(`- **${q.prompt}** → ${t(q.answer)} (${q.distractors.map(t).join(" / ")})  `, `  _${f.text}_`);
  });
  return lines.join("\n") + "\n";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
