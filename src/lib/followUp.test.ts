import { describe, expect, it } from "vitest";
import { currentTerm, followUpReasons, resolveMissing } from "./followUp";

const limits = { passMark: 7, minAttendance: 75, missing: 3 };
const fine = { average: 8, missing: 0, attendance: 90 };
const calendar = { startsOn: "2026-03-02", term2StartsOn: "2026-08-03", endsOn: "2026-12-11" };

describe("students to follow up (FOLLOW)", () => {
  it("has no reason for a student who is doing fine, or has nothing recorded yet (FOLLOW-1)", () => {
    expect(followUpReasons(fine, limits)).toEqual([]);
    expect(followUpReasons({ average: null, missing: 0, attendance: null }, limits)).toEqual([]);
    // Exactly on each limit is still fine, except tasks: the limit itself counts.
    expect(followUpReasons({ average: 7, missing: 2, attendance: 75 }, limits)).toEqual([]);
  });

  it("gives each reason with its number (FOLLOW-1)", () => {
    expect(followUpReasons({ ...fine, attendance: 68 }, limits)).toEqual([{ kind: "attendance", rate: 68, minimum: 75 }]);
    expect(followUpReasons({ ...fine, average: 5.5 }, limits)).toEqual([{ kind: "average", average: 5.5, passMark: 7 }]);
    expect(followUpReasons({ ...fine, missing: 3 }, limits)).toEqual([{ kind: "missing", count: 3 }]);
    expect(followUpReasons({ average: 4, missing: 5, attendance: 50 }, limits).map((r) => r.kind)).toEqual([
      "attendance",
      "average",
      "missing",
    ]);
  });

  it("follows the teacher's limits: no attendance reason with the minimum off, the class's pass mark (FOLLOW-1, FOLLOW-4)", () => {
    expect(followUpReasons({ ...fine, attendance: 10 }, { ...limits, minAttendance: 0 })).toEqual([]);
    expect(followUpReasons({ ...fine, average: 6 }, { ...limits, passMark: 6 })).toEqual([]);
    expect(followUpReasons({ ...fine, missing: 3 }, { ...limits, missing: 5 })).toEqual([]);
    expect(followUpReasons({ ...fine, missing: 1 }, { ...limits, missing: 1 })).toEqual([{ kind: "missing", count: 1 }]);
  });

  it("looks at the cuatrimestre today falls in, and at none outside the school year (FOLLOW-2)", () => {
    expect(currentTerm("2026-05-10", calendar, [1, 2])).toBe(1);
    expect(currentTerm("2026-08-03", calendar, [1])).toBe(2);
    expect(currentTerm("2026-01-15", calendar, [1, 2])).toBeNull();
    expect(currentTerm("2026-12-20", calendar, [1, 2])).toBeNull();
  });

  it("without a calendar, takes the latest cuatrimestre with something scored (FOLLOW-2)", () => {
    expect(currentTerm("2026-05-10", null, [1])).toBe(1);
    expect(currentTerm("2026-05-10", null, [1, 2])).toBe(2);
    expect(currentTerm("2026-05-10", null, [])).toBeNull();
  });

  it("only takes a sensible number of tasks, else three (FOLLOW-4)", () => {
    expect(resolveMissing(5)).toBe(5);
    expect(resolveMissing(1)).toBe(1);
    expect(resolveMissing(0)).toBe(3);
    expect(resolveMissing(21)).toBe(3);
    expect(resolveMissing(2.5)).toBe(3);
    expect(resolveMissing(null)).toBe(3);
  });
});
