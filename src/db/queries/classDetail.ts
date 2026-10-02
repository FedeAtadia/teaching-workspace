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
  taskStandards,
  tasks,
  terms,
  units,
} from "@/db/schema";
import { isFileIn, standardFolder } from "@/lib/attachments";
import { compareStudents, type Shift } from "@/lib/courses";
import type { StandardEdit, StandardInput, UnitEdit, UnitInput } from "@/lib/validation";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

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
  if (!isUuid(classId)) return null;
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

export type StandardRow = {
  id: string;
  title: string;
  description: string | null;
  /** Tasks that assess it, for the delete confirmation (STD-4). */
  tasks: number;
  /** FILE-4: the attached file's name as uploaded, if any. */
  attachmentName: string | null;
};

/** STD-2 */
export async function listStandards(db: Db, teacherId: string, classId: string): Promise<StandardRow[]> {
  if (!isUuid(classId)) return [];
  return db
    .select({
      id: standards.id,
      title: standards.title,
      description: standards.description,
      tasks: sql<number>`(select count(*)::int from ${taskStandards} where ${taskStandards.standardId} = ${standards.id})`,
      attachmentName: standards.attachmentName,
    })
    .from(standards)
    .where(
      and(eq(standards.classId, classId), eq(standards.teacherId, teacherId), eq(standards.scope, "class")),
    )
    .orderBy(asc(standards.position));
}

export type AddResult = { ok: true } | { ok: false; error: "notFound" };
const notFound = { ok: false, error: "notFound" } as const;

/** The next position at the end of a class's list, worked out by the insert itself. */
const nextPosition = (table: typeof standards | typeof units, classId: string) =>
  sql<number>`(select coalesce(max(${table.position}), 0) + 1 from ${table} where ${table.classId} = ${classId})`;

