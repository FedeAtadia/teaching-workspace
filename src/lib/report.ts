// REPORT-1..4: what a student's report says. Pure: it lays out what the
// history query (HISTORY) already gathered, so the rules are tested without
// a database and the page only draws it.

import type { HistoryClass, HistoryCourse, HistoryTask, StudentHistory } from "@/db/queries/history";

export type ReportOptions = {
  /** The course to report on; the one the student is in now when left out. */
  courseId?: string;
  /** REPORT-3: list every task with its score. */
  tasks: boolean;
  /** REPORT-3: say what is adapted for the student. Off unless asked for. */
  adaptations: boolean;
};

export type ReportTerm = {
  position: number;
  /** SUGGEST-1: the average of what was scored; null with nothing scored. */
  average: number | null;
  /** SUGGEST-2 */
  missing: number;
  /** TERM-7: the grade the teacher set, if any. */
  grade: number | null;
  /** ATT-4 */
  attendance: number | null;
  /** REPORT-3: empty unless the tasks were asked for. */
  tasks: HistoryTask[];
};

export type ReportClass = Pick<HistoryClass, "id" | "name" | "passMark" | "finalGrade" | "result" | "exams"> & {
  terms: ReportTerm[];
  /** REPORT-3: null unless adaptations were asked for and there is one. */
  adaptation: string | null;
};

export type ReportOwed = { name: string; schoolYear: string; year: number; division: string };

export type Report = {
  student: StudentHistory["student"];
  course: Omit<HistoryCourse, "classes">;
  classes: ReportClass[];
  /** REPORT-2: classes still owed from the student's other courses. */
  owedElsewhere: ReportOwed[];
  /** REPORT-4: every course the student has, for choosing another one. */
  courses: Omit<HistoryCourse, "classes">[];
};

/** Options as they arrive in the address: `?course=…&tasks=1&adaptations=1`. */
export function reportOptions(params: Record<string, string | string[] | undefined>): ReportOptions {
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return { courseId: one(params.course), tasks: one(params.tasks) === "1", adaptations: one(params.adaptations) === "1" };
}

const withoutClasses = (course: HistoryCourse): Omit<HistoryCourse, "classes"> => ({
  courseId: course.courseId,
  schoolYear: course.schoolYear,
  school: course.school,
  year: course.year,
  division: course.division,
  shift: course.shift,
  status: course.status,
  outcome: course.outcome,
});

/**
 * REPORT-1..4: the report on one of the student's courses, or null when the
 * student is in no course. An unknown course falls back to the current one:
 * the course they are active in, newest first (HISTORY-1).
 */
export function buildReport(history: StudentHistory, options: ReportOptions): Report | null {
  const { courses } = history;
  const course =
    courses.find((c) => c.courseId === options.courseId) ?? courses.find((c) => c.status === "active") ?? courses[0];
  if (!course) return null;

  return {
    student: history.student,
    course: withoutClasses(course),
    classes: course.classes.map((c) => ({
      id: c.id,
      name: c.name,
      passMark: c.passMark,
      finalGrade: c.finalGrade,
      result: c.result,
      exams: c.exams,
      adaptation: options.adaptations ? c.adaptation : null,
      terms: c.terms.map((t) => ({
        position: t.position,
        average: t.suggestion.average,
        missing: t.suggestion.missing,
        grade: t.grade,
        attendance: t.attendance,
        tasks: options.tasks ? t.tasks : [],
      })),
    })),
    owedElsewhere: courses
      .filter((c) => c.courseId !== course.courseId)
      .flatMap((c) =>
        c.classes
          .filter((k) => k.result.kind === "owed")
          .map((k) => ({ name: k.name, schoolYear: c.schoolYear, year: c.year, division: c.division })),
      ),
    courses: courses.map(withoutClasses),
  };
}
