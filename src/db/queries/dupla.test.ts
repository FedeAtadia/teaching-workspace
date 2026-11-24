import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, newTeacher } from "@/test/db";
import { createClass } from "./classes";
import { getClass, listTerms } from "./classDetail";
import { findOwnStudent, getDuplaView } from "./dupla";
import { acceptShare, listInvitations, shareClass, type Teacher } from "./shares";
import { createStudent, listStudents } from "./students";
import { saveTermGrades } from "./termGrades";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const course = { year: 5, division: "1°", shift: "morning" as const, school: "EPET 30", schoolYear: 2026 };

/** Two teachers of one course, each with their own class and records; the partner shares theirs with "me". */
async function dupla(partnerNames: [string, string][] = [["Ana", "Pérez"]]) {
  const me: Teacher = { id: newTeacher(), email: `me-${Math.random()}@x.ar`, name: "Federico" };
  const partner: Teacher = { id: newTeacher(), email: `p-${Math.random()}@x.ar`, name: "Laura" };
  const mine = await createClass(db, me.id, { ...course, name: "Técnicas Avanzadas" });
  const theirs = await createClass(db, partner.id, { ...course, name: "Taller" });
  if (!mine.ok || !theirs.ok) throw new Error("createClass failed");
  const myClass = (await getClass(db, me.id, mine.classId))!;
  const theirClass = (await getClass(db, partner.id, theirs.classId))!;
  await createStudent(db, me.id, { firstName: "Ana", lastName: "Pérez", courseId: myClass.courseId });
  for (const [firstName, lastName] of partnerNames) {
    await createStudent(db, partner.id, { firstName, lastName, courseId: theirClass.courseId });
  }
  const [myAna] = await listStudents(db, me.id);
  const partnerStudents = await listStudents(db, partner.id);
  // The partner's final grade for their Ana.
  const [, term2] = await listTerms(db, partner.id, theirClass);
  await saveTermGrades(db, partner.id, theirClass, term2.id, {
    save: [{ studentId: partnerStudents[0].id, value: 8, notes: null, outsideRangeReason: null }],
    clear: [],
  });
  await shareClass(db, partner, { classId: theirs.classId, email: me.email, includeAdaptations: false });
  const accept = async () => {
    const [invite] = await listInvitations(db, me);
    await acceptShare(db, me, invite.shareId);
  };
  return { me, partner, myAna, partnerAna: partnerStudents[0], accept };
}
const person = { firstName: "ANA", lastName: "perez", schoolYears: ["2026"] };

describe("a student seen in both teachers' classes (DUPLA)", () => {
  it("shows my student's grades in the partner's shared class, once it is accepted (DUPLA-1)", async () => {
    const d = await dupla();
    expect(await getDuplaView(db, d.me.id, person)).toEqual([]);
    await d.accept();

    const [view] = await getDuplaView(db, d.me.id, person);
    expect(view.ownerName).toBe("Laura");
    expect(view.student.id).toBe(d.partnerAna.id);
    expect(view.courses[0].classes.map((c) => [c.name, c.finalGrade, c.result.kind])).toEqual([["Taller", 8, "passed"]]);
  });

  it("shows nothing for another school year, another name, or two students of that name (DUPLA-1)", async () => {
    const d = await dupla();
    await d.accept();
    expect(await getDuplaView(db, d.me.id, { ...person, schoolYears: ["2025"] })).toEqual([]);
    expect(await getDuplaView(db, d.me.id, { ...person, firstName: "Luis" })).toEqual([]);

    const twins = await dupla([
      ["Ana", "Pérez"],
      ["ana", "PÉREZ"],
    ]);
    await twins.accept();
    expect(await getDuplaView(db, twins.me.id, person)).toEqual([]);
  });

  it("never shows what isn't shared with me (OWNER-1)", async () => {
    const d = await dupla();
    await d.accept();
    // The partner's view of me: I shared nothing with them.
    expect(await getDuplaView(db, d.partner.id, person)).toEqual([]);
    expect(await getDuplaView(db, newTeacher(), person)).toEqual([]);
  });

  it("leads back from the partner's student to my own (DUPLA-2)", async () => {
    const d = await dupla();
    await d.accept();
    expect(await findOwnStudent(db, d.me.id, person)).toBe(d.myAna.id);
    expect(await findOwnStudent(db, d.me.id, { ...person, schoolYears: ["2025"] })).toBeNull();
    expect(await findOwnStudent(db, newTeacher(), person)).toBeNull();
  });
});
