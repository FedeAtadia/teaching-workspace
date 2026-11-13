// FOLLOW-1..4: which students to follow up, and why. Pure: the query gathers
// each student's numbers for the cuatrimestre under way and this decides.

import { belowMinimum, termOfDate, type CalendarDates } from "./attendance";

export const DEFAULT_FOLLOW_UP_MISSING = 3;
/** FOLLOW-4: the range the teacher can set for tasks not handed in. */
export const FOLLOW_UP_MISSING_RANGE = { min: 1, max: 20 } as const;

export type FollowUpReason =
  | { kind: "attendance"; rate: number; minimum: number }
  | { kind: "average"; average: number; passMark: number }
  | { kind: "missing"; count: number };

export type FollowUpLimits = {
  /** GRADE-2..5: the pass mark that applies to the class. */
  passMark: number;
  /** SUGGEST-3: 0 turns the attendance reason off. */
  minAttendance: number;
  /** FOLLOW-4: from this many tasks not handed in. */
  missing: number;
};

/**
 * FOLLOW-1: why a student needs following up in a class, from their numbers
 * in one cuatrimestre: attendance below the minimum (ATT-4, SUGGEST-3), an
 * average of scored tasks below the pass mark (SUGGEST-1), or that many
 * tasks not handed in (SUGGEST-2). None of them means they are doing fine.
 */
export function followUpReasons(
  term: { average: number | null; missing: number; attendance: number | null },
  limits: FollowUpLimits,
): FollowUpReason[] {
  const reasons: FollowUpReason[] = [];
  if (term.attendance !== null && belowMinimum(term.attendance, limits.minAttendance)) {
    reasons.push({ kind: "attendance", rate: term.attendance, minimum: limits.minAttendance });
  }
  if (term.average !== null && term.average < limits.passMark) {
    reasons.push({ kind: "average", average: term.average, passMark: limits.passMark });
  }
  if (term.missing >= limits.missing) reasons.push({ kind: "missing", count: term.missing });
  return reasons;
}

/**
 * FOLLOW-2: the cuatrimestre under way for a class. With the school's
 * calendar it is the one today falls in, and none outside the school year;
 * without a calendar, the latest one with anything scored.
 */
export function currentTerm(today: string, calendar: CalendarDates | null, termsWithScores: readonly number[]): number | null {
  if (calendar) return termOfDate(today, calendar);
  return termsWithScores.length > 0 ? Math.max(...termsWithScores) : null;
}

/** FOLLOW-4: any other number of tasks is the default. */
export function resolveMissing(value: number | null | undefined): number {
  const { min, max } = FOLLOW_UP_MISSING_RANGE;
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : DEFAULT_FOLLOW_UP_MISSING;
}
