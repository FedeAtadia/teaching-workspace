import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { academicYears, classes, scores, standards, tasks, termGrades, terms, units } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import { createClass, deleteClass, getClassCounts, listClasses, listCourses, updateClass } from "./classes";
import {
  createStandard,
  createUnit,
  getClass,
  listClassStudents,
  listStandards,
  listTerms,
  listUnits,
  setStandardAttachment,
} from "./classDetail";
import { createStudent } from "./students";
import { createTask, getTask, saveScores, setTaskAttachment } from "./tasks";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const cls = (over: Partial<ClassInput> = {}): ClassInput => ({
  name: "Matemática",
  year: 4,
  division: "A",
  shift: "morning",
  school: "Escuela 5",
  schoolYear: 2026,
  ...over,
});

describe("adding classes (CLASS, COURSE)", () => {
  it("creates the school year with its two cuatrimestres on the first class (CLASS-4)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls());
    await createClass(db, teacher, cls({ name: "Física" }));

    const years = await db.select().from(academicYears).where(eq(academicYears.teacherId, teacher));
    expect(years.map((y) => y.name)).toEqual(["2026"]);
    const yearTerms = await db.select().from(terms).where(eq(terms.academicYearId, years[0].id));
    expect(yearTerms.map((t) => t.position).sort()).toEqual([1, 2]);
  });

  it("puts two subjects of the same year, division and shift in one course (COURSE-1)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls());
    await createClass(db, teacher, cls({ name: "Física" }));
    await createClass(db, teacher, cls({ shift: "afternoon" }));

    const courses = await listCourses(db, teacher);
    expect(courses.map((c) => c.shift)).toEqual(["morning", "afternoon"]);
    const list = await listClasses(db, teacher);
    const morning = list.filter((c) => c.shift === "morning");
    expect(new Set(morning.map((c) => c.courseId)).size).toBe(1);
  });

  it("rejects the same subject twice in a course, whatever its case (CLASS-5)", async () => {
    const teacher = newTeacher();
    expect(await createClass(db, teacher, cls())).toMatchObject({ ok: true });
    expect(await createClass(db, teacher, cls({ name: "matemática" }))).toEqual({
      ok: false,
      error: "duplicate",
    });
    const saved = await db.select().from(classes).where(eq(classes.teacherId, teacher));
    expect(saved).toHaveLength(1);
  });

  it("lists classes in course order, then by subject (COURSE-3)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls({ year: 5, name: "Química" }));
    await createClass(db, teacher, cls({ name: "Física" }));
    await createClass(db, teacher, cls({ schoolYear: 2025, name: "Biología" }));
    await createClass(db, teacher, cls());

    const list = await listClasses(db, teacher);
    expect(list.map((c) => `${c.schoolYear} ${c.year}${c.division} ${c.name}`)).toEqual([
      "2026 4A Física",
      "2026 4A Matemática",
      "2026 5A Química",
      "2025 4A Biología",
    ]);
  });
});

describe("each teacher's classes (OWNER-1)", () => {
  it("never shows one teacher's classes, courses or school years to another", async () => {
    const a = newTeacher();
    const b = newTeacher();
    await createClass(db, a, cls());

    expect(await listClasses(db, b)).toEqual([]);
    expect(await listCourses(db, b)).toEqual([]);
    // The same class for another teacher is theirs, not a duplicate of A's.
    expect(await createClass(db, b, cls())).toMatchObject({ ok: true });
    expect(await listClasses(db, a)).toHaveLength(1);
  });
});

/** A teacher's class with a student, a unit, a standard, a scored task with a file and a 2° grade. */
async function fullClass(teacher: string, over: Partial<ClassInput> = {}) {
  const created = await createClass(db, teacher, cls(over));
  if (!created.ok) throw new Error("setup failed");
  const detail = (await getClass(db, teacher, created.classId))!;
  await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: detail.courseId });
  const [student] = await listClassStudents(db, teacher, detail);
  const [, term2] = await listTerms(db, teacher, detail);
  await createUnit(db, teacher, { classId: detail.id, title: "Funciones", termId: term2.id });
  await createStandard(db, teacher, { classId: detail.id, title: "Resuelve", description: null });
  const [standard] = await listStandards(db, teacher, detail.id);
  await setStandardAttachment(
    db,
    teacher,
    { classId: detail.id, standardId: standard.id },
    { path: `${teacher}/standards/${standard.id}/rubrica.pdf`, name: "rubrica.pdf" },
  );
  const task = await createTask(db, teacher, {
    classId: detail.id,
    title: "TP 1",
    termId: term2.id,
    unitId: null,
    dueOn: null,
    description: null,
    criteria: null,
    standardIds: [standard.id],
  });
  if (!task.ok) throw new Error("setup failed");
  await saveScores(db, teacher, detail, task.taskId, {
    save: [{ studentId: student.id, status: "graded", value: 8, notes: null }],
    clear: [],
  });
  await setTaskAttachment(db, teacher, detail, task.taskId, {
    path: `${teacher}/${task.taskId}/tp.pdf`,
    name: "tp.pdf",
  });
  await db
    .insert(termGrades)
    .values({ teacherId: teacher, classId: detail.id, studentId: student.id, termId: term2.id, value: 8 });
  return { classId: detail.id, courseId: detail.courseId, taskId: task.taskId, standardId: standard.id };
}

const edit = (classId: string, over: Partial<ClassInput> = {}) => ({ ...cls(over), classId });

