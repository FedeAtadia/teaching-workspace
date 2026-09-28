// How numbers and dates are written for the teacher's language. Pure.

/** BOOK-3: `7,5` in es-AR, `7.5` in English; no trailing zeros. */
export function formatGrade(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/**
 * TASK-4. `iso` is a date-only value (`2026-05-10`). Formatted in UTC because
 * that is how it parses: in local time, Argentina (UTC−3) would show the 9th.
 */
export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
