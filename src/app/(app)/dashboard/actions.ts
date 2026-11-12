"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { dismissDeletedNotice } from "@/db/queries/retention";
import { requireTeacherId } from "@/lib/auth";

/** KEEP-4: the teacher has read that graduates were deleted. */
export async function dismissGraduatesNotice() {
  await dismissDeletedNotice(getDb(), await requireTeacherId());
  revalidatePath("/dashboard");
}
