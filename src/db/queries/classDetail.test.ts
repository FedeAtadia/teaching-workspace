import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { courseStudents } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import { createClass, listCourses } from "./classes";
import {
  createStandard,
  createUnit,
  deleteStandard,
  deleteUnit,
  getClass,
  listClassStudents,
  listStandards,
  listTerms,
  listUnits,
  updateStandard,
  updateUnit,
  type ClassDetail,
} from "./classDetail";
import { createStudent } from "./students";
import { createTask, getTask } from "./tasks";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

/** A teacher with Matemática in 4° A (2026) and its class id. */
async function setup() {
  const teacher = newTeacher();
  const created = await createClass(db, teacher, {
    name: "Matemática",
    year: 4,
    division: "A",
    shift: "morning",
    school: "Escuela 5",
    schoolYear: 2026,
  });
  if (!created.ok) throw new Error("setup failed");
  const [course] = await listCourses(db, teacher);
  const cls = await getClass(db, teacher, created.classId);
  if (!cls) throw new Error("setup failed");
  return { teacher, classId: created.classId, courseId: course.id, cls };
}

describe("opening a class", () => {
  it("returns the class with its course and school year", async () => {
    const { teacher, classId } = await setup();
    expect(await getClass(db, teacher, classId)).toMatchObject({
      id: classId,
      name: "Matemática",
      year: 4,
      division: "A",
      shift: "morning",
      schoolYear: "2026",
      school: "Escuela 5",
    });
  });

  it("finds nothing for another teacher's class, a missing one, or a malformed id (OWNER-1)", async () => {
    const { classId } = await setup();
    expect(await getClass(db, newTeacher(), classId)).toBeNull();
    expect(await getClass(db, newTeacher(), randomUUID())).toBeNull();
    expect(await getClass(db, newTeacher(), "not-an-id")).toBeNull();
  });
});

describe("a class's students (ROSTER)", () => {
  it("lists the course's active students in last-name order (ROSTER-1)", async () => {
    const { teacher, courseId, cls } = await setup();
    for (const [firstName, lastName] of [["Luis", "Pérez"], ["Zoe", "Álvarez"], ["Ana", "Benítez"]]) {
      await createStudent(db, teacher, { firstName, lastName, courseId });
    }
    // Benítez leaves the course: the class list must drop them.
    const [benitez] = (await listClassStudents(db, teacher, cls)).filter((s) => s.lastName === "Benítez");
    await db.update(courseStudents).set({ status: "withdrawn" }).where(eq(courseStudents.studentId, benitez.id));

    const roster = await listClassStudents(db, teacher, cls);
    expect(roster.map((s) => s.lastName)).toEqual(["Álvarez", "Pérez"]);
  });
});

describe("passing standards (STD)", () => {
  it("lists standards in the order they were added (STD-1, STD-2)", async () => {
    const { teacher, classId } = await setup();
    for (const title of ["Resuelve ecuaciones", "Justifica sus respuestas", "Entrega en término"]) {
      expect(await createStandard(db, teacher, { classId, title, description: null })).toEqual({ ok: true });
    }
    expect((await listStandards(db, teacher, classId)).map((s) => s.title)).toEqual([
      "Resuelve ecuaciones",
      "Justifica sus respuestas",
      "Entrega en término",
    ]);
  });

  it("adds nothing to another teacher's class (OWNER-1)", async () => {
    const { teacher, classId } = await setup();
    expect(await createStandard(db, newTeacher(), { classId, title: "Intruso", description: null })).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(await listStandards(db, teacher, classId)).toEqual([]);
    expect(await listStandards(db, newTeacher(), classId)).toEqual([]);
  });
});

