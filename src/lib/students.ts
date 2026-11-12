// STUDENT-5, STUDENT-6: which students the Students list shows.
// Pure, so the rule is tested without a database.

import { compareCourses, type Shift } from "./courses";
import type { YearOutcome } from "./yearEnd";

/** A course the student is active in. */
export type StudentCourse = {
  id: string;
  year: number;
  division: string;
  shift: Shift;
  schoolYear: string;
  school: string;
  outcome: YearOutcome | null;
  /** KEEP-1: the day the outcome was set. */
  outcomeOn: string | null;
};
export type ListedStudent = { id: string; firstName: string; lastName: string; courses: StudentCourse[] };

export const STUDENT_VIEWS = ["current", "graduates", "all"] as const;
export type StudentView = (typeof STUDENT_VIEWS)[number];

/** Anything but a known view is the default one. */
export function resolveView(value: string | undefined): StudentView {
  return (STUDENT_VIEWS as readonly string[]).includes(value ?? "") ? (value as StudentView) : "current";
}

/** The newest course the student is active in (COURSE-3 puts it first). */
export function newestCourse(student: Pick<ListedStudent, "courses">): StudentCourse | undefined {
  return [...student.courses].sort(compareCourses)[0];
}

/** YEAR-2: the student graduated from their newest course. */
export function isGraduate(student: Pick<ListedStudent, "courses">): boolean {
  return newestCourse(student)?.outcome === "graduated";
}

/**
 * STUDENT-5: a graduate who owes nothing is out of the working list. One who
 * still owes a class (EXAM-3) stays in it until they pass it.
 */
export function isFormer(student: ListedStudent, owing: ReadonlySet<string>): boolean {
  return isGraduate(student) && !owing.has(student.id);
}

/** STUDENT-5, STUDENT-6: the students of a view, and of one course when one is chosen. */
export function filterStudents<T extends ListedStudent>(
  students: T[],
  filter: { view: StudentView; courseId?: string },
  owing: ReadonlySet<string>,
): T[] {
  return students.filter((s) => {
    if (filter.courseId && !s.courses.some((c) => c.id === filter.courseId)) return false;
    if (filter.view === "all") return true;
    return isFormer(s, owing) === (filter.view === "graduates");
  });
}
