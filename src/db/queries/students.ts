// Reading and writing students. Scoped to one teacher (OWNER-1).

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  academicYears,
  attendance,
  classGroupStudents,
  classSessions,
  classes,
  courseStudents,
  courses,
  exams,
  schools,
  scores,
  standards,
  studentAdaptations,
  students,
  tasks,
  termGrades,
} from "@/db/schema";
import { compareCourses, compareStudents } from "@/lib/courses";
import type { ListedStudent } from "@/lib/students";
import { rosterStatus } from "@/lib/rosterImport";
import type { RosterInput, StudentEdit, StudentInput, StudentMove } from "@/lib/validation";

export type CreateStudentResult =
  | { ok: true; studentId: string }
  | { ok: false; error: "courseNotFound" };

/** STUDENT-1, STUDENT-2 */
export async function createStudent(
  db: Db,
  teacherId: string,
  input: StudentInput,
): Promise<CreateStudentResult> {
  return db.transaction(async (tx) => {
    const [course] = await tx
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, input.courseId), eq(courses.teacherId, teacherId)));
    if (!course) return { ok: false, error: "courseNotFound" } as const;

    const [student] = await tx
      .insert(students)
      .values({ teacherId, firstName: input.firstName, lastName: input.lastName })
      .returning({ id: students.id });
    await tx.insert(courseStudents).values({ teacherId, courseId: course.id, studentId: student.id });
    return { ok: true, studentId: student.id } as const;
  });
}

/**
 * IMPORT-3: adds the students of a list to a course, in one transaction.
 * Whoever is already active in the course under the same name, or is a
 * second copy within the list, is skipped.
 */
export async function importStudents(
  db: Db,
  teacherId: string,
  input: RosterInput,
): Promise<{ ok: true; added: number; skipped: number } | { ok: false; error: "courseNotFound" }> {
  return db.transaction(async (tx) => {
    const [course] = await tx
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, input.courseId), eq(courses.teacherId, teacherId)));
    if (!course) return { ok: false, error: "courseNotFound" } as const;

    const inCourse = await tx
      .select({ firstName: students.firstName, lastName: students.lastName })
      .from(courseStudents)
      .innerJoin(students, eq(courseStudents.studentId, students.id))
      .where(and(eq(courseStudents.courseId, course.id), eq(courseStudents.status, "active")));
    const status = rosterStatus(input.students, inCourse);
    const fresh = input.students.filter((_, i) => status[i] === "new");
    if (fresh.length > 0) {
      const created = await tx
        .insert(students)
        .values(fresh.map((s) => ({ teacherId, firstName: s.firstName, lastName: s.lastName })))
        .returning({ id: students.id });
      await tx
        .insert(courseStudents)
        .values(created.map((s) => ({ teacherId, courseId: course.id, studentId: s.id })));
    }
    return { ok: true, added: fresh.length, skipped: input.students.length - fresh.length } as const;
  });
}

export type StudentRow = ListedStudent;

/** STUDENT-3: every student, with the courses they are active in (newest first, COURSE-3). */
export async function listStudents(db: Db, teacherId: string): Promise<StudentRow[]> {
  const rows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      courseId: courses.id,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      schoolYear: academicYears.name,
      school: schools.name,
      outcome: courseStudents.outcome,
      outcomeOn: courseStudents.outcomeOn,
    })
    .from(students)
    .leftJoin(
      courseStudents,
      and(eq(courseStudents.studentId, students.id), eq(courseStudents.status, "active")),
    )
    .leftJoin(courses, eq(courseStudents.courseId, courses.id))
    .leftJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .leftJoin(schools, eq(courses.schoolId, schools.id))
    .where(eq(students.teacherId, teacherId));

  // One row per student and course; fold them into one entry per student.
  const byId = new Map<string, StudentRow>();
  for (const r of rows) {
    const s = byId.get(r.id) ?? { id: r.id, firstName: r.firstName, lastName: r.lastName, courses: [] };
    if (
      r.courseId !== null &&
      r.year !== null &&
      r.division !== null &&
      r.shift !== null &&
      r.schoolYear !== null &&
      r.school !== null
    ) {
      s.courses.push({
        id: r.courseId,
        year: r.year,
        division: r.division,
        shift: r.shift,
        schoolYear: r.schoolYear,
        school: r.school,
        outcome: r.outcome,
        outcomeOn: r.outcomeOn,
      });
    }
    byId.set(r.id, s);
  }
  const list = [...byId.values()];
  for (const s of list) s.courses.sort(compareCourses);
  return list.sort(compareStudents);
}

type NotFound = { ok: false; error: "notFound" };
const notFound: NotFound = { ok: false, error: "notFound" };

/** STUDENT-7: changes the student's name. */
export async function updateStudent(db: Db, teacherId: string, input: StudentEdit): Promise<{ ok: true } | NotFound> {
  const updated = await db
    .update(students)
    .set({ firstName: input.firstName, lastName: input.lastName })
    .where(and(eq(students.id, input.studentId), eq(students.teacherId, teacherId)))
    .returning({ id: students.id });
  return updated.length > 0 ? { ok: true } : notFound;
}

/**
 * STUDENT-8: takes the student out of one course and puts them in another of
 * the same school year. With something recorded in the old course they stay
 * in it as having left, so their history keeps it; with nothing, it was a
 * mistake and the old course forgets them.
 */
