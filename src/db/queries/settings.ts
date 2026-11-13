// The teacher's own settings (teacher_settings). A teacher without a row has
// the defaults. Scoped to one teacher (OWNER-1).

import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { teacherSettings } from "@/db/schema";
import { DEFAULT_RULES, type GradingRules } from "@/lib/grading";

const DEFAULT_MIN_ATTENDANCE = 75;

/** SUGGEST-3 */
export async function getMinAttendance(db: Db, teacherId: string): Promise<number> {
  const [row] = await db
    .select({ minAttendance: teacherSettings.minAttendance })
    .from(teacherSettings)
    .where(eq(teacherSettings.teacherId, teacherId));
  return row?.minAttendance ?? DEFAULT_MIN_ATTENDANCE;
}

/** SUGGEST-3: 0 to 100, already checked by `minAttendanceInput`. */
export async function setMinAttendance(db: Db, teacherId: string, minAttendance: number): Promise<void> {
  await db
    .insert(teacherSettings)
    .values({ teacherId, minAttendance })
    .onConflictDoUpdate({ target: teacherSettings.teacherId, set: { minAttendance, updatedAt: new Date() } });
}

/** GRADE-4: the teacher's grading rules; the defaults until they change them. */
export async function getRules(db: Db, teacherId: string): Promise<GradingRules> {
  const [row] = await db
    .select({
      gradeMin: teacherSettings.gradeMin,
      gradeMax: teacherSettings.gradeMax,
      passMark: teacherSettings.passMark,
      maxTermIncrease: teacherSettings.maxTermIncrease,
      maxTermDecrease: teacherSettings.maxTermDecrease,
    })
    .from(teacherSettings)
    .where(eq(teacherSettings.teacherId, teacherId));
  return row ?? DEFAULT_RULES;
}

/** GRADE-4: already checked by `rulesInput`. */
export async function setRules(db: Db, teacherId: string, rules: GradingRules): Promise<void> {
  await db
    .insert(teacherSettings)
    .values({ teacherId, ...rules })
    .onConflictDoUpdate({ target: teacherSettings.teacherId, set: { ...rules, updatedAt: new Date() } });
}
