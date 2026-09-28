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
- **CLASS-2** A class is added with five fields: subject, course year (1° to
  6°), division, shift (mañana, tarde or vespertino) and school year (a year
  between 2000 and 2100). The subject is trimmed and 1 to 80 characters long.
- **CLASS-3** The division is trimmed and upper-cased, and is 1 to 10
  characters long: `" a"` is stored as `"A"`.
- **CLASS-4** The first class of a school year creates that school year, with
  its two cuatrimestres (TERM-1).
- **CLASS-5** A course cannot have the same subject twice; adding it again is
  rejected with a message, and nothing is saved.

## COURSE — Courses

*Enforced by `src/lib/courses.ts`, `src/db/queries/classes.ts`. Covered by
`src/lib/courses.test.ts`, `src/db/queries/classes.test.ts`.*

- **COURSE-1** Classes with the same school year, course year, division and
  shift share one course (a curso: "4° A, mañana, 2026").
- **COURSE-2** A course is written as its year with a degree sign and its
  division: `4° A`.
- **COURSE-3** Courses are listed newest school year first, then by course
  year, division and shift (mañana, tarde, vespertino).

## STUDENT — Students

*Enforced by `src/lib/validation.ts`, `src/db/queries/students.ts`. Covered by
`src/lib/validation.test.ts`, `src/db/queries/students.test.ts`.*

- **STUDENT-1** A student is added with a first name, a last name and a
  course. Names are trimmed and 1 to 80 characters long.
- **STUDENT-2** A student belongs to a course, and so to every class of that
  course — including classes added to it later.
- **STUDENT-3** Students are listed by last name, then first name, in Spanish
  alphabetical order (accents do not push a name to the end).

## OWNER — Each teacher's data

*Enforced by `src/db/queries/`. Covered by `src/db/queries/*.test.ts`.*

- **OWNER-1** A teacher only ever sees, and only ever adds to, their own
  school years, courses, classes and students.

---

## Known gaps

- **TERM-4**'s "the teacher gives a reason" is a UI requirement; only the range
  check is tested until the term-grade screen exists.
- Sign-in (Google through Supabase) has no automated test yet; it needs a
  Supabase project to run against. The forms that call the queries above
  (the add-class and add-student dialogs) are checked by hand for the same
  reason: every page behind them needs a signed-in teacher.
