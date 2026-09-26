import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES,
  checkSecondTermGrade,
  isPassing,
  parseGrade,
  secondTermRange,
  suggestTermGrade,
} from "./grading";

const rules = DEFAULT_RULES;

describe("passing (GRADE)", () => {
  it("grades on a 1 to 10 scale by default (GRADE-1)", () => {
    expect([rules.gradeMin, rules.gradeMax]).toEqual([1, 10]);
  });

  it("passes at 7 and above, and not below (GRADE-2)", () => {
    expect(isPassing(7, rules)).toBe(true);
    expect(isPassing(6.99, rules)).toBe(false);
  });

  it("follows a class's own pass mark when it has one (GRADE-3)", () => {
    expect(isPassing(6, { ...rules, passMark: 6 })).toBe(true);
  });
});

describe("second cuatrimestre range (TERM)", () => {
  it("lets a 4 in the first term reach a 7 but not an 8 (TERM-2)", () => {
    // The example the rule was written from: a weak first term can still
    // scrape a pass, but cannot turn into an excellent year.
    expect(secondTermRange(4, rules).max).toBe(7);
    expect(checkSecondTermGrade(7, 4, rules)).toBe("within");
    expect(checkSecondTermGrade(8, 4, rules)).toBe("above");
  });

  it("limits how far a grade can drop as well (TERM-2)", () => {
    expect(secondTermRange(9, rules).min).toBe(6);
    expect(checkSecondTermGrade(5, 9, rules)).toBe("below");
  });

  it("never suggests a range off the scale (TERM-3)", () => {
    expect(secondTermRange(9, rules).max).toBe(10);
    expect(secondTermRange(2, rules).min).toBe(1);
  });

  it("uses the teacher's own limits when they change them (TERM-2)", () => {
    expect(secondTermRange(4, { ...rules, maxTermIncrease: 2 }).max).toBe(6);
  });
});

describe("suggested term grade (SUGGEST)", () => {
  it("averages graded tasks and leaves out missing and excused ones (SUGGEST-1)", () => {
    const s = suggestTermGrade([
      { status: "graded", value: 6 },
      { status: "graded", value: 9 },
      { status: "missing", value: null },
      { status: "excused", value: null },
    ]);
    expect(s.average).toBe(7.5);
    expect(s.graded).toBe(2);
  });

  it("counts missing tasks so the teacher sees them next to the average (SUGGEST-2)", () => {
    expect(suggestTermGrade([{ status: "missing", value: null }]).missing).toBe(1);
  });

  it("suggests nothing before anything is graded (SUGGEST-1)", () => {
    expect(suggestTermGrade([]).average).toBeNull();
  });

  it("rounds to two decimals (SUGGEST-1)", () => {
    const s = suggestTermGrade([
      { status: "graded", value: 7 },
      { status: "graded", value: 7 },
      { status: "graded", value: 8 },
    ]);
    expect(s.average).toBe(7.33);
  });
});

describe("typing a grade (INPUT)", () => {
  it("accepts a decimal comma as well as a point (INPUT-1)", () => {
    expect(parseGrade("7,5", rules)).toBe(7.5);
    expect(parseGrade(" 7.5 ", rules)).toBe(7.5);
    expect(parseGrade("8", rules)).toBe(8);
  });

  it("rejects grades off the scale (INPUT-2)", () => {
    expect(parseGrade("0", rules)).toBeNull();
    expect(parseGrade("10,5", rules)).toBeNull();
  });

  it("rejects anything that is not a number with at most two decimals (INPUT-3)", () => {
    for (const bad of ["", "abc", "7,555", "7,5,1", "-3", "1e1"]) {
      expect(parseGrade(bad, rules)).toBeNull();
    }
  });
});
