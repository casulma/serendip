import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBuffer } from "../../lib/http.js";
import { sample } from "../../lib/random.js";
import { entityUrl, hasFrenchLabel, qid, sparql } from "../../lib/sparql.js";
import type { Trivia } from "../../schema.js";
import { difficultyScale, distinct, groupBy, text, type Family, type Rejection } from "../family.js";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "out", "assets");
// Commons renders SVG flags to PNG thumbnails server side: no image tooling needed here.
const WIDTH = 160;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const QUERY = `
SELECT ?country ?countryLabel ?flag ?continent ?sitelinks WHERE {
  ?country wdt:P31 wd:Q3624078; wikibase:sitelinks ?sitelinks.
  FILTER NOT EXISTS { ?country wdt:P576 [] }
  OPTIONAL { ?country wdt:P41 ?flag }
  OPTIONAL { ?country wdt:P30 ?continent }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
} ORDER BY ?country ?flag ?continent`;

type Country = { id: string; name: string; image: string; continents: string[]; sitelinks: number };

export const drapeau: Family = {
  id: "drapeau",
  label: "Drapeau d'un pays",
  category: "geographie",
  async build() {
    const rejected: Rejection[] = [];
    const countries: Country[] = [];
    await mkdir(join(ASSETS, "flags"), { recursive: true });

    for (const [uri, g] of groupBy(await sparql(QUERY), (r) => r.country!)) {
      const id = qid(uri);
      const name = g[0]!.countryLabel;
      const flags = distinct(g.map((r) => r.flag));
      if (!hasFrenchLabel(name)) { rejected.push({ id, reason: "pas de libellé fr" }); continue; }
      if (flags.length !== 1) { rejected.push({ id, reason: flags.length ? "plusieurs drapeaux" : "pas de drapeau" }); continue; }
      // P41 values are Special:FilePath URLs; ?width asks Commons for a PNG thumbnail.
      const png = await fetchBuffer(`${flags[0]!.replace(/^http:/, "https:")}?width=${WIDTH}`);
      if (!png.subarray(0, 4).equals(PNG_MAGIC)) { rejected.push({ id, reason: "vignette PNG indisponible" }); continue; }
      const image = `flags/${id}.png`;
      await writeFile(join(ASSETS, image), png);
      countries.push({
        id,
        name: name!,
        image,
        continents: distinct(g.map((r) => r.continent && qid(r.continent))),
        sitelinks: Number(g[0]!.sitelinks),
      });
    }

    const difficulty = difficultyScale(countries.map((c) => c.sitelinks));
    const items: Trivia[] = [];
    for (const c of countries) {
      // Same-continent distractors: telling Norway from Sweden is the interesting part.
      const others = countries.filter((o) => o.id !== c.id && o.name !== c.name);
      const near = others.filter((o) => o.continents.some((k) => c.continents.includes(k)));
      const pool = near.length >= 3 ? near : others;
      const [a, b] = [sample(pool, 3, `drapeau:${c.id}:pays`), sample(pool, 3, `drapeau:${c.id}:image`)];
      const base = { family: "drapeau", category: "geographie" as const, wikidata: entityUrl(c.id), difficulty: difficulty(c.sitelinks) };
      items.push({
        ...base,
        id: `drapeau-pays-${c.id}`,
        prompt: "À quel pays appartient ce drapeau ?",
        promptImage: c.image,
        answer: text(c.name),
        distractors: a.map((o) => text(o.name)),
      });
      items.push({
        ...base,
        id: `drapeau-image-${c.id}`,
        prompt: `Quel est le drapeau de ce pays : ${c.name} ?`,
        answer: { kind: "image", image: c.image, alt: `Drapeau : ${c.name}` },
        distractors: b.map((o) => ({ kind: "image" as const, image: o.image, alt: `Drapeau : ${o.name}` })),
      });
    }
    return { items, rejected };
  },
};
