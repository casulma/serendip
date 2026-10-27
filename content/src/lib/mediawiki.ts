import { fetchText } from "./http.js";

// The api.php endpoint is aggressively rate-limited from shared cloud IPs;
// index.php?action=raw is enough for everything we need (raw wikitext).
const INDEX = "https://fr.wikipedia.org/w/index.php";

export function normalizeTitle(title: string): string {
  const t = title.replace(/_/g, " ").replace(/#.*$/, "").replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function articleUrl(title: string): string {
  return `https://fr.wikipedia.org/wiki/${encodeURIComponent(normalizeTitle(title).replace(/ /g, "_"))}`;
}

const API = "https://fr.wikipedia.org/w/api.php";
const BATCH = 50; // MediaWiki's per-request page limit for revision content

type ApiPage = { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] };
type ApiResponse = {
  continue?: Record<string, string>;
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: ApiPage[];
  };
};

/**
 * Raw wikitext of many articles, 50 per request, redirects resolved.
 * Keys are the requested (normalized) titles; missing pages map to `undefined`.
 * `onBatch` reports progress.
 */
export async function rawPages(
  titles: string[],
  onBatch?: (done: number, total: number) => void,
): Promise<Map<string, { title: string; text: string } | undefined>> {
  const wanted = [...new Set(titles.map(normalizeTitle))].sort();
  const out = new Map<string, { title: string; text: string } | undefined>();
  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const resolve = new Map<string, string>();
    const texts = new Map<string, string>();
    let cont: Record<string, string> | undefined = {};
    while (cont) {
      const params = new URLSearchParams({
        action: "query",
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        redirects: "1",
        format: "json",
        formatversion: "2",
        maxlag: "5",
        titles: batch.join("|"),
        ...cont,
      });
      const res: ApiResponse = JSON.parse(await fetchText(`${API}?${params}`));
      for (const r of [...(res.query?.normalized ?? []), ...(res.query?.redirects ?? [])]) resolve.set(r.from, r.to);
      for (const p of res.query?.pages ?? []) {
        const content = p.revisions?.[0]?.slots.main.content;
        if (content !== undefined) texts.set(p.title, content);
      }
      cont = res.continue;
    }
    for (const t of batch) {
      let target = t;
      for (let hop = 0; hop < 3 && resolve.has(target); hop++) target = resolve.get(target)!;
      const text = texts.get(target);
      out.set(t, text === undefined ? undefined : { title: target, text });
    }
    onBatch?.(Math.min(i + BATCH, wanted.length), wanted.length);
  }
  return out;
}

const REDIRECT_RE = /^#(?:REDIRECTION|REDIRECT)\s*\[\[([^\]|#]+)/i;

/** Raw wikitext of a page, following at most two redirects. Missing pages yield `undefined`. */
export async function rawPage(title: string): Promise<{ title: string; text: string } | undefined> {
  let current = normalizeTitle(title);
  for (let hop = 0; hop < 3; hop++) {
    const url = `${INDEX}?action=raw&title=${encodeURIComponent(current)}`;
    let text: string;
    try {
      text = await fetchText(url);
    } catch (e) {
      if (String(e).includes("HTTP 404")) return undefined;
      throw e;
    }
    const m = REDIRECT_RE.exec(text.trimStart());
    if (!m?.[1]) return { title: current, text };
    current = normalizeTitle(m[1]);
  }
  return undefined;
}
