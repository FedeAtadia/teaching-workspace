import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { getClass } from "@/db/queries/classDetail";
import { requireTeacherId } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * The class for this request, or a 404 (OWNER-1). Cached per request, so the
 * layout and the tab page share one query.
 */
export const loadClass = cache(async (id: string) => {
  if (!isSupabaseConfigured()) notFound();
  const teacherId = await requireTeacherId();
  const cls = await getClass(getDb(), teacherId, id);
  if (!cls) notFound();
  return { cls, teacherId, db: getDb() };
});
