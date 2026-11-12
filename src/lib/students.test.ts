import { describe, expect, it } from "vitest";
import { filterStudents, isGraduate, resolveView, type ListedStudent, type StudentCourse } from "./students";

const course = (over: Partial<StudentCourse> = {}): StudentCourse => ({
  id: "c-2026",
  year: 5,
  division: "A",
  shift: "morning",
  schoolYear: "2026",
  school: "EPET 30",
  outcome: null,
  outcomeOn: null,
  ...over,
});
const student = (id: string, courses: StudentCourse[]): ListedStudent => ({ id, firstName: id, lastName: "Pérez", courses });

const ana = student("ana", [course()]);
const promoted = student("promoted", [course({ id: "c-2025", schoolYear: "2025", year: 4, outcome: "promoted" }), course()]);
const graduate = student("graduate", [course({ id: "c-6", year: 6, outcome: "graduated" })]);
const owes = student("owes", [course({ id: "c-6", year: 6, outcome: "graduated" })]);
const noCourse = student("noCourse", []);
const all = [ana, promoted, graduate, owes, noCourse];
const owing = new Set(["owes"]);
const ids = (list: ListedStudent[]) => list.map((s) => s.id);

describe("the Students list (STUDENT-5, STUDENT-6)", () => {
  it("leaves out graduates who owe nothing, and keeps the ones who owe a class (STUDENT-5)", () => {
    expect(ids(filterStudents(all, { view: "current" }, owing))).toEqual(["ana", "promoted", "owes", "noCourse"]);
  });

  it("shows those graduates on their own, and everyone under 'all' (STUDENT-5)", () => {
    expect(ids(filterStudents(all, { view: "graduates" }, owing))).toEqual(["graduate"]);
    expect(ids(filterStudents(all, { view: "all" }, owing))).toEqual(ids(all));
  });

  it("moves a graduate out of the list once they owe nothing (STUDENT-5)", () => {
    expect(ids(filterStudents(all, { view: "current" }, new Set()))).not.toContain("owes");
  });

  it("goes by the newest course: graduating an old course of someone still studying doesn't hide them (STUDENT-5)", () => {
    // What would break: a student marked "egresa" by mistake in 2025 but in a 2026 course would vanish.
    const back = student("back", [course({ id: "c-2025", schoolYear: "2025", year: 6, outcome: "graduated" }), course()]);
    expect(isGraduate(back)).toBe(false);
    expect(isGraduate(graduate)).toBe(true);
    expect(isGraduate(noCourse)).toBe(false);
  });

  it("narrows any view to the students of one course (STUDENT-6)", () => {
    expect(ids(filterStudents(all, { view: "current", courseId: "c-2026" }, owing))).toEqual(["ana", "promoted"]);
    expect(ids(filterStudents(all, { view: "all", courseId: "c-6" }, owing))).toEqual(["graduate", "owes"]);
    expect(filterStudents(all, { view: "current", courseId: "nope" }, owing)).toEqual([]);
  });

  it("falls back to the working list for an unknown view (STUDENT-5)", () => {
    expect(resolveView(undefined)).toBe("current");
    expect(resolveView("nope")).toBe("current");
    expect(resolveView("graduates")).toBe("graduates");
  });
});
