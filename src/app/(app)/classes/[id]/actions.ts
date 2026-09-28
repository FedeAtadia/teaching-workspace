"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { createStandard, createUnit, getClass, listClassStudents } from "@/db/queries/classDetail";
import { createTask, saveScores, setTaskAttachment } from "@/db/queries/tasks";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { requireTeacherId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/formState";
import { DEFAULT_RULES } from "@/lib/grading";
import { parseScoresForm, type ScoreEntryError } from "@/lib/scoresForm";
import { standardInput, taskInput, toFieldErrors, unitInput } from "@/lib/validation";

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

export async function addTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const standardIds = formData.getAll("standardIds").map(String);
  // Checkbox ids go back joined, so the form can re-tick them after an error.
  const values = { ...(Object.fromEntries(formData) as Record<string, string>), standardIds: standardIds.join(",") };
  const parsed = taskInput.safeParse({ ...values, standardIds });
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await createTask(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath(`/classes/${parsed.data.classId}/tasks`);
  return { status: "saved" };
}

export type FileResult = { ok: true } | { ok: false; error: "notFound" };

/** Deletes a file from Storage as the signed-in teacher (their folder only). */
async function deleteStoredFile(path: string) {
  const supabase = await createClient();
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
}

/**
 * FILE-2, FILE-3: called by the browser after it uploaded the file straight
 * to Storage (Server Actions cap request bodies at 1 MB). Records it on the
 * task and deletes the file it replaces.
 */
export async function recordTaskFile(input: {
  classId: string;
  taskId: string;
  path: string;
  name: string;
}): Promise<FileResult> {
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return { ok: false, error: "notFound" };
  const result = await setTaskAttachment(db, teacherId, cls, input.taskId, { path: input.path, name: input.name });
  if (!result.ok) return result;
  if (result.previousPath && result.previousPath !== input.path) await deleteStoredFile(result.previousPath);
  revalidatePath(`/classes/${cls.id}/tasks/${input.taskId}`);
  return { ok: true };
}

/** FILE-3: removes the task's file and the link to it. */
export async function removeTaskFile(input: { classId: string; taskId: string }): Promise<FileResult> {
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return { ok: false, error: "notFound" };
  const result = await setTaskAttachment(db, teacherId, cls, input.taskId, null);
  if (!result.ok) return result;
  if (result.previousPath) await deleteStoredFile(result.previousPath);
  revalidatePath(`/classes/${cls.id}/tasks/${input.taskId}`);
  return { ok: true };
}

export type ScoresState = FormState<"notFound"> & {
  /** Per student id, what is wrong with their entry. */
  scoreErrors?: Record<string, ScoreEntryError>;
  savedAt?: number;
};

/** SCORE-1..4: every student's score for one task, in one save. */
export async function saveTaskScores(_prev: ScoresState, formData: FormData): Promise<ScoresState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, values.classId ?? "");
  if (!cls) return { status: "error", formError: "notFound", values };

  const roster = await listClassStudents(db, teacherId, cls);
  const rules = { ...DEFAULT_RULES, passMark: cls.passMark ?? DEFAULT_RULES.passMark };
  const parsed = parseScoresForm(
    (name) => {
      const v = formData.get(name);
      return typeof v === "string" ? v : null;
    },
    roster.map((s) => s.id),
    rules,
  );
  if (!parsed.ok) return { status: "error", scoreErrors: parsed.errors, values };

  const result = await saveScores(db, teacherId, cls, values.taskId ?? "", parsed);
  if (!result.ok) return { status: "error", formError: "notFound", values };

  revalidatePath(`/classes/${cls.id}/tasks/${values.taskId}`);
  revalidatePath(`/classes/${cls.id}/tasks`);
  revalidatePath(`/classes/${cls.id}/grades`);
  return { status: "saved", savedAt: Date.now() };
}
