import { describe, expect, it } from "vitest";
import { addDays, dayKey, daysBetween, formatDay } from "../src/domain/dates";
import { initialState, isDue, isLearned, review } from "../src/domain/leitner";
import { clampNotifications, feedLimit, feedRemaining } from "../src/domain/quota";
import { matches, normalize } from "../src/domain/search";

describe("dates", () => {
  it("uses local calendar days", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // across the DST change
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
    expect(formatDay("2026-11-01")).toBe("1er novembre 2026");
  });
});

describe("quota", () => {
  it("subtracts notifications from the feed", () => {
    expect(feedLimit(10, 0)).toBe(10);
    expect(feedLimit(10, 3)).toBe(7);
    expect(feedRemaining(10, 3, 5)).toBe(2);
    expect(feedRemaining(10, 3, 9)).toBe(0);
    expect(clampNotifications(5, 8)).toBe(5);
  });
});

describe("leitner", () => {
  it("follows 1/3/7/14/30 days and resets on failure", () => {
    let s = initialState("2026-10-27");
    expect(s).toEqual({ box: 1, dueDay: "2026-10-28" });
    s = review(s, true, "2026-10-28");
    expect(s).toEqual({ box: 2, dueDay: "2026-10-31" });
    s = review(s, true, "2026-10-31");
    s = review(s, true, "2026-11-07");
    s = review(s, true, "2026-11-21");
    expect(s).toEqual({ box: 5, dueDay: "2026-12-21" });
    expect(isLearned(s)).toBe(true);
    expect(review(s, true, "2026-12-21").box).toBe(5);
    expect(review(s, false, "2026-12-21")).toEqual({ box: 1, dueDay: "2026-12-22" });
    expect(isDue({ box: 1, dueDay: "2026-10-28" }, "2026-10-28")).toBe(true);
    expect(isDue({ box: 1, dueDay: "2026-10-28" }, "2026-10-27")).toBe(false);
  });
});

describe("search", () => {
  it("ignores case, accents and apostrophes", () => {
    expect(normalize("L’Écume  d'Ouranos")).toBe("l ecume d ouranos");
    expect(matches("L’écume dont naît Aphrodite", "ecume aphrodite")).toBe(true);
    expect(matches("L’écume dont naît Aphrodite", "zeus")).toBe(false);
    expect(matches("n'importe", "")).toBe(true);
  });
});
