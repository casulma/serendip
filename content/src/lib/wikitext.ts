// Mechanical wikitext → plain text conversion, limited to what appears in
// "Le saviez-vous ?" anecdotes. Anything we cannot render faithfully throws
// an UnsupportedWikitext error so the item is rejected (and reported), never
// rendered approximately.

export class UnsupportedWikitext extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

const NBSP = " ";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};

const superscript = (s: string) => [...s].map((c) => SUPERSCRIPT[c] ?? c).join("");

/** French number formatting as rendered by {{nombre}}/{{unité}}: "1234567.5" → "1 234 567,5". */
export function formatNumber(raw: string): string {
  const s = raw.trim().replace(/\s/g, "");
  const m = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(s);
  if (!m) return raw.trim();
  const [, sign, int, dec] = m;
  const grouped = int!.length > 4 ? int!.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) : int!;
  return `${sign}${grouped}${dec ? `,${dec}` : ""}`;
}

// ---------------------------------------------------------------- templates

type Params = { positional: string[]; named: Record<string, string> };

function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  let depthT = 0;
  let depthL = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === "{{") { depthT++; i++; continue; }
    if (two === "}}") { depthT--; i++; continue; }
    if (two === "[[") { depthL++; i++; continue; }
    if (two === "]]") { depthL--; i++; continue; }
    if (inner[i] === "|" && depthT === 0 && depthL === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}

function parseParams(parts: string[]): Params {
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const p of parts) {
    const m = /^\s*([\p{L}\d _-]+?)\s*=(.*)$/su.exec(p);
    if (m && !/^\d+$/.test(m[1]!)) named[m[1]!.toLowerCase()] = m[2]!.trim();
    else if (m) positional[Number(m[1]) - 1] = m[2]!.trim();
    else positional.push(p.trim());
  }
  return { positional, named };
}

const ROMAN = /^[IVXLC]+$/i;

function century(roman: string, suffix: string | undefined, word: string): string {
  const r = roman.trim().toUpperCase();
  if (!ROMAN.test(r)) throw new UnsupportedWikitext(`siècle illisible: ${roman}`);
  const sfx = suffix?.trim() || (r === "I" ? "er" : "e");
  return `${r}${sfx}${word}`;
}

function renderDate(p: string[]): string {
  const first = p[0]?.trim() ?? "";
  // New syntax: {{date|01.01.2019|…}} or {{date|2019-01-01}}.
  let m = /^(\d{1,2})\.(\d{1,2})\.(-?\d{1,4})$/.exec(first);
  if (m) return dayMonthYear(m[1]!, MONTHS[Number(m[2]) - 1], m[3]!);
  m = /^(-?\d{1,4})-(\d{2})-(\d{2})$/.exec(first);
  if (m) return dayMonthYear(m[3]!, MONTHS[Number(m[2]) - 1], m[1]!);
  // Classic syntax: {{date|1|janvier|1501}}; extra params are qualifiers.
  const bits: string[] = [];
  // An empty day ({{date||juin|2007}}) means "month and year only".
  for (const raw of p.slice(0, 3)) {
    const v = raw.trim();
    if (!v) continue;
    if (/^(en |dans |au |à )/i.test(v)) break;
    bits.push(v);
  }
  if (bits.length === 0) throw new UnsupportedWikitext("date vide");
  if (/^0?1$/.test(bits[0]!) && bits.length > 1) bits[0] = "1er";
  else bits[0] = bits[0]!.replace(/^0(\d)$/, "$1");
  return bits.join(" ");
}

function dayMonthYear(day: string, month: string | undefined, year: string): string {
  if (!month) throw new UnsupportedWikitext("mois invalide");
  const d = Number(day);
  return `${d === 1 ? "1er" : d} ${month} ${year}`;
}

function renderUnit(p: string[]): string {
  const [value, ...rest] = p;
  if (value === undefined) throw new UnsupportedWikitext("unité sans valeur");
  const out: string[] = [formatNumber(value)];
  for (let i = 0; i < rest.length; i++) {
    const u = rest[i]!.trim();
    if (!u) continue;
    const next = rest[i + 1]?.trim();
    if (next !== undefined && /^-?\d+$/.test(next)) {
      out.push(u + superscript(next));
      i++;
    } else {
      out.push(u);
    }
  }
  return out.join(NBSP);
}

