import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "./grading";
import { parseTermGradesForm } from "./termGradesForm";

const form = (fields: Record<string, string>) => (name: string) => fields[name] ?? null;

describe("reading the cuatrimestre grades form (TERM-5, TERM-6)", () => {
  it("saves typed grades with their notes, and clears empty ones (TERM-5)", () => {
    const parsed = parseTermGradesForm(
      form({ "grade.a": " 7,5 ", "notes.a": " Mejoró ", "grade.b": "", "grade.c": "9" }),
      ["a", "b", "c"],
      DEFAULT_RULES,
    );
    expect(parsed).toEqual({
      ok: true,
      save: [
        { studentId: "a", value: 7.5, notes: "Mejoró", outsideRangeReason: null },
        { studentId: "c", value: 9, notes: null, outsideRangeReason: null },
      ],
      clear: ["b"],
    });
  });

  it("only reads the given students", () => {
    const parsed = parseTermGradesForm(form({ "grade.a": "8", "grade.intruder": "10" }), ["a"], DEFAULT_RULES);
    expect(parsed).toMatchObject({ ok: true, save: [{ studentId: "a" }], clear: [] });
  });

  it("rejects a grade typed wrong, notes without a grade, and long notes, saving none (TERM-5)", () => {
    const parsed = parseTermGradesForm(
      form({
        "grade.a": "11",
        "grade.b": "",
        "notes.b": "Falta",
        "grade.c": "8",
        "notes.c": "x".repeat(1001),
        "grade.d": "7",
      }),
      ["a", "b", "c", "d"],
      DEFAULT_RULES,
    );
    expect(parsed).toEqual({ ok: false, errors: { a: "invalidGrade", b: "needsGrade", c: "notesTooLong" } });
  });

  it("asks for a reason outside the 2° cuatrimestre range, and keeps it (TERM-6)", () => {
    // A 4 in the 1° allows 1 to 7 in the 2° (TERM-2).
    const firstTerm = new Map([
      ["a", 4],
      ["b", 4],
      ["c", 4],
    ]);
    const fields = { "grade.a": "9", "grade.b": "9", "reason.b": " Recuperó todo ", "grade.c": "7", "reason.c": "No hace falta" };
    expect(parseTermGradesForm(form(fields), ["a", "b", "c"], DEFAULT_RULES, firstTerm)).toEqual({
      ok: false,
      errors: { a: "reasonRequired" },
    });

    const fixed = parseTermGradesForm(
      form({ ...fields, "reason.a": "Rindió todo" }),
      ["a", "b", "c"],
      DEFAULT_RULES,
      firstTerm,
    );
    expect(fixed).toMatchObject({
      ok: true,
      save: [
        { studentId: "a", value: 9, outsideRangeReason: "Rindió todo" },
        { studentId: "b", value: 9, outsideRangeReason: "Recuperó todo" },
        // Inside the range, no reason is kept.
        { studentId: "c", value: 7, outsideRangeReason: null },
      ],
    });
  });

  it("has no range for a student without a 1° grade, and caps the reason (TERM-6)", () => {
    const firstTerm = new Map([["a", 4]]);
    const parsed = parseTermGradesForm(
      form({ "grade.a": "10", "reason.a": "x".repeat(501), "grade.b": "10" }),
      ["a", "b"],
      DEFAULT_RULES,
      firstTerm,
    );
    expect(parsed).toEqual({ ok: false, errors: { a: "reasonTooLong" } });
  });
});
