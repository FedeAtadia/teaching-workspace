// The whole data model. Every table carries `teacher_id` (the Supabase auth
// user id) so a second teacher can be added without restructuring anything.
//
// Row-level security is enabled on every table with no policies: the app talks
// to Postgres from the server through Drizzle, and the public Supabase API
// (reachable with the publishable key) is left with nothing it can read.

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const teacherId = () => uuid("teacher_id").notNull();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
// Grades live on a 1–10 scale with at most two decimals (7,5 is common).
const grade = (name: string) => numeric(name, { precision: 4, scale: 2, mode: "number" });

// ─── Settings ───────────────────────────────────────────────────────────────

/** Per-teacher defaults. What makes the app customizable for other teachers. */
export const teacherSettings = pgTable("teacher_settings", {
  teacherId: uuid("teacher_id").primaryKey(),
  locale: text("locale").notNull().default("es-AR"),
  gradeMin: grade("grade_min").notNull().default(1),
  gradeMax: grade("grade_max").notNull().default(10),
  passMark: grade("pass_mark").notNull().default(7),
  // How far the second cuatrimestre may move away from the first (TERM-2).
  maxTermIncrease: grade("max_term_increase").notNull().default(3),
  maxTermDecrease: grade("max_term_decrease").notNull().default(3),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// ─── Calendar ───────────────────────────────────────────────────────────────

export const academicYears = pgTable(
  "academic_years",
  {
    id: id(),
    teacherId: teacherId(),
    name: text("name").notNull(), // "2026"
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.teacherId, t.name)],
).enableRLS();

/** The two cuatrimestres of a year. `position` 1 or 2; the last one is final. */
export const terms = pgTable(
  "terms",
  {
    id: id(),
    teacherId: teacherId(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "1° cuatrimestre"
    position: integer("position").notNull(),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
  },
  (t) => [unique().on(t.academicYearId, t.position)],
).enableRLS();

// ─── Classes and people ─────────────────────────────────────────────────────

export const shift = pgEnum("shift", ["morning", "afternoon", "evening"]);

/** Where a teacher works (SCHOOL-1). Names are unique per teacher, ignoring case (SCHOOL-3). */
export const schools = pgTable(
  "schools",
  {
    id: id(),
    teacherId: teacherId(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("schools_teacher_name_ci").on(t.teacherId, sql`lower(${t.name})`)],
).enableRLS();

/**
 * A curso: "4° A, mañana, 2026" at one school (COURSE-1, SCHOOL-2). Classes
 * are subjects taught to a course; students belong to a course, and so to all
 * of its classes.
 */
export const courses = pgTable(
  "courses",
  {
    id: id(),
    teacherId: teacherId(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    year: integer("year").notNull(), // 1–6
    division: text("division").notNull(), // "A"
    shift: shift("shift").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.teacherId, t.schoolId, t.academicYearId, t.year, t.division, t.shift)],
).enableRLS();

/** A subject taught to one course (CLASS-1). */
export const classes = pgTable(
  "classes",
  {
    id: id(),
    teacherId: teacherId(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // the subject: "Matemática"
    // Null means "use the teacher's default" (teacher_settings.pass_mark).
    passMark: grade("pass_mark"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.courseId, t.name)], // CLASS-5
).enableRLS();

/** Students are records, not users. They never sign in. */
export const students = pgTable("students", {
  id: id(),
  teacherId: teacherId(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  notes: text("notes"),
  createdAt: createdAt(),
}).enableRLS();

export const enrollmentStatus = pgEnum("enrollment_status", ["active", "withdrawn"]);

/** YEAR-2: how the school year ended for a student in a course. */
export const yearOutcome = pgEnum("year_outcome", ["promoted", "repeats", "graduated"]);

/** Who is in each course (STUDENT-2). */
export const courseStudents = pgTable(
  "course_students",
  {
    teacherId: teacherId(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: enrollmentStatus("status").notNull().default("active"),
    joinedOn: date("joined_on").default(sql`current_date`),
    // YEAR-2: null until the teacher decides.
    outcome: yearOutcome("outcome"),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.studentId] })],
).enableRLS();

// ─── What is taught ─────────────────────────────────────────────────────────

/** A topic/subject taught for a stretch of the class. Belongs to one term. */
export const units = pgTable("units", {
  id: id(),
  teacherId: teacherId(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  termId: uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
}).enableRLS();

export const standardScope = pgEnum("standard_scope", ["class", "unit"]);

/**
 * Passing criteria. `class` standards apply all year; `unit` standards apply
 * to the topic being taught. One table so tasks can point at either.
 */
export const standards = pgTable("standards", {
  id: id(),
  teacherId: teacherId(),
  scope: standardScope("scope").notNull(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  // FILE-4: the attached file in Storage (bucket task-files), and the name it
  // had when uploaded, shown to the teacher.
  attachmentPath: text("attachment_path"),
  attachmentName: text("attachment_name"),
}).enableRLS();

// ─── Assessment ─────────────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: id(),
  teacherId: teacherId(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id, { onDelete: "restrict" }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"), // brief, up to 280 (TASK-2)
  criteria: text("criteria"), // the task's own specific standard (TASK-2)
  // FILE-1..3: the attached file in Storage (bucket task-files), and the
  // name it had when uploaded, shown to the teacher.
  attachmentPath: text("attachment_path"),
  attachmentName: text("attachment_name"),
  assignedOn: date("assigned_on"),
  dueOn: date("due_on"),
  createdAt: createdAt(),
}).enableRLS();

/** Which standards a task assesses. */
export const taskStandards = pgTable(
  "task_standards",
  {
    teacherId: teacherId(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    standardId: uuid("standard_id")
      .notNull()
      .references(() => standards.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.standardId] })],
).enableRLS();

export const scoreStatus = pgEnum("score_status", ["graded", "missing", "excused"]);

/** One number per student per task, plus notes on how it was resolved. */
export const scores = pgTable(
  "scores",
  {
    id: id(),
    teacherId: teacherId(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: scoreStatus("status").notNull().default("graded"),
    value: grade("value"), // null unless status = graded
    notes: text("notes"),
    gradedAt: timestamp("graded_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.taskId, t.studentId)],
).enableRLS();

export const observationKind = pgEnum("observation_kind", [
  "class_work",
  "participation",
  "behavior",
  "other",
]);

/** Work in class and everything else that feeds the term grade. */
export const observations = pgTable("observations", {
  id: id(),
  teacherId: teacherId(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  termId: uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
  observedOn: date("observed_on").notNull().default(sql`current_date`),
  kind: observationKind("kind").notNull().default("class_work"),
  note: text("note").notNull(),
  value: grade("value"),
}).enableRLS();

/**
 * The grade the teacher sets for a term. The second term's grade is the one
 * that counts; the app suggests a range from the first (TERM-2) and asks for
 * a reason when the grade falls outside it (TERM-4).
 */
export const termGrades = pgTable(
  "term_grades",
  {
    id: id(),
    teacherId: teacherId(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
    value: grade("value").notNull(),
    notes: text("notes"),
    outsideRangeReason: text("outside_range_reason"),
    setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.classId, t.studentId, t.termId)],
).enableRLS();

export const examStatus = pgEnum("exam_status", ["graded", "absent"]);

/**
 * EXAM-1: an exam for a class the student owes (a "previa"), at a mesa de
 * examen. The class is passed once one is at or above the pass mark (YEAR-1).
 */
export const exams = pgTable("exams", {
  id: id(),
  teacherId: teacherId(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  takenOn: date("taken_on").notNull(),
  status: examStatus("status").notNull().default("graded"),
  value: grade("value"), // null when absent
  notes: text("notes"),
  createdAt: createdAt(),
}).enableRLS();
