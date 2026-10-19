"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { addDayOff, addNationalHolidays, deleteDayOff, saveCalendar, updateDayOff } from "@/db/queries/calendar";
import { renameSchool } from "@/db/queries/classes";
import { requireTeacherId } from "@/lib/auth";
import type { FormState } from "@/lib/formState";
import { calendarInput, dayOffEdit, dayOffInput, schoolInput, toFieldErrors } from "@/lib/validation";

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

/** CAL-1..3 change one school's calendar page, and attendance later reads it. */
const refreshCalendar = () => revalidatePath("/settings", "layout");

/** CAL-1 */
export async function saveCalendarAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = calendarInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await saveCalendar(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };
  refreshCalendar();
  return { status: "saved" };
}

/** CAL-2 */
export async function addDayOffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = dayOffInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await addDayOff(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };
  refreshCalendar();
  return { status: "saved" };
}

/** CAL-2 */
export async function editDayOffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = dayOffEdit.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await updateDayOff(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };
  refreshCalendar();
  return { status: "saved" };
}

/** CAL-2 */
export async function removeDayOff(input: { dayOffId: string }): Promise<{ ok: boolean }> {
  const result = await deleteDayOff(getDb(), await requireTeacherId(), input);
  if (result.ok) refreshCalendar();
  return { ok: result.ok };
}

export type AddHolidaysState =
  | { status: "idle" }
  | { status: "saved"; added: number }
  | { status: "error"; error: "notFound" | "noList" };

/** CAL-3 */
export async function addHolidaysAction(_prev: AddHolidaysState, formData: FormData): Promise<AddHolidaysState> {
  const result = await addNationalHolidays(getDb(), await requireTeacherId(), {
    calendarId: String(formData.get("calendarId") ?? ""),
  });
  if (!result.ok) return { status: "error", error: result.error };
  refreshCalendar();
  return { status: "saved", added: result.added };
}
