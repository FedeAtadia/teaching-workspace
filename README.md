# Teaching workspace

Everything about the classes I teach in one place: classes, students, tasks,
scores with notes, term grades, and exports. Replaces a Google Drive full of
spreadsheets.

Next.js 16 (App Router) · Tailwind CSS 4 · PostgreSQL on Supabase · Drizzle ORM ·
next-intl (Español (Argentina) / English) · Vitest · hosted on Vercel.

## Documentation

- **[docs/SPEC.md](docs/SPEC.md)** — what the app is required to do, as
  numbered, testable requirements. The source of truth for behaviour.
- **[docs/WORKFLOW.md](docs/WORKFLOW.md)** — how to add or change behaviour.
  Spec first, then the failing test, then the code.
- **[docs/BRANCHING.md](docs/BRANCHING.md)** — branches, the rules guarding
  `main`, and the one-time GitHub/Vercel setup.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — what is planned, in order.

## Running it

Node 24, the version in `.nvmrc` (`nvm use 24`). CI and Vercel use the same
one: a lockfile written by another Node's npm can fail `npm ci` in CI.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000. Without a `.env.local` the app runs with
sign-in switched off and a banner saying so — enough to work on screens
offline.

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

## Connecting Supabase (once, needs internet)

No Docker: development runs against a cloud Supabase project. Use two — `dev`
for working, `prod` for Vercel — so experiments never touch real grades.

1. Create a project at supabase.com.
2. Copy `.env.example` to `.env.local` and fill in the three values.
3. Create the tables (the migrations are in `drizzle/`):

   ```bash
   npm run db:migrate
   ```

   Then the private file bucket for task attachments and its access rules
   (`supabase/storage.sql`):

   ```bash
   npm run storage:apply
   ```

4. Turn on Google sign-in: in Google Cloud Console create an OAuth client
   (Web application) with the redirect URI Supabase shows under
   Authentication → Providers → Google, then paste its id and secret there.
   Add `http://localhost:3000/auth/callback` and the Vercel URL under
   Authentication → URL Configuration → Redirect URLs.

The free plan pauses a project after a week without activity (school holidays).
Restoring it is one click in the dashboard; nothing is lost.

## Layout

```
src/
  app/
    (app)/          signed-in pages: dashboard, classes, students, settings
    login/          Google sign-in
    auth/callback/  finishes the Google sign-in
  components/       presentation only
  db/               schema.ts (the data model) and the connection
  i18n/             language config; texts live in messages/
  lib/
    grading.ts      grading rules, pure and tested
    supabase/       auth clients
  proxy.ts          refreshes the session, sends signed-out users to /login
messages/           es-AR.json, en.json
drizzle/            generated SQL migrations
docs/
```
