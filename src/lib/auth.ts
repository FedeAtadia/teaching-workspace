import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in teacher's id, which every query is scoped to (OWNER-1).
 * Checked on the server on every call: the proxy's redirect is only a
 * convenience, not the check.
 */
export async function requireTeacherId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}
