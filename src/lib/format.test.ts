import { describe, expect, it } from "vitest";
import { formatDate, formatGrade } from "./format";

describe("writing grades (BOOK-3)", () => {
  it("uses the language's decimal separator", () => {
    expect(formatGrade(7.5, "es-AR")).toBe("7,5");
    expect(formatGrade(7.5, "en")).toBe("7.5");
    expect(formatGrade(8, "es-AR")).toBe("8");
    expect(formatGrade(7.25, "es-AR")).toBe("7,25");
  });
});

describe("writing dates (TASK-4)", () => {
  it("shows the day as entered, in each language's order", () => {
    // A date-only value read as midnight UTC would show the day before in
    // Argentina (UTC−3) if formatted in local time.
    expect(formatDate("2026-05-10", "es-AR")).toBe("10/5/2026");
    expect(formatDate("2026-05-10", "en")).toBe("5/10/2026");
  });
});