const ABBREVIATIONS: Record<string, string> = {
  // Typographic apostrophe: a straight one would merge with ''' bold markup.
  "'": "’",
  dr: "Dr", mme: "Mme", "m.": "M.", "mm.": "MM.", pr: "Pr", "jr.": "Jr.", "sr.": "Sr.",
  "av jc": "av. J.-C.", "ap jc": "apr. J.-C.",
  "etc.": "etc.", "c.": "c.", circa: "vers", "v.": "v.", "p.": "p.",
  "n°": "no", "nº": "no", nos: "nos",
  "2": "²", "3": "³",
  clr: "", clear: "",
};

// Templates that display their first positional argument unchanged.
const IDENTITY = new Set([
  "nobr", "lnobr", "nobr romains", "lnobr rom", "graphie", "exp", "nb",
  "anglais", "latin", "allemand", "espagnol", "japonais", "persan", "grec ancien", "grec moderne", "lang-ru",
]);

// Templates that join their positional arguments with spaces (sovereign names…).
const JOINED = new Set([
  "noble", "noble-", "souverain", "souverain-", "souverain2", "souverain3",
  "monarque", "monarque-", "dynaste",
]);

function renderTemplate(nameRaw: string, args: Params): string {
  const name = nameRaw.trim().replace(/_/g, " ").replace(/\s+/g, " ").toLowerCase();
  const p = args.positional.map((x) => x ?? "");

  if (name in ABBREVIATIONS) return ABBREVIATIONS[name]!;
  if (name.startsWith("formatnum:")) return formatNumber(name.slice("formatnum:".length));
  if (IDENTITY.has(name)) return p[0] ?? "";
  if (JOINED.has(name)) return p.filter(Boolean).join(" ");

  switch (name) {
    case "lang":
    case "langue":
      return args.named["texte"] ?? p[1] ?? "";
    case "citation":
    case "cita":
    case "guillemets":
      return `«${NBSP}${p[0] ?? ""}${NBSP}»`;
    case "citation étrangère":
      return `«${NBSP}${args.named["texte"] ?? p[0] ?? ""}${NBSP}»`;
    case "incise":
      return `—${NBSP}${p[0] ?? ""}${NBSP}—`;
    case "abréviation discrète":
      return p[0] ?? "";
    case "page h'":
      return p[1] || p[0] || "";
    case "lien":
      return args.named["texte"] ?? args.named["fr"] ?? p[0] ?? "";
    case "nombre":
      return [formatNumber(p[0] ?? ""), ...p.slice(1).filter(Boolean)].join(NBSP);
    case "unité":
    case "unit":
      return renderUnit(p);
    case "température":
      return `${formatNumber(p[0] ?? "")}${NBSP}°C`;
    case "heure":
      return p[1] ? `${p[0]}${NBSP}h${NBSP}${p[1]}` : `${p[0]}${NBSP}h`;
    case "numéro":
      return `no${NBSP}${p[0] ?? ""}`.trim();
    case "numéros":
      return `nos${NBSP}${p[0] ?? ""}`.trim();
    case "date":
    case "date-":
      return renderDate(p);
    case "s":
    case "siècle":
      return century(p[0] ?? "", p[1], `${NBSP}siècle`);
    case "s-":
    case "s mini-":
    case "s mini":
      return century(p[0] ?? "", p[1], "");
    case "-s":
      return century(p[0] ?? "", p[1], `${NBSP}siècle av. J.-C.`);
    case "s2":
      return `${century(p[0] ?? "", undefined, "")} et ${century(p[1] ?? "", undefined, "")}${NBSP}siècles`;
    case "s2-":
      return `${century(p[0] ?? "", undefined, "")} et ${century(p[1] ?? "", undefined, "")}`;
    case "uss":
    case "hms":
      return `${name.toUpperCase()} ${p[0] ?? ""}`.trim();
  }

  // {{1er}}, {{2e}}, {{Ier}}, {{e}}, {{XIXe siècle}}, {{XV}}, {{1er janvier}}, {{Napoléon Ier}}…
  const ord = /^(\d+|[ivxlc]+)?(e|er|re|ère|ème|nd|nde)( siècle| dynastie.*)?$/i.exec(nameRaw.trim());
  if (ord) {
    const [, num = "", sfx, tail = ""] = ord;
    const n = ROMAN.test(num) ? num.toUpperCase() : num;
    return `${n}${sfx!.toLowerCase()}${tail.replace(" ", NBSP)}`;
  }
  if (/^[ivxlc]+$/i.test(nameRaw.trim())) return nameRaw.trim().toUpperCase();
  const firstOfMonth = /^1er (\p{L}+)$/u.exec(nameRaw.trim());
  if (firstOfMonth && MONTHS.includes(firstOfMonth[1]!.toLowerCase())) return `1er${NBSP}${firstOfMonth[1]}`;
  const ruler = /^(napoléon|françois) (i{1,3}e?r?)$/i.exec(nameRaw.trim());
  if (ruler) {
    const n = ruler[2]!.toUpperCase().replace(/ER$/, "er");
    return `${ruler[1]!.charAt(0).toUpperCase()}${ruler[1]!.slice(1).toLowerCase()} ${n}`;
  }

  throw new UnsupportedWikitext(`modèle non géré: ${name}`);
}

