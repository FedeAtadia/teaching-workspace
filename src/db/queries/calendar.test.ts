import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, newTeacher } from "@/test/db";
import type { CalendarInput, ClassInput } from "@/lib/validation";
import { addDayOff, addNationalHolidays, deleteDayOff, getCalendar, saveCalendar, updateDayOff } from "./calendar";
import { createClass, listSchools, updateClass } from "./classes";
import { getClass } from "./classDetail";
import { createGroup, listGroups, updateGroup } from "./groups";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const aClass = (over: Partial<ClassInput> = {}): ClassInput => ({
  name: "Matemática",
  year: 4,
  division: "A",
  shift: "morning",
  school: "EPET 30",
  schoolYear: 2026,
  ...over,
});

/** A teacher with one class at EPET 30 in 2026, and that school's id. */
async function setup() {
  const teacher = newTeacher();
  const created = await createClass(db, teacher, aClass({ weekdays: [1, 3] }));
  if (!created.ok) throw new Error("setup failed");
  const [school] = await listSchools(db, teacher);
  return { teacher, classId: created.classId, schoolId: school.id };
}

const dates = (schoolId: string, over: Partial<CalendarInput> = {}): CalendarInput => ({
  schoolId,
  schoolYear: 2026,
  startsOn: "2026-03-02",
  term2StartsOn: "2026-07-27",
  endsOn: "2026-12-11",
  ...over,
});

