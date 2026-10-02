import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStandardFile } from "@/db/queries/classDetail";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { requireTeacherId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * FILE-4 (as FILE-3): opens the standard's file. The link is made on click,
 * for this teacher only, and stops working after a minute.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/classes/[id]/standards/[standardId]/file">,
) {
  const { id, standardId } = await params;
  const path = await getStandardFile(getDb(), await requireTeacherId(), { classId: id, standardId });
  if (!path) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60);
  if (error || !data) notFound();
  redirect(data.signedUrl);
}
