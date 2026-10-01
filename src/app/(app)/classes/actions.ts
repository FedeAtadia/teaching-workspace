"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { createClass, updateClass } from "@/db/queries/classes";
import { requireTeacherId } from "@/lib/auth";
import { classEdit, classInput, toFieldErrors, type FieldError } from "@/lib/validation";

export type AddClassState = {
  status: "idle" | "saved" | "error";
  fieldErrors?: Record<string, FieldError>;
  /** A message key under `classes.errors`. */
  formError?: "duplicate" | "courseExists" | "notFound";
  /**
   * What was typed, sent back on an error: React clears a form after every
   * submit, and the fields refill from these.
   */
  values?: Record<string, string>;
  savedAt?: number;
};

export async function addClass(_prev: AddClassState, formData: FormData): Promise<AddClassState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = classInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await createClass(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath("/classes");
  revalidatePath("/students");
  return { status: "saved", savedAt: Date.now() };
}

/** CLASS-6. A change to the course shows everywhere it is listed, so every page is refreshed. */
export async function editClass(_prev: AddClassState, formData: FormData): Promise<AddClassState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = classEdit.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await updateClass(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath("/", "layout");
  return { status: "saved", savedAt: Date.now() };
}
