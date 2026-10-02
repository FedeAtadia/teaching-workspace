import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { courseStudents } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { TaskInput } from "@/lib/validation";
import { createClass, deleteClass } from "./classes";
import {
  createStandard,
  getClass,
  listClassStudents,
  listStandards,
  listTerms,
  type ClassDetail,
} from "./classDetail";
import { getStudentHistory } from "./history";
import { createStudent } from "./students";
import {
  createTask,
  deleteTask,
  getGradebook,
  getTask,
  listTaskScores,
  saveScores,
  setTaskAdaptedAttachment,
  updateTask,
} from "./tasks";
import { getAdaptations, listStudentStandards, setAdaptation } from "./adaptations";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

type Setup = { teacher: string; cls: ClassDetail; term1: string; students: Record<string, string> };

/** Lengua with Ana (who has an adaptation) and Bruno. */
async function setup(): Promise<Setup> {
  const teacher = newTeacher();
  const created = await createClass(db, teacher, {
    name: "Lengua",
    year: 2,
    division: "A",
    shift: "morning",
    school: "Escuela 5",
    schoolYear: 2026,
  });
  if (!created.ok) throw new Error("setup failed");
  const cls = (await getClass(db, teacher, created.classId))!;
  for (const firstName of ["Ana", "Bruno"]) {
    await createStudent(db, teacher, { firstName, lastName: firstName, courseId: cls.courseId });
  }
  const students = Object.fromEntries((await listClassStudents(db, teacher, cls)).map((s) => [s.firstName, s.id]));
  await setAdaptation(db, teacher, cls, { studentId: students.Ana, notes: "Consignas más cortas y más tiempo" });
  const [term1] = await listTerms(db, teacher, cls);
  return { teacher, cls, term1: term1.id, students };
}

const task = (s: Setup, over: Partial<TaskInput> = {}): TaskInput => ({
  classId: s.cls.id,
  title: "TP",
  termId: s.term1,
  unitId: null,
  dueOn: null,
  description: null,
  criteria: null,
  standardIds: [],
  ...over,
});

const notFound = { ok: false, error: "notFound" };

describe("a student's adaptation (ADAPT-1)", () => {
  it("keeps what is adapted, changes it, and removes it when saved empty", async () => {
    const s = await setup();
    expect((await getAdaptations(db, s.teacher, s.cls.id)).get(s.students.Ana)).toBe("Consignas más cortas y más tiempo");
    expect((await getAdaptations(db, s.teacher, s.cls.id)).has(s.students.Bruno)).toBe(false);

    await setAdaptation(db, s.teacher, s.cls, { studentId: s.students.Ana, notes: "Más tiempo" });
    expect((await getAdaptations(db, s.teacher, s.cls.id)).get(s.students.Ana)).toBe("Más tiempo");
    expect(await setAdaptation(db, s.teacher, s.cls, { studentId: s.students.Ana, notes: "" })).toEqual({ ok: true });
    expect((await getAdaptations(db, s.teacher, s.cls.id)).size).toBe(0);
  });

  it("only for active students of the course, and nothing of another teacher's (ADAPT-5)", async () => {
    const s = await setup();
    const other = await setup();
    expect(
      await setAdaptation(db, s.teacher, s.cls, { studentId: other.students.Bruno, notes: "x" }),
    ).toEqual(notFound);
    await db.update(courseStudents).set({ status: "withdrawn" }).where(eq(courseStudents.studentId, s.students.Bruno));
    expect(await setAdaptation(db, s.teacher, s.cls, { studentId: s.students.Bruno, notes: "x" })).toEqual(notFound);
    expect((await getAdaptations(db, newTeacher(), s.cls.id)).size).toBe(0);
  });

  it("shows in the student's history", async () => {
    const s = await setup();
    const [cls] = (await getStudentHistory(db, s.teacher, s.students.Ana))!.courses[0].classes;
    expect(cls.adaptation).toBe("Consignas más cortas y más tiempo");
    expect((await getStudentHistory(db, s.teacher, s.students.Bruno))!.courses[0].classes[0].adaptation).toBeNull();
  });
});

