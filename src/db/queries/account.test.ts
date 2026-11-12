import { is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import { deleteTeacherData, loadExport } from "./account";
import { createClass, listCourses } from "./classes";
import { getClass, listTerms } from "./classDetail";
import { createStudent, listStudents } from "./students";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

/** Every table; each one carries the teacher's id. */
const TABLES = (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable));

async function rowsOf(teacher: string): Promise<number> {
  let total = 0;
  for (const table of TABLES) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(table)
      .where(sql`teacher_id = ${teacher}`);
    total += n;
  }
  return total;
}

/** A teacher with one of everything. */
async function seed(lastName = "Pérez") {
  const teacherId = newTeacher();
  const created = await createClass(db, teacherId, {
    name: "Matemática",
    year: 5,
    division: "1°",
    shift: "morning",
    school: "EPET 30",
    schoolYear: 2026,
  });
  if (!created.ok) throw new Error("createClass failed");
  const cls = (await getClass(db, teacherId, created.classId))!;
  const [course] = await listCourses(db, teacherId);
  await createStudent(db, teacherId, { firstName: "Ana", lastName, courseId: course.id });
  const [student] = await listStudents(db, teacherId);
  const [term1] = await listTerms(db, teacherId, cls);
  const classId = cls.id;
  const studentId = student.id;

  const [unit] = await db
    .insert(schema.units)
    .values({ teacherId, classId, termId: term1.id, title: "Funciones" })
    .returning();
  await db.insert(schema.standards).values({
    teacherId,
    scope: "class",
    classId,
    title: "Resuelve problemas",
    attachmentPath: `${teacherId}/standards/s1/rubrica.pdf`,
    attachmentName: "rúbrica.pdf",
  });
  const [task] = await db
    .insert(schema.tasks)
    .values({
      teacherId,
      classId,
      termId: term1.id,
      unitId: unit.id,
      title: "TP 1",
      dueOn: "2026-04-10",
      attachmentPath: `${teacherId}/t1/tp1.pdf`,
      attachmentName: "tp1.pdf",
      adaptedAttachmentPath: `${teacherId}/t1/adapted/tp1.pdf`,
      adaptedAttachmentName: "tp1 adaptado.pdf",
    })
    .returning();
  await db.insert(schema.scores).values({ teacherId, taskId: task.id, studentId, value: 7.5 });
  await db.insert(schema.termGrades).values({ teacherId, classId, studentId, termId: term1.id, value: 8 });
  const [held, notHeld] = await db
    .insert(schema.classSessions)
    .values([
      { teacherId, classId, date: "2026-03-10" },
      { teacherId, classId, date: "2026-03-13", held: false, reason: "strike" },
    ])
    .returning();
  await db.insert(schema.attendance).values({ teacherId, sessionId: held.id, studentId, status: "late" });
  await db.insert(schema.exams).values({ teacherId, classId, studentId, takenOn: "2026-12-15", value: 6 });
  await db.insert(schema.studentAdaptations).values({ teacherId, classId, studentId, notes: "Consignas cortas" });
  const [group] = await db.insert(schema.classGroups).values({ teacherId, classId, name: "Martes", weekdays: [2] }).returning();
  await db.insert(schema.classGroupStudents).values({ teacherId, classId, studentId, groupId: group.id });
  const [calendar] = await db
    .insert(schema.schoolCalendars)
    .values({
      teacherId,
      schoolId: cls.schoolId,
      academicYearId: cls.academicYearId,
      startsOn: "2026-03-02",
      term2StartsOn: "2026-08-03",
      endsOn: "2026-12-11",
    })
    .returning();
  await db.insert(schema.schoolDaysOff).values({
    teacherId,
    calendarId: calendar.id,
    startsOn: "2026-03-24",
    endsOn: "2026-03-24",
    kind: "holiday",
    name: "Día de la Memoria",
  });
  await db.insert(schema.teacherSettings).values({ teacherId, minAttendance: 80 });
  return { teacherId, classId, studentId, notHeldId: notHeld.id };
}

const CLS = { schoolYear: "2026", school: "EPET 30", year: 5, division: "1°", shift: "morning", subject: "Matemática" };
const ANA = { lastName: "Pérez", firstName: "Ana" };

