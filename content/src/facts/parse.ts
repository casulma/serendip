import { createHash } from "node:crypto";
import { normalizeTitle } from "../lib/mediawiki.js";

export type RawAnecdote = {
  id: string;
  year: number;
  wikitext: string;
  mainArticle: string | undefined;
  mainDisplay: string | undefined;
  publishedOn: string | undefined;
};

const MONTHS: Record<string, string> = {
  janvier: "01", "février": "02", mars: "03", avril: "04", mai: "05", juin: "06",
  juillet: "07", "août": "08", septembre: "09", octobre: "10", novembre: "11", "décembre": "12",
};

/** Date the anecdote reached the home page, from its "*:<small>présente…" line. */
export function parsePublishedOn(line: string): string | undefined {
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(line);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /du (\d{1,2})(?:er)? (\p{L}+) (\d{4})/u.exec(line);
  const month = m && MONTHS[m[2]!.toLowerCase()];
  if (m && month) return `${m[3]}-${month}-${m[1]!.padStart(2, "0")}`;
  return undefined;
}

/**
 * The anecdote's subject: the first wikilink inside bold markup
 * ('''[[X]]''', '''''[[X|Y]]''''', or '''[[X]]s''').
 */
export function findMainArticle(wikitext: string): string | undefined {
  const noFiles = wikitext.replace(/\[\[\s*(Fichier|Image|File)\s*:[^\]]*(\[\[[^\]]*\]\][^\]]*)*\]\]/gi, "");
  const candidates = [
    // '''[[X]]''', '''l’[[X]]''', '''{{nobr|''[[X]]''}}'''
    /'''+\s*(?:[^'\[\]]{0,20}|\{\{[^|}]{1,15}\|'*)\[\[([^\]|#]+)/,
    // [[X|'''Y''']]
    /\[\[([^\]|#]+)\|[^\]]*'''/,
    // '''{{page h'|X}}'''
    /'''+\s*\{\{page h'\|([^|}]+)/i,
  ];
  const hits = candidates
    .map((re) => re.exec(noFiles))
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => a.index - b.index);
  const m = hits[0];
  if (!m) return undefined;
  const title = m[1]!.trim();
  if (/^(Fichier|Image|File|Catégorie|Category|Portail|Wikipédia):/i.test(title)) return undefined;
  return normalizeTitle(title.replace(/^:/, ""));
}

/**
 * The displayed text of the main link, only for the plain forms
 * '''[[X]]''', '''[[X|Y]]''', '''''[[X|Y]]''''' and [[X|'''Y''']].
 * Anything fancier (prefix inside the bold, link trail, template) returns
 * undefined: such facts get no cloze question.
 */
export function findMainDisplay(wikitext: string): string | undefined {
  const noFiles = wikitext.replace(/\[\[\s*(Fichier|Image|File)\s*:[^\]]*(\[\[[^\]]*\]\][^\]]*)*\]\]/gi, "");
  const bold = /('{3,5})\[\[([^\]|#]+)(?:\|([^\]\[{}']+))?\]\]\1(?!\p{L})/u.exec(noFiles);
  const inner = /\[\[([^\]|#]+)\|('{3,5})([^\]\[{}']+)\2\]\]/.exec(noFiles);
  const hit = [bold && { index: bold.index, text: bold[3] ?? bold[2]! }, inner && { index: inner.index, text: inner[3]! }]
    .filter((x): x is { index: number; text: string } => !!x)
    .sort((a, b) => a.index - b.index)[0];
  return hit?.text.trim();
}

function hashId(year: number, wikitext: string): string {
  const norm = wikitext.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
  return createHash("sha1").update(`${year}\0${norm}`).digest("hex").slice(0, 12);
}

/** Split one yearly archive page into anecdotes, in page order. */
export function parseArchive(year: number, text: string): RawAnecdote[] {
  const out: RawAnecdote[] = [];
  for (const line of text.split("\n")) {
    if (/^\*:/.test(line)) {
      const last = out[out.length - 1];
      if (last && !last.publishedOn) last.publishedOn = parsePublishedOn(line);
      continue;
    }
    if (!/^\*\s/.test(line)) continue;
    const body = line.replace(/^\*\s*/, "");
    const idMatch = /<!--\s*@ID_(\d+)\s*-->/.exec(body);
    out.push({
      // Wikipedia's own proposal id is stable across edits; older entries fall
      // back to a content hash scoped to the archive year.
      id: idMatch ? `lsv-${idMatch[1]}` : `lsv-${year}-${hashId(year, body)}`,
      year,
      wikitext: body,
      mainArticle: findMainArticle(body),
      mainDisplay: findMainDisplay(body),
      publishedOn: undefined,
    });
  }
  return out;
}
