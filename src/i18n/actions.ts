"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./config";

export async function setLocale(locale: string) {
  (await cookies()).set(LOCALE_COOKIE, resolveLocale(locale), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
