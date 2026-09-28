// Tasks, their scores, and the gradebook. Scoped to one teacher (OWNER-1).
// Functions that act inside a class take the class already loaded (and
// ownership-checked) by `getClass`, so they don't look it up again.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { courseStudents, scores, standards, taskStandards, tasks, terms, units } from "@/db/schema";
import { isTaskFilePath } from "@/lib/attachments";
import { suggestTermGrade, type Suggestion } from "@/lib/grading";
import type { ScoreRow, ScoreStatus } from "@/lib/scoresForm";
import type { TaskInput } from "@/lib/validation";
import { getClass, listClassStudents, type ClassDetail, type RosterStudent } from "./classDetail";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

type NotFound = { ok: false; error: "notFound" };
const notFound: NotFound = { ok: false, error: "notFound" };

/** TASK-1, TASK-2 */
export async function createTask(
  db: Db,
  teacherId: string,
  input: TaskInput,
): Promise<{ ok: true; taskId: string } | NotFound> {
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return notFound;

  // The cuatrimestre, unit and standards must all be this class's own.
  // Checked in parallel: one round trip's wait instead of three.
  const standardIds = [...new Set(input.standardIds)];
  const [term, unit, ownStandards] = await Promise.all([
    db
      .select({ id: terms.id })
      .from(terms)
      .where(and(eq(terms.id, input.termId), eq(terms.academicYearId, cls.academicYearId))),
    input.unitId
      ? db
          .select({ id: units.id })
          .from(units)
          .where(and(eq(units.id, input.unitId), eq(units.classId, cls.id)))
      : Promise.resolve([{ id: null }]),
    standardIds.length > 0
      ? db
          .select({ id: standards.id })
          .from(standards)
          .where(and(inArray(standards.id, standardIds), eq(standards.classId, cls.id)))
      : Promise.resolve([]),
  ]);
  if (term.length === 0 || unit.length === 0 || ownStandards.length !== standardIds.length) return notFound;

  const taskId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tasks)
      .values({
        teacherId,
        classId: cls.id,
        termId: input.termId,
        unitId: input.unitId,
        title: input.title,
        dueOn: input.dueOn,
        description: input.description,
        criteria: input.criteria,
      })
      .returning({ id: tasks.id });
    if (standardIds.length > 0) {
      await tx
        .insert(taskStandards)
        .values(standardIds.map((standardId) => ({ teacherId, taskId: created.id, standardId })));
    }
    return created.id;
  });
  return { ok: true, taskId };
}

export type TaskRow = {
  id: string;
  title: string;
  termId: string;
  termPosition: number;
  unitTitle: string | null;
  dueOn: string | null;
  description: string | null;
  /** Students with a score or a mark on this task. */
  scored: number;
};

/** TASK-3 */
export async function listTasks(db: Db, teacherId: string, cls: Pick<ClassDetail, "id">): Promise<TaskRow[]> {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      termId: tasks.termId,
      termPosition: terms.position,
      unitTitle: units.title,
      dueOn: tasks.dueOn,
      description: tasks.description,
      scored: sql<number>`(
        select count(*)::int from ${scores}
        where ${scores.taskId} = ${tasks.id}
          and (${scores.value} is not null or ${scores.status} <> 'graded')
      )`,
    })
    .from(tasks)
    .innerJoin(terms, eq(tasks.termId, terms.id))
    .leftJoin(units, eq(tasks.unitId, units.id))
    .where(and(eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId)))
    .orderBy(asc(terms.position), sql`${tasks.dueOn} asc nulls last`, asc(tasks.createdAt));
}

export type TaskDetail = Omit<TaskRow, "scored"> & {
  criteria: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  standards: { id: string; title: string }[];
};

/** One task of this class, or null (OWNER-1). */
export async function getTask(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id">,
  taskId: string,
): Promise<TaskDetail | null> {
  if (!isUuid(taskId)) return null;
  const [[row], linked] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        termId: tasks.termId,
        termPosition: terms.position,
        unitTitle: units.title,
        dueOn: tasks.dueOn,
        description: tasks.description,
        criteria: tasks.criteria,
        attachmentPath: tasks.attachmentPath,
        attachmentName: tasks.attachmentName,
      })
      .from(tasks)
      .innerJoin(terms, eq(tasks.termId, terms.id))
      .leftJoin(units, eq(tasks.unitId, units.id))
      .where(and(eq(tasks.id, taskId), eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId))),
    db
      .select({ id: standards.id, title: standards.title })
      .from(taskStandards)
      .innerJoin(standards, eq(taskStandards.standardId, standards.id))
      .where(and(eq(taskStandards.taskId, taskId), eq(taskStandards.teacherId, teacherId)))
      .orderBy(asc(standards.position)),
  ]);
  if (!row) return null;
  return { ...row, standards: linked };
}

