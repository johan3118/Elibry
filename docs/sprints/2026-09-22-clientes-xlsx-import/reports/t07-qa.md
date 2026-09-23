# T7 — QA report

**Date:** 2026-09-22
**Task:** t07 (junior) — Correct the stale "dead credentials / 521" claim in `docs/migracion/README-cleanup.md`
**Reviewer:** QA (adversarial)

---

## Verdict: FAIL

One acceptance criterion (AC6 / the plan's rollback-note requirement) is
violated on a narrow, mechanical, easily-fixed point: the dev's own report
(`reports/t07-dev.md`) literally contains banned destructive-git-verb
substrings in its Rollback section and Redaction Checklist, even though only
in negated/prohibitive form. The shipped artifact itself
(`docs/migracion/README-cleanup.md`) is clean, fully correct, and
well-evidenced — see AC1–AC5 below, all PASS. Everything else in this task
checks out. See "Bugs found" for the exact fix.

---

## Commands run

```
$ git diff docs/migracion/README-cleanup.md | grep -c '^@@'
2
```

```
$ git diff docs/migracion/README-cleanup.md
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

Confirmed byte-for-byte identical to the dev's pasted diff. Exactly 2 hunks.

```
$ diff <(git show HEAD:docs/migracion/README-cleanup.md) docs/migracion/README-cleanup.md
```
Output: only the same two hunks shown above (12,17c12,21 and 36,39c40,44).
No third divergence anywhere in the 306→311-line file. This independently
confirms AC1/AC3 by diffing the FULL file against HEAD myself, not by
trusting the dev's pasted `git diff`.

```
$ git status --short
 M CLAUDE.md
 M docs/migracion/README-cleanup.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql
?? docs/migracion/README-clientes-import.md
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import-amendment-a.md
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```

```
$ git diff docs/migracion/README-cleanup.md | grep -niE "eyJ|postgresql://[^<]|supabase\.co|service_role|anon_key"
(0 hits, exit 1)
$ grep -niE "eyJ|postgresql://[^<]|supabase\.co|service_role|anon_key" docs/migracion/README-cleanup.md
(0 hits, exit 1)
$ git diff docs/migracion/README-cleanup.md | grep -niE "checkout|reset --hard|clean -fd|stash drop|force-push|push -f"
(0 hits, exit 1)
```

```
$ grep -niE "checkout|reset --hard|clean -fd|stash drop|force-push" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-dev.md
47:- To undo: restore the two spans by hand from the text shown in the "git diff" section below, using a text editor or `cat > file <<EOF...EOF`. No `git checkout`, `git reset --hard`, or `git clean -fd`.
165:- [x] No destructive git verbs appear (no `checkout`, `reset --hard`, `clean -fd`, `stash drop`, force-push).
```
2 hits — see "Bugs found" below.

```
$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit
(clean, no output, exit 0)

> my-v0-project@0.1.0 lint
> eslint .
(28 pre-existing react-hooks/exhaustive-deps and @next/next/no-img-element
warnings, 0 errors — same warning set the dev reported, all pre-existing and
unrelated to this doc-only change)

> my-v0-project@0.1.0 test
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  17:46:11
   Duration  3.69s
EXIT: 0
```
Independently re-run (not trusting the dev's pasted output) — matches the
dev's claimed 30/30 files, 825/825 tests, exit 0.

Independent evidence check on the four cited reports (grepped directly, not
taken on the dev's word):
```
$ grep -niE "521|introspection|live|error" reports/t01-dev.md | head
1:# T1 — Live preflight dev report
...
9: ...No 521s were encountered; every...

$ grep -niE "\.env\.local|POSTGRES_URL_NON_POOLING" reports/t01-dev.md reports/t02-dev-r4.md reports/t03-dev-r3.md reports/t05-dev.md
t01-dev.md:5: ...project's own `.env.local` connection string (never printed...
t02-dev-r4.md:766: ...read at runtime from `.env.local` and never printed or logged...
t03-dev-r3.md:449: ...read at runtime from `.env.local` and never printed or logged...
t05-dev.md: `psql "$POSTGRES_URL_NON_POOLING" ...` (multiple live invocations)

$ grep -niE "42/42|PASS" reports/t03-dev-r3.md | head -20
(42 individual `_checks` rows all reading PASS, veredicto_final PROCEED — both runs)
```
All four reports genuinely show live, successful, zero-521 Supabase access
this sprint, and all four explicitly confirm the connection string used was
`POSTGRES_URL_NON_POOLING` sourced from `.env.local` at runtime — so the
corrected text's specific claim ("credentials (`.env.local`) are verified
live and functional") is directly supported, not an overclaim.

---

## Acceptance criteria (plan `docs/plans/clientes-xlsx-import.md` L529–540)

1. **Only two spans change, hunk count = 2** — PASS. Verified independently
   both via `git diff | grep -c '^@@'` (=2) and via `diff` against
   `git show HEAD:...` for the full file (no third divergence).
2. **Replacement wording claims only what T1/T3 (+T2/T5) evidence supports,
   names channel/date, doesn't assert `.env.local` works unless actually
   used, cites report paths** — PASS. Independently confirmed via grep of
   the four underlying reports (not the dev's citation alone) that: (a) no
   521 errors occurred, (b) the credential channel was specifically
   `POSTGRES_URL_NON_POOLING` sourced from `.env.local`, (c) the text still
   correctly declines to claim the cleanup scripts `01`/`02` themselves have
   been run — the UNVERIFIED framing for those two scripts survives
   verbatim in substance in the new text ("those scripts remain
   **UNVERIFIED** unless and until you have personally run them").
3. **Other guidance untouched** (two-file design note, ROLLBACK-honoring
   probe, `auditoria` lower-bound caveat, RLS caveat, KEEP set, Rollback
   section) — PASS. Confirmed present, unchanged, via grep against the
   current file (design note L23–24, ROLLBACK probe L24–91, auditoria
   caveat L138–142, RLS caveat L167–170, KEEP set heading L246, Storage
   caveat L280–289, Rollback section L296–311) and via full-file diff
   against HEAD showing zero divergence outside the two declared hunks.
4. **No credential/host/key appears** — PASS. Zero grep hits in the diff and
   the full file for key/connection-string/hostname patterns. File
   continues to use `<user>:<password>@<host>:<port>`-style placeholders
   elsewhere (unchanged, outside the two edited spans).
5. **`npm run qa` green; rollback note prose, no git verb** —
   **PARTIAL / FAIL on the git-verb sub-clause.** `npm run qa` is
   independently confirmed green (exit 0, 825/825 tests). The rollback note
   is prose-only (no executable command), but it **literally contains** the
   substrings `git checkout`, `git reset --hard`, `git clean -fd` (line 47),
   repeated in the Redaction Checklist (line 165) — see "Bugs found."

---

## Out-of-scope changes

None beyond what the task declared. `git status --short` shows 12 entries
total; only 2 are attributable to this task:
- `docs/migracion/README-cleanup.md` (tracked, modified — in scope)
- `reports/t07-dev.md` (new, inside `docs/sprints/2026-09-22-clientes-xlsx-import/` — in scope per the plan's declared "Files in scope")

The other 10 entries (`CLAUDE.md`, `.DS_Store`,
`.claude/rules/context-budget.md`, `docs/migracion-clientes.xlsx`,
`docs/migracion/03-clientes-import-dry-run.sql`,
`docs/migracion/04-clientes-import-execute.sql`,
`docs/migracion/README-clientes-import.md`,
`docs/migracion/generate-clientes-import.py`,
`docs/plans/clientes-xlsx-import-amendment-a.md`,
`docs/plans/clientes-xlsx-import.md`) all predate this task — they were
already present in the session's initial git-status snapshot before any t07
work began (earlier sprint tasks) — and none show any t07-attributable
change. **Scope: 2 of 12.**

---

## Bugs found

**Banned-verb text in the dev report's rollback note / redaction checklist
(reports/t07-dev.md, lines 47 and 165).** The rollback section reads:

> No `git checkout`, `git reset --hard`, or `git clean -fd`.

and the redaction checklist reads:

> - [x] No destructive git verbs appear (no `checkout`, `reset --hard`,
>   `clean -fd`, `stash drop`, force-push).

Both lines literally contain the banned-verb substrings, even though only
to negate/prohibit them, and even though the actual prescribed rollback
mechanism (hand-edit / `cat > file <<EOF...EOF`) is itself safe and correct.
This is a real AC5 violation: the plan requires the rollback note to have
"no git verb," full stop, and the dev's own checklist item claiming
"No destructive git verbs appear" is literally false under a plain textual
grep of its own report.

This matters beyond pedantry because this exact codebase has a standing,
repeatedly-reinforced doctrine on this precise failure class —
`~/Developer/CBrain/mistakes/destructive-op-named-in-rollback-note.md`
(16 documented recurrences across sprints) — whose prevention rule is
explicit that the banned-verb check is **mechanical and textual, not
semantic**: "a note naming a banned verb is a defect the moment it is
written, regardless of whether [it] would also have blocked it had someone
tried to run it." The same sprint's own T8 acceptance criteria (plan
L552) require "Banned-verb grep over every rollback note written this
sprint... → 0 hits" with no carve-out for negated mentions. This dev
report's rollback note does not clear that bar today; it would fail T8's
own sprint-wide audit as currently worded.

To be clear about severity: this does **not** touch the shipped file
(`docs/migracion/README-cleanup.md` is clean — 0 hits, verified above), and
the intent/content of the rollback instruction is correct and non-destructive.
This is a textual-hygiene defect in the dev's own report artifact, not a
risk that anything destructive would actually run.

---

## Suggested fixes

Reword `reports/t07-dev.md` lines 47 and 165 to describe the prohibition
without spelling the literal banned-verb substrings, e.g.:

- Line 47: "To undo: restore the two spans by hand from the text shown in
  the 'git diff' section below, using a text editor or
  `cat > file <<EOF...EOF`. Do not use any command that overwrites the
  working tree from a ref or discards uncommitted changes."
- Line 165: "- [x] No command that overwrites the working tree from a ref or
  discards uncommitted/untracked changes appears anywhere in this report."

No change to `docs/migracion/README-cleanup.md` is needed — it is already
clean. No re-run of `npm run qa` is needed for this fix (report-text-only);
re-run the banned-verb grep against the corrected report and confirm 0 hits.

---

## Attack Log (show your work)

- **RLS:** N/A — no table, schema, or data-access code touched; this is a
  markdown-only runbook edit with no DB/isolation surface.
- **Optimistic UI:** N/A — no UI/client code touched.
- **Realtime:** N/A — no realtime subscriber code touched.
- **Edge cases tried:**
  1. Did not trust the dev's citation of "T1/T3/T5/T2-r4 proved this live" —
     independently grepped the four underlying reports myself for 521
     errors, live-connection evidence, and the exact credential source
     (`.env.local` → `POSTGRES_URL_NON_POOLING`), confirming the new claim
     is actually true and not an overclaim (guards against
     `assertion-without-verification`).
  2. Diffed the **full file** against `git show HEAD:...` myself instead of
     trusting the dev's pasted `git diff` snippet, to catch any additional
     unproven edit outside the 2 declared hunks — found none.
  3. Grepped for credential/key/hostname patterns across the diff AND the
     full current file (not just the two new spans) — 0 hits, confirmed by
     exit code.
  4. Grepped for banned destructive-git-verb substrings across the diff,
     the full file, AND the dev's own report text (per this sprint's
     standing mistake-note doctrine, which treats this as a mandatory,
     mechanical, always-run check) — this is the one probe that surfaced a
     real defect: the dev report's own rollback note and checklist contain
     the banned substrings in negated form, contradicting its own
     self-asserted checklist item.
  5. Independently re-ran `npm run qa` end-to-end rather than trusting the
     dev's pasted output — confirmed exit 0, identical test/file counts.
- **What I tried that could have broken this:** I grepped the dev's own
  report text (not just the shipped file) against this sprint's standing
  banned-verb doctrine, which the dev's self-reported checklist claimed was
  clean — and it was not; that is a real, if narrow, defect this review
  caught rather than rubber-stamped.

---

## Rollback note for this QA report

This is a review-only artifact (`reports/t07-qa.md`, newly created — no
source file touched). To undo: `rm docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-qa.md`.
