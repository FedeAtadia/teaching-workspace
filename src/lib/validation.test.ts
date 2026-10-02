import { describe, expect, it } from "vitest";
import {
  classEdit,
  classInput,
  examInput,
  outcomeInput,
  schoolInput,
  standardEdit,
  standardInput,
  studentInput,
  taskEdit,
  taskInput,
  toFieldErrors,
  unitEdit,
  unitInput,
} from "./validation";

const validClass = {
  school: "Escuela N° 5",
  name: "Matemática",
  year: "4",
  division: "A",
  shift: "morning",
  schoolYear: "2026",
};

describe("adding a class (CLASS)", () => {
  it("accepts the six fields as a form sends them (CLASS-2)", () => {
    expect(classInput.parse(validClass)).toEqual({
      school: "Escuela N° 5",
      name: "Matemática",
      year: 4,
      division: "A",
      shift: "morning",
      schoolYear: 2026,
    });
  });

  it("needs a school, trimmed and at most 120 characters (SCHOOL-1)", () => {
    expect(classInput.parse({ ...validClass, school: "  Técnica 2 " }).school).toBe("Técnica 2");
    expect(classInput.safeParse({ ...validClass, school: " " }).success).toBe(false);
    expect(classInput.safeParse({ ...validClass, school: "x".repeat(121) }).success).toBe(false);
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

describe("changing a class (CLASS-6)", () => {
  it("takes the six fields with the adding rules, plus the class id", () => {
    const classId = "0b7f3c2e-4a1d-4c8e-9f6a-2d5b8e1c3a7f";
    expect(classEdit.parse({ ...validClass, classId, division: " b" })).toMatchObject({ classId, division: "B" });
    expect(classEdit.safeParse({ ...validClass, classId: "x" }).success).toBe(false);
    expect(classEdit.safeParse({ ...validClass, classId, shift: "night" }).success).toBe(false);
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

const CLASS_ID = "0b7f3c2e-4a1d-4c8e-9f6a-2d5b8e1c3a7f";

describe("adding a passing standard (STD)", () => {
  it("trims the title and keeps an empty description as none (STD-1)", () => {
    expect(standardInput.parse({ classId: CLASS_ID, title: " Resuelve ecuaciones ", description: "" })).toEqual({
      classId: CLASS_ID,
      title: "Resuelve ecuaciones",
      description: null,
    });
  });

  it("needs a title of at most 200 characters (STD-1)", () => {
    expect(standardInput.safeParse({ classId: CLASS_ID, title: "", description: "" }).success).toBe(false);
    expect(standardInput.safeParse({ classId: CLASS_ID, title: "x".repeat(201), description: "" }).success).toBe(false);
  });

  it("caps the description at 1000 characters (STD-1)", () => {
    expect(standardInput.safeParse({ classId: CLASS_ID, title: "T", description: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("adding a unit (UNIT)", () => {
  it("needs a title and may leave the cuatrimestre out (UNIT-1)", () => {
    expect(unitInput.parse({ classId: CLASS_ID, title: " Funciones ", termId: "" })).toEqual({
      classId: CLASS_ID,
      title: "Funciones",
      termId: null,
    });
    expect(unitInput.safeParse({ classId: CLASS_ID, title: " ", termId: "" }).success).toBe(false);
    expect(unitInput.safeParse({ classId: CLASS_ID, title: "x".repeat(121), termId: "" }).success).toBe(false);
  });

  it("only takes a real cuatrimestre id (UNIT-1)", () => {
    expect(unitInput.safeParse({ classId: CLASS_ID, title: "T", termId: "first" }).success).toBe(false);
  });
});

describe("adding a task (TASK)", () => {
  const TERM = "5c2d1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
  const STD = "7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d";
  const base = {
    classId: CLASS_ID,
    title: " TP 1: Funciones ",
    termId: TERM,
    unitId: "",
    dueOn: "",
    description: "",
    criteria: "",
    standardIds: [] as string[],
  };

  it("needs a title and a cuatrimestre; everything else may be left empty (TASK-1, TASK-2)", () => {
    expect(taskInput.parse(base)).toEqual({
      classId: CLASS_ID,
      title: "TP 1: Funciones",
      termId: TERM,
      unitId: null,
      dueOn: null,
      description: null,
      criteria: null,
      standardIds: [],
    });
    expect(taskInput.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(taskInput.safeParse({ ...base, termId: "" }).success).toBe(false);
  });

  it("takes a date, a brief description, a specific standard and linked standards (TASK-2)", () => {
    const parsed = taskInput.parse({
      ...base,
      dueOn: "2026-05-10",
      description: "Ejercicios 1 a 10",
      criteria: "Grafica correctamente",
      standardIds: [STD],
    });
    expect(parsed).toMatchObject({
      dueOn: "2026-05-10",
      description: "Ejercicios 1 a 10",
      criteria: "Grafica correctamente",
      standardIds: [STD],
    });
  });

  it("keeps the description brief and the specific standard under 1000 characters (TASK-2)", () => {
    expect(taskInput.safeParse({ ...base, description: "x".repeat(281) }).success).toBe(false);
    expect(taskInput.safeParse({ ...base, criteria: "x".repeat(1001) }).success).toBe(false);
  });

  it("rejects a date that is not a calendar date (TASK-2)", () => {
    expect(taskInput.safeParse({ ...base, dueOn: "10/05/2026" }).success).toBe(false);
    expect(taskInput.safeParse({ ...base, dueOn: "2026-02-30" }).success).toBe(false);
  });
});

describe("changing a standard, unit or task (STD-3, UNIT-3, TASK-6)", () => {
  const ID = "3f2e1d0c-9b8a-4f7e-8d6c-5b4a3f2e1d0c";
  const TERM = "5c2d1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d";

  it("takes the same fields as adding, plus the id of what is changed", () => {
    expect(standardEdit.parse({ classId: CLASS_ID, standardId: ID, title: " Justifica ", description: "" })).toEqual({
      classId: CLASS_ID,
      standardId: ID,
      title: "Justifica",
      description: null,
    });
    expect(unitEdit.parse({ classId: CLASS_ID, unitId: ID, title: "Repaso", termId: "" })).toEqual({
      classId: CLASS_ID,
      unitId: ID,
      title: "Repaso",
      termId: null,
    });
    expect(
      taskEdit.parse({
        classId: CLASS_ID,
        taskId: ID,
        title: "TP 2",
        termId: TERM,
        unitId: "",
        dueOn: "",
        description: "",
        criteria: "",
        standardIds: [],
      }),
    ).toMatchObject({ taskId: ID, title: "TP 2", unitId: null });
  });

  it("keeps the adding rules, and needs a real id", () => {
    expect(standardEdit.safeParse({ classId: CLASS_ID, standardId: ID, title: " ", description: "" }).success).toBe(
      false,
    );
    expect(unitEdit.safeParse({ classId: CLASS_ID, unitId: "x", title: "Repaso", termId: "" }).success).toBe(false);
    expect(
      taskEdit.safeParse({ classId: CLASS_ID, title: "TP", termId: TERM, unitId: "", dueOn: "", description: "", criteria: "", standardIds: [] })
        .success,
    ).toBe(false);
  });
});

describe("recording an exam (EXAM-1)", () => {
  const STUDENT = "5c2d1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
  const base = { classId: CLASS_ID, studentId: STUDENT, takenOn: "2026-12-10", status: "graded", grade: " 7,5 ", notes: "" };

  it("takes a date and a grade typed as in INPUT, with optional notes", () => {
    expect(examInput.parse(base)).toEqual({
      classId: CLASS_ID,
      studentId: STUDENT,
      takenOn: "2026-12-10",
      status: "graded",
      value: 7.5,
      notes: null,
    });
  });

  it("takes absent with no grade, whatever was typed", () => {
    expect(examInput.parse({ ...base, status: "absent", grade: "9", notes: " Avisó " })).toMatchObject({
      status: "absent",
      value: null,
      notes: "Avisó",
    });
  });

  it("names the grade or the date when they are wrong", () => {
    const wrong = (over: Record<string, string>) => {
      const r = examInput.safeParse({ ...base, ...over });
      return r.success ? null : Object.keys(toFieldErrors(r.error));
    };
    expect(wrong({ grade: "" })).toEqual(["grade"]);
    expect(wrong({ grade: "11" })).toEqual(["grade"]);
    expect(wrong({ takenOn: "10/12/2026" })).toEqual(["takenOn"]);
    expect(wrong({ status: "late" })).toEqual(["status"]);
  });
});

describe("setting a year outcome (YEAR-2)", () => {
  it("takes one of the three outcomes, or none to clear it", () => {
    const studentId = "5c2d1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
    expect(outcomeInput.parse({ classId: CLASS_ID, studentId, outcome: "repeats" })).toMatchObject({ outcome: "repeats" });
    expect(outcomeInput.parse({ classId: CLASS_ID, studentId, outcome: "" })).toMatchObject({ outcome: null });
    expect(outcomeInput.safeParse({ classId: CLASS_ID, studentId, outcome: "expelled" }).success).toBe(false);
  });
});

describe("renaming a school (SCHOOL-3)", () => {
  it("needs a school id and a trimmed name of at most 120 characters", () => {
    const schoolId = "0b7f3c2e-4a1d-4c8e-9f6a-2d5b8e1c3a7f";
    expect(schoolInput.parse({ schoolId, name: " Escuela 5 " })).toEqual({ schoolId, name: "Escuela 5" });
    expect(schoolInput.safeParse({ schoolId, name: "" }).success).toBe(false);
    expect(schoolInput.safeParse({ schoolId: "x", name: "Escuela" }).success).toBe(false);
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
