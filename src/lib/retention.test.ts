import { describe, expect, it } from "vitest";
import { addDays, addMonths, deletionDate, resolveRetention } from "./retention";

describe("how long a graduate is kept (KEEP)", () => {
  it("deletes a graduate that many months after they were marked as graduated (KEEP-1)", () => {
    expect(deletionDate("2026-12-15", null, 12)).toBe("2027-12-15");
    expect(deletionDate("2026-12-15", null, 6)).toBe("2027-06-15");
  });

  it("counts from their last exam when it came after graduating (KEEP-1)", () => {
    // What would break: passing an owed class two years on would delete them that same day.
    expect(deletionDate("2026-12-15", "2028-03-02", 12)).toBe("2029-03-02");
    expect(deletionDate("2026-12-15", "2026-08-01", 12)).toBe("2027-12-15");
  });

  it("lands on the last day of a shorter month", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("adds days across months and years (KEEP-3)", () => {
    expect(addDays("2026-12-15", 30)).toBe("2027-01-14");
  });

  it("only takes the periods on offer, else a year (KEEP-2)", () => {
    expect(resolveRetention(24)).toBe(24);
    expect(resolveRetention(7)).toBe(12);
    expect(resolveRetention(null)).toBe(12);
  });
});
