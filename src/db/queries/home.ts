// The home page's figures and class cards (HOME-1..3). Scoped to one teacher
// (OWNER-1). Four queries, all at once: one round trip's wait.

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { classes, courseStudents, scores, tasks } from "@/db/schema";
import { progress } from "@/lib/courses";
import { listClasses, type ClassRow } from "./classes";

export type HomeCard = ClassRow & {
  tasks: number;
  /** Scores and marks saved for active students (HOME-2). */
  scored: number;
  progress: number;
  /** HOME-3: null when every active student has something on every task. */
  next: { title: string; dueOn: string | null } | null;
};

export type Home = {
  stats: { classes: number; students: number; pending: number };
  cards: HomeCard[];
};

export async function getHomeCards(db: Db, teacherId: string): Promise<Home> {
  const [classRows, taskRows, scoredRows, [{ students }]] = await Promise.all([
    listClasses(db, teacherId),
    db
      .select({ id: tasks.id, classId: tasks.classId, title: tasks.title, dueOn: tasks.dueOn })
      .from(tasks)
      .where(eq(tasks.teacherId, teacherId))
      // HOME-3: dated tasks in date order, undated ones after them.
      .orderBy(sql`${tasks.dueOn} asc nulls last`, asc(tasks.createdAt)),
    // Per task, how many of the class's ACTIVE students have a score or a mark.
    db
      .select({ taskId: scores.taskId, n: sql<number>`count(*)::int` })
      .from(scores)
      .innerJoin(tasks, eq(scores.taskId, tasks.id))
      .innerJoin(classes, eq(tasks.classId, classes.id))
      .innerJoin(
        courseStudents,
        and(
          eq(courseStudents.courseId, classes.courseId),
          eq(courseStudents.studentId, scores.studentId),
          eq(courseStudents.status, "active"),
        ),
      )
      .where(
        and(eq(scores.teacherId, teacherId), sql`(${scores.value} is not null or ${scores.status} <> 'graded')`),
      )
      .groupBy(scores.taskId),
    // A student in two courses counts once.
    db
      .select({ students: sql<number>`count(distinct ${courseStudents.studentId})::int` })
      .from(courseStudents)
      .where(and(eq(courseStudents.teacherId, teacherId), eq(courseStudents.status, "active"))),
  ]);

  const scoredByTask = new Map(scoredRows.map((r) => [r.taskId, r.n]));
  let pending = 0;
  const cards = classRows.map((c): HomeCard => {
    const own = taskRows.filter((t) => t.classId === c.id);
    const scored = own.reduce((n, t) => n + (scoredByTask.get(t.id) ?? 0), 0);
    pending += Math.max(0, own.length * c.students - scored);
    const nextTask = c.students > 0 ? own.find((t) => (scoredByTask.get(t.id) ?? 0) < c.students) : undefined;
    return {
      ...c,
      tasks: own.length,
      scored,
      progress: progress(scored, own.length, c.students),
      next: nextTask ? { title: nextTask.title, dueOn: nextTask.dueOn } : null,
    };
  });

  return { stats: { classes: classRows.length, students, pending }, cards };
}
