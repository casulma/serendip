// Same normalisation as the app's answer checker (app/src/domain/answer.ts):
// used here to check that an answer can be found in its Wikipédia article.
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
