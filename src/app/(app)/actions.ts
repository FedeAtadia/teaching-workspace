"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * NAV-4: ends the session on this device only ("local"), so the teacher's
 * phone stays signed in when they sign out of a school computer, then goes
 * to the public home page.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
