// DUPLA-1, DUPLA-2: one's own student next to the same student in a class a
// partner shared (SHARE-5), and the way back. Scoped to the viewer (OWNER-1):
// only classes shared with them and their own students are read.

import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { academicYears, classShares, classes, courseStudents, courses, students } from "@/db/schema";
import { matchStudent } from "@/lib/dupla";
import { getSharedStudentHistory, type SharedStudentHistory } from "./sharedStudent";

type Person = { firstName: string; lastName: string; schoolYears: string[] };

/**
 * DUPLA-1: for one of the viewer's students, the same student in each class
 * shared with the viewer, as the guest sees them (SHARE-6), cut down to the
 * classes they were matched in.
 */
export async function getDuplaView(db: Db, viewerId: string, student: Person): Promise<SharedStudentHistory[]> {
  if (student.schoolYears.length === 0) return [];
  const rows = await db
    .select({
      placeId: classShares.classId,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      schoolYear: academicYears.name,
    })
    .from(classShares)
    .innerJoin(classes, eq(classShares.classId, classes.id))
    .innerJoin(courses, eq(classes.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .innerJoin(courseStudents, and(eq(courseStudents.courseId, courses.id), eq(courseStudents.status, "active")))
    .innerJoin(students, eq(courseStudents.studentId, students.id))
    .where(and(eq(classShares.guestId, viewerId), eq(classShares.status, "accepted")));

  const matches = matchStudent(student, rows);
  // One partner student may be matched in several of their shared classes.
  const byStudent = new Map<string, Set<string>>();
  for (const m of matches) byStudent.set(m.studentId, (byStudent.get(m.studentId) ?? new Set()).add(m.placeId));

  const views = await Promise.all(
    [...byStudent.entries()].map(async ([studentId, classIds]) => {
      const history = await getSharedStudentHistory(db, viewerId, studentId);
      if (!history) return null;
      const courses = history.courses
        .map((c) => ({ ...c, classes: c.classes.filter((k) => classIds.has(k.id)) }))
        .filter((c) => c.classes.length > 0);
      return courses.length > 0 ? { ...history, courses } : null;
    }),
  );
  return views.filter((v): v is SharedStudentHistory => v !== null);
}

/**
 * DUPLA-2: from a partner's student (SHARE-6), the viewer's own student of the
 * same name in the same school year, when there is exactly one.
 */
export async function findOwnStudent(db: Db, viewerId: string, partner: Person): Promise<string | null> {
  if (partner.schoolYears.length === 0) return null;
  const rows = await db
    .select({
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      schoolYear: academicYears.name,
    })
    .from(courseStudents)
    .innerJoin(students, eq(courseStudents.studentId, students.id))
    .innerJoin(courses, eq(courseStudents.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .where(and(eq(courseStudents.teacherId, viewerId), eq(courseStudents.status, "active")));
  // All the viewer's courses are one place: two students of that name there is no answer.
  const matches = matchStudent(partner, rows.map((r) => ({ ...r, placeId: "mine" })));
  return matches[0]?.studentId ?? null;
}
