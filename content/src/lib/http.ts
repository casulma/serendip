import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Wikimedia requires a descriptive User-Agent with a contact point.
// https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
export const USER_AGENT =
  "Serendip/0.1 (https://github.com/casulma/serendip; personal offline trivia app) node-fetch";

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "cache");

// Minimum delay between two network requests to the same host.
const MIN_INTERVAL_MS: Record<string, number> = {
  "fr.wikipedia.org": 1000,
  "www.wikidata.org": 1000,
  "query.wikidata.org": 2000,
  "commons.wikimedia.org": 1000,
  "thumb.wikimedia.org": 500,
  "upload.wikimedia.org": 500,
  // OpenQuizzDB is a small volunteer project: stay gentle.
  "www.openquizzdb.org": 2000,
  "download.openquizzdb.org": 1000,
};
const DEFAULT_INTERVAL_MS = 1000;
// Shared egress IPs get throttled for minutes at a time: be patient on 429.
const MAX_RETRIES = 6;
const MAX_RATE_LIMIT_RETRIES = 40;

const lastRequestAt = new Map<string, number>();
// Requests are strictly serialised: one in flight at a time, all hosts included.
let queue: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function cacheKey(url: string, body?: string): string {
  return createHash("sha256").update(url).update("\0").update(body ?? "").digest("hex");
}

export async function readCache(key: string): Promise<Buffer | undefined> {
  try {
    return await readFile(join(CACHE_DIR, key.slice(0, 2), key));
  } catch {
    return undefined;
  }
}

export async function writeCache(key: string, data: Buffer): Promise<void> {
  const path = join(CACHE_DIR, key.slice(0, 2), key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

async function throttledFetch(url: string, init: RequestInit): Promise<Buffer> {
  const host = new URL(url).host;
  const interval = MIN_INTERVAL_MS[host] ?? DEFAULT_INTERVAL_MS;
  for (let attempt = 0; ; attempt++) {
    const wait = (lastRequestAt.get(host) ?? 0) + interval - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt.set(host, Date.now());

    const res = await fetch(url, {
      ...init,
      headers: { "user-agent": USER_AGENT, "accept-encoding": "gzip", ...init.headers },
    });
    if (res.ok) {
      const data = Buffer.from(await res.arrayBuffer());
      // MediaWiki reports replication lag as a 200 with an error body.
      if (res.headers.get("content-type")?.includes("json") && data.includes('"code":"maxlag"')) {
        if (attempt >= MAX_RETRIES) throw new Error(`maxlag persists for ${url}`);
        await sleep(5000 * (attempt + 1));
        continue;
      }
      return data;
    }
    const limit = res.status === 429 ? MAX_RATE_LIMIT_RETRIES : MAX_RETRIES;
    if ((res.status === 429 || res.status >= 500) && attempt < limit) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * 2 ** attempt, 120_000);
      console.warn(`[http] ${res.status} on ${host}, retry in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

/**
 * Fetch a URL, using the on-disk cache when available. Reruns of the pipeline
 * therefore hit the network only for what is missing. Pass `refresh` to bypass
 * the cache for this call.
 */
type FetchOptions = { method?: "GET" | "POST"; body?: string; headers?: Record<string, string>; refresh?: boolean };

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  return (await fetchBuffer(url, opts)).toString("utf8");
}

/** Same as fetchText, for binary content (images). */
export function fetchBuffer(url: string, opts: FetchOptions = {}): Promise<Buffer> {
  const key = cacheKey(url, opts.body);
  const run = async () => {
    if (!opts.refresh) {
      const cached = await readCache(key);
      if (cached !== undefined) return cached;
    }
    const data = await throttledFetch(url, {
      method: opts.method ?? "GET",
      body: opts.body,
      headers: opts.headers,
    });
    await writeCache(key, data);
    return data;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export async function fetchJson<T = unknown>(url: string, opts?: FetchOptions): Promise<T> {
  return JSON.parse(await fetchText(url, opts)) as T;
}
