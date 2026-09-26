# Roadmap

Planned work, in order. Nothing here is a requirement yet: a feature moves into
[SPEC.md](SPEC.md) with ids when work on it starts.

## Phase 1 — Core (replaces the spreadsheets)

- Connect Supabase, run the first migration, sign in with Google.
- School years and their two cuatrimestres.
- Classes: create, edit, archive. Pass mark per class.
- Students: create, edit, import a roster from CSV (semicolon or comma).
- Enrol students in classes.
- Units (topics) per class, with class-wide and unit standards.
- Tasks per term/unit, linked to the standards they assess.
- Gradebook: students × tasks grid, inline score entry (`7,5`), status
  (graded / missing / excused), notes per score. TanStack Table.
- Observations: work in class, participation.
- Term grades: suggested average, allowed range from the first cuatrimestre
  (TERM-2), reason required outside it (TERM-4).
- UI kit: shadcn/ui (`npx shadcn@latest init` — needs internet).

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