/** Expand every {{template}} (innermost first). */
export function expandTemplates(text: string): string {
  let out = text;
  for (let guard = 0; guard < 50; guard++) {
    // Innermost template: no braces inside.
    const m = /\{\{((?:(?!\{\{|\}\}).)*)\}\}/s.exec(out);
    if (!m) return out;
    const parts = splitTopLevel(m[1]!);
    const head = parts[0]!;
    if (head.trim().startsWith("#")) throw new UnsupportedWikitext("fonction parseur");
    const rendered = renderTemplate(head, parseParams(parts.slice(1)));
    out = out.slice(0, m.index) + rendered + out.slice(m.index + m[0].length);
  }
  throw new UnsupportedWikitext("modèles trop imbriqués");
}

// --------------------------------------------------------------- links etc.

/** Remove [[Fichier:…]] / [[Image:…]] blocks, which may contain nested links. */
export function stripFiles(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const m = /^\[\[\s*(Fichier|Image|File|Media)\s*:/i.exec(rest);
    if (!m) {
      out += text[i];
      i++;
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < text.length; j++) {
      if (text.startsWith("[[", j)) { depth++; j++; }
      else if (text.startsWith("]]", j)) { depth--; j++; if (depth === 0) break; }
    }
    i = j + 1;
  }
  return out;
}

const HTML_ENTITIES: Record<string, string> = {
  nbsp: NBSP, amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", thinsp: " ", ndash: "–", mdash: "—",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (all, n: string) => HTML_ENTITIES[n.toLowerCase()] ?? all);
}

/** Convert an anecdote's wikitext into plain text. */
export function toPlainText(wikitext: string): string {
  let s = wikitext;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  // 2004-era "(voir '''[[Article]]''')" pointers are navigation, not content.
  s = s.replace(/<small>\s*\(voir[\s\S]*?\)\s*<\/small>/gi, "");
  s = stripFiles(s);
  s = expandTemplates(s);
  // Image captions pointers: ''(photo)'', (''drapeau ci-contre''), ''(portrait ci-dessus)''…
  s = s.replace(/\s*\(\s*''[^'()]{1,40}''\s*\)/g, "").replace(/\s*''\s*\([^'()]{1,40}\)\s*''/g, "");
  s = s.replace(/\[\[:?([^\]|]*)\|([^\]]*)\]\](\p{Ll}*)/gu, "$2$3");
  s = s.replace(/\[\[:?([^\]|]*)\]\](\p{Ll}*)/gu, (_, t: string, trail: string) => t.replace(/#.*$/, "") + trail);
  s = s.replace(/\[(?:https?:)?\/\/\S+\s+([^\]]+)\]/g, "$1").replace(/\[(?:https?:)?\/\/\S+\]/g, "");
  s = s.replace(/'{2,}/g, "");
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<\/?(small|sup|sub|span|abbr|i|b|em|strong|nowiki|tt|code)[^>]*>/gi, "");
  if (/[<>]|\[\[|\]\]|\{\{|\}\}/.test(s)) throw new UnsupportedWikitext("balisage résiduel");
  s = decodeEntities(s);
  s = s.replace(/[ \t\r\n]+/g, " ").replace(/ ([,.])/g, "$1").trim();
  // A removed reference between two full stops leaves "..": keep ellipses intact.
  s = s.replace(/(?<!\.)\.\.$/, ".");
  return s;
}
