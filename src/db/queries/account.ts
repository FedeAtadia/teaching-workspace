// A teacher's whole data at once: gathering it for the download (DATA-1) and
// deleting it with the account (DATA-3). Scoped to one teacher (OWNER-1).

import { eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  academicYears,
  attendance,
  classGroupStudents,
  classGroups,
  classSessions,
  classes,
  courseStudents,
  courses,
  exams,
  schoolCalendars,
  schoolDaysOff,
  schools,
  scores,
  standards,
  studentAdaptations,
  students,
  tasks,
  teacherSettings,
  termGrades,
  terms,
  units,
} from "@/db/schema";
import type { ExportData } from "@/lib/dataExport";

/** Drops the rows whose class, student or task could not be found (there are none, by the foreign keys). */
const present = <T>(rows: (T | null)[]): T[] => rows.filter((r): r is T => r !== null);

/** DATA-1: everything the teacher has loaded, with names instead of ids. */
export async function loadExport(db: Db, teacherId: string): Promise<ExportData> {
  const [
    schoolRows,
    yearRows,
    termRows,
    courseRows,
    classRows,
    studentRows,
    enrollments,
    unitRows,
    standardRows,
    taskRows,
    scoreRows,
    termGradeRows,
    sessionRows,
    attendanceRows,
    examRows,
    adaptationRows,
    groupRows,
    groupStudentRows,
    calendarRows,
    dayOffRows,
    settingsRows,
  ] = await Promise.all([
    db.select().from(schools).where(eq(schools.teacherId, teacherId)),
    db.select().from(academicYears).where(eq(academicYears.teacherId, teacherId)),
    db.select().from(terms).where(eq(terms.teacherId, teacherId)),
    db.select().from(courses).where(eq(courses.teacherId, teacherId)),
    db.select().from(classes).where(eq(classes.teacherId, teacherId)),
    db.select().from(students).where(eq(students.teacherId, teacherId)),
    db.select().from(courseStudents).where(eq(courseStudents.teacherId, teacherId)),
    db.select().from(units).where(eq(units.teacherId, teacherId)),
    db.select().from(standards).where(eq(standards.teacherId, teacherId)),
    db.select().from(tasks).where(eq(tasks.teacherId, teacherId)),
    db.select().from(scores).where(eq(scores.teacherId, teacherId)),
    db.select().from(termGrades).where(eq(termGrades.teacherId, teacherId)),
    db.select().from(classSessions).where(eq(classSessions.teacherId, teacherId)),
    db.select().from(attendance).where(eq(attendance.teacherId, teacherId)),
    db.select().from(exams).where(eq(exams.teacherId, teacherId)),
    db.select().from(studentAdaptations).where(eq(studentAdaptations.teacherId, teacherId)),
    db.select().from(classGroups).where(eq(classGroups.teacherId, teacherId)),
    db.select().from(classGroupStudents).where(eq(classGroupStudents.teacherId, teacherId)),
    db.select().from(schoolCalendars).where(eq(schoolCalendars.teacherId, teacherId)),
    db.select().from(schoolDaysOff).where(eq(schoolDaysOff.teacherId, teacherId)),
    db.select().from(teacherSettings).where(eq(teacherSettings.teacherId, teacherId)),
  ]);

  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const schoolById = byId(schoolRows);
  const yearById = byId(yearRows);
  const termById = byId(termRows);
  const unitById = byId(unitRows);
  const taskById = byId(taskRows);
  const sessionById = byId(sessionRows);
  const calendarById = byId(calendarRows);

  const courseById = new Map(
    courseRows.map((c) => [
      c.id,
      {
        schoolYear: yearById.get(c.academicYearId)?.name ?? "",
        school: schoolById.get(c.schoolId)?.name ?? "",
        year: c.year,
        division: c.division,
        shift: c.shift,
      },
    ]),
  );
  const classById = new Map(
    classRows.flatMap((c) => {
      const course = courseById.get(c.courseId);
      return course ? [[c.id, { ...course, subject: c.name }] as const] : [];
    }),
  );
  const studentById = new Map(studentRows.map((s) => [s.id, { lastName: s.lastName, firstName: s.firstName }]));
  const term = (id: string | null) => (id ? (termById.get(id)?.position ?? null) : null);
  const unit = (id: string | null) => (id ? (unitById.get(id)?.title ?? null) : null);

  /** A row about a class, or null when the class is not there. */
  const inClass = <T>(classId: string, rest: T) => {
    const cls = classById.get(classId);
    return cls ? { ...cls, ...rest } : null;
  };
  /** A row about a student in a class. */
  const inClassFor = <T>(classId: string, studentId: string, rest: T) => {
    const cls = classById.get(classId);
    const student = studentById.get(studentId);
    return cls && student ? { ...cls, ...student, ...rest } : null;
  };

  const enrolled = new Set(enrollments.map((e) => e.studentId));

  return {
    classes: present(
      classRows.map((c) => inClass(c.id, { passMark: c.passMark, weekdays: c.weekdays, notes: c.notes })),
    ),
    students: [
      ...present(
        enrollments.map((e) => {
          const student = studentById.get(e.studentId);
          const course = courseById.get(e.courseId);
          return student && course ? { ...student, ...course, status: e.status, outcome: e.outcome } : null;
        }),
      ),
      ...studentRows
        .filter((s) => !enrolled.has(s.id))
        .map((s) => ({
          lastName: s.lastName,
          firstName: s.firstName,
          schoolYear: null,
          school: null,
          year: null,
          division: null,
          shift: null,
          status: null,
          outcome: null,
        })),
    ],
    units: present(
      unitRows.map((u) => inClass(u.classId, { term: term(u.termId), title: u.title, description: u.description })),
    ),
    standards: present(
      standardRows.map((s) =>
        inClass(s.classId, {
          unit: unit(s.unitId),
          student: s.studentId ? (studentById.get(s.studentId) ?? null) : null,
          title: s.title,
          description: s.description,
          file: s.attachmentName,
        }),
      ),
    ),
    tasks: present(
      taskRows.map((t) =>
        inClass(t.classId, {
          term: term(t.termId) ?? 0,
          unit: unit(t.unitId),
          title: t.title,
          description: t.description,
          criteria: t.criteria,
          assignedOn: t.assignedOn,
          dueOn: t.dueOn,
          file: t.attachmentName,
          adaptedDescription: t.adaptedDescription,
          adaptedCriteria: t.adaptedCriteria,
          adaptedFile: t.adaptedAttachmentName,
        }),
      ),
    ),
    scores: present(
      scoreRows.map((s) => {
        const task = taskById.get(s.taskId);
        if (!task) return null;
        return inClassFor(task.classId, s.studentId, {
          term: term(task.termId) ?? 0,
          task: task.title,
          status: s.status,
          value: s.value,
          adapted: s.adapted,
          notes: s.notes,
        });
      }),
    ),
    termGrades: present(
      termGradeRows.map((g) =>
        inClassFor(g.classId, g.studentId, {
          term: term(g.termId) ?? 0,
          value: g.value,
          notes: g.notes,
          reason: g.outsideRangeReason,
        }),
      ),
    ),
    attendance: present(
      attendanceRows.map((a) => {
        const session = sessionById.get(a.sessionId);
        if (!session) return null;
        return inClassFor(session.classId, a.studentId, { date: session.date, status: a.status });
      }),
    ),
    notHeld: present(
      sessionRows.filter((s) => !s.held).map((s) => inClass(s.classId, { date: s.date, reason: s.reason, note: s.note })),
    ),
    exams: present(
      examRows.map((e) =>
        inClassFor(e.classId, e.studentId, { takenOn: e.takenOn, status: e.status, value: e.value, notes: e.notes }),
      ),
    ),
    adaptations: present(adaptationRows.map((a) => inClassFor(a.classId, a.studentId, { notes: a.notes }))),
    groups: present(
      groupRows.flatMap((g) => {
        const members = groupStudentRows.filter((m) => m.groupId === g.id);
        const row = (student: { lastName: string; firstName: string } | null) =>
          inClass(g.classId, { group: g.name, days: g.days, weekdays: g.weekdays, student });
        if (members.length === 0) return [row(null)];
        return members.map((m) => row(studentById.get(m.studentId) ?? null));
      }),
    ),
    calendars: calendarRows.map((c) => ({
      school: schoolById.get(c.schoolId)?.name ?? "",
      schoolYear: yearById.get(c.academicYearId)?.name ?? "",
      startsOn: c.startsOn,
      term2StartsOn: c.term2StartsOn,
      endsOn: c.endsOn,
    })),
    daysOff: present(
      dayOffRows.map((d) => {
        const calendar = calendarById.get(d.calendarId);
        if (!calendar) return null;
        return {
          school: schoolById.get(calendar.schoolId)?.name ?? "",
          schoolYear: yearById.get(calendar.academicYearId)?.name ?? "",
          startsOn: d.startsOn,
          endsOn: d.endsOn,
          kind: d.kind,
          name: d.name,
        };
      }),
    ),
    settings: settingsRows[0]
      ? {
          gradeMin: settingsRows[0].gradeMin,
          gradeMax: settingsRows[0].gradeMax,
          passMark: settingsRows[0].passMark,
          maxTermIncrease: settingsRows[0].maxTermIncrease,
          maxTermDecrease: settingsRows[0].maxTermDecrease,
          minAttendance: settingsRows[0].minAttendance,
        }
      : null,
  };
}

