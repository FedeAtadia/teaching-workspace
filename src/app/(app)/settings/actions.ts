"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { renameSchool } from "@/db/queries/classes";
import { requireTeacherId } from "@/lib/auth";
import type { FormState } from "@/lib/formState";
import { schoolInput, toFieldErrors } from "@/lib/validation";

/** SCHOOL-3 */
export async function renameSchoolAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = schoolInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await renameSchool(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  // The name shows on Classes, Students, class pages and histories.
  revalidatePath("/", "layout");
  return { status: "saved" };
}
