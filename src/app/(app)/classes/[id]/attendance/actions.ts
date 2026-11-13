"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { clearDay, saveAttendance, saveNoClass } from "@/db/queries/attendance";
import { getClass, listClassStudents } from "@/db/queries/classDetail";
import type { AttendanceStatus } from "@/lib/attendance";
import { requireTeacherId } from "@/lib/auth";
import type { FormState } from "@/lib/formState";
import { attendanceSave, noClassInput, toFieldErrors, type AttendanceSave } from "@/lib/validation";

type AttendanceError = "notFound" | "noCalendar" | "outsideYear" | "invalid" | "conflict";
export type AttendanceState = FormState<AttendanceError> & { savedAt?: number };

/** Attendance shows on the tab, the gradebook, the cuatrimestre grades and the histories. */
function refresh(classId: string) {
  revalidatePath(`/classes/${classId}`, "layout");
  revalidatePath("/students", "layout");
}

export type SaveAttendanceResult =
  | { ok: true; version: number }
  | { ok: false; error: "conflict"; current: { held: boolean; marks: Record<string, AttendanceStatus> } }
  | { ok: false; error: "notFound" | "noCalendar" | "outsideYear" | "invalid" };

/**
 * ATT-2, OFFLINE-2..4: one day's marks, from the form or from the phone's
 * queue. Without signal the call waits and goes through when it returns
 * (OFFLINE-1). A day saved since from somewhere else isn't overwritten unless
 * `force` (OFFLINE-3).
 */
export async function saveAttendanceAction(input: AttendanceSave): Promise<SaveAttendanceResult> {
  const parsed = attendanceSave.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, parsed.data.classId);
  if (!cls) return { ok: false, error: "notFound" };

  // Only the course's students are kept; anyone else sent is ignored.
  const roster = new Set((await listClassStudents(db, teacherId, cls)).map((s) => s.id));
  const marks = parsed.data.marks.filter((m) => roster.has(m.studentId));
  const result = await saveAttendance(db, teacherId, cls, parsed.data.date, marks, {
    baseVersion: parsed.data.baseVersion,
    force: parsed.data.force,
  });
  if (!result.ok) {
    if (result.error !== "conflict") return { ok: false, error: result.error };
    return {
      ok: false,
      error: "conflict",
      current: {
        held: result.current.held,
        marks: Object.fromEntries(result.current.marks.map((m) => [m.studentId, m.status])),
      },
    };
  }
  refresh(cls.id);
  return { ok: true, version: result.version };
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
