import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { courseStudents } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { AttendanceStatus } from "@/lib/attendance";
import {
  clearDay,
  getAttendanceDay,
  getAttendanceRates,
  getAttendanceSheet,
  saveAttendance,
  saveNoClass,
} from "./attendance";
import { addDayOff, getCalendar, saveCalendar } from "./calendar";
import { createClass, listSchools } from "./classes";
import { getClass, listClassStudents, type ClassDetail } from "./classDetail";
import { createGroup, setStudentGroup } from "./groups";
import { getStudentHistory } from "./history";
import { getMinAttendance, setMinAttendance } from "./settings";
import { createStudent } from "./students";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

type Setup = { teacher: string; cls: ClassDetail; s: Record<string, string> };

/**
 * Laboratorio, lunes and miércoles, at a school whose 2026 calendar runs from
 * 2 March (2° cuatrimestre from 27 July) to 11 December, with 12 October off.
 * Students Ana, Bea and Carla.
 */
async function setup({ calendar = true } = {}): Promise<Setup> {
  const teacher = newTeacher();
  const created = await createClass(db, teacher, {
    name: "Laboratorio",
    year: 4,
    division: "A",
    shift: "morning",
    school: "EPET 30",
    schoolYear: 2026,
    weekdays: [1, 3],
  });
  if (!created.ok) throw new Error("setup failed");
  const cls = (await getClass(db, teacher, created.classId))!;
  for (const firstName of ["Ana", "Bea", "Carla"]) {
    await createStudent(db, teacher, { firstName, lastName: firstName, courseId: cls.courseId });
  }
  const s = Object.fromEntries((await listClassStudents(db, teacher, cls)).map((st) => [st.firstName, st.id]));
  if (calendar) {
    const [school] = await listSchools(db, teacher);
    await saveCalendar(db, teacher, {
      schoolId: school.id,
      schoolYear: 2026,
      startsOn: "2026-03-02",
      term2StartsOn: "2026-07-27",
      endsOn: "2026-12-11",
    });
    const cal = (await getCalendar(db, teacher, school.id, "2026"))!.calendar!;
    await addDayOff(db, teacher, {
      calendarId: cal.id,
      kind: "holiday",
      name: "Diversidad Cultural",
      startsOn: "2026-10-12",
      endsOn: "2026-10-12",
    });
  }
  return { teacher, cls, s };
}

const marks = (s: Setup, entries: Record<string, AttendanceStatus>) =>
  Object.entries(entries).map(([name, status]) => ({ studentId: s.s[name], status }));

describe("a class's days (ATT-1, ATT-6)", () => {
  it("are its days of the week in the cuatrimestre, with days off marked", async () => {
    const s = await setup();
    const sheet = await getAttendanceSheet(db, s.teacher, s.cls, 2);
    if (!sheet.ok) throw new Error("no sheet");
    // 27 July is a Monday; 11 December a Friday, so the last class day is Wednesday 9 December.
    expect(sheet.days[0].date).toBe("2026-07-27");
    expect(sheet.days.at(-1)?.date).toBe("2026-12-09");
    expect(sheet.days.find((d) => d.date === "2026-10-12")?.state).toBe("off");
    expect(sheet.days.every((d) => d.state === "pending" || d.state === "off")).toBe(true);
  });

  it("are none without a school calendar, which the sheet says", async () => {
    const s = await setup({ calendar: false });
    expect(await getAttendanceSheet(db, s.teacher, s.cls, 1)).toEqual({ ok: false, error: "noCalendar" });
  });
});

