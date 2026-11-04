// Checking a typed answer, QPUC style: forgiving on case, accents, articles,
// small typos and surname-only answers, strict on numbers.

const ARTICLES = /^(le|la|les|l|un|une|des|du|de|d|the)\s+/;

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", un: "1", une: "1", deux: "2", trois: "3", quatre: "4", cinq: "5", six: "6", sept: "7", huit: "8", neuf: "9",
  dix: "10", onze: "11", douze: "12", treize: "13", quatorze: "14", quinze: "15", seize: "16", vingt: "20", cent: "100", mille: "1000",
};

/** Lowercase, no accents or ligatures, punctuation as spaces. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Comparable form: normalized, leading article dropped, number words as digits. */
export function canonical(s: string): string {
  const n = normalize(s.replace(/\([^)]*\)/g, " "));
  return n
    .replace(ARTICLES, "")
    .split(" ")
    .map((w) => NUMBER_WORDS[w] ?? w)
    .join(" ");
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent swaps). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** Typos tolerated for a word of this length. */
const tolerance = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : len <= 12 ? 2 : 3);

export type Verdict = { correct: boolean; exact: boolean };

/** Accepted forms of an answer: itself, its variants, and a surname alone for a person's name. */
export function acceptedForms(answer: string, accept: string[]): string[] {
  const forms = [answer, ...accept].map(canonical);
  // "Marie Curie" → "Curie": a proper name of 2–3 words whose last word is long enough.
  const words = answer.trim().split(/\s+/);
  const last = canonical(words[words.length - 1] ?? "");
  if (words.length >= 2 && words.length <= 3 && /^\p{Lu}/u.test(answer) && last.length >= 4 && !/\d/.test(last)) forms.push(last);
  return [...new Set(forms.filter(Boolean))];
}

export function checkAnswer(input: string, answer: string, accept: string[] = []): Verdict {
  const given = canonical(input);
  if (!given) return { correct: false, exact: false };
  const forms = acceptedForms(answer, accept);
  if (forms.includes(given)) return { correct: true, exact: true };
  for (const f of forms) {
    // Numbers and short words must be exact: "1789" is not "1798".
    if (/\d/.test(f) || /\d/.test(given)) continue;
    if (editDistance(given, f) <= tolerance(f.length)) return { correct: true, exact: false };
  }
  return { correct: false, exact: false };
}
