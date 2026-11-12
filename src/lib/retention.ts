// KEEP-1..3: how long a graduate is kept. Pure, so the dates are tested
// without a database.

/** KEEP-2: what the teacher can choose, in months. */
export const RETENTION_OPTIONS = [6, 12, 24, 36, 60] as const;
export const DEFAULT_RETENTION_MONTHS = 12;
/** KEEP-3: how many days ahead Home warns of a deletion. */
export const NOTICE_DAYS = 30;

const pad = (n: number) => String(n).padStart(2, "0");

/** A date (YYYY-MM-DD) some months later; the 31st of a month becomes the last day of a shorter one. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * KEEP-1: the day a graduate is deleted. The time counts from the day they
 * were marked as graduated or, if later, from their last exam: someone who
 * passed an owed class long after graduating is not deleted the same day.
 */
export function deletionDate(graduatedOn: string, lastExamOn: string | null, months: number): string {
  const from = lastExamOn && lastExamOn > graduatedOn ? lastExamOn : graduatedOn;
  return addMonths(from, months);
}

/** KEEP-2: any other number of months is the default. */
export function resolveRetention(months: number | null | undefined): number {
  return (RETENTION_OPTIONS as readonly number[]).includes(months ?? NaN) ? (months as number) : DEFAULT_RETENTION_MONTHS;
}
