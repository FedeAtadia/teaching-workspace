import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { academicYears, classes, terms } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import { createClass, listClasses, listCourses } from "./classes";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const cls = (over: Partial<ClassInput> = {}): ClassInput => ({
  name: "Matemática",
  year: 4,
  division: "A",
  shift: "morning",
  schoolYear: 2026,
  ...over,
});

describe("adding classes (CLASS, COURSE)", () => {
  it("creates the school year with its two cuatrimestres on the first class (CLASS-4)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls());
    await createClass(db, teacher, cls({ name: "Física" }));

    const years = await db.select().from(academicYears).where(eq(academicYears.teacherId, teacher));
    expect(years.map((y) => y.name)).toEqual(["2026"]);
    const yearTerms = await db.select().from(terms).where(eq(terms.academicYearId, years[0].id));
    expect(yearTerms.map((t) => t.position).sort()).toEqual([1, 2]);
  });

  it("puts two subjects of the same year, division and shift in one course (COURSE-1)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls());
    await createClass(db, teacher, cls({ name: "Física" }));
    await createClass(db, teacher, cls({ shift: "afternoon" }));

    const courses = await listCourses(db, teacher);
    expect(courses.map((c) => c.shift)).toEqual(["morning", "afternoon"]);
    const list = await listClasses(db, teacher);
    const morning = list.filter((c) => c.shift === "morning");
    expect(new Set(morning.map((c) => c.courseId)).size).toBe(1);
  });

  it("rejects the same subject twice in a course, whatever its case (CLASS-5)", async () => {
    const teacher = newTeacher();
    expect(await createClass(db, teacher, cls())).toMatchObject({ ok: true });
    expect(await createClass(db, teacher, cls({ name: "matemática" }))).toEqual({
      ok: false,
      error: "duplicate",
    });
    const saved = await db.select().from(classes).where(eq(classes.teacherId, teacher));
    expect(saved).toHaveLength(1);
  });

  it("lists classes in course order, then by subject (COURSE-3)", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, cls({ year: 5, name: "Química" }));
    await createClass(db, teacher, cls({ name: "Física" }));
    await createClass(db, teacher, cls({ schoolYear: 2025, name: "Biología" }));
    await createClass(db, teacher, cls());

    const list = await listClasses(db, teacher);
    expect(list.map((c) => `${c.schoolYear} ${c.year}${c.division} ${c.name}`)).toEqual([
      "2026 4A Física",
      "2026 4A Matemática",
      "2026 5A Química",
      "2025 4A Biología",
    ]);
  });
});

describe("each teacher's classes (OWNER-1)", () => {
  it("never shows one teacher's classes, courses or school years to another", async () => {
    const a = newTeacher();
    const b = newTeacher();
    await createClass(db, a, cls());

    expect(await listClasses(db, b)).toEqual([]);
    expect(await listCourses(db, b)).toEqual([]);
    // The same class for another teacher is theirs, not a duplicate of A's.
    expect(await createClass(db, b, cls())).toMatchObject({ ok: true });
    expect(await listClasses(db, a)).toHaveLength(1);
  });
});
