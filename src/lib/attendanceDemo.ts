/** The marks of the home page's drawn attendance (LAND-7), in the app's P, A, T, J order. */
export const DEMO_MARKS = ["present", "absent", "late", "excused"] as const;
export type DemoMark = (typeof DEMO_MARKS)[number];

/** The made-up class on the drawn phone. */
export const DEMO_STUDENTS = ["Álvarez, Zoe", "Benítez, Juan", "Castro, Valentina", "Díaz, Martina", "Gómez, Lucía"];

/** Where the animation leaves the class, and where the visitor takes over: Benítez absent, Díaz late. */
export const DEMO_START: DemoMark[] = ["present", "absent", "present", "late", "present"];

/** The totals under the list: each mark someone has, with how many, in P, A, T, J order. */
export function demoTotals(marks: DemoMark[]): { mark: DemoMark; count: number }[] {
  return DEMO_MARKS.map((mark) => ({ mark, count: marks.filter((m) => m === mark).length })).filter((t) => t.count > 0);
}
