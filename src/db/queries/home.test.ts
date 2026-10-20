import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { courseStudents } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import { createClass, listCourses, listSchools } from "./classes";
import { getClass, listClassStudents, listTerms } from "./classDetail";
import { createStudent } from "./students";
import { createTask, saveScores } from "./tasks";
import { getHomeCards, getTodayClasses } from "./home";
import { saveAttendance, saveNoClass } from "./attendance";
import { addDayOff, getCalendar, saveCalendar } from "./calendar";
import { createGroup } from "./groups";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const cls = (over: Partial<ClassInput> = {}): ClassInput => ({
  school: "Escuela 5",
  name: "Matemática",
  year: 4,
  division: "A",
  shift: "morning",
  schoolYear: 2026,
  ...over,
});

async function addClass(teacher: string, input: ClassInput) {
  const r = await createClass(db, teacher, input);
  if (!r.ok) throw new Error("createClass failed");
  return (await getClass(db, teacher, r.classId))!;
}

async function addTask(teacher: string, classId: string, termId: string, title: string, dueOn: string | null) {
  const r = await createTask(db, teacher, {
    classId, title, termId, unitId: null, dueOn, description: null, criteria: null, standardIds: [],
  });
  if (!r.ok) throw new Error("createTask failed");
  return r.taskId;
}

describe("home cards (HOME)", () => {
  it("shows each class with its school, students, progress and next pending task (HOME-1..3)", async () => {
    const teacher = newTeacher();
    const mate = await addClass(teacher, cls());
    await addClass(teacher, cls({ name: "Física", school: "Técnica 2" }));
    const [course] = await listCourses(db, teacher);
    for (const [firstName, lastName] of [["Ana", "Pérez"], ["Zoe", "Álvarez"]]) {
      await createStudent(db, teacher, { firstName, lastName, courseId: course.id });
    }
    const [ana, zoe] = (await listClassStudents(db, teacher, mate)).sort((a, b) => a.firstName.localeCompare(b.firstName));
    const [t1] = await listTerms(db, teacher, mate);

    const tp1 = await addTask(teacher, mate.id, t1.id, "TP 1", "2026-04-10");
    const tp2 = await addTask(teacher, mate.id, t1.id, "TP 2", "2026-05-08");
    await addTask(teacher, mate.id, t1.id, "Sin fecha", null);
    await saveScores(db, teacher, mate, tp1, {
      save: [
        { studentId: ana.id, status: "graded", value: 8, notes: null },
        { studentId: zoe.id, status: "missing", value: null, notes: null },
      ],
      clear: [],
    });
    await saveScores(db, teacher, mate, tp2, {
      save: [{ studentId: ana.id, status: "graded", value: 7, notes: null }],
      clear: [],
    });

    const home = await getHomeCards(db, teacher);
    expect(home.stats).toEqual({ classes: 2, students: 2, pending: 3, owed: 0 });
    expect(home.cards.map((c) => [c.name, c.school, c.students])).toEqual([
      ["Matemática", "Escuela 5", 2],
      ["Física", "Técnica 2", 0],
    ]);
    // 3 of 3 tasks × 2 students saved (a "not handed in" counts as saved).
    expect(home.cards[0]).toMatchObject({ tasks: 3, scored: 3, progress: 50 });
    // TP 1 is complete; TP 2 still lacks Zoe; the undated task comes after both.
    expect(home.cards[0].next).toEqual({ title: "TP 2", dueOn: "2026-05-08" });
    expect(home.cards[1]).toMatchObject({ tasks: 0, progress: 0, next: null });
  });

  it("leaves out students who left the course (HOME-1, HOME-2)", async () => {
    const teacher = newTeacher();
    const mate = await addClass(teacher, cls());
    const [course] = await listCourses(db, teacher);
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: course.id });
    await createStudent(db, teacher, { firstName: "Luis", lastName: "Gómez", courseId: course.id });
    const [t1] = await listTerms(db, teacher, mate);
    const tp1 = await addTask(teacher, mate.id, t1.id, "TP 1", "2026-04-10");
    const roster = await listClassStudents(db, teacher, mate);
    const ana = roster.find((s) => s.firstName === "Ana")!;
    const luis = roster.find((s) => s.firstName === "Luis")!;
    await saveScores(db, teacher, mate, tp1, {
      save: [{ studentId: ana.id, status: "graded", value: 9, notes: null }],
      clear: [],
    });
    await db.update(courseStudents).set({ status: "withdrawn" }).where(eq(courseStudents.studentId, luis.id));

    const [card] = (await getHomeCards(db, teacher)).cards;
    expect(card).toMatchObject({ students: 1, scored: 1, progress: 100, next: null });
  });

  it("shows nothing of another teacher's (OWNER-1)", async () => {
    const teacher = newTeacher();
    await addClass(teacher, cls());
    expect(await getHomeCards(db, newTeacher())).toEqual({ stats: { classes: 0, students: 0, pending: 0, owed: 0 }, cards: [] });
  });
});

