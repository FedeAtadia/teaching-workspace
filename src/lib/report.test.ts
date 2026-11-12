import { describe, expect, it } from "vitest";
import type { HistoryClass, HistoryCourse, StudentHistory } from "@/db/queries/history";
import { buildReport, reportOptions } from "./report";

const klass = (over: Partial<HistoryClass> = {}): HistoryClass => ({
  id: "k1",
  name: "Matemática",
  passMark: 7,
  terms: [
    {
      position: 1,
      tasks: [{ id: "t1", title: "TP 1", dueOn: "2026-04-10", score: { status: "graded", value: 8, notes: null, adapted: false } }],
      suggestion: { average: 8, graded: 1, missing: 2 },
      grade: 7.5,
      attendance: 82,
    },
  ],
  finalGrade: null,
  result: { kind: "pending" },
  exams: [],
  adaptation: "Consignas cortas",
  ...over,
});

const course = (over: Partial<HistoryCourse> = {}): HistoryCourse => ({
  courseId: "c-2026",
  schoolYear: "2026",
  school: "EPET 30",
  year: 5,
  division: "1°",
  shift: "morning",
  status: "active",
  outcome: null,
  classes: [klass()],
  ...over,
});

const history = (courses: HistoryCourse[]): StudentHistory => ({
  student: { id: "s1", firstName: "Ana", lastName: "Pérez" },
  courses,
});
const plain = { tasks: false, adaptations: false };

describe("a student's report (REPORT)", () => {
  it("reports on the course the student is in now, with each class's cuatrimestres (REPORT-1)", () => {
    const report = buildReport(history([course()]), plain)!;
    expect(report.student.lastName).toBe("Pérez");
    expect(report.course).toMatchObject({ courseId: "c-2026", year: 5, division: "1°", school: "EPET 30" });
    expect(report.classes).toHaveLength(1);
    expect(report.classes[0]).toMatchObject({ name: "Matemática", finalGrade: null, result: { kind: "pending" } });
    expect(report.classes[0].terms).toEqual([
      { position: 1, average: 8, missing: 2, grade: 7.5, attendance: 82, tasks: [] },
    ]);
  });

  it("skips a course they left for the one they are in, and takes the course asked for (REPORT-1, REPORT-4)", () => {
    const left = course({ courseId: "c-left", division: "2°", status: "withdrawn" });
    const last = course({ courseId: "c-2025", schoolYear: "2025", year: 4 });
    const h = history([left, course(), last]);
    expect(buildReport(h, plain)!.course.courseId).toBe("c-2026");
    expect(buildReport(h, { ...plain, courseId: "c-2025" })!.course.courseId).toBe("c-2025");
    expect(buildReport(h, { ...plain, courseId: "nope" })!.course.courseId).toBe("c-2026");
    expect(buildReport(h, plain)!.courses.map((c) => c.courseId)).toEqual(["c-left", "c-2026", "c-2025"]);
  });

  it("has no report for a student in no course (REPORT-1)", () => {
    expect(buildReport(history([]), plain)).toBeNull();
  });

  it("names the classes still owed from other courses, not the ones passed since (REPORT-2)", () => {
    const owed = klass({ id: "k2", name: "Física", finalGrade: 4, result: { kind: "owed", grade: 4 } });
    const passed = klass({ id: "k3", name: "Química", finalGrade: 8, result: { kind: "passed", grade: 8 } });
    const last = course({ courseId: "c-2025", schoolYear: "2025", year: 4, classes: [owed, passed] });
    const report = buildReport(history([course(), last]), plain)!;
    expect(report.owedElsewhere).toEqual([{ name: "Física", schoolYear: "2025", year: 4, division: "1°" }]);
    // Reporting on 2025 itself, that class is in the report's own table instead.
    expect(buildReport(history([course(), last]), { ...plain, courseId: "c-2025" })!.owedElsewhere).toEqual([]);
  });

  it("leaves out tasks and adaptations unless they are asked for (REPORT-3)", () => {
    const h = history([course()]);
    const bare = buildReport(h, plain)!.classes[0];
    expect(bare.adaptation).toBeNull();
    expect(bare.terms[0].tasks).toEqual([]);

    const full = buildReport(h, { tasks: true, adaptations: true })!.classes[0];
    expect(full.adaptation).toBe("Consignas cortas");
    expect(full.terms[0].tasks.map((t) => t.title)).toEqual(["TP 1"]);
  });

  it("reads its options from the address (REPORT-3, REPORT-4)", () => {
    expect(reportOptions({})).toEqual({ courseId: undefined, tasks: false, adaptations: false });
    expect(reportOptions({ course: "c-2025", tasks: "1", adaptations: "1" })).toEqual({
      courseId: "c-2025",
      tasks: true,
      adaptations: true,
    });
    expect(reportOptions({ tasks: "yes", course: ["a", "b"] })).toEqual({
      courseId: undefined,
      tasks: false,
      adaptations: false,
    });
  });
});
