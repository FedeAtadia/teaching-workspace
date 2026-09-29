import { describe, expect, it } from "vitest";
import { compareCourses, compareStudents, formatCourse, progress } from "./courses";

describe("how much of a class is scored (HOME-2)", () => {
  it("is the saved scores over tasks × students, as a whole percentage", () => {
    expect(progress(3, 2, 4)).toBe(38); // 3 of 8
    expect(progress(8, 2, 4)).toBe(100);
  });

  it("is 0 with no tasks or no students, and never above 100", () => {
    expect(progress(0, 0, 10)).toBe(0);
    expect(progress(0, 3, 0)).toBe(0);
    // A student who left keeps their scores; they must not push it past 100.
    expect(progress(9, 2, 4)).toBe(100);
  });
});

describe("courses (COURSE)", () => {
  it("writes a course as its year with a degree sign and its division (COURSE-2)", () => {
    expect(formatCourse(4, "A")).toBe("4° A");
  });

  it("lists the newest school year first, then by school, year, division and shift (COURSE-3)", () => {
    const c = (
      schoolYear: string,
      school: string,
      year: number,
      division: string,
      shift: "morning" | "afternoon" | "evening",
    ) => ({ schoolYear, school, year, division, shift });
    const sorted = [
      c("2025", "Normal 1", 1, "A", "morning"),
      c("2026", "Técnica 2", 1, "A", "morning"),
      c("2026", "Normal 1", 4, "B", "morning"),
      c("2026", "Normal 1", 4, "A", "evening"),
      c("2026", "Normal 1", 4, "A", "morning"),
      c("2026", "Normal 1", 2, "A", "afternoon"),
    ].sort(compareCourses);
    expect(sorted.map((x) => `${x.schoolYear} ${x.school} ${x.year}${x.division} ${x.shift}`)).toEqual([
      "2026 Normal 1 2A afternoon",
      "2026 Normal 1 4A morning",
      "2026 Normal 1 4A evening",
      "2026 Normal 1 4B morning",
      "2026 Técnica 2 1A morning",
      "2025 Normal 1 1A morning",
    ]);
  });
});

describe("student order (STUDENT-3)", () => {
  it("sorts by last name, then first name", () => {
    const sorted = [
      { firstName: "Luis", lastName: "Pérez" },
      { firstName: "Ana", lastName: "Pérez" },
      { firstName: "Zoe", lastName: "Álvarez" },
      { firstName: "Juan", lastName: "Benítez" },
    ].sort(compareStudents);
    // "Álvarez" must sort with the A's: a plain comparison puts accented
    // letters after "z" and the list stops reading like a class register.
    expect(sorted.map((s) => `${s.lastName}, ${s.firstName}`)).toEqual([
      "Álvarez, Zoe",
      "Benítez, Juan",
      "Pérez, Ana",
      "Pérez, Luis",
    ]);
  });
});
