// SHARE-1..6: a class shared read-only with another teacher. The owner's
// side is scoped to the owner, the guest's to the guest (OWNER-1).

import { and, eq, not, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { academicYears, classShares, classes, courses, schools } from "@/db/schema";
import { compareCourses, type Shift } from "@/lib/courses";
import type { ShareInput } from "@/lib/validation";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

export type Teacher = { id: string; email: string; name: string | null };
type NotFound = { ok: false; error: "notFound" };
const notFound: NotFound = { ok: false, error: "notFound" };

/**
 * SHARE-1: shares one of the owner's classes with an email, pending until
 * that teacher accepts. Sharing again with the same email only updates
 * whether adaptations are included (SHARE-3).
 */
export async function shareClass(
  db: Db,
  owner: Teacher,
  input: ShareInput,
): Promise<{ ok: true } | NotFound | { ok: false; error: "self" }> {
  if (input.email === owner.email) return { ok: false, error: "self" };
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, input.classId), eq(classes.teacherId, owner.id)));
  if (!cls) return notFound;
  await db
    .insert(classShares)
    .values({
      teacherId: owner.id,
      classId: cls.id,
      guestEmail: input.email,
      includeAdaptations: input.includeAdaptations,
      ownerName: owner.name,
    })
    .onConflictDoUpdate({
      target: [classShares.classId, classShares.guestEmail],
      set: { includeAdaptations: input.includeAdaptations, ownerName: owner.name },
    });
  return { ok: true };
}

export type ClassShare = {
  id: string;
  guestEmail: string;
  guestName: string | null;
  status: "pending" | "accepted";
  includeAdaptations: boolean;
};

/** SHARE-1: whom the owner shares a class with, in the order they were added. */
export async function listClassShares(db: Db, ownerId: string, classId: string): Promise<ClassShare[]> {
  if (!isUuid(classId)) return [];
  return db
    .select({
      id: classShares.id,
      guestEmail: classShares.guestEmail,
      guestName: classShares.guestName,
      status: classShares.status,
      includeAdaptations: classShares.includeAdaptations,
    })
    .from(classShares)
    .where(and(eq(classShares.classId, classId), eq(classShares.teacherId, ownerId)))
    .orderBy(classShares.createdAt);
}

/** SHARE-3: the owner changes whether the guest sees adaptations. */
export async function setShareAdaptations(
  db: Db,
  ownerId: string,
  input: { shareId: string; includeAdaptations: boolean },
): Promise<{ ok: true } | NotFound> {
  if (!isUuid(input.shareId)) return notFound;
  const updated = await db
    .update(classShares)
    .set({ includeAdaptations: input.includeAdaptations })
    .where(and(eq(classShares.id, input.shareId), eq(classShares.teacherId, ownerId)))
    .returning({ id: classShares.id });
  return updated.length > 0 ? { ok: true } : notFound;
}

/** SHARE-4: the owner stops sharing; the guest no longer sees the class. */
export async function revokeShare(db: Db, ownerId: string, shareId: string): Promise<{ ok: true } | NotFound> {
  if (!isUuid(shareId)) return notFound;
  const deleted = await db
    .delete(classShares)
    .where(and(eq(classShares.id, shareId), eq(classShares.teacherId, ownerId)))
    .returning({ id: classShares.id });
  return deleted.length > 0 ? { ok: true } : notFound;
}

export type SharedClass = {
  shareId: string;
  classId: string;
  name: string;
  year: number;
  division: string;
  shift: Shift;
  schoolYear: string;
  school: string;
  ownerName: string | null;
  includeAdaptations: boolean;
  archived: boolean;
};

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/** The classes shared with a guest, pending or accepted. */
async function sharedWith(db: Db, guest: Teacher, status: "pending" | "accepted"): Promise<SharedClass[]> {
  const who =
    status === "pending"
      ? and(eq(classShares.guestEmail, guest.email), eq(classShares.status, "pending"))
      : and(eq(classShares.guestId, guest.id), eq(classShares.status, "accepted"));
  // No email (an account without one) can't have invitations.
  if (status === "pending" && guest.email === "") return [];
  const rows = await db
    .select({
      shareId: classShares.id,
      classId: classes.id,
      name: classes.name,
      year: courses.year,
      division: courses.division,
      shift: courses.shift,
      schoolYear: academicYears.name,
      school: schools.name,
      ownerName: classShares.ownerName,
      includeAdaptations: classShares.includeAdaptations,
      archivedOn: classes.archivedOn,
    })
    .from(classShares)
    .innerJoin(classes, eq(classShares.classId, classes.id))
    .innerJoin(courses, eq(classes.courseId, courses.id))
    .innerJoin(academicYears, eq(courses.academicYearId, academicYears.id))
    .innerJoin(schools, eq(courses.schoolId, schools.id))
    .where(who);
  return rows
    .map(({ archivedOn, ...r }) => ({ ...r, archived: archivedOn !== null }))
    .sort((a, b) => compareCourses(a, b) || collator.compare(a.name, b.name));
}

