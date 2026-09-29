// Reading and writing schools, classes and courses. Every query is scoped to
// one teacher (OWNER-1). Takes the database as an argument so tests can pass
// an in-memory one.

import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { academicYears, classes, courseStudents, courses, schools, terms } from "@/db/schema";
import { compareCourses, type Shift } from "@/lib/courses";
import type { ClassInput, SchoolInput } from "@/lib/validation";

const collator = new Intl.Collator("es", { sensitivity: "base" });

export type CreateClassResult = { ok: true; classId: string } | { ok: false; error: "duplicate" };

/** CLASS-4, CLASS-5, COURSE-1, SCHOOL-1, SCHOOL-2 */
export async function createClass(
  db: Db,
  teacherId: string,
  input: ClassInput,
): Promise<CreateClassResult> {
  return db.transaction(async (tx) => {
    const schoolId = await findOrCreateSchool(tx, teacherId, input.school);
    const yearId = await findOrCreateYear(tx, teacherId, String(input.schoolYear));
    const courseId = await findOrCreateCourse(tx, teacherId, schoolId, yearId, input);

    // The unique constraint is case-sensitive; "matemática" is still a duplicate.
    const existing = await tx
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.courseId, courseId), sql`lower(${classes.name}) = lower(${input.name})`));
    if (existing.length > 0) return { ok: false, error: "duplicate" } as const;

    const [created] = await tx
      .insert(classes)
      .values({ teacherId, courseId, name: input.name })
      .returning({ id: classes.id });
    return { ok: true, classId: created.id } as const;
  });
}

/** SCHOOL-1, SCHOOL-3: the teacher's school of that name, whatever its case, or a new one. */
async function findOrCreateSchool(tx: Db, teacherId: string, name: string): Promise<string> {
  const [created] = await tx
    .insert(schools)
    .values({ teacherId, name })
    .onConflictDoNothing()
    .returning({ id: schools.id });
  if (created) return created.id;
  const [existing] = await tx
    .select({ id: schools.id })
    .from(schools)
    .where(and(eq(schools.teacherId, teacherId), sql`lower(${schools.name}) = lower(${name})`));
  return existing.id;
}

async function findOrCreateYear(tx: Db, teacherId: string, name: string): Promise<string> {
  const [created] = await tx
    .insert(academicYears)
    .values({ teacherId, name })
    .onConflictDoNothing()
    .returning({ id: academicYears.id });
  if (created) {
    // TERM-1: every school year has two cuatrimestres.
    await tx.insert(terms).values([
      { teacherId, academicYearId: created.id, name: "1° cuatrimestre", position: 1 },
      { teacherId, academicYearId: created.id, name: "2° cuatrimestre", position: 2 },
    ]);
    return created.id;
  }
  const [existing] = await tx
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.teacherId, teacherId), eq(academicYears.name, name)));
  return existing.id;
}

async function findOrCreateCourse(
  tx: Db,
  teacherId: string,
  schoolId: string,
  academicYearId: string,
  input: ClassInput,
): Promise<string> {
  const key = { year: input.year, division: input.division, shift: input.shift };
  const [created] = await tx
    .insert(courses)
    .values({ teacherId, schoolId, academicYearId, ...key })
    .onConflictDoNothing()
    .returning({ id: courses.id });
  if (created) return created.id;
  const [existing] = await tx
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.teacherId, teacherId),
        eq(courses.schoolId, schoolId),
        eq(courses.academicYearId, academicYearId),
        eq(courses.year, key.year),
        eq(courses.division, key.division),
        eq(courses.shift, key.shift),
      ),
    );
  return existing.id;
}

export type CourseRow = {
  id: string;
  year: number;
  division: string;
  shift: Shift;
  schoolYear: string;
  school: string;
};

/** COURSE-3: for the add-student dropdown. */
export async function listCourses(db: Db, teacherId: string): Promise<CourseRow[]> {
  const rows = await db
    .select({
      id: courses.id,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      schoolYear: academicYears.name,
      school: schools.name,
    })
    .from(courses)
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .innerJoin(schools, eq(courses.schoolId, schools.id))
    .where(eq(courses.teacherId, teacherId));
  return rows.sort(compareCourses);
}

export type ClassRow = CourseRow & { courseId: string; name: string; students: number };

/** COURSE-3, STUDENT-2: classes with how many students their course has. */
export async function listClasses(db: Db, teacherId: string): Promise<ClassRow[]> {
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      courseId: courses.id,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      schoolYear: academicYears.name,
      school: schools.name,
      students: sql<number>`(
        select count(*)::int from ${courseStudents}
        where ${courseStudents.courseId} = ${courses.id} and ${courseStudents.status} = 'active'
      )`,
    })
    .from(classes)
    .innerJoin(courses, eq(classes.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .innerJoin(schools, eq(courses.schoolId, schools.id))
    .where(eq(classes.teacherId, teacherId));
  return rows.sort((a, b) => compareCourses(a, b) || collator.compare(a.name, b.name));
}

export type SchoolRow = { id: string; name: string; courses: number };

/** The teacher's schools, by name, with how many courses each has. */
export async function listSchools(db: Db, teacherId: string): Promise<SchoolRow[]> {
  const rows = await db
    .select({
      id: schools.id,
      name: schools.name,
      courses: sql<number>`(select count(*)::int from ${courses} where ${courses.schoolId} = ${schools.id})`,
    })
    .from(schools)
    .where(eq(schools.teacherId, teacherId));
  return rows.sort((a, b) => collator.compare(a.name, b.name));
}

export type RenameSchoolResult = { ok: true } | { ok: false; error: "notFound" | "duplicate" };

/** SCHOOL-3 */
export async function renameSchool(db: Db, teacherId: string, input: SchoolInput): Promise<RenameSchoolResult> {
  const mine = and(eq(schools.id, input.schoolId), eq(schools.teacherId, teacherId));
  const [[school], clash] = await Promise.all([
    db.select({ id: schools.id }).from(schools).where(mine),
    db
      .select({ id: schools.id })
      .from(schools)
      .where(
        and(
          eq(schools.teacherId, teacherId),
          ne(schools.id, input.schoolId),
          sql`lower(${schools.name}) = lower(${input.name})`,
        ),
      ),
  ]);
  if (!school) return { ok: false, error: "notFound" };
  if (clash.length > 0) return { ok: false, error: "duplicate" };
  await db.update(schools).set({ name: input.name }).where(mine);
  return { ok: true };
}
