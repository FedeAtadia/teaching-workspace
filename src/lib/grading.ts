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

/** GRADE-3: the teacher's rules with a class's own pass mark, when it has one. */
export function classRules(rules: GradingRules, classPassMark: number | null): GradingRules {
  return classPassMark === null ? rules : { ...rules, passMark: classPassMark };
}

/** GRADE-4: the widest scale a teacher can set. */
export const SCALE_LIMITS = { min: 0, max: 100 } as const;

export type RulesProblem = "scale" | "passMark" | "termChange";

/**
 * GRADE-4: what is wrong with a set of rules, by field, or nothing. The
 * scale must have room (lowest below highest, within SCALE_LIMITS), the pass
 * mark must be on it, and neither cuatrimestre limit can exceed its width.
 */
export function checkRules(rules: GradingRules): Partial<Record<keyof GradingRules, RulesProblem>> {
  const problems: Partial<Record<keyof GradingRules, RulesProblem>> = {};
  if (rules.gradeMin < SCALE_LIMITS.min) problems.gradeMin = "scale";
  if (rules.gradeMax > SCALE_LIMITS.max || rules.gradeMax <= rules.gradeMin) problems.gradeMax = "scale";
  if (rules.passMark < rules.gradeMin || rules.passMark > rules.gradeMax) problems.passMark = "passMark";
  const width = rules.gradeMax - rules.gradeMin;
  if (rules.maxTermIncrease < 0 || rules.maxTermIncrease > width) problems.maxTermIncrease = "termChange";
  if (rules.maxTermDecrease < 0 || rules.maxTermDecrease > width) problems.maxTermDecrease = "termChange";
  return problems;
}

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
