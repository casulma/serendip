import { fetchText } from "./http.js";

const ENDPOINT = "https://query.wikidata.org/sparql";

type Binding = Record<string, { type: string; value: string; "xml:lang"?: string; datatype?: string }>;

/** Run a SPARQL query (cached like every other request). Values are returned as plain strings. */
export async function sparql(query: string): Promise<Record<string, string>[]> {
  const text = await fetchText(ENDPOINT, {
    method: "POST",
    body: new URLSearchParams({ query }).toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/sparql-results+json",
    },
  });
  const json = JSON.parse(text) as { results: { bindings: Binding[] } };
  return json.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

/** "http://www.wikidata.org/entity/Q90" → "Q90" */
export const qid = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

export const entityUrl = (id: string) => `https://www.wikidata.org/wiki/${id}`;

/** A label equal to the QID means Wikidata has no French label. */
export const hasFrenchLabel = (label: string | undefined) => !!label && !/^Q\d+$/.test(label);
