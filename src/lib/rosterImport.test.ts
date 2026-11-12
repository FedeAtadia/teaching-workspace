import { describe, expect, it } from "vitest";
import { decodeCsv, MAX_IMPORT_ROWS, parseRoster, rosterStatus } from "./rosterImport";

const names = (text: string) => parseRoster(text).rows.map((r) => `${r.lastName}, ${r.firstName}`);

describe("importing a list of students (IMPORT)", () => {
  it("reads last name then first name, split by semicolons, commas or tabs (IMPORT-1)", () => {
    // Excel in Spanish, any other program, and cells pasted from a spreadsheet.
    expect(names("Pérez;Ana\nÁlvarez;Zoe")).toEqual(["Pérez, Ana", "Álvarez, Zoe"]);
    expect(names("Pérez,Ana\r\nÁlvarez,Zoe\r\n")).toEqual(["Pérez, Ana", "Álvarez, Zoe"]);
    expect(names("Pérez\tAna\nÁlvarez\tZoe")).toEqual(["Pérez, Ana", "Álvarez, Zoe"]);
  });

  it("leaves out a title row, and follows it when the columns are the other way round (IMPORT-2)", () => {
    expect(names("Apellido;Nombre\nPérez;Ana")).toEqual(["Pérez, Ana"]);
    expect(names("Nombre;Apellido\nAna;Pérez")).toEqual(["Pérez, Ana"]);
    expect(names("N°;APELLIDOS;NOMBRES;DNI\n1;Pérez;Ana;40111222")).toEqual(["Pérez, Ana"]);
    expect(names("Last name,First name\nPérez,Ana")).toEqual(["Pérez, Ana"]);
  });

  it("skips empty lines, trims spaces and drops the mark Excel puts at the start (IMPORT-1)", () => {
    expect(names("﻿Apellido;Nombre\n\n  Pérez ;  Ana   María \n;\n")).toEqual(["Pérez, Ana María"]);
  });

  it("reads quoted cells, which may hold the separator (IMPORT-1)", () => {
    expect(names('"De la Fuente, hijo";"Ana ""Anita"""\nPérez;Luis')).toEqual([
      'De la Fuente, hijo, Ana "Anita"',
      "Pérez, Luis",
    ]);
  });

  it("says which lines can't be read, by their number in the file (IMPORT-2)", () => {
    const parsed = parseRoster(`Apellido;Nombre\nPérez;Ana\nGómez\n;Luis\n${"x".repeat(81)};Eva`);
    expect(parsed.rows.map((r) => r.line)).toEqual([2]);
    expect(parsed.errors.map((e) => [e.line, e.problem])).toEqual([
      [3, "missingFirstName"],
      [4, "missingLastName"],
      [5, "tooLong"],
    ]);
    expect(parsed.errors[0].text).toBe("Gómez");
  });

  it("takes a single 'Apellido, Nombre' column, since the comma splits it (IMPORT-1)", () => {
    expect(names("Pérez, Ana\nÁlvarez, Zoe")).toEqual(["Pérez, Ana", "Álvarez, Zoe"]);
  });

  it("stops at the most one import takes (IMPORT-4)", () => {
    const many = Array.from({ length: MAX_IMPORT_ROWS + 5 }, (_, i) => `Apellido${i};Nombre`).join("\n");
    const parsed = parseRoster(many);
    expect(parsed.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(parsed.tooMany).toBe(true);
    expect(parseRoster("Pérez;Ana").tooMany).toBe(false);
    expect(parseRoster("")).toEqual({ rows: [], errors: [], tooMany: false });
  });

  it("marks who is already in the course and who is twice in the file, whatever the case and accents (IMPORT-3)", () => {
    const rows = [
      { lastName: "PEREZ", firstName: "ana" },
      { lastName: "Gómez", firstName: "Luis" },
      { lastName: "gomez", firstName: " Luis" },
      { lastName: "Gómez", firstName: "Luisa" },
    ];
    expect(rosterStatus(rows, [{ lastName: "Pérez", firstName: "Ana" }])).toEqual([
      "inCourse",
      "new",
      "repeated",
      "new",
    ]);
  });

  it("reads a file saved by Excel as plain CSV, which isn't UTF-8 (IMPORT-1)", () => {
    // "Pérez;Ñandú" in Windows-1252: é = E9, Ñ = D1, ú = FA.
    const windows = new Uint8Array([0x50, 0xe9, 0x72, 0x65, 0x7a, 0x3b, 0xd1, 0x61, 0x6e, 0x64, 0xfa]);
    expect(decodeCsv(windows)).toBe("Pérez;Ñandú");
    expect(decodeCsv(new TextEncoder().encode("Pérez;Ñandú"))).toBe("Pérez;Ñandú");
  });
});
