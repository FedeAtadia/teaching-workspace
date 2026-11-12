import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import { createClass, listClasses, listCourses } from "./classes";
import { eq } from "drizzle-orm";
import { courseStudents, exams } from "@/db/schema";
import { classGroupStudents, classGroups, standards } from "@/db/schema";
import { createStudent, deleteStudent, listStudents, moveStudent, updateStudent } from "./students";
import { getStudentHistory } from "./history";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const cls = (name: string, over: Partial<ClassInput> = {}): ClassInput => ({
  name,
  year: 4,
  division: "A",
  shift: "morning",
  school: "Escuela 5",
  schoolYear: 2026,
  ...over,
});

async function teacherWithCourse() {
  const teacher = newTeacher();
  await createClass(db, teacher, cls("Matemática"));
  await createClass(db, teacher, cls("Física"));
  const [course] = await listCourses(db, teacher);
  return { teacher, courseId: course.id };
}

describe("adding students (STUDENT)", () => {
  it("puts a student in every class of their course (STUDENT-2)", async () => {
    const { teacher, courseId } = await teacherWithCourse();
    const result = await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId });
    expect(result).toMatchObject({ ok: true });

    const list = await listClasses(db, teacher);
    expect(list.map((c) => [c.name, c.students])).toEqual([
      ["Física", 1],
      ["Matemática", 1],
    ]);
  });

  it("includes the course's students in a class added later (STUDENT-2)", async () => {
    // The reason students join the course rather than each class: a subject
    // added in the second cuatrimestre must not start with an empty list.
    const { teacher, courseId } = await teacherWithCourse();
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId });
    await createClass(db, teacher, cls("Química"));

    const quimica = (await listClasses(db, teacher)).find((c) => c.name === "Química");
    expect(quimica?.students).toBe(1);
  });

  it("lists students by last name, then first name, with their course (STUDENT-3)", async () => {
    const { teacher, courseId } = await teacherWithCourse();
    for (const [firstName, lastName] of [["Luis", "Pérez"], ["Zoe", "Álvarez"], ["Ana", "Pérez"]]) {
      await createStudent(db, teacher, { firstName, lastName, courseId });
    }
    const list = await listStudents(db, teacher);
    expect(list.map((s) => `${s.lastName}, ${s.firstName}`)).toEqual([
      "Álvarez, Zoe",
      "Pérez, Ana",
      "Pérez, Luis",
    ]);
    expect(list[0].courses).toEqual([
      { id: courseId, year: 4, division: "A", shift: "morning", schoolYear: "2026", school: "Escuela 5", outcome: null, outcomeOn: null },
    ]);
  });
});

describe("each teacher's students (OWNER-1)", () => {
  it("never adds a student to another teacher's course, nor shows them", async () => {
    const { teacher: a, courseId } = await teacherWithCourse();
    const b = newTeacher();

    expect(await createStudent(db, b, { firstName: "Eve", lastName: "Intrusa", courseId })).toEqual({
      ok: false,
      error: "courseNotFound",
    });
    await createStudent(db, a, { firstName: "Ana", lastName: "Pérez", courseId });
    expect(await listStudents(db, b)).toEqual([]);
    expect(await listStudents(db, a)).toHaveLength(1);
  });
});

describe("deleting a student (STUDENT-4)", () => {
  it("deletes the student and what was recorded about them, keeping the course and its classes", async () => {
    const { teacher, courseId } = await teacherWithCourse();
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId });
    await createStudent(db, teacher, { firstName: "Luis", lastName: "Pérez", courseId });
    const [ana] = await listStudents(db, teacher);
    const [mate] = (await listClasses(db, teacher)).filter((c) => c.name === "Matemática");
    await db.insert(exams).values({ teacherId: teacher, classId: mate.id, studentId: ana.id, takenOn: "2026-12-15", value: 6 });

    expect(await deleteStudent(db, teacher, ana.id)).toEqual({ ok: true, attachmentPaths: [] });

    expect((await listStudents(db, teacher)).map((s) => s.firstName)).toEqual(["Luis"]);
    expect(await db.select().from(exams).where(eq(exams.studentId, ana.id))).toEqual([]);
    expect(await db.select().from(courseStudents).where(eq(courseStudents.studentId, ana.id))).toEqual([]);
    expect((await listClasses(db, teacher)).map((c) => [c.name, c.students])).toEqual([
      ["Física", 1],
      ["Matemática", 1],
    ]);
  });

  it("refuses another teacher's student, or one that doesn't exist (OWNER-1)", async () => {
    const { teacher, courseId } = await teacherWithCourse();
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId });
    const [ana] = await listStudents(db, teacher);

    expect(await deleteStudent(db, newTeacher(), ana.id)).toEqual({ ok: false, error: "notFound" });
    expect(await deleteStudent(db, teacher, "nope")).toEqual({ ok: false, error: "notFound" });
    expect(await listStudents(db, teacher)).toHaveLength(1);
  });
});

