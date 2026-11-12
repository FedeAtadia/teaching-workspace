"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { createStudent, deleteStudent, importStudents, moveStudent, updateStudent } from "@/db/queries/students";
import { requireTeacherId } from "@/lib/auth";
import { removeStoredFiles } from "@/lib/supabase/storage";
import type { FormState } from "@/lib/formState";
import { rosterInput, studentEdit, studentInput, studentMove, toFieldErrors, type FieldError } from "@/lib/validation";

export type AddStudentState = {
  status: "idle" | "saved" | "error";
  fieldErrors?: Record<string, FieldError>;
  /** A message key under `students.errors`. */
  formError?: "courseNotFound";
  /** Who was just added, for the "Added Pérez, Ana" line. */
  added?: { firstName: string; lastName: string };
  /** What the fields refill with after React clears the form (see AddClassState). */
  values?: Record<string, string>;
  savedAt?: number;
};

export async function addStudent(_prev: AddStudentState, formData: FormData): Promise<AddStudentState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = studentInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await createStudent(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath("/students");
  revalidatePath("/classes");
  const { firstName, lastName, courseId } = parsed.data;
  // Keep the course picked: a whole course is usually typed in one go.
  return { status: "saved", added: { firstName, lastName }, values: { courseId }, savedAt: Date.now() };
}

/** IMPORT-3, IMPORT-4: adds the students the teacher left ticked in the preview. */
export async function importRosterAction(input: {
  courseId: string;
  students: { firstName: string; lastName: string }[];
}): Promise<{ ok: true; added: number; skipped: number } | { ok: false; error: "courseNotFound" | "invalid" }> {
  const parsed = rosterInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await importStudents(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return result;
  // Class pages, gradebooks, attendance and Home count them.
  revalidatePath("/", "layout");
  return result;
}

/** STUDENT-4: deletes the student and everything recorded about them, then goes back to the list. */
export async function removeStudent(input: { studentId: string }): Promise<{ ok: boolean }> {
  const result = await deleteStudent(getDb(), await requireTeacherId(), input.studentId);
  if (!result.ok) return { ok: false };
  await removeStoredFiles(result.attachmentPaths);
  // Class pages, gradebooks, attendance, Previas and Home all showed them.
  revalidatePath("/", "layout");
  redirect("/students");
}

/** STUDENT-7 */
export async function editStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = studentEdit.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await updateStudent(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };
  // The name shows on class pages, gradebooks, attendance, Previas and Home.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

/** STUDENT-8 */
export async function moveStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = studentMove.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await moveStudent(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };
  revalidatePath("/", "layout");
  return { status: "saved" };
}
