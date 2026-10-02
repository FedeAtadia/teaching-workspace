import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { courseStudents } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import { createClass } from "./classes";
import { getClass, listClassStudents, listTerms, type ClassDetail } from "./classDetail";
import { getStudentHistory } from "./history";
import { getHomeCards } from "./home";
import { createStudent } from "./students";
import { saveTermGrades } from "./termGrades";
import { deleteExam, getClosingSheet, listOwed, recordExam, setOutcome } from "./yearEnd";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

type Setup = { teacher: string; cls: ClassDetail; students: Record<string, string> };

/** A teacher's class with Pérez and Álvarez, each with a 2° cuatrimestre (final) grade if given. */
async function setup(
  finals: { Pérez?: number; Álvarez?: number } = {},
  over: Partial<ClassInput> & { teacher?: string } = {},
): Promise<Setup> {
  const { teacher = newTeacher(), ...input } = over;
  const created = await createClass(db, teacher, {
    name: "Matemática",
    year: 4,
    division: "A",
    shift: "morning",
    school: "Escuela 5",
    schoolYear: 2026,
    ...input,
  });
  if (!created.ok) throw new Error("setup failed");
  const cls = (await getClass(db, teacher, created.classId))!;
  for (const [firstName, lastName] of [["Ana", "Pérez"], ["Zoe", "Álvarez"]]) {
    await createStudent(db, teacher, { firstName, lastName, courseId: cls.courseId });
  }
  const roster = await listClassStudents(db, teacher, cls);
  const students = Object.fromEntries(roster.map((s) => [s.lastName, s.id]));
  const [, term2] = await listTerms(db, teacher, cls);
  await saveTermGrades(db, teacher, cls, term2.id, {
    save: Object.entries(finals).map(([lastName, value]) => ({
      studentId: students[lastName],
      value: value as number,
      notes: null,
      outsideRangeReason: null,
    })),
    clear: [],
  });
  return { teacher, cls, students };
}

const exam = (s: Setup, studentId: string, takenOn: string, value: number | null) =>
  recordExam(db, s.teacher, {
    classId: s.cls.id,
    studentId,
    takenOn,
    status: value === null ? "absent" : "graded",
    value,
    notes: null,
  });

const notFound = { ok: false, error: "notFound" };

describe("the Cierre sheet (YEAR-1, YEAR-3)", () => {
  it("lists the course's students with their final grade, result, exams and outcome", async () => {
    const s = await setup({ Pérez: 4, Álvarez: 8 });
    await exam(s, s.students.Pérez, "2026-12-10", 5);
    await setOutcome(db, s.teacher, { classId: s.cls.id, studentId: s.students.Álvarez, outcome: "promoted" });

    const sheet = await getClosingSheet(db, s.teacher, s.cls);
    expect(sheet.rows).toMatchObject([
      { student: { lastName: "Álvarez" }, finalGrade: 8, result: { kind: "passed" }, exams: [], outcome: "promoted" },
      {
        student: { lastName: "Pérez" },
        finalGrade: 4,
        result: { kind: "owed", grade: 4 },
        exams: [{ takenOn: "2026-12-10", status: "graded", value: 5 }],
        outcome: null,
      },
    ]);
  });

  it("is pending for a student with no final grade yet", async () => {
    const s = await setup({ Pérez: 8 });
    const sheet = await getClosingSheet(db, s.teacher, s.cls);
    expect(sheet.rows.map((r) => [r.student.lastName, r.result.kind])).toEqual([
      ["Álvarez", "pending"],
      ["Pérez", "passed"],
    ]);
  });
});

describe("year outcomes (YEAR-2)", () => {
  it("sets, changes and clears an outcome, shared by the course's classes", async () => {
    const s = await setup();
    const physics = await createClass(db, s.teacher, {
      name: "Física",
      year: 4,
      division: "A",
      shift: "morning",
      school: "Escuela 5",
      schoolYear: 2026,
    });
    if (!physics.ok) throw new Error("setup failed");
    const physicsClass = (await getClass(db, s.teacher, physics.classId))!;
    const set = (outcome: "promoted" | "repeats" | null) =>
      setOutcome(db, s.teacher, { classId: s.cls.id, studentId: s.students.Pérez, outcome });
    const outcomeIn = async (cls: ClassDetail) =>
      (await getClosingSheet(db, s.teacher, cls)).rows.find((r) => r.student.lastName === "Pérez")?.outcome;

    expect(await set("repeats")).toEqual({ ok: true });
    expect(await outcomeIn(physicsClass)).toBe("repeats");
    await set("promoted");
    expect(await outcomeIn(s.cls)).toBe("promoted");
    await set(null);
    expect(await outcomeIn(physicsClass)).toBeNull();
  });

  it("only allows graduated in 6°, and promoted or repeats below it", async () => {
    const fourth = await setup();
    const sixth = await setup({}, { year: 6 });
    expect(
      await setOutcome(db, fourth.teacher, { classId: fourth.cls.id, studentId: fourth.students.Pérez, outcome: "graduated" }),
    ).toEqual({ ok: false, error: "notAllowed" });
    expect(
      await setOutcome(db, sixth.teacher, { classId: sixth.cls.id, studentId: sixth.students.Pérez, outcome: "promoted" }),
    ).toEqual({ ok: false, error: "notAllowed" });
    expect(
      await setOutcome(db, sixth.teacher, { classId: sixth.cls.id, studentId: sixth.students.Pérez, outcome: "graduated" }),
    ).toEqual({ ok: true });
  });

  it("changes nothing for another teacher, or a student outside the course (OWNER-1)", async () => {
    const s = await setup();
    const other = await setup();
    expect(
      await setOutcome(db, newTeacher(), { classId: s.cls.id, studentId: s.students.Pérez, outcome: "promoted" }),
    ).toEqual(notFound);
    expect(
      await setOutcome(db, s.teacher, { classId: s.cls.id, studentId: other.students.Pérez, outcome: "promoted" }),
    ).toEqual(notFound);
    expect((await getClosingSheet(db, s.teacher, s.cls)).rows.every((r) => r.outcome === null)).toBe(true);
  });
});