describe("a teacher's download (DATA-1)", () => {
  it("gathers every kind of thing the teacher loaded, naming the class and the student", async () => {
    const { teacherId } = await seed();
    const data = await loadExport(db, teacherId);

    expect(data.classes).toEqual([{ ...CLS, passMark: null, weekdays: [], notes: null, archivedOn: null }]);
    expect(data.students).toEqual([
      { ...ANA, schoolYear: "2026", school: "EPET 30", year: 5, division: "1°", shift: "morning", status: "active", outcome: null },
    ]);
    expect(data.units).toEqual([{ ...CLS, term: 1, title: "Funciones", description: null }]);
    expect(data.standards).toMatchObject([{ ...CLS, unit: null, student: null, title: "Resuelve problemas", file: "rúbrica.pdf" }]);
    expect(data.tasks).toMatchObject([
      { ...CLS, term: 1, unit: "Funciones", title: "TP 1", dueOn: "2026-04-10", file: "tp1.pdf", adaptedFile: "tp1 adaptado.pdf" },
    ]);
    expect(data.scores).toEqual([
      { ...CLS, ...ANA, term: 1, task: "TP 1", status: "graded", value: 7.5, adapted: false, notes: null },
    ]);
    expect(data.termGrades).toEqual([{ ...CLS, ...ANA, term: 1, value: 8, notes: null, reason: null }]);
    expect(data.attendance).toEqual([{ ...CLS, ...ANA, date: "2026-03-10", status: "late" }]);
    expect(data.notHeld).toEqual([{ ...CLS, date: "2026-03-13", reason: "strike", note: null }]);
    expect(data.exams).toEqual([{ ...CLS, ...ANA, takenOn: "2026-12-15", status: "graded", value: 6, notes: null }]);
    expect(data.adaptations).toEqual([{ ...CLS, ...ANA, notes: "Consignas cortas" }]);
    expect(data.groups).toEqual([{ ...CLS, group: "Martes", days: null, weekdays: [2], student: ANA }]);
    expect(data.calendars).toEqual([
      { school: "EPET 30", schoolYear: "2026", startsOn: "2026-03-02", term2StartsOn: "2026-08-03", endsOn: "2026-12-11" },
    ]);
    expect(data.daysOff).toEqual([
      { school: "EPET 30", schoolYear: "2026", startsOn: "2026-03-24", endsOn: "2026-03-24", kind: "holiday", name: "Día de la Memoria" },
    ]);
    expect(data.settings).toMatchObject({ minAttendance: 80, passMark: 7 });
  });

  it("holds only the teacher's own rows (OWNER-1)", async () => {
    const a = await seed("Pérez");
    await seed("Intrusa");
    const data = await loadExport(db, a.teacherId);
    expect(data.students.map((s) => s.lastName)).toEqual(["Pérez"]);
    expect(data.scores).toHaveLength(1);
    expect(data.attendance).toHaveLength(1);

    const nobody = await loadExport(db, newTeacher());
    expect(nobody.classes).toEqual([]);
    expect(nobody.students).toEqual([]);
    expect(nobody.settings).toBeNull();
  });
});

describe("deleting the account (DATA-3)", () => {
  it("deletes everything the teacher loaded and names their files, leaving other teachers alone", async () => {
    const a = await seed();
    const b = await seed();
    const before = await rowsOf(b.teacherId);
    expect(await rowsOf(a.teacherId)).toBe(before);
    expect(before).toBeGreaterThan(15);

    const result = await deleteTeacherData(db, a.teacherId);
    expect(result.attachmentPaths.sort()).toEqual(
      [`${a.teacherId}/standards/s1/rubrica.pdf`, `${a.teacherId}/t1/adapted/tp1.pdf`, `${a.teacherId}/t1/tp1.pdf`].sort(),
    );
    expect(await rowsOf(a.teacherId)).toBe(0);
    expect(await rowsOf(b.teacherId)).toBe(before);
  });

  it("does nothing for a teacher with no data", async () => {
    expect(await deleteTeacherData(db, newTeacher())).toEqual({ attachmentPaths: [] });
  });
});
