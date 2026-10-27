import { entityUrl, hasFrenchLabel, qid, sparql } from "../../lib/sparql.js";
import type { Trivia } from "../../schema.js";
import { difficultyScale, distinct, groupBy, pickDistractors, text, type Family, type Rejection } from "../family.js";

// Current French departments, their prefecture (P36) and region.
const QUERY = `
SELECT ?dep ?depLabel ?code ?capital ?capitalLabel ?region ?sitelinks WHERE {
  ?dep wdt:P31 wd:Q6465; wikibase:sitelinks ?sitelinks.
  FILTER NOT EXISTS { ?dep wdt:P576 [] }
  OPTIONAL { ?dep wdt:P2586 ?code }
  OPTIONAL { ?dep wdt:P36 ?capital }
  OPTIONAL { ?dep wdt:P131 ?region. ?region wdt:P31 wd:Q36784 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
} ORDER BY ?dep ?capital ?region`;

export const chefLieu: Family = {
  id: "chef-lieu",
  label: "Chef-lieu d'un département",
  category: "geographie",
  async build() {
    const rows = await sparql(QUERY);
    const rejected: Rejection[] = [];
    const deps: { id: string; name: string; code?: string; capital: string; regions: string[]; sitelinks: number }[] = [];

    for (const [uri, g] of groupBy(rows, (r) => r.dep!)) {
      const id = qid(uri);
      const name = g[0]!.depLabel;
      const capitals = distinct(g.map((r) => r.capitalLabel));
      if (!hasFrenchLabel(name)) { rejected.push({ id, reason: "pas de libellé fr (département)" }); continue; }
      if (capitals.length !== 1) { rejected.push({ id, reason: capitals.length ? "plusieurs chefs-lieux" : "pas de chef-lieu" }); continue; }
      if (!hasFrenchLabel(capitals[0])) { rejected.push({ id, reason: "pas de libellé fr (chef-lieu)" }); continue; }
      deps.push({
        id,
        name: name!,
        code: g[0]!.code,
        capital: capitals[0]!,
        regions: distinct(g.map((r) => r.region && qid(r.region))),
        sitelinks: Number(g[0]!.sitelinks),
      });
    }

    const difficulty = difficultyScale(deps.map((d) => d.sitelinks));
    const items: Trivia[] = [];
    for (const d of deps) {
      const others = deps.filter((o) => o.id !== d.id && o.capital !== d.capital);
      const near = others.filter((o) => o.regions.some((r) => d.regions.includes(r)));
      const pool = near.length >= 3 ? near : others;
      const picks = pickDistractors(pool.map((o) => o.capital), d.capital, `chef-lieu:${d.id}`);
      items.push({
        id: `chef-lieu-${d.id}`,
        family: "chef-lieu",
        category: "geographie",
        wikidata: entityUrl(d.id),
        prompt: `Quel est le chef-lieu de ce département : ${d.name}${d.code ? ` (${d.code})` : ""} ?`,
        answer: text(d.capital),
        distractors: picks.map(text),
        difficulty: difficulty(d.sitelinks),
      });
    }
    return { items, rejected };
  },
};
