import type { FieldError } from "./validation";

/**
 * What a form's Server Action answers with, for `useActionState`.
 * `values` is what was typed, sent back on an error: React clears a form
 * after every submit, and the fields refill from it.
 */
export type FormState<FormError extends string = string> = {
  status: "idle" | "saved" | "error";
  fieldErrors?: Record<string, FieldError>;
  /** A message key for an error that is not about one field. */
  formError?: FormError;
  values?: Record<string, string>;
};
