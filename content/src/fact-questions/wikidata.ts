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

// One hop of the taxonomy (parent taxon + rank). Walking P171* in a single
// query times out; hopping level by level with large batches is fast.
const parentsQuery = (ids: string[]) => `
SELECT ?item ?parent ?rank WHERE {
  VALUES ?item { ${ids.map((i) => `wd:${i}`).join(" ")} }
  OPTIONAL { ?item wdt:P171 ?parent }
  OPTIONAL { ?item wdt:P105 ?rank }
} ORDER BY ?item ?parent ?rank`;

const CLASS_RANK = "Q37517";
const MAX_DEPTH = 60;

const BATCH = 150;
const TAXON_BATCH = 200;

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
  const classes = await taxonClasses(taxa);
  for (const e of out.values()) {
    const c = classes.get(e.qid);
    // Several classes means inconsistent classification: leave it unset.
    if (c && new Set(c).size === 1) e.taxonClass = c[0];
  }
  return out;
}

/** Biological class(es) of each taxon, found by walking parent taxa level by level. */
async function taxonClasses(taxa: string[]): Promise<Map<string, string[]>> {
  const parents = new Map<string, string[]>();
  const ranks = new Map<string, string[]>();
  let frontier = taxa;
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const next = new Set<string>();
    for (let i = 0; i < frontier.length; i += TAXON_BATCH) {
      for (const r of await sparql(parentsQuery(frontier.slice(i, i + TAXON_BATCH)))) {
        const id = qid(r.item!);
        if (!parents.has(id)) parents.set(id, []);
        if (!ranks.has(id)) ranks.set(id, []);
        if (r.parent && !parents.get(id)!.includes(qid(r.parent))) parents.get(id)!.push(qid(r.parent));
        if (r.rank && !ranks.get(id)!.includes(qid(r.rank))) ranks.get(id)!.push(qid(r.rank));
      }
    }
    for (const id of frontier) for (const p of parents.get(id) ?? []) if (!parents.has(p)) next.add(p);
    frontier = [...next].sort();
  }

  const out = new Map<string, string[]>();
  for (const t of taxa) {
    const found = new Set<string>();
    const seen = new Set<string>();
    const stack = [t];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      // Stop at the class: higher ancestors are irrelevant.
      if (ranks.get(id)?.includes(CLASS_RANK)) { found.add(id); continue; }
      stack.push(...(parents.get(id) ?? []));
    }
    if (found.size > 0) out.set(t, [...found].sort());
  }
  return out;
}
