# Working on this project

The rule: **behaviour is specified before it is built, and every requirement is
held up by a test.** [SPEC.md](SPEC.md) is the source of truth; the test suite
is the proof.

## The loop

1. **Write the requirement.** Add it to the right section of
   [SPEC.md](SPEC.md) with the next free id. One testable sentence. If you
   cannot state it in one sentence, it is more than one requirement.
2. **Write the test.** It should fail for the right reason — run it and read the
   failure before writing any code. A test that passes before the feature
   exists is testing nothing.
3. **Write the code.** The smallest change that makes the test pass.
4. **Check the whole suite**, not just your file. `npm test`.
5. **Check the build.** `npm run lint && npm run build`.

Where that work lives — which branch to cut, what has to pass before it can
merge, and how a release reaches production — is [BRANCHING.md](BRANCHING.md).

Changing existing behaviour is the same loop, starting from editing the
requirement. Spec, test and code move in one commit.

## Where things go

| Kind of thing | Where | Why |
| --- | --- | --- |
| Grading rules (pass/fail, ranges, averages) | `src/lib/grading.ts` | Pure functions, testable without a database or DOM |
| Tables and columns | `src/db/schema.ts` | One file is the whole data model |
| Queries (read and write) | `src/db/queries/` | Take the database as an argument and a `teacherId`; tested against an in-memory Postgres (`src/test/db.ts`) built from the real migrations |
| Calling them | Server Actions (`actions.ts` next to the page) and Server Components | Validate with `src/lib/validation.ts`, get the teacher from `requireTeacherId()`, pass `getDb()`; nothing talks to Postgres from the browser |
| Sign-in and session | `src/lib/supabase/`, `src/proxy.ts` | |
| Texts shown to the teacher | `messages/es-AR.json`, `messages/en.json` | Never hard-code a string in a component (LOCALE-3) |
| Presentation | `src/components/`, `src/app/` | No rules here. If a component decides something, it belongs in `src/lib/` |

Two consequences worth stating plainly:

- **A component must never own a rule.** If you find yourself writing
  `grade >= 7` in a page, it belongs in `src/lib/grading.ts` (GRADE-2 uses the
  teacher's pass mark, not 7).
- **Every query filters by `teacher_id`.** Row-level security blocks the public
  API, but the server connects as the database owner, so the filter in the
  query is what keeps one teacher's data from another's.

## Changing the database

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` writes a migration into `drizzle/`. Read it.
3. `npm run db:migrate` applies it to the database in `.env.local`.
4. Commit the schema change and the migration together.

Never edit a migration that has already been applied somewhere; write a new one.

## Writing tests here

Tests sit next to what they test (`src/lib/grading.ts` →
`src/lib/grading.test.ts`).

**Name the behaviour, not the function**, and put the requirement id in the
name: `it("lets a 4 in the first term reach a 7 but not an 8 (TERM-2)")`.

**Say why when the why is not obvious.** A short comment explaining what would
break if the rule were dropped stops a future reader "simplifying" it away.

## Commands

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

```bash
npx vitest
```

## Before opening a pull request

- Every new or changed behaviour has a requirement id in [SPEC.md](SPEC.md).
- Every requirement you added or changed has a test that fails without your
  code.
- `npm test`, `npm run lint` and `npm run build` all pass.
- No rule leaked into a component, and no text is missing from either language.
- A schema change comes with its migration.
