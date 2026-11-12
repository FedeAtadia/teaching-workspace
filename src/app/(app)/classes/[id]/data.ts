import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { getClass } from "@/db/queries/classDetail";
import { getRules } from "@/db/queries/settings";
import { classRules } from "@/lib/grading";
import { requireTeacherId } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * The class for this request and the grading rules that apply to it, or a
 * 404 (OWNER-1). Cached per request, so the layout and the tab page share
 * one round trip.
 */
export const loadClass = cache(async (id: string) => {
  if (!isSupabaseConfigured()) notFound();
  const teacherId = await requireTeacherId();
  const [cls, teacherRules] = await Promise.all([getClass(getDb(), teacherId, id), getRules(getDb(), teacherId)]);
  if (!cls) notFound();
  // GRADE-3, GRADE-4: the teacher's rules, with this class's pass mark if it has its own.
  return { cls, teacherId, db: getDb(), rules: classRules(teacherRules, cls.passMark) };
});
