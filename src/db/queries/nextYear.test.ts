import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { courseStudents } from "@/db/schema";
import { createTestDb, newTeacher } from "@/test/db";
import type { ClassInput } from "@/lib/validation";
import type { YearOutcome } from "@/lib/yearEnd";
import { createClass } from "./classes";
import { getClass, listClassStudents, type ClassDetail } from "./classDetail";
import { getStudentHistory } from "./history";
import { createStudent } from "./students";
import { setOutcome } from "./yearEnd";
import { bringStudents, listNextYearCandidates } from "./nextYear";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

/** One class with these students (by last name), each with an outcome if given. */
async function course(
  teacher: string,
  over: Partial<ClassInput>,
  people: Record<string, YearOutcome | null>,
): Promise<{ cls: ClassDetail; ids: Record<string, string> }> {
  const created = await createClass(db, teacher, {
    name: "Matemática",
    year: 4,
    division: "A",
    shift: "morning",
    school: "Escuela 5",
    schoolYear: 2026,
    ...over,
  });
  if (!created.ok) throw new Error("setup failed");
  const cls = (await getClass(db, teacher, created.classId))!;
  for (const lastName of Object.keys(people)) {
    await createStudent(db, teacher, { firstName: "Ana", lastName, courseId: cls.courseId });
  }
  const roster = await listClassStudents(db, teacher, cls);
  const ids = Object.fromEntries(roster.map((s) => [s.lastName, s.id]));
  for (const [lastName, outcome] of Object.entries(people)) {
    if (outcome) await setOutcome(db, teacher, { classId: cls.id, studentId: ids[lastName], outcome });
  }
  return { cls, ids };
}

/** Last year's 3° A, 3° B and 4° A, and this year's empty 4° A, all at Escuela 5. */
async function setup() {
  const teacher = newTeacher();
  const thirdA = await course(teacher, { year: 3, schoolYear: 2025 }, {
    Pérez: "promoted",
    Gómez: "repeats",
    Díaz: null,
  });
  const thirdB = await course(teacher, { year: 3, division: "B", shift: "afternoon", schoolYear: 2025 }, {
    Álvarez: "promoted",
  });
  const fourthA = await course(teacher, { year: 4, schoolYear: 2025 }, { Ruiz: "repeats", Sosa: "promoted" });
  const target = await course(teacher, { year: 4, schoolYear: 2026 }, {});
  return { teacher, thirdA, thirdB, fourthA, target };
}

const names = (groups: Awaited<ReturnType<typeof listNextYearCandidates>>) =>
  groups.map((g) => [`${g.year}° ${g.division}`, g.outcome, g.students.map((s) => s.lastName)]);

describe("who can be brought in (NEXT-1, NEXT-2)", () => {
  it("offers last year's promoted from the year below and repeaters of the same year, by old course", async () => {
    const s = await setup();
    expect(names(await listNextYearCandidates(db, s.teacher, s.target.cls))).toEqual([
      ["3° A", "promoted", ["Pérez"]],
      ["3° B", "promoted", ["Álvarez"]],
      ["4° A", "repeats", ["Ruiz"]],
    ]);
  });

  it("leaves out other schools, other school years, graduates and students who left", async () => {
    const s = await setup();
    await course(s.teacher, { year: 3, school: "Escuela 9", schoolYear: 2025 }, { Otra: "promoted" });
    await course(s.teacher, { year: 3, schoolYear: 2024 }, { Vieja: "promoted" });
    await db.update(courseStudents).set({ status: "withdrawn" }).where(eq(courseStudents.studentId, s.thirdB.ids.Álvarez));
    const sixth = await course(s.teacher, { year: 6, schoolYear: 2026 }, {});
    await course(s.teacher, { year: 6, schoolYear: 2025 }, { Egresada: "graduated" });

    expect(names(await listNextYearCandidates(db, s.teacher, s.target.cls))).toEqual([
      ["3° A", "promoted", ["Pérez"]],
      ["4° A", "repeats", ["Ruiz"]],
    ]);
    expect(await listNextYearCandidates(db, s.teacher, sixth.cls)).toEqual([]);
  });

  it("offers a 1° course only its repeaters", async () => {
    const teacher = newTeacher();
    await course(teacher, { year: 1, schoolYear: 2025 }, { Repite: "repeats", Pasa: "promoted" });
    const first = await course(teacher, { year: 1, schoolYear: 2026 }, {});
    expect(names(await listNextYearCandidates(db, teacher, first.cls))).toEqual([["1° A", "repeats", ["Repite"]]]);
  });
});

describe("bringing them in (NEXT-2, NEXT-3)", () => {
  it("adds the ticked students, who then aren't offered again, and keeps their old course", async () => {
    const s = await setup();
    expect(await bringStudents(db, s.teacher, s.target.cls, [s.thirdA.ids.Pérez, s.fourthA.ids.Ruiz])).toEqual({
      ok: true,
      added: 2,
    });

    expect((await listClassStudents(db, s.teacher, s.target.cls)).map((r) => r.lastName)).toEqual(["Pérez", "Ruiz"]);
    expect(names(await listNextYearCandidates(db, s.teacher, s.target.cls))).toEqual([
      ["3° B", "promoted", ["Álvarez"]],
    ]);
    const history = await getStudentHistory(db, s.teacher, s.thirdA.ids.Pérez);
    expect(history!.courses.map((c) => `${c.schoolYear} ${c.year}°`)).toEqual(["2026 4°", "2025 3°"]);
  });

  it("adds only students on offer, whatever is sent (NEXT-3, OWNER-1)", async () => {
    const s = await setup();
    const stranger = await course(newTeacher(), { year: 3, schoolYear: 2025 }, { Ajena: "promoted" });
    const sent = [s.thirdA.ids.Díaz, s.fourthA.ids.Sosa, stranger.ids.Ajena, "not-an-id", s.thirdB.ids.Álvarez];
    expect(await bringStudents(db, s.teacher, s.target.cls, sent)).toEqual({ ok: true, added: 1 });
    expect((await listClassStudents(db, s.teacher, s.target.cls)).map((r) => r.lastName)).toEqual(["Álvarez"]);

    expect(await bringStudents(db, newTeacher(), s.target.cls, [s.thirdA.ids.Pérez])).toEqual({ ok: true, added: 0 });
  });
});
