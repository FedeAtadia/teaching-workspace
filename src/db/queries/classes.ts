// Reading and writing schools, classes and courses. Every query is scoped to
// one teacher (OWNER-1). Takes the database as an argument so tests can pass
// an in-memory one.

import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  academicYears,
  classes,
  courseStudents,
  courses,
  schools,
  scores,
  standards,
  tasks,
  termGrades,
  terms,
  units,
} from "@/db/schema";
import { compareCourses, type Shift } from "@/lib/courses";
import type { ClassEdit, ClassInput, SchoolInput } from "@/lib/validation";

const collator = new Intl.Collator("es", { sensitivity: "base" });

const isUuid = (v: string) => z.uuid().safeParse(v).success;

const ownClass = (teacherId: string, classId: string) =>
  and(eq(classes.id, classId), eq(classes.teacherId, teacherId));

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

export type UpdateClassResult = { ok: true } | { ok: false; error: "notFound" | "duplicate" | "courseExists" };

/**
 * CLASS-6. The subject is this class's; the other five fields are its
 * course's, so the course row itself changes and its classes and students
 * follow. Everything is checked before anything is written.
 */
export async function updateClass(db: Db, teacherId: string, input: ClassEdit): Promise<UpdateClassResult> {
  if (!isUuid(input.classId)) return { ok: false, error: "notFound" };
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ courseId: classes.courseId, academicYearId: courses.academicYearId })
      .from(classes)
      .innerJoin(courses, eq(classes.courseId, courses.id))
      .where(ownClass(teacherId, input.classId));
    if (!current) return { ok: false, error: "notFound" } as const;

    const [sameSubject, otherCourse] = await Promise.all([
      // CLASS-5, ignoring case, among the course's other classes.
      tx
        .select({ id: classes.id })
        .from(classes)
        .where(
          and(
            eq(classes.courseId, current.courseId),
            ne(classes.id, input.classId),
            sql`lower(${classes.name}) = lower(${input.name})`,
          ),
        ),
      // Another course of the teacher's with the new fields. Matched by the
      // school's and year's names, so nothing has to be created to check.
      tx
        .select({ id: courses.id })
        .from(courses)
        .innerJoin(schools, eq(courses.schoolId, schools.id))
        .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
        .where(
          and(
            eq(courses.teacherId, teacherId),
            ne(courses.id, current.courseId),
            sql`lower(${schools.name}) = lower(${input.school})`,
            eq(academicYears.name, String(input.schoolYear)),
            eq(courses.year, input.year),
            eq(courses.division, input.division),
            eq(courses.shift, input.shift),
          ),
        ),
    ]);
    if (sameSubject.length > 0) return { ok: false, error: "duplicate" } as const;
    if (otherCourse.length > 0) return { ok: false, error: "courseExists" } as const;

    const schoolId = await findOrCreateSchool(tx, teacherId, input.school);
    const yearId = await findOrCreateYear(tx, teacherId, String(input.schoolYear));
    await tx
      .update(courses)
      .set({ schoolId, academicYearId: yearId, year: input.year, division: input.division, shift: input.shift })
      .where(eq(courses.id, current.courseId));
    await tx.update(classes).set({ name: input.name }).where(eq(classes.id, input.classId));

    if (yearId !== current.academicYearId) {
      // The course's work moves to the new year's cuatrimestre with the same number.
      const courseClasses = tx.select({ id: classes.id }).from(classes).where(eq(classes.courseId, current.courseId));
      const sameTerm = (termId: typeof tasks.termId | typeof units.termId | typeof termGrades.termId) =>
        sql`(select nt.id from ${terms} nt join ${terms} ot on ot.position = nt.position
             where ot.id = ${termId} and nt.academic_year_id = ${yearId})`;
      await tx.update(tasks).set({ termId: sameTerm(tasks.termId) }).where(inArray(tasks.classId, courseClasses));
      await tx
        .update(units)
        .set({ termId: sameTerm(units.termId) })
        .where(and(inArray(units.classId, courseClasses), isNotNull(units.termId)));
      await tx
        .update(termGrades)
        .set({ termId: sameTerm(termGrades.termId) })
        .where(inArray(termGrades.classId, courseClasses));
    }
    return { ok: true } as const;
  });
}

