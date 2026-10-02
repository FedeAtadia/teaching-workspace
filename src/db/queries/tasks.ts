// Tasks, their scores, and the gradebook. Scoped to one teacher (OWNER-1).
// Functions that act inside a class take the class already loaded (and
// ownership-checked) by `getClass`, so they don't look it up again.

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  classGroups,
  courseStudents,
  scores,
  standards,
  taskGroups,
  taskStandards,
  tasks,
  termGrades,
  terms,
  units,
} from "@/db/schema";
import { adaptedTaskFolder, isFileIn } from "@/lib/attachments";
import { suggestTermGrade, type Suggestion } from "@/lib/grading";
import { groupTaskDate, isAssessed } from "@/lib/groups";
import type { ScoreRow, ScoreStatus } from "@/lib/scoresForm";
import type { TaskEdit, TaskInput } from "@/lib/validation";
import { getClass, listClassStudents, type ClassDetail, type RosterStudent } from "./classDetail";
import { assessedSql, getStudentGroups, getTaskGroups, type TaskGroup } from "./groups";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

type NotFound = { ok: false; error: "notFound" };
const notFound: NotFound = { ok: false, error: "notFound" };

/**
 * TASK-2, GROUP-3: the class, if it is this teacher's and the cuatrimestre,
 * unit, standards and groups are all its own; and the standard ids and
 * groups without repeats.
 */
async function checkTaskInput(
  db: Db,
  teacherId: string,
  input: TaskInput,
): Promise<{ cls: ClassDetail; standardIds: string[]; groups: { groupId: string; dueOn: string | null }[] } | null> {
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return null;

  // Checked in parallel: one round trip's wait instead of three.
  const standardIds = [...new Set(input.standardIds)];
  const groups = [...new Map((input.groups ?? []).map((g) => [g.groupId, g])).values()];
  const [term, unit, ownStandards, ownGroups] = await Promise.all([
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
          // ADAPT-2: only the class's own standards, never a student's.
          .where(and(inArray(standards.id, standardIds), eq(standards.classId, cls.id), isNull(standards.studentId)))
      : Promise.resolve([]),
    groups.length > 0
      ? db
          .select({ id: classGroups.id })
          .from(classGroups)
          .where(and(inArray(classGroups.id, groups.map((g) => g.groupId)), eq(classGroups.classId, cls.id)))
      : Promise.resolve([]),
  ]);
  if (term.length === 0 || unit.length === 0 || ownStandards.length !== standardIds.length) return null;
  if (ownGroups.length !== groups.length) return null;
  return { cls, standardIds, groups };
}

/** TASK-1, TASK-2 */
export async function createTask(
  db: Db,
  teacherId: string,
  input: TaskInput,
): Promise<{ ok: true; taskId: string } | NotFound> {
  const checked = await checkTaskInput(db, teacherId, input);
  if (!checked) return notFound;
  const { cls, standardIds, groups } = checked;

  const taskId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tasks)
      .values({
        teacherId,
        classId: cls.id,
        termId: input.termId,
        unitId: input.unitId,
        title: input.title,
        dueOn: groupTaskDate(groups, input.dueOn),
        description: input.description,
        criteria: input.criteria,
        adaptedDescription: input.adaptedDescription ?? null,
        adaptedCriteria: input.adaptedCriteria ?? null,
      })
      .returning({ id: tasks.id });
    if (standardIds.length > 0) {
      await tx
        .insert(taskStandards)
        .values(standardIds.map((standardId) => ({ teacherId, taskId: created.id, standardId })));
    }
    if (groups.length > 0) {
      await tx.insert(taskGroups).values(groups.map((g) => ({ teacherId, taskId: created.id, ...g })));
    }
    return created.id;
  });
  return { ok: true, taskId };
}

/**
 * TASK-6. Checked like TASK-2; then, in one transaction, the task is updated
 * (only if it is this class's) and its standard links and groups replaced. Scores and the
 * attached file are not touched.
 */
