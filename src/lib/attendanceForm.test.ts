import { describe, expect, it } from "vitest";
import { parseAttendanceForm } from "./attendanceForm";

const form = (entries: Record<string, string>) => (name: string) => entries[name] ?? null;

describe("reading the attendance form (ATT-2)", () => {
  it("takes each listed student's mark", () => {
    const get = form({ "mark.ana": "present", "mark.bea": "absent", "mark.caro": "late", "mark.dora": "excused" });
    expect(parseAttendanceForm(get, ["ana", "bea", "caro", "dora"])).toEqual({
      ok: true,
      marks: [
        { studentId: "ana", status: "present" },
        { studentId: "bea", status: "absent" },
        { studentId: "caro", status: "late" },
        { studentId: "dora", status: "excused" },
      ],
    });
  });

  it("skips students who weren't on the page, so they keep what they had", () => {
    expect(parseAttendanceForm(form({ "mark.ana": "absent" }), ["ana", "bea"])).toEqual({
      ok: true,
      marks: [{ studentId: "ana", status: "absent" }],
    });
  });

  it("rejects a mark that isn't one of the four", () => {
    expect(parseAttendanceForm(form({ "mark.ana": "asleep" }), ["ana"])).toEqual({ ok: false });
  });
});
