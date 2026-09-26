"use client";

import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton({ label }: { label: string }) {
  async function signIn() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }
  return (
    <button
      type="button"
      onClick={signIn}
      className="w-full rounded-md bg-foreground px-4 py-2 font-medium text-background hover:opacity-90"
    >
      {label}
    </button>
  );
}
