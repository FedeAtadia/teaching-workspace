import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { getAdaptations, listStudentStandards } from "@/db/queries/adaptations";
import { getClass } from "@/db/queries/classDetail";
import { getRules } from "@/db/queries/settings";
import { classAccess } from "@/db/queries/shares";
import { classRules } from "@/lib/grading";
import { requireTeacherId } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * The class for this request and the grading rules that apply to it, or a
 * 404 (OWNER-1). Cached per request, so the layout and the tab page share
 * one round trip.
 *
 * SHARE-5: for a guest of the class, the same pages read the owner's data
 * (`teacherId` is then the owner's) with `readOnly` set. Every save still
 * checks the signed-in teacher owns the class, so a guest can't change it
 * whatever the page shows.
 */
export const loadClass = cache(async (id: string) => {
  if (!isSupabaseConfigured()) notFound();
  const viewerId = await requireTeacherId();
  const db = getDb();
  const access = await classAccess(db, viewerId, id);
  if (!access) notFound();
  const teacherId = access.ownerId;
  const [cls, teacherRules] = await Promise.all([getClass(db, teacherId, id), getRules(db, teacherId)]);
  if (!cls) notFound();
  return {
    cls,
    teacherId,
    db,
    // GRADE-3, GRADE-4: the owner's rules, with this class's pass mark if it has its own.
    rules: classRules(teacherRules, cls.passMark),
    readOnly: access.readOnly,
    ownerName: access.ownerName,
    /** SHARE-3: whether adaptations may be shown; always for the owner. */
    showAdaptations: access.showAdaptations,
  };
});

/** ADAPT-1, SHARE-3: the class's adaptations, or none for a guest not allowed to see them. */
export const loadAdaptations = cache(async (id: string) => {
  const { db, teacherId, showAdaptations } = await loadClass(id);
  return showAdaptations ? getAdaptations(db, teacherId, id) : new Map<string, string>();
});

/** ADAPT-2, SHARE-3: students' own passing standards, or none for a guest not allowed to see them. */
export const loadStudentStandards = cache(async (id: string) => {
  const { db, teacherId, showAdaptations } = await loadClass(id);
  return showAdaptations ? listStudentStandards(db, teacherId, id) : [];
});
