// DATA-1, DATA-2: what goes into each sheet of a teacher's download.
// Pure: the query (src/db/queries/account.ts) gathers the rows, this lays
// them out, and the download route only writes the file.

import type { Shift } from "./courses";

type ClassRef = {
  schoolYear: string;
  school: string;
  year: number;
  division: string;
  shift: Shift;
  subject: string;
};
type StudentRef = { lastName: string; firstName: string };

export type ExportData = {
  classes: (ClassRef & {
    passMark: number | null;
    weekdays: number[];
    notes: string | null;
    /** CLASS-8 */
    archivedOn: string | null;
  })[];
  /** One row per course a student is or was in; a student in no course has the course fields null. */
  students: (StudentRef & {
    schoolYear: string | null;
    school: string | null;
    year: number | null;
    division: string | null;
    shift: Shift | null;
    status: "active" | "withdrawn" | null;
    outcome: "promoted" | "repeats" | "graduated" | null;
  })[];
  units: (ClassRef & { term: number | null; title: string; description: string | null })[];
  standards: (ClassRef & {
    unit: string | null;
    /** ADAPT-2: whose own standard it is; null for the class's. */
    student: StudentRef | null;
    title: string;
    description: string | null;
    file: string | null;
  })[];
  tasks: (ClassRef & {
    term: number;
    unit: string | null;
    title: string;
    description: string | null;
    criteria: string | null;
    assignedOn: string | null;
    dueOn: string | null;
    file: string | null;
    adaptedDescription: string | null;
    adaptedCriteria: string | null;
    adaptedFile: string | null;
  })[];
  scores: (ClassRef &
    StudentRef & {
      term: number;
      task: string;
      status: "graded" | "missing" | "excused";
      value: number | null;
      adapted: boolean;
      notes: string | null;
    })[];
  termGrades: (ClassRef & StudentRef & { term: number; value: number; notes: string | null; reason: string | null })[];
  attendance: (ClassRef & StudentRef & { date: string; status: "present" | "absent" | "late" | "excused" })[];
  notHeld: (ClassRef & {
    date: string;
    reason: "weather" | "teacher_absent" | "strike" | "other" | null;
    note: string | null;
  })[];
  exams: (ClassRef &
    StudentRef & { takenOn: string; status: "graded" | "absent"; value: number | null; notes: string | null })[];
  adaptations: (ClassRef & StudentRef & { notes: string })[];
  /** One row per student in a group; a group with nobody has one row with no student. */
  groups: (ClassRef & { group: string; days: string | null; weekdays: number[]; student: StudentRef | null })[];
  calendars: { school: string; schoolYear: string; startsOn: string; term2StartsOn: string; endsOn: string }[];
  daysOff: {
    school: string;
    schoolYear: string;
    startsOn: string;
    endsOn: string;
    kind: "holiday" | "jornada" | "recess" | "other";
    name: string;
  }[];
  settings: {
    gradeMin: number;
    gradeMax: number;
    passMark: number;
    maxTermIncrease: number;
    maxTermDecrease: number;
    minAttendance: number;
    graduateRetentionMonths: number;
  } | null;
};

export const SHEET_KEYS = [
  "classes",
  "students",
  "units",
  "standards",
  "tasks",
  "scores",
  "termGrades",
  "attendance",
  "notHeld",
  "exams",
  "adaptations",
  "groups",
  "calendars",
  "daysOff",
  "settings",
] as const;
export type SheetKey = (typeof SHEET_KEYS)[number];

export const COLUMN_KEYS = [
  "schoolYear",
  "school",
  "course",
  "shift",
  "subject",
  "lastName",
  "firstName",
  "passMark",
  "weekdays",
  "notes",
  "archivedOn",
  "status",
  "outcome",
  "term",
  "unit",
  "title",
  "description",
  "criteria",
  "assignedOn",
  "dueOn",
  "file",
  "adaptedDescription",
  "adaptedCriteria",
  "adaptedFile",
  "task",
  "grade",
  "adapted",
  "reason",
  "date",
  "group",
  "days",
  "startsOn",
  "term2StartsOn",
  "endsOn",
  "kind",
  "name",
  "setting",
  "value",
] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

