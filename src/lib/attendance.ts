// Attendance (ATT-1..5, SUGGEST-3). Pure: which days a class has, who is
// expected on one, and how marks add up to a percentage.

import { classDates, dayOffOn, expectedWeekdays, weekdayOf, type DayOff } from "./calendar";

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** ATT-3: why a day wasn't held. */
export const SESSION_REASONS = ["weather", "teacher_absent", "strike", "other"] as const;
export type SessionReason = (typeof SESSION_REASONS)[number];

export type CalendarDates = { startsOn: string; term2StartsOn: string; endsOn: string };

/** ATT-1: the 1° runs to the day before the 2° starts; the 2° to the end of classes. */
export function termDates(calendar: CalendarDates, position: number): { from: string; to: string } {
  if (position === 1) {
    const dayBefore = new Date(`${calendar.term2StartsOn}T00:00:00Z`);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    return { from: calendar.startsOn, to: dayBefore.toISOString().slice(0, 10) };
  }
  return { from: calendar.term2StartsOn, to: calendar.endsOn };
}

/** The cuatrimestre a date falls in, or null outside the school year (ATT-2). */
export function termOfDate(date: string, calendar: CalendarDates): 1 | 2 | null {
  if (date < calendar.startsOn || date > calendar.endsOn) return null;
  return date < calendar.term2StartsOn ? 1 : 2;
}

export type Session = { date: string; held: boolean; reason: SessionReason | null; note: string | null };
export type DayState = "off" | "pending" | "taken" | "notHeld";
export type ClassDay = { date: string; state: DayState; dayOff: DayOff | null; session: Session | null };

/**
 * ATT-1: the dates on `weekdays` from `from` to `to`, plus any other date
 * recorded in that range. What was recorded wins over a day off.
 */
export function classDays(input: {
  from: string;
  to: string;
  weekdays: readonly number[];
  daysOff: readonly DayOff[];
  sessions: readonly Session[];
}): ClassDay[] {
  const { from, to, weekdays, daysOff, sessions } = input;
  const byDate = new Map(sessions.filter((s) => from <= s.date && s.date <= to).map((s) => [s.date, s]));
  const dates = [...new Set([...classDates(from, to, weekdays), ...byDate.keys()])].sort();
  return dates.map((date) => {
    const session = byDate.get(date) ?? null;
    const dayOff = dayOffOn(date, daysOff);
    const state: DayState = session ? (session.held ? "taken" : "notHeld") : dayOff ? "off" : "pending";
    return { date, state, dayOff, session };
  });
}

/** Every day the class or any of its groups meets (CAL-4). */
export function allWeekdays(classWeekdays: readonly number[], groupWeekdays: Iterable<readonly number[]>): number[] {
  const days = new Set(classWeekdays);
  for (const g of groupWeekdays) for (const d of g) days.add(d);
  return [...days].sort((a, b) => a - b);
}

/**
 * ATT-2, CAL-4: the students expected on `date`, in the order given. On a
 * date that is none of the class's days (a make-up class) that is everyone.
 */
export function expectedStudents(
  date: string,
  classWeekdays: readonly number[],
  groupWeekdays: ReadonlyMap<string, readonly number[]>,
  students: readonly { id: string; groupId: string | undefined }[],
): string[] {
  const day = weekdayOf(date);
  if (!allWeekdays(classWeekdays, groupWeekdays.values()).includes(day)) return students.map((s) => s.id);
  return students
    .filter((s) => expectedWeekdays(classWeekdays, s.groupId ? groupWeekdays.get(s.groupId) : undefined).includes(day))
    .map((s) => s.id);
}

/** ATT-5: a mark, a day that isn't the student's, or nothing to show. */
export type AttendanceCell = AttendanceStatus | "notExpected" | null;

export function cellFor(state: DayState, expected: boolean, mark: AttendanceStatus | null): AttendanceCell {
  if (mark) return mark;
  if (!expected && (state === "pending" || state === "taken")) return "notExpected";
  return null;
}

export type AttendanceCounts = { present: number; absent: number; late: number; excused: number; rate: number | null };

/**
 * ATT-4. Justificado is left out entirely, so a long, certified illness
 * doesn't lower the percentage; a tarde is half an absence.
 */
export function attendanceRate(marks: readonly AttendanceStatus[]): AttendanceCounts {
  const count = (s: AttendanceStatus) => marks.filter((m) => m === s).length;
  const present = count("present");
  const absent = count("absent");
  const late = count("late");
  const excused = count("excused");
  const counted = present + absent + late;
  const rate = counted === 0 ? null : Math.round((100 * (counted - absent - late / 2)) / counted);
  return { present, absent, late, excused, rate };
}

/** SUGGEST-3: below the minimum; a minimum of 0 is off. */
export function belowMinimum(rate: number | null, minimum: number): boolean {
  return minimum > 0 && rate !== null && rate < minimum;
}
