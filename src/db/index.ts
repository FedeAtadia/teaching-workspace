import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Created on first use rather than at import, so `next build` works without a
// database (CI has none). Cached on globalThis so dev hot-reloads don't open a
// new pool every time.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof create> };

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — see README.md");
  // prepare: false is required by Supabase's transaction pooler.
  return drizzle(postgres(url, { prepare: false }), { schema });
}

export function getDb() {
  globalForDb.db ??= create();
  return globalForDb.db;
}
