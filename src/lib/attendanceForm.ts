// Reads the attendance form of one day (ATT-2). Pure: the query layer gets
// the marks ready to save.

import { ATTENDANCE_STATUSES, type AttendanceStatus } from "./attendance";

export type AttendanceMark = { studentId: string; status: AttendanceStatus };

/**
 * `get` reads `mark.<studentId>`. A student whose row wasn't on the page
 * sends nothing and is skipped, so they keep what they had (GROUP-6).
 */
export function parseAttendanceForm(
  get: (name: string) => string | null,
  studentIds: string[],
): { ok: true; marks: AttendanceMark[] } | { ok: false } {
  const marks: AttendanceMark[] = [];
  for (const studentId of studentIds) {
    const value = get(`mark.${studentId}`);
    if (value === null) continue;
    if (!(ATTENDANCE_STATUSES as readonly string[]).includes(value)) return { ok: false };
    marks.push({ studentId, status: value as AttendanceStatus });
  }
  return { ok: true, marks };
}