/** DATA-2: every text of the file, in the teacher's language. */
export type ExportLabels = {
  sheets: Record<SheetKey, string>;
  columns: Record<ColumnKey, string>;
  shift: Record<Shift, string>;
  enrollment: Record<"active" | "withdrawn", string>;
  outcome: Record<"promoted" | "repeats" | "graduated", string>;
  score: Record<"graded" | "missing" | "excused", string>;
  attendance: Record<"present" | "absent" | "late" | "excused", string>;
  exam: Record<"graded" | "absent", string>;
  notHeld: Record<"weather" | "teacher_absent" | "strike" | "other", string>;
  dayOff: Record<"holiday" | "jornada" | "recess" | "other", string>;
  settings: Record<keyof NonNullable<ExportData["settings"]>, string>;
  yes: string;
  no: string;
  /** Keyed "1" (lunes) to "6" (sábado), as CAL-4 stores them. */
  weekdays: Record<string, string>;
};

export type Cell = string | number | Date | null;
export type Sheet = { key: SheetKey; name: string; columns: string[]; rows: Cell[][] };

/** A stored date (YYYY-MM-DD) as a UTC date, which is the day a spreadsheet shows. */
export function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const text = (a: string | null | undefined, b: string | null | undefined) => collator.compare(a ?? "", b ?? "");

/** Newest school year first, then school, course and subject. */
function byClass(a: Partial<ClassRef>, b: Partial<ClassRef>): number {
  return (
    text(b.schoolYear, a.schoolYear) ||
    text(a.school, b.school) ||
    (a.year ?? 0) - (b.year ?? 0) ||
    text(a.division, b.division) ||
    text(a.subject, b.subject)
  );
}
const byStudent = (a: Partial<StudentRef>, b: Partial<StudentRef>) =>
  text(a.lastName, b.lastName) || text(a.firstName, b.firstName);

function sorted<T>(rows: T[], ...by: ((a: T, b: T) => number)[]): T[] {
  return [...rows].sort((a, b) => {
    for (const cmp of by) {
      const r = cmp(a, b);
      if (r !== 0) return r;
    }
    return 0;
  });
}

