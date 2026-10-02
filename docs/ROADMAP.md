# Roadmap

Planned work, in order. Nothing here is a requirement yet: a feature moves into
[SPEC.md](SPEC.md) with ids when work on it starts.

## Phase 1 — Core (replaces the spreadsheets)

- [x] Connect Supabase, run the first migration, sign in with Google.
- [x] School years and their two cuatrimestres (created with a year's first class).
- [x] Classes: create (CLASS, COURSE).
- [x] Classes: edit and delete (CLASS-6, CLASS-7).
- [ ] Classes: archive. Pass mark per class.
- [x] Students: create, in a course (STUDENT).
- [ ] Students: edit, move between courses, import a roster from CSV
  (semicolon or comma).
- [x] Class page: students, passing standards, units (ROSTER, STD, UNIT).
- [x] Tasks per cuatrimestre/unit, with a specific standard and the passing
  standards they assess (TASK).
- [x] Scoring one task at a time, with statuses and notes (SCORE); gradebook
  per cuatrimestre with averages (BOOK).
- [x] Student history across school years (HISTORY).
- [x] Task attachments (PDF) in Supabase Storage.
- [x] Editing and deleting standards, units, tasks.
- Observations: work in class, participation.
- [x] Term grades: suggested average, allowed range from the first cuatrimestre
  (TERM-2), reason required outside it (TERM-4); the 2° is the final grade
  (TERM-5..8).
- [x] End of the school year: each class's result, exams for owed classes
  (previas), promoted / repeats / graduated (YEAR, EXAM).
- [x] Bringing promoted and repeating students into next year's courses (NEXT).
- [x] A file on each passing standard, like tasks (FILE-4).
- [x] UI kit: shadcn/ui.

## Phase 2 — Exports

- CSV (semicolon separator in es-AR), Excel (`exceljs`), Markdown.
- Word (`docx`) and PDF (`@react-pdf/renderer`) for per-student and per-class
  reports.
- ODS for LibreOffice, if needed.

## Phase 3 — Google Drive

- Google Picker to attach Drive files to a class, task or student
  (`drive.file` scope only).
- Import a Google Sheet as a roster or old grades, with a column-mapping step.
- Export straight to Google Docs / Sheets (upload .docx/.xlsx with conversion).

## Later

- Settings screen for grading rules (scale, pass mark, term limits).
- Customizable labels for other teachers ("unidad", "eje", "módulo").
- Opening it to other teachers: invitations, Vercel Pro if it becomes paid.
