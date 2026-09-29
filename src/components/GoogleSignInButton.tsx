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
      className="h-12 w-full rounded-xl bg-primary px-4 font-extrabold text-primary-foreground transition hover:brightness-95"
    >
      {label}
    </button>
  );
}
