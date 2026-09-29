// Applies supabase/storage.sql to the database in DATABASE_URL, the same way
// `npm run db:migrate` does: from .env.local, unless DATABASE_URL is already
// set in the shell (that's how prod is targeted, from .env.prod).
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — see README.md");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, onnotice: () => {} });
try {
  await sql.begin((tx) => tx.unsafe(readFileSync("supabase/storage.sql", "utf8")));
  const [bucket] = await sql`select id, public, file_size_limit from storage.buckets where id = 'task-files'`;
  const policies = await sql`
    select count(*)::int as n from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'task-files:%'`;
  const ref = new URL(url).username.split(".")[1] ?? new URL(url).hostname.split(".")[1];
  console.log(
    `Storage applied to ${ref}: bucket ${bucket.id} (private: ${!bucket.public}, max ${bucket.file_size_limit / 1048576} MB), ${policies[0].n} access rules.`,
  );
} finally {
  await sql.end();
}
