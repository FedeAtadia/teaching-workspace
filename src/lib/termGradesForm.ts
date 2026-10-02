// Reads the cuatrimestre grades form of one class (TERM-5, TERM-6). Pure: the
// query layer gets rows ready to save, or the students whose entry is wrong.

import { checkSecondTermGrade, parseGrade, type GradingRules } from "./grading";

export type TermGradeRow = {
  studentId: string;
  value: number;
  notes: string | null;
  /** TERM-4, TERM-6: why a 2° grade is outside its range; null inside it. */
  outsideRangeReason: string | null;
};

export type TermGradeEntryError = "invalidGrade" | "needsGrade" | "notesTooLong" | "reasonRequired" | "reasonTooLong";

export type ParsedTermGrades =
  | { ok: true; save: TermGradeRow[]; clear: string[] }
  | { ok: false; errors: Record<string, TermGradeEntryError> };

const MAX_NOTES = 1000;
const MAX_REASON = 500;

/**
 * `get` reads one form field: `grade.<studentId>`, `notes.<studentId>` or
 * `reason.<studentId>`. Only the given students are read. `firstTerm` holds
 * the 1° grades when reading the 2° cuatrimestre, for its range (TERM-2).
 */
export function parseTermGradesForm(
  get: (name: string) => string | null,
  studentIds: string[],
  rules: GradingRules,
  firstTerm?: Map<string, number>,
): ParsedTermGrades {
  const save: TermGradeRow[] = [];
  const clear: string[] = [];
  const errors: Record<string, TermGradeEntryError> = {};

  for (const studentId of studentIds) {
    const typed = (get(`grade.${studentId}`) ?? "").trim();
    const notes = (get(`notes.${studentId}`) ?? "").trim();
    const reason = (get(`reason.${studentId}`) ?? "").trim();

    if (typed === "") {
      if (notes) errors[studentId] = "needsGrade";
      else clear.push(studentId);
      continue;
    }
    const value = parseGrade(typed, rules);
    if (value === null) {
      errors[studentId] = "invalidGrade";
      continue;
    }
    if (notes.length > MAX_NOTES) {
      errors[studentId] = "notesTooLong";
      continue;
    }

    const first = firstTerm?.get(studentId);
    const outside = first !== undefined && checkSecondTermGrade(value, first, rules) !== "within";
    if (outside && !reason) {
      errors[studentId] = "reasonRequired";
      continue;
    }
    if (outside && reason.length > MAX_REASON) {
      errors[studentId] = "reasonTooLong";
      continue;
    }
    save.push({ studentId, value, notes: notes || null, outsideRangeReason: outside ? reason : null });
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, save, clear };
}
