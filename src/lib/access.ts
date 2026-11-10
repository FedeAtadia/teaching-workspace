/** Signing in: the sign-in page and the address Google returns to. */
const SIGN_IN = ["/login", "/auth"];

/** Open to everyone, signed in or not: what installing the app needs (INSTALL-2). */
const ALWAYS_OPEN = ["/manifest.webmanifest"];

const startsWithAny = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Where a request should go instead, or null to let it through (LAND-1,
 * LAND-2, INSTALL-2). The home page is public by exact match: as a prefix,
 * "/" would open every page.
 */
export function routeFor(pathname: string, signedIn: boolean): string | null {
  if (ALWAYS_OPEN.includes(pathname)) return null;
  const home = pathname === "/";
  if (signedIn) return home || startsWithAny(pathname, ["/login"]) ? "/dashboard" : null;
  return home || startsWithAny(pathname, SIGN_IN) ? null : "/login";
}
