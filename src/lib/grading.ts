// Grading rules. Pure functions only — no database, no React — so every rule
// here can be tested by calling it. Components display these results; they
// never decide pass/fail or ranges themselves.

export type GradingRules = {
  gradeMin: number;
  gradeMax: number;
  passMark: number;
  /** How far the second term may rise above the first (TERM-2). */
  maxTermIncrease: number;
  /** How far the second term may fall below the first (TERM-2). */
  maxTermDecrease: number;
};

/** GRADE-1, GRADE-2, TERM-2: the defaults a new teacher starts with. */
export const DEFAULT_RULES: GradingRules = {
  gradeMin: 1,
  gradeMax: 10,
  passMark: 7,
  maxTermIncrease: 3,
  maxTermDecrease: 3,
};

/** GRADE-2 */
export function isPassing(value: number, rules: GradingRules): boolean {
  return value >= rules.passMark;
}

export type GradeRange = { min: number; max: number };

/** TERM-2, TERM-3 */
export function secondTermRange(firstTermGrade: number, rules: GradingRules): GradeRange {
  return {
    min: Math.max(rules.gradeMin, firstTermGrade - rules.maxTermDecrease),
    max: Math.min(rules.gradeMax, firstTermGrade + rules.maxTermIncrease),
  };
}

export type RangeCheck = "within" | "above" | "below";

/** TERM-4 */
export function checkSecondTermGrade(
  value: number,
  firstTermGrade: number,
  rules: GradingRules,
): RangeCheck {
  const { min, max } = secondTermRange(firstTermGrade, rules);
  if (value > max) return "above";
  if (value < min) return "below";
  return "within";
}

export type ScoreForSuggestion = {
  status: "graded" | "missing" | "excused";
  value: number | null;
};

export type Suggestion = {
  /** Null when nothing has been graded yet. */
  average: number | null;
  graded: number;
  missing: number;
};

/** SUGGEST-1, SUGGEST-2 */
export function suggestTermGrade(scores: ScoreForSuggestion[]): Suggestion {
  const values = scores
    .filter((s) => s.status === "graded" && s.value !== null)
    .map((s) => s.value as number);
  const missing = scores.filter((s) => s.status === "missing").length;
  if (values.length === 0) return { average: null, graded: 0, missing };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { average: Math.round(mean * 100) / 100, graded: values.length, missing };
}

/**
 * INPUT-1..3: read a grade typed by the teacher. Accepts a decimal comma
 * (es-AR) or point, and rejects anything off the scale.
 */
export function parseGrade(input: string, rules: GradingRules): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (value < rules.gradeMin || value > rules.gradeMax) return null;
  return value;
}