export async function moveStudent(
  db: Db,
  teacherId: string,
  input: StudentMove,
): Promise<{ ok: true } | NotFound | { ok: false; error: "otherYear" }> {
  if (input.fromCourseId === input.toCourseId) return notFound;
  return db.transaction(async (tx) => {
    const [[enrollment], courseRows] = await Promise.all([
      tx
        .select({ status: courseStudents.status })
        .from(courseStudents)
        .where(
          and(
            eq(courseStudents.courseId, input.fromCourseId),
            eq(courseStudents.studentId, input.studentId),
            eq(courseStudents.teacherId, teacherId),
          ),
        ),
      tx
        .select({ id: courses.id, academicYearId: courses.academicYearId })
        .from(courses)
        .where(and(inArray(courses.id, [input.fromCourseId, input.toCourseId]), eq(courses.teacherId, teacherId))),
    ]);
    const from = courseRows.find((c) => c.id === input.fromCourseId);
    const to = courseRows.find((c) => c.id === input.toCourseId);
    if (!enrollment || enrollment.status !== "active" || !from || !to) return notFound;
    if (from.academicYearId !== to.academicYearId) return { ok: false, error: "otherYear" } as const;

    const oldClasses = (
      await tx.select({ id: classes.id }).from(classes).where(eq(classes.courseId, from.id))
    ).map((c) => c.id);
    const inOldCourse = and(
      eq(courseStudents.courseId, from.id),
      eq(courseStudents.studentId, input.studentId),
      eq(courseStudents.teacherId, teacherId),
    );

    if (await hasRecords(tx, input.studentId, oldClasses)) {
      await tx.update(courseStudents).set({ status: "withdrawn" }).where(inOldCourse);
    } else {
      await tx.delete(courseStudents).where(inOldCourse);
    }
    // GROUP-2: they no longer attend the old course's groups.
    if (oldClasses.length > 0) {
      await tx
        .delete(classGroupStudents)
        .where(
          and(eq(classGroupStudents.studentId, input.studentId), inArray(classGroupStudents.classId, oldClasses)),
        );
    }
    await tx
      .insert(courseStudents)
      .values({ teacherId, courseId: to.id, studentId: input.studentId })
      // Coming back to a course they had left.
      .onConflictDoUpdate({
        target: [courseStudents.courseId, courseStudents.studentId],
        set: { status: "active" },
      });
    return { ok: true } as const;
  });
}

/** Whether anything was recorded about the student in these classes. */
async function hasRecords(tx: Db, studentId: string, classIds: string[]): Promise<boolean> {
  if (classIds.length === 0) return false;
  const found = await Promise.all([
    tx
      .select({ id: scores.id })
      .from(scores)
      .innerJoin(tasks, eq(scores.taskId, tasks.id))
      .where(and(eq(scores.studentId, studentId), inArray(tasks.classId, classIds)))
      .limit(1),
    tx
      .select({ id: termGrades.id })
      .from(termGrades)
      .where(and(eq(termGrades.studentId, studentId), inArray(termGrades.classId, classIds)))
      .limit(1),
    tx
      .select({ id: classSessions.id })
      .from(attendance)
      .innerJoin(classSessions, eq(attendance.sessionId, classSessions.id))
      .where(and(eq(attendance.studentId, studentId), inArray(classSessions.classId, classIds)))
      .limit(1),
    tx
      .select({ id: exams.id })
      .from(exams)
      .where(and(eq(exams.studentId, studentId), inArray(exams.classId, classIds)))
      .limit(1),
    tx
      .select({ id: studentAdaptations.classId })
      .from(studentAdaptations)
      .where(and(eq(studentAdaptations.studentId, studentId), inArray(studentAdaptations.classId, classIds)))
      .limit(1),
  ]);
  return found.some((rows) => rows.length > 0);
}

/**
 * STUDENT-4: deletes the student; everything recorded about them goes with
 * them. Answers with the files of their own passing standards (ADAPT-2,
 * FILE-4), for Storage to delete.
 */
export async function deleteStudent(
  db: Db,
  teacherId: string,
  studentId: string,
): Promise<{ ok: true; attachmentPaths: string[] } | { ok: false; error: "notFound" }> {
  if (!z.uuid().safeParse(studentId).success) return { ok: false, error: "notFound" };
  const result = await deleteStudents(db, teacherId, [studentId]);
  return result.deleted > 0 ? { ok: true, attachmentPaths: result.attachmentPaths } : { ok: false, error: "notFound" };
}

/** STUDENT-4, KEEP-1: deletes these students of the teacher, in one transaction. */
export async function deleteStudents(
  db: Db,
  teacherId: string,
  studentIds: string[],
): Promise<{ deleted: number; attachmentPaths: string[] }> {
  if (studentIds.length === 0) return { deleted: 0, attachmentPaths: [] };
  return db.transaction(async (tx) => {
    const files = await tx
      .select({ path: standards.attachmentPath })
      .from(standards)
      .where(
        and(
          eq(standards.teacherId, teacherId),
          inArray(standards.studentId, studentIds),
          isNotNull(standards.attachmentPath),
        ),
      );
    const deleted = await tx
      .delete(students)
      .where(and(inArray(students.id, studentIds), eq(students.teacherId, teacherId)))
      .returning({ id: students.id });
    return { deleted: deleted.length, attachmentPaths: deleted.length > 0 ? files.map((f) => f.path!) : [] };
  });
}
