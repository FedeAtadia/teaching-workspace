import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import { createClass } from "./classes";
import { getClass } from "./classDetail";
import { classAccess, acceptShare, listInvitations, shareClass, type Teacher } from "./shares";
import { getSharedStudentHistory } from "./sharedStudent";
import { createStudent, listStudents } from "./students";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const course = { year: 5, division: "1°", shift: "morning" as const, school: "EPET 30", schoolYear: 2026 };

/** The owner teaches Matemática and Física to one course; only Matemática is shared. */
async function setup(includeAdaptations: boolean) {
  const owner: Teacher = { id: newTeacher(), email: `o-${Math.random()}@x.ar`, name: "Federico" };
  const guest: Teacher = { id: newTeacher(), email: `g-${Math.random()}@x.ar`, name: "Ana" };
  const mate = await createClass(db, owner.id, { ...course, name: "Matemática" });
  const fisica = await createClass(db, owner.id, { ...course, name: "Física" });
  if (!mate.ok || !fisica.ok) throw new Error("createClass failed");
  const cls = (await getClass(db, owner.id, mate.classId))!;
  await createStudent(db, owner.id, { firstName: "Zoe", lastName: "Álvarez", courseId: cls.courseId });
  const [zoe] = await listStudents(db, owner.id);
  for (const classId of [mate.classId, fisica.classId]) {
    await db.insert(schema.studentAdaptations).values({ teacherId: owner.id, classId, studentId: zoe.id, notes: "Consignas cortas" });
  }
  await shareClass(db, owner, { classId: mate.classId, email: guest.email, includeAdaptations });
  const [invite] = await listInvitations(db, guest);
  return { owner, guest, zoe, mateId: mate.classId, fisicaId: fisica.classId, accept: () => acceptShare(db, guest, invite.shareId) };
}

describe("a shared class's pages and students, for its guest (SHARE-5, SHARE-6)", () => {
  it("opens the class read-only for the guest, fully for the owner, and not at all for anyone else (SHARE-5)", async () => {
    const s = await setup(false);
    expect(await classAccess(db, s.guest.id, s.mateId)).toBeNull(); // not accepted yet
    await s.accept();
    expect(await classAccess(db, s.guest.id, s.mateId)).toEqual({
      ownerId: s.owner.id,
      ownerName: "Federico",
      readOnly: true,
      showAdaptations: false,
    });
    expect(await classAccess(db, s.owner.id, s.mateId)).toMatchObject({ ownerId: s.owner.id, readOnly: false, showAdaptations: true });
    // Not the owner's other class, nor anyone else.
    expect(await classAccess(db, s.guest.id, s.fisicaId)).toBeNull();
    expect(await classAccess(db, newTeacher(), s.mateId)).toBeNull();
  });

  it("shows the guest a student's history of the shared class only (SHARE-6)", async () => {
    const s = await setup(false);
    expect(await getSharedStudentHistory(db, s.guest.id, s.zoe.id)).toBeNull(); // not accepted yet
    await s.accept();
    const history = (await getSharedStudentHistory(db, s.guest.id, s.zoe.id))!;
    expect(history.student).toMatchObject({ firstName: "Zoe", lastName: "Álvarez" });
    expect(history.ownerName).toBe("Federico");
    expect(history.courses.flatMap((c) => c.classes.map((k) => k.name))).toEqual(["Matemática"]);
    // Adaptations hidden unless the owner allows them.
    expect(history.courses[0].classes[0].adaptation).toBeNull();
  });

  it("shows adaptations when the owner allows them, and nothing to anyone else (SHARE-3, SHARE-6)", async () => {
    const s = await setup(true);
    await s.accept();
    const history = (await getSharedStudentHistory(db, s.guest.id, s.zoe.id))!;
    expect(history.courses[0].classes[0].adaptation).toBe("Consignas cortas");
    expect(await getSharedStudentHistory(db, newTeacher(), s.zoe.id)).toBeNull();
    expect(await getSharedStudentHistory(db, s.guest.id, "nope")).toBeNull();
  });
});
