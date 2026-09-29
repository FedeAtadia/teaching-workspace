# Specification

What this app is required to do. Every requirement here is a single, testable
statement with a stable id, and every one of them is covered by a test.

**This file is the source of truth for behaviour.** If the code and this file
disagree, one of them is a bug — decide which before writing anything else.

## How to use it

- **Adding a feature?** Write the requirement here first, give it the next free
  id in its section, then write the test, then the code. See
  [WORKFLOW.md](WORKFLOW.md).
- **Changing behaviour?** Edit the requirement in the same commit as the code
  and the test. A requirement that no longer matches the code is worse than no
  requirement at all.
- **Referencing one?** Use the id (`TERM-2`) in commit messages, pull requests
  and test names. Ids are permanent; retire one rather than renumbering.

Sections list the module that enforces the rule and the test files that hold it
up. What is planned but not yet specified lives in [ROADMAP.md](ROADMAP.md).

---

## GRADE — Scale and passing

*Enforced by `src/lib/grading.ts`. Covered by `src/lib/grading.test.ts`.*

- **GRADE-1** Grades are on a 1 to 10 scale by default.
- **GRADE-2** A grade passes when it is at or above the pass mark, which is 7 by
  default.
- **GRADE-3** A class can set its own pass mark; when it does, that mark is used
  instead of the teacher's default.

## TERM — Cuatrimestres

*Enforced by `src/lib/grading.ts`. Covered by `src/lib/grading.test.ts`.*

- **TERM-1** A school year has two terms (cuatrimestres). The second term's grade
  is the one that counts for the year.
- **TERM-2** The second term's grade is expected within a range around the first
  term's grade: up to 3 above and 3 below by default, both limits set by the
  teacher. A 4 in the first term allows at most a 7 in the second.
- **TERM-3** The range is clamped to the grade scale; it never suggests a grade
  below the minimum or above the maximum.
- **TERM-4** A second-term grade is reported as within, above or below that
  range. Outside it, the teacher gives a reason, which is stored with the grade.
  The app never refuses the grade itself: the teacher has the last word.

## SUGGEST — Suggested term grade

*Enforced by `src/lib/grading.ts`. Covered by `src/lib/grading.test.ts`.*

- **SUGGEST-1** The suggested term grade is the mean of the graded tasks in that
  term, rounded to two decimals. Missing and excused tasks are left out. With
  nothing graded there is no suggestion.
- **SUGGEST-2** The number of missing tasks is reported alongside the
  suggestion, so the teacher weighs them rather than the average hiding them.

## INPUT — Typing a grade

*Enforced by `src/lib/grading.ts`. Covered by `src/lib/grading.test.ts`.*

- **INPUT-1** A grade may be typed with a decimal comma (`7,5`) or a decimal
  point (`7.5`); surrounding spaces are ignored.
- **INPUT-2** A grade outside the scale is rejected.
- **INPUT-3** Anything that is not a plain number with at most two decimals is
  rejected.

## LOCALE — Language

*Enforced by `src/i18n/config.ts`. Covered by `src/i18n/config.test.ts`.*

- **LOCALE-1** The app is in Spanish (Argentina) until the teacher picks another
  language.
- **LOCALE-2** English and Spanish (Argentina) are supported; any other stored
  value falls back to Spanish (Argentina).
- **LOCALE-3** Every text exists in both languages.

## CLASS — Classes

*Enforced by `src/lib/validation.ts`, `src/db/queries/classes.ts`. Covered by
`src/lib/validation.test.ts`, `src/db/queries/classes.test.ts`.*

- **CLASS-1** A class is one subject (its name, e.g. Matemática) taught to one
  course in one school year.
- **CLASS-2** A class is added with six fields: school (SCHOOL-1), subject,
  course year (1° to 6°), division, shift (mañana, tarde or vespertino) and
  school year (a year between 2000 and 2100). The subject is trimmed and 1 to
  80 characters long.
- **CLASS-3** The division is trimmed and upper-cased, and is 1 to 10
  characters long: `" a"` is stored as `"A"`.
- **CLASS-4** The first class of a school year creates that school year, with
  its two cuatrimestres (TERM-1).
- **CLASS-5** A course cannot have the same subject twice; adding it again is
  rejected with a message, and nothing is saved.

## COURSE — Courses

*Enforced by `src/lib/courses.ts`, `src/db/queries/classes.ts`. Covered by
`src/lib/courses.test.ts`, `src/db/queries/classes.test.ts`.*

