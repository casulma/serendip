import { entityUrl, hasFrenchLabel, qid, sparql } from "../../lib/sparql.js";
import type { Trivia } from "../../schema.js";
import { difficultyScale, distinct, groupBy, pickDistractors, text, type Family, type Rejection } from "../family.js";

// Literary works (Q7725634) and novels (Q8261) known in many languages.
const MIN_SITELINKS = 35;
const WORK_TYPES = ["Q7725634", "Q8261"];
const DETAILS_BATCH = 200;
// Distractor authors are contemporaries: "Hugo / Balzac / Dumas", not "Hugo / Homère / King".
const ERA_WINDOW = 60;

const listQuery = (type: string) => `
SELECT ?w ?sitelinks WHERE {
  ?w wdt:P31 wd:${type}; wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= ${MIN_SITELINKS})
} ORDER BY ?w`;

const detailsQuery = (ids: string[]) => `
SELECT ?w ?wLabel ?author ?authorLabel ?authorHuman ?born WHERE {
  VALUES ?w { ${ids.map((i) => `wd:${i}`).join(" ")} }
  OPTIONAL {
    ?w wdt:P50 ?author.
    BIND(EXISTS { ?author wdt:P31 wd:Q5 } AS ?authorHuman)
    OPTIONAL { ?author wdt:P569 ?born }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
} ORDER BY ?w ?author ?born`;

type Work = { id: string; title: string; author: string; authorId: string; authorBorn?: number; sitelinks: number };

export const auteur: Family = {
  id: "auteur",
  label: "Auteur d'une œuvre littéraire",
  category: "arts-litterature",
  async build() {
    const rejected: Rejection[] = [];
    const sitelinks = new Map<string, number>();
    for (const t of WORK_TYPES) {
      for (const r of await sparql(listQuery(t))) sitelinks.set(qid(r.w!), Number(r.sitelinks));
    }

    const ids = [...sitelinks.keys()].sort();
    const works: Work[] = [];
    for (let i = 0; i < ids.length; i += DETAILS_BATCH) {
      for (const [uri, g] of groupBy(await sparql(detailsQuery(ids.slice(i, i + DETAILS_BATCH))), (r) => r.w!)) {
        const id = qid(uri);
        const title = g[0]!.wLabel;
        const authors = distinct(g.map((r) => r.author));
        if (!hasFrenchLabel(title)) { rejected.push({ id, reason: "pas de libellé fr (œuvre)" }); continue; }
        if (authors.length === 0) { rejected.push({ id, reason: "pas d'auteur" }); continue; }
        if (authors.length > 1) { rejected.push({ id, reason: "plusieurs auteurs" }); continue; }
        const row = g[0]!;
        if (row.authorHuman !== "true") { rejected.push({ id, reason: "auteur non humain ou anonyme" }); continue; }
        if (!hasFrenchLabel(row.authorLabel)) { rejected.push({ id, reason: "pas de libellé fr (auteur)" }); continue; }
        if (title!.toLowerCase().includes(row.authorLabel!.toLowerCase())) {
          rejected.push({ id, reason: "le titre contient le nom de l'auteur" });
          continue;
        }
        const born = distinct(g.map((r) => yearOf(r.born)));
        works.push({
          id,
          title: title!,
          author: row.authorLabel!,
          authorId: qid(row.author!),
          authorBorn: born.length === 1 ? born[0] : undefined,
          sitelinks: sitelinks.get(id)!,
        });
      }
    }

    const difficulty = difficultyScale(works.map((w) => w.sitelinks));
    const authors = new Map<string, { name: string; born?: number }>();
    for (const w of works) authors.set(w.authorId, { name: w.author, born: w.authorBorn });
    const authorList = [...authors.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // The same French title used by works of different authors ("Métamorphoses").
    const authorsByTitle = new Map<string, Set<string>>();
    for (const w of works) {
      const k = w.title.toLocaleLowerCase("fr");
      authorsByTitle.set(k, (authorsByTitle.get(k) ?? new Set()).add(w.authorId));
    }

    const items: Trivia[] = [];
    for (const w of works) {
      if (authorsByTitle.get(w.title.toLocaleLowerCase("fr"))!.size > 1) {
        rejected.push({ id: w.id, reason: "titre partagé par plusieurs œuvres" });
        continue;
      }
      if (w.authorBorn === undefined) { rejected.push({ id: w.id, reason: "date de naissance de l'auteur inconnue" }); continue; }
      const contemporaries = authorList.filter(
        ([id, a]) => id !== w.authorId && a.born !== undefined && Math.abs(a.born - w.authorBorn!) <= ERA_WINDOW,
      );
      const picks = pickDistractors(contemporaries.map(([, a]) => a.name), w.author, `auteur:${w.id}`);
      if (picks.length < 3) { rejected.push({ id: w.id, reason: "moins de 3 auteurs contemporains" }); continue; }
      items.push({
        id: `auteur-${w.id}`,
        family: "auteur",
        category: "arts-litterature",
        wikidata: entityUrl(w.id),
        prompt: `Qui a écrit « ${w.title} » ?`,
        answer: text(w.author),
        distractors: picks.map(text),
        difficulty: difficulty(w.sitelinks),
      });
    }
    return { items, rejected };
  },
};

/** Year of a Wikidata time value; `undefined` for "unknown value" (a blank node). */
function yearOf(timeValue: string | undefined): number | undefined {
  const m = timeValue && /^([+-]?\d+)-/.exec(timeValue);
  return m ? Number(m[1]) : undefined;
}
