import { describe, expect, it } from "vitest";
import { classInput, studentInput, toFieldErrors } from "./validation";

const validClass = {
  name: "Matemática",
  year: "4",
  division: "A",
  shift: "morning",
  schoolYear: "2026",
};

describe("adding a class (CLASS)", () => {
  it("accepts the five fields as a form sends them (CLASS-2)", () => {
    expect(classInput.parse(validClass)).toEqual({
      name: "Matemática",
      year: 4,
      division: "A",
      shift: "morning",
      schoolYear: 2026,
    });
  });

  it("trims the subject and rejects an empty one (CLASS-2)", () => {
    expect(classInput.parse({ ...validClass, name: "  Física " }).name).toBe("Física");
    expect(classInput.safeParse({ ...validClass, name: "   " }).success).toBe(false);
  });

  it("only takes course years 1 to 6 (CLASS-2)", () => {
    expect(classInput.safeParse({ ...validClass, year: "0" }).success).toBe(false);
    expect(classInput.safeParse({ ...validClass, year: "7" }).success).toBe(false);
    expect(classInput.safeParse({ ...validClass, year: "6" }).success).toBe(true);
  });

  it("only takes the three shifts (CLASS-2)", () => {
    for (const shift of ["morning", "afternoon", "evening"]) {
      expect(classInput.safeParse({ ...validClass, shift }).success).toBe(true);
    }
    expect(classInput.safeParse({ ...validClass, shift: "night" }).success).toBe(false);
  });

  it("only takes a school year between 2000 and 2100 (CLASS-2)", () => {
    expect(classInput.safeParse({ ...validClass, schoolYear: "26" }).success).toBe(false);
    expect(classInput.safeParse({ ...validClass, schoolYear: "" }).success).toBe(false);
  });

  it("stores the division trimmed and upper-cased (CLASS-3)", () => {
    // Otherwise "4° a" and "4° A" would become two different courses.
    expect(classInput.parse({ ...validClass, division: " a " }).division).toBe("A");
    expect(classInput.safeParse({ ...validClass, division: "" }).success).toBe(false);
    expect(classInput.safeParse({ ...validClass, division: "12345678901" }).success).toBe(false);
  });
});

describe("adding a student (STUDENT)", () => {
  const validStudent = {
    firstName: " Ana ",
    lastName: "Pérez",
    courseId: "0b7f3c2e-4a1d-4c8e-9f6a-2d5b8e1c3a7f",
  };

  it("trims the names and needs a course (STUDENT-1)", () => {
    expect(studentInput.parse(validStudent).firstName).toBe("Ana");
    expect(studentInput.safeParse({ ...validStudent, courseId: "" }).success).toBe(false);
  });

  it("rejects an empty name (STUDENT-1)", () => {
    expect(studentInput.safeParse({ ...validStudent, lastName: " " }).success).toBe(false);
  });
});

describe("form errors", () => {
  it("names each bad field and what is wrong with it, for the form to show", () => {
    const result = classInput.safeParse({ ...validClass, name: "", division: "x".repeat(11), year: "9" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error)).toEqual({
        name: "required",
        division: "tooLong",
        year: "invalid",
      });
    }
  });
});
