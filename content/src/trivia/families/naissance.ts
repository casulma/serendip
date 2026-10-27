import type { CategoryId } from "../../categories.js";
import { rng } from "../../lib/random.js";
import { entityUrl, hasFrenchLabel, qid, sparql } from "../../lib/sparql.js";
import type { Trivia } from "../../schema.js";
import { difficultyScale, distinct, groupBy, text, type Family, type Rejection } from "../family.js";

// Occupation → category, in priority order: someone who is both a writer and a
// politician is filed under the first listed occupation. Thresholds on sitelinks
// keep only widely known people (sportspeople have fewer sitelinks on average).
const OCCUPATIONS: { qid: string; label: string; category: CategoryId; minSitelinks: number }[] = [
  { qid: "Q116", label: "monarque", category: "histoire", minSitelinks: 70 },
  { qid: "Q11900058", label: "explorateur", category: "histoire", minSitelinks: 60 },
  { qid: "Q169470", label: "physicien", category: "sciences", minSitelinks: 70 },
  { qid: "Q593644", label: "chimiste", category: "sciences", minSitelinks: 70 },
  { qid: "Q170790", label: "mathématicien", category: "sciences", minSitelinks: 70 },
  { qid: "Q864503", label: "biologiste", category: "sciences", minSitelinks: 70 },
  { qid: "Q36834", label: "compositeur", category: "musique-cinema", minSitelinks: 80 },
  { qid: "Q177220", label: "chanteur", category: "musique-cinema", minSitelinks: 90 },
  { qid: "Q2526255", label: "réalisateur", category: "musique-cinema", minSitelinks: 80 },
  { qid: "Q33999", label: "acteur", category: "musique-cinema", minSitelinks: 100 },
  { qid: "Q1028181", label: "peintre", category: "arts-litterature", minSitelinks: 80 },
  { qid: "Q1281618", label: "sculpteur", category: "arts-litterature", minSitelinks: 70 },
  { qid: "Q36180", label: "écrivain", category: "arts-litterature", minSitelinks: 90 },
  { qid: "Q4964182", label: "philosophe", category: "societe-politique", minSitelinks: 80 },
  { qid: "Q82955", label: "personnalité politique", category: "societe-politique", minSitelinks: 110 },
  { qid: "Q937857", label: "footballeur", category: "sport", minSitelinks: 70 },
  { qid: "Q10833314", label: "joueur de tennis", category: "sport", minSitelinks: 60 },
  { qid: "Q2309784", label: "cycliste", category: "sport", minSitelinks: 50 },
  { qid: "Q378622", label: "pilote automobile", category: "sport", minSitelinks: 60 },
];

const JULIAN = "http://www.wikidata.org/entity/Q1985786";
const FEMALE = "http://www.wikidata.org/entity/Q6581072";
const MALE = "http://www.wikidata.org/entity/Q6581097";
const PREFERRED = "http://wikiba.se/ontology#PreferredRank";
const DETAILS_BATCH = 200;

// Step 1 is deliberately minimal: richer queries time out on large occupations.
const listQuery = (occ: string, min: number) => `
SELECT ?p ?sitelinks WHERE {
  ?p wdt:P106 wd:${occ}; wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= ${min})
} ORDER BY ?p`;

const detailsQuery = (ids: string[]) => `
SELECT ?p ?pLabel ?birth ?prec ?cal ?rank ?gender ?human WHERE {
  VALUES ?p { ${ids.map((i) => `wd:${i}`).join(" ")} }
  BIND(EXISTS { ?p wdt:P31 wd:Q5 } AS ?human)
  OPTIONAL {
    ?p p:P569 ?st. ?st wikibase:rank ?rank. FILTER(?rank != wikibase:DeprecatedRank)
    ?st psv:P569 [ wikibase:timeValue ?birth; wikibase:timePrecision ?prec; wikibase:timeCalendarModel ?cal ].
  }
  OPTIONAL { ?p wdt:P21 ?gender }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
} ORDER BY ?p ?birth`;

type Person = { id: string; name: string; year: number; gender?: string; category: CategoryId; sitelinks: number };

