// Everything on a class's own page: the class itself, its course's students,
// its passing standards and its units. Scoped to one teacher (OWNER-1).

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  academicYears,
  classes,
  courseStudents,
  courses,
  schools,
  standards,
  students,
  terms,
  units,
} from "@/db/schema";
import { compareStudents, type Shift } from "@/lib/courses";
import type { StandardInput, UnitInput } from "@/lib/validation";

export type ClassDetail = {
  id: string;
  name: string;
  courseId: string;
  academicYearId: string;
  year: number;
  division: string;
  shift: Shift;
  schoolYear: string;
  school: string;
  passMark: number | null;
};

/** The class, or null when it isn't this teacher's (or doesn't exist). */
export async function getClass(db: Db, teacherId: string, classId: string): Promise<ClassDetail | null> {
  // A malformed id in the URL would make Postgres throw; it is just "not found".
  if (!z.uuid().safeParse(classId).success) return null;
  const [row] = await db
    .select({
      id: classes.id,
      name: classes.name,
      courseId: courses.id,
      academicYearId: academicYears.id,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      schoolYear: academicYears.name,
      school: schools.name,
      passMark: classes.passMark,
    })
    .from(classes)
    .innerJoin(courses, eq(classes.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .innerJoin(schools, eq(courses.schoolId, schools.id))
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  return row ?? null;
}

export type RosterStudent = { id: string; firstName: string; lastName: string };

/**
 * ROSTER-1. Takes the class already loaded by `getClass` (which checked it is
 * this teacher's) rather than looking it up again: one query fewer per page.
 */
export async function listClassStudents(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "courseId">,
): Promise<RosterStudent[]> {
  const rows = await db
    .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
    .from(courseStudents)
    .innerJoin(students, eq(courseStudents.studentId, students.id))
    .where(
      and(
        eq(courseStudents.courseId, cls.courseId),
        eq(courseStudents.teacherId, teacherId),
        eq(courseStudents.status, "active"),
      ),
    );
  return rows.sort(compareStudents);
}

export type StandardRow = { id: string; title: string; description: string | null };

/** STD-2 */
export async function listStandards(db: Db, teacherId: string, classId: string): Promise<StandardRow[]> {
  if (!z.uuid().safeParse(classId).success) return [];
  return db
    .select({ id: standards.id, title: standards.title, description: standards.description })
    .from(standards)
    .where(
      and(eq(standards.classId, classId), eq(standards.teacherId, teacherId), eq(standards.scope, "class")),
    )
    .orderBy(asc(standards.position));
}

export type AddResult = { ok: true } | { ok: false; error: "notFound" };

/** The next position at the end of a class's list, worked out by the insert itself. */
const nextPosition = (table: typeof standards | typeof units, classId: string) =>
  sql<number>`(select coalesce(max(${table.position}), 0) + 1 from ${table} where ${table.classId} = ${classId})`;

/** STD-1. Two round trips: the ownership check, then the insert. */
export async function createStandard(db: Db, teacherId: string, input: StandardInput): Promise<AddResult> {
  if (!(await getClass(db, teacherId, input.classId))) return { ok: false, error: "notFound" };
  await db.insert(standards).values({
    teacherId,
    scope: "class",
    classId: input.classId,
    title: input.title,
    description: input.description,
    position: nextPosition(standards, input.classId),
  });
  return { ok: true };
}

export type TermRow = { id: string; position: number };

/** The two cuatrimestres of the class's school year (TERM-1). Takes the loaded class. */
export async function listTerms(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "academicYearId">,
): Promise<TermRow[]> {
  return db
    .select({ id: terms.id, position: terms.position })
    .from(terms)
    .where(and(eq(terms.academicYearId, cls.academicYearId), eq(terms.teacherId, teacherId)))
    .orderBy(asc(terms.position));
}

export type UnitRow = { id: string; title: string; termPosition: number | null };

/** UNIT-2 */
export async function listUnits(db: Db, teacherId: string, classId: string): Promise<UnitRow[]> {
  if (!z.uuid().safeParse(classId).success) return [];
  return db
    .select({ id: units.id, title: units.title, termPosition: terms.position })
    .from(units)
    .leftJoin(terms, eq(units.termId, terms.id))
    .where(and(eq(units.classId, classId), eq(units.teacherId, teacherId)))
    .orderBy(asc(units.position));
}

/** UNIT-1. Two or three round trips: ownership, the cuatrimestre if given, the insert. */
export async function createUnit(db: Db, teacherId: string, input: UnitInput): Promise<AddResult> {
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return { ok: false, error: "notFound" };
  if (input.termId) {
    // The cuatrimestre must be one of this class's own school year.
    const [own] = await db
      .select({ id: terms.id })
      .from(terms)
      .where(and(eq(terms.id, input.termId), eq(terms.academicYearId, cls.academicYearId)));
    if (!own) return { ok: false, error: "notFound" };
  }
  await db.insert(units).values({
    teacherId,
    classId: input.classId,
    termId: input.termId,
    title: input.title,
    position: nextPosition(units, input.classId),
  });
  return { ok: true };
}
