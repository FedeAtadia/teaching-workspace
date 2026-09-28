import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { courseStudents } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import { createClass, listCourses } from "./classes";
import { getClass, listTerms } from "./classDetail";
import { createStudent, listStudents } from "./students";
import { createTask, saveScores } from "./tasks";
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
  schoolYear: 2026,
  ...over,
});

async function addClass(teacher: string, input: ClassInput) {
  const created = await createClass(db, teacher, input);
  if (!created.ok) throw new Error("createClass failed");
  return (await getClass(db, teacher, created.classId))!;
}

async function addTask(teacher: string, classId: string, termId: string, title: string, dueOn: string | null = null) {
  const r = await createTask(db, teacher, {
    classId,
    title,
    termId,
    unitId: null,
    dueOn,
    description: null,
    criteria: null,
    standardIds: [],
  });
  if (!r.ok) throw new Error("createTask failed");
  return r.taskId;
}

describe("a student's history (HISTORY)", () => {
  it("lists every course the student was in, newest first, marking the ones left (HISTORY-1)", async () => {
    const teacher = newTeacher();
    await addClass(teacher, cls("Matemática", { year: 3, schoolYear: 2025 }));
    await addClass(teacher, cls("Matemática", { year: 4, schoolYear: 2026 }));
    const courses = await listCourses(db, teacher);
    const c2026 = courses.find((c) => c.schoolYear === "2026")!;
    const c2025 = courses.find((c) => c.schoolYear === "2025")!;

    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: c2025.id });
    const [ana] = await listStudents(db, teacher);
    // Moving up a year: the 2025 course is finished, the 2026 one current.
    await db
      .update(courseStudents)
      .set({ status: "withdrawn" })
      .where(and(eq(courseStudents.studentId, ana.id), eq(courseStudents.courseId, c2025.id)));
    await db.insert(courseStudents).values({ teacherId: teacher, courseId: c2026.id, studentId: ana.id });

    const history = await getStudentHistory(db, teacher, ana.id);
    expect(history?.student).toMatchObject({ firstName: "Ana", lastName: "Pérez" });
    expect(history?.courses.map((c) => [c.schoolYear, c.year, c.status])).toEqual([
      ["2026", 4, "active"],
      ["2025", 3, "withdrawn"],
    ]);
  });

  it("shows every class of the course in subject order, including ones added later (HISTORY-2)", async () => {
    const teacher = newTeacher();
    await addClass(teacher, cls("Matemática"));
    const [course] = await listCourses(db, teacher);
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: course.id });
    await addClass(teacher, cls("Física"));
    const [ana] = await listStudents(db, teacher);

    const history = await getStudentHistory(db, teacher, ana.id);
    expect(history?.courses[0].classes.map((c) => c.name)).toEqual(["Física", "Matemática"]);
  });

  it("shows each cuatrimestre's tasks with the student's scores, notes and average (HISTORY-3)", async () => {
    const teacher = newTeacher();
    const mate = await addClass(teacher, cls("Matemática"));
    const [course] = await listCourses(db, teacher);
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: course.id });
    const [ana] = await listStudents(db, teacher);
    const [t1, t2] = await listTerms(db, teacher, mate);

    const tp1 = await addTask(teacher, mate.id, t1.id, "TP 1", "2026-04-01");
    const tp2 = await addTask(teacher, mate.id, t1.id, "TP 2", "2026-05-01");
    await addTask(teacher, mate.id, t1.id, "TP 3", "2026-06-01");
    const final = await addTask(teacher, mate.id, t2.id, "Final");
    await saveScores(db, teacher, mate, tp1, {
      save: [{ studentId: ana.id, status: "graded", value: 6, notes: "Revisar gráficos" }],
      clear: [],
    });
    await saveScores(db, teacher, mate, tp2, {
      save: [{ studentId: ana.id, status: "missing", value: null, notes: null }],
      clear: [],
    });
    await saveScores(db, teacher, mate, final, {
      save: [{ studentId: ana.id, status: "graded", value: 9, notes: null }],
      clear: [],
    });

    const [mateHistory] = (await getStudentHistory(db, teacher, ana.id))!.courses[0].classes;
    expect(mateHistory.passMark).toBe(7);
    expect(
      mateHistory.terms.map((term) => ({
        position: term.position,
        tasks: term.tasks.map((t) => [t.title, t.score?.value ?? t.score?.status ?? null, t.score?.notes ?? null]),
        suggestion: term.suggestion,
      })),
    ).toEqual([
      {
        position: 1,
        tasks: [
          ["TP 1", 6, "Revisar gráficos"],
          ["TP 2", "missing", null],
          ["TP 3", null, null],
        ],
        suggestion: { average: 6, graded: 1, missing: 1 },
      },
      {
        position: 2,
        tasks: [["Final", 9, null]],
        suggestion: { average: 9, graded: 1, missing: 0 },
      },
    ]);
  });

  it("finds nothing for another teacher's student, a missing one or a malformed id (OWNER-1)", async () => {
    const teacher = newTeacher();
    await addClass(teacher, cls("Matemática"));
    const [course] = await listCourses(db, teacher);
    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: course.id });
    const [ana] = await listStudents(db, teacher);

    expect(await getStudentHistory(db, newTeacher(), ana.id)).toBeNull();
    expect(await getStudentHistory(db, teacher, randomUUID())).toBeNull();
    expect(await getStudentHistory(db, teacher, "nope")).toBeNull();
  });
});
