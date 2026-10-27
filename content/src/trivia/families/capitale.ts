import { entityUrl, hasFrenchLabel, qid, sparql } from "../../lib/sparql.js";
import type { Trivia } from "../../schema.js";
import { difficultyScale, distinct, groupBy, pickDistractors, text, type Family, type Rejection } from "../family.js";

// Sovereign states that still exist, with their capital(s) and continent(s).
const QUERY = `
SELECT ?country ?countryLabel ?capital ?capitalLabel ?continent ?sitelinks WHERE {
  ?country wdt:P31 wd:Q3624078; wikibase:sitelinks ?sitelinks.
  FILTER NOT EXISTS { ?country wdt:P576 [] }
  OPTIONAL { ?country wdt:P36 ?capital }
  OPTIONAL { ?country wdt:P30 ?continent }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
} ORDER BY ?country ?capital ?continent`;

export const capitale: Family = {
  id: "capitale",
  label: "Capitale d'un pays",
  category: "geographie",
  async build() {
    const rows = await sparql(QUERY);
    const rejected: Rejection[] = [];
    const countries: { id: string; name: string; capital: string; continents: string[]; sitelinks: number }[] = [];

    for (const [uri, g] of groupBy(rows, (r) => r.country!)) {
      const id = qid(uri);
      const name = g[0]!.countryLabel;
      const capitals = distinct(g.map((r) => r.capitalLabel));
      if (!hasFrenchLabel(name)) { rejected.push({ id, reason: "pas de libellé fr (pays)" }); continue; }
      if (capitals.length === 0) { rejected.push({ id, reason: "pas de capitale" }); continue; }
      if (capitals.length > 1) { rejected.push({ id, reason: "plusieurs capitales" }); continue; }
      if (!hasFrenchLabel(capitals[0])) { rejected.push({ id, reason: "pas de libellé fr (capitale)" }); continue; }
      if (capitals[0]!.toLowerCase() === name!.toLowerCase()) { rejected.push({ id, reason: "capitale homonyme du pays" }); continue; }
      countries.push({
        id,
        name: name!,
        capital: capitals[0]!,
        continents: distinct(g.map((r) => r.continent && qid(r.continent))),
        sitelinks: Number(g[0]!.sitelinks),
      });
    }

    const difficulty = difficultyScale(countries.map((c) => c.sitelinks));
    const items: Trivia[] = [];
    for (const c of countries) {
      // Prefer capitals from the same continent: "Paris / Berlin / Rome" beats "Paris / Lima / Hanoï".
      const others = countries.filter((o) => o.id !== c.id && o.capital !== c.capital);
      const near = others.filter((o) => o.continents.some((k) => c.continents.includes(k)));
      const pool = near.length >= 3 ? near : others;
      const picks = pickDistractors(pool.map((o) => o.capital), c.capital, `capitale:${c.id}`);
      items.push({
        id: `capitale-${c.id}`,
        family: "capitale",
        category: "geographie",
        wikidata: entityUrl(c.id),
        prompt: `Quelle est la capitale de ce pays : ${c.name} ?`,
        answer: text(c.capital),
        distractors: picks.map(text),
        difficulty: difficulty(c.sitelinks),
      });
    }
    return { items, rejected };
  },
};
