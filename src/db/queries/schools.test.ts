import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { academicYears, courseStudents, courses, schools, students } from "@/db/schema";
import { createTestDb, migrateRest, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import { createClass, listClasses, listCourses, listSchools, renameSchool, setSchoolPassMark } from "./classes";
import { getClass } from "./classDetail";
import { getStudentHistory } from "./history";
import { setRules } from "./settings";
import { saveTermGrades } from "./termGrades";
import { getClosingSheet, listOwed } from "./yearEnd";
import { listTerms } from "./classDetail";
import { createStudent, listStudents } from "./students";

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

describe("schools (SCHOOL)", () => {
  it("creates the school with the first class and picks it again by name (SCHOOL-1)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls());
    await createClass(db, teacher, cls({ name: "Física" }));
    expect((await listSchools(db, teacher)).map((s) => s.name)).toEqual(["Escuela 5"]);
    expect((await listClasses(db, teacher)).map((c) => c.school)).toEqual(["Escuela 5", "Escuela 5"]);
  });

  it("matches a school's name whatever its case (SCHOOL-3)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls({ school: "Escuela 5" }));
    await createClass(db, teacher, cls({ school: "ESCUELA 5", name: "Física" }));
    expect(await listSchools(db, teacher)).toHaveLength(1);
    expect(await listCourses(db, teacher)).toHaveLength(1);
  });

  it("keeps the same 4° A at two schools as two courses, with their own students (SCHOOL-2)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls({ school: "Escuela 5" }));
    await createClass(db, teacher, cls({ school: "Técnica 2" }));
    const list = await listCourses(db, teacher);
    expect(list.map((c) => c.school)).toEqual(["Escuela 5", "Técnica 2"]);

    await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: list[0].id });
    const classes = await listClasses(db, teacher);
    expect(classes.map((c) => [c.school, c.students])).toEqual([
      ["Escuela 5", 1],
      ["Técnica 2", 0],
    ]);
    expect((await listStudents(db, teacher))[0].courses[0].school).toBe("Escuela 5");
  });

  it("renames a school, refusing a name another school already has (SCHOOL-3)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls({ school: "Mi escuela" }));
    await createClass(db, teacher, cls({ school: "Técnica 2" }));
    const [mine] = (await listSchools(db, teacher)).filter((s) => s.name === "Mi escuela");

    expect(await renameSchool(db, teacher, { schoolId: mine.id, name: "técnica 2" })).toEqual({
      ok: false,
      error: "duplicate",
    });
    expect(await renameSchool(db, teacher, { schoolId: mine.id, name: "Normal 1" })).toEqual({ ok: true });
    expect((await listSchools(db, teacher)).map((s) => s.name)).toEqual(["Normal 1", "Técnica 2"]);
    // Changing only the case of its own name is not a clash with itself.
    expect(await renameSchool(db, teacher, { schoolId: mine.id, name: "NORMAL 1" })).toEqual({ ok: true });
  });

  it("never shows or renames another teacher's school (OWNER-1)", async () => {
    const a = newTeacher();
    await createClass(db, a, cls());
    const [school] = await listSchools(db, a);
    const b = newTeacher();
    expect(await listSchools(db, b)).toEqual([]);
    expect(await renameSchool(db, b, { schoolId: school.id, name: "Mía" })).toEqual({ ok: false, error: "notFound" });
    expect((await listSchools(db, a))[0].name).toBe("Escuela 5");
  });
});

describe("courses from before schools (SCHOOL-4)", () => {
  it("moves them under one 'Mi escuela' per teacher, students and all", async () => {
    // A database as it was at the last release, with two teachers' courses.
    const old = await createTestDb({ upTo: "0004_task-attachments" });
    const [a, b] = [newTeacher(), newTeacher()];
    const ids: Record<string, string> = {};
    for (const [teacher, key] of [[a, "a1"], [a, "a2"], [b, "b1"]] as const) {
      const [year] = await old
        .insert(academicYears)
        .values({ teacherId: teacher, name: key })
        .returning({ id: academicYears.id });
      // Raw SQL: the schema in code already requires school_id; the old table doesn't have it.
      const result = await old.execute(sql`
        insert into courses (teacher_id, academic_year_id, year, division, shift)
        values (${teacher}, ${year.id}, 4, 'A', 'morning') returning id`);
      ids[key] = (result as unknown as { rows: { id: string }[] }).rows[0].id;
    }
    const [student] = await old
      .insert(students)
      .values({ teacherId: a, firstName: "Ana", lastName: "Pérez" })
      .returning({ id: students.id });
    // Raw SQL too: the schema in code has later columns (outcome) the old table doesn't.
    await old.execute(sql`
      insert into course_students (teacher_id, course_id, student_id) values (${a}, ${ids.a1}, ${student.id})`);

    await migrateRest(old);

    const rows = await old.select({ id: courses.id, teacherId: courses.teacherId, schoolId: courses.schoolId }).from(courses);
    const schoolsOf = (t: string) => new Set(rows.filter((r) => r.teacherId === t).map((r) => r.schoolId));
    expect(schoolsOf(a).size).toBe(1);
    expect(schoolsOf(b).size).toBe(1);
    const named = await old.select().from(schools).where(eq(schools.teacherId, a));
    expect(named.map((s) => s.name)).toEqual(["Mi escuela"]);
    expect(await old.select().from(courseStudents)).toHaveLength(1);
  }, 30_000);
});

