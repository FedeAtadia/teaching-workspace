import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import { createClass, listSchools, setClassArchived, setSchoolPassMark } from "./classes";
import { getClass, listTerms } from "./classDetail";
import { getFollowUp, getFollowUpSettings, setFollowUpSettings } from "./followUp";
import { setMinAttendance } from "./settings";
import { createStudent, listStudents } from "./students";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const MAY = "2026-05-20"; // in the 1° cuatrimestre
const SEPTEMBER = "2026-09-10"; // in the 2°

/** A class with a calendar and three students: Ana (fine), Luis and Zoe. */
async function seed(teacherId = newTeacher(), name = "Matemática") {
  const created = await createClass(db, teacherId, {
    name,
    year: 5,
    division: "A",
    shift: "morning",
    school: "EPET 30",
    schoolYear: 2026,
  });
  if (!created.ok) throw new Error("createClass failed");
  const cls = (await getClass(db, teacherId, created.classId))!;
  if ((await listStudents(db, teacherId)).length === 0) {
    for (const [firstName, lastName] of [["Ana", "Pérez"], ["Luis", "Gómez"], ["Zoe", "Álvarez"]]) {
      await createStudent(db, teacherId, { firstName, lastName, courseId: cls.courseId });
    }
    await db.insert(schema.schoolCalendars).values({
      teacherId,
      schoolId: cls.schoolId,
      academicYearId: cls.academicYearId,
      startsOn: "2026-03-02",
      term2StartsOn: "2026-08-03",
      endsOn: "2026-12-11",
    });
  }
  const ids = Object.fromEntries((await listStudents(db, teacherId)).map((s) => [s.firstName, s.id]));
  const [term1, term2] = await listTerms(db, teacherId, cls);
  let n = 0;
  /** A task of a cuatrimestre with each student's score: a number, "missing", or nothing. */
  const task = async (termId: string, marks: Record<string, number | "missing">) => {
    const [t] = await db
      .insert(schema.tasks)
      .values({ teacherId, classId: cls.id, termId, title: `TP ${++n}` })
      .returning();
    await db.insert(schema.scores).values(
      Object.entries(marks).map(([who, mark]) => ({
        teacherId,
        taskId: t.id,
        studentId: ids[who],
        status: mark === "missing" ? ("missing" as const) : ("graded" as const),
        value: mark === "missing" ? null : mark,
      })),
    );
  };
  /** A day of class with each student's mark. */
  const day = async (date: string, marks: Record<string, "present" | "absent" | "late" | "excused">) => {
    const [session] = await db.insert(schema.classSessions).values({ teacherId, classId: cls.id, date }).returning();
    await db.insert(schema.attendance).values(
      Object.entries(marks).map(([who, status]) => ({ teacherId, sessionId: session.id, studentId: ids[who], status })),
    );
  };
  return { teacherId, cls, ids, term1, term2, task, day };
}

const summary = (f: Awaited<ReturnType<typeof getFollowUp>>) =>
  f.students.map((s) => [s.firstName, s.classes.map((c) => [c.name, c.term, c.reasons.map((r) => r.kind)])]);

