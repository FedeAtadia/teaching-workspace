import { describe, expect, it } from "vitest";
import { classDates, dayOffOn, expectedWeekdays, holidaysToAdd, todayInArgentina, weekdayOf } from "./calendar";
import { nationalHolidays } from "./holidays";

describe("days of the week (CAL-4)", () => {
  it("numbers them lunes 1 to domingo 7", () => {
    expect(weekdayOf("2026-10-19")).toBe(1); // a Monday
    expect(weekdayOf("2026-10-24")).toBe(6);
    expect(weekdayOf("2026-10-25")).toBe(7);
  });

  it("expects a student on their group's days, or the class's when the group has none or there's no group", () => {
    expect(expectedWeekdays([1, 3, 5], [3])).toEqual([3]);
    expect(expectedWeekdays([1, 3, 5], [])).toEqual([1, 3, 5]);
    expect(expectedWeekdays([1, 3, 5], undefined)).toEqual([1, 3, 5]);
  });
});

describe("a class's days between two dates (CAL-5)", () => {
  it("are the dates on its days of the week, in order, both ends included", () => {
    // Lunes and miércoles from Monday 5 to Monday 19 October 2026.
    expect(classDates("2026-10-05", "2026-10-19", [1, 3])).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-12",
      "2026-10-14",
      "2026-10-19",
    ]);
  });

  it("are none without days of the week, or with the dates the wrong way round", () => {
    expect(classDates("2026-10-05", "2026-10-19", [])).toEqual([]);
    expect(classDates("2026-10-19", "2026-10-05", [1])).toEqual([]);
  });

  it("cross months and years", () => {
    expect(classDates("2026-12-28", "2027-01-08", [5])).toEqual(["2027-01-01", "2027-01-08"]);
  });
});

describe("a day without class (CAL-5)", () => {
  const off = [
    { id: "a", startsOn: "2026-07-13", endsOn: "2026-07-24", kind: "recess" as const, name: "Receso invernal" },
    { id: "b", startsOn: "2026-10-12", endsOn: "2026-10-12", kind: "holiday" as const, name: "Diversidad Cultural" },
  ];

  it("covers every date of its range, both ends included", () => {
    expect(dayOffOn("2026-07-13", off)?.id).toBe("a");
    expect(dayOffOn("2026-07-20", off)?.id).toBe("a");
    expect(dayOffOn("2026-07-24", off)?.id).toBe("a");
    expect(dayOffOn("2026-10-12", off)?.id).toBe("b");
  });

  it("covers nothing outside it", () => {
    expect(dayOffOn("2026-07-12", off)).toBeNull();
    expect(dayOffOn("2026-07-25", off)).toBeNull();
    expect(dayOffOn("2026-10-13", off)).toBeNull();
  });
});

describe("national holidays (CAL-3)", () => {
  it("has 2026's list, each with a date in 2026 and a name", () => {
    const list = nationalHolidays(2026)!;
    expect(list.length).toBeGreaterThan(15);
    expect(list.every((h) => h.date.startsWith("2026-") && h.name.length > 0)).toBe(true);
    expect(list).toContainEqual({ date: "2026-05-25", name: "Día de la Revolución de Mayo" });
  });

  it("has no list for a year it doesn't keep", () => {
    expect(nationalHolidays(1999)).toBeNull();
  });

  it("skips holidays a day without class already covers, so adding twice adds nothing", () => {
    const holidays = [
      { date: "2026-07-09", name: "Día de la Independencia" },
      { date: "2026-07-10", name: "Puente turístico" },
      { date: "2026-12-25", name: "Navidad" },
    ];
    const listed = [{ startsOn: "2026-07-06", endsOn: "2026-07-17" }];
    expect(holidaysToAdd(holidays, listed)).toEqual([{ date: "2026-12-25", name: "Navidad" }]);
    expect(holidaysToAdd(holidays, [...listed, { startsOn: "2026-12-25", endsOn: "2026-12-25" }])).toEqual([]);
  });
});

describe("today", () => {
  it("is the date in Argentina, not in UTC", () => {
    // 01:30 UTC on the 20th is still 22:30 on the 19th in Argentina (UTC−3).
    expect(todayInArgentina(new Date("2026-10-20T01:30:00Z"))).toBe("2026-10-19");
    expect(todayInArgentina(new Date("2026-10-20T03:30:00Z"))).toBe("2026-10-20");
  });
});
