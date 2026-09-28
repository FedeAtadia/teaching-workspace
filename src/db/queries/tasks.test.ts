import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { scores } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { TaskInput } from "@/lib/validation";
import { createClass, listCourses } from "./classes";
import {
  createStandard,
  createUnit,
  getClass,
  listClassStudents,
  listStandards,
  listTerms,
  listUnits,
  type ClassDetail,
} from "./classDetail";
import { createStudent } from "./students";
import { createTask, getGradebook, getTask, listTaskScores, listTasks, saveScores } from "./tasks";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

type Setup = {
  teacher: string;
  cls: ClassDetail;
  courseId: string;
  term1: string;
  term2: string;
  students: Record<string, string>;
};

/** A teacher with Matemática in 4° A (2026), two students, and its two cuatrimestres. */
async function setup(): Promise<Setup> {
  const teacher = newTeacher();
  const created = await createClass(db, teacher, {
    name: "Matemática",
    year: 4,
    division: "A",
    shift: "morning",
    schoolYear: 2026,
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
    courseId: course.id,
    term1: term1.id,
    term2: term2.id,
    students: Object.fromEntries(roster.map((s) => [s.lastName, s.id])),
  };
}

const task = (s: Setup, over: Partial<TaskInput> = {}): TaskInput => ({
  classId: s.cls.id,
  title: "TP 1",
  termId: s.term1,
  unitId: null,
  dueOn: null,
  description: null,
  criteria: null,
  standardIds: [],
  ...over,
});

async function newTask(s: Setup, over: Partial<TaskInput> = {}): Promise<string> {
  const result = await createTask(db, s.teacher, task(s, over));
  if (!result.ok) throw new Error("createTask failed");
  return result.taskId;
}

describe("adding tasks (TASK)", () => {
  it("stores a task with its unit, date, texts and linked standards (TASK-1, TASK-2)", async () => {
    const s = await setup();
    await createStandard(db, s.teacher, { classId: s.cls.id, title: "Resuelve", description: null });
    await createUnit(db, s.teacher, { classId: s.cls.id, title: "Funciones", termId: null });
    const [standard] = await listStandards(db, s.teacher, s.cls.id);
    const [unit] = await listUnits(db, s.teacher, s.cls.id);

    const id = await newTask(s, {
      unitId: unit.id,
      dueOn: "2026-05-10",
      description: "Ejercicios 1 a 10",
      criteria: "Grafica correctamente",
      standardIds: [standard.id],
    });
    expect(await getTask(db, s.teacher, s.cls, id)).toMatchObject({
      id,
      title: "TP 1",
      termPosition: 1,
      unitTitle: "Funciones",
      dueOn: "2026-05-10",
      description: "Ejercicios 1 a 10",
      criteria: "Grafica correctamente",
      standards: [{ id: standard.id, title: "Resuelve" }],
    });
  });

  it("rejects a cuatrimestre, unit or standard that isn't this class's (TASK-2)", async () => {
    const s = await setup();
    const other = await setup();
    await createStandard(db, other.teacher, { classId: other.cls.id, title: "Ajeno", description: null });
    await createUnit(db, other.teacher, { classId: other.cls.id, title: "Ajena", termId: null });
    const [foreignStandard] = await listStandards(db, other.teacher, other.cls.id);
    const [foreignUnit] = await listUnits(db, other.teacher, other.cls.id);

    const notFound = { ok: false, error: "notFound" };
    expect(await createTask(db, s.teacher, task(s, { termId: other.term1 }))).toEqual(notFound);
    expect(await createTask(db, s.teacher, task(s, { unitId: foreignUnit.id }))).toEqual(notFound);
    expect(await createTask(db, s.teacher, task(s, { standardIds: [foreignStandard.id] }))).toEqual(notFound);
    expect(await listTasks(db, s.teacher, s.cls)).toEqual([]);
  });

  it("lists by cuatrimestre, then date with undated last, then order added (TASK-3)", async () => {
    const s = await setup();
    await newTask(s, { title: "Sin fecha" });
    await newTask(s, { title: "2° cuatri", termId: s.term2, dueOn: "2026-08-01" });
    await newTask(s, { title: "Mayo", dueOn: "2026-05-10" });
    await newTask(s, { title: "Abril", dueOn: "2026-04-02" });
    await newTask(s, { title: "Otra sin fecha" });

    expect((await listTasks(db, s.teacher, s.cls)).map((t) => t.title)).toEqual([
      "Abril",
      "Mayo",
      "Sin fecha",
      "Otra sin fecha",
      "2° cuatri",
    ]);
  });

  it("never shows or adds to another teacher's class (OWNER-1)", async () => {
    const s = await setup();
    const id = await newTask(s);
    const intruder = newTeacher();
    expect(await getTask(db, intruder, s.cls, id)).toBeNull();
    expect(await listTasks(db, intruder, s.cls)).toEqual([]);
    expect(await createTask(db, intruder, task(s))).toEqual({ ok: false, error: "notFound" });
  });
});

describe("scoring a task (SCORE)", () => {
  it("saves every student's score, and updates them on a second save (SCORE-1, SCORE-4)", async () => {
    const s = await setup();
    const id = await newTask(s);
    const { Pérez, Álvarez } = s.students;

    await saveScores(db, s.teacher, s.cls, id, {
      save: [
        { studentId: Pérez, status: "graded", value: 7.5, notes: "Bien" },
        { studentId: Álvarez, status: "missing", value: null, notes: null },
      ],
      clear: [],
    });
    await saveScores(db, s.teacher, s.cls, id, {
      save: [{ studentId: Pérez, status: "graded", value: 8, notes: "Corrigió" }],
      clear: [],
    });

    const saved = await listTaskScores(db, s.teacher, id);
    expect(saved).toEqual(
      expect.arrayContaining([
        { studentId: Pérez, status: "graded", value: 8, notes: "Corrigió" },
        { studentId: Álvarez, status: "missing", value: null, notes: null },
      ]),
    );
    const rows = await db.select().from(scores).where(and(eq(scores.taskId, id), eq(scores.studentId, Pérez)));
    expect(rows).toHaveLength(1);
  });

  it("removes a score that was cleared (SCORE-3)", async () => {
    const s = await setup();
    const id = await newTask(s);
    const { Pérez } = s.students;
    await saveScores(db, s.teacher, s.cls, id, {
      save: [{ studentId: Pérez, status: "graded", value: 6, notes: null }],
      clear: [],
    });
    await saveScores(db, s.teacher, s.cls, id, { save: [], clear: [Pérez] });
    expect(await listTaskScores(db, s.teacher, id)).toEqual([]);
  });

  it("only saves for students of the class's course (SCORE-1, OWNER-1)", async () => {
    const s = await setup();
    const other = await setup();
    const id = await newTask(s);
    await saveScores(db, s.teacher, s.cls, id, {
      save: [{ studentId: other.students.Pérez, status: "graded", value: 10, notes: null }],
      clear: [],
    });
    expect(await listTaskScores(db, s.teacher, id)).toEqual([]);
  });

  it("saves nothing on another teacher's task (OWNER-1)", async () => {
    const s = await setup();
    const id = await newTask(s);
    expect(
      await saveScores(db, newTeacher(), s.cls, id, {
        save: [{ studentId: s.students.Pérez, status: "graded", value: 1, notes: null }],
        clear: [],
      }),
    ).toEqual({ ok: false, error: "notFound" });
    expect(await listTaskScores(db, s.teacher, id)).toEqual([]);
  });
});

describe("the gradebook (BOOK)", () => {
  it("shows one cuatrimestre's tasks against the course, with each student's average (BOOK-1, BOOK-2)", async () => {
    const s = await setup();
    const { Pérez, Álvarez } = s.students;
    const tp1 = await newTask(s, { title: "TP 1", dueOn: "2026-04-01" });
    const tp2 = await newTask(s, { title: "TP 2", dueOn: "2026-05-01" });
    await newTask(s, { title: "Del 2°", termId: s.term2 });

    await saveScores(db, s.teacher, s.cls, tp1, {
      save: [
        { studentId: Pérez, status: "graded", value: 6, notes: null },
        { studentId: Álvarez, status: "graded", value: 9, notes: null },
      ],
      clear: [],
    });
    await saveScores(db, s.teacher, s.cls, tp2, {
      save: [
        { studentId: Pérez, status: "graded", value: 9, notes: null },
        { studentId: Álvarez, status: "missing", value: null, notes: null },
      ],
      clear: [],
    });

    const book = await getGradebook(db, s.teacher, s.cls, s.term1);
    expect(book.tasks.map((t) => t.title)).toEqual(["TP 1", "TP 2"]);
    expect(book.rows.map((r) => [r.student.lastName, r.cells.map((c) => c?.value ?? c?.status ?? null), r.suggestion])).toEqual([
      ["Álvarez", [9, "missing"], { average: 9, graded: 1, missing: 1 }],
      ["Pérez", [6, 9], { average: 7.5, graded: 2, missing: 0 }],
    ]);
  });

  it("gives a student who joined late empty cells (BOOK-1)", async () => {
    const s = await setup();
    const tp1 = await newTask(s);
    await saveScores(db, s.teacher, s.cls, tp1, {
      save: [{ studentId: s.students.Pérez, status: "graded", value: 7, notes: null }],
      clear: [],
    });
    await createStudent(db, s.teacher, { firstName: "Luis", lastName: "Nuevo", courseId: s.courseId });

    const book = await getGradebook(db, s.teacher, s.cls, s.term1);
    const nuevo = book.rows.find((r) => r.student.lastName === "Nuevo");
    expect(nuevo?.cells).toEqual([null]);
    expect(nuevo?.suggestion.average).toBeNull();
  });

  it("is empty for another teacher (OWNER-1)", async () => {
    const s = await setup();
    await newTask(s);
    const book = await getGradebook(db, newTeacher(), s.cls, s.term1);
    expect(book.tasks).toEqual([]);
    expect(book.rows).toEqual([]);
  });
});
