// Task attachments: which files are allowed and where they are stored.
// Pure, so the browser (before uploading) and the server (before recording)
// apply the same rules. Storage enforces them too (supabase/storage.sql).

export const ATTACHMENT_BUCKET = "task-files";

/** FILE-1 */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export type AttachmentCheck = "ok" | "empty" | "wrongType" | "tooBig";

/** FILE-1 */
export function checkAttachment(file: { type: string; size: number }): AttachmentCheck {
  if (file.size === 0) return "empty";
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) return "wrongType";
  if (file.size > MAX_ATTACHMENT_BYTES) return "tooBig";
  return "ok";
}

/**
 * FILE-2: `<teacher id>/<task id>/<safe name>`. Accents are dropped and
 * anything but letters, digits, `_` and `-` becomes a dash, so the name
 * can't leave the folder and works as a Storage key; the extension stays.
 */
export function attachmentPath(teacherId: string, taskId: string, fileName: string): string {
  const plain = fileName.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const match = plain.match(/\.([A-Za-z0-9]{1,5})$/);
  const ext = match ? `.${match[1]}` : "";
  const base = (match ? plain.slice(0, -ext.length) : plain)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${teacherId}/${taskId}/${base || "archivo"}${ext}`;
}

/** FILE-2: a path the app will record for this task — its own folder, one plain file name. */
export function isTaskFilePath(path: string, teacherId: string, taskId: string): boolean {
  const prefix = `${teacherId}/${taskId}/`;
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return /^[A-Za-z0-9._-]+$/.test(name) && !name.includes("..");
}
