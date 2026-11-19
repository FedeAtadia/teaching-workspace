import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStandardFile } from "@/db/queries/classDetail";
import { classAccess } from "@/db/queries/shares";
import { standards } from "@/db/schema";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { requireTeacherId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * FILE-4 (as FILE-3): opens the standard's file. The link is made on click,
 * for this teacher only, and stops working after a minute.
 *
 * SHARE-6: a guest of the class opens it too; a student's own standard
 * (ADAPT-2) only when allowed to see adaptations (SHARE-3).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/classes/[id]/standards/[standardId]/file">,
) {
  const { id, standardId } = await params;
  const db = getDb();
  const access = await classAccess(db, await requireTeacherId(), id);
  if (!access) notFound();
  const path = await getStandardFile(db, access.ownerId, { classId: id, standardId });
  if (!path) notFound();
  if (!access.showAdaptations) {
    const [general] = await db
      .select({ id: standards.id })
      .from(standards)
      .where(and(eq(standards.id, standardId), isNull(standards.studentId)));
    if (!general) notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60);
  if (error || !data) notFound();
  redirect(data.signedUrl);
}
