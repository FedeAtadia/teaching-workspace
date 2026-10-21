import { describe, expect, it } from "vitest";
import { formatDate, formatGrade, formatShortDate, parseDate, withSlashes } from "./format";

describe("writing grades (BOOK-3)", () => {
  it("uses the language's decimal separator", () => {
    expect(formatGrade(7.5, "es-AR")).toBe("7,5");
    expect(formatGrade(7.5, "en")).toBe("7.5");
    expect(formatGrade(8, "es-AR")).toBe("8");
    expect(formatGrade(7.25, "es-AR")).toBe("7,25");
  });
});

describe("writing dates (TASK-4)", () => {
  it("shows the day as entered, as DD/MM/YYYY", () => {
    // Read as midnight UTC and formatted in local time, Argentina (UTC−3) would show the 9th.
    expect(formatDate("2026-05-10")).toBe("10/05/2026");
    expect(formatDate("2026-12-01")).toBe("01/12/2026");
  });

  it("is DD/MM without the year", () => {
    expect(formatShortDate("2026-10-05")).toBe("05/10");
  });
});

describe("typing a date (INPUT-4)", () => {
  it("reads DD/MM/YYYY into the stored date", () => {
    expect(parseDate("10/05/2026")).toBe("2026-05-10");
    expect(parseDate(" 01/12/2026 ")).toBe("2026-12-01");
  });

  it("takes one-digit days and months, and - or . as separators", () => {
    expect(parseDate("5/3/2026")).toBe("2026-03-05");
    expect(parseDate("05-03-2026")).toBe("2026-03-05");
    expect(parseDate("5.3.2026")).toBe("2026-03-05");
  });

  it("rejects a date that doesn't exist, a short year, or anything else", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("29/02/2027")).toBeNull();
    expect(parseDate("29/02/2028")).toBe("2028-02-29");
    expect(parseDate("10/05/26")).toBeNull();
    expect(parseDate("13/13/2026")).toBeNull();
    expect(parseDate("2026-05-10")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("adds the slashes while digits are typed, and leaves typed separators alone", () => {
    expect(withSlashes("1")).toBe("1");
    expect(withSlashes("10")).toBe("10");
    expect(withSlashes("100")).toBe("10/0");
    expect(withSlashes("1005")).toBe("10/05");
    expect(withSlashes("10052026")).toBe("10/05/2026");
    // A phone's number pad has no "/", so the digits alone must be enough.
    expect(withSlashes("100520261")).toBe("10/05/2026");
    // Typing on after the first slash, and deleting back over one.
    expect(withSlashes("10/052")).toBe("10/05/2");
    expect(withSlashes("10/05/")).toBe("10/05");
    expect(withSlashes("5/3/2026")).toBe("5/3/2026");
  });
});
