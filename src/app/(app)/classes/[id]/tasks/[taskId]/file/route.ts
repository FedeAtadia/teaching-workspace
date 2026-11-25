import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { getClass } from "@/db/queries/classDetail";
import { classAccess } from "@/db/queries/shares";
import { getTask } from "@/db/queries/tasks";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { requireTeacherId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * FILE-3: opens the task's file, or with `?adapted=1` its adapted file (ADAPT-3). The link is made on click, for this
 * teacher only, and stops working after a minute, so it can't be shared.
 *
 * SHARE-6: a guest of the class opens it too; the adapted file only when allowed to see adaptations (SHARE-3).
 * Storage checks the same again (supabase/storage.sql).
 */
export async function GET(request: Request, { params }: RouteContext<"/classes/[id]/tasks/[taskId]/file">) {
  const { id, taskId } = await params;
  const db = getDb();
  const access = await classAccess(db, await requireTeacherId(), id);
  const adapted = new URL(request.url).searchParams.get("adapted") === "1";
  if (!access || (adapted && !access.showAdaptations)) notFound();
  const cls = await getClass(db, access.ownerId, id);
  const task = cls ? await getTask(db, access.ownerId, cls, taskId) : null;
  const path = adapted ? task?.adaptedAttachmentPath : task?.attachmentPath;
  if (!path) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60);
  if (error || !data) notFound();
  redirect(data.signedUrl);
}
