import { sample } from "../lib/random.js";
import type { Question } from "../schema.js";
import type { Entity } from "./wikidata.js";

export const BLANK = "_____";
const HUMAN = "Q5";

export type ClozeInput = {
  factId: string;
  text: string;
  /** Displayed text of the main link, as it appears in `text`. */
  display: string;
  entity: Entity;
};

export type ClozeResult = { question: Omit<Question, "difficulty"> } | { reason: string };

const norm = (s: string) =>
  s
    .toLocaleLowerCase("fr")
    .replace(/^(le|la|les|l[’'])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

const isUpper = (s: string) => s.charAt(0) !== s.charAt(0).toLocaleLowerCase("fr");
const startsWithVowel = (s: string) => /^[aeiouyhàâäéèêëîïôöùûü]/i.test(s);

/** Escape for use inside a RegExp. */
const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Two entities are siblings if they share a type; people must also share an occupation. */
export function areSiblings(a: Entity, b: Entity): boolean {
  if (!a.types.some((t) => b.types.includes(t))) return false;
  if (a.types.includes(HUMAN)) return a.occupations.some((o) => b.occupations.includes(o));
  return true;
}

/**
 * Turn a fact into a fill-in-the-blank question by hiding its main entity.
 * `pool` holds candidate distractor entities (other facts' subjects).
 */
export function makeCloze(input: ClozeInput, pool: Entity[]): ClozeResult {
  const { text, display, entity } = input;
  if (norm(display) !== norm(entity.label)) return { reason: "texte affiché ≠ libellé Wikidata" };

  const occurrences = text.split(display).length - 1;
  if (occurrences !== 1) return { reason: occurrences === 0 ? "entité introuvable dans le texte" : "entité répétée dans le texte" };

  const masked = text.replace(display, BLANK);
  // Any significant word of the answer left in the text gives it away.
  const leak = display
    .split(/[\s’'-]+/)
    .filter((w) => w.length > 3)
    .some((w) => new RegExp(`(?<!\\p{L})${re(w)}(?!\\p{L})`, "iu").test(masked));
  if (leak) return { reason: "réponse devinable dans le texte" };

  const before = masked.slice(0, masked.indexOf(BLANK));
  const elided = /[’']$/.test(before);
  const upper = isUpper(display);

  const seen = new Set([norm(display)]);
  const candidates: string[] = [];
  for (const e of [...pool].sort((a, b) => a.qid.localeCompare(b.qid))) {
    if (e.qid === entity.qid || !areSiblings(entity, e)) continue;
    // Match the answer's form so that capitalisation or elision gives nothing away.
    // Proper nouns go with proper nouns; the display may be capitalised at sentence start.
    if (isUpper(e.label) !== isUpper(entity.label)) continue;
    const label = upper ? e.label.charAt(0).toLocaleUpperCase("fr") + e.label.slice(1) : e.label;
    if (elided && !startsWithVowel(label)) continue;
    if (seen.has(norm(label))) continue;
    if (new RegExp(`(?<!\\p{L})${re(norm(label))}(?!\\p{L})`, "iu").test(masked)) continue;
    seen.add(norm(label));
    candidates.push(label);
  }
  if (candidates.length < 3) return { reason: "moins de 3 distracteurs de même type" };

  return {
    question: {
      id: `${input.factId}-trou`,
      prompt: `Complétez : ${masked}`,
      answer: { kind: "text", text: display },
      distractors: sample(candidates, 3, `cloze:${input.factId}`).map((t) => ({ kind: "text" as const, text: t })),
    },
  };
}
