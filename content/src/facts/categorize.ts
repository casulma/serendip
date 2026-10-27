import type { CategoryId } from "../categories.js";

/** Portal names declared by an article, in order: {{Portail|a|b}} and legacy {{Portail a}}. */
export function extractPortals(wikitext: string): string[] {
  const out: string[] = [];
  for (const m of wikitext.matchAll(/\{\{\s*[Pp]ortail\s*(\|[^}]*|[^|}]+)\}\}/g)) {
    const body = m[1]!;
    const names = body.startsWith("|") ? body.slice(1).split("|") : [body];
    for (const n of names) {
      const name = n.trim();
      if (name && !name.includes("=")) out.push(normalizePortal(name));
    }
  }
  return [...new Set(out)];
}

export function normalizePortal(name: string): string {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * `strong` portals are thematic (chimie, football…) and decide the category.
 * `weak` portals give context only (a country, a city, a decade) and are used
 * when no strong portal matches.
 */
export type PortalMapping = { strong: Record<string, CategoryId>; weak: Record<string, CategoryId> };

export type Categorization =
  | { category: CategoryId; portals: string[] }
  | { category: undefined; portals: string[]; reason: "aucun portail" | "aucun portail reconnu" };

/**
 * Majority vote over the article's mapped portals. Earlier portals win ties:
 * editors usually list the most specific one first.
 */
export function categorize(portals: string[], mapping: PortalMapping): Categorization {
  if (portals.length === 0) return { category: undefined, portals, reason: "aucun portail" };
  const best = vote(portals, mapping.strong) ?? vote(portals, mapping.weak);
  return best ? { category: best, portals } : { category: undefined, portals, reason: "aucun portail reconnu" };
}

function vote(portals: string[], mapping: Record<string, CategoryId>): CategoryId | undefined {
  const votes = new Map<CategoryId, { count: number; first: number }>();
  portals.forEach((p, i) => {
    const c = mapping[p];
    if (!c) return;
    const v = votes.get(c);
    if (v) v.count++;
    else votes.set(c, { count: 1, first: i });
  });
  let best: CategoryId | undefined;
  let bestV = { count: 0, first: Infinity };
  for (const [c, v] of votes) {
    if (v.count > bestV.count || (v.count === bestV.count && v.first < bestV.first)) {
      best = c;
      bestV = v;
    }
  }
  return best;
}

// Time-sensitive wording: the claim may no longer hold. Tagging only, for later audit.
// `\b` is ASCII-only in JS regexes, so word boundaries are spelled out with \p{L}.
const word = (src: string) => new RegExp(`(?<!\\p{L})(?:${src})(?!\\p{L})`, "iu");
const MAY_CHANGE = [
  "actuellement",
  "aujourd[’']hui",
  "à ce jour",
  "de nos jours",
  "à l[’']heure actuelle",
  "encore (?:aujourd[’']hui|en activité|en service|utilisée?s?|vivante?s?)",
  "toujours",
  "(?:le|la|les) plus",
  "records?",
  "seule?s?",
  "unique",
  "dernière?s?",
].map(word);

/** The first time-sensitive expression found, if any. */
export function mayChange(text: string): string | undefined {
  for (const re of MAY_CHANGE) {
    const m = re.exec(text);
    if (m) return m[0].toLowerCase();
  }
  return undefined;
}