describe("taking attendance (ATT-2)", () => {
  it("lists the students expected that day, starting with nothing saved", async () => {
    const s = await setup();
    const day = await getAttendanceDay(db, s.teacher, s.cls, "2026-10-05");
    if (!day.ok) throw new Error("no day");
    expect(day.rows.map((r) => [r.student.firstName, r.status])).toEqual([
      ["Ana", null],
      ["Bea", null],
      ["Carla", null],
    ]);
    expect(day.term).toBe(2);
  });

  it("saves every mark at once and marks the day as taken", async () => {
    const s = await setup();
    expect(
      await saveAttendance(db, s.teacher, s.cls, "2026-10-05", marks(s, { Ana: "present", Bea: "absent", Carla: "late" })),
    ).toEqual({ ok: true });
    const day = await getAttendanceDay(db, s.teacher, s.cls, "2026-10-05");
    expect(day.ok && day.rows.map((r) => r.status)).toEqual(["present", "absent", "late"]);
    expect(day.ok && day.session?.held).toBe(true);

    const sheet = await getAttendanceSheet(db, s.teacher, s.cls, 2);
    if (!sheet.ok) throw new Error("no sheet");
    const col = sheet.days.findIndex((d) => d.date === "2026-10-05");
    expect(sheet.days[col].state).toBe("taken");
    expect(sheet.rows.map((r) => r.cells[col])).toEqual(["present", "absent", "late"]);
  });

  it("changes only the students sent, so saving one group keeps the others' marks", async () => {
    const s = await setup();
    await saveAttendance(db, s.teacher, s.cls, "2026-10-05", marks(s, { Ana: "present", Bea: "present", Carla: "present" }));
    await saveAttendance(db, s.teacher, s.cls, "2026-10-05", marks(s, { Bea: "excused" }));
    const day = await getAttendanceDay(db, s.teacher, s.cls, "2026-10-05");
    expect(day.ok && day.rows.map((r) => r.status)).toEqual(["present", "excused", "present"]);
  });

  it("only saves active students of the course", async () => {
    const s = await setup();
    await db.update(courseStudents).set({ status: "withdrawn" }).where(eq(courseStudents.studentId, s.s.Carla));
    const stranger = await setup();
    await saveAttendance(db, s.teacher, s.cls, "2026-10-05", [
      ...marks(s, { Ana: "present", Carla: "absent" }),
      { studentId: stranger.s.Ana, status: "absent" },
    ]);
    const rates = await getAttendanceRates(db, s.teacher, s.cls, 2);
    expect([...rates.keys()]).toEqual([s.s.Ana]);
  });

  it("refuses a date outside the school year", async () => {
    const s = await setup();
    expect(await saveAttendance(db, s.teacher, s.cls, "2027-02-01", marks(s, { Ana: "present" }))).toEqual({
      ok: false,
      error: "outsideYear",
    });
    expect(await getAttendanceDay(db, s.teacher, s.cls, "2026-02-23")).toEqual({ ok: false, error: "outsideYear" });
  });

  it("lists everyone on a date that isn't one of the class's days, for a make-up class", async () => {
    const s = await setup();
    const g = await createGroup(db, s.teacher, { classId: s.cls.id, name: "Lunes", days: null, weekdays: [1] });
    if (!g.ok) throw new Error("no group");
    await setStudentGroup(db, s.teacher, s.cls, { studentId: s.s.Ana, groupId: g.groupId });

    // Wednesday: not Ana's day.
    const wednesday = await getAttendanceDay(db, s.teacher, s.cls, "2026-10-07");
    expect(wednesday.ok && wednesday.rows.map((r) => r.student.firstName)).toEqual(["Bea", "Carla"]);
    // Friday: nobody's day, so everyone.
    const friday = await getAttendanceDay(db, s.teacher, s.cls, "2026-10-09");
    expect(friday.ok && friday.rows.map((r) => r.student.firstName)).toEqual(["Ana", "Bea", "Carla"]);

    await saveAttendance(db, s.teacher, s.cls, "2026-10-09", marks(s, { Ana: "present" }));
    const sheet = await getAttendanceSheet(db, s.teacher, s.cls, 2, g.groupId);
    if (!sheet.ok) throw new Error("no sheet");
    // The group shows its lunes and the make-up Friday, but no miércoles.
    expect(sheet.days.some((d) => d.date === "2026-10-09")).toBe(true);
    expect(sheet.days.some((d) => d.date === "2026-10-07")).toBe(false);
    expect(sheet.rows.map((r) => r.student.firstName)).toEqual(["Ana"]);
  });
});

describe("a day not held (ATT-3)", () => {
  it("is saved with a reason and a note, and its marks are removed", async () => {
    const s = await setup();
    await saveAttendance(db, s.teacher, s.cls, "2026-10-07", marks(s, { Ana: "absent" }));
    expect(
      await saveNoClass(db, s.teacher, s.cls, { date: "2026-10-07", reason: "strike", note: "Paro docente" }),
    ).toEqual({ ok: true });

    const day = await getAttendanceDay(db, s.teacher, s.cls, "2026-10-07");
    expect(day.ok && day.session).toMatchObject({ held: false, reason: "strike", note: "Paro docente" });
    expect(day.ok && day.rows.every((r) => r.status === null)).toBe(true);
    const sheet = await getAttendanceSheet(db, s.teacher, s.cls, 2);
    expect(sheet.ok && sheet.days.find((d) => d.date === "2026-10-07")?.state).toBe("notHeld");
    expect((await getAttendanceRates(db, s.teacher, s.cls, 2)).size).toBe(0);
  });

  it("can be taken after all, which clears the reason", async () => {
    const s = await setup();
    await saveNoClass(db, s.teacher, s.cls, { date: "2026-10-07", reason: "weather", note: null });
    await saveAttendance(db, s.teacher, s.cls, "2026-10-07", marks(s, { Ana: "present" }));
    const day = await getAttendanceDay(db, s.teacher, s.cls, "2026-10-07");
    expect(day.ok && day.session).toMatchObject({ held: true, reason: null, note: null });
  });

  it("can be cleared back to pending, marks and all", async () => {
    const s = await setup();
    await saveAttendance(db, s.teacher, s.cls, "2026-10-05", marks(s, { Ana: "absent" }));
    expect(await clearDay(db, s.teacher, s.cls, "2026-10-05")).toEqual({ ok: true });
    const sheet = await getAttendanceSheet(db, s.teacher, s.cls, 2);
    expect(sheet.ok && sheet.days.find((d) => d.date === "2026-10-05")?.state).toBe("pending");
    expect((await getAttendanceRates(db, s.teacher, s.cls, 2)).size).toBe(0);
  });
});

