export const locales = ["es-AR", "en"] as const;
export type Locale = (typeof locales)[number];

/** LOCALE-1 */
export const defaultLocale: Locale = "es-AR";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** LOCALE-2: anything unknown falls back to the default. */
export function resolveLocale(value: string | undefined): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
}