/**
 * FILE-2, FILE-3: record the task's attached file, or clear it with null.
 * Returns the path it had before, for the caller to delete from Storage.
 */
export async function setTaskAttachment(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id">,
  taskId: string,
  file: { path: string; name: string } | null,
): Promise<{ ok: true; previousPath: string | null } | NotFound> {
  if (!isUuid(taskId)) return notFound;
  if (file && !isTaskFilePath(file.path, teacherId, taskId)) return notFound;
  const where = and(eq(tasks.id, taskId), eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId));
  const [current] = await db.select({ path: tasks.attachmentPath }).from(tasks).where(where);
  if (!current) return notFound;
  await db
    .update(tasks)
    .set({ attachmentPath: file?.path ?? null, attachmentName: file?.name.slice(0, 200) ?? null })
    .where(where);
  return { ok: true, previousPath: current.path };
}

/** The saved scores of one task. */
export async function listTaskScores(db: Db, teacherId: string, taskId: string): Promise<ScoreRow[]> {
  if (!isUuid(taskId)) return [];
  return db
    .select({ studentId: scores.studentId, status: scores.status, value: scores.value, notes: scores.notes })
    .from(scores)
    .where(and(eq(scores.taskId, taskId), eq(scores.teacherId, teacherId)));
}

/**
 * SCORE-1..4. Saves all rows or none. Students who aren't active in the
 * class's course are skipped, whatever the form sent.
 */
export async function saveScores(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id" | "courseId">,
  taskId: string,
  entries: { save: ScoreRow[]; clear: string[] },
): Promise<{ ok: true } | NotFound> {
  if (!isUuid(taskId)) return notFound;
  const [[task], roster] = await Promise.all([
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId))),
    db
      .select({ id: courseStudents.studentId })
      .from(courseStudents)
      .where(
        and(
          eq(courseStudents.courseId, cls.courseId),
          eq(courseStudents.teacherId, teacherId),
          eq(courseStudents.status, "active"),
        ),
      ),
  ]);
  if (!task) return notFound;

  const inCourse = new Set(roster.map((r) => r.id));
  const save = entries.save.filter((r) => inCourse.has(r.studentId));
  const clear = entries.clear.filter((id) => inCourse.has(id));

  await db.transaction(async (tx) => {
    if (clear.length > 0) {
      await tx.delete(scores).where(and(eq(scores.taskId, taskId), inArray(scores.studentId, clear)));
    }
    if (save.length > 0) {
      await tx
        .insert(scores)
        .values(save.map((r) => ({ teacherId, taskId, ...r })))
        .onConflictDoUpdate({
          target: [scores.taskId, scores.studentId],
          set: {
            status: sql`excluded.status`,
            value: sql`excluded.value`,
            notes: sql`excluded.notes`,
            gradedAt: sql`now()`,
          },
        });
    }
  });
  return { ok: true };
}

export type GradebookCell = { status: ScoreStatus; value: number | null } | null;
export type GradebookRow = { student: RosterStudent; cells: GradebookCell[]; suggestion: Suggestion };
export type Gradebook = { tasks: TaskRow[]; rows: GradebookRow[] };

/** BOOK-1, BOOK-2: one cuatrimestre of a class. */
export async function getGradebook(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id" | "courseId">,
  termId: string,
): Promise<Gradebook> {
  if (!isUuid(termId)) return { tasks: [], rows: [] };
  const [allTasks, roster, saved] = await Promise.all([
    listTasks(db, teacherId, cls),
    listClassStudents(db, teacherId, cls),
    db
      .select({ taskId: scores.taskId, studentId: scores.studentId, status: scores.status, value: scores.value })
      .from(scores)
      .innerJoin(tasks, eq(scores.taskId, tasks.id))
      .where(and(eq(tasks.classId, cls.id), eq(tasks.termId, termId), eq(scores.teacherId, teacherId))),
  ]);
  const termTasks = allTasks.filter((t) => t.termId === termId);
  const byKey = new Map(saved.map((s) => [`${s.studentId}:${s.taskId}`, s]));

  const rows = roster.map((student) => {
    const cells: GradebookCell[] = termTasks.map((t) => {
      const s = byKey.get(`${student.id}:${t.id}`);
      return s ? { status: s.status, value: s.value } : null;
    });
    const suggestion = suggestTermGrade(cells.filter((c): c is NonNullable<GradebookCell> => c !== null));
    return { student, cells, suggestion };
  });
  return { tasks: termTasks, rows };
}