/** STD-1. Two round trips: the ownership check, then the insert. */
export async function createStandard(db: Db, teacherId: string, input: StandardInput): Promise<AddResult> {
  if (!(await getClass(db, teacherId, input.classId))) return notFound;
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

const ownStandard = (teacherId: string, classId: string, standardId: string) =>
  and(eq(standards.id, standardId), eq(standards.classId, classId), eq(standards.teacherId, teacherId));

/**
 * STD-3. One round trip: the update only matches a standard of this teacher
 * in this class, so a missing or foreign one changes nothing.
 */
export async function updateStandard(db: Db, teacherId: string, input: StandardEdit): Promise<AddResult> {
  const updated = await db
    .update(standards)
    .set({ title: input.title, description: input.description })
    .where(ownStandard(teacherId, input.classId, input.standardId))
    .returning({ id: standards.id });
  return updated.length > 0 ? { ok: true } : notFound;
}

/**
 * STD-4. Its links to tasks go with it (ON DELETE CASCADE); the tasks stay.
 * Returns its file's path (FILE-4), for the caller to delete from Storage.
 */
export async function deleteStandard(
  db: Db,
  teacherId: string,
  input: { classId: string; standardId: string },
): Promise<{ ok: true; attachmentPath: string | null } | typeof notFound> {
  if (!isUuid(input.classId) || !isUuid(input.standardId)) return notFound;
  const [deleted] = await db
    .delete(standards)
    .where(ownStandard(teacherId, input.classId, input.standardId))
    .returning({ attachmentPath: standards.attachmentPath });
  return deleted ? { ok: true, attachmentPath: deleted.attachmentPath } : notFound;
}

/**
 * FILE-3, FILE-4: record the standard's attached file, or clear it with null.
 * Returns the path it had before, for the caller to delete from Storage.
 */
export async function setStandardAttachment(
  db: Db,
  teacherId: string,
  target: { classId: string; standardId: string },
  file: { path: string; name: string } | null,
): Promise<{ ok: true; previousPath: string | null } | typeof notFound> {
  if (!isUuid(target.classId) || !isUuid(target.standardId)) return notFound;
  if (file && !isFileIn(file.path, teacherId, standardFolder(target.standardId))) return notFound;
  const where = ownStandard(teacherId, target.classId, target.standardId);
  const [current] = await db.select({ path: standards.attachmentPath }).from(standards).where(where);
  if (!current) return notFound;
  await db
    .update(standards)
    .set({ attachmentPath: file?.path ?? null, attachmentName: file?.name.slice(0, 200) ?? null })
    .where(where);
  return { ok: true, previousPath: current.path };
}

/** FILE-4: the standard's file path, to open it; null if none or not this teacher's. */
export async function getStandardFile(
  db: Db,
  teacherId: string,
  target: { classId: string; standardId: string },
): Promise<string | null> {
  if (!isUuid(target.classId) || !isUuid(target.standardId)) return null;
  const [row] = await db
    .select({ path: standards.attachmentPath })
    .from(standards)
    .where(ownStandard(teacherId, target.classId, target.standardId));
  return row?.path ?? null;
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

export type UnitRow = {
  id: string;
  title: string;
  termId: string | null;
  termPosition: number | null;
  /** Tasks in it, for the delete confirmation (UNIT-4). */
  tasks: number;
};

/** UNIT-2 */
export async function listUnits(db: Db, teacherId: string, classId: string): Promise<UnitRow[]> {
  if (!isUuid(classId)) return [];
  return db
    .select({
      id: units.id,
      title: units.title,
      termId: units.termId,
      termPosition: terms.position,
      tasks: sql<number>`(select count(*)::int from ${tasks} where ${tasks.unitId} = ${units.id})`,
    })
    .from(units)
    .leftJoin(terms, eq(units.termId, terms.id))
    .where(and(eq(units.classId, classId), eq(units.teacherId, teacherId)))
    .orderBy(asc(units.position));
}

/**
 * The class, if it is this teacher's and the cuatrimestre (when given) is of
 * its own school year (UNIT-1, UNIT-3).
 */
async function classForUnit(db: Db, teacherId: string, input: UnitInput): Promise<ClassDetail | null> {
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls || !input.termId) return cls;
  const [own] = await db
    .select({ id: terms.id })
    .from(terms)
    .where(and(eq(terms.id, input.termId), eq(terms.academicYearId, cls.academicYearId)));
  return own ? cls : null;
}

/** UNIT-1. Two or three round trips: ownership, the cuatrimestre if given, the insert. */
export async function createUnit(db: Db, teacherId: string, input: UnitInput): Promise<AddResult> {
  if (!(await classForUnit(db, teacherId, input))) return notFound;
  await db.insert(units).values({
    teacherId,
    classId: input.classId,
    termId: input.termId,
    title: input.title,
    position: nextPosition(units, input.classId),
  });
  return { ok: true };
}

const ownUnit = (teacherId: string, classId: string, unitId: string) =>
  and(eq(units.id, unitId), eq(units.classId, classId), eq(units.teacherId, teacherId));

/** UNIT-3. Checked like UNIT-1, then updated only if the unit is this class's. */
export async function updateUnit(db: Db, teacherId: string, input: UnitEdit): Promise<AddResult> {
  if (!(await classForUnit(db, teacherId, input))) return notFound;
  const updated = await db
    .update(units)
    .set({ title: input.title, termId: input.termId })
    .where(ownUnit(teacherId, input.classId, input.unitId))
    .returning({ id: units.id });
  return updated.length > 0 ? { ok: true } : notFound;
}

/** UNIT-4. Its tasks stay, without a unit (ON DELETE SET NULL). */
export async function deleteUnit(
  db: Db,
  teacherId: string,
  input: { classId: string; unitId: string },
): Promise<AddResult> {
  if (!isUuid(input.classId) || !isUuid(input.unitId)) return notFound;
  const deleted = await db
    .delete(units)
    .where(ownUnit(teacherId, input.classId, input.unitId))
    .returning({ id: units.id });
  return deleted.length > 0 ? { ok: true } : notFound;
}