export type ClassCounts = {
  tasks: number;
  /** Scores and marks saved on its tasks. */
  scores: number;
  units: number;
  standards: number;
  /** Attached files, on its tasks and standards (FILE-4). */
  files: number;
  /** The subjects of the course's other classes, which a change to the course also changes. */
  otherClasses: string[];
};

/** CLASS-6, CLASS-7: what an edit or a delete affects. Null when it isn't this teacher's class. */
export async function getClassCounts(db: Db, teacherId: string, classId: string): Promise<ClassCounts | null> {
  if (!isUuid(classId)) return null;
  const [cls] = await db.select({ courseId: classes.courseId }).from(classes).where(ownClass(teacherId, classId));
  if (!cls) return null;
  const n = { n: sql<number>`count(*)::int` };
  const files = (table: typeof tasks | typeof standards) =>
    db.select(n).from(table).where(and(eq(table.classId, classId), isNotNull(table.attachmentPath)));
  const [[taskCount], [taskFiles], [standardFiles], [scoreCount], [unitCount], [standardCount], others] =
    await Promise.all([
      db.select(n).from(tasks).where(eq(tasks.classId, classId)),
      files(tasks),
      files(standards),
      db
        .select(n)
        .from(scores)
        .innerJoin(tasks, eq(scores.taskId, tasks.id))
        .where(and(eq(tasks.classId, classId), sql`(${scores.value} is not null or ${scores.status} <> 'graded')`)),
      db.select(n).from(units).where(eq(units.classId, classId)),
      db.select(n).from(standards).where(eq(standards.classId, classId)),
      db
        .select({ name: classes.name })
        .from(classes)
        .where(and(eq(classes.courseId, cls.courseId), ne(classes.id, classId))),
    ]);
  return {
    tasks: taskCount.n,
    scores: scoreCount.n,
    units: unitCount.n,
    standards: standardCount.n,
    files: taskFiles.n + standardFiles.n,
    otherClasses: others.map((c) => c.name).sort(collator.compare),
  };
}

/**
 * CLASS-7. Its tasks, scores, units, standards and grades go with it (ON
 * DELETE CASCADE); the course and its students stay. Returns the tasks' and
 * standards' attached files (FILE-4), for the caller to delete from Storage.
 */
export async function deleteClass(
  db: Db,
  teacherId: string,
  classId: string,
): Promise<{ ok: true; attachmentPaths: string[] } | { ok: false; error: "notFound" }> {
  if (!isUuid(classId)) return { ok: false, error: "notFound" };
  return db.transaction(async (tx) => {
    const files = (table: typeof tasks | typeof standards) =>
      tx
        .select({ path: table.attachmentPath })
        .from(table)
        .where(and(eq(table.classId, classId), eq(table.teacherId, teacherId), isNotNull(table.attachmentPath)));
    const [taskFiles, standardFiles, adaptedFiles] = await Promise.all([
      files(tasks),
      files(standards),
      // ADAPT-3: the tasks' adapted files.
      tx
        .select({ path: tasks.adaptedAttachmentPath })
        .from(tasks)
        .where(
          and(eq(tasks.classId, classId), eq(tasks.teacherId, teacherId), isNotNull(tasks.adaptedAttachmentPath)),
        ),
    ]);
    const deleted = await tx.delete(classes).where(ownClass(teacherId, classId)).returning({ id: classes.id });
    if (deleted.length === 0) return { ok: false, error: "notFound" } as const;
    const paths = [...taskFiles, ...standardFiles, ...adaptedFiles].map((f) => f.path!);
    return { ok: true, attachmentPaths: paths } as const;
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
