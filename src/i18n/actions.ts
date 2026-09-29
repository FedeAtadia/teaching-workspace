"use server";

import { cookies } from "next/headers";
import { resolveSidebar, resolveTheme, SIDEBAR_COOKIE, THEME_COOKIE } from "@/lib/theme";
import { LOCALE_COOKIE, resolveLocale } from "./config";

// Preferences live in cookies so the server renders them from the first byte.
const YEAR = { path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function setLocale(locale: string) {
  (await cookies()).set(LOCALE_COOKIE, resolveLocale(locale), YEAR);
}

/** THEME-1 */
export async function setTheme(theme: string) {
  (await cookies()).set(THEME_COOKIE, resolveTheme(theme), YEAR);
}

/** NAV-1 */
export async function setSidebar(state: string) {
  (await cookies()).set(SIDEBAR_COOKIE, resolveSidebar(state), YEAR);
}
