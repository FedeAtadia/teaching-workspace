// A school's calendar for a school year and its days without class (CAL-1..3).
// Scoped to one teacher (OWNER-1).

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { academicYears, schoolCalendars, schoolDaysOff, schools } from "@/db/schema";
import { holidaysToAdd, type DayOff } from "@/lib/calendar";
import { nationalHolidays } from "@/lib/holidays";
import type { CalendarInput, DayOffEdit, DayOffInput } from "@/lib/validation";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

type NotFound = { ok: false; error: "notFound" };
const notFound: NotFound = { ok: false, error: "notFound" };

export type SchoolCalendar = {
  schoolId: string;
  school: string;
  academicYearId: string;
  schoolYear: string;
  /** CAL-1: null until its dates are saved. */
  calendar: { id: string; startsOn: string; term2StartsOn: string; endsOn: string } | null;
  /** CAL-2, by date. */
  daysOff: DayOff[];
};

/** The teacher's school and school year of that name, or null. */
async function findSchoolYear(db: Db, teacherId: string, schoolId: string, schoolYear: string) {
  if (!isUuid(schoolId)) return null;
  const [row] = await db
    .select({ schoolId: schools.id, school: schools.name, academicYearId: academicYears.id, schoolYear: academicYears.name })
    .from(schools)
    .innerJoin(academicYears, and(eq(academicYears.teacherId, teacherId), eq(academicYears.name, schoolYear)))
    .where(and(eq(schools.id, schoolId), eq(schools.teacherId, teacherId)));
  return row ?? null;
}

/** CAL-1, CAL-2: the school's calendar for a school year the teacher has; null otherwise. */
export async function getCalendar(
  db: Db,
  teacherId: string,
  schoolId: string,
  schoolYear: string,
): Promise<SchoolCalendar | null> {
  const found = await findSchoolYear(db, teacherId, schoolId, schoolYear);
  if (!found) return null;
  const [calendar] = await db
    .select({
      id: schoolCalendars.id,
      startsOn: schoolCalendars.startsOn,
      term2StartsOn: schoolCalendars.term2StartsOn,
      endsOn: schoolCalendars.endsOn,
    })
    .from(schoolCalendars)
    .where(
      and(
        eq(schoolCalendars.schoolId, found.schoolId),
        eq(schoolCalendars.academicYearId, found.academicYearId),
        eq(schoolCalendars.teacherId, teacherId),
      ),
    );
  const daysOff = calendar ? await listDaysOff(db, teacherId, calendar.id) : [];
  return { ...found, calendar: calendar ?? null, daysOff };
}

/** CAL-2, by date. */
export async function listDaysOff(db: Db, teacherId: string, calendarId: string): Promise<DayOff[]> {
  return db
    .select({
      id: schoolDaysOff.id,
      startsOn: schoolDaysOff.startsOn,
      endsOn: schoolDaysOff.endsOn,
      kind: schoolDaysOff.kind,
      name: schoolDaysOff.name,
    })
    .from(schoolDaysOff)
    .where(and(eq(schoolDaysOff.calendarId, calendarId), eq(schoolDaysOff.teacherId, teacherId)))
    .orderBy(asc(schoolDaysOff.startsOn), asc(schoolDaysOff.endsOn));
}

/** CAL-1: saves the three dates, creating the calendar the first time. */
export async function saveCalendar(db: Db, teacherId: string, input: CalendarInput): Promise<{ ok: true } | NotFound> {
  const found = await findSchoolYear(db, teacherId, input.schoolId, String(input.schoolYear));
  if (!found) return notFound;
  const dates = { startsOn: input.startsOn, term2StartsOn: input.term2StartsOn, endsOn: input.endsOn };
  await db
    .insert(schoolCalendars)
    .values({ teacherId, schoolId: found.schoolId, academicYearId: found.academicYearId, ...dates })
    .onConflictDoUpdate({ target: [schoolCalendars.schoolId, schoolCalendars.academicYearId], set: dates });
  return { ok: true };
}

async function ownCalendar(db: Db, teacherId: string, calendarId: string): Promise<boolean> {
  if (!isUuid(calendarId)) return false;
  const rows = await db
    .select({ id: schoolCalendars.id })
    .from(schoolCalendars)
    .where(and(eq(schoolCalendars.id, calendarId), eq(schoolCalendars.teacherId, teacherId)));
  return rows.length > 0;
}

/** CAL-2 */
export async function addDayOff(db: Db, teacherId: string, input: DayOffInput): Promise<{ ok: true } | NotFound> {
  if (!(await ownCalendar(db, teacherId, input.calendarId))) return notFound;
  const { calendarId, startsOn, endsOn, kind, name } = input;
  await db.insert(schoolDaysOff).values({ teacherId, calendarId, startsOn, endsOn, kind, name });
  return { ok: true };
}

const ownDayOff = (teacherId: string, dayOffId: string) =>
  and(eq(schoolDaysOff.id, dayOffId), eq(schoolDaysOff.teacherId, teacherId));

/** CAL-2 */
export async function updateDayOff(db: Db, teacherId: string, input: DayOffEdit): Promise<{ ok: true } | NotFound> {
  if (!isUuid(input.dayOffId)) return notFound;
  const { startsOn, endsOn, kind, name } = input;
  const updated = await db
    .update(schoolDaysOff)
    .set({ startsOn, endsOn, kind, name })
    .where(ownDayOff(teacherId, input.dayOffId))
    .returning({ id: schoolDaysOff.id });
  return updated.length > 0 ? { ok: true } : notFound;
}

/** CAL-2 */
export async function deleteDayOff(
  db: Db,
  teacherId: string,
  input: { dayOffId: string },
): Promise<{ ok: true } | NotFound> {
  if (!isUuid(input.dayOffId)) return notFound;
  const deleted = await db
    .delete(schoolDaysOff)
    .where(ownDayOff(teacherId, input.dayOffId))
    .returning({ id: schoolDaysOff.id });
  return deleted.length > 0 ? { ok: true } : notFound;
}

/** CAL-3: the school year's national holidays, as one-day feriados, skipping days already covered. */
export async function addNationalHolidays(
  db: Db,
  teacherId: string,
  input: { calendarId: string },
): Promise<{ ok: true; added: number } | NotFound | { ok: false; error: "noList" }> {
  if (!isUuid(input.calendarId)) return notFound;
  const [calendar] = await db
    .select({ id: schoolCalendars.id, schoolYear: academicYears.name })
    .from(schoolCalendars)
    .innerJoin(academicYears, eq(schoolCalendars.academicYearId, academicYears.id))
    .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.teacherId, teacherId)));
  if (!calendar) return notFound;
  const holidays = nationalHolidays(Number(calendar.schoolYear));
  if (!holidays) return { ok: false, error: "noList" };

  const missing = holidaysToAdd(holidays, await listDaysOff(db, teacherId, calendar.id));
  if (missing.length > 0) {
    await db.insert(schoolDaysOff).values(
      missing.map((h) => ({
        teacherId,
        calendarId: calendar.id,
        startsOn: h.date,
        endsOn: h.date,
        kind: "holiday" as const,
        name: h.name,
      })),
    );
  }
  return { ok: true, added: missing.length };
}
