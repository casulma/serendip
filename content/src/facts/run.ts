import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CATEGORIES, type CategoryId } from "../categories.js";
import { articleUrl, rawPages } from "../lib/mediawiki.js";
import { toPlainText, UnsupportedWikitext } from "../lib/wikitext.js";
import { Category, Fact } from "../schema.js";
import { fetchArchives } from "./archives.js";
import { categorize, extractPortals, mayChange, normalizePortal, type PortalMapping } from "./categorize.js";
import { parseArchive, type RawAnecdote } from "./parse.js";
import { makeCloze } from "../fact-questions/cloze.js";
import { resolveArticles, type Entity } from "../fact-questions/wikidata.js";
import { difficultyScale } from "../trivia/family.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "out");

type Rejection = { id: string; year: number; reason: string; detail?: string };

async function loadMapping(): Promise<PortalMapping> {
  const raw = JSON.parse(await readFile(join(ROOT, "mappings", "portails.json"), "utf8"));
  const table = z.record(z.string(), Category);
  const pattern = z.object({ regex: z.string(), category: Category, tier: z.enum(["strong", "weak"]) });
  const parsed = z.object({ strong: table, weak: table, patterns: z.array(pattern).default([]) }).parse(raw);
  const lower = (t: Record<string, CategoryId>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [normalizePortal(k), v]));
  return {
    strong: lower(parsed.strong),
    weak: lower(parsed.weak),
    patterns: parsed.patterns.map((p) => ({ ...p, regex: new RegExp(p.regex, "u") })),
  };
}

async function main() {
  const mapping = await loadMapping();
  const archives = await fetchArchives();
  console.log(`[facts] ${archives.length} pages d'archives`);

  const rejected: Rejection[] = [];
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();
  const candidates: (RawAnecdote & { text: string; mainArticle: string })[] = [];

  for (const page of archives) {
    for (const a of parseArchive(page.year, page.text)) {
      if (seenIds.has(a.id)) {
        rejected.push({ id: a.id, year: a.year, reason: "doublon" });
        continue;
      }
      seenIds.add(a.id);
      if (!a.mainArticle) {
        rejected.push({ id: a.id, year: a.year, reason: "pas d'article principal", detail: a.wikitext.slice(0, 160) });
        continue;
      }
      let text: string;
      try {
        text = toPlainText(a.wikitext);
      } catch (e) {
        if (!(e instanceof UnsupportedWikitext)) throw e;
        rejected.push({ id: a.id, year: a.year, reason: e.reason, detail: a.wikitext.slice(0, 160) });
        continue;
      }
      const key = text.toLowerCase();
      if (seenTexts.has(key)) {
        rejected.push({ id: a.id, year: a.year, reason: "doublon" });
        continue;
      }
      seenTexts.add(key);
      candidates.push({ ...a, text, mainArticle: a.mainArticle });
    }
  }
  console.log(`[facts] ${candidates.length} anecdotes nettoyées, récupération des articles…`);

  const pages = await rawPages(
    candidates.map((c) => c.mainArticle),
    (done, total) => console.log(`[facts] articles ${done}/${total}`),
  );

  const facts: Fact[] = [];
  const subjects = new Map<string, { title: string; display: string | undefined }>();
  const unmappedPortals = new Map<string, number>();
  const mayChangeWords = new Map<string, number>();

  for (const c of candidates) {
    const page = pages.get(c.mainArticle);
    if (!page) {
      rejected.push({ id: c.id, year: c.year, reason: "article introuvable", detail: c.mainArticle });
      continue;
    }
    const portals = extractPortals(page.text);
    const cat = categorize(portals, mapping);
    if (!cat.category) {
      for (const p of portals) unmappedPortals.set(p, (unmappedPortals.get(p) ?? 0) + 1);
      rejected.push({ id: c.id, year: c.year, reason: cat.reason, detail: `${page.title} [${portals.join(", ")}]` });
      continue;
    }
    const word = mayChange(c.text);
    if (word) mayChangeWords.set(word, (mayChangeWords.get(word) ?? 0) + 1);
    facts.push(
      Fact.parse({
        id: c.id,
        text: c.text,
        category: cat.category,
        source: articleUrl(page.title),
        publishedOn: c.publishedOn,
        tags: word ? ["peut-changer"] : [],
        questions: [],
      }),
    );
    subjects.set(c.id, { title: page.title, display: c.mainDisplay && toPlainText(c.mainDisplay) });
  }

  const clozeRejections = await addClozeQuestions(facts, subjects);

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "facts.json"), JSON.stringify(facts, null, 1) + "\n");
  await writeFile(join(OUT, "rejected-facts.json"), JSON.stringify(rejected, null, 1) + "\n");
  await writeFile(join(OUT, "report-facts.md"), report(archives.length, facts, rejected, unmappedPortals, mayChangeWords, clozeRejections));
  await writeFile(join(OUT, "sample-fact-questions.md"), clozeSample(facts));
  console.log(`[facts] ${facts.length} faits retenus, ${rejected.length} rejetés → out/report-facts.md`);
}

