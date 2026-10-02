// A student's school history (HISTORY-1..3). Scoped to one teacher (OWNER-1).
// Two waves of parallel queries, so the page waits about two round trips.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  academicYears,
  classes,
  courseStudents,
  courses,
  schools,
  scores,
  students,
  tasks,
  termGrades,
  terms,
} from "@/db/schema";
import { compareCourses, type Shift } from "@/lib/courses";
import { DEFAULT_RULES, suggestTermGrade, type Suggestion } from "@/lib/grading";
import type { ScoreStatus } from "@/lib/scoresForm";

export type HistoryTask = {
  id: string;
  title: string;
  dueOn: string | null;
  score: { status: ScoreStatus; value: number | null; notes: string | null } | null;
};
export type HistoryTerm = {
  position: number;
  tasks: HistoryTask[];
  suggestion: Suggestion;
  /** TERM-7: the grade set for this cuatrimestre, if any. */
  grade: number | null;
};
export type HistoryClass = {
  id: string;
  name: string;
  passMark: number;
  terms: HistoryTerm[];
  /** TERM-1, TERM-7: the 2° cuatrimestre grade. */
  finalGrade: number | null;
};
export type HistoryCourse = {
  courseId: string;
  schoolYear: string;
  school: string;
  year: number;
  division: string;
  shift: Shift;
  status: "active" | "withdrawn";
  classes: HistoryClass[];
};
export type StudentHistory = {
  student: { id: string; firstName: string; lastName: string };
  courses: HistoryCourse[];
};

const collator = new Intl.Collator("es", { sensitivity: "base" });

export async function getStudentHistory(
  db: Db,
  teacherId: string,
  studentId: string,
): Promise<StudentHistory | null> {
  if (!z.uuid().safeParse(studentId).success) return null;

  // Wave 1: the student, their courses, all their scores and cuatrimestre grades.
  const [[student], memberships, saved, grades] = await Promise.all([
    db
      .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId))),
    db
      .select({
        courseId: courses.id,
        schoolYear: academicYears.name,
        school: schools.name,
        year: courses.year,
        division: courses.division,
        shift: courses.shift,
        status: courseStudents.status,
      })
      .from(courseStudents)
      .innerJoin(courses, eq(courseStudents.courseId, courses.id))
      .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
      .innerJoin(schools, eq(courses.schoolId, schools.id))
      .where(and(eq(courseStudents.studentId, studentId), eq(courseStudents.teacherId, teacherId))),
    db
      .select({ taskId: scores.taskId, status: scores.status, value: scores.value, notes: scores.notes })
      .from(scores)
      .where(and(eq(scores.studentId, studentId), eq(scores.teacherId, teacherId))),
    db
      .select({ classId: termGrades.classId, position: terms.position, value: termGrades.value })
      .from(termGrades)
      .innerJoin(terms, eq(termGrades.termId, terms.id))
      .where(and(eq(termGrades.studentId, studentId), eq(termGrades.teacherId, teacherId))),
  ]);
  if (!student) return null;
  if (memberships.length === 0) return { student, courses: [] };

  // Wave 2: the classes of those courses, and their tasks.
  const courseIds = memberships.map((m) => m.courseId);
  const [classRows, taskRows] = await Promise.all([
    db
      .select({ id: classes.id, courseId: classes.courseId, name: classes.name, passMark: classes.passMark })
      .from(classes)
      .where(and(inArray(classes.courseId, courseIds), eq(classes.teacherId, teacherId))),
    db
      .select({
        id: tasks.id,
        classId: tasks.classId,
        title: tasks.title,
        dueOn: tasks.dueOn,
        termPosition: terms.position,
      })
      .from(tasks)
      .innerJoin(classes, eq(tasks.classId, classes.id))
      .innerJoin(terms, eq(tasks.termId, terms.id))
      .where(and(inArray(classes.courseId, courseIds), eq(tasks.teacherId, teacherId)))
      // TASK-3
      .orderBy(asc(terms.position), sql`${tasks.dueOn} asc nulls last`, asc(tasks.createdAt)),
  ]);

  const scoreByTask = new Map(saved.map((s) => [s.taskId, s]));

  const buildClass = (c: (typeof classRows)[number]): HistoryClass => {
    const terms = new Map<number, HistoryTask[]>();
    for (const t of taskRows.filter((t) => t.classId === c.id)) {
      const s = scoreByTask.get(t.id);
      const task: HistoryTask = {
        id: t.id,
        title: t.title,
        dueOn: t.dueOn,
        score: s ? { status: s.status, value: s.value, notes: s.notes } : null,
      };
      terms.set(t.termPosition, [...(terms.get(t.termPosition) ?? []), task]);
    }
    // A cuatrimestre with a grade shows even if it has no tasks.
    const classGrades = grades.filter((g) => g.classId === c.id);
    for (const g of classGrades) if (!terms.has(g.position)) terms.set(g.position, []);
    const gradeAt = (position: number) => classGrades.find((g) => g.position === position)?.value ?? null;
    return {
      id: c.id,
      name: c.name,
      passMark: c.passMark ?? DEFAULT_RULES.passMark,
      terms: [...terms.entries()]
        .sort(([a], [b]) => a - b)
        .map(([position, list]) => ({
          position,
          tasks: list,
          suggestion: suggestTermGrade(list.flatMap((t) => (t.score ? [t.score] : []))),
          grade: gradeAt(position),
        })),
      finalGrade: gradeAt(2),
    };
  };

  return {
    student,
    courses: memberships.sort(compareCourses).map((m) => ({
      ...m,
      classes: classRows
        .filter((c) => c.courseId === m.courseId)
        .sort((a, b) => collator.compare(a.name, b.name))
        .map(buildClass),
    })),
  };
}
