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

---

## Known gaps

- **TERM-4**'s "the teacher gives a reason" is a UI requirement; only the range
  check is tested until the term-grade screen exists.
- Sign-in (Google through Supabase) has no automated test yet; it needs a
  Supabase project to run against.
