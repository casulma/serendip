import { cacheKey, fetchText, readCache, writeCache } from "./http.js";

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
export type ApiResponse = {
  continue?: Record<string, string>;
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: ApiPage[];
  };
};

type PageEntry = { title: string; text: string } | null;

// Per-title cache, so that reruns hit it whatever the batch composition.
const pageKey = (title: string) => cacheKey(`page:${title}`);

async function readPage(title: string): Promise<PageEntry | undefined> {
  const buf = await readCache(pageKey(title));
  return buf === undefined ? undefined : (JSON.parse(buf.toString("utf8")) as PageEntry);
}

export async function writePage(title: string, entry: PageEntry): Promise<void> {
  await writeCache(pageKey(title), Buffer.from(JSON.stringify(entry)));
}

/** Record every page of an api.php response under its requested and resolved titles. */
export async function storeApiResponse(res: ApiResponse, requested: string[]): Promise<Map<string, PageEntry>> {
  const resolve = new Map<string, string>();
  for (const r of [...(res.query?.normalized ?? []), ...(res.query?.redirects ?? [])]) resolve.set(r.from, r.to);
  const texts = new Map<string, string>();
  for (const p of res.query?.pages ?? []) {
    const content = p.revisions?.[0]?.slots.main.content;
    if (content !== undefined) texts.set(p.title, content);
  }
  const out = new Map<string, PageEntry>();
  for (const t of requested) {
    let target = t;
    for (let hop = 0; hop < 3 && resolve.has(target); hop++) target = resolve.get(target)!;
    const text = texts.get(target);
    const entry = text === undefined ? null : { title: target, text };
    out.set(t, entry);
    await writePage(t, entry);
  }
  return out;
}

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
  const missing: string[] = [];
  for (const t of wanted) {
    const cached = await readPage(t);
    if (cached === undefined) missing.push(t);
    else out.set(t, cached ?? undefined);
  }
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const merged: ApiResponse = { query: { normalized: [], redirects: [], pages: [] } };
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
      merged.query!.normalized!.push(...(res.query?.normalized ?? []));
      merged.query!.redirects!.push(...(res.query?.redirects ?? []));
      merged.query!.pages!.push(...(res.query?.pages ?? []));
      cont = res.continue;
    }
    for (const [t, e] of await storeApiResponse(merged, batch)) out.set(t, e ?? undefined);
    onBatch?.(wanted.length - missing.length + Math.min(i + BATCH, missing.length), wanted.length);
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
