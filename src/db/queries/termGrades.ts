// A class's cuatrimestre grades (TERM-5..8). Scoped to one teacher (OWNER-1).
// Functions take the class already loaded (and ownership-checked) by `getClass`.

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { courseStudents, scores, tasks, termGrades, terms } from "@/db/schema";
import { suggestTermGrade, type Suggestion } from "@/lib/grading";
import type { TermGradeRow } from "@/lib/termGradesForm";
import { listClassStudents, type ClassDetail, type RosterStudent } from "./classDetail";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

type SheetClass = Pick<ClassDetail, "id" | "courseId" | "academicYearId">;

export type SavedTermGrade = { value: number; notes: string | null; outsideRangeReason: string | null };

export type TermGradeSheetRow = {
  student: RosterStudent;
  /** SUGGEST-1, SUGGEST-2: from this cuatrimestre's tasks. */
  suggestion: Suggestion;
  saved: SavedTermGrade | null;
  /** TERM-6: the 1° grade, on the 2° cuatrimestre's sheet only. */
  firstTerm: number | null;
};

export type TermGradeSheet = { position: number; rows: TermGradeSheetRow[] };

/** The class's cuatrimestre, if `termId` is one of its school year's (TERM-8). */
async function classTerm(db: Db, teacherId: string, cls: SheetClass, termId: string) {
  if (!isUuid(termId)) return { term: undefined, yearTerms: [] };
  const yearTerms = await db
    .select({ id: terms.id, position: terms.position })
    .from(terms)
    .where(and(eq(terms.academicYearId, cls.academicYearId), eq(terms.teacherId, teacherId)));
  return { term: yearTerms.find((t) => t.id === termId), yearTerms };
}

/** TERM-5, TERM-6: one row per active student, in ROSTER-1 order. Null when not found. */
export async function getTermGradeSheet(
  db: Db,
  teacherId: string,
  cls: SheetClass,
  termId: string,
): Promise<TermGradeSheet | null> {
  const { term, yearTerms } = await classTerm(db, teacherId, cls, termId);
  if (!term) return null;
  const first = term.position === 2 ? yearTerms.find((t) => t.position === 1) : undefined;

  const [roster, termScores, grades] = await Promise.all([
    listClassStudents(db, teacherId, cls),
    db
      .select({ studentId: scores.studentId, status: scores.status, value: scores.value })
      .from(scores)
      .innerJoin(tasks, eq(scores.taskId, tasks.id))
      .where(and(eq(tasks.classId, cls.id), eq(tasks.termId, term.id), eq(scores.teacherId, teacherId))),
    db
      .select({
        studentId: termGrades.studentId,
        termId: termGrades.termId,
        value: termGrades.value,
        notes: termGrades.notes,
        outsideRangeReason: termGrades.outsideRangeReason,
      })
      .from(termGrades)
      .where(and(eq(termGrades.classId, cls.id), eq(termGrades.teacherId, teacherId))),
  ]);

  const gradeOf = (studentId: string, id: string | undefined) =>
    grades.find((g) => g.studentId === studentId && g.termId === id);

  return {
    position: term.position,
    rows: roster.map((student) => {
      const saved = gradeOf(student.id, term.id);
      return {
        student,
        suggestion: suggestTermGrade(termScores.filter((s) => s.studentId === student.id)),
        saved: saved
          ? { value: saved.value, notes: saved.notes, outsideRangeReason: saved.outsideRangeReason }
          : null,
        firstTerm: gradeOf(student.id, first?.id)?.value ?? null,
      };
    }),
  };
}

/**
 * TERM-5, TERM-8. Saves all rows or none. Students who aren't active in the
 * class's course are skipped, whatever the form sent.
 */
export async function saveTermGrades(
  db: Db,
  teacherId: string,
  cls: SheetClass,
  termId: string,
  entries: { save: TermGradeRow[]; clear: string[] },
): Promise<{ ok: true } | { ok: false; error: "notFound" }> {
  const [{ term }, roster] = await Promise.all([
    classTerm(db, teacherId, cls, termId),
    db
      .select({ id: courseStudents.studentId })
      .from(courseStudents)
      .where(
        and(
          eq(courseStudents.courseId, cls.courseId),
          eq(courseStudents.teacherId, teacherId),
          eq(courseStudents.status, "active"),
        ),
      ),
  ]);
  if (!term) return { ok: false, error: "notFound" };

  const inCourse = new Set(roster.map((r) => r.id));
  const save = entries.save.filter((r) => inCourse.has(r.studentId));
  const clear = entries.clear.filter((id) => inCourse.has(id));

  await db.transaction(async (tx) => {
    if (clear.length > 0) {
      await tx
        .delete(termGrades)
        .where(
          and(eq(termGrades.classId, cls.id), eq(termGrades.termId, term.id), inArray(termGrades.studentId, clear)),
        );
    }
    if (save.length > 0) {
      await tx
        .insert(termGrades)
        .values(save.map((r) => ({ teacherId, classId: cls.id, termId: term.id, ...r })))
        .onConflictDoUpdate({
          target: [termGrades.classId, termGrades.studentId, termGrades.termId],
          set: {
            value: sql`excluded.value`,
            notes: sql`excluded.notes`,
            outsideRangeReason: sql`excluded.outside_range_reason`,
            setAt: sql`now()`,
          },
        });
    }
  });
  return { ok: true };
}