describe("attendance percentages (ATT-4, ATT-5)", () => {
  it("count the cuatrimestre's held days only, with tarde as half and justificado left out", async () => {
    const s = await setup();
    await saveAttendance(db, s.teacher, s.cls, "2026-10-05", marks(s, { Ana: "present", Bea: "absent", Carla: "excused" }));
    await saveAttendance(db, s.teacher, s.cls, "2026-10-07", marks(s, { Ana: "late", Bea: "present", Carla: "present" }));
    // A 1° cuatrimestre day doesn't count in the 2°.
    await saveAttendance(db, s.teacher, s.cls, "2026-04-06", marks(s, { Ana: "absent" }));

    const rates = await getAttendanceRates(db, s.teacher, s.cls, 2);
    expect(rates.get(s.s.Ana)).toEqual({ present: 1, absent: 0, late: 1, excused: 0, rate: 75 });
    expect(rates.get(s.s.Bea)?.rate).toBe(50);
    expect(rates.get(s.s.Carla)).toEqual({ present: 1, absent: 0, late: 0, excused: 1, rate: 100 });
    expect((await getAttendanceRates(db, s.teacher, s.cls, 1)).get(s.s.Ana)?.rate).toBe(0);

    const sheet = await getAttendanceSheet(db, s.teacher, s.cls, 2);
    expect(sheet.ok && sheet.rows.map((r) => r.counts.rate)).toEqual([75, 50, 100]);
  });

  it("show in the student's history, per cuatrimestre (HISTORY-5)", async () => {
    const s = await setup();
    await saveAttendance(db, s.teacher, s.cls, "2026-10-05", marks(s, { Ana: "absent" }));
    await saveAttendance(db, s.teacher, s.cls, "2026-10-07", marks(s, { Ana: "present" }));
    const history = await getStudentHistory(db, s.teacher, s.s.Ana);
    const lab = history!.courses[0].classes[0];
    expect(lab.terms.map((t) => [t.position, t.attendance])).toEqual([[2, 50]]);
  });
});

describe("the minimum attendance (SUGGEST-3)", () => {
  it("is 75 until the teacher sets it, then theirs", async () => {
    const teacher = newTeacher();
    expect(await getMinAttendance(db, teacher)).toBe(75);
    await setMinAttendance(db, teacher, 80);
    expect(await getMinAttendance(db, teacher)).toBe(80);
    await setMinAttendance(db, teacher, 0);
    expect(await getMinAttendance(db, teacher)).toBe(0);
    expect(await getMinAttendance(db, newTeacher())).toBe(75);
  });
});

describe("each teacher's attendance (OWNER-1)", () => {
  it("can't be read or changed through another teacher's class", async () => {
    const s = await setup();
    await saveAttendance(db, s.teacher, s.cls, "2026-10-05", marks(s, { Ana: "absent" }));
    const other = newTeacher();
    const notFound = { ok: false, error: "notFound" };

    expect(await getAttendanceSheet(db, other, s.cls, 2)).toEqual(notFound);
    expect(await getAttendanceDay(db, other, s.cls, "2026-10-05")).toEqual(notFound);
    expect(await saveAttendance(db, other, s.cls, "2026-10-05", marks(s, { Ana: "present" }))).toEqual(notFound);
    expect(await saveNoClass(db, other, s.cls, { date: "2026-10-05", reason: "other", note: null })).toEqual(notFound);
    expect(await clearDay(db, other, s.cls, "2026-10-05")).toEqual(notFound);
    expect((await getAttendanceRates(db, other, s.cls, 2)).size).toBe(0);

    expect((await getAttendanceRates(db, s.teacher, s.cls, 2)).get(s.s.Ana)?.rate).toBe(0);
  });
});
