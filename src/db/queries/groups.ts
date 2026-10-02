// Groups within a class (GROUP-1..3). Scoped to one teacher (OWNER-1).

import { and, asc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { classGroupStudents, classGroups, classes, courseStudents, taskGroups } from "@/db/schema";
import type { GroupEdit, GroupInput } from "@/lib/validation";
import { getClass, type ClassDetail } from "./classDetail";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

type NotFound = { ok: false; error: "notFound" };
const notFound: NotFound = { ok: false, error: "notFound" };
const duplicate = { ok: false, error: "duplicate" } as const;

/**
 * GROUP-3, as SQL, for counts done in the database: the student is assessed
 * on the task when it lists no groups, or lists theirs. Same rule as
 * `isAssessed` in src/lib/groups.ts. Pass fully qualified columns.
 */
export function assessedSql(taskId: SQL | unknown, studentId: SQL | unknown): SQL {
  return sql`(
    not exists (select 1 from task_groups tg where tg.task_id = ${taskId})
    or exists (
      select 1 from task_groups tg
      join class_group_students m on m.group_id = tg.group_id
      where tg.task_id = ${taskId} and m.student_id = ${studentId}
    )
  )`;
}

export type GroupRow = {
  id: string;
  name: string;
  days: string | null;
  /** Active students of the course in it. */
  students: number;
  /** Tasks only for this group: they become for everyone if it is deleted (GROUP-1). */
  onlyTasks: number;
};

/** GROUP-1, in the order added. */
export async function listGroups(db: Db, teacherId: string, classId: string): Promise<GroupRow[]> {
  if (!isUuid(classId)) return [];
  const groups = await db
    .select({ id: classGroups.id, name: classGroups.name, days: classGroups.days })
    .from(classGroups)
    .where(and(eq(classGroups.classId, classId), eq(classGroups.teacherId, teacherId)))
    .orderBy(asc(classGroups.position), asc(classGroups.createdAt));
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g.id);
  const [members, links] = await Promise.all([
    db
      .select({ groupId: classGroupStudents.groupId, studentId: classGroupStudents.studentId })
      .from(classGroupStudents)
      .innerJoin(classes, eq(classGroupStudents.classId, classes.id))
      .innerJoin(
        courseStudents,
        and(
          eq(courseStudents.courseId, classes.courseId),
          eq(courseStudents.studentId, classGroupStudents.studentId),
          eq(courseStudents.status, "active"),
        ),
      )
      .where(and(inArray(classGroupStudents.groupId, ids), eq(classGroupStudents.teacherId, teacherId))),
    db
      .select({ taskId: taskGroups.taskId, groupId: taskGroups.groupId })
      .from(taskGroups)
      .where(inArray(taskGroups.groupId, ids)),
  ]);
  const groupsPerTask = new Map<string, number>();
  for (const l of links) groupsPerTask.set(l.taskId, (groupsPerTask.get(l.taskId) ?? 0) + 1);
  return groups.map((g) => ({
    ...g,
    students: new Set(members.filter((m) => m.groupId === g.id).map((m) => m.studentId)).size,
    onlyTasks: links.filter((l) => l.groupId === g.id && groupsPerTask.get(l.taskId) === 1).length,
  }));
}

/** Another group of the class with that name, ignoring case (GROUP-1). */
async function nameTaken(db: Db, classId: string, name: string, except?: string): Promise<boolean> {
  const rows = await db
    .select({ id: classGroups.id })
    .from(classGroups)
    .where(
      and(
        eq(classGroups.classId, classId),
        sql`lower(${classGroups.name}) = lower(${name})`,
        except ? ne(classGroups.id, except) : undefined,
      ),
    );
  return rows.length > 0;
}

/** GROUP-1 */
export async function createGroup(
  db: Db,
  teacherId: string,
  input: GroupInput,
): Promise<{ ok: true; groupId: string } | NotFound | typeof duplicate> {
  if (!(await getClass(db, teacherId, input.classId))) return notFound;
  if (await nameTaken(db, input.classId, input.name)) return duplicate;
  const [created] = await db
    .insert(classGroups)
    .values({
      teacherId,
      classId: input.classId,
      name: input.name,
      days: input.days,
      position: sql`(select coalesce(max(g.position), 0) + 1 from ${classGroups} g where g.class_id = ${input.classId})`,
    })
    .returning({ id: classGroups.id });
  return { ok: true, groupId: created.id };
}