/** SHARE-2: classes offered to the guest's email, waiting for an answer. */
export const listInvitations = (db: Db, guest: Teacher) => sharedWith(db, guest, "pending");

/** SHARE-5: classes the guest accepted. */
export const listSharedWithMe = (db: Db, guest: Teacher) => sharedWith(db, guest, "accepted");

/** SHARE-2: the guest accepts a class offered to their email. */
export async function acceptShare(db: Db, guest: Teacher, shareId: string): Promise<{ ok: true } | NotFound> {
  if (!isUuid(shareId) || guest.email === "") return notFound;
  const updated = await db
    .update(classShares)
    .set({ status: "accepted", guestId: guest.id, guestName: guest.name, acceptedAt: new Date() })
    .where(
      and(
        eq(classShares.id, shareId),
        eq(classShares.guestEmail, guest.email),
        eq(classShares.status, "pending"),
        // Never one's own class, even if the owner's email changed since.
        not(eq(classShares.teacherId, guest.id)),
      ),
    )
    .returning({ id: classShares.id });
  return updated.length > 0 ? { ok: true } : notFound;
}

/** SHARE-2, SHARE-4: the guest declines an invitation, or stops seeing a class. */
export async function leaveShare(db: Db, guest: Teacher, shareId: string): Promise<{ ok: true } | NotFound> {
  if (!isUuid(shareId)) return notFound;
  const deleted = await db
    .delete(classShares)
    .where(
      and(
        eq(classShares.id, shareId),
        or(
          and(eq(classShares.guestId, guest.id), eq(classShares.status, "accepted")),
          guest.email === "" ? undefined : and(eq(classShares.guestEmail, guest.email), eq(classShares.status, "pending")),
        ),
      ),
    )
    .returning({ id: classShares.id });
  return deleted.length > 0 ? { ok: true } : notFound;
}

/**
 * SHARE-5: the class's owner and what the guest may see, when it is shared
 * with them and accepted; null otherwise. What the read-only view checks.
 */
export async function getShareFor(
  db: Db,
  guestId: string,
  classId: string,
): Promise<{ ownerId: string; ownerName: string | null; includeAdaptations: boolean } | null> {
  if (!isUuid(classId)) return null;
  const [row] = await db
    .select({
      ownerId: classShares.teacherId,
      ownerName: classShares.ownerName,
      includeAdaptations: classShares.includeAdaptations,
    })
    .from(classShares)
    .where(
      and(eq(classShares.classId, classId), eq(classShares.guestId, guestId), eq(classShares.status, "accepted")),
    );
  return row ?? null;
}

/** DATA-3: a deleted account stops seeing what was shared with it. */
export async function deleteGuestShares(db: Db, guestId: string): Promise<void> {
  await db.delete(classShares).where(eq(classShares.guestId, guestId));
}


export type ClassAccess = {
  ownerId: string;
  ownerName: string | null;
  /** SHARE-5: a guest only reads. */
  readOnly: boolean;
  /** SHARE-3: the owner always; a guest when allowed. */
  showAdaptations: boolean;
};

/**
 * OWNER-1, SHARE-5: who may open a class. Its owner, fully; a guest who
 * accepted it, read-only; anyone else, nobody (null).
 */
export async function classAccess(db: Db, viewerId: string, classId: string): Promise<ClassAccess | null> {
  if (!isUuid(classId)) return null;
  const [[own], share] = await Promise.all([
    db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.teacherId, viewerId))),
    getShareFor(db, viewerId, classId),
  ]);
  if (own) return { ownerId: viewerId, ownerName: null, readOnly: false, showAdaptations: true };
  if (!share) return null;
  return { ownerId: share.ownerId, ownerName: share.ownerName, readOnly: true, showAdaptations: share.includeAdaptations };
}

/** SHARE-4: the guest stops seeing a class they accepted. */
export async function leaveSharedClass(db: Db, guestId: string, classId: string): Promise<{ ok: true } | NotFound> {
  if (!isUuid(classId)) return notFound;
  const deleted = await db
    .delete(classShares)
    .where(and(eq(classShares.classId, classId), eq(classShares.guestId, guestId), eq(classShares.status, "accepted")))
    .returning({ id: classShares.id });
  return deleted.length > 0 ? { ok: true } : notFound;
}
