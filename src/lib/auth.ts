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
/**
 * SHARE-1: the signed-in teacher with their email and name as Google gives
 * them, for sharing. The email is verified by Google, so a share can be
 * matched to its guest by it.
 */
export const requireTeacher = cache(async (): Promise<{ id: string; email: string; name: string | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const meta = claims.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
  const name = meta?.full_name ?? meta?.name;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "",
    name: typeof name === "string" && name.trim() !== "" ? name.trim() : null,
  };
});

export const requireTeacherId = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (!id) redirect("/login");
  return id;
});