/** DATA-1, DATA-2: the file's sheets, in order, each with its title row and its rows. */
export function toSheets(data: ExportData, labels: ExportLabels): Sheet[] {
  const course = (r: { year: number | null; division: string | null }) =>
    r.year === null || r.division === null ? null : `${r.year}° ${r.division}`;
  const shift = (s: Shift | null) => (s ? labels.shift[s] : null);
  const cls = (r: ClassRef): Cell[] => [r.schoolYear, r.school, course(r), shift(r.shift), r.subject];
  const days = (list: number[]) => list.map((d) => labels.weekdays[String(d)] ?? String(d)).join(", ") || null;
  const yesNo = (v: boolean) => (v ? labels.yes : labels.no);

  const CLASS: ColumnKey[] = ["schoolYear", "school", "course", "shift", "subject"];
  const STUDENT: ColumnKey[] = ["lastName", "firstName"];
  const sheet = (key: SheetKey, columns: ColumnKey[], rows: Cell[][]): Sheet => ({
    key,
    name: labels.sheets[key],
    columns: columns.map((c) => labels.columns[c]),
    rows,
  });

  return [
    sheet(
      "classes",
      [...CLASS, "passMark", "weekdays", "notes", "archivedOn"],
      sorted(data.classes, byClass).map((r) => [
        ...cls(r),
        r.passMark,
        days(r.weekdays),
        r.notes,
        toDate(r.archivedOn),
      ]),
    ),
    sheet(
      "students",
      [...STUDENT, "schoolYear", "school", "course", "shift", "status", "outcome"],
      sorted(data.students, byStudent, (a, b) => text(b.schoolYear, a.schoolYear)).map((r) => [
        r.lastName,
        r.firstName,
        r.schoolYear,
        r.school,
        course(r),
        shift(r.shift),
        r.status && labels.enrollment[r.status],
        r.outcome && labels.outcome[r.outcome],
      ]),
    ),
    sheet(
      "units",
      [...CLASS, "term", "title", "description"],
      sorted(data.units, byClass, (a, b) => (a.term ?? 0) - (b.term ?? 0)).map((r) => [
        ...cls(r),
        r.term,
        r.title,
        r.description,
      ]),
    ),
    sheet(
      "standards",
      [...CLASS, "unit", ...STUDENT, "title", "description", "file"],
      sorted(data.standards, byClass, (a, b) => text(a.unit, b.unit)).map((r) => [
        ...cls(r),
        r.unit,
        r.student?.lastName ?? null,
        r.student?.firstName ?? null,
        r.title,
        r.description,
        r.file,
      ]),
    ),
    sheet(
      "tasks",
      [
        ...CLASS,
        "term",
        "unit",
        "title",
        "description",
        "criteria",
        "assignedOn",
        "dueOn",
        "file",
        "adaptedDescription",
        "adaptedCriteria",
        "adaptedFile",
      ],
      sorted(
        data.tasks,
        byClass,
        (a, b) => a.term - b.term,
        (a, b) => text(a.dueOn, b.dueOn),
        (a, b) => text(a.title, b.title),
      ).map((r) => [
        ...cls(r),
        r.term,
        r.unit,
        r.title,
        r.description,
        r.criteria,
        toDate(r.assignedOn),
        toDate(r.dueOn),
        r.file,
        r.adaptedDescription,
        r.adaptedCriteria,
        r.adaptedFile,
      ]),
    ),
    sheet(
      "scores",
      [...CLASS, "term", "task", ...STUDENT, "status", "grade", "adapted", "notes"],
      sorted(
        data.scores,
        byClass,
        (a, b) => a.term - b.term,
        (a, b) => text(a.task, b.task),
        byStudent,
      ).map((r) => [
        ...cls(r),
        r.term,
        r.task,
        r.lastName,
        r.firstName,
        labels.score[r.status],
        r.value,
        yesNo(r.adapted),
        r.notes,
      ]),
    ),
    sheet(
      "termGrades",
      [...CLASS, "term", ...STUDENT, "grade", "notes", "reason"],
      sorted(data.termGrades, byClass, (a, b) => a.term - b.term, byStudent).map((r) => [
        ...cls(r),
        r.term,
        r.lastName,
        r.firstName,
        r.value,
        r.notes,
        r.reason,
      ]),
    ),
    sheet(
      "attendance",
      [...CLASS, "date", ...STUDENT, "status"],
      sorted(data.attendance, byClass, (a, b) => text(a.date, b.date), byStudent).map((r) => [
        ...cls(r),
        toDate(r.date),
        r.lastName,
        r.firstName,
        labels.attendance[r.status],
      ]),
    ),
    sheet(
      "notHeld",
      [...CLASS, "date", "reason", "notes"],
      sorted(data.notHeld, byClass, (a, b) => text(a.date, b.date)).map((r) => [
        ...cls(r),
        toDate(r.date),
        r.reason && labels.notHeld[r.reason],
        r.note,
      ]),
    ),
    sheet(
      "exams",
      [...CLASS, ...STUDENT, "date", "status", "grade", "notes"],
      sorted(data.exams, byClass, byStudent, (a, b) => text(a.takenOn, b.takenOn)).map((r) => [
        ...cls(r),
        r.lastName,
        r.firstName,
        toDate(r.takenOn),
        labels.exam[r.status],
        r.value,
        r.notes,
      ]),
    ),
    sheet(
      "adaptations",
      [...CLASS, ...STUDENT, "notes"],
      sorted(data.adaptations, byClass, byStudent).map((r) => [...cls(r), r.lastName, r.firstName, r.notes]),
    ),
    sheet(
      "groups",
      [...CLASS, "group", "days", "weekdays", ...STUDENT],
      sorted(
        data.groups,
        byClass,
        (a, b) => text(a.group, b.group),
        (a, b) => byStudent(a.student ?? {}, b.student ?? {}),
      ).map((r) => [
        ...cls(r),
        r.group,
        r.days,
        days(r.weekdays),
        r.student?.lastName ?? null,
        r.student?.firstName ?? null,
      ]),
    ),
    sheet(
      "calendars",
      ["school", "schoolYear", "startsOn", "term2StartsOn", "endsOn"],
      sorted(
        data.calendars,
        (a, b) => text(a.school, b.school),
        (a, b) => text(b.schoolYear, a.schoolYear),
      ).map((r) => [r.school, r.schoolYear, toDate(r.startsOn), toDate(r.term2StartsOn), toDate(r.endsOn)]),
    ),
    sheet(
      "daysOff",
      ["school", "schoolYear", "startsOn", "endsOn", "kind", "name"],
      sorted(
        data.daysOff,
        (a, b) => text(a.school, b.school),
        (a, b) => text(a.startsOn, b.startsOn),
      ).map((r) => [r.school, r.schoolYear, toDate(r.startsOn), toDate(r.endsOn), labels.dayOff[r.kind], r.name]),
    ),
    sheet(
      "settings",
      ["setting", "value"],
      data.settings
        ? (Object.keys(labels.settings) as (keyof typeof labels.settings)[]).map((k) => [
            labels.settings[k],
            data.settings![k],
          ])
        : [],
    ),
  ];
}
