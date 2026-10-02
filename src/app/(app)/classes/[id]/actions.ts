"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  createStandard,
  createUnit,
  deleteStandard,
  deleteUnit,
  getClass,
  listClassStudents,
  setStandardAttachment,
  updateStandard,
  updateUnit,
} from "@/db/queries/classDetail";
import { redirect } from "next/navigation";
import { deleteClass } from "@/db/queries/classes";
import { createGroup, deleteGroup, setStudentGroup, updateGroup } from "@/db/queries/groups";
import { bringStudents } from "@/db/queries/nextYear";
import { createTask, deleteTask, saveScores, setTaskAttachment, updateTask } from "@/db/queries/tasks";
import { getTermGradeSheet, saveTermGrades } from "@/db/queries/termGrades";
import { deleteExam, recordExam, setOutcome } from "@/db/queries/yearEnd";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { requireTeacherId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/formState";
import { DEFAULT_RULES } from "@/lib/grading";
import { parseScoresForm, rowsInForm, type ScoreEntryError } from "@/lib/scoresForm";
import { parseTermGradesForm, type TermGradeEntryError } from "@/lib/termGradesForm";
import {
  examInput,
  groupEdit,
  groupInput,
  outcomeInput,
  standardEdit,
  standardInput,
  studentGroupInput,
  taskEdit,
  taskInput,
  toFieldErrors,
  unitEdit,
  unitInput,
} from "@/lib/validation";

export async function addStandard(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = standardInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await createStandard(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath(`/classes/${parsed.data.classId}/standards`);
  return { status: "saved" };
}

/**
 * After a change or a deletion: every tab of the class, since a standard's or
 * unit's name also shows on the tasks.
 */
function refreshClass(classId: string) {
  revalidatePath(`/classes/${classId}`, "layout");
}

/** STD-3 */
export async function editStandard(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = standardEdit.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await updateStandard(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  refreshClass(parsed.data.classId);
  return { status: "saved" };
}

/** STD-4, FILE-4: the standard and its file. */
export async function removeStandard(input: { classId: string; standardId: string }): Promise<ActionResult> {
  const result = await deleteStandard(getDb(), await requireTeacherId(), input);
  if (!result.ok) return result;
  if (result.attachmentPath) await deleteStoredFiles(result.attachmentPath);
  refreshClass(input.classId);
  return { ok: true };
}

/**
 * FILE-4: called by the browser after it uploaded the standard's file
 * straight to Storage. Records it and deletes the file it replaces.
 */
export async function recordStandardFile(input: {
  classId: string;
  standardId: string;
  path: string;
  name: string;
}): Promise<ActionResult> {
  const result = await setStandardAttachment(getDb(), await requireTeacherId(), input, {
    path: input.path,
    name: input.name,
  });
  if (!result.ok) return result;
  if (result.previousPath && result.previousPath !== input.path) await deleteStoredFiles(result.previousPath);
  revalidatePath(`/classes/${input.classId}/standards`);
  return { ok: true };
}

/** FILE-4: removes the standard's file and the link to it. */
export async function removeStandardFile(input: { classId: string; standardId: string }): Promise<ActionResult> {
  const result = await setStandardAttachment(getDb(), await requireTeacherId(), input, null);
  if (!result.ok) return result;
  if (result.previousPath) await deleteStoredFiles(result.previousPath);
  revalidatePath(`/classes/${input.classId}/standards`);
  return { ok: true };
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

/** UNIT-3 */
export async function editUnit(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = unitEdit.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await updateUnit(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  refreshClass(parsed.data.classId);
  return { status: "saved" };
}

/** UNIT-4 */
export async function removeUnit(input: { classId: string; unitId: string }): Promise<ActionResult> {
  const result = await deleteUnit(getDb(), await requireTeacherId(), input);
  if (result.ok) refreshClass(input.classId);
  return result;
}

/**
 * The task form as sent: checkbox lists read with getAll, and each ticked
 * group's date from `groupDue.<id>` (GROUP-3). `values` goes back on an
 * error, with checkbox ids joined so the form can re-tick them.
 */
function readTaskForm(formData: FormData) {
  const standardIds = formData.getAll("standardIds").map(String);
  const groupIds = formData.getAll("groupIds").map(String);
  const values = {
    ...(Object.fromEntries(formData) as Record<string, string>),
    standardIds: standardIds.join(","),
    groupIds: groupIds.join(","),
  };
  const groups = groupIds.map((groupId) => ({ groupId, dueOn: String(formData.get(`groupDue.${groupId}`) ?? "") }));
  return { values, input: { ...values, standardIds, groups } };
}

export async function addTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const { values, input } = readTaskForm(formData);
  const parsed = taskInput.safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await createTask(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  revalidatePath(`/classes/${parsed.data.classId}/tasks`);
  return { status: "saved" };
}

/** TASK-6 */
export async function editTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const { values, input } = readTaskForm(formData);
  const parsed = taskEdit.safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await updateTask(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  refreshClass(parsed.data.classId);
  return { status: "saved" };
}

export type ActionResult = { ok: true } | { ok: false; error: "notFound" };

/** Deletes files from Storage as the signed-in teacher (their folder only), in one request. */
async function deleteStoredFiles(...paths: string[]) {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
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
}): Promise<ActionResult> {
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return { ok: false, error: "notFound" };
  const result = await setTaskAttachment(db, teacherId, cls, input.taskId, { path: input.path, name: input.name });
  if (!result.ok) return result;
  if (result.previousPath && result.previousPath !== input.path) await deleteStoredFiles(result.previousPath);
  revalidatePath(`/classes/${cls.id}/tasks/${input.taskId}`);
  return { ok: true };
}

/** FILE-3: removes the task's file and the link to it. */
export async function removeTaskFile(input: { classId: string; taskId: string }): Promise<ActionResult> {
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return { ok: false, error: "notFound" };
  const result = await setTaskAttachment(db, teacherId, cls, input.taskId, null);
  if (!result.ok) return result;
  if (result.previousPath) await deleteStoredFiles(result.previousPath);
  revalidatePath(`/classes/${cls.id}/tasks/${input.taskId}`);
  return { ok: true };
}

/** CLASS-7: deletes the class, its work and its files, then goes back to the list. */
export async function removeClass(input: { classId: string }): Promise<ActionResult> {
  const result = await deleteClass(getDb(), await requireTeacherId(), input.classId);
  if (!result.ok) return result;
  await deleteStoredFiles(...result.attachmentPaths);
  revalidatePath("/", "layout");
  redirect("/classes");
}

/** TASK-5: deletes the task, its scores and its file, then goes back to Tasks. */
export async function deleteTaskAction(input: { classId: string; taskId: string }): Promise<ActionResult> {
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return { ok: false, error: "notFound" };
  const result = await deleteTask(db, teacherId, cls, input.taskId);
  if (!result.ok) return result;
  if (result.attachmentPath) await deleteStoredFiles(result.attachmentPath);
  revalidatePath(`/classes/${cls.id}/tasks`);
  revalidatePath(`/classes/${cls.id}/grades`);
  redirect(`/classes/${cls.id}/tasks`);
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
    // GROUP-6: only the rows on the page; a filtered page leaves other students alone.
    rowsInForm((name) => formData.has(name), roster.map((s) => s.id)),
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

export type TermGradesState = FormState<"notFound"> & {
  /** Per student id, what is wrong with their entry. */
  gradeErrors?: Record<string, TermGradeEntryError>;
  savedAt?: number;
};

/** TERM-5, TERM-6: every student's grade for one cuatrimestre, in one save. */
export async function saveTermGradesAction(_prev: TermGradesState, formData: FormData): Promise<TermGradesState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, values.classId ?? "");
  const sheet = cls && (await getTermGradeSheet(db, teacherId, cls, values.termId ?? ""));
  if (!cls || !sheet) return { status: "error", formError: "notFound", values };

  const rules = { ...DEFAULT_RULES, passMark: cls.passMark ?? DEFAULT_RULES.passMark };
  // TERM-6: the 2° grades are checked against the 1° ones as saved.
  const firstTerm = new Map(sheet.rows.flatMap((r) => (r.firstTerm === null ? [] : [[r.student.id, r.firstTerm]])));
  const parsed = parseTermGradesForm(
    (name) => {
      const v = formData.get(name);
      return typeof v === "string" ? v : null;
    },
    sheet.rows.map((r) => r.student.id),
    rules,
    firstTerm,
  );
  if (!parsed.ok) return { status: "error", gradeErrors: parsed.errors, values };

  const result = await saveTermGrades(db, teacherId, cls, values.termId ?? "", parsed);
  if (!result.ok) return { status: "error", formError: "notFound", values };

  revalidatePath(`/classes/${cls.id}`, "layout");
  revalidatePath("/students/[id]", "page");
  return { status: "saved", savedAt: Date.now() };
}

/** After a result or an outcome changes: the class, the Previas page, Home and student histories. */
function refreshYearEnd(classId: string) {
  revalidatePath(`/classes/${classId}`, "layout");
  revalidatePath("/exams");
  revalidatePath("/dashboard");
  revalidatePath("/students/[id]", "page");
}

/** YEAR-2: saved as soon as the teacher picks it. */
export async function setOutcomeAction(input: {
  classId: string;
  studentId: string;
  outcome: string;
}): Promise<{ ok: boolean }> {
  const parsed = outcomeInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const result = await setOutcome(getDb(), await requireTeacherId(), parsed.data);
  if (result.ok) refreshYearEnd(parsed.data.classId);
  return { ok: result.ok };
}

/** EXAM-1 */
export async function recordExamAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = examInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await recordExam(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  refreshYearEnd(parsed.data.classId);
  return { status: "saved" };
}

/** EXAM-2 */
export async function removeExam(input: { classId: string; examId: string }): Promise<ActionResult> {
  const result = await deleteExam(getDb(), await requireTeacherId(), input);
  if (result.ok) refreshYearEnd(input.classId);
  return result;
}

export type BringState = FormState<"notFound"> & { added?: number };

/** NEXT-2, NEXT-3: adds the ticked students to the class's course. */
export async function bringStudentsAction(_prev: BringState, formData: FormData): Promise<BringState> {
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, String(formData.get("classId") ?? ""));
  if (!cls) return { status: "error", formError: "notFound" };

  const result = await bringStudents(db, teacherId, cls, formData.getAll("studentIds").map(String));
  revalidatePath(`/classes/${cls.id}`, "layout");
  revalidatePath("/students");
  revalidatePath("/dashboard");
  return { status: "saved", added: result.added };
}

/** GROUP-1 */
export async function addGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = groupInput.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await createGroup(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  refreshClass(parsed.data.classId);
  return { status: "saved" };
}

/** GROUP-1 */
export async function editGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = groupEdit.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const result = await updateGroup(getDb(), await requireTeacherId(), parsed.data);
  if (!result.ok) return { status: "error", formError: result.error, values };

  refreshClass(parsed.data.classId);
  return { status: "saved" };
}

/** GROUP-1 */
export async function removeGroup(input: { classId: string; groupId: string }): Promise<ActionResult> {
  const result = await deleteGroup(getDb(), await requireTeacherId(), input);
  if (result.ok) {
    refreshClass(input.classId);
    revalidatePath("/dashboard");
  }
  return result;
}

/** GROUP-2: saved as soon as the teacher picks it. */
export async function setStudentGroupAction(input: {
  classId: string;
  studentId: string;
  groupId: string;
}): Promise<{ ok: boolean }> {
  const parsed = studentGroupInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, parsed.data.classId);
  if (!cls) return { ok: false };
  const result = await setStudentGroup(db, teacherId, cls, parsed.data);
  if (result.ok) {
    refreshClass(cls.id);
    revalidatePath("/dashboard");
  }
  return { ok: result.ok };
}
