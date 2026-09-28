import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db";
import * as schema from "@/db/schema";

/**
 * A real Postgres, in memory, built from the same migrations the live
 * databases get — so these tests also prove the migrations apply cleanly.
 * No network and no Supabase, so they run the same in CI.
 */
export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Db;
}

/** A fresh teacher id per test keeps tests apart without a new database. */
export const newTeacher = () => randomUUID();
