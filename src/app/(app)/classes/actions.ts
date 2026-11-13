"use server";

import { copyClassContent, unlinkMissingFiles } from "@/db/queries/copyClass";
import { copyStoredFiles } from "@/lib/supabase/storage";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { createClass, updateClass } from "@/db/queries/classes";
import { requireTeacherId } from "@/lib/auth";
import { classEdit, classCreate, toFieldErrors, type FieldError } from "@/lib/validation";

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

/**
 * The class form as sent: the ticked days of the week (CAL-4) read with
 * getAll, and joined in `values` so an error can re-tick them.
 */
function readClassForm(formData: FormData) {
  const weekdays = formData.getAll("weekdays").map(String);
  const values = { ...(Object.fromEntries(formData) as Record<string, string>), weekdays: weekdays.join(",") };
  return { values, input: { ...values, weekdays } };
}

export async function addClass(_prev: AddClassState, formData: FormData): Promise<AddClassState> {
  const { values, input } = readClassForm(formData);
  const parsed = classCreate.safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const db = getDb();
  const teacherId = await requireTeacherId();
  const result = await createClass(db, teacherId, parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  // COPY-1..3: the content of the class picked, then its files in Storage.
  if (parsed.data.copyFrom) {
    const copy = await copyClassContent(db, teacherId, { fromClassId: parsed.data.copyFrom, toClassId: result.classId });
    if (copy.ok) await unlinkMissingFiles(db, teacherId, await copyStoredFiles(copy.files));
  }

  revalidatePath("/classes");
  revalidatePath("/students");
  return { status: "saved", savedAt: Date.now() };
}

/** CLASS-6. A change to the course shows everywhere it is listed, so every page is refreshed. */
export async function editClass(_prev: AddClassState, formData: FormData): Promise<AddClassState> {
  const { values, input } = readClassForm(formData);
  const parsed = classEdit.safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await updateClass(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath("/", "layout");
  return { status: "saved", savedAt: Date.now() };
}
