// Reading and writing students. Scoped to one teacher (OWNER-1).

import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { academicYears, courseStudents, courses, students } from "@/db/schema";
import { compareCourses, compareStudents, type Shift } from "@/lib/courses";
import type { StudentInput } from "@/lib/validation";

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

export type StudentCourse = { year: number; division: string; shift: Shift; schoolYear: string };
export type StudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  courses: StudentCourse[];
};

/** STUDENT-3 */
export async function listStudents(db: Db, teacherId: string): Promise<StudentRow[]> {
  const rows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      schoolYear: academicYears.name,
    })
    .from(students)
    .leftJoin(
      courseStudents,
      and(eq(courseStudents.studentId, students.id), eq(courseStudents.status, "active")),
    )
    .leftJoin(courses, eq(courseStudents.courseId, courses.id))
    .leftJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .where(eq(students.teacherId, teacherId));

  // One row per student and course; fold them into one entry per student.
  const byId = new Map<string, StudentRow>();
  for (const r of rows) {
    const s = byId.get(r.id) ?? { id: r.id, firstName: r.firstName, lastName: r.lastName, courses: [] };
    if (r.year !== null && r.division !== null && r.shift !== null && r.schoolYear !== null) {
      s.courses.push({ year: r.year, division: r.division, shift: r.shift, schoolYear: r.schoolYear });
    }
    byId.set(r.id, s);
  }
  const list = [...byId.values()];
  for (const s of list) s.courses.sort(compareCourses);
  return list.sort(compareStudents);
}
