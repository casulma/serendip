import { addDays, type DayKey } from "./dates";

// Leitner system: 5 boxes, next review 1 / 3 / 7 / 14 / 30 days later.
// A success moves the fact up one box, a failure sends it back to box 1.
export const INTERVALS = [1, 3, 7, 14, 30] as const;
export const BOXES = INTERVALS.length;

export type Box = 1 | 2 | 3 | 4 | 5;

export type ReviewState = { box: Box; dueDay: DayKey };

/** State of a fact the day it is received. */
export function initialState(receivedDay: DayKey): ReviewState {
  return { box: 1, dueDay: addDays(receivedDay, INTERVALS[0]) };
}

export function review(state: ReviewState, success: boolean, today: DayKey): ReviewState {
  const box = (success ? Math.min(state.box + 1, BOXES) : 1) as Box;
  return { box, dueDay: addDays(today, INTERVALS[box - 1]) };
}

export const isDue = (state: ReviewState, today: DayKey) => state.dueDay <= today;

/** "Learned" for the stats: reached the last box. */
export const isLearned = (state: ReviewState) => state.box === BOXES;
