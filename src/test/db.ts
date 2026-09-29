import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db";
import * as schema from "@/db/schema";

const MIGRATIONS = "drizzle";

/**
 * A real Postgres, in memory, built from the same migrations the live
 * databases get — so these tests also prove the migrations apply cleanly.
 * No network and no Supabase, so they run the same in CI.
 *
 * `upTo` stops after that migration (its tag, e.g. "0004_task-attachments"),
 * to test a data migration: add rows as they were, then `migrateRest`.
 */
export async function createTestDb(options: { upTo?: string } = {}): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: options.upTo ? migrationsUpTo(options.upTo) : MIGRATIONS });
  return db as unknown as Db;
}

/** Applies every migration not applied yet. */
export async function migrateRest(db: Db): Promise<void> {
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS });
}

/** A copy of the migrations folder that ends at `tag`. */
function migrationsUpTo(tag: string): string {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  const end = journal.entries.findIndex((e) => e.tag === tag);
  if (end < 0) throw new Error(`No migration tagged ${tag}`);
  const dir = mkdtempSync(join(tmpdir(), "migrations-"));
  mkdirSync(join(dir, "meta"));
  const entries = journal.entries.slice(0, end + 1);
  writeFileSync(join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  for (const e of entries) copyFileSync(join(MIGRATIONS, `${e.tag}.sql`), join(dir, `${e.tag}.sql`));
  return dir;
}

/** A fresh teacher id per test keeps tests apart without a new database. */
export const newTeacher = () => randomUUID();
