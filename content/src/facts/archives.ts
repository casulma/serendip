import { rawPage } from "../lib/mediawiki.js";

const ROOT = "Wikipédia:Le saviez-vous ?/Archives";

export type ArchivePage = { year: number; title: string; text: string };

/**
 * All yearly archive pages, oldest first. The year list is read from the
 * archive navigation template; the current year lives on the root page.
 */
export async function fetchArchives(): Promise<ArchivePage[]> {
  const nav = await rawPage(`${ROOT}/Années`);
  if (!nav) throw new Error("archive index not found");

  const pages: { year: number; title: string }[] = [];
  for (const m of nav.text.matchAll(/\[\[(Wikipédia:Le saviez-vous \?\/Archives(?:\/\d{4})?)\|(\d{4})\]\]/g)) {
    pages.push({ title: m[1]!, year: Number(m[2]) });
  }
  pages.sort((a, b) => a.year - b.year);

  const out: ArchivePage[] = [];
  for (const p of pages) {
    const page = await rawPage(p.title);
    if (!page) throw new Error(`archive page missing: ${p.title}`);
    out.push({ ...p, text: page.text });
  }
  return out;
}
