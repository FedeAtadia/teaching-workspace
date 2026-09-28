import { describe, expect, it } from "vitest";
import { compareCourses, compareStudents, formatCourse } from "./courses";

describe("courses (COURSE)", () => {
  it("writes a course as its year with a degree sign and its division (COURSE-2)", () => {
    expect(formatCourse(4, "A")).toBe("4° A");
  });

  it("lists the newest school year first, then by year, division and shift (COURSE-3)", () => {
    const c = (schoolYear: string, year: number, division: string, shift: "morning" | "afternoon" | "evening") =>
      ({ schoolYear, year, division, shift });
    const sorted = [
      c("2025", 1, "A", "morning"),
      c("2026", 4, "B", "morning"),
      c("2026", 4, "A", "evening"),
      c("2026", 4, "A", "morning"),
      c("2026", 2, "A", "afternoon"),
    ].sort(compareCourses);
    expect(sorted.map((x) => `${x.schoolYear} ${x.year}${x.division} ${x.shift}`)).toEqual([
      "2026 2A afternoon",
      "2026 4A morning",
      "2026 4A evening",
      "2026 4B morning",
      "2025 1A morning",
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
