import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es-AR.json";
import { COLUMN_KEYS, SHEET_KEYS, toDate, toSheets, type ExportData, type ExportLabels } from "./dataExport";

const labels = (m: typeof es): ExportLabels => ({ ...m.dataExport, weekdays: m.weekdays });

const cls = { schoolYear: "2026", school: "EPET 30", year: 5, division: "1°", shift: "morning", subject: "Matemática" } as const;
const ana = { lastName: "Pérez", firstName: "Ana" };
const zoe = { lastName: "Álvarez", firstName: "Zoe" };

const empty: ExportData = {
  classes: [],
  students: [],
  units: [],
  standards: [],
  tasks: [],
  scores: [],
  termGrades: [],
  attendance: [],
  notHeld: [],
  exams: [],
  adaptations: [],
  groups: [],
  calendars: [],
  daysOff: [],
  settings: null,
};

const sheetOf = (data: Partial<ExportData>, key: (typeof SHEET_KEYS)[number], m = es) =>
  toSheets({ ...empty, ...data }, labels(m)).find((s) => s.key === key)!;

describe("a teacher's download (DATA)", () => {
  it("has one sheet per kind, in order, even with nothing loaded (DATA-1)", () => {
    const sheets = toSheets(empty, labels(es));
    expect(sheets.map((s) => s.key)).toEqual([...SHEET_KEYS]);
    expect(sheets.every((s) => s.rows.length === 0 && s.columns.length > 0)).toBe(true);
  });

  it("names the class and the student on each row instead of ids (DATA-1)", () => {
    const sheet = sheetOf(
      { scores: [{ ...cls, ...ana, term: 1, task: "TP 1", status: "graded", value: 7.5, adapted: false, notes: null }] },
      "scores",
    );
    expect(sheet.columns).toEqual([
      "Ciclo lectivo", "Escuela", "Curso", "Turno", "Materia", "Cuatrimestre", "Tarea",
      "Apellido", "Nombre", "Estado", "Nota", "Adaptada", "Notas",
    ]);
    expect(sheet.rows).toEqual([
      ["2026", "EPET 30", "5° 1°", "Mañana", "Matemática", 1, "TP 1", "Pérez", "Ana", "Calificada", 7.5, "No", null],
    ]);
  });

  it("writes titles and values in the teacher's language (DATA-2)", () => {
    const data = { attendance: [{ ...cls, ...ana, date: "2026-03-10", status: "late" as const }] };
    expect(sheetOf(data, "attendance", es).name).toBe("Asistencia");
    expect(sheetOf(data, "attendance", es).rows[0].at(-1)).toBe("Tarde");
    expect(sheetOf(data, "attendance", en).name).toBe("Attendance");
    expect(sheetOf(data, "attendance", en).rows[0].at(-1)).toBe("Late");
  });

  it("has a text for every sheet, column and value in both languages (DATA-2)", () => {
    for (const m of [es, en]) {
      expect(Object.keys(m.dataExport.sheets).sort()).toEqual([...SHEET_KEYS].sort());
      expect(Object.keys(m.dataExport.columns).sort()).toEqual([...COLUMN_KEYS].sort());
      // Excel refuses a sheet name over 31 characters or with any of \ / ? * [ ] :
      for (const name of Object.values(m.dataExport.sheets)) expect(name).toMatch(/^[^\\/?*[\]:]{1,31}$/);
    }
    expect(Object.keys(en.dataExport)).toEqual(Object.keys(es.dataExport));
  });

  it("keeps dates as dates and grades as numbers, so the file can be sorted (DATA-2)", () => {
    const sheet = sheetOf(
      { exams: [{ ...cls, ...ana, takenOn: "2026-12-15", status: "graded", value: 6, notes: null }] },
      "exams",
    );
    const [row] = sheet.rows;
    expect(row[7]).toEqual(new Date(Date.UTC(2026, 11, 15)));
    expect(row[9]).toBe(6);
    expect(toDate(null)).toBeNull();
  });

  it("orders rows by class, then date, then student in Spanish order (DATA-1)", () => {
    const sheet = sheetOf(
      {
        attendance: [
          { ...cls, ...ana, date: "2026-03-12", status: "present" },
          { ...cls, ...ana, date: "2026-03-10", status: "absent" },
          { ...cls, ...zoe, date: "2026-03-10", status: "present" },
          { ...cls, schoolYear: "2025", ...ana, date: "2025-03-11", status: "present" },
        ],
      },
      "attendance",
    );
    // Newest school year first; Álvarez before Pérez (the accent doesn't push her last).
    expect(sheet.rows.map((r) => [r[0], (r[5] as Date).toISOString().slice(0, 10), r[6]])).toEqual([
      ["2026", "2026-03-10", "Álvarez"],
      ["2026", "2026-03-10", "Pérez"],
      ["2026", "2026-03-12", "Pérez"],
      ["2025", "2025-03-11", "Pérez"],
    ]);
  });

  it("writes a class's days of the week by name, and its settings one per row (DATA-1)", () => {
    const data: Partial<ExportData> = {
      classes: [{ ...cls, passMark: null, weekdays: [2, 5], notes: null, archivedOn: "2026-12-20" }],
      settings: { gradeMin: 1, gradeMax: 10, passMark: 7, maxTermIncrease: 3, maxTermDecrease: 3, minAttendance: 75, graduateRetentionMonths: 12 },
    };
    expect(sheetOf(data, "classes").rows[0][6]).toBe("Martes, Viernes");
    expect(sheetOf(data, "classes").rows[0][8]).toEqual(new Date(Date.UTC(2026, 11, 20)));
    expect(sheetOf(data, "settings").rows).toContainEqual(["Asistencia mínima (%)", 75]);
    expect(sheetOf(data, "settings").rows).toHaveLength(7);
  });

  it("lists a student who is in no course, and a group nobody is in (DATA-1)", () => {
    const data: Partial<ExportData> = {
      students: [
        { ...ana, schoolYear: null, school: null, year: null, division: null, shift: null, status: null, outcome: null },
      ],
      groups: [{ ...cls, group: "Martes", days: null, weekdays: [2], student: null }],
    };
    expect(sheetOf(data, "students").rows).toEqual([["Pérez", "Ana", null, null, null, null, null, null]]);
    expect(sheetOf(data, "groups").rows[0].slice(5)).toEqual(["Martes", null, "Martes", null, null]);
  });
});