describe("changing a class (CLASS-6)", () => {
  it("renames the subject of this class only, refusing another subject of the course (CLASS-5)", async () => {
    const teacher = newTeacher();
    const { classId } = await fullClass(teacher);
    await createClass(db, teacher, cls({ name: "Física" }));

    expect(await updateClass(db, teacher, edit(classId, { name: "Álgebra" }))).toEqual({ ok: true });
    expect((await listClasses(db, teacher)).map((c) => c.name)).toEqual(["Álgebra", "Física"]);
    expect(await updateClass(db, teacher, edit(classId, { name: "física" }))).toEqual({
      ok: false,
      error: "duplicate",
    });
  });

  it("changes the course for all its classes, keeping its students and work", async () => {
    const teacher = newTeacher();
    const { classId, courseId } = await fullClass(teacher);
    await createClass(db, teacher, cls({ name: "Física" }));

    const changed = edit(classId, { shift: "evening", division: "B", year: 5, school: "Escuela 9" });
    expect(await updateClass(db, teacher, changed)).toEqual({ ok: true });

    const list = await listClasses(db, teacher);
    expect(list.map((c) => [c.name, c.courseId, c.year, c.division, c.shift, c.school, c.students])).toEqual([
      ["Física", courseId, 5, "B", "evening", "Escuela 9", 1],
      ["Matemática", courseId, 5, "B", "evening", "Escuela 9", 1],
    ]);
    expect(await getClassCounts(db, teacher, classId)).toMatchObject({ tasks: 1, scores: 1, units: 1, standards: 1 });
  });

  it("refuses fields that match another course of the teacher, saving nothing", async () => {
    const teacher = newTeacher();
    const { classId } = await fullClass(teacher);
    await createClass(db, teacher, cls({ name: "Física", shift: "afternoon" }));

    expect(await updateClass(db, teacher, edit(classId, { shift: "afternoon", name: "Química" }))).toEqual({
      ok: false,
      error: "courseExists",
    });
    expect((await listClasses(db, teacher)).map((c) => [c.name, c.shift])).toEqual([
      ["Matemática", "morning"],
      ["Física", "afternoon"],
    ]);
  });

  it("moves to another school year, its tasks, units and grades to the same cuatrimestre (CLASS-4)", async () => {
    const teacher = newTeacher();
    const { classId, taskId } = await fullClass(teacher);

    expect(await updateClass(db, teacher, edit(classId, { schoolYear: 2027 }))).toEqual({ ok: true });
    const moved = (await getClass(db, teacher, classId))!;
    expect(moved.schoolYear).toBe("2027");
    const [, term2] = await listTerms(db, teacher, moved);
    expect((await getTask(db, teacher, moved, taskId))?.termId).toBe(term2.id);
    expect((await listUnits(db, teacher, classId))[0].termId).toBe(term2.id);
    const grades = await db.select().from(termGrades).where(eq(termGrades.classId, classId));
    expect(grades.map((g) => g.termId)).toEqual([term2.id]);
  });

  it("changes nothing of another teacher's class (OWNER-1)", async () => {
    const teacher = newTeacher();
    const { classId } = await fullClass(teacher);
    const intruder = newTeacher();
    expect(await updateClass(db, intruder, edit(classId, { name: "Intrusa" }))).toEqual({
      ok: false,
      error: "notFound",
    });
    expect((await listClasses(db, teacher))[0].name).toBe("Matemática");
    expect(await listCourses(db, intruder)).toEqual([]);
  });
});

describe("deleting a class (CLASS-7)", () => {
  it("counts what goes with it, and the course's other classes", async () => {
    const teacher = newTeacher();
    const { classId } = await fullClass(teacher);
    await createClass(db, teacher, cls({ name: "Física" }));
    expect(await getClassCounts(db, teacher, classId)).toEqual({
      tasks: 1,
      scores: 1,
      units: 1,
      standards: 1,
      files: 2,
      otherClasses: ["Física"],
    });
  });

  it("deletes its work and hands back its files, keeping the course, its students and other classes", async () => {
    const teacher = newTeacher();
    const { classId, courseId, taskId, standardId } = await fullClass(teacher);
    await createClass(db, teacher, cls({ name: "Física" }));

    // FILE-4: the standards' files go too.
    expect(await deleteClass(db, teacher, classId)).toEqual({
      ok: true,
      attachmentPaths: [`${teacher}/${taskId}/tp.pdf`, `${teacher}/standards/${standardId}/rubrica.pdf`],
    });
    expect((await listClasses(db, teacher)).map((c) => [c.name, c.courseId, c.students])).toEqual([
      ["Física", courseId, 1],
    ]);
    expect(await db.select().from(tasks).where(eq(tasks.classId, classId))).toEqual([]);
    expect(await db.select().from(scores).where(eq(scores.taskId, taskId))).toEqual([]);
    expect(await db.select().from(units).where(eq(units.classId, classId))).toEqual([]);
    expect(await db.select().from(standards).where(eq(standards.classId, classId))).toEqual([]);
  });

  it("deletes nothing of another teacher's (OWNER-1)", async () => {
    const teacher = newTeacher();
    const { classId } = await fullClass(teacher);
    const intruder = newTeacher();
    expect(await deleteClass(db, intruder, classId)).toEqual({ ok: false, error: "notFound" });
    expect(await getClassCounts(db, intruder, classId)).toBeNull();
    expect(await deleteClass(db, teacher, "not-an-id")).toEqual({ ok: false, error: "notFound" });
    expect(await listClasses(db, teacher)).toHaveLength(1);
  });
});
