/** Lowercase, accent- and apostrophe-insensitive form used for searching. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Every word of the query must appear in the text. */
export function matches(text: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const t = normalize(text);
  return q.split(" ").every((w) => t.includes(w));
}
