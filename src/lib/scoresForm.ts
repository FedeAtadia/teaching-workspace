// Reads the scoring form of one task (SCORE-1..3). Pure: the query layer
// gets rows ready to save, or the list of students whose entry is wrong.

import { parseGrade, type GradingRules } from "./grading";

export type ScoreStatus = "graded" | "missing" | "excused";

export type ScoreRow = {
  studentId: string;
  status: ScoreStatus;
  value: number | null;
  notes: string | null;
};

export type ScoreEntryError = "invalidScore" | "notesTooLong";

export type ParsedScores =
  | { ok: true; save: ScoreRow[]; clear: string[] }
  | { ok: false; errors: Record<string, ScoreEntryError> };

const MAX_NOTES = 1000;

/**
 * `get` reads one form field: `score.<studentId>`, `status.<studentId>` or
 * `notes.<studentId>`. Only the given students are read.
 */
export function parseScoresForm(
  get: (name: string) => string | null,
  studentIds: string[],
  rules: GradingRules,
): ParsedScores {
  const save: ScoreRow[] = [];
  const clear: string[] = [];
  const errors: Record<string, ScoreEntryError> = {};

  for (const studentId of studentIds) {
    const typed = (get(`score.${studentId}`) ?? "").trim();
    const rawStatus = get(`status.${studentId}`);
    const status: ScoreStatus = rawStatus === "missing" || rawStatus === "excused" ? rawStatus : "graded";
    const notes = (get(`notes.${studentId}`) ?? "").trim();

    if (notes.length > MAX_NOTES) {
      errors[studentId] = "notesTooLong";
      continue;
    }
    // SCORE-2: no score for these, even if one was typed before the switch.
    if (status !== "graded") {
      save.push({ studentId, status, value: null, notes: notes || null });
      continue;
    }
    // SCORE-3
    if (typed === "") {
      if (notes) save.push({ studentId, status, value: null, notes });
      else clear.push(studentId);
      continue;
    }
    const value = parseGrade(typed, rules);
    if (value === null) errors[studentId] = "invalidScore";
    else save.push({ studentId, status, value, notes: notes || null });
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, save, clear };
}
