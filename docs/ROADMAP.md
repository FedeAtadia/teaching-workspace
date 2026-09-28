# Roadmap

Planned work, in order. Nothing here is a requirement yet: a feature moves into
[SPEC.md](SPEC.md) with ids when work on it starts.

## Phase 1 — Core (replaces the spreadsheets)

- [x] Connect Supabase, run the first migration, sign in with Google.
- [x] School years and their two cuatrimestres (created with a year's first class).
- [x] Classes: create (CLASS, COURSE).
- [ ] Classes: edit, archive. Pass mark per class.
- [x] Students: create, in a course (STUDENT).
- [ ] Students: edit, move between courses, import a roster from CSV
  (semicolon or comma).
- Units (topics) per class, with class-wide and unit standards.
- Tasks per term/unit, linked to the standards they assess.
- Gradebook: students × tasks grid, inline score entry (`7,5`), status
  (graded / missing / excused), notes per score. TanStack Table.
- Observations: work in class, participation.
- Term grades: suggested average, allowed range from the first cuatrimestre
  (TERM-2), reason required outside it (TERM-4).
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
