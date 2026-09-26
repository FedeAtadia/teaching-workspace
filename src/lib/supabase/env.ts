// Read once, in one place. When these are missing (fresh clone, offline work
// before a Supabase project exists) the app still runs, with auth switched off
// and a banner saying so, instead of crashing on every request.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return supabaseUrl !== "" && supabaseKey !== "";
}
