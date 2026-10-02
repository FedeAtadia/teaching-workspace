// What the add-class and add-student forms accept. Values arrive as the
// strings a <form> sends; these schemas turn them into typed input or say
// which field is wrong.

import { z } from "zod";
import { SHIFTS } from "./courses";
import { DEFAULT_RULES, parseGrade } from "./grading";
import { YEAR_OUTCOMES } from "./yearEnd";

const name = z.string().trim().min(1).max(80);

const schoolName = z.string().trim().min(1).max(120);

/** CLASS-2, CLASS-3, SCHOOL-1 */
export const classInput = z.object({
  school: schoolName,
  name,
  year: z.coerce.number().int().min(1).max(6),
  division: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .transform((d) => d.toUpperCase()),
  shift: z.enum(SHIFTS),
  schoolYear: z.coerce.number().int().min(2000).max(2100),
});
export type ClassInput = z.infer<typeof classInput>;

/** CLASS-6 */
export const classEdit = classInput.extend({ classId: z.uuid() });
export type ClassEdit = z.infer<typeof classEdit>;

/** SCHOOL-3: renaming one of the teacher's schools. */
export const schoolInput = z.object({
  schoolId: z.uuid(),
  name: schoolName,
});
export type SchoolInput = z.infer<typeof schoolInput>;

/** STUDENT-1 */
export const studentInput = z.object({
  firstName: name,
  lastName: name,
  courseId: z.uuid(),
});
export type StudentInput = z.infer<typeof studentInput>;

/** Optional free text: trimmed, and an empty field is stored as null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null);

/** STD-1; ADAPT-2: with `studentId`, that student's own standard. */
export const standardInput = z.object({
  classId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: optionalText(1000),
  studentId: z
    .union([z.literal(""), z.uuid()])
    .optional()
    .transform((v) => v || null),
});
export type StandardInput = z.infer<typeof standardInput>;

/** STD-3 */
export const standardEdit = standardInput.extend({ standardId: z.uuid() });
export type StandardEdit = z.infer<typeof standardEdit>;

/** UNIT-1: the cuatrimestre is optional; the form's "none" option sends "". */
export const unitInput = z.object({
  classId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  termId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
});
export type UnitInput = z.infer<typeof unitInput>;

/** UNIT-3 */
export const unitEdit = unitInput.extend({ unitId: z.uuid() });
export type UnitEdit = z.infer<typeof unitEdit>;

const optionalUuid = z.union([z.literal(""), z.uuid()]).transform((v) => v || null);

/**
 * TASK-1, TASK-2. `standardIds` comes from checkboxes, so the action reads it
 * with `formData.getAll` rather than `Object.fromEntries`.
 */
export const taskInput = z.object({
  classId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  termId: z.uuid(),
  unitId: optionalUuid,
  dueOn: z.union([z.literal(""), z.iso.date()]).transform((v) => v || null),
  description: optionalText(280),
  criteria: optionalText(1000),
  standardIds: z.array(z.uuid()),
  /** ADAPT-3: left out when the class has no adapted students; the saved ones stay. */
  adaptedDescription: optionalText(280).optional(),
  adaptedCriteria: optionalText(1000).optional(),
  /** GROUP-3: none (or left out) means the task is for everyone. */
  groups: z
    .array(
      z.object({
        groupId: z.uuid(),
        dueOn: z.union([z.literal(""), z.iso.date()]).transform((v) => v || null),
      }),
    )
    .optional(),
});
export type TaskInput = z.infer<typeof taskInput>;

/** TASK-6 */
export const taskEdit = taskInput.extend({ taskId: z.uuid() });
export type TaskEdit = z.infer<typeof taskEdit>;

/**
 * EXAM-1. The grade arrives as typed (`7,5`) and leaves as `value`: a number
 * for a graded exam, null when the student was absent.
 */
export const examInput = z
  .object({
    classId: z.uuid(),
    studentId: z.uuid(),
    takenOn: z.iso.date(),
    status: z.enum(["graded", "absent"]),
    grade: z.string(),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.status === "graded" && parseGrade(v.grade, DEFAULT_RULES) === null) {
      ctx.addIssue({ code: "custom", path: ["grade"], message: "invalid" });
    }
  })
  .transform(({ grade, ...rest }) => ({
    ...rest,
    value: rest.status === "graded" ? parseGrade(grade, DEFAULT_RULES) : null,
  }));
export type ExamInput = z.infer<typeof examInput>;

/** YEAR-2: one student's outcome; the form's "undecided" option sends "". */
export const outcomeInput = z.object({
  classId: z.uuid(),
  studentId: z.uuid(),
  outcome: z.union([z.literal(""), z.enum(YEAR_OUTCOMES)]).transform((v) => v || null),
});
export type OutcomeInput = z.infer<typeof outcomeInput>;

/** ADAPT-1: what is adapted; saved empty, the adaptation is removed. */
export const adaptationInput = z.object({
  classId: z.uuid(),
  studentId: z.uuid(),
  notes: z.string().trim().max(2000),
});
export type AdaptationInput = z.infer<typeof adaptationInput>;

/** GROUP-1 */
export const groupInput = z.object({
  classId: z.uuid(),
  name: z.string().trim().min(1).max(60),
  days: optionalText(120),
});
export type GroupInput = z.infer<typeof groupInput>;

export const groupEdit = groupInput.extend({ groupId: z.uuid() });
export type GroupEdit = z.infer<typeof groupEdit>;

/** GROUP-2: the form's "no group" option sends "". */
export const studentGroupInput = z.object({
  classId: z.uuid(),
  studentId: z.uuid(),
  groupId: optionalUuid,
});
export type StudentGroupInput = z.infer<typeof studentGroupInput>;

/** A message key per field, looked up under `errors.` in messages/. */
export type FieldError = "required" | "tooLong" | "invalid";

export function toFieldErrors(error: z.ZodError): Record<string, FieldError> {
  const out: Record<string, FieldError> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    if (field in out) continue;
    const onText = "origin" in issue && issue.origin === "string";
    out[field] =
      issue.code === "too_small" && onText
        ? "required"
        : issue.code === "too_big" && onText
          ? "tooLong"
          : "invalid";
  }
  return out;
}
