// FOLLOW-1..4: the students to follow up, across the classes the teacher
// works with. Scoped to one teacher (OWNER-1). One round trip: five queries
// together, each already added up by Postgres.

import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  attendance,
  classSessions,
  classes,
  courseStudents,
  courses,
  schoolCalendars,
  schools,
  scores,
  students,
  tasks,
  teacherSettings,
  terms,
} from "@/db/schema";
import { attendanceRate, type AttendanceStatus } from "@/lib/attendance";
import { compareStudents } from "@/lib/courses";
import { currentTerm, followUpReasons, resolveMissing, type FollowUpReason } from "@/lib/followUp";
import { DEFAULT_RULES } from "@/lib/grading";

const DEFAULT_MIN_ATTENDANCE = 75;

export type FollowUpSettings = { enabled: boolean; missing: number };

/** FOLLOW-4 */
export async function getFollowUpSettings(db: Db, teacherId: string): Promise<FollowUpSettings> {
  const [row] = await db
    .select({ enabled: teacherSettings.followUp, missing: teacherSettings.followUpMissing })
    .from(teacherSettings)
    .where(eq(teacherSettings.teacherId, teacherId));
  return { enabled: row?.enabled ?? true, missing: resolveMissing(row?.missing) };
}

/** FOLLOW-4: already checked by `followUpInput`. */
export async function setFollowUpSettings(db: Db, teacherId: string, input: FollowUpSettings): Promise<void> {
  const values = { followUp: input.enabled, followUpMissing: input.missing };
  await db
    .insert(teacherSettings)
    .values({ teacherId, ...values })
    .onConflictDoUpdate({ target: teacherSettings.teacherId, set: { ...values, updatedAt: new Date() } });
}

export type FollowUpClass = {
  classId: string;
  name: string;
  year: number;
  division: string;
  /** The cuatrimestre the reasons are about. */
  term: number;
  reasons: FollowUpReason[];
};
export type FollowUpStudent = { studentId: string; firstName: string; lastName: string; classes: FollowUpClass[] };
export type FollowUp = {
  /** FOLLOW-4: off means nobody is pointed out. */
  enabled: boolean;
  /** STUDENT-3 order; each one's classes by subject. */
  students: FollowUpStudent[];
};

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/**
 * FOLLOW-1..3: every active student of a class that isn't archived (CLASS-8)
 * with a reason in the cuatrimestre under way, as of `today` (an ISO date).
 */
