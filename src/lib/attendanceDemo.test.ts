import { describe, expect, it } from "vitest";
import { DEMO_START, demoTotals } from "./attendanceDemo";

describe("the home page's attendance demo (LAND-7)", () => {
  it("starts as the animation ends: one absent, one late, the rest present", () => {
    expect(demoTotals(DEMO_START)).toEqual([
      { mark: "present", count: 3 },
      { mark: "absent", count: 1 },
      { mark: "late", count: 1 },
    ]);
  });

  it("follows the visitor's marks, in P, A, T, J order, leaving out marks nobody has", () => {
    expect(demoTotals(["excused", "present", "excused", "present", "present"])).toEqual([
      { mark: "present", count: 3 },
      { mark: "excused", count: 2 },
    ]);
    expect(demoTotals(["absent", "absent", "absent", "absent", "absent"])).toEqual([{ mark: "absent", count: 5 }]);
  });
});