export async function updateTask(db: Db, teacherId: string, input: TaskEdit): Promise<{ ok: true } | NotFound> {
  const checked = await checkTaskInput(db, teacherId, input);
  if (!checked) return notFound;
  const { cls, standardIds, groups } = checked;

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(tasks)
      .set({
        termId: input.termId,
        unitId: input.unitId,
        title: input.title,
        dueOn: groupTaskDate(groups, input.dueOn),
        description: input.description,
        criteria: input.criteria,
        // ADAPT-3: left out of the form when the class has no adapted students; then kept.
        ...(input.adaptedDescription !== undefined && { adaptedDescription: input.adaptedDescription }),
        ...(input.adaptedCriteria !== undefined && { adaptedCriteria: input.adaptedCriteria }),
      })
      .where(and(eq(tasks.id, input.taskId), eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId)))
      .returning({ id: tasks.id });
    if (updated.length === 0) return notFound;
    await tx.delete(taskStandards).where(eq(taskStandards.taskId, input.taskId));
    if (standardIds.length > 0) {
      await tx
        .insert(taskStandards)
        .values(standardIds.map((standardId) => ({ teacherId, taskId: input.taskId, standardId })));
    }
    await tx.delete(taskGroups).where(eq(taskGroups.taskId, input.taskId));
    if (groups.length > 0) {
      await tx.insert(taskGroups).values(groups.map((g) => ({ teacherId, taskId: input.taskId, ...g })));
    }
    return { ok: true } as const;
  });
}

export type TaskRow = {
  id: string;
  title: string;
  termId: string;
  termPosition: number;
  unitTitle: string | null;
  dueOn: string | null;
  description: string | null;
  /** Assessed students (GROUP-3) with a score or a mark on this task. */
  scored: number;
  /** GROUP-5: active students assessed on it. */
  assessed: number;
  /** An attached file (FILE-1). */
  hasFile: boolean;
  /** GROUP-3: the groups it is for, each with its date; empty when it is for everyone. */
  groups: TaskGroup[];
};

