import { describe, expect, it } from "vitest";
import { allowedOutcomes, classResult } from "./yearEnd";

const exam = (takenOn: string, value: number | null) => ({
  takenOn,
  status: value === null ? ("absent" as const) : ("graded" as const),
  value,
});

describe("a class's result (YEAR-1)", () => {
  it("is pending without a final grade, and passed at or above the pass mark", () => {
    expect(classResult(null, [], 7)).toEqual({ kind: "pending" });
    expect(classResult(7, [], 7)).toEqual({ kind: "passed", grade: 7 });
    expect(classResult(9.5, [], 6)).toEqual({ kind: "passed", grade: 9.5 });
  });

  it("is owed below the pass mark, through failed or missed exams", () => {
    expect(classResult(4, [], 7)).toEqual({ kind: "owed", grade: 4 });
    expect(classResult(4, [exam("2026-12-10", 5), exam("2027-02-20", null)], 7)).toEqual({ kind: "owed", grade: 4 });
  });

  it("is passed by the earliest exam at or above the pass mark, in whatever order they come", () => {
    const exams = [exam("2027-03-01", 9), exam("2026-12-10", 4), exam("2027-02-20", 7)];
    expect(classResult(4, exams, 7)).toEqual({
      kind: "passedByExam",
      grade: 4,
      exam: { takenOn: "2027-02-20", value: 7 },
    });
  });
});

describe("the year outcomes a course allows (YEAR-2)", () => {
  it("is promoted or repeats in 1° to 5°, graduated in 6°", () => {
    for (const year of [1, 2, 3, 4, 5]) expect(allowedOutcomes(year)).toEqual(["promoted", "repeats"]);
    expect(allowedOutcomes(6)).toEqual(["graduated"]);
  });
});
