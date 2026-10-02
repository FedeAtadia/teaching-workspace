import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { courseStudents } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import { createClass, listCourses } from "./classes";
import { getClass, listClassStudents, listTerms, type ClassDetail } from "./classDetail";
import { getStudentHistory } from "./history";
import { createStudent } from "./students";
import { createTask, getGradebook, saveScores } from "./tasks";
import { getTermGradeSheet, saveTermGrades } from "./termGrades";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

type Setup = { teacher: string; cls: ClassDetail; term1: string; term2: string; students: Record<string, string> };

/** A teacher with Matemática in 4° A (2026), two students and its two cuatrimestres. */
async function setup(schoolYear = 2026): Promise<Setup> {
  const teacher = newTeacher();
  const created = await createClass(db, teacher, {
    name: "Matemática",
    year: 4,
    division: "A",
    shift: "morning",
    school: "Escuela 5",
    schoolYear,
  });
  if (!created.ok) throw new Error("setup failed");
  const cls = (await getClass(db, teacher, created.classId))!;
  const [course] = await listCourses(db, teacher);
  for (const [firstName, lastName] of [["Ana", "Pérez"], ["Zoe", "Álvarez"]]) {
    await createStudent(db, teacher, { firstName, lastName, courseId: course.id });
  }
  const roster = await listClassStudents(db, teacher, cls);
  const [term1, term2] = await listTerms(db, teacher, cls);
  return {
    teacher,
    cls,
    term1: term1.id,
    term2: term2.id,
    students: Object.fromEntries(roster.map((s) => [s.lastName, s.id])),
  };
}

const grade = (studentId: string, value: number, more: { notes?: string; reason?: string } = {}) => ({
  studentId,
  value,
  notes: more.notes ?? null,
  outsideRangeReason: more.reason ?? null,
});

/** A task in the cuatrimestre with these scores. */
async function scoredTask(s: Setup, termId: string, values: Record<string, number>) {
  const task = await createTask(db, s.teacher, {
    classId: s.cls.id,
    title: "TP",
    termId,
    unitId: null,
    dueOn: null,
    description: null,
    criteria: null,
    standardIds: [],
  });
  if (!task.ok) throw new Error("createTask failed");
  await saveScores(db, s.teacher, s.cls, task.taskId, {
    save: Object.entries(values).map(([studentId, value]) => ({ studentId, status: "graded", value, notes: null })),
    clear: [],
  });
}