describe("today's classes (HOME-4)", () => {
  // Monday 19 October 2026; the school year runs from 2 March to 11 December.
  const MONDAY = "2026-10-19";

  async function setup() {
    const teacher = newTeacher();
    const lunes = await createClass(db, teacher, cls({ name: "Matemática", weekdays: [1, 3] }));
    const martes = await createClass(db, teacher, cls({ name: "Física", weekdays: [2] }));
    if (!lunes.ok || !martes.ok) throw new Error("setup failed");
    const [school] = await listSchools(db, teacher);
    await saveCalendar(db, teacher, {
      schoolId: school.id,
      schoolYear: 2026,
      startsOn: "2026-03-02",
      term2StartsOn: "2026-07-27",
      endsOn: "2026-12-11",
    });
    const calendarId = (await getCalendar(db, teacher, school.id, "2026"))!.calendar!.id;
    return { teacher, lunes: lunes.classId, martes: martes.classId, calendarId };
  }

  it("lists the classes that meet on today's weekday, still to take", async () => {
    const s = await setup();
    const today = await getTodayClasses(db, s.teacher, MONDAY);
    expect(today.map((c) => [c.name, c.course, c.state])).toEqual([["Matemática", "4° A", "pending"]]);
    expect(today[0].classId).toBe(s.lunes);
    expect((await getTodayClasses(db, s.teacher, "2026-10-20")).map((c) => c.name)).toEqual(["Física"]);
  });

  it("counts a group's own days as the class's (CAL-4)", async () => {
    const s = await setup();
    await createGroup(db, s.teacher, { classId: s.martes, name: "Viernes", days: null, weekdays: [5] });
    expect((await getTodayClasses(db, s.teacher, "2026-10-23")).map((c) => c.name)).toEqual(["Física"]);
  });

  it("lists nothing on a day without class, or outside the school year", async () => {
    const s = await setup();
    await addDayOff(db, s.teacher, {
      calendarId: s.calendarId,
      kind: "jornada",
      name: "Jornada institucional",
      startsOn: MONDAY,
      endsOn: MONDAY,
    });
    expect(await getTodayClasses(db, s.teacher, MONDAY)).toEqual([]);
    expect(await getTodayClasses(db, s.teacher, "2026-12-14")).toEqual([]);
    expect(await getTodayClasses(db, s.teacher, "2026-02-23")).toEqual([]);
  });

  it("lists nothing for a class whose school has no calendar", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls({ weekdays: [1] }));
    expect(await getTodayClasses(db, teacher, MONDAY)).toEqual([]);
  });

  it("says when today is taken or not held, even on a day off", async () => {
    const s = await setup();
    const mate = (await getClass(db, s.teacher, s.lunes))!;
    await saveAttendance(db, s.teacher, mate, MONDAY, []);
    expect((await getTodayClasses(db, s.teacher, MONDAY))[0].state).toBe("taken");
    await saveNoClass(db, s.teacher, mate, { date: MONDAY, reason: "strike", note: null });
    expect((await getTodayClasses(db, s.teacher, MONDAY))[0].state).toBe("notHeld");
    // Recorded anyway on a day off: still listed, so it can be opened again.
    await addDayOff(db, s.teacher, { calendarId: s.calendarId, kind: "other", name: "Acto", startsOn: MONDAY, endsOn: MONDAY });
    expect((await getTodayClasses(db, s.teacher, MONDAY)).map((c) => c.state)).toEqual(["notHeld"]);
  });

  it("only lists the teacher's own classes (OWNER-1)", async () => {
    await setup();
    expect(await getTodayClasses(db, newTeacher(), MONDAY)).toEqual([]);
  });
});
