# T7 — Correct the stale "dead credentials / 521" claim in `README-cleanup.md`

**Date:** 2026-09-22  
**Task:** t07 (junior)  
**Status:** DONE  

---

## Files Changed

- `/Users/johancito/Developer/Elibry/docs/migracion/README-cleanup.md`

(1 of 1 tracked file edited)

---

## Scope Statement

"I did not touch auth / RLS / migrations / payments. This is a documentation-only fix with no database access, no destructive operations, and no code changes outside the targeted two spans."

---

## Acceptance Criteria — All Met

**AC1: Exactly 2 hunks, confined to the two stale spans.** ✓
- Verification status block (lines 11–17) → corrected from "target host has no DNS answer and its REST endpoint returns 521" to "project IS reachable and credentials verified live".
- Step 1 dead-credentials sentence (lines 36–39) → corrected from "credentials are **dead** — the Supabase project they point to no longer exists" to "credentials are verified live and functional."
- Every other line in the file is byte-identical (proven by git diff, exactly 2 hunks).

**AC2: Replacement wording claims only what evidence supports.** ✓
- States the project IS reachable (verified by T1's live introspection, T3's live 1,384-line dry run, T5's live guard blocks, T2-r4's live smoke gate).
- Names the channels and reports as evidence sources: `reports/t01-dev.md`, `reports/t02-dev-r4.md`, `reports/t03-dev-r3.md`, `reports/t05-dev.md`.
- Does **not** claim the cleanup scripts `01`/`02` themselves have been run — correctly distinguishes: the *connection* is verified, but the scripts remain **UNVERIFIED**.
- No overclaim in either direction; both improvements are bounded by cited evidence.

**AC3: Other guidance remains untouched.** ✓
- Design note (two-file vs. ROLLBACK-via-transaction design), transaction-honoring probe, auditoria lower-bound caveat, RLS caveat, KEEP set, Rollback section — all byte-identical.

**AC4: No credentials, hosts, or keys appear.** ✓
- File uses placeholder `<user>:<password>@<host>:<port>` style in backup steps; new text refers to "credentials in `.env.local`" and "the 2026-09-22 clientes-import sprint," with zero secret values.
- Grep: `git diff` output contains zero `projects/` or `*.supabase.co` or anon/service-role key patterns.

**AC5: `npm run qa` green.** ✓
- See commands below.

**AC6: Rollback note (prose, no git verb).** ✓
- To undo: restore the two spans by hand from the text shown in the 'git diff' section below, using a text editor or `cat > file <<EOF...EOF`. Do not use any command that overwrites the working tree from a ref or discards uncommitted changes.

---

## git diff

```diff
diff --git a/docs/migracion/README-cleanup.md b/docs/migracion/README-cleanup.md
index 80381e7..9bfdf32 100644
--- a/docs/migracion/README-cleanup.md
+++ b/docs/migracion/README-cleanup.md
@@ -9,12 +9,16 @@ before running either script. Spec: `docs/plans/db-cleanup-keep-one-reserva.md`
  - `02-cleanup-execute.sql` — destructive, real `COMMIT`, no dry-run mode.
  
  **Verification status — read this before trusting any behavior claim below:**
-nothing described in this runbook has been executed against a live database
-this sprint — the target host has no DNS answer and its REST endpoint
-returns 521. Every statement in this file about what `01` or `02` will do is
-derived by reading their current SQL text, not by observing a live run.
-Treat every such description as **UNVERIFIED** unless and until you have
-personally run the scripts and confirmed the outcome yourself.
+The target Supabase project IS reachable and its credentials (`.env.local`)
+are verified live and functional. Verified repeatedly during the 2026-09-22
+clientes-import sprint: T1 ran full introspection live via Supabase CLI
+(`reports/t01-dev.md`); T3 executed the entire 1,384-line dry run live twice,
+42/42 checks PASS (`reports/t03-dev-r3.md`); T5 fired three guard blocks live
+over psql (`reports/t05-dev.md`); T2 round 4 ran a full smoke gate live
+(`reports/t02-dev-r4.md`). However, nothing described in this runbook about
+what the cleanup scripts `01` or `02` *themselves* will do has been executed
+against a live database — those scripts remain **UNVERIFIED** unless and until
+you have personally run them and confirmed the outcome yourself.
  
  **Design note — why two files instead of one dry-run-via-ROLLBACK script:**
  The original plan wrapped everything in one file that ended in `ROLLBACK;` by
@@ -33,10 +37,11 @@ instead of trying to detect it at runtime.
  
  ## Step 1 — Backup (do this before anything else)
  
-The credentials in this repo's `.env.local` are **dead** — the Supabase
-project they point to no longer exists. You must obtain **live** credentials
-for the actual target database before you can do anything below, including
-the backup.
+The credentials in this repo's `.env.local` are verified live and functional.
+You can use them directly to connect to the Supabase project for the backup
+and subsequent steps below. This was confirmed during the 2026-09-22
+clientes-import sprint through live database access (`reports/t01-dev.md`,
+`reports/t02-dev-r4.md`, `reports/t03-dev-r3.md`, `reports/t05-dev.md`).
  
  Once you have live credentials, take one of these backups:
```

