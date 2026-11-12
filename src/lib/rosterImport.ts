// IMPORT-1..4: reading a list of students from a CSV file or from cells
// pasted out of a spreadsheet. Pure, so the browser (the preview) and the
// tests read it the same way.

/** IMPORT-4: how many students one import takes. */
export const MAX_IMPORT_ROWS = 200;
const MAX_NAME = 80;

export type RosterRow = { line: number; lastName: string; firstName: string };
export type RosterProblem = "missingFirstName" | "missingLastName" | "tooLong";
export type RosterError = { line: number; problem: RosterProblem; text: string };
export type ParsedRoster = { rows: RosterRow[]; errors: RosterError[]; tooMany: boolean };

const HEADERS_LAST = ["apellido", "apellidos", "last name", "lastname", "surname"];
const HEADERS_FIRST = ["nombre", "nombres", "first name", "firstname", "name"];

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** IMPORT-3: two students are the same when their names match, whatever the case and accents. */
export const nameKey = (s: { lastName: string; firstName: string }) => `${plain(s.lastName)}|${plain(s.firstName)}`;

/**
 * IMPORT-1: what separates the columns. Cells pasted from a spreadsheet come
 * with tabs; Excel in Spanish saves CSV with semicolons; the rest use commas.
 */
function delimiterOf(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  if (first.includes("\t")) return "\t";
  return first.includes(";") ? ";" : ",";
}

/** Splits CSV text into lines of cells; a cell in quotes may hold the separator, a line break or `""`. */
function cells(text: string, delimiter: string): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let startedOn = 1;
  const endRow = () => {
    row.push(cell);
    out.push({ line: startedOn, cells: row });
    row = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === "\n") line++;
        cell += ch;
      }
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      endRow();
      line++;
      startedOn = line;
    } else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return out;
}

/**
 * IMPORT-1, IMPORT-2: the students in the text, and the lines that can't be
 * read. Last name first, then first name, unless a title row says otherwise;
 * a title row is recognised and left out; other columns are ignored.
 */
export function parseRoster(input: string): ParsedRoster {
  // Excel's "CSV UTF-8" starts the file with a byte-order mark.
  const text = input.replace(/^﻿/, "");
  const lines = cells(text, delimiterOf(text))
    .map((l) => ({ line: l.line, cells: l.cells.map((c) => c.replace(/\s+/g, " ").trim()) }))
    .filter((l) => l.cells.some((c) => c !== ""));

  let lastAt = 0;
  let firstAt = 1;
  const [head] = lines;
  if (head) {
    const titles = head.cells.map(plain);
    const l = titles.findIndex((t) => HEADERS_LAST.includes(t));
    const f = titles.findIndex((t) => HEADERS_FIRST.includes(t));
    if (l >= 0 || f >= 0) {
      lines.shift();
      // With only one of the two titles, the other is the column beside it.
      lastAt = l >= 0 ? l : f === 0 ? 1 : 0;
      firstAt = f >= 0 ? f : l === 0 ? 1 : 0;
    }
  }

  const rows: RosterRow[] = [];
  const errors: RosterError[] = [];
  for (const { line, cells: c } of lines) {
    const lastName = c[lastAt] ?? "";
    const firstName = c[firstAt] ?? "";
    const text = c.filter((x) => x !== "").join(" · ");
    if (lastName === "") errors.push({ line, problem: "missingLastName", text });
    else if (firstName === "") errors.push({ line, problem: "missingFirstName", text });
    else if (lastName.length > MAX_NAME || firstName.length > MAX_NAME) errors.push({ line, problem: "tooLong", text });
    else rows.push({ line, lastName, firstName });
  }
  return { rows: rows.slice(0, MAX_IMPORT_ROWS), errors, tooMany: rows.length > MAX_IMPORT_ROWS };
}

export type RosterStatus = "new" | "inCourse" | "repeated";

/**
 * IMPORT-3: which rows would add someone new — not one already in the course,
 * nor a second copy of a row above.
 */
export function rosterStatus(
  rows: { lastName: string; firstName: string }[],
  inCourse: { lastName: string; firstName: string }[],
): RosterStatus[] {
  const existing = new Set(inCourse.map(nameKey));
  const seen = new Set<string>();
  return rows.map((r) => {
    const key = nameKey(r);
    if (existing.has(key)) return "inCourse";
    if (seen.has(key)) return "repeated";
    seen.add(key);
    return "new";
  });
}

/**
 * IMPORT-1: a file's bytes as text. Excel's plain "CSV" is saved in the
 * computer's old Windows encoding, not UTF-8: read as UTF-8, "Pérez" would
 * come out broken, so anything that isn't valid UTF-8 is read as Windows-1252.
 */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