describe("a student's own passing standards (ADAPT-2)", () => {
  it("lists them under the student, apart from the class's, and hides them without an adaptation", async () => {
    const s = await setup();
    await createStandard(db, s.teacher, { classId: s.cls.id, title: "Escribe textos", description: null });
    expect(
      await createStandard(db, s.teacher, {
        classId: s.cls.id,
        title: "Escribe oraciones",
        description: null,
        studentId: s.students.Ana,
      }),
    ).toEqual({ ok: true });

    expect((await listStandards(db, s.teacher, s.cls.id)).map((x) => x.title)).toEqual(["Escribe textos"]);
    expect(
      (await listStudentStandards(db, s.teacher, s.cls.id)).map((g) => [g.studentId, g.standards.map((x) => x.title)]),
    ).toEqual([[s.students.Ana, ["Escribe oraciones"]]]);

    await setAdaptation(db, s.teacher, s.cls, { studentId: s.students.Ana, notes: "" });
    expect(await listStudentStandards(db, s.teacher, s.cls.id)).toEqual([]);
  });

  it("refuses one for a student with no adaptation, and tasks can't link them", async () => {
    const s = await setup();
    expect(
      await createStandard(db, s.teacher, {
        classId: s.cls.id,
        title: "X",
        description: null,
        studentId: s.students.Bruno,
      }),
    ).toEqual(notFound);
    await createStandard(db, s.teacher, { classId: s.cls.id, title: "Propio", description: null, studentId: s.students.Ana });
    const [own] = (await listStudentStandards(db, s.teacher, s.cls.id))[0].standards;
    expect(await createTask(db, s.teacher, task(s, { standardIds: [own.id] }))).toEqual(notFound);
  });
});

describe("a task's adapted version (ADAPT-3)", () => {
  it("keeps the adapted description and specific standard, and changes them on edit", async () => {
    const s = await setup();
    const created = await createTask(
      db,
      s.teacher,
      task(s, { adaptedDescription: "Ejercicios 1 a 5", adaptedCriteria: "Responde con sus palabras" }),
    );
    if (!created.ok) throw new Error("createTask failed");
    expect(await getTask(db, s.teacher, s.cls, created.taskId)).toMatchObject({
      adaptedDescription: "Ejercicios 1 a 5",
      adaptedCriteria: "Responde con sus palabras",
    });
    await updateTask(db, s.teacher, { ...task(s, { adaptedDescription: null, adaptedCriteria: "Otra" }), taskId: created.taskId });
    expect(await getTask(db, s.teacher, s.cls, created.taskId)).toMatchObject({
      adaptedDescription: null,
      adaptedCriteria: "Otra",
    });
  });

  it("keeps its file in the task's adapted folder, and hands it back when the task or class is deleted", async () => {
    const s = await setup();
    const created = await createTask(db, s.teacher, task(s));
    if (!created.ok) throw new Error("createTask failed");
    const id = created.taskId;
    const path = `${s.teacher}/${id}/adapted/tp.pdf`;

    expect(
      await setTaskAdaptedAttachment(db, s.teacher, s.cls, id, { path: `${s.teacher}/${id}/tp.pdf`, name: "tp.pdf" }),
    ).toEqual(notFound);
    expect(await setTaskAdaptedAttachment(db, s.teacher, s.cls, id, { path, name: "TP adaptado.pdf" })).toEqual({
      ok: true,
      previousPath: null,
    });
    expect((await getTask(db, s.teacher, s.cls, id))?.adaptedAttachmentName).toBe("TP adaptado.pdf");
    expect(await deleteTask(db, s.teacher, s.cls, id)).toEqual({
      ok: true,
      attachmentPath: null,
      adaptedAttachmentPath: path,
    });

    const again = await createTask(db, s.teacher, task(s));
    if (!again.ok) throw new Error("createTask failed");
    const second = `${s.teacher}/${again.taskId}/adapted/tp.pdf`;
    await setTaskAdaptedAttachment(db, s.teacher, s.cls, again.taskId, { path: second, name: "tp.pdf" });
    expect(await deleteClass(db, s.teacher, s.cls.id)).toEqual({ ok: true, attachmentPaths: [second] });
  });
});

describe("adapted scores (ADAPT-4)", () => {
  it("saves the mark, and shows it in the gradebook and the history", async () => {
    const s = await setup();
    const created = await createTask(db, s.teacher, task(s, { title: "Lectura" }));
    if (!created.ok) throw new Error("createTask failed");
    await saveScores(db, s.teacher, s.cls, created.taskId, {
      save: [
        { studentId: s.students.Ana, status: "graded", value: 8, notes: null, adapted: true },
        { studentId: s.students.Bruno, status: "graded", value: 6, notes: null, adapted: false },
      ],
      clear: [],
    });

    expect(
      (await listTaskScores(db, s.teacher, created.taskId)).map((r) => [r.studentId, r.adapted]).sort(),
    ).toEqual(
      [
        [s.students.Ana, true],
        [s.students.Bruno, false],
      ].sort(),
    );
    const book = await getGradebook(db, s.teacher, s.cls, s.term1);
    expect(book.rows.map((r) => [r.student.firstName, r.cells[0]])).toEqual([
      ["Ana", { status: "graded", value: 8, adapted: true }],
      ["Bruno", { status: "graded", value: 6, adapted: false }],
    ]);
    // Adapted scores count in averages like any other.
    expect(book.rows[0].suggestion.average).toBe(8);

    const [term] = (await getStudentHistory(db, s.teacher, s.students.Ana))!.courses[0].classes[0].terms;
    expect(term.tasks[0].score).toMatchObject({ value: 8, adapted: true });
  });
});
