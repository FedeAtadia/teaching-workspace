// A class's attendance (ATT-1..6). Scoped to one teacher (OWNER-1): every
// query first checks the class is this teacher's, along with its school's
// calendar for the year.

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { attendance, classGroups, classSessions, classes, courseStudents, schoolCalendars } from "@/db/schema";
import {
  allWeekdays,
  attendanceRate,
  cellFor,
  classDays,
  expectedStudents,
  termDates,
  termOfDate,
  type AttendanceCell,
  type AttendanceCounts,
  type AttendanceStatus,
  type CalendarDates,
  type ClassDay,
  type Session,
  type SessionReason,
} from "@/lib/attendance";
import { dayOffOn, expectedWeekdays, todayInArgentina, weekdayOf, type DayOff } from "@/lib/calendar";
import type { AttendanceMark } from "@/lib/attendanceForm";
import { listDaysOff } from "./calendar";
import { listClassStudents, type ClassDetail, type RosterStudent } from "./classDetail";
import { getStudentGroups } from "./groups";

type Cls = Pick<ClassDetail, "id" | "courseId" | "schoolId" | "academicYearId" | "weekdays">;

type NotFound = { ok: false; error: "notFound" };
const notFound: NotFound = { ok: false, error: "notFound" };
type NoCalendar = { ok: false; error: "noCalendar" };
const noCalendar: NoCalendar = { ok: false, error: "noCalendar" };
const outsideYear = { ok: false, error: "outsideYear" } as const;

/** The class's school calendar for its year (CAL-1, ATT-6), once the class is known to be this teacher's. */
async function loadCalendar(
  db: Db,
  teacherId: string,
  cls: Cls,
): Promise<NotFound | NoCalendar | { ok: true; calendar: CalendarDates; daysOff: DayOff[] }> {
  const [row] = await db
    .select({
      calendarId: schoolCalendars.id,
      startsOn: schoolCalendars.startsOn,
      term2StartsOn: schoolCalendars.term2StartsOn,
      endsOn: schoolCalendars.endsOn,
    })
    .from(classes)
    .leftJoin(
      schoolCalendars,
      and(
        eq(schoolCalendars.schoolId, cls.schoolId),
        eq(schoolCalendars.academicYearId, cls.academicYearId),
        eq(schoolCalendars.teacherId, teacherId),
      ),
    )
    .where(and(eq(classes.id, cls.id), eq(classes.teacherId, teacherId)));
  if (!row) return notFound;
  if (!row.calendarId || !row.startsOn || !row.term2StartsOn || !row.endsOn) return noCalendar;
  const daysOff = await listDaysOff(db, teacherId, row.calendarId);
  return { ok: true, calendar: { startsOn: row.startsOn, term2StartsOn: row.term2StartsOn, endsOn: row.endsOn }, daysOff };
}

/** CAL-4: each group's own days of the week. */
async function groupWeekdays(db: Db, teacherId: string, classId: string): Promise<Map<string, number[]>> {
  const rows = await db
    .select({ id: classGroups.id, weekdays: classGroups.weekdays })
    .from(classGroups)
    .where(and(eq(classGroups.classId, classId), eq(classGroups.teacherId, teacherId)));
  return new Map(rows.map((g) => [g.id, g.weekdays]));
}

type SessionRow = Session & { id: string };

async function listSessions(db: Db, teacherId: string, classId: string, from: string, to: string) {
  return db
    .select({
      id: classSessions.id,
      date: classSessions.date,
      held: classSessions.held,
      reason: classSessions.reason,
      note: classSessions.note,
    })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classId, classId),
        eq(classSessions.teacherId, teacherId),
        gte(classSessions.date, from),
        lte(classSessions.date, to),
      ),
    )
    .orderBy(asc(classSessions.date)) as Promise<SessionRow[]>;
}

/** Every saved mark of the class between two dates. Only held days have marks (ATT-3). */
async function listMarks(db: Db, teacherId: string, classId: string, from: string, to: string) {
  return db
    .select({ date: classSessions.date, studentId: attendance.studentId, status: attendance.status })
    .from(attendance)
    .innerJoin(classSessions, eq(attendance.sessionId, classSessions.id))
    .where(
      and(
        eq(classSessions.classId, classId),
        eq(attendance.teacherId, teacherId),
        gte(classSessions.date, from),
        lte(classSessions.date, to),
      ),
    );
}