---

## Commands Run

```bash
$ git diff docs/migracion/README-cleanup.md
(shown above — exactly 2 hunks, 1 file changed)

$ npm run qa
```

Output:

```
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit

> my-v0-project@0.1.0 lint
> eslint .

(28 pre-existing warnings, 0 errors related to this change)

> my-v0-project@0.1.0 test
> vitest run

 ✓ Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  17:42:03
   Duration  3.82s

exit 0
```

---

## Evidence Trail

The claims in the corrected text are sourced to the following sprint-internal reports:

1. **T1 introspection** (`reports/t01-dev.md`): Ran full `information_schema` / `pg_constraint` / `pg_trigger` / `pg_indexes` introspection live via Supabase CLI against `POSTGRES_URL_NON_POOLING`, with zero 521 errors on any query.

2. **T3 dry-run** (`reports/t03-dev-r3.md`): Executed the entire 1,384-line dry run live, twice, with 42/42 checks PASSING both times. Zero 521 errors, zero connectivity issues.

3. **T5 guard blocks** (`reports/t05-dev.md`): Fired three real guard blocks live over a `psql` channel (installed via `brew install libpq`), each both directions (unmodified negative control did NOT raise; expected-literal-inverted positive test DID raise). Read-only held; zero 521 errors.

4. **T2 round 4 smoke gate** (`reports/t02-dev-r4.md`): Ran the entire regenerated `03-clientes-import-dry-run.sql` file live via a scratch Node+`pg` runner until clean, with 42/42 checks passing. No 521 errors.

All four reports independently accessed the Supabase project using the `.env.local` credentials with zero errors attributed to dead credentials or 521 errors.

---

## Limitations

- The correction does **not** claim that the cleanup scripts `01` / `02` themselves have been executed or verified. Those scripts remain **UNVERIFIED** — consistent with the file's own design (two-file design, not dry-run-via-ROLLBACK, precisely because live execution risks are real).
- The 521 errors were transient per the user's standing note in MEMORY (Elibry Supabase 521s are transient, not permanent). This correction records the current verified state during this sprint, not a permanent fix to Supabase's infrastructure.
- No testing of the cleanup scripts' actual behavior was performed; only the connectivity and credential validity were verified.

---

## Redaction Checklist

- [x] No `.env.local` values or connection strings appear.
- [x] No Supabase project refs, URLs, anon keys, or service-role keys appear.
- [x] No client PII (names, emails, phone numbers, cedulas) appears.
- [x] No command that overwrites the working tree from a ref or discards uncommitted/untracked changes appears anywhere in this report.

---

## Rollback

To restore the file to its pre-task state, hand-edit the two spans back using the original text quoted in the git diff above:

**Span 1 (Verification status, lines 11–17):** Replace the new text with:
```
nothing described in this runbook has been executed against a live database
this sprint — the target host has no DNS answer and its REST endpoint
returns 521. Every statement in this file about what `01` or `02` will do is
derived by reading their current SQL text, not by observing a live run.
Treat every such description as **UNVERIFIED** unless and until you have
personally run the scripts and confirmed the outcome yourself.
```

**Span 2 (Step 1 credentials, lines 36–39):** Replace the new text with:
```
The credentials in this repo's `.env.local` are **dead** — the Supabase
project they point to no longer exists. You must obtain **live** credentials
for the actual target database before you can do anything below, including
the backup.
```

---

## Verdict

**DONE** — Exactly 2 hunks, all evidence cited, all guidance intact, npm run qa green, redaction clean, no destructive operations.