- **COURSE-1** Classes with the same school, school year, course year,
  division and shift share one course (a curso: "4° A, mañana, 2026" at one
  school).
- **COURSE-2** A course is written as its year with a degree sign and its
  division: `4° A`.
- **COURSE-3** Courses are listed newest school year first, then by school
  (alphabetically), course year, division and shift (mañana, tarde,
  vespertino).

## SCHOOL — Schools

*Enforced by `src/lib/validation.ts`, `src/db/queries/classes.ts`,
`drizzle/0006_backfill-schools.sql`. Covered by `src/lib/validation.test.ts`,
`src/db/queries/classes.test.ts`, `src/db/queries/schools.test.ts`.*

- **SCHOOL-1** Every course belongs to a school, named when its first class is
  added: the name is required, trimmed, and 1 to 120 characters long. A school
  the teacher already has is picked again by its name.
- **SCHOOL-2** The same course year, division and shift at two schools are two
  courses: their students never mix.
- **SCHOOL-3** School names are matched without regard to case (`Escuela 5`
  and `escuela 5` are one school). A school can be renamed; a name another of
  the teacher's schools already has is refused.
- **SCHOOL-4** Courses created before schools existed belong to a school called
  "Mi escuela", one per teacher, which the teacher can rename.

## STUDENT — Students

*Enforced by `src/lib/validation.ts`, `src/db/queries/students.ts`. Covered by
`src/lib/validation.test.ts`, `src/db/queries/students.test.ts`.*

- **STUDENT-1** A student is added with a first name, a last name and a
  course. Names are trimmed and 1 to 80 characters long.
- **STUDENT-2** A student belongs to a course, and so to every class of that
  course — including classes added to it later.
- **STUDENT-3** Students are listed by last name, then first name, in Spanish
  alphabetical order (accents do not push a name to the end).

## ROSTER — A class's students

*Enforced by `src/db/queries/classDetail.ts`. Covered by
`src/db/queries/classDetail.test.ts`.*

- **ROSTER-1** A class page lists the students of its course who are still
  active in it, in STUDENT-3 order.

## STD — Passing standards

*Enforced by `src/lib/validation.ts`, `src/db/queries/classDetail.ts`. Covered
by `src/lib/validation.test.ts`, `src/db/queries/classDetail.test.ts`.*

- **STD-1** A class has passing standards (criterios de aprobación), which
  apply to the whole year. Each has a title (trimmed, 1 to 200 characters) and
  may have a description (up to 1000 characters).
- **STD-2** Standards are listed in the order they were added.

## UNIT — Units

*Enforced by `src/lib/validation.ts`, `src/db/queries/classDetail.ts`. Covered
by `src/lib/validation.test.ts`, `src/db/queries/classDetail.test.ts`.*

- **UNIT-1** A class has units, the topics taught across the year. Each has a
  title (trimmed, 1 to 120 characters) and may say which cuatrimestre of the
  class's school year it belongs to.
- **UNIT-2** Units are listed in the order they were added.

## TASK — Tasks

*Enforced by `src/lib/validation.ts`, `src/lib/format.ts`,
`src/db/queries/tasks.ts`. Covered by `src/lib/validation.test.ts`,
`src/lib/format.test.ts`, `src/db/queries/tasks.test.ts`.*

- **TASK-1** A task belongs to a class and to one cuatrimestre of the class's
  school year. It has a title (trimmed, 1 to 120 characters).
- **TASK-2** A task may also have: a unit of the same class, a date, a brief
  description (up to 280 characters), its own specific standard (up to 1000
  characters), and the class passing standards it assesses. A unit, a
  cuatrimestre or a standard from anywhere else is rejected.
- **TASK-3** A class's tasks are listed by cuatrimestre, then by date (tasks
  without a date last), then in the order they were added.
- **TASK-4** A date is shown as the day it was entered, whatever the time
  zone: `2026-05-10` is 10/5/2026 in es-AR and 5/10/2026 in English.
- **TASK-5** A task can be deleted from its page, after a confirmation that
  says how many scores go with it. Its scores, its links to standards and its
  attached file are deleted too; nothing else changes.

## SCORE — Scoring a task

*Enforced by `src/lib/scoresForm.ts`, `src/db/queries/tasks.ts`. Covered by
`src/lib/scoresForm.test.ts`, `src/db/queries/tasks.test.ts`.*