const ownGroup = (teacherId: string, classId: string, groupId: string) =>
  and(eq(classGroups.id, groupId), eq(classGroups.classId, classId), eq(classGroups.teacherId, teacherId));

/** GROUP-1 */
export async function updateGroup(
  db: Db,
  teacherId: string,
  input: GroupEdit,
): Promise<{ ok: true } | NotFound | typeof duplicate> {
  const [group] = await db
    .select({ id: classGroups.id })
    .from(classGroups)
    .where(ownGroup(teacherId, input.classId, input.groupId));
  if (!group) return notFound;
  if (await nameTaken(db, input.classId, input.name, input.groupId)) return duplicate;
  await db
    .update(classGroups)
    .set({ name: input.name, days: input.days })
    .where(ownGroup(teacherId, input.classId, input.groupId));
  return { ok: true };
}

/**
 * GROUP-1. Its members and task dates go with it (ON DELETE CASCADE): its
 * students have no group, and a task that was only for it is for everyone.
 */
export async function deleteGroup(
  db: Db,
  teacherId: string,
  input: { classId: string; groupId: string },
): Promise<{ ok: true } | NotFound> {
  if (!isUuid(input.classId) || !isUuid(input.groupId)) return notFound;
  const deleted = await db
    .delete(classGroups)
    .where(ownGroup(teacherId, input.classId, input.groupId))
    .returning({ id: classGroups.id });
  return deleted.length > 0 ? { ok: true } : notFound;
}

/** GROUP-2: put an active student of the course in one of the class's groups, or in none. */
export async function setStudentGroup(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id" | "courseId">,
  input: { studentId: string; groupId: string | null },
): Promise<{ ok: true } | NotFound> {
  if (!isUuid(input.studentId)) return notFound;
  const [[member], group] = await Promise.all([
    db
      .select({ id: courseStudents.studentId })
      .from(courseStudents)
      .where(
        and(
          eq(courseStudents.courseId, cls.courseId),
          eq(courseStudents.studentId, input.studentId),
          eq(courseStudents.teacherId, teacherId),
          eq(courseStudents.status, "active"),
        ),
      ),
    input.groupId
      ? db.select({ id: classGroups.id }).from(classGroups).where(ownGroup(teacherId, cls.id, input.groupId))
      : Promise.resolve([{ id: null }]),
  ]);
  if (!member || group.length === 0) return notFound;

  if (input.groupId === null) {
    await db
      .delete(classGroupStudents)
      .where(and(eq(classGroupStudents.classId, cls.id), eq(classGroupStudents.studentId, input.studentId)));
  } else {
    await db
      .insert(classGroupStudents)
      .values({ teacherId, classId: cls.id, studentId: input.studentId, groupId: input.groupId })
      .onConflictDoUpdate({
        target: [classGroupStudents.classId, classGroupStudents.studentId],
        set: { groupId: input.groupId },
      });
  }
  return { ok: true };
}

/** GROUP-2: each grouped student's group in the class. */
export async function getStudentGroups(db: Db, teacherId: string, classId: string): Promise<Map<string, string>> {
  if (!isUuid(classId)) return new Map();
  const rows = await db
    .select({ studentId: classGroupStudents.studentId, groupId: classGroupStudents.groupId })
    .from(classGroupStudents)
    .where(and(eq(classGroupStudents.classId, classId), eq(classGroupStudents.teacherId, teacherId)));
  return new Map(rows.map((r) => [r.studentId, r.groupId]));
}

export type TaskGroup = { groupId: string; name: string; dueOn: string | null };

/** GROUP-3: the groups each task of these is for, in the groups' order. Tasks for everyone are absent. */
export async function getTaskGroups(db: Db, teacherId: string, taskIds: string[]): Promise<Map<string, TaskGroup[]>> {
  if (taskIds.length === 0) return new Map();
  const rows = await db
    .select({ taskId: taskGroups.taskId, groupId: taskGroups.groupId, name: classGroups.name, dueOn: taskGroups.dueOn })
    .from(taskGroups)
    .innerJoin(classGroups, eq(taskGroups.groupId, classGroups.id))
    .where(and(inArray(taskGroups.taskId, taskIds), eq(taskGroups.teacherId, teacherId)))
    .orderBy(asc(classGroups.position), asc(classGroups.createdAt));
  const byTask = new Map<string, TaskGroup[]>();
  for (const { taskId, ...g } of rows) byTask.set(taskId, [...(byTask.get(taskId) ?? []), g]);
  return byTask;
}
