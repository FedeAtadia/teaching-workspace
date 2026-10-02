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

*Enforced by `src/lib/grading.ts`, `src/lib/termGradesForm.ts`,
`src/db/queries/termGrades.ts`. Covered by `src/lib/grading.test.ts`,
`src/lib/termGradesForm.test.ts`, `src/db/queries/termGrades.test.ts`.*

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
- **TERM-5** A class's cuatrimestre grades are entered one cuatrimestre at a
  time, on a page listing the course's students (ROSTER-1). Each row shows the
  suggested grade from that cuatrimestre's tasks (SUGGEST-1, SUGGEST-2) and
  takes a grade typed as in INPUT-1..3 and optional notes (up to 1000
  characters). One save stores every row or, if any row is wrong, none. An
  empty grade removes the saved one; notes without a grade are rejected.
- **TERM-6** In the 2° cuatrimestre, a student with a 1° grade shows the
  expected range (TERM-2, TERM-3). A grade outside it is saved only with a
  reason (up to 500 characters), stored with it (TERM-4); inside the range no
  reason is kept.
- **TERM-7** The 2° cuatrimestre grade is the class's final grade (TERM-1).
  The gradebook shows each student's grade for the cuatrimestre next to the
  suggested average (BOOK-2), and the student's history shows each
  cuatrimestre's grade and the final grade, as passing or not.
- **TERM-8** Only students active in the course are saved, whatever the form
  sends. Another teacher's class, or a cuatrimestre of another school year,
  is "not found" and nothing is saved (OWNER-1).

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
- **CLASS-6** A class's six fields can be changed, with the CLASS-2 and CLASS-3
  rules. The subject changes only this class, and CLASS-5 still applies. The
  school, course year, division, shift and school year are the course's: they
  change for every class of the course, whose students stay in it. If the
  teacher already has another course with those fields, nothing is saved. A
  new school year is created as in CLASS-4, and the course's tasks, units and
  cuatrimestre grades move to the cuatrimestre with the same number.
- **CLASS-7** A class can be deleted, after a confirmation that says how many
  tasks, scores, units and passing standards go with it. Those and the tasks'
  attached files are deleted; the course, its students and its other classes
  stay.

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
- **STD-3** A standard's title and description can be changed, with the
  STD-1 rules. It keeps its place in the list and its links to tasks.
- **STD-4** A standard can be deleted, after a confirmation that says how
  many tasks assess it. Its links to those tasks go with it; the tasks, their
  scores and the other standards stay.

## UNIT — Units

*Enforced by `src/lib/validation.ts`, `src/db/queries/classDetail.ts`. Covered
by `src/lib/validation.test.ts`, `src/db/queries/classDetail.test.ts`.*

- **UNIT-1** A class has units, the topics taught across the year. Each has a
  title (trimmed, 1 to 120 characters) and may say which cuatrimestre of the
  class's school year it belongs to.
- **UNIT-2** Units are listed in the order they were added.
- **UNIT-3** A unit's title and cuatrimestre can be changed, with the UNIT-1
  rules. It keeps its place in the list and its tasks.
- **UNIT-4** A unit can be deleted, after a confirmation that says how many
  tasks are in it. Those tasks stay, with their scores, and no longer have a
  unit.

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
- **TASK-6** Everything given when adding a task (TASK-1, TASK-2) can be
  changed from its page, with the same rules. The standards it assesses are
  replaced by the ones ticked. Its scores and attached file stay.

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

## FILE — Attachments

*Enforced by `src/lib/attachments.ts`, `src/db/queries/tasks.ts`,
`src/db/queries/classDetail.ts`, `supabase/storage.sql`. Covered by
`src/lib/attachments.test.ts`, `src/db/queries/tasks.test.ts`,
`src/db/queries/classDetail.test.ts`.*

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
- **FILE-4** A passing standard can have one attached file too — a rubric,
  say — with the same rules (FILE-1, FILE-3). It is stored in
  `<teacher id>/standards/<standard id>/<file name>`, named as in FILE-2, and
  the app only ever records a path in that standard's folder. Deleting the
  standard (STD-4) or its class (CLASS-7) deletes its file.

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
- **HISTORY-4** Each course shows the student's year outcome (YEAR-2), and
  each class its result and exams (YEAR-1, EXAM-1).

## YEAR — Closing the school year

*Enforced by `src/lib/yearEnd.ts`, `src/lib/validation.ts`,
`src/db/queries/yearEnd.ts`. Covered by `src/lib/yearEnd.test.ts`,
`src/lib/validation.test.ts`, `src/db/queries/yearEnd.test.ts`.*

- **YEAR-1** A student's result in a class is: *pending* with no 2°
  cuatrimestre grade yet; *passed* when that final grade (TERM-7) is at or
  above the pass mark (GRADE-2, GRADE-3); otherwise *passed by exam* once an
  exam is at or above the pass mark (the earliest such exam counts), and
  *owed* until then.
