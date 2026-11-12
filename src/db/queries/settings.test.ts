import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { DEFAULT_RULES } from "@/lib/grading";
import { createTestDb, newTeacher } from "@/test/db";
import { getMinAttendance, getRules, setMinAttendance, setRules } from "./settings";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

const hundred = { gradeMin: 0, gradeMax: 100, passMark: 60, maxTermIncrease: 30, maxTermDecrease: 25.5 };

describe("a teacher's grading rules (GRADE-4)", () => {
  it("are the defaults until the teacher changes them, then theirs alone (OWNER-1)", async () => {
    const teacher = newTeacher();
    const other = newTeacher();
    expect(await getRules(db, teacher)).toEqual(DEFAULT_RULES);

    await setRules(db, teacher, hundred);
    expect(await getRules(db, teacher)).toEqual(hundred);
    expect(await getRules(db, other)).toEqual(DEFAULT_RULES);

    await setRules(db, teacher, { ...hundred, passMark: 70 });
    expect((await getRules(db, teacher)).passMark).toBe(70);
  });

  it("leave the teacher's other settings as they were", async () => {
    const teacher = newTeacher();
    await setMinAttendance(db, teacher, 80);
    await setRules(db, teacher, hundred);
    expect(await getMinAttendance(db, teacher)).toBe(80);
    await setMinAttendance(db, teacher, 60);
    expect(await getRules(db, teacher)).toEqual(hundred);
  });
});
