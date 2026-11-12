// KEEP-1..4: graduates are kept for a while and then deleted, and the teacher
// is told before and after. Scoped to one teacher (OWNER-1).

import { and, eq, max, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { courseStudents, exams, teacherSettings } from "@/db/schema";
import { addDays, DEFAULT_RETENTION_MONTHS, deletionDate, NOTICE_DAYS, resolveRetention } from "@/lib/retention";
import { isFormer, newestCourse } from "@/lib/students";
import { deleteStudents, listStudents } from "./students";
import { listOwed } from "./yearEnd";

/** KEEP-2 */
export async function getRetentionMonths(db: Db, teacherId: string): Promise<number> {
  const [row] = await db
    .select({ months: teacherSettings.graduateRetentionMonths })
    .from(teacherSettings)
    .where(eq(teacherSettings.teacherId, teacherId));
  return resolveRetention(row?.months);
}

/** KEEP-2: one of RETENTION_OPTIONS, already checked by `retentionInput`. */
export async function setRetentionMonths(db: Db, teacherId: string, months: number): Promise<void> {
  await db
    .insert(teacherSettings)
    .values({ teacherId, graduateRetentionMonths: months })
    .onConflictDoUpdate({
      target: teacherSettings.teacherId,
      set: { graduateRetentionMonths: months, updatedAt: new Date() },
    });
}

export type GraduateDeletion = { studentId: string; firstName: string; lastName: string; deleteOn: string };

/**
 * KEEP-1: the graduates who owe nothing (STUDENT-5), each with the day they
 * will be deleted, soonest first.
 */
export async function listGraduateDeletions(db: Db, teacherId: string, months?: number): Promise<GraduateDeletion[]> {
  const [students, owed, lastExams, retention] = await Promise.all([
    listStudents(db, teacherId),
    listOwed(db, teacherId),
    db
      .select({ studentId: exams.studentId, on: max(exams.takenOn) })
      .from(exams)
      .where(eq(exams.teacherId, teacherId))
      .groupBy(exams.studentId),
    months ?? getRetentionMonths(db, teacherId),
  ]);
  const owing = new Set(owed.flatMap((c) => c.students.map((s) => s.student.id)));
  const lastExam = new Map(lastExams.map((e) => [e.studentId, e.on]));

  return students
    .filter((s) => isFormer(s, owing))
    .flatMap((s) => {
      const graduatedOn = newestCourse(s)?.outcomeOn;
      // Without the day they graduated there is nothing to count from.
      if (!graduatedOn) return [];
      return [
        {
          studentId: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          deleteOn: deletionDate(graduatedOn, lastExam.get(s.id) ?? null, retention),
        },
      ];
    })
    .sort((a, b) => a.deleteOn.localeCompare(b.deleteOn));
}

export type RetentionNotice = {
  /** KEEP-4: graduates deleted since the teacher last dismissed the notice. */
  deleted: { count: number; on: string } | null;
  /** KEEP-3: graduates to be deleted within NOTICE_DAYS, and the first day one goes. */
  soon: { count: number; firstOn: string } | null;
  /** The deleted graduates' own files, for Storage to delete. */
  attachmentPaths: string[];
};

/**
 * KEEP-1, KEEP-3, KEEP-4: deletes the graduates whose day has come, and says
 * what Home should tell the teacher. Run when Home is opened.
 *
 * One round trip when nothing is near: a single query answers whether any
 * graduate could be within reach, and only then is the full list worked out.
 */
export async function runRetention(db: Db, teacherId: string, today: string): Promise<RetentionNotice> {
  const horizon = addDays(today, NOTICE_DAYS);
  const [[settings], [near]] = await Promise.all([
    db
      .select({
        months: teacherSettings.graduateRetentionMonths,
        deleted: teacherSettings.graduatesDeleted,
        deletedOn: teacherSettings.graduatesDeletedOn,
      })
      .from(teacherSettings)
      .where(eq(teacherSettings.teacherId, teacherId)),
    // The earliest any graduate could go is their graduation day plus the period.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(courseStudents)
      .where(
        and(
          eq(courseStudents.teacherId, teacherId),
          eq(courseStudents.outcome, "graduated"),
          sql`${courseStudents.outcomeOn} + make_interval(months => coalesce((select ${teacherSettings.graduateRetentionMonths} from ${teacherSettings} where ${teacherSettings.teacherId} = ${teacherId}), ${DEFAULT_RETENTION_MONTHS})) <= ${horizon}::date`,
        ),
      ),
  ]);
  const months = resolveRetention(settings?.months);
  let deleted = settings && settings.deleted > 0 && settings.deletedOn ? { count: settings.deleted, on: settings.deletedOn } : null;
  if (!near || near.n === 0) return { deleted, soon: null, attachmentPaths: [] };

  const list = await listGraduateDeletions(db, teacherId, months);
  const due = list.filter((g) => g.deleteOn <= today);
  const soon = list.filter((g) => g.deleteOn > today && g.deleteOn <= horizon);

  let attachmentPaths: string[] = [];
  if (due.length > 0) {
    const result = await deleteStudents(
      db,
      teacherId,
      due.map((g) => g.studentId),
    );
    attachmentPaths = result.attachmentPaths;
    if (result.deleted > 0) {
      const [row] = await db
        .insert(teacherSettings)
        .values({ teacherId, graduatesDeleted: result.deleted, graduatesDeletedOn: today })
        .onConflictDoUpdate({
          target: teacherSettings.teacherId,
          set: {
            graduatesDeleted: sql`${teacherSettings.graduatesDeleted} + ${result.deleted}`,
            graduatesDeletedOn: today,
          },
        })
        .returning({ count: teacherSettings.graduatesDeleted });
      deleted = { count: row.count, on: today };
    }
  }
  return {
    deleted,
    soon: soon.length > 0 ? { count: soon.length, firstOn: soon[0].deleteOn } : null,
    attachmentPaths,
  };
}

/** KEEP-4: the teacher has read the notice. */
export async function dismissDeletedNotice(db: Db, teacherId: string): Promise<void> {
  await db
    .update(teacherSettings)
    .set({ graduatesDeleted: 0, graduatesDeletedOn: null })
    .where(eq(teacherSettings.teacherId, teacherId));
}
