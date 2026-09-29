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
  getClass,
  listClassStudents,
  listStandards,
  listTerms,
  listUnits,
} from "./classDetail";
import { createStudent } from "./students";

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
