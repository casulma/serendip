// Days are local calendar days, keyed "YYYY-MM-DD": the daily quota resets at
// local midnight and Leitner intervals count in whole days.

export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Calendar arithmetic (not 24 h multiples), so DST changes do not shift days. */
export function addDays(key: DayKey, days: number): DayKey {
  const d = parseDay(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** "27 octobre 2026" */
export function formatDay(key: DayKey): string {
  const d = parseDay(key);
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
