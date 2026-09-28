// What the add-class and add-student forms accept. Values arrive as the
// strings a <form> sends; these schemas turn them into typed input or say
// which field is wrong.

import { z } from "zod";
import { SHIFTS } from "./courses";

const name = z.string().trim().min(1).max(80);

/** CLASS-2, CLASS-3 */
export const classInput = z.object({
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

/** STUDENT-1 */
export const studentInput = z.object({
  firstName: name,
  lastName: name,
  courseId: z.uuid(),
});
export type StudentInput = z.infer<typeof studentInput>;

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
