import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, newTeacher } from "@/test/db";
import type { TaskInput } from "@/lib/validation";
import { createClass } from "./classes";
import { getClass, listClassStudents, listTerms, type ClassDetail } from "./classDetail";
import { getStudentHistory } from "./history";
import { getHomeCards } from "./home";
import { createStudent } from "./students";
import { createTask, getGradebook, getTask, listTaskScores, listTasks, saveScores, updateTask } from "./tasks";
import { createGroup, deleteGroup, getStudentGroups, listGroups, setStudentGroup, updateGroup } from "./groups";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

type Setup = {
  teacher: string;
  cls: ClassDetail;
  term1: string;
  students: Record<string, string>;
  groups: { lunes: string; miercoles: string };
};

/** Laboratorio with Ana and Bea on Lunes, Carla on Miércoles, and Dora in no group. */
async function setup(): Promise<Setup> {
  const teacher = newTeacher();
  const created = await createClass(db, teacher, {
    name: "Laboratorio",
    year: 4,
    division: "A",
    shift: "morning",
    school: "Escuela 5",
    schoolYear: 2026,
  });
  if (!created.ok) throw new Error("setup failed");
  const cls = (await getClass(db, teacher, created.classId))!;
  for (const firstName of ["Ana", "Bea", "Carla", "Dora"]) {
    await createStudent(db, teacher, { firstName, lastName: firstName, courseId: cls.courseId });
  }
  const students = Object.fromEntries((await listClassStudents(db, teacher, cls)).map((s) => [s.firstName, s.id]));
  const lunes = await createGroup(db, teacher, { classId: cls.id, name: "Lunes", days: "Lunes 8 a 10" });
  const miercoles = await createGroup(db, teacher, { classId: cls.id, name: "Miércoles", days: null });
  if (!lunes.ok || !miercoles.ok) throw new Error("setup failed");
  for (const [name, groupId] of [["Ana", lunes.groupId], ["Bea", lunes.groupId], ["Carla", miercoles.groupId]]) {
    await setStudentGroup(db, teacher, cls, { studentId: students[name], groupId });
  }
  const [term1] = await listTerms(db, teacher, cls);
  return { teacher, cls, term1: term1.id, students, groups: { lunes: lunes.groupId, miercoles: miercoles.groupId } };
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

async function newTask(s: Setup, over: Partial<TaskInput>): Promise<string> {
  const r = await createTask(db, s.teacher, task(s, over));
  if (!r.ok) throw new Error("createTask failed");
  return r.taskId;
}

/** For everyone; only for Lunes; for both groups on different days. */
async function threeTasks(s: Setup) {
  const all = await newTask(s, { title: "Para todos", dueOn: "2026-05-01" });
  const lunesOnly = await newTask(s, { title: "Solo lunes", groups: [{ groupId: s.groups.lunes, dueOn: "2026-05-04" }] });
  const both = await newTask(s, {
    title: "Ambos",
    groups: [
      { groupId: s.groups.lunes, dueOn: "2026-05-11" },
      { groupId: s.groups.miercoles, dueOn: "2026-05-13" },
    ],
  });
  return { all, lunesOnly, both };
}

const graded = (studentId: string, value: number) => ({ studentId, status: "graded" as const, value, notes: null });
const notFound = { ok: false, error: "notFound" };

describe("groups of a class (GROUP-1, GROUP-2)", () => {
  it("lists groups in the order added, with their days and how many students each has", async () => {
    const s = await setup();
    expect(await listGroups(db, s.teacher, s.cls.id)).toMatchObject([
      { id: s.groups.lunes, name: "Lunes", days: "Lunes 8 a 10", students: 2, onlyTasks: 0 },
      { id: s.groups.miercoles, name: "Miércoles", days: null, students: 1, onlyTasks: 0 },
    ]);
    const byStudent = await getStudentGroups(db, s.teacher, s.cls.id);
    expect(byStudent.get(s.students.Ana)).toBe(s.groups.lunes);
    expect(byStudent.get(s.students.Dora)).toBeUndefined();
  });

  it("refuses a second group with the same name, ignoring case, and renames", async () => {
    const s = await setup();
    expect(await createGroup(db, s.teacher, { classId: s.cls.id, name: "lunes", days: null })).toEqual({
      ok: false,
      error: "duplicate",
    });
    expect(
      await updateGroup(db, s.teacher, { classId: s.cls.id, groupId: s.groups.miercoles, name: "LUNES", days: null }),
    ).toEqual({ ok: false, error: "duplicate" });
    expect(
      await updateGroup(db, s.teacher, { classId: s.cls.id, groupId: s.groups.miercoles, name: "Jueves", days: "Jue" }),
    ).toEqual({ ok: true });
    expect((await listGroups(db, s.teacher, s.cls.id)).map((g) => [g.name, g.days])).toEqual([
      ["Lunes", "Lunes 8 a 10"],
      ["Jueves", "Jue"],
    ]);
  });

  it("moves a student to another group or none, only within the course and class", async () => {
    const s = await setup();
    const other = await setup();
    await setStudentGroup(db, s.teacher, s.cls, { studentId: s.students.Ana, groupId: s.groups.miercoles });
    await setStudentGroup(db, s.teacher, s.cls, { studentId: s.students.Bea, groupId: null });
    const byStudent = await getStudentGroups(db, s.teacher, s.cls.id);
    expect(byStudent.get(s.students.Ana)).toBe(s.groups.miercoles);
    expect(byStudent.has(s.students.Bea)).toBe(false);

    expect(
      await setStudentGroup(db, s.teacher, s.cls, { studentId: other.students.Ana, groupId: s.groups.lunes }),
    ).toEqual(notFound);
    expect(
      await setStudentGroup(db, s.teacher, s.cls, { studentId: s.students.Dora, groupId: other.groups.lunes }),
    ).toEqual(notFound);
  });

  it("deletes a group: its students have none, and a task only for it is for everyone (GROUP-1)", async () => {
    const s = await setup();
    const { lunesOnly, both } = await threeTasks(s);
    expect((await listGroups(db, s.teacher, s.cls.id))[0].onlyTasks).toBe(1);

    expect(await deleteGroup(db, s.teacher, { classId: s.cls.id, groupId: s.groups.lunes })).toEqual({ ok: true });
    expect((await getStudentGroups(db, s.teacher, s.cls.id)).has(s.students.Ana)).toBe(false);
    expect((await getTask(db, s.teacher, s.cls, lunesOnly))?.groups).toEqual([]);
    expect((await getTask(db, s.teacher, s.cls, both))?.groups.map((g) => g.name)).toEqual(["Miércoles"]);
  });

  it("shows, adds and changes nothing of another teacher's (OWNER-1)", async () => {
    const s = await setup();
    const intruder = newTeacher();
    expect(await listGroups(db, intruder, s.cls.id)).toEqual([]);
    expect(await createGroup(db, intruder, { classId: s.cls.id, name: "Intrusos", days: null })).toEqual(notFound);
    expect(
      await updateGroup(db, intruder, { classId: s.cls.id, groupId: s.groups.lunes, name: "X", days: null }),
    ).toEqual(notFound);
    expect(await deleteGroup(db, intruder, { classId: s.cls.id, groupId: s.groups.lunes })).toEqual(notFound);
    expect(await listGroups(db, s.teacher, s.cls.id)).toHaveLength(2);
  });
});

describe("tasks for some groups (GROUP-3)", () => {
  it("keeps each group's date, and is dated by the earliest one", async () => {
    const s = await setup();
    const { both } = await threeTasks(s);
    expect(await getTask(db, s.teacher, s.cls, both)).toMatchObject({
      dueOn: "2026-05-11",
      groups: [
        { groupId: s.groups.lunes, name: "Lunes", dueOn: "2026-05-11" },
        { groupId: s.groups.miercoles, name: "Miércoles", dueOn: "2026-05-13" },
      ],
    });
  });

  it("replaces the groups on edit, and back to everyone with none (TASK-6)", async () => {
    const s = await setup();
    const { lunesOnly } = await threeTasks(s);
    const edit = (groups: TaskInput["groups"]) =>
      updateTask(db, s.teacher, { ...task(s, { title: "Solo lunes", groups }), taskId: lunesOnly });
    expect(await edit([{ groupId: s.groups.miercoles, dueOn: "2026-05-06" }])).toEqual({ ok: true });
    expect((await getTask(db, s.teacher, s.cls, lunesOnly))?.groups.map((g) => g.name)).toEqual(["Miércoles"]);
    expect(await edit([])).toEqual({ ok: true });
    expect((await getTask(db, s.teacher, s.cls, lunesOnly))?.groups).toEqual([]);
  });

  it("refuses another class's group (GROUP-3, OWNER-1)", async () => {
    const s = await setup();
    const other = await setup();
    expect(await createTask(db, s.teacher, task(s, { groups: [{ groupId: other.groups.lunes, dueOn: null }] }))).toEqual(
      notFound,
    );
  });
});

describe("who is scored and counted (GROUP-4, GROUP-5)", () => {
  it("counts only assessed students on task cards", async () => {
    const s = await setup();
    await threeTasks(s);
    expect((await listTasks(db, s.teacher, s.cls)).map((t) => [t.title, t.assessed])).toEqual([
      ["Para todos", 4],
      ["Solo lunes", 2],
      ["Ambos", 3],
    ]);
  });

  it("saves scores only for students assessed on the task (GROUP-4)", async () => {
    const s = await setup();
    const { lunesOnly } = await threeTasks(s);
    await saveScores(db, s.teacher, s.cls, lunesOnly, {
      save: [graded(s.students.Ana, 8), graded(s.students.Carla, 9), graded(s.students.Dora, 9)],
      clear: [],
    });
    expect((await listTaskScores(db, s.teacher, lunesOnly)).map((r) => r.studentId)).toEqual([s.students.Ana]);
  });

  it("shows tasks that don't apply in the gradebook, out of the average, and filters by group", async () => {
    const s = await setup();
    const { all, lunesOnly } = await threeTasks(s);
    await saveScores(db, s.teacher, s.cls, all, { save: [graded(s.students.Carla, 6)], clear: [] });
    await saveScores(db, s.teacher, s.cls, lunesOnly, { save: [graded(s.students.Ana, 10)], clear: [] });

    const book = await getGradebook(db, s.teacher, s.cls, s.term1);
    const carla = book.rows.find((r) => r.student.id === s.students.Carla)!;
    expect(carla.cells).toEqual([{ status: "graded", value: 6 }, "notAssessed", null]);
    expect(carla.suggestion.average).toBe(6);

    const lunes = await getGradebook(db, s.teacher, s.cls, s.term1, s.groups.lunes);
    expect(lunes.rows.map((r) => r.student.firstName)).toEqual(["Ana", "Bea"]);
    expect(lunes.tasks.map((t) => t.title)).toEqual(["Para todos", "Solo lunes", "Ambos"]);
    const miercoles = await getGradebook(db, s.teacher, s.cls, s.term1, s.groups.miercoles);
    expect(miercoles.tasks.map((t) => t.title)).toEqual(["Para todos", "Ambos"]);
  });

  it("counts Home's progress and next task over assessed students only (HOME-2, HOME-3)", async () => {
    const s = await setup();
    const { all, lunesOnly } = await threeTasks(s);
    const everyone = Object.values(s.students).map((id) => graded(id, 8));
    await saveScores(db, s.teacher, s.cls, all, { save: everyone, clear: [] });
    await saveScores(db, s.teacher, s.cls, lunesOnly, { save: everyone, clear: [] });

    const [card] = (await getHomeCards(db, s.teacher)).cards;
    // 4 + 2 + 3 assessed; 4 + 2 scored.
    expect(card).toMatchObject({ tasks: 3, scored: 6, progress: 67, next: { title: "Ambos" } });
  });

  it("lists in a student's history only the tasks they are assessed on (HISTORY-3)", async () => {
    const s = await setup();
    await threeTasks(s);
    const titles = async (name: string) =>
      (await getStudentHistory(db, s.teacher, s.students[name]))!.courses[0].classes[0].terms[0].tasks.map(
        (t) => t.title,
      );
    expect(await titles("Carla")).toEqual(["Para todos", "Ambos"]);
    expect(await titles("Dora")).toEqual(["Para todos"]);
    expect(await titles("Ana")).toEqual(["Para todos", "Solo lunes", "Ambos"]);
  });
});
