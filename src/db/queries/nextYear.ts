// Bringing students into next year's course (NEXT-1..3). Scoped to one
// teacher (OWNER-1). Takes the class already loaded by `getClass`.

import { and, eq, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { academicYears, courseStudents, courses, schools, students } from "@/db/schema";
import { compareCourses, compareStudents, type Shift } from "@/lib/courses";
import type { ClassDetail, RosterStudent } from "./classDetail";

type TargetClass = Pick<ClassDetail, "courseId" | "year" | "schoolYear">;

export type CandidateGroup = {
  courseId: string;
  schoolYear: string;
  school: string;
  year: number;
  division: string;
  shift: Shift;
  /** Why they come: moving up from the year below, or repeating this one. */
  outcome: "promoted" | "repeats";
  students: RosterStudent[];
};

/** NEXT-1, NEXT-2: by old course, in COURSE-3 order. One query. */
export async function listNextYearCandidates(
  db: Db,
  teacherId: string,
  cls: TargetClass,
): Promise<CandidateGroup[]> {
  const previous = Number(cls.schoolYear) - 1;
  if (!Number.isInteger(previous)) return [];

  const rows = await db
    .select({
      courseId: courses.id,
      schoolYear: academicYears.name,
      school: schools.name,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      outcome: courseStudents.outcome,
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
    })
    .from(courseStudents)
    .innerJoin(courses, eq(courseStudents.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .innerJoin(schools, eq(courses.schoolId, schools.id))
    .innerJoin(students, eq(courseStudents.studentId, students.id))
    .where(
      and(
        eq(courseStudents.teacherId, teacherId),
        eq(courseStudents.status, "active"),
        eq(academicYears.name, String(previous)),
        // The same school as this class's course.
        sql`${courses.schoolId} = (select t.school_id from ${courses} t where t.id = ${cls.courseId})`,
        or(
          and(eq(courses.year, cls.year - 1), eq(courseStudents.outcome, "promoted")),
          and(eq(courses.year, cls.year), eq(courseStudents.outcome, "repeats")),
        ),
        // Not already in this course.
        sql`${students.id} not in (select s.student_id from ${courseStudents} s where s.course_id = ${cls.courseId})`,
      ),
    );

  const groups = new Map<string, CandidateGroup>();
  for (const r of rows) {
    const group = groups.get(r.courseId) ?? {
      courseId: r.courseId,
      schoolYear: r.schoolYear,
      school: r.school,
      year: r.year,
      division: r.division,
      shift: r.shift,
      outcome: r.outcome as "promoted" | "repeats",
      students: [],
    };
    group.students.push({ id: r.id, firstName: r.firstName, lastName: r.lastName });
    groups.set(r.courseId, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, students: g.students.sort(compareStudents) }))
    .sort(compareCourses);
}

/**
 * NEXT-2, NEXT-3: adds the ticked students to the class's course, keeping
 * only those NEXT-1 offers. Their old course is untouched.
 */
export async function bringStudents(
  db: Db,
  teacherId: string,
  cls: TargetClass,
  studentIds: string[],
): Promise<{ ok: true; added: number }> {
  const offered = new Set(
    (await listNextYearCandidates(db, teacherId, cls)).flatMap((g) => g.students.map((s) => s.id)),
  );
  const ids = [...new Set(studentIds)].filter((id) => offered.has(id));
  if (ids.length > 0) {
    await db
      .insert(courseStudents)
      .values(ids.map((studentId) => ({ teacherId, courseId: cls.courseId, studentId })))
      .onConflictDoNothing();
  }
  return { ok: true, added: ids.length };
}
