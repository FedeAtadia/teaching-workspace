import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { getClass } from "@/db/queries/classDetail";
import { getTask } from "@/db/queries/tasks";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { requireTeacherId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * FILE-3: opens the task's file. The link is made on click, for this
 * teacher only, and stops working after a minute, so it can't be shared.
 */
export async function GET(_request: Request, { params }: RouteContext<"/classes/[id]/tasks/[taskId]/file">) {
  const { id, taskId } = await params;
  const db = getDb();
  const teacherId = await requireTeacherId();
  const cls = await getClass(db, teacherId, id);
  const task = cls ? await getTask(db, teacherId, cls, taskId) : null;
  if (!task?.attachmentPath) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(task.attachmentPath, 60);
  if (error || !data) notFound();
  redirect(data.signedUrl);
}
