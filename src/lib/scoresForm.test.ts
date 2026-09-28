import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "./grading";
import { parseScoresForm } from "./scoresForm";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

/** The form as the browser sends it: `score.<id>`, `status.<id>`, `notes.<id>`. */
const form = (fields: Record<string, string>) => (name: string) => fields[name] ?? null;

describe("reading the scoring form (SCORE)", () => {
  it("reads each student's score, with a comma or a point, and their notes (SCORE-1)", () => {
    const result = parseScoresForm(
      form({
        [`score.${A}`]: "7,5",
        [`status.${A}`]: "graded",
        [`notes.${A}`]: " Muy prolijo ",
        [`score.${B}`]: "9",
        [`status.${B}`]: "graded",
      }),
      [A, B],
      DEFAULT_RULES,
    );
    expect(result).toEqual({
      ok: true,
      save: [
        { studentId: A, status: "graded", value: 7.5, notes: "Muy prolijo" },
        { studentId: B, status: "graded", value: 9, notes: null },
      ],
      clear: [],
    });
  });

  it("names every student whose score is not a valid grade, and saves nothing (SCORE-1)", () => {
    const result = parseScoresForm(
      form({ [`score.${A}`]: "11", [`score.${B}`]: "8", [`score.${C}`]: "siete" }),
      [A, B, C],
      DEFAULT_RULES,
    );
    expect(result).toEqual({ ok: false, errors: { [A]: "invalidScore", [C]: "invalidScore" } });
  });

  it("rejects notes over 1000 characters (SCORE-1)", () => {
    const result = parseScoresForm(form({ [`notes.${A}`]: "x".repeat(1001) }), [A], DEFAULT_RULES);
    expect(result).toEqual({ ok: false, errors: { [A]: "notesTooLong" } });
  });

  it("stores not handed in and excused without a score, keeping notes (SCORE-2)", () => {
    const result = parseScoresForm(
      form({
        // A score typed before switching the status must not sneak in.
        [`score.${A}`]: "4",
        [`status.${A}`]: "missing",
        [`status.${B}`]: "excused",
        [`notes.${B}`]: "Certificado médico",
      }),
      [A, B],
      DEFAULT_RULES,
    );
    expect(result).toEqual({
      ok: true,
      save: [
        { studentId: A, status: "missing", value: null, notes: null },
        { studentId: B, status: "excused", value: null, notes: "Certificado médico" },
      ],
      clear: [],
    });
  });

  it("clears a student left empty, but keeps notes without a score (SCORE-3)", () => {
    const result = parseScoresForm(
      form({
        [`score.${A}`]: " ",
        [`status.${A}`]: "graded",
        [`score.${B}`]: "",
        [`notes.${B}`]: "Entrega la semana que viene",
      }),
      [A, B],
      DEFAULT_RULES,
    );
    expect(result).toEqual({
      ok: true,
      save: [{ studentId: B, status: "graded", value: null, notes: "Entrega la semana que viene" }],
      clear: [A],
    });
  });

  it("treats an unknown status as a plain score (SCORE-1)", () => {
    const result = parseScoresForm(form({ [`score.${A}`]: "6", [`status.${A}`]: "whatever" }), [A], DEFAULT_RULES);
    expect(result).toMatchObject({ ok: true, save: [{ studentId: A, status: "graded", value: 6 }] });
  });
});
