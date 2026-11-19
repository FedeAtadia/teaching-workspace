// SHARE-6: a student of a class shared with the viewer, seen read-only: only
// the shared classes, and adaptations only where the owner allows them.

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { classShares, classes, courseStudents } from "@/db/schema";
import { getStudentHistory, type StudentHistory } from "./history";

export type SharedStudentHistory = StudentHistory & { ownerName: string | null };

/**
 * The owner's history of the student (HISTORY-1..5), cut down to the classes
 * shared with the viewer and accepted; null when no shared class has them.
 */
export async function getSharedStudentHistory(
  db: Db,
  viewerId: string,
  studentId: string,
): Promise<SharedStudentHistory | null> {
  if (!z.uuid().safeParse(studentId).success) return null;
  const shares = await db
    .select({
      classId: classShares.classId,
      ownerId: classShares.teacherId,
      ownerName: classShares.ownerName,
      includeAdaptations: classShares.includeAdaptations,
    })
    .from(classShares)
    .innerJoin(classes, eq(classShares.classId, classes.id))
    .innerJoin(
      courseStudents,
      and(eq(courseStudents.courseId, classes.courseId), eq(courseStudents.studentId, studentId)),
    )
    .where(and(eq(classShares.guestId, viewerId), eq(classShares.status, "accepted")));
  if (shares.length === 0) return null;

  // A student belongs to one teacher, so every share that has them is that teacher's.
  const { ownerId, ownerName } = shares[0];
  const history = await getStudentHistory(db, ownerId, studentId);
  if (!history) return null;
  const allowed = new Map(shares.filter((s) => s.ownerId === ownerId).map((s) => [s.classId, s.includeAdaptations]));

  const courses = history.courses
    .map((course) => ({
      ...course,
      classes: course.classes
        .filter((c) => allowed.has(c.id))
        .map((c) => ({ ...c, adaptation: allowed.get(c.id) ? c.adaptation : null })),
    }))
    .filter((course) => course.classes.length > 0);
  return { student: history.student, courses, ownerName };
}
