// Adaptations (ADAPT-1, ADAPT-2). Scoped to one teacher (OWNER-1, ADAPT-5).
// Only what is adapted is kept, never a diagnosis.

import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { courseStudents, standards, studentAdaptations } from "@/db/schema";
import type { AdaptationInput } from "@/lib/validation";
import type { ClassDetail, StandardRow } from "./classDetail";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

/** ADAPT-1: each adapted student's text in the class. */
export async function getAdaptations(db: Db, teacherId: string, classId: string): Promise<Map<string, string>> {
  if (!isUuid(classId)) return new Map();
  const rows = await db
    .select({ studentId: studentAdaptations.studentId, notes: studentAdaptations.notes })
    .from(studentAdaptations)
    .where(and(eq(studentAdaptations.classId, classId), eq(studentAdaptations.teacherId, teacherId)));
  return new Map(rows.map((r) => [r.studentId, r.notes]));
}

/**
 * ADAPT-1: set or change a student's adaptation; an empty text removes it.
 * Only for an active student of the class's course.
 */
export async function setAdaptation(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id" | "courseId">,
  input: Pick<AdaptationInput, "studentId" | "notes">,
): Promise<{ ok: true } | { ok: false; error: "notFound" }> {
  if (!isUuid(input.studentId)) return { ok: false, error: "notFound" };
  const [member] = await db
    .select({ id: courseStudents.studentId })
    .from(courseStudents)
    .where(
      and(
        eq(courseStudents.courseId, cls.courseId),
        eq(courseStudents.studentId, input.studentId),
        eq(courseStudents.teacherId, teacherId),
        eq(courseStudents.status, "active"),
      ),
    );
  if (!member) return { ok: false, error: "notFound" };

  if (input.notes === "") {
    await db
      .delete(studentAdaptations)
      .where(and(eq(studentAdaptations.classId, cls.id), eq(studentAdaptations.studentId, input.studentId)));
  } else {
    await db
      .insert(studentAdaptations)
      .values({ teacherId, classId: cls.id, studentId: input.studentId, notes: input.notes })
      .onConflictDoUpdate({
        target: [studentAdaptations.classId, studentAdaptations.studentId],
        set: { notes: input.notes, updatedAt: sql`now()` },
      });
  }
  return { ok: true };
}

/** Whether the student has an adaptation in the class (ADAPT-2: needed for their own standards). */
export async function hasAdaptation(db: Db, teacherId: string, classId: string, studentId: string): Promise<boolean> {
  if (!isUuid(classId) || !isUuid(studentId)) return false;
  const rows = await db
    .select({ id: studentAdaptations.studentId })
    .from(studentAdaptations)
    .where(
      and(
        eq(studentAdaptations.classId, classId),
        eq(studentAdaptations.studentId, studentId),
        eq(studentAdaptations.teacherId, teacherId),
      ),
    );
  return rows.length > 0;
}

export type StudentStandards = { studentId: string; standards: StandardRow[] };

/**
 * ADAPT-2: each adapted student's own standards, in the order added. Students
 * whose adaptation was removed are left out (their standards stay, hidden).
 */
export async function listStudentStandards(db: Db, teacherId: string, classId: string): Promise<StudentStandards[]> {
  const adapted = [...(await getAdaptations(db, teacherId, classId)).keys()];
  if (adapted.length === 0) return [];
  const rows = await db
    .select({
      id: standards.id,
      studentId: standards.studentId,
      title: standards.title,
      description: standards.description,
      attachmentName: standards.attachmentName,
    })
    .from(standards)
    .where(
      and(
        eq(standards.classId, classId),
        eq(standards.teacherId, teacherId),
        isNotNull(standards.studentId),
        inArray(standards.studentId, adapted),
      ),
    )
    .orderBy(asc(standards.position));
  // Their own standards can't be linked to tasks (ADAPT-2), so none have tasks.
  const byStudent = new Map<string, StandardRow[]>();
  for (const { studentId, ...r } of rows) {
    byStudent.set(studentId!, [...(byStudent.get(studentId!) ?? []), { ...r, tasks: 0 }]);
  }
  return [...byStudent.entries()].map(([studentId, list]) => ({ studentId, standards: list }));
}