/**
 * DATA-3: deletes everything the teacher has loaded and their settings, and
 * answers with their attached files' paths, for Storage to delete.
 *
 * In this order because a course can't lose its school or school year, nor a
 * task its cuatrimestre, while they exist; the rest goes with its parent.
 */
export async function deleteTeacherData(db: Db, teacherId: string): Promise<{ attachmentPaths: string[] }> {
  return db.transaction(async (tx) => {
    const [taskFiles, adaptedFiles, standardFiles] = await Promise.all([
      tx
        .select({ path: tasks.attachmentPath })
        .from(tasks)
        .where(sql`${tasks.teacherId} = ${teacherId} and ${isNotNull(tasks.attachmentPath)}`),
      tx
        .select({ path: tasks.adaptedAttachmentPath })
        .from(tasks)
        .where(sql`${tasks.teacherId} = ${teacherId} and ${isNotNull(tasks.adaptedAttachmentPath)}`),
      tx
        .select({ path: standards.attachmentPath })
        .from(standards)
        .where(sql`${standards.teacherId} = ${teacherId} and ${isNotNull(standards.attachmentPath)}`),
    ]);

    await tx.delete(classes).where(eq(classes.teacherId, teacherId));
    await tx.delete(students).where(eq(students.teacherId, teacherId));
    await tx.delete(courses).where(eq(courses.teacherId, teacherId));
    await tx.delete(schools).where(eq(schools.teacherId, teacherId));
    await tx.delete(academicYears).where(eq(academicYears.teacherId, teacherId));
    await tx.delete(teacherSettings).where(eq(teacherSettings.teacherId, teacherId));

    return { attachmentPaths: [...taskFiles, ...adaptedFiles, ...standardFiles].map((f) => f.path!) };
  });
}

/**
 * DATA-3: removes the teacher's sign-in from Supabase Auth (its identities
 * and sessions go with it). The server connects as the database owner, which
 * may delete from `auth.users`. Not in the tests: the in-memory database has
 * no `auth` schema.
 */
export async function deleteSignIn(db: Db, teacherId: string): Promise<void> {
  await db.execute(sql`delete from auth.users where id = ${teacherId}`);
}
