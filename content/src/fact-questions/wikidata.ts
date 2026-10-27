import { hasFrenchLabel, qid, sparql } from "../lib/sparql.js";

export type Entity = {
  qid: string;
  label: string;
  types: string[];
  occupations: string[];
  sitelinks: number;
  /** For taxa: the biological class (rank Q37517) they belong to, e.g. birds. */
  taxonClass?: string;
};

const TAXON_TYPES = new Set(["Q16521", "Q23038290", "Q55983715"]);

const taxonClassQuery = (ids: string[]) => `
SELECT ?item ?class WHERE {
  VALUES ?item { ${ids.map((i) => `wd:${i}`).join(" ")} }
  ?item wdt:P171* ?class. ?class wdt:P105 wd:Q37517.
} ORDER BY ?item ?class`;

const BATCH = 150;
// Walking P171* is expensive: small batches stay under the 60 s query limit.
const TAXON_BATCH = 25;

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

  const taxa = [...new Set([...out.values()].filter((e) => e.types.some((t) => TAXON_TYPES.has(t))).map((e) => e.qid))].sort();
  const classes = new Map<string, string[]>();
  for (let i = 0; i < taxa.length; i += TAXON_BATCH) {
    for (const r of await sparql(taxonClassQuery(taxa.slice(i, i + TAXON_BATCH)))) {
      const id = qid(r.item!);
      classes.set(id, [...(classes.get(id) ?? []), qid(r.class!)]);
    }
  }
  for (const e of out.values()) {
    const c = classes.get(e.qid);
    // Several classes means inconsistent classification: leave it unset.
    if (c && new Set(c).size === 1) e.taxonClass = c[0];
  }
  return out;
}
