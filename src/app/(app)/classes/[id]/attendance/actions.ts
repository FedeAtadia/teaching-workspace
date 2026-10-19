"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { clearDay, saveAttendance, saveNoClass } from "@/db/queries/attendance";
import { getClass, listClassStudents } from "@/db/queries/classDetail";
import { parseAttendanceForm } from "@/lib/attendanceForm";
import { requireTeacherId } from "@/lib/auth";
import type { FormState } from "@/lib/formState";
import { noClassInput, toFieldErrors } from "@/lib/validation";

type AttendanceError = "notFound" | "noCalendar" | "outsideYear" | "invalid";
export type AttendanceState = FormState<AttendanceError> & { savedAt?: number };

/** Attendance shows on the tab, the gradebook, the cuatrimestre grades and the histories. */
function refresh(classId: string) {
  revalidatePath(`/classes/${classId}`, "layout");
  revalidatePath("/students", "layout");
}

/** ATT-2: every mark on the page, in one save. */
export async function saveAttendanceAction(_prev: AttendanceState, formData: FormData): Promise<AttendanceState> {
  const db = getDb();
  const teacherId = await requireTeacherId();
  const date = String(formData.get("date") ?? "");
  const cls = await getClass(db, teacherId, String(formData.get("classId") ?? ""));
  if (!cls || !z.iso.date().safeParse(date).success) return { status: "error", formError: "notFound" };

  // Only the course's students are read; anyone else in the form is ignored.
  const roster = await listClassStudents(db, teacherId, cls);
  const parsed = parseAttendanceForm(
    (name) => {
      const v = formData.get(name);
      return typeof v === "string" ? v : null;
    },
    roster.map((s) => s.id),
  );
  if (!parsed.ok) return { status: "error", formError: "invalid" };

  const result = await saveAttendance(db, teacherId, cls, date, parsed.marks);
  if (!result.ok) return { status: "error", formError: result.error };
  refresh(cls.id);
  return { status: "saved", savedAt: Date.now() };
}

/** ATT-3 */
export async function saveNoClassAction(_prev: AttendanceState, formData: FormData): Promise<AttendanceState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = noClassInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, parsed.data.classId);
  if (!cls) return { status: "error", formError: "notFound", values };
  const result = await saveNoClass(db, teacherId, cls, parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };
  refresh(cls.id);
  return { status: "saved", savedAt: Date.now() };
}

/** ATT-3: back to pending. */
export async function clearDayAction(input: { classId: string; date: string }): Promise<{ ok: boolean }> {
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls || !z.iso.date().safeParse(input.date).success) return { ok: false };
  const result = await clearDay(db, teacherId, cls, input.date);
  if (result.ok) refresh(cls.id);
  return { ok: result.ok };
}