describe("editing a student (STUDENT-7)", () => {
  it("changes the name, and only for the teacher's own student (OWNER-1)", async () => {
    const { teacher, courseId } = await teacherWithCourse();
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Peres", courseId });
    const [ana] = await listStudents(db, teacher);

    expect(
      await updateStudent(db, newTeacher(), { studentId: ana.id, firstName: "Eve", lastName: "Intrusa" }),
    ).toEqual({ ok: false, error: "notFound" });
    expect(await updateStudent(db, teacher, { studentId: ana.id, firstName: "Ana", lastName: "Pérez" })).toEqual({
      ok: true,
    });
    expect((await listStudents(db, teacher)).map((s) => `${s.lastName}, ${s.firstName}`)).toEqual(["Pérez, Ana"]);
  });
});

describe("moving a student to another course (STUDENT-8)", () => {
  async function twoCourses() {
    const { teacher, courseId: a } = await teacherWithCourse();
    await createClass(db, teacher, cls("Matemática", { division: "B" }));
    const b = (await listCourses(db, teacher)).find((c) => c.division === "B")!.id;
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: a });
    const [ana] = await listStudents(db, teacher);
    const mateA = (await listClasses(db, teacher)).find((c) => c.name === "Matemática" && c.division === "A")!;
    return { teacher, a, b, ana, mateA };
  }
  const coursesOf = async (teacher: string, studentId: string) =>
    (await getStudentHistory(db, teacher, studentId))!.courses.map((c) => [c.division, c.status]);

  it("with nothing recorded, the old course forgets them", async () => {
    const { teacher, a, b, ana } = await twoCourses();
    expect(await moveStudent(db, teacher, { studentId: ana.id, fromCourseId: a, toCourseId: b })).toEqual({ ok: true });
    expect(await coursesOf(teacher, ana.id)).toEqual([["B", "active"]]);
  });

  it("with something recorded, they stay in the old course as having left, and leave its groups", async () => {
    const { teacher, a, b, ana, mateA } = await twoCourses();
    await db.insert(exams).values({ teacherId: teacher, classId: mateA.id, studentId: ana.id, takenOn: "2026-12-15", value: 6 });
    const [group] = await db
      .insert(classGroups)
      .values({ teacherId: teacher, classId: mateA.id, name: "Martes" })
      .returning();
    await db
      .insert(classGroupStudents)
      .values({ teacherId: teacher, classId: mateA.id, studentId: ana.id, groupId: group.id });

    expect(await moveStudent(db, teacher, { studentId: ana.id, fromCourseId: a, toCourseId: b })).toEqual({ ok: true });

    expect(await coursesOf(teacher, ana.id)).toEqual([
      ["A", "withdrawn"],
      ["B", "active"],
    ]);
    expect(await db.select().from(classGroupStudents).where(eq(classGroupStudents.studentId, ana.id))).toEqual([]);
    // Only the course they are in now shows in the list.
    expect((await listStudents(db, teacher))[0].courses.map((c) => c.division)).toEqual(["B"]);

    // And back again: the course they had left takes them back.
    expect(await moveStudent(db, teacher, { studentId: ana.id, fromCourseId: b, toCourseId: a })).toEqual({ ok: true });
    expect(await coursesOf(teacher, ana.id)).toEqual([["A", "active"]]);
  });

  it("refuses another school year, the same course, a course they aren't in and another teacher's (OWNER-1)", async () => {
    const { teacher, a, b, ana } = await twoCourses();
    await createClass(db, teacher, cls("Matemática", { schoolYear: 2027, year: 5 }));
    const next = (await listCourses(db, teacher)).find((c) => c.schoolYear === "2027")!.id;
    const move = (who: string, fromCourseId: string, toCourseId: string) =>
      moveStudent(db, who, { studentId: ana.id, fromCourseId, toCourseId });

    expect(await move(teacher, a, next)).toEqual({ ok: false, error: "otherYear" });
    expect(await move(teacher, a, a)).toEqual({ ok: false, error: "notFound" });
    expect(await move(teacher, b, a)).toEqual({ ok: false, error: "notFound" });
    expect(await move(newTeacher(), a, b)).toEqual({ ok: false, error: "notFound" });
    expect(await coursesOf(teacher, ana.id)).toEqual([["A", "active"]]);
  });
});

describe("a deleted student's files (STUDENT-4)", () => {
  it("names the files of their own passing standards, and not the class's", async () => {
    const { teacher, courseId } = await teacherWithCourse();
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId });
    const [ana] = await listStudents(db, teacher);
    const [mate] = (await listClasses(db, teacher)).filter((c) => c.name === "Matemática");
    const base = { teacherId: teacher, scope: "class" as const, classId: mate.id, attachmentName: "x.pdf" };
    await db.insert(standards).values([
      { ...base, title: "De la clase", attachmentPath: `${teacher}/standards/a/x.pdf` },
      { ...base, title: "De Ana", studentId: ana.id, attachmentPath: `${teacher}/standards/b/x.pdf` },
    ]);

    expect(await deleteStudent(db, teacher, ana.id)).toEqual({
      ok: true,
      attachmentPaths: [`${teacher}/standards/b/x.pdf`],
    });
    expect((await db.select().from(standards).where(eq(standards.classId, mate.id))).map((s) => s.title)).toEqual([
      "De la clase",
    ]);
  });
});
