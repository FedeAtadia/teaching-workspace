import { describe, expect, it } from "vitest";
import { attachmentPath, checkAttachment, isFileIn, MAX_ATTACHMENT_BYTES, standardFolder } from "./attachments";

const TEACHER = "11111111-1111-4111-8111-111111111111";
const TASK = "22222222-2222-4222-8222-222222222222";
const OTHER_TASK = "33333333-3333-4333-8333-333333333333";

describe("which files can be attached (FILE-1)", () => {
  it("takes a PDF, PNG or JPEG up to 20 MB", () => {
    expect(checkAttachment({ type: "application/pdf", size: 1_000_000 })).toBe("ok");
    expect(checkAttachment({ type: "image/png", size: 10 })).toBe("ok");
    expect(checkAttachment({ type: "image/jpeg", size: MAX_ATTACHMENT_BYTES })).toBe("ok");
  });

  it("refuses anything bigger than 20 MB", () => {
    expect(checkAttachment({ type: "application/pdf", size: MAX_ATTACHMENT_BYTES + 1 })).toBe("tooBig");
  });

  it("refuses other kinds of file, and empty ones", () => {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect(checkAttachment({ type: docx, size: 100 })).toBe("wrongType");
    expect(checkAttachment({ type: "application/pdf", size: 0 })).toBe("empty");
  });
});

describe("where files are stored (FILE-2)", () => {
  it("puts the file in the teacher's and the task's folder", () => {
    expect(attachmentPath(TEACHER, TASK, "tp1.pdf")).toBe(`${TEACHER}/${TASK}/tp1.pdf`);
  });

  it("makes the name safe for storage but keeps it readable", () => {
    // Storage keys reject some characters, and accents or spaces make the
    // path fail in some browsers; slashes would escape the task's folder.
    expect(attachmentPath(TEACHER, TASK, "Guía Nº 1.pdf")).toBe(`${TEACHER}/${TASK}/Guia-N-1.pdf`);
    expect(attachmentPath(TEACHER, TASK, "../../otro/secreto.PDF")).toBe(`${TEACHER}/${TASK}/otro-secreto.PDF`);
    expect(attachmentPath(TEACHER, TASK, "???.png")).toBe(`${TEACHER}/${TASK}/archivo.png`);
  });

  it("only accepts a path inside that task's own folder", () => {
    expect(isFileIn(`${TEACHER}/${TASK}/tp1.pdf`, TEACHER, TASK)).toBe(true);
    expect(isFileIn(`${TEACHER}/${OTHER_TASK}/tp1.pdf`, TEACHER, TASK)).toBe(false);
    expect(isFileIn(`${OTHER_TASK}/${TASK}/tp1.pdf`, TEACHER, TASK)).toBe(false);
    expect(isFileIn(`${TEACHER}/${TASK}/../x.pdf`, TEACHER, TASK)).toBe(false);
    expect(isFileIn(`${TEACHER}/${TASK}/`, TEACHER, TASK)).toBe(false);
  });
});

describe("where a passing standard's file is stored (FILE-4)", () => {
  it("puts it in the teacher's standards folder, named as in FILE-2", () => {
    const folder = standardFolder(TASK);
    expect(attachmentPath(TEACHER, folder, "Rúbrica 1.pdf")).toBe(`${TEACHER}/standards/${TASK}/Rubrica-1.pdf`);
  });

  it("only accepts a path inside that standard's own folder", () => {
    const folder = standardFolder(TASK);
    expect(isFileIn(`${TEACHER}/standards/${TASK}/r.pdf`, TEACHER, folder)).toBe(true);
    expect(isFileIn(`${TEACHER}/${TASK}/r.pdf`, TEACHER, folder)).toBe(false);
    expect(isFileIn(`${TEACHER}/standards/${OTHER_TASK}/r.pdf`, TEACHER, folder)).toBe(false);
    expect(isFileIn(`${TEACHER}/standards/${TASK}/sub/r.pdf`, TEACHER, folder)).toBe(false);
  });
});
