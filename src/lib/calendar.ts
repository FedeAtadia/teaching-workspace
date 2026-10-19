// The school calendar (CAL-1..5). Pure: dates are ISO strings ("2026-10-19"),
// read as calendar days in UTC so no time zone can shift them by one.

import type { NationalHoliday } from "./holidays";

/** CAL-4: lunes 1 to sábado 6, as stored in `weekdays`. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;

export const DAY_OFF_KINDS = ["holiday", "jornada", "recess", "other"] as const;
export type DayOffKind = (typeof DAY_OFF_KINDS)[number];

export type DayOff = { id: string; startsOn: string; endsOn: string; kind: DayOffKind; name: string };

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Lunes 1 … domingo 7. */
export function weekdayOf(iso: string): number {
  return toDate(iso).getUTCDay() || 7;
}

/** CAL-4: the days a student is expected: their group's own, or else the class's. */
export function expectedWeekdays(classWeekdays: readonly number[], groupWeekdays: readonly number[] | undefined) {
  return groupWeekdays && groupWeekdays.length > 0 ? groupWeekdays : classWeekdays;
}

/** CAL-5: the dates from `from` to `to`, both included, that fall on one of `weekdays`. */
export function classDates(from: string, to: string, weekdays: readonly number[]): string[] {
  if (weekdays.length === 0) return [];
  const out: string[] = [];
  const end = toDate(to).getTime();
  for (const d = toDate(from); d.getTime() <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (weekdays.includes(d.getUTCDay() || 7)) out.push(toIso(d));
  }
  return out;
}

/** CAL-5: the day without class covering `date`, if any. ISO dates compare as strings. */
export function dayOffOn<T extends Pick<DayOff, "startsOn" | "endsOn">>(date: string, daysOff: readonly T[]): T | null {
  return daysOff.find((d) => d.startsOn <= date && date <= d.endsOn) ?? null;
}

/** CAL-3: the holidays not already covered by a day without class. */
export function holidaysToAdd(
  holidays: readonly NationalHoliday[],
  listed: readonly Pick<DayOff, "startsOn" | "endsOn">[],
): NationalHoliday[] {
  return holidays.filter((h) => !dayOffOn(h.date, listed));
}

/** Today's date where the school is, not on the server's clock (UTC on Vercel). */
export function todayInArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(now);
}
