import { entityUrl, hasFrenchLabel, qid, sparql } from "../../lib/sparql.js";
import type { Trivia } from "../../schema.js";
import { groupBy, pickDistractors, text, type Family, type Rejection } from "../family.js";

// Area normalised to m² (psn:), non-deprecated statements only.
const QUERY = `
SELECT ?country ?countryLabel ?area ?rank ?sitelinks WHERE {
  ?country wdt:P31 wd:Q3624078; wikibase:sitelinks ?sitelinks.
  FILTER NOT EXISTS { ?country wdt:P576 [] }
  ?country p:P2046 ?st. ?st wikibase:rank ?rank. FILTER(?rank != wikibase:DeprecatedRank)
  ?st psn:P2046/wikibase:quantityAmount ?area.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
} ORDER BY ?country ?area`;

const PREFERRED = "http://wikiba.se/ontology#PreferredRank";
// Distractors are 35–85 % of the answer's area: a clear but non-trivial gap.
const MIN_RATIO = 0.35;
const MAX_RATIO = 0.85;
// Sources disagreeing by more than this make the country unusable.
const MAX_SPREAD = 0.05;

export const superficie: Family = {
  id: "superficie",
  label: "Pays le plus étendu",
  category: "geographie",
  async build() {
    const rejected: Rejection[] = [];
    const countries: { id: string; name: string; km2: number; sitelinks: number }[] = [];

    for (const [uri, g] of groupBy(await sparql(QUERY), (r) => r.country!)) {
      const id = qid(uri);
      const name = g[0]!.countryLabel;
      if (!hasFrenchLabel(name)) { rejected.push({ id, reason: "pas de libellé fr" }); continue; }
      const preferred = g.filter((r) => r.rank === PREFERRED);
      const values = (preferred.length > 0 ? preferred : g).map((r) => Number(r.area) / 1e6);
      const [min, max] = [Math.min(...values), Math.max(...values)];
      if (!(min > 0) || (max - min) / max > MAX_SPREAD) { rejected.push({ id, reason: "superficies divergentes" }); continue; }
      countries.push({ id, name: name!, km2: max, sitelinks: Number(g[0]!.sitelinks) });
    }

    const byName = new Map(countries.map((c) => [c.name, c.km2]));
    const items: Trivia[] = [];
    for (const c of countries) {
      const pool = countries.filter((o) => o.km2 >= c.km2 * MIN_RATIO && o.km2 <= c.km2 * MAX_RATIO).map((o) => o.name);
      const picks = pickDistractors(pool, c.name, `superficie:${c.id}`);
      if (picks.length < 3) { rejected.push({ id: c.id, reason: "pas assez de pays plus petits comparables" }); continue; }
      items.push({
        id: `superficie-${c.id}`,
        family: "superficie",
        category: "geographie",
        wikidata: entityUrl(c.id),
        prompt: "Lequel de ces pays a la plus grande superficie ?",
        answer: text(c.name),
        distractors: picks.map(text),
        difficulty: closeness(c.km2, picks.map((n) => byName.get(n)!)),
      });
    }
    return { items, rejected };
  },
};

/** The closer the largest distractor is to the answer, the harder the question. */
function closeness(answer: number, distractors: number[]): 1 | 2 | 3 {
  const ratio = Math.max(...distractors) / answer;
  return ratio > 0.75 ? 3 : ratio > 0.6 ? 2 : 1;
}
