import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import { createClass, listClasses, listCourses } from "./classes";
import { createStudent, listStudents } from "./students";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const cls = (name: string, over: Partial<ClassInput> = {}): ClassInput => ({
  name,
  year: 4,
  division: "A",
  shift: "morning",
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
    expect(list[0].courses).toEqual([{ year: 4, division: "A", shift: "morning", schoolYear: "2026" }]);
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
