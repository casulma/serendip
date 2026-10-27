// Daily fact quota shared by the feed and notifications (docs/fonctionnel.md):
// with X notifications a day, the feed may reveal `total - X` facts.

export const DEFAULT_FACTS_PER_DAY = 10;
export const MAX_FACTS_PER_DAY = 30;

export function feedLimit(factsPerDay: number, notificationsPerDay: number): number {
  return Math.max(0, factsPerDay - notificationsPerDay);
}

export function feedRemaining(factsPerDay: number, notificationsPerDay: number, revealedByFeedToday: number): number {
  return Math.max(0, feedLimit(factsPerDay, notificationsPerDay) - revealedByFeedToday);
}

/** Notifications can never exceed the daily total. */
export function clampNotifications(factsPerDay: number, notificationsPerDay: number): number {
  return Math.min(Math.max(0, notificationsPerDay), factsPerDay);
}
