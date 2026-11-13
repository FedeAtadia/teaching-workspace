import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import { createClass } from "./classes";
import { getClass, listTerms } from "./classDetail";
import { copyClassContent, listCopySources, unlinkMissingFiles } from "./copyClass";
import { createStudent, listStudents } from "./students";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const input = (schoolYear: number, name = "Matemática") => ({
  name,
  year: 5,
  division: "A",
  shift: "morning" as const,
  school: "EPET 30",
  schoolYear,
});

async function newClass(teacherId: string, schoolYear: number, name?: string) {
  const created = await createClass(db, teacherId, input(schoolYear, name));
  if (!created.ok) throw new Error("createClass failed");
  return (await getClass(db, teacherId, created.classId))!;
}

/** Last year's class with a unit per cuatrimestre, standards, tasks and their files. */
async function lastYear() {
  const teacherId = newTeacher();
  const cls = await newClass(teacherId, 2026);
  const [t1, t2] = await listTerms(db, teacherId, cls);
  await createStudent(db, teacherId, { firstName: "Ana", lastName: "Pérez", courseId: cls.courseId });
  const [ana] = await listStudents(db, teacherId);
  const [u1, u2] = await db
    .insert(schema.units)
    .values([
      { teacherId, classId: cls.id, termId: t1.id, title: "Funciones", position: 0 },
      { teacherId, classId: cls.id, termId: t2.id, title: "Derivadas", position: 1 },
    ])
    .returning();
  const [general, ofUnit, ofAna] = await db
    .insert(schema.standards)
    .values([
      {
        teacherId,
        classId: cls.id,
        scope: "class",
        title: "Resuelve problemas",
        attachmentPath: `${teacherId}/standards/s1/rubrica.pdf`,
        attachmentName: "rúbrica.pdf",
      },
      { teacherId, classId: cls.id, scope: "unit", unitId: u2.id, title: "Deriva" },
      { teacherId, classId: cls.id, scope: "class", studentId: ana.id, title: "Propio de Ana" },
    ])
    .returning();
  const [tp1, tp2] = await db
    .insert(schema.tasks)
    .values([
      {
        teacherId,
        classId: cls.id,
        termId: t1.id,
        unitId: u1.id,
        title: "TP 1",
        description: "Gráficos",
        criteria: "Ejes rotulados",
        dueOn: "2026-04-10",
        assignedOn: "2026-04-01",
        attachmentPath: `${teacherId}/t1/tp1.pdf`,
        attachmentName: "tp1.pdf",
        adaptedDescription: "Con ayuda",
        adaptedAttachmentPath: `${teacherId}/t1/adapted/tp1-a.pdf`,
        adaptedAttachmentName: "tp1 adaptado.pdf",
      },
      { teacherId, classId: cls.id, termId: t2.id, unitId: u2.id, title: "TP 2" },
    ])
    .returning();
  await db.insert(schema.taskStandards).values([
    { teacherId, taskId: tp1.id, standardId: general.id },
    { teacherId, taskId: tp1.id, standardId: ofAna.id },
    { teacherId, taskId: tp2.id, standardId: ofUnit.id },
  ]);
  await db.insert(schema.scores).values({ teacherId, taskId: tp1.id, studentId: ana.id, value: 8 });
  const [group] = await db.insert(schema.classGroups).values({ teacherId, classId: cls.id, name: "Martes" }).returning();
  await db.insert(schema.taskGroups).values({ teacherId, taskId: tp1.id, groupId: group.id, dueOn: "2026-04-12" });
  return { teacherId, cls };
}

