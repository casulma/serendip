import { fetchText } from "../lib/http.js";

const SITE = "https://www.openquizzdb.org";

export type QuizRef = { id: number; title: string; author: string };
export type QuizPage = QuizRef & { category: string; jsonUrl: string };

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&Eacute;/g, "É")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à")
    .replace(/&middot;/g, "·")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Every quiz of the public listing, by id. */
export async function listQuizzes(): Promise<QuizRef[]> {
  const html = await fetchText(`${SITE}/listing/`);
  const out = new Map<number, QuizRef>();
  for (const m of html.matchAll(/title="Cliquez ici pour télécharger ce quizz rédigé par ([^"]+)" onclick="goq\((\d+)\)">([^<]+)</g)) {
    const id = Number(m[2]);
    out.set(id, { id, author: decode(m[1]!), title: decode(m[3]!) });
  }
  return [...out.values()].sort((a, b) => a.id - b.id);
}

/** The download page of a quiz: its category and the URL of its JSON file. */
export async function quizPage(ref: QuizRef): Promise<QuizPage | undefined> {
  const html = await fetchText(`${SITE}/download.php`, {
    method: "POST",
    body: `id=${ref.id}`,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `oqdb_down_${ref.id}=1`,
      referer: `${SITE}/listing.php`,
    },
  });
  const jsonUrl = new RegExp(`https://download\\.openquizzdb\\.org/[^"]*openquizzdb_${ref.id}\\.json`).exec(html)?.[0];
  const category = /CAT(?:&Eacute;|É)GORIE\s*(?:<[^>]*>\s*)*([^<]+)</.exec(html)?.[1];
  if (!jsonUrl) return undefined;
  return { ...ref, category: category ? decode(category) : "", jsonUrl };
}

export async function quizJson(page: QuizPage): Promise<unknown> {
  const text = await fetchText(page.jsonUrl, { headers: { referer: `${SITE}/download.php` } });
  // Some files contain raw tabs or line breaks inside strings, which JSON forbids.
  return JSON.parse(text.replace(/[\u0000-\u001f]/g, " "));
}
