import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in teacher's id, which every query is scoped to (OWNER-1).
 * Checked on the server on every request: the proxy's redirect is only a
 * convenience, not the check.
 *
 * getClaims verifies the session's signature locally (see src/proxy.ts), and
 * `cache` makes a layout and its page share one check per request.
 */
export const requireTeacherId = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (!id) redirect("/login");
  return id;
});
