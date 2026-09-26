import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

/** For Client Components (the sign-in button). */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