describe("copying a class's content (COPY)", () => {
  it("copies units, the class's standards and tasks into the same cuatrimestres, without dates or scores (COPY-2)", async () => {
    const { teacherId, cls } = await lastYear();
    const next = await newClass(teacherId, 2027);
    const [n1, n2] = await listTerms(db, teacherId, next);

    const result = await copyClassContent(db, teacherId, { fromClassId: cls.id, toClassId: next.id });
    expect(result).toMatchObject({ ok: true, units: 2, standards: 2, tasks: 2 });

    const newUnits = await db.select().from(schema.units).where(eq(schema.units.classId, next.id));
    expect(newUnits.map((u) => [u.title, u.termId]).sort()).toEqual([
      ["Derivadas", n2.id],
      ["Funciones", n1.id],
    ]);
    const unitIdOf = (title: string) => newUnits.find((u) => u.title === title)!.id;

    const newStandards = await db.select().from(schema.standards).where(eq(schema.standards.classId, next.id));
    // A student's own standard (ADAPT-2) stays behind.
    expect(newStandards.map((s) => [s.title, s.scope, s.unitId, s.studentId]).sort()).toEqual([
      ["Deriva", "unit", unitIdOf("Derivadas"), null],
      ["Resuelve problemas", "class", null, null],
    ]);

    const newTasks = await db.select().from(schema.tasks).where(eq(schema.tasks.classId, next.id));
    const tp1 = newTasks.find((t) => t.title === "TP 1")!;
    expect(tp1).toMatchObject({
      termId: n1.id,
      unitId: unitIdOf("Funciones"),
      description: "Gráficos",
      criteria: "Ejes rotulados",
      adaptedDescription: "Con ayuda",
      dueOn: null,
      assignedOn: null,
      attachmentName: "tp1.pdf",
      adaptedAttachmentName: "tp1 adaptado.pdf",
    });
    expect(newTasks.find((t) => t.title === "TP 2")).toMatchObject({ termId: n2.id, unitId: unitIdOf("Derivadas") });

    // The task's standards point at the copies; nothing of scores or groups comes along.
    const links = await db
      .select({ title: schema.standards.title })
      .from(schema.taskStandards)
      .innerJoin(schema.standards, eq(schema.taskStandards.standardId, schema.standards.id))
      .where(eq(schema.taskStandards.taskId, tp1.id));
    expect(links.map((l) => l.title)).toEqual(["Resuelve problemas"]);
    expect(await db.select().from(schema.scores).where(eq(schema.scores.taskId, tp1.id))).toEqual([]);
    expect(await db.select().from(schema.taskGroups).where(eq(schema.taskGroups.taskId, tp1.id))).toEqual([]);

    // The original is untouched.
    expect(await db.select().from(schema.tasks).where(eq(schema.tasks.classId, cls.id))).toHaveLength(2);
  });

  it("names each file to copy, into the new task's or standard's own folder (COPY-3)", async () => {
    const { teacherId, cls } = await lastYear();
    const next = await newClass(teacherId, 2027);
    const result = await copyClassContent(db, teacherId, { fromClassId: cls.id, toClassId: next.id });
    if (!result.ok) throw new Error("copy failed");

    const tp1 = (await db.select().from(schema.tasks).where(eq(schema.tasks.classId, next.id))).find(
      (t) => t.title === "TP 1",
    )!;
    const rubric = (await db.select().from(schema.standards).where(eq(schema.standards.classId, next.id))).find(
      (s) => s.title === "Resuelve problemas",
    )!;
    expect(result.files.sort((a, b) => a.from.localeCompare(b.from))).toEqual(
      [
        { from: `${teacherId}/standards/s1/rubrica.pdf`, to: `${teacherId}/standards/${rubric.id}/rubrica.pdf` },
        { from: `${teacherId}/t1/adapted/tp1-a.pdf`, to: `${teacherId}/${tp1.id}/adapted/tp1-a.pdf` },
        { from: `${teacherId}/t1/tp1.pdf`, to: `${teacherId}/${tp1.id}/tp1.pdf` },
      ].sort((a, b) => a.from.localeCompare(b.from)),
    );
    expect(tp1.attachmentPath).toBe(`${teacherId}/${tp1.id}/tp1.pdf`);
    expect(rubric.attachmentPath).toBe(`${teacherId}/standards/${rubric.id}/rubrica.pdf`);

    // A file Storage couldn't copy is unlinked from its copy, not from the original.
    await unlinkMissingFiles(db, teacherId, [tp1.attachmentPath!, rubric.attachmentPath!]);
    const [after] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, tp1.id));
    expect(after).toMatchObject({ attachmentPath: null, attachmentName: null, adaptedAttachmentName: "tp1 adaptado.pdf" });
    const [rubricAfter] = await db.select().from(schema.standards).where(eq(schema.standards.id, rubric.id));
    expect(rubricAfter.attachmentPath).toBeNull();
    const original = await db.select().from(schema.tasks).where(eq(schema.tasks.classId, cls.id));
    expect(original.find((t) => t.title === "TP 1")!.attachmentPath).toBe(`${teacherId}/t1/tp1.pdf`);
  });

  it("refuses another teacher's class, either way, and copying a class onto itself (OWNER-1)", async () => {
    const { teacherId, cls } = await lastYear();
    const next = await newClass(teacherId, 2027);
    const other = newTeacher();
    const theirs = await newClass(other, 2027);
    const notFound = { ok: false, error: "notFound" };
    expect(await copyClassContent(db, other, { fromClassId: cls.id, toClassId: theirs.id })).toEqual(notFound);
    expect(await copyClassContent(db, teacherId, { fromClassId: cls.id, toClassId: theirs.id })).toEqual(notFound);
    expect(await copyClassContent(db, teacherId, { fromClassId: cls.id, toClassId: cls.id })).toEqual(notFound);
    expect(await copyClassContent(db, teacherId, { fromClassId: "nope", toClassId: next.id })).toEqual(notFound);
    expect(await db.select().from(schema.tasks).where(eq(schema.tasks.classId, theirs.id))).toEqual([]);
  });

  it("offers every class of the teacher's to copy from, newest school year first (COPY-1)", async () => {
    const { teacherId } = await lastYear();
    await newClass(teacherId, 2027, "Física");
    await newClass(newTeacher(), 2027, "Química");
    expect((await listCopySources(db, teacherId)).map((c) => [c.schoolYear, c.name])).toEqual([
      ["2027", "Física"],
      ["2026", "Matemática"],
    ]);
  });
});
