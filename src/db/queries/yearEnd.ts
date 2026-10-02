// Closing the school year and owed classes (YEAR-1..3, EXAM-1..3). Scoped to
// one teacher (OWNER-1).

import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  academicYears,
  classes,
  courseStudents,
  courses,
  exams,
  schools,
  students,
  termGrades,
  terms,
} from "@/db/schema";
import { compareCourses, compareStudents, type Shift } from "@/lib/courses";
import { DEFAULT_RULES } from "@/lib/grading";
import type { ExamInput, OutcomeInput } from "@/lib/validation";
import { allowedOutcomes, classResult, type ClassResult, type ExamStatus, type YearOutcome } from "@/lib/yearEnd";
import { getClass, listClassStudents, type ClassDetail, type RosterStudent } from "./classDetail";

const isUuid = (v: string) => z.uuid().safeParse(v).success;
const collator = new Intl.Collator("es", { sensitivity: "base" });
const passMarkOf = (cls: { passMark: number | null }) => cls.passMark ?? DEFAULT_RULES.passMark;

export type ExamRow = { id: string; takenOn: string; status: ExamStatus; value: number | null; notes: string | null };

/** Just the exam's own fields, from a row that also has its class or student. */
export const toExamRow = (e: ExamRow): ExamRow => ({
  id: e.id,
  takenOn: e.takenOn,
  status: e.status,
  value: e.value,
  notes: e.notes,
});

const examColumns = {
  id: exams.id,
  takenOn: exams.takenOn,
  status: exams.status,
  value: exams.value,
  notes: exams.notes,
};

/** The 2° cuatrimestre (final, TERM-7) grades of some classes, by `classId:studentId`. */
async function finalGrades(db: Db, teacherId: string, classIds: string[]): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();
  const rows = await db
    .select({ classId: termGrades.classId, studentId: termGrades.studentId, value: termGrades.value })
    .from(termGrades)
    .innerJoin(terms, eq(termGrades.termId, terms.id))
    .where(and(inArray(termGrades.classId, classIds), eq(termGrades.teacherId, teacherId), eq(terms.position, 2)));
  return new Map(rows.map((r) => [`${r.classId}:${r.studentId}`, r.value]));
}

export type ClosingRow = {
  student: RosterStudent;
  finalGrade: number | null;
  result: ClassResult;
  /** In date order. */
  exams: ExamRow[];
  outcome: YearOutcome | null;
};

/** YEAR-3: the course's active students, in ROSTER-1 order. Takes the loaded class. */
export async function getClosingSheet(
  db: Db,
  teacherId: string,
  cls: Pick<ClassDetail, "id" | "courseId" | "passMark">,
): Promise<{ rows: ClosingRow[] }> {
  const [roster, finals, classExams, outcomes] = await Promise.all([
    listClassStudents(db, teacherId, cls),
    finalGrades(db, teacherId, [cls.id]),
    db
      .select({ ...examColumns, studentId: exams.studentId })
      .from(exams)
      .where(and(eq(exams.classId, cls.id), eq(exams.teacherId, teacherId)))
      .orderBy(asc(exams.takenOn), asc(exams.createdAt)),
    db
      .select({ studentId: courseStudents.studentId, outcome: courseStudents.outcome })
      .from(courseStudents)
      .where(and(eq(courseStudents.courseId, cls.courseId), eq(courseStudents.teacherId, teacherId))),
  ]);
  return {
    rows: roster.map((student) => {
      const finalGrade = finals.get(`${cls.id}:${student.id}`) ?? null;
      const own = classExams.filter((e) => e.studentId === student.id).map(toExamRow);
      return {
        student,
        finalGrade,
        result: classResult(finalGrade, own, passMarkOf(cls)),
        exams: own,
        outcome: outcomes.find((o) => o.studentId === student.id)?.outcome ?? null,
      };
    }),
  };
}

type NotFound = { ok: false; error: "notFound" };
const notFound: NotFound = { ok: false, error: "notFound" };

/** YEAR-2: set, change or (with null) clear one student's outcome in the class's course. */
export async function setOutcome(
  db: Db,
  teacherId: string,
  input: OutcomeInput,
): Promise<{ ok: true } | NotFound | { ok: false; error: "notAllowed" }> {
  if (!isUuid(input.studentId)) return notFound;
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return notFound;
  if (input.outcome && !allowedOutcomes(cls.year).includes(input.outcome)) return { ok: false, error: "notAllowed" };
  const updated = await db
    .update(courseStudents)
    .set({ outcome: input.outcome })
    .where(
      and(
        eq(courseStudents.courseId, cls.courseId),
        eq(courseStudents.studentId, input.studentId),
        eq(courseStudents.teacherId, teacherId),
        eq(courseStudents.status, "active"),
      ),
    )
    .returning({ studentId: courseStudents.studentId });
  return updated.length > 0 ? { ok: true } : notFound;
}