/** TASK-3, GROUP-5 */
export async function listTasks(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id" | "courseId">,
): Promise<TaskRow[]> {
  const rows = await db
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
          and ${assessedSql(tasks.id, scores.studentId)}
      )`,
      assessed: sql<number>`(
        select count(*)::int from course_students cs
        where cs.course_id = ${cls.courseId} and cs.status = 'active'
          and ${assessedSql(tasks.id, sql`cs.student_id`)}
      )`,
      hasFile: sql<boolean>`${tasks.attachmentPath} is not null`,
    })
    .from(tasks)
    .innerJoin(terms, eq(tasks.termId, terms.id))
    .leftJoin(units, eq(tasks.unitId, units.id))
    .where(and(eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId)))
    .orderBy(asc(terms.position), sql`${tasks.dueOn} asc nulls last`, asc(tasks.createdAt));
  const groups = await getTaskGroups(db, teacherId, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, groups: groups.get(r.id) ?? [] }));
}

export type TaskDetail = Omit<TaskRow, "scored" | "assessed" | "hasFile"> & {
  unitId: string | null;
  criteria: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  /** ADAPT-3: the adapted version. */
  adaptedDescription: string | null;
  adaptedCriteria: string | null;
  adaptedAttachmentPath: string | null;
  adaptedAttachmentName: string | null;
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
  const [[row], linked, groups] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        termId: tasks.termId,
        termPosition: terms.position,
        unitId: tasks.unitId,
        unitTitle: units.title,
        dueOn: tasks.dueOn,
        description: tasks.description,
        criteria: tasks.criteria,
        attachmentPath: tasks.attachmentPath,
        attachmentName: tasks.attachmentName,
        adaptedDescription: tasks.adaptedDescription,
        adaptedCriteria: tasks.adaptedCriteria,
        adaptedAttachmentPath: tasks.adaptedAttachmentPath,
        adaptedAttachmentName: tasks.adaptedAttachmentName,
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
    getTaskGroups(db, teacherId, [taskId]),
  ]);
  if (!row) return null;
  return { ...row, standards: linked, groups: groups.get(taskId) ?? [] };
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
  if (file && !isFileIn(file.path, teacherId, taskId)) return notFound;
  const where = and(eq(tasks.id, taskId), eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId));
  const [current] = await db.select({ path: tasks.attachmentPath }).from(tasks).where(where);
  if (!current) return notFound;
  await db
    .update(tasks)
    .set({ attachmentPath: file?.path ?? null, attachmentName: file?.name.slice(0, 200) ?? null })
    .where(where);
  return { ok: true, previousPath: current.path };
}

/**
 * ADAPT-3 (as FILE-2, FILE-3): record the task's adapted file, kept in its
 * `adapted/` folder, or clear it with null. Returns the path it had before.
 */
export async function setTaskAdaptedAttachment(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id">,
  taskId: string,
  file: { path: string; name: string } | null,
): Promise<{ ok: true; previousPath: string | null } | NotFound> {
  if (!isUuid(taskId)) return notFound;
  if (file && !isFileIn(file.path, teacherId, adaptedTaskFolder(taskId))) return notFound;
  const where = and(eq(tasks.id, taskId), eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId));
  const [current] = await db.select({ path: tasks.adaptedAttachmentPath }).from(tasks).where(where);
  if (!current) return notFound;
  await db
    .update(tasks)
    .set({ adaptedAttachmentPath: file?.path ?? null, adaptedAttachmentName: file?.name.slice(0, 200) ?? null })
    .where(where);
  return { ok: true, previousPath: current.path };
}

/**
 * TASK-5. Scores and standard links go with it (ON DELETE CASCADE). Returns
 * its files' paths (FILE-1, ADAPT-3), for the caller to delete from Storage.
 */
export async function deleteTask(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id">,
  taskId: string,
): Promise<{ ok: true; attachmentPath: string | null; adaptedAttachmentPath: string | null } | NotFound> {
  if (!isUuid(taskId)) return notFound;
  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.classId, cls.id), eq(tasks.teacherId, teacherId)))
    .returning({ attachmentPath: tasks.attachmentPath, adaptedAttachmentPath: tasks.adaptedAttachmentPath });
  return deleted
    ? { ok: true, attachmentPath: deleted.attachmentPath, adaptedAttachmentPath: deleted.adaptedAttachmentPath }
    : notFound;
}

/** The saved scores of one task. */
export async function listTaskScores(db: Db, teacherId: string, taskId: string): Promise<ScoreRow[]> {
  if (!isUuid(taskId)) return [];
  return db
    .select({
      studentId: scores.studentId,
      status: scores.status,
      value: scores.value,
      notes: scores.notes,
      adapted: scores.adapted,
    })
    .from(scores)
    .where(and(eq(scores.taskId, taskId), eq(scores.teacherId, teacherId)));
}

/**
 * SCORE-1..4, GROUP-4. Saves all rows or none. Students who aren't active in
 * the class's course, or aren't assessed on the task, are skipped, whatever
 * the form sent.
 */
export async function saveScores(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id" | "courseId">,
  taskId: string,
  entries: { save: ScoreRow[]; clear: string[] },
): Promise<{ ok: true } | NotFound> {
  if (!isUuid(taskId)) return notFound;
  const [[task], roster, taskGroupMap, studentGroups] = await Promise.all([
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
    getTaskGroups(db, teacherId, [taskId]),
    getStudentGroups(db, teacherId, cls.id),
  ]);
  if (!task) return notFound;

  const groupIds = (taskGroupMap.get(taskId) ?? []).map((g) => g.groupId);
  const inCourse = new Set(roster.map((r) => r.id).filter((id) => isAssessed(groupIds, studentGroups.get(id))));
  const save = entries.save.filter((r) => inCourse.has(r.studentId));
  const clear = entries.clear.filter((id) => inCourse.has(id));

  await db.transaction(async (tx) => {
    if (clear.length > 0) {
      await tx.delete(scores).where(and(eq(scores.taskId, taskId), inArray(scores.studentId, clear)));
    }
    if (save.length > 0) {
      await tx
        .insert(scores)
        .values(save.map((r) => ({ teacherId, taskId, ...r, adapted: r.adapted ?? false })))
        .onConflictDoUpdate({
          target: [scores.taskId, scores.studentId],
          set: {
            status: sql`excluded.status`,
            value: sql`excluded.value`,
            notes: sql`excluded.notes`,
            adapted: sql`excluded.adapted`,
            gradedAt: sql`now()`,
          },
        });
    }
  });
  return { ok: true };
}

/** A score or mark, nothing yet (null), or a task the student isn't assessed on (GROUP-5). */
export type ScoreCell = { status: ScoreStatus; value: number | null; adapted: boolean };
export type GradebookCell = ScoreCell | null | "notAssessed";
export type GradebookRow = {
  student: RosterStudent;
  cells: GradebookCell[];
  suggestion: Suggestion;
  /** TERM-7: the grade set for this cuatrimestre, if any. */
  termGrade: number | null;
};
export type Gradebook = { tasks: TaskRow[]; rows: GradebookRow[] };

/**
 * BOOK-1, BOOK-2, TERM-7, GROUP-5, GROUP-6: one cuatrimestre of a class, or of
 * one of its groups: that group's students, and the tasks for everyone or for it.
 */
export async function getGradebook(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id" | "courseId">,
  termId: string,
  groupId?: string,
): Promise<Gradebook> {
  if (!isUuid(termId)) return { tasks: [], rows: [] };
  const [allTasks, roster, saved, grades, studentGroups] = await Promise.all([
    listTasks(db, teacherId, cls),
    listClassStudents(db, teacherId, cls),
    db
      .select({
        taskId: scores.taskId,
        studentId: scores.studentId,
        status: scores.status,
        value: scores.value,
        adapted: scores.adapted,
      })
      .from(scores)
      .innerJoin(tasks, eq(scores.taskId, tasks.id))
      .where(and(eq(tasks.classId, cls.id), eq(tasks.termId, termId), eq(scores.teacherId, teacherId))),
    db
      .select({ studentId: termGrades.studentId, value: termGrades.value })
      .from(termGrades)
      .where(
        and(eq(termGrades.classId, cls.id), eq(termGrades.termId, termId), eq(termGrades.teacherId, teacherId)),
      ),
    getStudentGroups(db, teacherId, cls.id),
  ]);
  const groupIdsOf = (t: TaskRow) => t.groups.map((g) => g.groupId);
  const termTasks = allTasks
    .filter((t) => t.termId === termId)
    .filter((t) => !groupId || isAssessed(groupIdsOf(t), groupId));
  const students = groupId ? roster.filter((s) => studentGroups.get(s.id) === groupId) : roster;
  const byKey = new Map(saved.map((s) => [`${s.studentId}:${s.taskId}`, s]));

  const rows = students.map((student) => {
    const cells: GradebookCell[] = termTasks.map((t) => {
      if (!isAssessed(groupIdsOf(t), studentGroups.get(student.id))) return "notAssessed";
      const s = byKey.get(`${student.id}:${t.id}`);
      return s ? { status: s.status, value: s.value, adapted: s.adapted } : null;
    });
    const suggestion = suggestTermGrade(
      cells.filter((c): c is ScoreCell => c !== null && c !== "notAssessed"),
    );
    const termGrade = grades.find((g) => g.studentId === student.id)?.value ?? null;
    return { student, cells, suggestion, termGrade };
  });
  return { tasks: termTasks, rows };
}