describe("the cuatrimestre grade sheet (TERM-5, TERM-6)", () => {
  it("lists the course's students with their suggested grade and saved grade (TERM-5)", async () => {
    const s = await setup();
    await scoredTask(s, s.term1, { [s.students.Pérez]: 6 });
    await scoredTask(s, s.term1, { [s.students.Pérez]: 8 });
    await saveTermGrades(db, s.teacher, s.cls, s.term1, {
      save: [grade(s.students.Pérez, 7.5, { notes: "Mejoró" })],
      clear: [],
    });

    const sheet = await getTermGradeSheet(db, s.teacher, s.cls, s.term1);
    expect(sheet).toMatchObject({
      position: 1,
      rows: [
        { student: { lastName: "Álvarez" }, suggestion: { average: null }, saved: null, firstTerm: null },
        {
          student: { lastName: "Pérez" },
          suggestion: { average: 7, graded: 2, missing: 0 },
          saved: { value: 7.5, notes: "Mejoró", outsideRangeReason: null },
          firstTerm: null,
        },
      ],
    });
  });

  it("shows each student's 1° grade on the 2° cuatrimestre sheet, for its range (TERM-6)", async () => {
    const s = await setup();
    await saveTermGrades(db, s.teacher, s.cls, s.term1, { save: [grade(s.students.Pérez, 4)], clear: [] });
    const sheet = await getTermGradeSheet(db, s.teacher, s.cls, s.term2);
    expect(sheet?.position).toBe(2);
    expect(sheet?.rows.map((r) => [r.student.lastName, r.firstTerm])).toEqual([
      ["Álvarez", null],
      ["Pérez", 4],
    ]);
  });

  it("updates and clears saved grades, keeping a reason (TERM-5, TERM-6)", async () => {
    const s = await setup();
    await saveTermGrades(db, s.teacher, s.cls, s.term2, {
      save: [grade(s.students.Pérez, 6), grade(s.students.Álvarez, 9)],
      clear: [],
    });
    expect(
      await saveTermGrades(db, s.teacher, s.cls, s.term2, {
        save: [grade(s.students.Pérez, 9, { reason: "Recuperó todo" })],
        clear: [s.students.Álvarez],
      }),
    ).toEqual({ ok: true });

    const sheet = await getTermGradeSheet(db, s.teacher, s.cls, s.term2);
    expect(sheet?.rows.map((r) => [r.student.lastName, r.saved])).toEqual([
      ["Álvarez", null],
      ["Pérez", { value: 9, notes: null, outsideRangeReason: "Recuperó todo" }],
    ]);
  });

  it("only saves students active in the course (TERM-8)", async () => {
    const s = await setup();
    const other = await setup();
    await db.update(courseStudents).set({ status: "withdrawn" }).where(eq(courseStudents.studentId, s.students.Álvarez));

    await saveTermGrades(db, s.teacher, s.cls, s.term1, {
      save: [grade(s.students.Pérez, 8), grade(s.students.Álvarez, 8), grade(other.students.Pérez, 8)],
      clear: [],
    });
    const sheet = await getTermGradeSheet(db, s.teacher, s.cls, s.term1);
    expect(sheet?.rows.map((r) => [r.student.lastName, r.saved?.value ?? null])).toEqual([["Pérez", 8]]);
  });

  it("finds nothing for a cuatrimestre of another school year or another teacher (TERM-8, OWNER-1)", async () => {
    const s = await setup();
    const lastYear = await setup(2025);
    const notFound = { ok: false, error: "notFound" };
    const entries = { save: [grade(s.students.Pérez, 8)], clear: [] };

    expect(await getTermGradeSheet(db, s.teacher, s.cls, lastYear.term1)).toBeNull();
    expect(await getTermGradeSheet(db, s.teacher, s.cls, "not-an-id")).toBeNull();
    expect(await saveTermGrades(db, s.teacher, s.cls, lastYear.term1, entries)).toEqual(notFound);
    expect(await getTermGradeSheet(db, newTeacher(), s.cls, s.term1)).toBeNull();
    expect(await saveTermGrades(db, newTeacher(), s.cls, s.term1, entries)).toEqual(notFound);
    expect((await getTermGradeSheet(db, s.teacher, s.cls, s.term1))?.rows.every((r) => r.saved === null)).toBe(true);
  });
});

describe("where cuatrimestre grades show (TERM-7)", () => {
  it("in the gradebook, next to the suggested average", async () => {
    const s = await setup();
    await scoredTask(s, s.term1, { [s.students.Pérez]: 6 });
    await saveTermGrades(db, s.teacher, s.cls, s.term1, { save: [grade(s.students.Pérez, 7)], clear: [] });

    const book = await getGradebook(db, s.teacher, s.cls, s.term1);
    expect(book.rows.map((r) => [r.student.lastName, r.suggestion.average, r.termGrade])).toEqual([
      ["Álvarez", null, null],
      ["Pérez", 6, 7],
    ]);
  });

  it("in the student's history, each cuatrimestre's grade and the 2° as the final grade", async () => {
    const s = await setup();
    await scoredTask(s, s.term1, { [s.students.Pérez]: 6 });
    await saveTermGrades(db, s.teacher, s.cls, s.term1, { save: [grade(s.students.Pérez, 6)], clear: [] });
    // A 2° grade with no tasks in that cuatrimestre still shows.
    await saveTermGrades(db, s.teacher, s.cls, s.term2, { save: [grade(s.students.Pérez, 8)], clear: [] });

    const history = await getStudentHistory(db, s.teacher, s.students.Pérez);
    const [cls] = history!.courses[0].classes;
    expect(cls.terms.map((t) => [t.position, t.grade, t.tasks.length])).toEqual([
      [1, 6, 1],
      [2, 8, 0],
    ]);
    expect(cls.finalGrade).toBe(8);

    const other = await getStudentHistory(db, s.teacher, s.students.Álvarez);
    expect(other!.courses[0].classes[0]).toMatchObject({ finalGrade: null });
  });
});
