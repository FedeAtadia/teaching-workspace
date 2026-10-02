// Closing the school year (YEAR-1, YEAR-2). Pure: no database, no React.

export type YearOutcome = "promoted" | "repeats" | "graduated";
export const YEAR_OUTCOMES: readonly YearOutcome[] = ["promoted", "repeats", "graduated"];

export type ExamStatus = "graded" | "absent";
export type ExamForResult = { takenOn: string; status: ExamStatus; value: number | null };

export type ClassResult =
  | { kind: "pending" }
  | { kind: "passed"; grade: number }
  | { kind: "passedByExam"; grade: number; exam: { takenOn: string; value: number } }
  | { kind: "owed"; grade: number };

/**
 * YEAR-1. `finalGrade` is the 2° cuatrimestre grade (TERM-7). The earliest
 * exam at or above the pass mark passes the class.
 */
export function classResult(finalGrade: number | null, exams: ExamForResult[], passMark: number): ClassResult {
  if (finalGrade === null) return { kind: "pending" };
  if (finalGrade >= passMark) return { kind: "passed", grade: finalGrade };
  const passing = exams
    .filter((e) => e.status === "graded" && e.value !== null && e.value >= passMark)
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn))[0];
  return passing
    ? { kind: "passedByExam", grade: finalGrade, exam: { takenOn: passing.takenOn, value: passing.value! } }
    : { kind: "owed", grade: finalGrade };
}

/** YEAR-2: 6° ends school; the years below move up or repeat. */
export function allowedOutcomes(courseYear: number): YearOutcome[] {
  return courseYear >= 6 ? ["graduated"] : ["promoted", "repeats"];
}
