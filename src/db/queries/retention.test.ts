import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { exams, termGrades } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import { createClass, listCourses } from "./classes";
import { getClass, listTerms } from "./classDetail";
import {
  dismissDeletedNotice,
  getRetentionMonths,
  listGraduateDeletions,
  runRetention,
  setRetentionMonths,
} from "./retention";
import { createStudent, listStudents } from "./students";
import { setOutcome } from "./yearEnd";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

/** A 6° course with a class and these students; each marked as graduated on `graduatedOn`. */
async function sixthYear(names: string[], graduatedOn = "2026-12-15") {
  const teacher = newTeacher();
  const created = await createClass(db, teacher, {
    name: "Matemática",
    year: 6,
    division: "A",
    shift: "morning",
    school: "EPET 30",
    schoolYear: 2026,
  });
  if (!created.ok) throw new Error("createClass failed");
  const cls = (await getClass(db, teacher, created.classId))!;
  const [course] = await listCourses(db, teacher);
  const ids: Record<string, string> = {};
  for (const firstName of names) {
    await createStudent(db, teacher, { firstName, lastName: "Pérez", courseId: course.id });
  }
  for (const s of await listStudents(db, teacher)) {
    ids[s.firstName] = s.id;
    await setOutcome(db, teacher, { classId: cls.id, studentId: s.id, outcome: "graduated" }, graduatedOn);
  }
  const [, term2] = await listTerms(db, teacher, cls);
  /** Makes the student owe the class: a failing final grade. */
  const fail = (studentId: string) =>
    db.insert(termGrades).values({ teacherId: teacher, classId: cls.id, studentId, termId: term2.id, value: 4 });
  return { teacher, cls, ids, fail };
}
const names = async (teacher: string) => (await listStudents(db, teacher)).map((s) => s.firstName);

describe("keeping graduates for a while (KEEP)", () => {
  it("keeps the day an outcome was set, and forgets it when cleared (KEEP-1)", async () => {
    const { teacher, cls, ids } = await sixthYear(["Ana"]);
    const day = async () => (await listStudents(db, teacher))[0].courses[0].outcomeOn;
    expect(await day()).toBe("2026-12-15");

    // Saving the same outcome later doesn't restart the count.
    await setOutcome(db, teacher, { classId: cls.id, studentId: ids.Ana, outcome: "graduated" }, "2027-03-01");
    expect(await day()).toBe("2026-12-15");
    await setOutcome(db, teacher, { classId: cls.id, studentId: ids.Ana, outcome: null }, "2027-03-01");
    expect(await day()).toBeNull();
  });

  it("says when each graduate who owes nothing will be deleted, a year on by default (KEEP-1)", async () => {
    const { teacher, ids, fail } = await sixthYear(["Ana", "Luis"]);
    await fail(ids.Luis);
    expect(await listGraduateDeletions(db, teacher)).toEqual([
      { studentId: ids.Ana, firstName: "Ana", lastName: "Pérez", deleteOn: "2027-12-15" },
    ]);
  });

  it("uses the period the teacher chose (KEEP-2)", async () => {
    const { teacher } = await sixthYear(["Ana"]);
    expect(await getRetentionMonths(db, teacher)).toBe(12);
    await setRetentionMonths(db, teacher, 24);
    expect(await getRetentionMonths(db, teacher)).toBe(24);
    expect((await listGraduateDeletions(db, teacher))[0].deleteOn).toBe("2028-12-15");
  });

  it("does nothing and says nothing while the day is far (KEEP-1)", async () => {
    const { teacher } = await sixthYear(["Ana"]);
    expect(await runRetention(db, teacher, "2027-06-01")).toEqual({ deleted: null, soon: null, attachmentPaths: [] });
    expect(await names(teacher)).toEqual(["Ana"]);
  });

  it("warns within 30 days of the first deletion (KEEP-3)", async () => {
    const { teacher } = await sixthYear(["Ana", "Luis"]);
    expect(await runRetention(db, teacher, "2027-11-14")).toMatchObject({ deleted: null, soon: null });
    expect(await runRetention(db, teacher, "2027-11-15")).toMatchObject({
      deleted: null,
      soon: { count: 2, firstOn: "2027-12-15" },
    });
    expect(await names(teacher)).toEqual(["Ana", "Luis"]);
  });

  it("deletes them on the day, keeps the one who owes a class, and tells the teacher until dismissed (KEEP-1, KEEP-4)", async () => {
    const { teacher, ids, fail } = await sixthYear(["Ana", "Luis", "Zoe"]);
    await fail(ids.Zoe);
    const other = await sixthYear(["Eva"]);

    expect(await runRetention(db, teacher, "2027-12-14")).toMatchObject({ deleted: null, soon: { count: 2 } });
    expect(await runRetention(db, teacher, "2027-12-15")).toMatchObject({
      deleted: { count: 2, on: "2027-12-15" },
      soon: null,
    });
    expect(await names(teacher)).toEqual(["Zoe"]);
    // Another teacher's graduates are theirs to keep (OWNER-1).
    expect(await names(other.teacher)).toEqual(["Eva"]);

    // The notice stays on later visits, until the teacher dismisses it.
    expect(await runRetention(db, teacher, "2027-12-20")).toMatchObject({ deleted: { count: 2, on: "2027-12-15" } });
    await dismissDeletedNotice(db, teacher);
    expect(await runRetention(db, teacher, "2027-12-21")).toMatchObject({ deleted: null, soon: null });
  });

  it("counts from the exam that cleared the last owed class, when it came later (KEEP-1)", async () => {
    const { teacher, cls, ids, fail } = await sixthYear(["Ana"]);
    await fail(ids.Ana);
    // Two years on they still owe it: nothing happens.
    expect(await runRetention(db, teacher, "2028-12-20")).toMatchObject({ deleted: null, soon: null });
    await db.insert(exams).values({ teacherId: teacher, classId: cls.id, studentId: ids.Ana, takenOn: "2029-03-02", value: 7 });

    expect((await listGraduateDeletions(db, teacher))[0].deleteOn).toBe("2030-03-02");
    await runRetention(db, teacher, "2029-03-03");
    expect(await names(teacher)).toEqual(["Ana"]);
  });
});
