# Branches and what guards them

Same model as the MTG Life Counter. `main` is production — Vercel builds from
it. Nothing reaches it that has not been through `development` and a green test
run.

```
feature branch ──PR──▶ development ──PR──▶ main ──▶ production
   (cut from            (everything          (release)
    development)         accumulates)
```

| | `development` | `main` |
| --- | --- | --- |
| Direct pushes | blocked — pull request required | blocked — pull request required |
| CI (`ci`) must pass | yes | yes |
| Vercel build must succeed | yes | yes |
| Approving reviews | 0 | 0 (see below) |
| Branch must be up to date first | no | yes |
| Force push / delete | blocked | blocked |
| Admin can bypass | yes | yes |

**One difference from the MTG repo:** `main` asks for 0 approvals, not 1. This
repo has one contributor and GitHub does not let you approve your own pull
request, so requiring one would mean bypassing the rule on every release.
When a second teacher or developer joins, set it back to 1 in
`.github/rulesets/main.json` and re-apply.

## Why each rule is there

- **Pull request required.** Every change is visible before it lands and CI has
  something to run against.
- **`ci` must pass** — lint, the full test suite, and the production build. See
  [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
- **`Vercel` must succeed, on both branches.** The host's own build, so nothing
  merges on a green test run while the thing that ships fails to deploy. The
  required context is **`Vercel`**, not `Vercel Preview Comments`.
- **Up to date before merging, on `main` only.** The thing that was tested is
  the thing that ships.
- **No force pushes, no deletion.** Both branches are shared history.
- **Admins can bypass.** An escape hatch for a stuck CI runner, not a habit.

## Setting it up (once, needs internet)

1. Create the repository and push both branches:

   ```bash
   gh repo create FedeAtadia/teaching-workspace --public --source . --push
   ```

   ```bash
   git push -u origin development
   ```

2. Import the project in Vercel (Add New → Project → the repo), with
   `main` as the production branch, and add the three variables from
   `.env.example` under Settings → Environment Variables.
3. Apply the rulesets once `ci.yml` is on both branches:

   ```bash
   gh api --method POST repos/FedeAtadia/teaching-workspace/rulesets --input .github/rulesets/development.json
   ```

   ```bash
   gh api --method POST repos/FedeAtadia/teaching-workspace/rulesets --input .github/rulesets/main.json
   ```

   The repository is public because rulesets on a private one need GitHub
   Pro; on the free plan the API refuses them outright. Public means the
   code, never the data: grades live in Supabase and keys in `.env.local`
   and Vercel, none of which are committed.

## Checking it took

```bash
gh api repos/FedeAtadia/teaching-workspace/rules/branches/main --jq '.[].type'
```

## Day to day

```bash
git checkout development && git pull
```

```bash
git checkout -b feat/whatever
```

```bash
gh pr create --base development
```

Cut every branch from `development`, never from `main`.

Releasing is a pull request like any other:

```bash
gh pr create --base main --head development --title "Release"
```

Changing behaviour is specified in [SPEC.md](SPEC.md); how to work on it is in
[WORKFLOW.md](WORKFLOW.md).