export type AttendanceSheetRow = { student: RosterStudent; cells: AttendanceCell[]; counts: AttendanceCounts };
export type AttendanceSheet = {
  ok: true;
  /** The cuatrimestre shown: the one asked for, or today's (1° before the year starts). */
  position: 1 | 2;
  calendar: CalendarDates;
  /** CAL-4: whether the class or any of its groups has days of the week. */
  hasWeekdays: boolean;
  days: ClassDay[];
  rows: AttendanceSheetRow[];
};

/**
 * ATT-1, ATT-4, ATT-5: one cuatrimestre of the class, or of one of its
 * groups (GROUP-6): that group's students and days, plus make-up dates.
 */
export async function getAttendanceSheet(
  db: Db,
  teacherId: string,
  cls: Cls,
  requested: number | undefined,
  groupId?: string,
): Promise<AttendanceSheet | NotFound | NoCalendar> {
  const loaded = await loadCalendar(db, teacherId, cls);
  if (!loaded.ok) return loaded;
  const position =
    requested === 1 || requested === 2
      ? requested
      : (termOfDate(todayInArgentina(), loaded.calendar) ?? (todayInArgentina() > loaded.calendar.endsOn ? 2 : 1));
  const { from, to } = termDates(loaded.calendar, position);
  const [roster, groups, studentGroups, sessions, marks] = await Promise.all([
    listClassStudents(db, teacherId, cls),
    groupWeekdays(db, teacherId, cls.id),
    getStudentGroups(db, teacherId, cls.id),
    listSessions(db, teacherId, cls.id, from, to),
    listMarks(db, teacherId, cls.id, from, to),
  ]);

  const group = groupId && groups.has(groupId) ? groupId : undefined;
  const students = group ? roster.filter((s) => studentGroups.get(s.id) === group) : roster;
  const everyDay = allWeekdays(cls.weekdays, groups.values());
  const weekdays = group ? expectedWeekdays(cls.weekdays, groups.get(group)) : everyDay;
  const markOf = new Map(marks.map((m) => [`${m.studentId}:${m.date}`, m.status]));
  const shownIds = new Set(students.map((s) => s.id));
  // With a group shown, a recorded date counts when it is the group's day,
  // a make-up date (nobody's day), or one of its students has a mark on it.
  const shownSessions = group
    ? sessions.filter(
        (s) =>
          weekdays.includes(weekdayOf(s.date)) ||
          !everyDay.includes(weekdayOf(s.date)) ||
          marks.some((m) => m.date === s.date && shownIds.has(m.studentId)),
      )
    : sessions;
  const days = classDays({ from, to, weekdays, daysOff: loaded.daysOff, sessions: shownSessions });

  const rows = students.map((student) => {
    const member = [{ id: student.id, groupId: studentGroups.get(student.id) }];
    const cells = days.map((d) =>
      cellFor(
        d.state,
        expectedStudents(d.date, cls.weekdays, groups, member).length > 0,
        markOf.get(`${student.id}:${d.date}`) ?? null,
      ),
    );
    const counts = attendanceRate(marks.filter((m) => m.studentId === student.id).map((m) => m.status));
    return { student, cells, counts };
  });
  return { ok: true, position, calendar: loaded.calendar, hasWeekdays: everyDay.length > 0, days, rows };
}

export type AttendanceDayRow = { student: RosterStudent; groupId: string | undefined; status: AttendanceStatus | null };
export type AttendanceDay = {
  ok: true;
  date: string;
  term: 1 | 2;
  dayOff: DayOff | null;
  session: Session | null;
  rows: AttendanceDayRow[];
};

/** ATT-2: the students expected on a date, and anyone else with a mark saved on it. */
export async function getAttendanceDay(
  db: Db,
  teacherId: string,
  cls: Cls,
  date: string,
): Promise<AttendanceDay | NotFound | NoCalendar | typeof outsideYear> {
  const loaded = await loadCalendar(db, teacherId, cls);
  if (!loaded.ok) return loaded;
  const term = termOfDate(date, loaded.calendar);
  if (term === null) return outsideYear;
  const [roster, groups, studentGroups, [session], marks] = await Promise.all([
    listClassStudents(db, teacherId, cls),
    groupWeekdays(db, teacherId, cls.id),
    getStudentGroups(db, teacherId, cls.id),
    listSessions(db, teacherId, cls.id, date, date),
    listMarks(db, teacherId, cls.id, date, date),
  ]);
  const markOf = new Map(marks.map((m) => [m.studentId, m.status]));
  const expected = new Set(
    expectedStudents(
      date,
      cls.weekdays,
      groups,
      roster.map((s) => ({ id: s.id, groupId: studentGroups.get(s.id) })),
    ),
  );
  const rows = roster
    .filter((s) => expected.has(s.id) || markOf.has(s.id))
    .map((student) => ({ student, groupId: studentGroups.get(student.id), status: markOf.get(student.id) ?? null }));
  return {
    ok: true,
    date,
    term,
    dayOff: dayOffOn(date, loaded.daysOff),
    session: session ? { date: session.date, held: session.held, reason: session.reason, note: session.note } : null,
    rows,
  };
}

