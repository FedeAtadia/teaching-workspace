"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { dismissDeletedNotice } from "@/db/queries/retention";
import { acceptShare, leaveShare } from "@/db/queries/shares";
import { requireTeacher, requireTeacherId } from "@/lib/auth";

/** KEEP-4: the teacher has read that graduates were deleted. */
export async function dismissGraduatesNotice() {
  await dismissDeletedNotice(getDb(), await requireTeacherId());
  revalidatePath("/dashboard");
}

/** SHARE-2: the invitation accepted; the class shows under "Compartidos conmigo". */
export async function acceptShareAction(input: { shareId: string }): Promise<{ ok: boolean }> {
  const result = await acceptShare(getDb(), await requireTeacher(), input.shareId);
  if (result.ok) revalidatePath("/", "layout");
  return { ok: result.ok };
}

/** SHARE-2, SHARE-4: an invitation declined, or a shared class no longer seen. */
export async function declineShareAction(input: { shareId: string }): Promise<{ ok: boolean }> {
  const result = await leaveShare(getDb(), await requireTeacher(), input.shareId);
  if (result.ok) revalidatePath("/", "layout");
  return { ok: result.ok };
}