/** EXAM-1: only for a class the student owes, as an active student of its course. */
export async function recordExam(
  db: Db,
  teacherId: string,
  input: ExamInput,
): Promise<{ ok: true } | NotFound | { ok: false; error: "notOwed" }> {
  if (!isUuid(input.studentId)) return notFound;
  const cls = await getClass(db, teacherId, input.classId);
  if (!cls) return notFound;
  const [[member], finals, earlier] = await Promise.all([
    db
      .select({ studentId: courseStudents.studentId })
      .from(courseStudents)
      .where(
        and(
          eq(courseStudents.courseId, cls.courseId),
          eq(courseStudents.studentId, input.studentId),
          eq(courseStudents.teacherId, teacherId),
          eq(courseStudents.status, "active"),
        ),
      ),
    finalGrades(db, teacherId, [cls.id]),
    db
      .select(examColumns)
      .from(exams)
      .where(and(eq(exams.classId, cls.id), eq(exams.studentId, input.studentId), eq(exams.teacherId, teacherId))),
  ]);
  if (!member) return notFound;
  const result = classResult(finals.get(`${cls.id}:${input.studentId}`) ?? null, earlier, passMarkOf(cls));
  if (result.kind !== "owed") return { ok: false, error: "notOwed" };

  await db.insert(exams).values({
    teacherId,
    classId: cls.id,
    studentId: input.studentId,
    takenOn: input.takenOn,
    status: input.status,
    value: input.value,
    notes: input.notes,
  });
  return { ok: true };
}

/** EXAM-2 */
export async function deleteExam(
  db: Db,
  teacherId: string,
  input: { classId: string; examId: string },
): Promise<{ ok: true } | NotFound> {
  if (!isUuid(input.classId) || !isUuid(input.examId)) return notFound;
  const deleted = await db
    .delete(exams)
    .where(and(eq(exams.id, input.examId), eq(exams.classId, input.classId), eq(exams.teacherId, teacherId)))
    .returning({ id: exams.id });
  return deleted.length > 0 ? { ok: true } : notFound;
}

export type OwedClass = {
  classId: string;
  name: string;
  schoolYear: string;
  school: string;
  year: number;
  division: string;
  shift: Shift;
  students: { student: RosterStudent; finalGrade: number; exams: ExamRow[] }[];
};

/**
 * EXAM-3: every class with a student still owing it, from every school year.
 * Two round trips: the final grades below a pass mark, then their exams.
 */
export async function listOwed(db: Db, teacherId: string): Promise<OwedClass[]> {
  const graded = await db
    .select({
      classId: classes.id,
      name: classes.name,
      passMark: classes.passMark,
      schoolYear: academicYears.name,
      school: schools.name,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      finalGrade: termGrades.value,
    })
    .from(termGrades)
    .innerJoin(terms, eq(termGrades.termId, terms.id))
    .innerJoin(classes, eq(termGrades.classId, classes.id))
    .innerJoin(courses, eq(classes.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .innerJoin(schools, eq(courses.schoolId, schools.id))
    .innerJoin(students, eq(termGrades.studentId, students.id))
    // Only students still active in the class's course.
    .innerJoin(
      courseStudents,
      and(
        eq(courseStudents.courseId, courses.id),
        eq(courseStudents.studentId, students.id),
        eq(courseStudents.status, "active"),
      ),
    )
    .where(and(eq(termGrades.teacherId, teacherId), eq(terms.position, 2)));

  const failing = graded.filter((g) => g.finalGrade < passMarkOf(g));
  if (failing.length === 0) return [];
  const examRows = await db
    .select({ ...examColumns, classId: exams.classId, studentId: exams.studentId })
    .from(exams)
    .where(and(eq(exams.teacherId, teacherId), inArray(exams.classId, [...new Set(failing.map((g) => g.classId))])))
    .orderBy(asc(exams.takenOn), asc(exams.createdAt));

  const byClass = new Map<string, OwedClass>();
  for (const g of failing) {
    const own = examRows.filter((e) => e.classId === g.classId && e.studentId === g.studentId).map(toExamRow);
    if (classResult(g.finalGrade, own, passMarkOf(g)).kind !== "owed") continue;
    const entry = byClass.get(g.classId) ?? {
      classId: g.classId,
      name: g.name,
      schoolYear: g.schoolYear,
      school: g.school,
      year: g.year,
      division: g.division,
      shift: g.shift,
      students: [],
    };
    entry.students.push({
      student: { id: g.studentId, firstName: g.firstName, lastName: g.lastName },
      finalGrade: g.finalGrade,
      exams: own,
    });
    byClass.set(g.classId, entry);
  }
  return [...byClass.values()]
    .map((c) => ({ ...c, students: c.students.sort((a, b) => compareStudents(a.student, b.student)) }))
    .sort((a, b) => compareCourses(a, b) || collator.compare(a.name, b.name));
}
