import "server-only";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { createClient } from "./server";

/** Deletes files from Storage as the signed-in teacher (their folder only, FILE-2), in one request. */
export async function removeStoredFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
}

/**
 * COPY-3: copies files within the signed-in teacher's folder (FILE-2), and
 * answers the paths whose copy failed, so their link can be removed.
 */
export async function copyStoredFiles(copies: { from: string; to: string }[]): Promise<string[]> {
  if (copies.length === 0) return [];
  const supabase = await createClient();
  const bucket = supabase.storage.from(ATTACHMENT_BUCKET);
  const results = await Promise.all(
    copies.map(async ({ from, to }) => {
      try {
        const { error } = await bucket.copy(from, to);
        return error ? to : null;
      } catch {
        return to;
      }
    }),
  );
  return results.filter((p): p is string => p !== null);
}