/** The date's session, created or reset: `held` with no reason, or not held with one (ATT-2, ATT-3). */
async function upsertSession(
  tx: Db,
  teacherId: string,
  classId: string,
  date: string,
  state: { held: boolean; reason: SessionReason | null; note: string | null },
): Promise<string> {
  const [row] = await tx
    .insert(classSessions)
    .values({ teacherId, classId, date, ...state })
    .onConflictDoUpdate({ target: [classSessions.classId, classSessions.date], set: state })
    .returning({ id: classSessions.id });
  return row.id;
}

/** ATT-2: saves the marks sent, for active students of the course; the day is held. */
export async function saveAttendance(
  db: Db,
  teacherId: string,
  cls: Cls,
  date: string,
  marks: AttendanceMark[],
): Promise<{ ok: true } | NotFound | NoCalendar | typeof outsideYear> {
  const loaded = await loadCalendar(db, teacherId, cls);
  if (!loaded.ok) return loaded;
  if (termOfDate(date, loaded.calendar) === null) return outsideYear;
  const ids = marks.map((m) => m.studentId);
  const active =
    ids.length === 0
      ? []
      : await db
          .select({ id: courseStudents.studentId })
          .from(courseStudents)
          .where(
            and(
              eq(courseStudents.courseId, cls.courseId),
              eq(courseStudents.teacherId, teacherId),
              eq(courseStudents.status, "active"),
              inArray(courseStudents.studentId, ids),
            ),
          );
  const allowed = new Set(active.map((a) => a.id));
  const save = marks.filter((m) => allowed.has(m.studentId));

  await db.transaction(async (tx) => {
    const sessionId = await upsertSession(tx, teacherId, cls.id, date, { held: true, reason: null, note: null });
    if (save.length > 0) {
      await tx
        .insert(attendance)
        .values(save.map((m) => ({ teacherId, sessionId, ...m })))
        .onConflictDoUpdate({
          target: [attendance.sessionId, attendance.studentId],
          set: { status: sql`excluded.status` },
        });
    }
  });
  return { ok: true };
}

/** ATT-3: the day wasn't held; its marks go. */
export async function saveNoClass(
  db: Db,
  teacherId: string,
  cls: Cls,
  input: { date: string; reason: SessionReason; note: string | null },
): Promise<{ ok: true } | NotFound | NoCalendar | typeof outsideYear> {
  const loaded = await loadCalendar(db, teacherId, cls);
  if (!loaded.ok) return loaded;
  if (termOfDate(input.date, loaded.calendar) === null) return outsideYear;
  await db.transaction(async (tx) => {
    const sessionId = await upsertSession(tx, teacherId, cls.id, input.date, {
      held: false,
      reason: input.reason,
      note: input.note,
    });
    await tx.delete(attendance).where(eq(attendance.sessionId, sessionId));
  });
  return { ok: true };
}

/** ATT-3: back to pending, marks and all (ON DELETE CASCADE). */
export async function clearDay(db: Db, teacherId: string, cls: Cls, date: string): Promise<{ ok: true } | NotFound> {
  const loaded = await loadCalendar(db, teacherId, cls);
  if (!loaded.ok && loaded.error === "notFound") return notFound;
  await db
    .delete(classSessions)
    .where(and(eq(classSessions.classId, cls.id), eq(classSessions.teacherId, teacherId), eq(classSessions.date, date)));
  return { ok: true };
}

/** ATT-4, SUGGEST-3: each student's attendance in the cuatrimestre; students with no marks are absent. */
export async function getAttendanceRates(
  db: Db,
  teacherId: string,
  cls: Cls,
  position: number,
): Promise<Map<string, AttendanceCounts>> {
  const loaded = await loadCalendar(db, teacherId, cls);
  if (!loaded.ok) return new Map();
  const { from, to } = termDates(loaded.calendar, position);
  const marks = await listMarks(db, teacherId, cls.id, from, to);
  const byStudent = new Map<string, AttendanceStatus[]>();
  for (const m of marks) byStudent.set(m.studentId, [...(byStudent.get(m.studentId) ?? []), m.status]);
  return new Map([...byStudent].map(([id, list]) => [id, attendanceRate(list)]));
}
