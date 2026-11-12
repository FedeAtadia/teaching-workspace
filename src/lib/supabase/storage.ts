import "server-only";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { createClient } from "./server";

/** Deletes files from Storage as the signed-in teacher (their folder only, FILE-2), in one request. */
export async function removeStoredFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
}