/** Attach a fill-in-the-blank question to every fact where it can be built cleanly. */
async function addClozeQuestions(
  facts: Fact[],
  subjects: Map<string, { title: string; display: string | undefined }>,
): Promise<Map<string, number>> {
  const entities = await resolveArticles(
    [...subjects.values()].map((s) => s.title),
    (done, total) => console.log(`[facts] Wikidata ${done}/${total}`),
  );
  const unique = new Map<string, Entity>();
  for (const e of entities.values()) unique.set(e.qid, e);
  const byType = new Map<string, Entity[]>();
  for (const e of unique.values()) for (const t of e.types) byType.set(t, [...(byType.get(t) ?? []), e]);
  const difficulty = difficultyScale([...unique.values()].map((e) => e.sitelinks));

  const reasons = new Map<string, number>();
  const reject = (r: string) => reasons.set(r, (reasons.get(r) ?? 0) + 1);
  for (const f of facts) {
    const s = subjects.get(f.id)!;
    const entity = entities.get(s.title);
    if (!s.display) { reject("lien principal non simple (préfixe, pluriel, modèle)"); continue; }
    if (!entity) { reject("pas d'élément Wikidata"); continue; }
    const pool = [...new Map(entity.types.flatMap((t) => byType.get(t) ?? []).map((e) => [e.qid, e])).values()];
    const r = makeCloze({ factId: f.id, text: f.text, display: s.display, entity }, pool);
    if ("reason" in r) { reject(r.reason); continue; }
    f.questions.push({ ...r.question, difficulty: difficulty(entity.sitelinks) });
  }
  return reasons;
}

function clozeSample(facts: Fact[]): string {
  const withQ = facts.filter((f) => f.questions.length > 0);
  const step = Math.max(1, Math.floor(withQ.length / 50));
  const lines = ["# Échantillon — questions à trous sur les faits", "", `${withQ.length} faits sur ${facts.length} ont une question.`, ""];
  withQ
    .filter((_, i) => i % step === 0)
    .slice(0, 50)
    .forEach((f, i) => {
      const q = f.questions[0]!;
      const t = (c: typeof q.answer) => (c.kind === "text" ? c.text : c.alt);
      lines.push(`${i + 1}. ${q.prompt}`, `   - ✅ ${t(q.answer)} — ❌ ${q.distractors.map(t).join(" / ")}`, "");
    });
  return lines.join("\n") + "\n";
}

const count = <T>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

function report(
  pageCount: number,
  facts: Fact[],
  rejected: Rejection[],
  unmapped: Map<string, number>,
  mayChangeWords: Map<string, number>,
  clozeRejections: Map<string, number>,
): string {
  const label = (id: string) => CATEGORIES.find((c) => c.id === (id as CategoryId))?.label ?? id;
  const lines: string[] = [];
  lines.push("# Rapport — faits « Le saviez-vous ? »", "");
  lines.push(`- Pages d'archives lues : ${pageCount}`);
  lines.push(`- Faits retenus : **${facts.length}**`);
  lines.push(`- Anecdotes rejetées : **${rejected.length}**`);
  lines.push(`- Tag \`peut-changer\` : ${facts.filter((f) => f.tags.includes("peut-changer")).length}`, "");

  lines.push("## Faits par catégorie", "", "| Catégorie | Faits |", "|---|---:|");
  for (const c of CATEGORIES) lines.push(`| ${c.label} | ${facts.filter((f) => f.category === c.id).length} |`);

  lines.push("", "## Faits par année d'archive", "", "| Année | Faits |", "|---|---:|");
  for (const [y, n] of count(facts, (f) => f.id.match(/^lsv-(\d{4})-/)?.[1] ?? f.publishedOn?.slice(0, 4) ?? "?").sort((a, b) =>
    a[0].localeCompare(b[0]),
  ))
    lines.push(`| ${y} | ${n} |`);

  lines.push("", "## Rejets par raison", "", "| Raison | Nombre | Exemples |", "|---|---:|---|");
  for (const [reason, n] of count(rejected, (r) => r.reason)) {
    const ex = rejected
      .filter((r) => r.reason === reason && r.detail)
      .slice(0, 2)
      .map((r) => `\`${r.id}\` ${r.detail!.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 90)}`)
      .join("<br>");
    lines.push(`| ${reason} | ${n} | ${ex} |`);
  }

  lines.push("", "## Portails non reconnus (les plus fréquents)", "");
  lines.push("À ajouter dans `mappings/portails.json` pour récupérer les faits correspondants.", "");
  lines.push("| Portail | Faits concernés |", "|---|---:|");
  for (const [p, n] of [...unmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)) lines.push(`| ${p} | ${n} |`);

  lines.push("", "## Expressions ayant déclenché `peut-changer`", "", "| Expression | Faits |", "|---|---:|");
  for (const [w, n] of [...mayChangeWords.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| ${w} | ${n} |`);

  const withQ = facts.filter((f) => f.questions.length > 0).length;
  lines.push("", "## Questions à trous", "", `- Faits avec une question : **${withQ}** sur ${facts.length}`, "");
  lines.push("| Raison de l'absence de question | Faits |", "|---|---:|");
  for (const [r, n] of [...clozeRejections].sort((a, b) => b[1] - a[1])) lines.push(`| ${r} | ${n} |`);
  lines.push("", "Échantillon de 50 questions : `out/sample-fact-questions.md`.");

  lines.push("", "## Échantillon (1 fait sur 500)", "");
  facts.forEach((f, i) => {
    if (i % 500 === 0) lines.push(`- **${label(f.category)}** — ${f.text} ([source](${f.source}))`);
  });
  return lines.join("\n") + "\n";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
