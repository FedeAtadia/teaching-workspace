// Everything on a class's own page: the class itself, its course's students,
// its passing standards and its units. Scoped to one teacher (OWNER-1).

import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  academicYears,
  classes,
  courseStudents,
  courses,
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
      passMark: classes.passMark,
    })
    .from(classes)
    .innerJoin(courses, eq(classes.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  return row ?? null;
}

export type RosterStudent = { id: string; firstName: string; lastName: string };

/** ROSTER-1 */
export async function listClassStudents(
  db: Db,
  teacherId: string,
  classId: string,
): Promise<RosterStudent[]> {
  const cls = await getClass(db, teacherId, classId);
  if (!cls) return [];
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

/** STD-1 */
export async function createStandard(db: Db, teacherId: string, input: StandardInput): Promise<AddResult> {
  return db.transaction(async (tx) => {
    if (!(await getClass(tx, teacherId, input.classId))) return { ok: false, error: "notFound" } as const;
    const [{ last }] = await tx
      .select({ last: max(standards.position) })
      .from(standards)
      .where(eq(standards.classId, input.classId));
    await tx.insert(standards).values({
      teacherId,
      scope: "class",
      classId: input.classId,
      title: input.title,
      description: input.description,
      position: (last ?? 0) + 1,
    });
    return { ok: true } as const;
  });
}

export type TermRow = { id: string; position: number };

/** The two cuatrimestres of the class's school year (TERM-1). */
export async function listTerms(db: Db, teacherId: string, classId: string): Promise<TermRow[]> {
  const cls = await getClass(db, teacherId, classId);
  if (!cls) return [];
  return db
    .select({ id: terms.id, position: terms.position })
    .from(terms)
    .where(eq(terms.academicYearId, cls.academicYearId))
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

/** UNIT-1 */
export async function createUnit(db: Db, teacherId: string, input: UnitInput): Promise<AddResult> {
  return db.transaction(async (tx) => {
    if (!(await getClass(tx, teacherId, input.classId))) return { ok: false, error: "notFound" } as const;
    if (input.termId) {
      // The cuatrimestre must be one of this class's own school year.
      const own = await listTerms(tx, teacherId, input.classId);
      if (!own.some((t) => t.id === input.termId)) return { ok: false, error: "notFound" } as const;
    }
    const [{ last }] = await tx
      .select({ last: max(units.position) })
      .from(units)
      .where(eq(units.classId, input.classId));
    await tx.insert(units).values({
      teacherId,
      classId: input.classId,
      termId: input.termId,
      title: input.title,
      position: (last ?? 0) + 1,
    });
    return { ok: true } as const;
  });
}
