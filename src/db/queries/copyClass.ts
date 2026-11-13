// COPY-1..4: starting a class from another one's units, passing standards
// and tasks. Scoped to one teacher (OWNER-1).

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db";
import { academicYears, classes, courses, schools, standards, taskStandards, tasks, terms, units } from "@/db/schema";
import { adaptedTaskFolder, standardFolder } from "@/lib/attachments";
import { compareCourses, type Shift } from "@/lib/courses";
import { getClass } from "./classDetail";

export type CopySource = {
  id: string;
  name: string;
  year: number;
  division: string;
  shift: Shift;
  schoolYear: string;
  school: string;
};

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/** COPY-1: every class of the teacher's, archived ones too (CLASS-8), newest school year first. */
export async function listCopySources(db: Db, teacherId: string): Promise<CopySource[]> {
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      schoolYear: academicYears.name,
      school: schools.name,
    })
    .from(classes)
    .innerJoin(courses, eq(classes.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .innerJoin(schools, eq(courses.schoolId, schools.id))
    .where(eq(classes.teacherId, teacherId));
  return rows.sort((a, b) => compareCourses(a, b) || collator.compare(a.name, b.name));
}

/** A file to copy in Storage: where it is, and where the copy goes. */
export type FileCopy = { from: string; to: string };

export type CopyResult =
  | { ok: true; units: number; standards: number; tasks: number; files: FileCopy[] }
  | { ok: false; error: "notFound" };

/** The file's own name, the last part of its Storage path (FILE-2). */
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/**
 * COPY-1..3: copies `fromClassId`'s units, the class's passing standards
 * (not a student's own, ADAPT-2) and its tasks into `toClassId`, in one
 * transaction. Each goes into the cuatrimestre of the same number; tasks keep
 * their unit, passing standards, adapted version and files, but no dates,
 * groups or scores. The files are only recorded here: the answer lists them
 * for Storage to copy.
 */
export async function copyClassContent(
  db: Db,
  teacherId: string,
  input: { fromClassId: string; toClassId: string },
): Promise<CopyResult> {
  if (input.fromClassId === input.toClassId) return { ok: false, error: "notFound" };
  const [from, to] = await Promise.all([
    getClass(db, teacherId, input.fromClassId),
    getClass(db, teacherId, input.toClassId),
  ]);
  if (!from || !to) return { ok: false, error: "notFound" };

  return db.transaction(async (tx) => {
    const [fromTerms, toTerms, unitRows, standardRows, taskRows] = await Promise.all([
      tx.select({ id: terms.id, position: terms.position }).from(terms).where(eq(terms.academicYearId, from.academicYearId)),
      tx.select({ id: terms.id, position: terms.position }).from(terms).where(eq(terms.academicYearId, to.academicYearId)),
      tx.select().from(units).where(eq(units.classId, from.id)).orderBy(asc(units.position), asc(units.createdAt)),
      tx
        .select()
        .from(standards)
        .where(and(eq(standards.classId, from.id), isNull(standards.studentId)))
        .orderBy(asc(standards.position)),
      tx.select().from(tasks).where(eq(tasks.classId, from.id)).orderBy(asc(tasks.createdAt)),
    ]);

    // The same cuatrimestre by number: 1° to 1°, 2° to 2°.
    const positionOf = new Map(fromTerms.map((t) => [t.id, t.position]));
    const termTo = new Map(toTerms.map((t) => [t.position, t.id]));
    const sameTerm = (termId: string | null) => (termId ? (termTo.get(positionOf.get(termId) ?? -1) ?? null) : null);

    const unitId = new Map(unitRows.map((u) => [u.id, randomUUID()]));
    const standardId = new Map(standardRows.map((s) => [s.id, randomUUID()]));
    const taskId = new Map(taskRows.map((t) => [t.id, randomUUID()]));
    const files: FileCopy[] = [];
    /** Records a copy of the file at `path` into `folder`, and answers its new path. */
    const copied = (path: string | null, folder: string) => {
      if (!path) return null;
      const to = `${teacherId}/${folder}/${baseName(path)}`;
      files.push({ from: path, to });
      return to;
    };

    if (unitRows.length > 0) {
      await tx.insert(units).values(
        unitRows.map((u) => ({
          id: unitId.get(u.id)!,
          teacherId,
          classId: to.id,
          termId: sameTerm(u.termId),
          title: u.title,
          description: u.description,
          position: u.position,
        })),
      );
    }
    if (standardRows.length > 0) {
      await tx.insert(standards).values(
        standardRows.map((s) => {
          const id = standardId.get(s.id)!;
          return {
            id,
            teacherId,
            classId: to.id,
            scope: s.scope,
            unitId: s.unitId ? (unitId.get(s.unitId) ?? null) : null,
            title: s.title,
            description: s.description,
            position: s.position,
            attachmentPath: copied(s.attachmentPath, standardFolder(id)),
            attachmentName: s.attachmentPath ? s.attachmentName : null,
          };
        }),
      );
    }
    // A task needs a cuatrimestre; both years always have the two.
    const copiedTasks = taskRows.filter((t) => sameTerm(t.termId) !== null);
    if (copiedTasks.length > 0) {
      await tx.insert(tasks).values(
        copiedTasks.map((t) => {
          const id = taskId.get(t.id)!;
          return {
            id,
            teacherId,
            classId: to.id,
            termId: sameTerm(t.termId)!,
            unitId: t.unitId ? (unitId.get(t.unitId) ?? null) : null,
            title: t.title,
            description: t.description,
            criteria: t.criteria,
            attachmentPath: copied(t.attachmentPath, id),
            attachmentName: t.attachmentPath ? t.attachmentName : null,
            adaptedDescription: t.adaptedDescription,
            adaptedCriteria: t.adaptedCriteria,
            adaptedAttachmentPath: copied(t.adaptedAttachmentPath, adaptedTaskFolder(id)),
            adaptedAttachmentName: t.adaptedAttachmentPath ? t.adaptedAttachmentName : null,
          };
        }),
      );
      const links = await tx
        .select({ taskId: taskStandards.taskId, standardId: taskStandards.standardId })
        .from(taskStandards)
        .where(inArray(taskStandards.taskId, copiedTasks.map((t) => t.id)));
      // Only links to standards that were copied: a student's own stays behind.
      const kept = links.filter((l) => standardId.has(l.standardId));
      if (kept.length > 0) {
        await tx.insert(taskStandards).values(
          kept.map((l) => ({ teacherId, taskId: taskId.get(l.taskId)!, standardId: standardId.get(l.standardId)! })),
        );
      }
    }
    return { ok: true, units: unitRows.length, standards: standardRows.length, tasks: copiedTasks.length, files } as const;
  });
}

/**
 * COPY-3: a file Storage couldn't copy is unlinked from the task or passing
 * standard that would point at it, so nothing shows a file that isn't there.
 */
export async function unlinkMissingFiles(db: Db, teacherId: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await Promise.all([
    db
      .update(tasks)
      .set({ attachmentPath: null, attachmentName: null })
      .where(and(eq(tasks.teacherId, teacherId), inArray(tasks.attachmentPath, paths))),
    db
      .update(tasks)
      .set({ adaptedAttachmentPath: null, adaptedAttachmentName: null })
      .where(and(eq(tasks.teacherId, teacherId), inArray(tasks.adaptedAttachmentPath, paths))),
    db
      .update(standards)
      .set({ attachmentPath: null, attachmentName: null })
      .where(and(eq(standards.teacherId, teacherId), inArray(standards.attachmentPath, paths))),
  ]);
}
