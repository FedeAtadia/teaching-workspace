import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, newTeacher } from "@/test/db";
import { deleteTeacherData } from "./account";
import { createClass, setClassArchived } from "./classes";
import {
  acceptShare,
  deleteGuestShares,
  getShareFor,
  leaveShare,
  listClassShares,
  listInvitations,
  listSharedWithMe,
  revokeShare,
  setShareAdaptations,
  shareClass,
  type Teacher,
} from "./shares";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const teacher = (email: string, name: string): Teacher => ({ id: newTeacher(), email, name });

async function setup() {
  const owner = teacher(`fede-${Math.random()}@escuela.ar`, "Federico Atadia");
  const guest = teacher(`ana-${Math.random()}@escuela.ar`, "Ana López");
  const created = await createClass(db, owner.id, {
    name: "Técnicas Avanzadas",
    year: 5,
    division: "1°",
    shift: "morning",
    school: "EPET 30",
    schoolYear: 2026,
  });
  if (!created.ok) throw new Error("createClass failed");
  return { owner, guest, classId: created.classId };
}
const share = (s: Awaited<ReturnType<typeof setup>>, includeAdaptations = false, email = s.guest.email) =>
  shareClass(db, s.owner, { classId: s.classId, email, includeAdaptations });

describe("sharing a class (SHARE)", () => {
  it("offers the class to an email, pending until that teacher accepts (SHARE-1, SHARE-2)", async () => {
    const s = await setup();
    expect(await share(s)).toEqual({ ok: true });
    expect(await listClassShares(db, s.owner.id, s.classId)).toMatchObject([
      { guestEmail: s.guest.email, guestName: null, status: "pending", includeAdaptations: false },
    ]);

    const [invite] = await listInvitations(db, s.guest);
    expect(invite).toMatchObject({
      classId: s.classId,
      name: "Técnicas Avanzadas",
      year: 5,
      division: "1°",
      schoolYear: "2026",
      school: "EPET 30",
      ownerName: "Federico Atadia",
    });
    // Pending, it isn't seen yet.
    expect(await listSharedWithMe(db, s.guest)).toEqual([]);
    expect(await getShareFor(db, s.guest.id, s.classId)).toBeNull();

    expect(await acceptShare(db, s.guest, invite.shareId)).toEqual({ ok: true });
    expect(await listInvitations(db, s.guest)).toEqual([]);
    expect((await listSharedWithMe(db, s.guest)).map((c) => c.classId)).toEqual([s.classId]);
    expect(await getShareFor(db, s.guest.id, s.classId)).toEqual({
      ownerId: s.owner.id,
      ownerName: "Federico Atadia",
      includeAdaptations: false,
    });
    expect((await listClassShares(db, s.owner.id, s.classId))[0]).toMatchObject({ status: "accepted", guestName: "Ana López" });
  });

  it("only the teacher with that email can accept it (SHARE-2)", async () => {
    const s = await setup();
    await share(s);
    const [invite] = await listInvitations(db, s.guest);
    const intruder = teacher("otra@escuela.ar", "Otra");
    expect(await listInvitations(db, intruder)).toEqual([]);
    expect(await acceptShare(db, intruder, invite.shareId)).toEqual({ ok: false, error: "notFound" });
    expect(await getShareFor(db, intruder.id, s.classId)).toBeNull();
  });

  it("refuses sharing with oneself, or a class that isn't the owner's (SHARE-1, OWNER-1)", async () => {
    const s = await setup();
    expect(await share(s, false, s.owner.email)).toEqual({ ok: false, error: "self" });
    expect(await shareClass(db, s.guest, { classId: s.classId, email: "x@escuela.ar", includeAdaptations: false })).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(await listClassShares(db, s.guest.id, s.classId)).toEqual([]);
  });

  it("lets the owner choose, and change, whether adaptations are seen (SHARE-3)", async () => {
    const s = await setup();
    await share(s, true);
    const [invite] = await listInvitations(db, s.guest);
    await acceptShare(db, s.guest, invite.shareId);
    expect((await getShareFor(db, s.guest.id, s.classId))?.includeAdaptations).toBe(true);

    const [row] = await listClassShares(db, s.owner.id, s.classId);
    expect(await setShareAdaptations(db, s.owner.id, { shareId: row.id, includeAdaptations: false })).toEqual({ ok: true });
    expect((await getShareFor(db, s.guest.id, s.classId))?.includeAdaptations).toBe(false);
    // Sharing again with the same email changes it too, without a second share.
    await share(s, true);
    expect(await listClassShares(db, s.owner.id, s.classId)).toHaveLength(1);
    expect((await getShareFor(db, s.guest.id, s.classId))?.includeAdaptations).toBe(true);
    // Only the owner can change it.
    expect(await setShareAdaptations(db, s.guest.id, { shareId: row.id, includeAdaptations: false })).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  it("ends when the owner stops sharing, or the guest declines or leaves (SHARE-4)", async () => {
    const s = await setup();
    await share(s);
    const [invite] = await listInvitations(db, s.guest);
    // The guest declines.
    expect(await leaveShare(db, s.guest, invite.shareId)).toEqual({ ok: true });
    expect(await listClassShares(db, s.owner.id, s.classId)).toEqual([]);

    // Shared again, accepted, then the guest leaves.
    await share(s);
    const [again] = await listInvitations(db, s.guest);
    await acceptShare(db, s.guest, again.shareId);
    expect(await leaveShare(db, s.guest, again.shareId)).toEqual({ ok: true });
    expect(await getShareFor(db, s.guest.id, s.classId)).toBeNull();

    // Shared again, accepted, then the owner stops sharing.
    await share(s);
    const [third] = await listInvitations(db, s.guest);
    await acceptShare(db, s.guest, third.shareId);
    const [row] = await listClassShares(db, s.owner.id, s.classId);
    expect(await revokeShare(db, s.guest.id, row.id)).toEqual({ ok: false, error: "notFound" });
    expect(await revokeShare(db, s.owner.id, row.id)).toEqual({ ok: true });
    expect(await listSharedWithMe(db, s.guest)).toEqual([]);
  });

  it("keeps an archived class shared, and marks it (SHARE-5, CLASS-8)", async () => {
    const s = await setup();
    await share(s);
    const [invite] = await listInvitations(db, s.guest);
    await acceptShare(db, s.guest, invite.shareId);
    await setClassArchived(db, s.owner.id, { classId: s.classId, archived: true }, "2026-12-20");
    expect((await listSharedWithMe(db, s.guest))[0]).toMatchObject({ classId: s.classId, archived: true });
  });

  it("ends with either account, or with the class (SHARE-4, DATA-3)", async () => {
    const s = await setup();
    await share(s);
    const [invite] = await listInvitations(db, s.guest);
    await acceptShare(db, s.guest, invite.shareId);
    await deleteGuestShares(db, s.guest.id);
    expect(await getShareFor(db, s.guest.id, s.classId)).toBeNull();

    await share(s);
    const [again] = await listInvitations(db, s.guest);
    await acceptShare(db, s.guest, again.shareId);
    await deleteTeacherData(db, s.owner.id);
    expect(await listSharedWithMe(db, s.guest)).toEqual([]);
  });
});