describe("a school's calendar (CAL-1)", () => {
  it("starts without dates, and keeps them once saved; saving again changes them", async () => {
    const { teacher, schoolId } = await setup();
    expect((await getCalendar(db, teacher, schoolId, "2026"))?.calendar).toBeNull();

    expect(await saveCalendar(db, teacher, dates(schoolId))).toEqual({ ok: true });
    expect((await getCalendar(db, teacher, schoolId, "2026"))?.calendar).toMatchObject({
      startsOn: "2026-03-02",
      term2StartsOn: "2026-07-27",
      endsOn: "2026-12-11",
    });

    await saveCalendar(db, teacher, dates(schoolId, { endsOn: "2026-12-18" }));
    const again = await getCalendar(db, teacher, schoolId, "2026");
    expect(again?.calendar?.endsOn).toBe("2026-12-18");
    expect(again?.school).toBe("EPET 30");
  });

  it("is only for the school years the teacher has", async () => {
    const { teacher, schoolId } = await setup();
    expect(await getCalendar(db, teacher, schoolId, "2031")).toBeNull();
    expect(await saveCalendar(db, teacher, dates(schoolId, { schoolYear: 2031 }))).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  it("lists each school's school years, newest first, for the links in Settings", async () => {
    const { teacher } = await setup();
    await createClass(db, teacher, aClass({ schoolYear: 2027 }));
    await createClass(db, teacher, aClass({ name: "Física" }));
    const [school] = await listSchools(db, teacher);
    expect(school.years).toEqual(["2027", "2026"]);
    // And how many courses it has: 4° A in 2026 and in 2027.
    expect(school.courses).toBe(2);
  });
});

describe("days without class (CAL-2)", () => {
  async function withCalendar() {
    const s = await setup();
    await saveCalendar(db, s.teacher, dates(s.schoolId));
    const calendarId = (await getCalendar(db, s.teacher, s.schoolId, "2026"))!.calendar!.id;
    return { ...s, calendarId };
  }

  it("are added, listed by date, changed and deleted", async () => {
    const { teacher, schoolId, calendarId } = await withCalendar();
    const day = { calendarId, kind: "jornada" as const, name: "Jornada institucional" };
    expect(await addDayOff(db, teacher, { ...day, startsOn: "2026-11-04", endsOn: "2026-11-04" })).toEqual({ ok: true });
    await addDayOff(db, teacher, { ...day, kind: "recess", name: "Receso", startsOn: "2026-07-13", endsOn: "2026-07-24" });

    let off = (await getCalendar(db, teacher, schoolId, "2026"))!.daysOff;
    expect(off.map((d) => d.name)).toEqual(["Receso", "Jornada institucional"]);

    const jornada = off[1];
    expect(
      await updateDayOff(db, teacher, { ...day, dayOffId: jornada.id, startsOn: "2026-11-05", endsOn: "2026-11-05" }),
    ).toEqual({ ok: true });
    expect(await deleteDayOff(db, teacher, { dayOffId: off[0].id })).toEqual({ ok: true });

    off = (await getCalendar(db, teacher, schoolId, "2026"))!.daysOff;
    expect(off).toEqual([
      { id: jornada.id, startsOn: "2026-11-05", endsOn: "2026-11-05", kind: "jornada", name: "Jornada institucional" },
    ]);
  });

  it("need the school's calendar to exist", async () => {
    const { teacher } = await setup();
    const result = await addDayOff(db, teacher, {
      calendarId: "0b7f3c2e-4a1d-4c8e-9f6a-2d5b8e1c3a7f",
      kind: "holiday",
      name: "Feriado",
      startsOn: "2026-05-01",
      endsOn: "2026-05-01",
    });
    expect(result).toEqual({ ok: false, error: "notFound" });
  });
});

describe("national holidays (CAL-3)", () => {
  it("are added as one-day feriados, and adding them again adds nothing", async () => {
    const { teacher, schoolId } = await setup();
    await saveCalendar(db, teacher, dates(schoolId));
    const calendarId = (await getCalendar(db, teacher, schoolId, "2026"))!.calendar!.id;
    // A recess already covering 9 and 10 July: those two are skipped.
    await addDayOff(db, teacher, { calendarId, kind: "recess", name: "Receso", startsOn: "2026-07-06", endsOn: "2026-07-17" });

    const first = await addNationalHolidays(db, teacher, { calendarId });
    expect(first.ok && first.added).toBeGreaterThan(10);
    const off = (await getCalendar(db, teacher, schoolId, "2026"))!.daysOff;
    expect(off).toContainEqual(
      expect.objectContaining({ startsOn: "2026-05-25", endsOn: "2026-05-25", kind: "holiday" }),
    );
    expect(off.filter((d) => d.startsOn === "2026-07-09")).toEqual([]);

    expect(await addNationalHolidays(db, teacher, { calendarId })).toEqual({ ok: true, added: 0 });
  });

  it("say so for a year the app keeps no list of", async () => {
    const teacher = newTeacher();
    await createClass(db, teacher, aClass({ schoolYear: 2040 }));
    const [school] = await listSchools(db, teacher);
    await saveCalendar(db, teacher, {
      schoolId: school.id,
      schoolYear: 2040,
      startsOn: "2040-03-01",
      term2StartsOn: "2040-07-30",
      endsOn: "2040-12-14",
    });
    const calendarId = (await getCalendar(db, teacher, school.id, "2040"))!.calendar!.id;
    expect(await addNationalHolidays(db, teacher, { calendarId })).toEqual({ ok: false, error: "noList" });
  });
});

describe("a class's days of the week (CAL-4)", () => {
  it("are kept when adding and changing the class", async () => {
    const { teacher, classId } = await setup();
    expect((await getClass(db, teacher, classId))?.weekdays).toEqual([1, 3]);
    await updateClass(db, teacher, { ...aClass(), classId, weekdays: [2, 4] });
    expect((await getClass(db, teacher, classId))?.weekdays).toEqual([2, 4]);
  });

  it("start empty when not given", async () => {
    const teacher = newTeacher();
    const created = await createClass(db, teacher, aClass());
    expect(created.ok && (await getClass(db, teacher, created.classId))?.weekdays).toEqual([]);
  });

  it("can be a group's own (GROUP-1)", async () => {
    const { teacher, classId } = await setup();
    const g = await createGroup(db, teacher, { classId, name: "Lunes", days: null, weekdays: [1] });
    if (!g.ok) throw new Error("group not created");
    expect((await listGroups(db, teacher, classId))[0].weekdays).toEqual([1]);
    await updateGroup(db, teacher, { classId, groupId: g.groupId, name: "Lunes", days: null, weekdays: [1, 5] });
    expect((await listGroups(db, teacher, classId))[0].weekdays).toEqual([1, 5]);
  });
});

describe("each teacher's calendars (OWNER-1)", () => {
  it("can't be read or changed by another teacher", async () => {
    const { teacher, schoolId } = await setup();
    await saveCalendar(db, teacher, dates(schoolId));
    const calendarId = (await getCalendar(db, teacher, schoolId, "2026"))!.calendar!.id;
    await addDayOff(db, teacher, { calendarId, kind: "holiday", name: "Feriado", startsOn: "2026-05-01", endsOn: "2026-05-01" });
    const [dayOff] = (await getCalendar(db, teacher, schoolId, "2026"))!.daysOff;

    const other = newTeacher();
    await createClass(db, other, aClass());
    const notFound = { ok: false, error: "notFound" };
    expect(await getCalendar(db, other, schoolId, "2026")).toBeNull();
    expect(await saveCalendar(db, other, dates(schoolId, { endsOn: "2026-12-30" }))).toEqual(notFound);
    expect(
      await addDayOff(db, other, { calendarId, kind: "other", name: "x", startsOn: "2026-06-01", endsOn: "2026-06-01" }),
    ).toEqual(notFound);
    expect(
      await updateDayOff(db, other, { calendarId, dayOffId: dayOff.id, kind: "other", name: "x", startsOn: "2026-06-01", endsOn: "2026-06-01" }),
    ).toEqual(notFound);
    expect(await deleteDayOff(db, other, { dayOffId: dayOff.id })).toEqual(notFound);
    expect(await addNationalHolidays(db, other, { calendarId })).toEqual(notFound);

    const mine = (await getCalendar(db, teacher, schoolId, "2026"))!;
    expect(mine.calendar?.endsOn).toBe("2026-12-11");
    expect(mine.daysOff).toEqual([dayOff]);
  });
});