export const naissance: Family = {
  id: "naissance",
  label: "Année de naissance d'une personnalité",
  category: "histoire",
  async build() {
    const rejected: Rejection[] = [];
    const chosen = new Map<string, { category: CategoryId; sitelinks: number }>();
    for (const occ of OCCUPATIONS) {
      let rows: Record<string, string>[];
      try {
        rows = await sparql(listQuery(occ.qid, occ.minSitelinks));
      } catch (e) {
        rejected.push({ id: occ.qid, reason: `requête impossible (${occ.label}) : ${String(e).slice(0, 60)}` });
        continue;
      }
      for (const r of rows) {
        const id = qid(r.p!);
        if (!chosen.has(id)) chosen.set(id, { category: occ.category, sitelinks: Number(r.sitelinks) });
      }
    }

    const ids = [...chosen.keys()].sort();
    const people: Person[] = [];
    for (let i = 0; i < ids.length; i += DETAILS_BATCH) {
      const rows = await sparql(detailsQuery(ids.slice(i, i + DETAILS_BATCH)));
      for (const [uri, g] of groupBy(rows, (r) => r.p!)) {
        const id = qid(uri);
        const meta = chosen.get(id)!;
        const name = g[0]!.pLabel;
        if (g[0]!.human !== "true") { rejected.push({ id, reason: "pas un être humain" }); continue; }
        if (!hasFrenchLabel(name)) { rejected.push({ id, reason: "pas de libellé fr" }); continue; }
        // A "preferred" statement is Wikidata's way of resolving conflicting sources.
        const all = g.filter((r) => r.birth && Number(r.prec) >= 9);
        const preferred = all.filter((r) => r.rank === PREFERRED);
        const dated = preferred.length > 0 ? preferred : all;
        if (dated.length === 0) { rejected.push({ id, reason: "date de naissance absente ou imprécise" }); continue; }
        const years = distinct(dated.map((r) => yearOf(r.birth!)));
        if (years.length !== 1) { rejected.push({ id, reason: "dates de naissance contradictoires" }); continue; }
        const year = years[0]!;
        if (year <= 0) { rejected.push({ id, reason: "naissance avant notre ère" }); continue; }
        // Julian dates are stored converted to Gregorian; near New Year the
        // converted year can differ from the one every reference cites.
        if (dated.some((r) => r.cal === JULIAN && nearNewYear(r.birth!))) {
          rejected.push({ id, reason: "date julienne proche du Nouvel An (année ambiguë)" });
          continue;
        }
        const genders = distinct(g.map((r) => r.gender));
        people.push({ id, name: name!, year, gender: genders.length === 1 ? genders[0] : undefined, ...meta });
      }
    }

    const difficulty = difficultyScale(people.map((p) => p.sitelinks));
    const items: Trivia[] = people.map((p) => {
      const verb = p.gender === FEMALE ? "née" : p.gender === MALE ? "né" : "né(e)";
      return {
        id: `naissance-${p.id}`,
        family: "naissance",
        category: p.category,
        wikidata: entityUrl(p.id),
        prompt: `En quelle année est ${verb} ${p.name} ?`,
        answer: text(String(p.year)),
        distractors: yearDistractors(p.year, `naissance:${p.id}`).map((y) => text(String(y))),
        difficulty: difficulty(p.sitelinks),
      };
    });
    return { items, rejected };
  },
};

function yearOf(timeValue: string): number {
  const m = /^([+-]?\d+)-/.exec(timeValue);
  return Number(m![1]);
}

function nearNewYear(timeValue: string): boolean {
  const m = /^[+-]?\d+-(\d{2})-(\d{2})/.exec(timeValue);
  if (!m) return false;
  const [mo, d] = [Number(m[1]), Number(m[2])];
  return (mo === 1 && d <= 14) || (mo === 12 && d >= 18);
}

/** Three distinct years within ±12 of the answer, never in the future. */
export function yearDistractors(year: number, seed: string): number[] {
  const r = rng(seed);
  const max = 2026;
  const out = new Set<number>();
  while (out.size < 3) {
    const offset = 1 + Math.floor(r() * 12);
    const y = r() < 0.5 ? year - offset : year + offset;
    if (y !== year && y > 0 && y <= max) out.add(y);
  }
  return [...out];
}