- **YEAR-2** Each student of a course gets a year outcome: *promoted* or
  *repeats* in 1° to 5°, *graduated* in 6°. It starts undecided, and the
  teacher can set, change or clear it; the app never decides it. A promoted
  or graduated student may still owe classes (EXAM). The outcome belongs to
  the course, so all its classes share it.
- **YEAR-3** A class's Cierre tab lists the course's active students
  (ROSTER-1) with their final grade, result, exams and year outcome.

## NEXT — Bringing students into next year

*Enforced by `src/db/queries/nextYear.ts`. Covered by
`src/db/queries/nextYear.test.ts`.*

- **NEXT-1** A class's Estudiantes tab offers to bring in students from the
  previous school year (the year before its own) at the same school: those
  *promoted* (YEAR-2) from any course of the year below, and those who
  *repeat* any course of the same year. Students already in the course, who
  left their old course, who graduated or whose outcome is undecided are not
  offered. The offer only shows when there is someone to bring in.
- **NEXT-2** The students are listed by their old course (COURSE-3 order),
  all ticked; the teacher unticks whoever isn't coming. Saving adds the
  ticked ones to the course as active students. Their old course is
  untouched, so their history shows both years (HISTORY-1).
- **NEXT-3** Only students offered by NEXT-1 are added, whatever the form
  sends (OWNER-1).

## EXAM — Owed classes (previas)

*Enforced by `src/lib/validation.ts`, `src/db/queries/yearEnd.ts`. Covered by
`src/lib/validation.test.ts`, `src/db/queries/yearEnd.test.ts`.*

- **EXAM-1** An exam is recorded for a class a student owes (YEAR-1): its
  date, and a grade typed as in INPUT-1..3 or *absent*, with optional notes
  (up to 1000 characters). For a class the student doesn't owe, it is
  refused.
- **EXAM-2** An exam recorded by mistake can be deleted; the result is worked
  out again (YEAR-1).
- **EXAM-3** The Previas page lists every class a student still owes, from
  every school year, grouped by class (COURSE-3 order, then subject), with
  their final grade and earlier exams. Only students still active in the
  course are listed. Recording a passing exam removes the row.
- **EXAM-4** Home shows how many owed classes are pending, linking to the
  Previas page.

## HOME — The home page

*Enforced by `src/db/queries/home.ts`, `src/lib/courses.ts`. Covered by
`src/db/queries/home.test.ts`, `src/lib/courses.test.ts`.*

- **HOME-1** Home shows how many classes and students the teacher has and how
  many scores are still to enter, then one card per class (COURSE-3 order)
  with its subject, course, shift, school and number of active students; the
  whole card opens the class.
- **HOME-2** Each card shows how much of the class is scored: the scores and
  marks saved for its active students over its tasks × active students, as a
  whole percentage — 0 with no tasks or no students, never above 100.
- **HOME-3** Each card names the class's next pending task: the earliest
  dated one that some active student has no score or mark for (tasks without
  a date after all dated ones), or says that everything is scored.

## THEME — Light and dark

*Enforced by `src/lib/theme.ts`, `src/app/layout.tsx`, `src/app/globals.css`.
Covered by `src/lib/theme.test.ts`.*

- **THEME-1** The app follows the device's light or dark setting until the
  teacher picks Claro or Oscuro in Configuración; Sistema goes back to
  following the device. Any other stored value counts as Sistema.
- **THEME-2** The choice is stored and applied as the page is served, so a
  page never flashes the other theme first.

## NAV — Getting around

*Enforced by `src/components/Sidebar.tsx`, `src/lib/theme.ts`. Covered by
`src/lib/theme.test.ts`; the rest by hand (Known gaps).*

- **NAV-1** The side menu can be collapsed to its icons and expanded again;
  the choice is remembered and applied as the page is served. On a phone the
  menu opens from a button instead.
- **NAV-2** Anything that opens a page — a class card, a student's row, a task
  — does so from anywhere on it, not only from its name, and is still a single
  link for the keyboard and screen readers.

## OWNER — Each teacher's data

*Enforced by `src/db/queries/`. Covered by `src/db/queries/*.test.ts`.*

- **OWNER-1** A teacher only ever sees, adds to, changes or deletes their own
  schools, school years, courses, classes, students, standards, units, tasks,
  scores, cuatrimestre grades, year outcomes and exams. Opening another teacher's class, task or student — or one that does
  not exist — shows "not found", and nothing can be added to it, saved on it,
  changed or deleted.

---

## Known gaps

- Sign-in (Google through Supabase) has no automated test yet; it needs a
  Supabase project to run against. The forms that call the queries above
  (the add-class and add-student dialogs) are checked by hand for the same
  reason: every page behind them needs a signed-in teacher.
- **NAV-1**'s collapsing and phone menu and **NAV-2**'s whole-row links are
  interface behaviour, checked by hand in the browser; there are no component
  tests yet.
- **FILE-2**'s folder rules and **FILE-3**'s upload, removal and one-minute
  link run in Supabase Storage, which the in-memory test database doesn't
  have. The rules are in `supabase/storage.sql` and were checked by hand:
  upload, open, replace and remove on the dev project.
