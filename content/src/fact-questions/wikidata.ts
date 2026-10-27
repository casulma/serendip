import { hasFrenchLabel, qid, sparql } from "../lib/sparql.js";

export type Entity = { qid: string; label: string; types: string[]; occupations: string[]; sitelinks: number };

const BATCH = 150;

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

// Matching on the article *name* avoids guessing Wikidata's URL-encoding of titles.
const query = (titles: string[]) => `
SELECT ?title ?item ?itemLabel ?type ?occ ?sitelinks WHERE {
  VALUES ?title { ${titles.map((t) => `"${escape(t)}"@fr`).join(" ")} }
  ?article schema:name ?title; schema:isPartOf <https://fr.wikipedia.org/>; schema:about ?item.
  ?item wikibase:sitelinks ?sitelinks.
  OPTIONAL { ?item wdt:P31 ?type }
  OPTIONAL { ?item wdt:P106 ?occ }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
} ORDER BY ?title ?type ?occ`;

/** Wikidata item of each French article title (titles without an item are absent). */
export async function resolveArticles(titles: string[], onBatch?: (done: number, total: number) => void) {
  const wanted = [...new Set(titles)].sort();
  const out = new Map<string, Entity>();
  for (let i = 0; i < wanted.length; i += BATCH) {
    for (const r of await sparql(query(wanted.slice(i, i + BATCH)))) {
      const title = r.title!;
      let e = out.get(title);
      if (!e) {
        if (!hasFrenchLabel(r.itemLabel)) continue;
        e = { qid: qid(r.item!), label: r.itemLabel!, types: [], occupations: [], sitelinks: Number(r.sitelinks) };
        out.set(title, e);
      }
      if (r.type && !e.types.includes(qid(r.type))) e.types.push(qid(r.type));
      if (r.occ && !e.occupations.includes(qid(r.occ))) e.occupations.push(qid(r.occ));
    }
    onBatch?.(Math.min(i + BATCH, wanted.length), wanted.length);
  }
  return out;
}