describe("units (UNIT)", () => {
  it("lists units in the order added, with their cuatrimestre if given (UNIT-1, UNIT-2)", async () => {
    const { teacher, classId, cls } = await setup();
    const terms = await listTerms(db, teacher, cls);
    expect(terms.map((t) => t.position)).toEqual([1, 2]);

    await createUnit(db, teacher, { classId, title: "Funciones", termId: terms[0].id });
    await createUnit(db, teacher, { classId, title: "Repaso", termId: null });
    await createUnit(db, teacher, { classId, title: "Estadística", termId: terms[1].id });

    expect((await listUnits(db, teacher, classId)).map((u) => [u.title, u.termPosition])).toEqual([
      ["Funciones", 1],
      ["Repaso", null],
      ["Estadística", 2],
    ]);
  });

  it("refuses a cuatrimestre from another school year (UNIT-1)", async () => {
    const { teacher, classId } = await setup();
    const other = await createClass(db, teacher, {
      name: "Física",
      year: 5,
      division: "B",
      shift: "afternoon",
      school: "Escuela 5",
      schoolYear: 2025,
    });
    if (!other.ok) throw new Error("setup failed");
    const otherClass = await getClass(db, teacher, other.classId);
    if (!otherClass) throw new Error("setup failed");
    const [otherTerm] = await listTerms(db, teacher, otherClass);

    expect(await createUnit(db, teacher, { classId, title: "Mezcla", termId: otherTerm.id })).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  it("adds nothing to another teacher's class (OWNER-1)", async () => {
    const { classId } = await setup();
    expect(await createUnit(db, newTeacher(), { classId, title: "Intrusa", termId: null })).toEqual({
      ok: false,
      error: "notFound",
    });
  });
});

/** A task in the class's first cuatrimestre, optionally in a unit and assessing standards. */
async function addTask(
  teacher: string,
  cls: ClassDetail,
  over: { unitId?: string | null; standardIds?: string[] } = {},
): Promise<string> {
  const [term] = await listTerms(db, teacher, cls);
  const result = await createTask(db, teacher, {
    classId: cls.id,
    title: "TP",
    termId: term.id,
    unitId: over.unitId ?? null,
    dueOn: null,
    description: null,
    criteria: null,
    standardIds: over.standardIds ?? [],
  });
  if (!result.ok) throw new Error("createTask failed");
  return result.taskId;
}

const notFound = { ok: false, error: "notFound" };

describe("changing and deleting standards (STD-3, STD-4)", () => {
  it("changes the title and description, keeping its place and its tasks (STD-3)", async () => {
    const { teacher, classId, cls } = await setup();
    for (const title of ["Primero", "Segundo", "Tercero"]) {
      await createStandard(db, teacher, { classId, title, description: null });
    }
    const [, second] = await listStandards(db, teacher, classId);
    await addTask(teacher, cls, { standardIds: [second.id] });

    expect(
      await updateStandard(db, teacher, {
        classId,
        standardId: second.id,
        title: "Justifica",
        description: "Con sus palabras",
      }),
    ).toEqual({ ok: true });
    expect(await listStandards(db, teacher, classId)).toMatchObject([
      { title: "Primero", tasks: 0 },
      { id: second.id, title: "Justifica", description: "Con sus palabras", tasks: 1 },
      { title: "Tercero", tasks: 0 },
    ]);
  });

  it("deletes a standard and its task links, keeping the tasks and their scores (STD-4)", async () => {
    const { teacher, classId, cls } = await setup();
    await createStandard(db, teacher, { classId, title: "Borrar", description: null });
    await createStandard(db, teacher, { classId, title: "Queda", description: null });
    const [doomed, kept] = await listStandards(db, teacher, classId);
    const taskId = await addTask(teacher, cls, { standardIds: [doomed.id, kept.id] });

    expect(await deleteStandard(db, teacher, { classId, standardId: doomed.id })).toEqual({ ok: true });
    expect((await listStandards(db, teacher, classId)).map((s) => s.title)).toEqual(["Queda"]);
    expect((await getTask(db, teacher, cls, taskId))?.standards).toEqual([{ id: kept.id, title: "Queda" }]);
  });

  it("changes or deletes nothing of another teacher's, or of another class (OWNER-1)", async () => {
    const { teacher, classId } = await setup();
    const other = await setup();
    await createStandard(db, teacher, { classId, title: "Mío", description: null });
    const [mine] = await listStandards(db, teacher, classId);

    const edit = { classId, standardId: mine.id, title: "Intruso", description: null };
    expect(await updateStandard(db, newTeacher(), edit)).toEqual(notFound);
    expect(await deleteStandard(db, newTeacher(), { classId, standardId: mine.id })).toEqual(notFound);
    // Right teacher, wrong class in the URL.
    expect(await updateStandard(db, other.teacher, { ...edit, classId: other.classId })).toEqual(notFound);
    expect(await deleteStandard(db, teacher, { classId: other.classId, standardId: mine.id })).toEqual(notFound);
    expect(await deleteStandard(db, teacher, { classId, standardId: "not-an-id" })).toEqual(notFound);
    expect((await listStandards(db, teacher, classId)).map((s) => s.title)).toEqual(["Mío"]);
  });
});

describe("changing and deleting units (UNIT-3, UNIT-4)", () => {
  it("changes the title and cuatrimestre, keeping its place and its tasks (UNIT-3)", async () => {
    const { teacher, classId, cls } = await setup();
    const [term1, term2] = await listTerms(db, teacher, cls);
    await createUnit(db, teacher, { classId, title: "Funciones", termId: term1.id });
    await createUnit(db, teacher, { classId, title: "Estadística", termId: null });
    const [first] = await listUnits(db, teacher, classId);
    await addTask(teacher, cls, { unitId: first.id });

    expect(await updateUnit(db, teacher, { classId, unitId: first.id, title: "Álgebra", termId: term2.id })).toEqual({
      ok: true,
    });
    expect(await listUnits(db, teacher, classId)).toMatchObject([
      { id: first.id, title: "Álgebra", termId: term2.id, termPosition: 2, tasks: 1 },
      { title: "Estadística", termId: null, termPosition: null, tasks: 0 },
    ]);
    expect(await updateUnit(db, teacher, { classId, unitId: first.id, title: "Álgebra", termId: null })).toEqual({
      ok: true,
    });
    expect((await listUnits(db, teacher, classId))[0].termPosition).toBeNull();
  });

  it("refuses a cuatrimestre from another school year (UNIT-3)", async () => {
    const { teacher, classId } = await setup();
    const other = await setup();
    const [foreignTerm] = await listTerms(db, other.teacher, other.cls);
    await createUnit(db, teacher, { classId, title: "Funciones", termId: null });
    const [unit] = await listUnits(db, teacher, classId);

    expect(await updateUnit(db, teacher, { classId, unitId: unit.id, title: "X", termId: foreignTerm.id })).toEqual(
      notFound,
    );
    expect((await listUnits(db, teacher, classId))[0].title).toBe("Funciones");
  });

  it("deletes a unit, leaving its tasks without one (UNIT-4)", async () => {
    const { teacher, classId, cls } = await setup();
    await createUnit(db, teacher, { classId, title: "Borrar", termId: null });
    await createUnit(db, teacher, { classId, title: "Queda", termId: null });
    const [doomed] = await listUnits(db, teacher, classId);
    const taskId = await addTask(teacher, cls, { unitId: doomed.id });

    expect(await deleteUnit(db, teacher, { classId, unitId: doomed.id })).toEqual({ ok: true });
    expect((await listUnits(db, teacher, classId)).map((u) => u.title)).toEqual(["Queda"]);
    expect(await getTask(db, teacher, cls, taskId)).toMatchObject({ id: taskId, unitId: null, unitTitle: null });
  });

  it("changes or deletes nothing of another teacher's, or of another class (OWNER-1)", async () => {
    const { teacher, classId } = await setup();
    const other = await setup();
    await createUnit(db, teacher, { classId, title: "Mía", termId: null });
    const [mine] = await listUnits(db, teacher, classId);

    const edit = { classId, unitId: mine.id, title: "Intrusa", termId: null };
    expect(await updateUnit(db, newTeacher(), edit)).toEqual(notFound);
    expect(await deleteUnit(db, newTeacher(), { classId, unitId: mine.id })).toEqual(notFound);
    expect(await updateUnit(db, other.teacher, { ...edit, classId: other.classId })).toEqual(notFound);
    expect(await deleteUnit(db, teacher, { classId: other.classId, unitId: mine.id })).toEqual(notFound);
    expect((await listUnits(db, teacher, classId)).map((u) => u.title)).toEqual(["Mía"]);
  });
});
