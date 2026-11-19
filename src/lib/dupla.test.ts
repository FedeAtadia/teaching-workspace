import { describe, expect, it } from "vitest";
import { matchStudent, type Candidate } from "./dupla";

const ana = { firstName: "Ana", lastName: "Pérez", schoolYears: ["2026"] };
const c = (over: Partial<Candidate>): Candidate => ({
  placeId: "taller",
  studentId: "s1",
  firstName: "Ana",
  lastName: "Pérez",
  schoolYear: "2026",
  ...over,
});

describe("the same student in a partner's class (DUPLA-1)", () => {
  it("matches the name whatever the case and accents", () => {
    expect(matchStudent(ana, [c({ firstName: "ANA", lastName: "perez" })]).map((m) => m.studentId)).toEqual(["s1"]);
  });

  it("doesn't match another name, or the same name in another school year", () => {
    expect(matchStudent(ana, [c({ firstName: "Ana María" }), c({ lastName: "Paz" }), c({ schoolYear: "2025" })])).toEqual([]);
  });

  it("leaves out a class with two students of that name, rather than guess", () => {
    const twins = [c({ studentId: "s1" }), c({ studentId: "s2" })];
    expect(matchStudent(ana, twins)).toEqual([]);
    // The same student found twice in one class (two shares of it) is still one.
    expect(matchStudent(ana, [c({ studentId: "s1" }), c({ studentId: "s1" })])).toHaveLength(1);
  });

  it("finds them in each class shared, one each", () => {
    const found = matchStudent(ana, [c({ placeId: "taller", studentId: "s1" }), c({ placeId: "lab", studentId: "s9" })]);
    expect(found.map((m) => [m.placeId, m.studentId])).toEqual([
      ["taller", "s1"],
      ["lab", "s9"],
    ]);
  });
});