describe("exams (EXAM-1, EXAM-2)", () => {
  it("records exams for an owed class until one passes it, then refuses more", async () => {
    const s = await setup({ Pérez: 4 });
    expect(await exam(s, s.students.Pérez, "2026-12-10", null)).toEqual({ ok: true });
    expect(await exam(s, s.students.Pérez, "2027-02-20", 7)).toEqual({ ok: true });

    const [, perez] = (await getClosingSheet(db, s.teacher, s.cls)).rows;
    expect(perez.result).toEqual({ kind: "passedByExam", grade: 4, exam: { takenOn: "2027-02-20", value: 7 } });
    expect(await exam(s, s.students.Pérez, "2027-03-01", 9)).toEqual({ ok: false, error: "notOwed" });
  });

  it("refuses an exam for a class that is passed or still pending (EXAM-1)", async () => {
    const s = await setup({ Pérez: 8 });
    expect(await exam(s, s.students.Pérez, "2026-12-10", 9)).toEqual({ ok: false, error: "notOwed" });
    expect(await exam(s, s.students.Álvarez, "2026-12-10", 9)).toEqual({ ok: false, error: "notOwed" });
  });

  it("deletes an exam recorded by mistake, and the class is owed again (EXAM-2)", async () => {
    const s = await setup({ Pérez: 4 });
    await exam(s, s.students.Pérez, "2026-12-10", 8);
    const [, perez] = (await getClosingSheet(db, s.teacher, s.cls)).rows;
    expect(await deleteExam(db, s.teacher, { classId: s.cls.id, examId: perez.exams[0].id })).toEqual({ ok: true });
    expect((await getClosingSheet(db, s.teacher, s.cls)).rows[1].result).toEqual({ kind: "owed", grade: 4 });
  });

  it("records or deletes nothing of another teacher's (OWNER-1)", async () => {
    const s = await setup({ Pérez: 4 });
    await exam(s, s.students.Pérez, "2026-12-10", 5);
    const [, perez] = (await getClosingSheet(db, s.teacher, s.cls)).rows;
    const intruder = newTeacher();
    expect(
      await recordExam(db, intruder, {
        classId: s.cls.id,
        studentId: s.students.Pérez,
        takenOn: "2026-12-11",
        status: "graded",
        value: 10,
        notes: null,
      }),
    ).toEqual(notFound);
    expect(await deleteExam(db, intruder, { classId: s.cls.id, examId: perez.exams[0].id })).toEqual(notFound);
    expect(await deleteExam(db, s.teacher, { classId: s.cls.id, examId: "not-an-id" })).toEqual(notFound);
    expect((await getClosingSheet(db, s.teacher, s.cls)).rows[1].exams).toHaveLength(1);
  });
});

describe("the Previas list (EXAM-3) and Home (EXAM-4)", () => {
  it("lists every owed class with its students, newest school year first", async () => {
    const teacher = newTeacher();
    const now = await setup({ Pérez: 4, Álvarez: 9 }, { teacher });
    const before = await setup({ Pérez: 5, Álvarez: 3 }, { teacher, schoolYear: 2025, name: "Física" });
    await exam(before, before.students.Álvarez, "2026-03-01", 2);

    const owed = await listOwed(db, teacher);
    expect(owed.map((c) => [c.schoolYear, c.name, c.students.map((s) => [s.student.lastName, s.finalGrade, s.exams.length])])).toEqual([
      ["2026", "Matemática", [["Pérez", 4, 0]]],
      ["2025", "Física", [["Álvarez", 3, 1], ["Pérez", 5, 0]]],
    ]);
    expect((await getHomeCards(db, teacher)).stats.owed).toBe(3);

    // A passing exam takes the row off; a student who left the course isn't listed.
    await exam(now, now.students.Pérez, "2026-12-10", 7);
    await db.update(courseStudents).set({ status: "withdrawn" }).where(eq(courseStudents.studentId, before.students.Pérez));
    expect((await listOwed(db, teacher)).map((c) => [c.name, c.students.map((s) => s.student.lastName)])).toEqual([
      ["Física", ["Álvarez"]],
    ]);
    expect((await getHomeCards(db, teacher)).stats.owed).toBe(1);
  });

  it("shows nothing of another teacher's (OWNER-1)", async () => {
    await setup({ Pérez: 4 });
    expect(await listOwed(db, newTeacher())).toEqual([]);
  });
});

describe("the student's history (HISTORY-4)", () => {
  it("shows the course's outcome, and each class's result and exams", async () => {
    const s = await setup({ Pérez: 4 });
    await exam(s, s.students.Pérez, "2026-12-10", 8);
    await setOutcome(db, s.teacher, { classId: s.cls.id, studentId: s.students.Pérez, outcome: "promoted" });

    const history = await getStudentHistory(db, s.teacher, s.students.Pérez);
    const [course] = history!.courses;
    expect(course.outcome).toBe("promoted");
    expect(course.classes[0]).toMatchObject({
      result: { kind: "passedByExam", exam: { takenOn: "2026-12-10", value: 8 } },
      exams: [{ takenOn: "2026-12-10", status: "graded", value: 8 }],
    });
  });
});