describe("students to follow up (FOLLOW)", () => {
  it("points out who is below the pass mark, short on attendance or not handing in, in the cuatrimestre under way (FOLLOW-1, FOLLOW-2)", async () => {
    const s = await seed();
    await s.task(s.term1.id, { Ana: 8, Luis: 5, Zoe: "missing" });
    await s.task(s.term1.id, { Ana: 9, Luis: 6, Zoe: "missing" });
    await s.task(s.term1.id, { Ana: 7, Zoe: "missing" });
    for (const date of ["2026-03-10", "2026-03-17", "2026-03-24", "2026-03-31"]) {
      await s.day(date, { Ana: "present", Luis: date === "2026-03-10" ? "present" : "absent", Zoe: "present" });
    }

    const followUp = await getFollowUp(db, s.teacherId, MAY);
    expect(followUp.enabled).toBe(true);
    // STUDENT-3 order: Álvarez, Gómez. Ana isn't there.
    expect(summary(followUp)).toEqual([
      ["Zoe", [["Matemática", 1, ["missing"]]]],
      ["Luis", [["Matemática", 1, ["attendance", "average"]]]],
    ]);
    const luis = followUp.students[1].classes[0].reasons;
    expect(luis).toEqual([
      { kind: "attendance", rate: 25, minimum: 75 },
      { kind: "average", average: 5.5, passMark: 7 },
    ]);
    expect(followUp.students[0].classes[0].reasons).toEqual([{ kind: "missing", count: 3 }]);
  });

  it("starts afresh in the 2° cuatrimestre, and says nothing outside the school year (FOLLOW-2)", async () => {
    const s = await seed();
    await s.task(s.term1.id, { Luis: 4 });
    expect(summary(await getFollowUp(db, s.teacherId, MAY))).toHaveLength(1);
    expect(summary(await getFollowUp(db, s.teacherId, SEPTEMBER))).toEqual([]);
    expect(summary(await getFollowUp(db, s.teacherId, "2026-12-20"))).toEqual([]);

    await s.task(s.term2.id, { Ana: 3 });
    await s.day("2026-09-01", { Ana: "absent" });
    expect(summary(await getFollowUp(db, s.teacherId, SEPTEMBER))).toEqual([
      ["Ana", [["Matemática", 2, ["attendance", "average"]]]],
    ]);
  });

  it("lists a student once, with each class that has a reason (FOLLOW-1)", async () => {
    const s = await seed();
    const fisica = await seed(s.teacherId, "Física");
    await s.task(s.term1.id, { Luis: 4 });
    await fisica.task(fisica.term1.id, { Luis: 5, Ana: 9 });
    expect(summary(await getFollowUp(db, s.teacherId, MAY))).toEqual([
      ["Luis", [["Física", 1, ["average"]], ["Matemática", 1, ["average"]]]],
    ]);
  });

  it("uses the school's pass mark and the teacher's limits (FOLLOW-1, FOLLOW-4, GRADE-5)", async () => {
    const s = await seed();
    await s.task(s.term1.id, { Luis: 6, Zoe: "missing" });
    await s.day("2026-03-10", { Ana: "absent" });
    const who = async () => (await getFollowUp(db, s.teacherId, MAY)).students.map((x) => x.firstName);
    expect(await who()).toEqual(["Luis", "Ana"]);

    const [school] = await listSchools(db, s.teacherId);
    await setSchoolPassMark(db, s.teacherId, { schoolId: school.id, passMark: 6 });
    expect(await who()).toEqual(["Ana"]);

    await setMinAttendance(db, s.teacherId, 0);
    expect(await who()).toEqual([]);

    await setFollowUpSettings(db, s.teacherId, { enabled: true, missing: 1 });
    expect(await who()).toEqual(["Zoe"]);
  });

  it("can be turned off, and leaves out archived classes and students who left (FOLLOW-3, FOLLOW-4)", async () => {
    const s = await seed();
    await s.task(s.term1.id, { Luis: 4, Zoe: 3 });
    expect(await getFollowUpSettings(db, s.teacherId)).toEqual({ enabled: true, missing: 3 });

    // Zoe left the course: she is no longer pointed out.
    await db
      .update(schema.courseStudents)
      .set({ status: "withdrawn" })
      .where(eq(schema.courseStudents.studentId, s.ids.Zoe));
    expect((await getFollowUp(db, s.teacherId, MAY)).students.map((x) => x.firstName)).toEqual(["Luis"]);
    expect((await getFollowUp(db, newTeacher(), MAY)).students).toEqual([]); // OWNER-1

    await setFollowUpSettings(db, s.teacherId, { enabled: false, missing: 3 });
    expect(await getFollowUp(db, s.teacherId, MAY)).toEqual({ enabled: false, students: [] });
    expect(await getFollowUpSettings(db, s.teacherId)).toEqual({ enabled: false, missing: 3 });

    await setFollowUpSettings(db, s.teacherId, { enabled: true, missing: 3 });
    await setClassArchived(db, s.teacherId, { classId: s.cls.id, archived: true }, MAY);
    expect((await getFollowUp(db, s.teacherId, MAY)).students).toEqual([]);
  });
});
