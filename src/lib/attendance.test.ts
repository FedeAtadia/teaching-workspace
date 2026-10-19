import { describe, expect, it } from "vitest";
import { attendanceRate, belowMinimum, cellFor, classDays, expectedStudents, termDates, termOfDate } from "./attendance";

const calendar = { startsOn: "2026-03-02", term2StartsOn: "2026-07-27", endsOn: "2026-12-11" };

describe("a cuatrimestre's dates (ATT-1)", () => {
  it("run from the start to the day before the 2°, then from the 2° to the end", () => {
    expect(termDates(calendar, 1)).toEqual({ from: "2026-03-02", to: "2026-07-26" });
    expect(termDates(calendar, 2)).toEqual({ from: "2026-07-27", to: "2026-12-11" });
  });

  it("place a date in its cuatrimestre, or in none outside the school year", () => {
    expect(termOfDate("2026-03-02", calendar)).toBe(1);
    expect(termOfDate("2026-07-26", calendar)).toBe(1);
    expect(termOfDate("2026-07-27", calendar)).toBe(2);
    expect(termOfDate("2026-12-11", calendar)).toBe(2);
    expect(termOfDate("2026-03-01", calendar)).toBeNull();
    expect(termOfDate("2026-12-12", calendar)).toBeNull();
  });
});

describe("a class's days (ATT-1)", () => {
  // Lunes and miércoles, 5 to 19 October 2026; the 12th is a holiday.
  const base = {
    from: "2026-10-05",
    to: "2026-10-19",
    weekdays: [1, 3],
    daysOff: [{ id: "f", startsOn: "2026-10-12", endsOn: "2026-10-12", kind: "holiday" as const, name: "Diversidad" }],
  };

  it("are pending until something is recorded, and without class on a day off", () => {
    const days = classDays({ ...base, sessions: [] });
    expect(days.map((d) => [d.date, d.state])).toEqual([
      ["2026-10-05", "pending"],
      ["2026-10-07", "pending"],
      ["2026-10-12", "off"],
      ["2026-10-14", "pending"],
      ["2026-10-19", "pending"],
    ]);
    expect(days[2].dayOff?.name).toBe("Diversidad");
  });

  it("are taken or not held once recorded, even on a day off, and add any other date recorded", () => {
    const days = classDays({
      ...base,
      sessions: [
        { date: "2026-10-05", held: true, reason: null, note: null },
        { date: "2026-10-07", held: false, reason: "strike", note: null },
        { date: "2026-10-12", held: true, reason: null, note: null },
        // A Friday make-up class, and a date outside the range that isn't listed.
        { date: "2026-10-09", held: true, reason: null, note: null },
        { date: "2026-10-30", held: true, reason: null, note: null },
      ],
    });
    expect(days.map((d) => [d.date, d.state])).toEqual([
      ["2026-10-05", "taken"],
      ["2026-10-07", "notHeld"],
      ["2026-10-09", "taken"],
      ["2026-10-12", "taken"],
      ["2026-10-14", "pending"],
      ["2026-10-19", "pending"],
    ]);
    expect(days[1].session?.reason).toBe("strike");
  });
});

describe("who is expected on a date (ATT-2, CAL-4)", () => {
  // The class meets lunes and miércoles; group L only lunes, group M has no days of its own.
  const groups = new Map([
    ["L", [1]],
    ["M", []],
  ]);
  const students = [
    { id: "ana", groupId: "L" },
    { id: "bea", groupId: "M" },
    { id: "caro", groupId: undefined },
  ];

  it("is each student whose days include it", () => {
    expect(expectedStudents("2026-10-05", [1, 3], groups, students)).toEqual(["ana", "bea", "caro"]); // lunes
    expect(expectedStudents("2026-10-07", [1, 3], groups, students)).toEqual(["bea", "caro"]); // miércoles
  });

  it("is everyone on a date that is none of the class's days", () => {
    expect(expectedStudents("2026-10-09", [1, 3], groups, students)).toEqual(["ana", "bea", "caro"]); // viernes
  });

  it("counts a group's own days as the class's days", () => {
    const own = new Map([["V", [5]]]);
    expect(expectedStudents("2026-10-09", [1], own, [{ id: "ana", groupId: "V" }, { id: "bea", groupId: undefined }])).toEqual([
      "ana",
    ]);
  });
});

describe("a cell of the attendance table (ATT-5)", () => {
  it("shows the mark when there is one, whatever the day", () => {
    expect(cellFor("taken", true, "late")).toBe("late");
    expect(cellFor("taken", false, "absent")).toBe("absent");
  });

  it("is not expected on a day that isn't the student's, and empty otherwise", () => {
    expect(cellFor("taken", false, null)).toBe("notExpected");
    expect(cellFor("pending", false, null)).toBe("notExpected");
    expect(cellFor("pending", true, null)).toBeNull();
    expect(cellFor("taken", true, null)).toBeNull();
    expect(cellFor("off", true, null)).toBeNull();
    expect(cellFor("notHeld", false, null)).toBeNull();
  });
});

describe("a student's attendance (ATT-4)", () => {
  it("is the days counted minus the absences over the days counted", () => {
    // 8 presentes, 2 ausentes: 8 / 10.
    const marks = [...Array(8).fill("present"), "absent", "absent"];
    expect(attendanceRate(marks)).toEqual({ present: 8, absent: 2, late: 0, excused: 0, rate: 80 });
  });

  it("counts a tarde as half an absence", () => {
    // 3 presentes and 1 tarde: 4 days, ½ absence → 87,5 → 88.
    expect(attendanceRate(["present", "present", "present", "late"]).rate).toBe(88);
  });

  it("leaves ausente justificado out entirely", () => {
    // Without the rule, 2 justificados would drop this to 50%.
    expect(attendanceRate(["present", "present", "excused", "excused"])).toEqual({
      present: 2,
      absent: 0,
      late: 0,
      excused: 2,
      rate: 100,
    });
  });

  it("has no percentage with no day counted", () => {
    expect(attendanceRate([]).rate).toBeNull();
    expect(attendanceRate(["excused"]).rate).toBeNull();
  });
});

describe("the minimum attendance (SUGGEST-3)", () => {
  it("flags a percentage below it, not one at it", () => {
    expect(belowMinimum(74, 75)).toBe(true);
    expect(belowMinimum(75, 75)).toBe(false);
  });

  it("flags nothing when it's 0 or there's no percentage", () => {
    expect(belowMinimum(10, 0)).toBe(false);
    expect(belowMinimum(null, 75)).toBe(false);
  });
});