describe("a school's own pass mark (GRADE-5)", () => {
  /** One teacher, a class at each of two schools, the same student with a final 6 in both. */
  async function twoSchools() {
    const teacher = newTeacher();
    const input = { name: "Matemática", year: 4, division: "A", shift: "morning" as const, schoolYear: 2026 };
    const ids: Record<string, string> = {};
    for (const school of ["Escuela del 6", "Escuela del 7"]) {
      const created = await createClass(db, teacher, { ...input, school });
      if (!created.ok) throw new Error("createClass failed");
      const cls = (await getClass(db, teacher, created.classId))!;
      await createStudent(db, teacher, { firstName: "Ana", lastName: "Pérez", courseId: cls.courseId });
      const [student] = (await listStudents(db, teacher)).filter((s) => s.courses.some((c) => c.id === cls.courseId));
      const [, term2] = await listTerms(db, teacher, cls);
      await saveTermGrades(db, teacher, cls, term2.id, {
        save: [{ studentId: student.id, value: 6, notes: null, outsideRangeReason: null }],
        clear: [],
      });
      ids[school] = created.classId;
    }
    const schools = await listSchools(db, teacher);
    return { teacher, ids, sixId: schools.find((s) => s.name === "Escuela del 6")!.id };
  }
  const result = async (teacher: string, classId: string) => {
    const cls = (await getClass(db, teacher, classId))!;
    return (await getClosingSheet(db, teacher, cls)).rows[0].result.kind;
  };

  it("is used for that school's classes only; the others keep the teacher's", async () => {
    const { teacher, ids, sixId } = await twoSchools();
    expect(await result(teacher, ids["Escuela del 6"])).toBe("owed");

    expect(await setSchoolPassMark(db, teacher, { schoolId: sixId, passMark: 6 })).toEqual({ ok: true });

    expect((await listSchools(db, teacher)).map((s) => [s.name, s.passMark])).toEqual([
      ["Escuela del 6", 6],
      ["Escuela del 7", null],
    ]);
    expect((await getClass(db, teacher, ids["Escuela del 6"]))!.passMark).toBe(6);
    expect((await getClass(db, teacher, ids["Escuela del 7"]))!.passMark).toBeNull();
    expect(await result(teacher, ids["Escuela del 6"])).toBe("passed");
    expect(await result(teacher, ids["Escuela del 7"])).toBe("owed");
    // Previas and the history agree.
    expect((await listOwed(db, teacher)).map((c) => c.school)).toEqual(["Escuela del 7"]);
    const [student] = (await listStudents(db, teacher)).filter((s) => s.courses.some((c) => c.school === "Escuela del 6"));
    const history = (await getStudentHistory(db, teacher, student.id))!;
    expect(history.courses[0].classes[0]).toMatchObject({ passMark: 6, result: { kind: "passed" } });
  });

  it("goes back to the teacher's pass mark when cleared, whatever that is by then", async () => {
    const { teacher, ids, sixId } = await twoSchools();
    await setSchoolPassMark(db, teacher, { schoolId: sixId, passMark: 6 });
    await setSchoolPassMark(db, teacher, { schoolId: sixId, passMark: null });
    expect(await result(teacher, ids["Escuela del 6"])).toBe("owed");
    await setRules(db, teacher, { gradeMin: 1, gradeMax: 10, passMark: 5, maxTermIncrease: 3, maxTermDecrease: 3 });
    expect(await result(teacher, ids["Escuela del 6"])).toBe("passed");
  });

  it("refuses another teacher's school (OWNER-1)", async () => {
    const { teacher, sixId } = await twoSchools();
    const notFound = { ok: false, error: "notFound" };
    expect(await setSchoolPassMark(db, newTeacher(), { schoolId: sixId, passMark: 4 })).toEqual(notFound);
    expect(await setSchoolPassMark(db, teacher, { schoolId: "nope", passMark: 4 })).toEqual(notFound);
    expect((await listSchools(db, teacher)).find((s) => s.id === sixId)!.passMark).toBeNull();
  });
});