export async function getFollowUp(db: Db, teacherId: string, today: string): Promise<FollowUp> {
  const [[settings], classRows, enrolled, scored, marks] = await Promise.all([
    db
      .select({
        enabled: teacherSettings.followUp,
        missing: teacherSettings.followUpMissing,
        minAttendance: teacherSettings.minAttendance,
        passMark: teacherSettings.passMark,
      })
      .from(teacherSettings)
      .where(eq(teacherSettings.teacherId, teacherId)),
    db
      .select({
        id: classes.id,
        name: classes.name,
        courseId: classes.courseId,
        year: courses.year,
        division: courses.division,
        // GRADE-3, GRADE-5: null means the teacher's.
        passMark: sql<number | null>`coalesce(${classes.passMark}, ${schools.passMark})::float8`,
        startsOn: schoolCalendars.startsOn,
        term2StartsOn: schoolCalendars.term2StartsOn,
        endsOn: schoolCalendars.endsOn,
      })
      .from(classes)
      .innerJoin(courses, eq(classes.courseId, courses.id))
      .innerJoin(schools, eq(courses.schoolId, schools.id))
      .leftJoin(
        schoolCalendars,
        and(eq(schoolCalendars.schoolId, courses.schoolId), eq(schoolCalendars.academicYearId, courses.academicYearId)),
      )
      .where(and(eq(classes.teacherId, teacherId), isNull(classes.archivedOn))),
    db
      .select({
        courseId: courseStudents.courseId,
        studentId: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(courseStudents)
      .innerJoin(students, eq(courseStudents.studentId, students.id))
      .where(and(eq(courseStudents.teacherId, teacherId), eq(courseStudents.status, "active"))),
    // Per class, student and cuatrimestre: the average of what was scored and the tasks not handed in.
    db
      .select({
        classId: tasks.classId,
        studentId: scores.studentId,
        term: terms.position,
        average: sql<number | null>`avg(${scores.value}) filter (where ${scores.status} = 'graded' and ${scores.value} is not null)::float8`,
        missing: sql<number>`count(*) filter (where ${scores.status} = 'missing')::int`,
      })
      .from(scores)
      .innerJoin(tasks, eq(scores.taskId, tasks.id))
      .innerJoin(terms, eq(tasks.termId, terms.id))
      .innerJoin(classes, eq(tasks.classId, classes.id))
      .where(and(eq(scores.teacherId, teacherId), isNull(classes.archivedOn)))
      .groupBy(tasks.classId, scores.studentId, terms.position),
    // Per class, student, cuatrimestre and mark: how many days. The cuatrimestre comes from the school's calendar.
    db
      .select({
        classId: classSessions.classId,
        studentId: attendance.studentId,
        term: sql<number>`case when ${classSessions.date} >= ${schoolCalendars.term2StartsOn} then 2 else 1 end`,
        status: attendance.status,
        days: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .innerJoin(classSessions, eq(attendance.sessionId, classSessions.id))
      .innerJoin(classes, eq(classSessions.classId, classes.id))
      .innerJoin(courses, eq(classes.courseId, courses.id))
      .innerJoin(
        schoolCalendars,
        and(eq(schoolCalendars.schoolId, courses.schoolId), eq(schoolCalendars.academicYearId, courses.academicYearId)),
      )
      .where(
        and(
          eq(attendance.teacherId, teacherId),
          eq(classSessions.held, true),
          isNull(classes.archivedOn),
          sql`${classSessions.date} between ${schoolCalendars.startsOn} and ${schoolCalendars.endsOn}`,
        ),
      )
      .groupBy(
        classSessions.classId,
        attendance.studentId,
        sql`case when ${classSessions.date} >= ${schoolCalendars.term2StartsOn} then 2 else 1 end`,
        attendance.status,
      ),
  ]);

  const enabled = settings?.enabled ?? true;
  if (!enabled) return { enabled, students: [] };
  const limits = {
    missing: resolveMissing(settings?.missing),
    minAttendance: settings?.minAttendance ?? DEFAULT_MIN_ATTENDANCE,
    teacherPassMark: settings?.passMark ?? DEFAULT_RULES.passMark,
  };

  const key = (classId: string, studentId: string, term: number) => `${classId}:${studentId}:${term}`;
  const scoreAt = new Map(scored.map((s) => [key(s.classId, s.studentId, s.term), s]));
  const marksAt = new Map<string, AttendanceStatus[]>();
  for (const m of marks) {
    const k = key(m.classId, m.studentId, Number(m.term));
    marksAt.set(k, [...(marksAt.get(k) ?? []), ...Array<AttendanceStatus>(m.days).fill(m.status)]);
  }

  const byStudent = new Map<string, FollowUpStudent>();
  for (const cls of classRows) {
    const calendar =
      cls.startsOn && cls.term2StartsOn && cls.endsOn
        ? { startsOn: cls.startsOn, term2StartsOn: cls.term2StartsOn, endsOn: cls.endsOn }
        : null;
    const term = currentTerm(today, calendar, [...new Set(scored.filter((s) => s.classId === cls.id).map((s) => s.term))]);
    if (term === null) continue;

    for (const s of enrolled.filter((e) => e.courseId === cls.courseId)) {
      const k = key(cls.id, s.studentId, term);
      const own = scoreAt.get(k);
      const reasons = followUpReasons(
        {
          // SUGGEST-1: to two decimals, as the gradebook shows it.
          average: own?.average == null ? null : Math.round(own.average * 100) / 100,
          missing: own?.missing ?? 0,
          attendance: attendanceRate(marksAt.get(k) ?? []).rate,
        },
        { passMark: cls.passMark ?? limits.teacherPassMark, minAttendance: limits.minAttendance, missing: limits.missing },
      );
      if (reasons.length === 0) continue;
      const entry = byStudent.get(s.studentId) ?? {
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        classes: [],
      };
      entry.classes.push({ classId: cls.id, name: cls.name, year: cls.year, division: cls.division, term, reasons });
      byStudent.set(s.studentId, entry);
    }
  }
  const list = [...byStudent.values()].sort(compareStudents);
  for (const s of list) s.classes.sort((a, b) => collator.compare(a.name, b.name) || a.year - b.year);
  return { enabled, students: list };
}