- **SCORE-1** A task is scored on one page listing every student of the
  course (ROSTER-1). Each student gets a score typed as in INPUT-1..3, and
  optional notes (up to 1000 characters). One save stores them all, or — if
  any score is not a valid grade — none, and says which ones are wrong.
- **SCORE-2** Instead of a score, a student can be marked as not handed in
  (`missing`) or excused. Those have no score; notes are kept.
- **SCORE-3** A student left without a score, not marked, and without notes
  is not scored yet: nothing is stored for them, and a score saved before is
  removed. Notes without a score are kept, with no score.
- **SCORE-4** Saving again updates each student's score; a student never has
  two scores for the same task.
- **SCORE-5** A saved score is shown as passing or not, against the class's
  pass mark (GRADE-2, GRADE-3).

## BOOK — The class gradebook

*Enforced by `src/db/queries/tasks.ts`, `src/lib/grading.ts`,
`src/lib/format.ts`. Covered by `src/db/queries/tasks.test.ts`,
`src/lib/grading.test.ts`, `src/lib/format.test.ts`.*

- **BOOK-1** For one cuatrimestre at a time, the gradebook shows the course's
  students (ROSTER-1) against that cuatrimestre's tasks (TASK-3): each cell is
  the score, a mark for not handed in or excused, or empty. A student who
  joined the course late simply has empty cells.
- **BOOK-2** Each student's row ends with their suggested average and number
  of tasks not handed in (SUGGEST-1, SUGGEST-2), shown as passing or not.
- **BOOK-3** Grades are written with the language's decimal separator:
  `7,5` in es-AR, `7.5` in English.

## FILE — Task attachments

*Enforced by `src/lib/attachments.ts`, `src/db/queries/tasks.ts`,
`supabase/storage.sql`. Covered by `src/lib/attachments.test.ts`,
`src/db/queries/tasks.test.ts`.*

- **FILE-1** A task can have one attached file — the task itself, say — that
  is a PDF, PNG or JPEG of at most 20 MB. Anything else is refused before it
  is uploaded, with a message saying why.
- **FILE-2** Attached files are private. Each is stored in the teacher's own
  folder (`<teacher id>/<task id>/<file name>`), with the name made safe for
  storage but kept readable (`Guía Nº 1.pdf` → `Guia-N-1.pdf`); a teacher can
  only read, add or remove files in their own folder, and the app only ever
  records a path in that task's folder.
- **FILE-3** Attaching a new file replaces the previous one, and removing it
  deletes the file and the link. Opening it gives a link that works for one
  minute, and only for the teacher the task belongs to.

## HISTORY — A student's school history

*Enforced by `src/db/queries/history.ts`. Covered by
`src/db/queries/history.test.ts`.*

- **HISTORY-1** Each student in the Students list opens their history: every
  course they have been in, newest school year first (COURSE-3), including
  courses they have left, marked as such.
- **HISTORY-2** Under each course, every class of it, in subject order —
  including classes added after the student joined (STUDENT-2).
- **HISTORY-3** Under each class, cuatrimestre by cuatrimestre, the class's
  tasks (TASK-3) with this student's score, mark (not handed in, excused) or
  nothing yet, and their notes; then the student's suggested average and
  tasks not handed in for that cuatrimestre (SUGGEST-1, SUGGEST-2), shown as
  passing or not against the class's pass mark.

## OWNER — Each teacher's data

*Enforced by `src/db/queries/`. Covered by `src/db/queries/*.test.ts`.*

- **OWNER-1** A teacher only ever sees, and only ever adds to, their own
  schools, school years, courses, classes, students, standards, units, tasks
  and scores. Opening another teacher's class, task or student — or one that does
  not exist — shows "not found", and nothing can be added to it or saved on
  it.

---

## Known gaps

- **TERM-4**'s "the teacher gives a reason" is a UI requirement; only the range
  check is tested until the term-grade screen exists.
- Sign-in (Google through Supabase) has no automated test yet; it needs a
  Supabase project to run against. The forms that call the queries above
  (the add-class and add-student dialogs) are checked by hand for the same
  reason: every page behind them needs a signed-in teacher.
- **FILE-2**'s folder rules and **FILE-3**'s upload, removal and one-minute
  link run in Supabase Storage, which the in-memory test database doesn't
  have. The rules are in `supabase/storage.sql` and were checked by hand:
  upload, open, replace and remove on the dev project.
