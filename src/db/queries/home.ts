// The home page's figures and class cards (HOME-1..3, EXAM-4). Scoped to one
// teacher (OWNER-1). Five queries, all at once: about one round trip's wait
// (the owed classes take two).

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { classes, courseStudents, scores, tasks } from "@/db/schema";
import { progress } from "@/lib/courses";
import { listClasses, type ClassRow } from "./classes";
import { assessedSql } from "./groups";
import { listOwed } from "./yearEnd";

export type HomeCard = ClassRow & {
  tasks: number;
  /** GROUP-5: over all tasks, the active students assessed on each. */
  expected: number;
  /** Scores and marks saved for active students (HOME-2). */
  scored: number;
  progress: number;
  /** HOME-3: null when every active student has something on every task. */
  next: { title: string; dueOn: string | null } | null;
};

export type Home = {
  /** `owed`: classes students still owe (EXAM-4). */
  stats: { classes: number; students: number; pending: number; owed: number };
  cards: HomeCard[];
};

export async function getHomeCards(db: Db, teacherId: string): Promise<Home> {
  const [classRows, taskRows, scoredRows, [{ students }], owedClasses] = await Promise.all([
    listClasses(db, teacherId),
    db
      .select({
        id: tasks.id,
        classId: tasks.classId,
        title: tasks.title,
        dueOn: tasks.dueOn,
        // GROUP-5: the class's active students assessed on it.
        assessed: sql<number>`(
          select count(*)::int from course_students cs
          where cs.course_id = ${classes.courseId} and cs.status = 'active'
            and ${assessedSql(tasks.id, sql`cs.student_id`)}
        )`,
      })
      .from(tasks)
      .innerJoin(classes, eq(tasks.classId, classes.id))
      .where(eq(tasks.teacherId, teacherId))
      // HOME-3: dated tasks in date order, undated ones after them.
      .orderBy(sql`${tasks.dueOn} asc nulls last`, asc(tasks.createdAt)),
    // Per task, how many of the class's ACTIVE, ASSESSED students have a score or a mark.
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
        and(
          eq(scores.teacherId, teacherId),
          sql`(${scores.value} is not null or ${scores.status} <> 'graded')`,
          assessedSql(scores.taskId, scores.studentId),
        ),
      )
      .groupBy(scores.taskId),
    // A student in two courses counts once.
    db
      .select({ students: sql<number>`count(distinct ${courseStudents.studentId})::int` })
      .from(courseStudents)
      .where(and(eq(courseStudents.teacherId, teacherId), eq(courseStudents.status, "active"))),
    listOwed(db, teacherId),
  ]);
  const owed = owedClasses.reduce((n, c) => n + c.students.length, 0);

  const scoredByTask = new Map(scoredRows.map((r) => [r.taskId, r.n]));
  let pending = 0;
  const cards = classRows.map((c): HomeCard => {
    const own = taskRows.filter((t) => t.classId === c.id);
    const scored = own.reduce((n, t) => n + (scoredByTask.get(t.id) ?? 0), 0);
    const expected = own.reduce((n, t) => n + t.assessed, 0);
    pending += Math.max(0, expected - scored);
    const nextTask = own.find((t) => (scoredByTask.get(t.id) ?? 0) < t.assessed);
    return {
      ...c,
      tasks: own.length,
      expected,
      scored,
      // HOME-2 over assessed students: `expected` already counts tasks × students.
      progress: progress(scored, 1, expected),
      next: nextTask ? { title: nextTask.title, dueOn: nextTask.dueOn } : null,
    };
  });

  return { stats: { classes: classRows.length, students, pending, owed }, cards };
}
