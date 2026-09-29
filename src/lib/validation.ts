// What the add-class and add-student forms accept. Values arrive as the
// strings a <form> sends; these schemas turn them into typed input or say
// which field is wrong.

import { z } from "zod";
import { SHIFTS } from "./courses";

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

/** STD-1 */
export const standardInput = z.object({
  classId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: optionalText(1000),
});
export type StandardInput = z.infer<typeof standardInput>;

/** UNIT-1: the cuatrimestre is optional; the form's "none" option sends "". */
export const unitInput = z.object({
  classId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  termId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
});
export type UnitInput = z.infer<typeof unitInput>;

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
});
export type TaskInput = z.infer<typeof taskInput>;

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
