// How numbers and dates are written for the teacher's language. Pure.

/** BOOK-3: `7,5` in es-AR, `7.5` in English; no trailing zeros. */
export function formatGrade(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

const pad = (n: string) => n.padStart(2, "0");

/**
 * TASK-4: DD/MM/YYYY in every language. `iso` is a date-only value
 * (`2026-05-10`), so it is rewritten rather than parsed: as a Date it would be
 * midnight UTC, and Argentina (UTC−3) would show the 9th.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** TASK-4, ATT-5: DD/MM, for a column header. */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * INPUT-4: a typed DD/MM/YYYY (or D/M/YYYY, with / - or .) as the stored
 * `YYYY-MM-DD`, or null when it isn't a real date.
 */
export function parseDate(text: string): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  // 31/02 rolls over to March: then it wasn't a date.
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) {
    return null;
  }
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/**
 * INPUT-4: while digits are typed, put in the slashes (DD/MM/YYYY), so a
 * phone's number pad is enough. Text with slashes only where this puts them is
 * redone from its digits as it grows; text the teacher separated another way
 * (`5/3/2026`) is left as is.
 */
export function withSlashes(text: string): string {
  const own = [...text].every((ch, i) => /\d/.test(ch) || (ch === "/" && (i === 2 || i === 5)));
  if (!own) return text;
  const digits = text.replace(/\//g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}
