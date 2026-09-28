"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { createStandard, createUnit } from "@/db/queries/classDetail";
import { requireTeacherId } from "@/lib/auth";
import type { FormState } from "@/lib/formState";
import { standardInput, toFieldErrors, unitInput } from "@/lib/validation";

export async function addStandard(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = standardInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await createStandard(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath(`/classes/${parsed.data.classId}/standards`);
  return { status: "saved" };
}

export async function addUnit(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = unitInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await createUnit(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath(`/classes/${parsed.data.classId}/units`);
  return { status: "saved" };
}
