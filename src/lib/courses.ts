// Courses (cursos) and how they are written and ordered. Pure: no database.

/** CLASS-2: mañana, tarde, vespertino. Labels live in messages/. */
export const SHIFTS = ["morning", "afternoon", "evening"] as const;
export type Shift = (typeof SHIFTS)[number];

/** CLASS-2 */
export const COURSE_YEARS = [1, 2, 3, 4, 5, 6] as const;

/** COURSE-2 */
export function formatCourse(year: number, division: string): string {
  return `${year}° ${division}`;
}

/**
 * HOME-2: saved scores over tasks × students, as a whole percentage. Capped at
 * 100 because students who left keep their scores.
 */
export function progress(scored: number, tasks: number, students: number): number {
  const total = tasks * students;
  if (total === 0) return 0;
  return Math.min(100, Math.round((scored / total) * 100));
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export type CourseSortKey = {
  schoolYear: string;
  school: string;
  year: number;
  division: string;
  shift: Shift;
};

/** COURSE-3 */
export function compareCourses(a: CourseSortKey, b: CourseSortKey): number {
  return (
    collator.compare(b.schoolYear, a.schoolYear) ||
    collator.compare(a.school, b.school) ||
    a.year - b.year ||
    collator.compare(a.division, b.division) ||
    SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift)
  );
}

/** STUDENT-3 */
export function compareStudents(
  a: { firstName: string; lastName: string },
  b: { firstName: string; lastName: string },
): number {
  return collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName);
}
