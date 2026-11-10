import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routeFor } from "@/lib/access";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Refreshes the Supabase session cookie on every request. Anyone not signed in
// can open the home page and sign in, and is sent to /login from anywhere
// else; a signed-in teacher skips the home page and /login (LAND-1, LAND-2).
// This is an optimistic check only: pages still verify the user on the server
// before reading data.
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims checks the session's signature locally against the project's
  // published keys (fetched once, then cached), refreshing an expired session
  // first. getUser would ask the Auth server on every request: ~100 ms each.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims.sub;

  const to = routeFor(request.nextUrl.pathname, signedIn);
  if (to) {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
