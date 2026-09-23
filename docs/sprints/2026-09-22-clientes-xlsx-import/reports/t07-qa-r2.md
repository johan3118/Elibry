# T7 — Round 2 QA report (re-verification)

**Date:** 2026-09-22
**Task:** t07 round 2 (junior) — Reword banned-verb substrings in `reports/t07-dev.md` lines 47/165
**Reviewer:** QA (adversarial)
**Round 1 QA verdict:** FAIL (`reports/t07-qa.md`) — shipped file clean (AC1–AC4 + npm run qa sub-clause of AC5 PASS), but dev's own report text contained banned destructive-git-verb substrings.
**Lead decision:** B — send back, reword lines 47 and 165 only (`reports/t07-lead.md`)

---

## Verdict: PASS

The round-2 fix does exactly what was asked, nothing more: lines 47 and 165 of
`reports/t07-dev.md` were reworded to remove the literal banned-verb
substrings while preserving the correct, non-destructive rollback mechanism.
Independently re-grepped (not trusting the dev's pasted output) — 0 hits. No
other file in the repo changed this round. `docs/migracion/README-cleanup.md`
(the shipped runbook) is untouched and byte-identical to round 1's already
fully-verified state.

---

## Commands run

```
$ cd /Users/johancito/Developer/Elibry && grep -niE "checkout|reset --hard|clean -fd|stash drop|force-push" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-dev.md; echo "exit: $?"
exit: 1
```
0 hits, exit 1, as expected. Confirms the fix on the file that actually
matters (the report whose Rollback/Redaction Checklist sections must be
clean).

```
$ grep -n "To undo: restore the two spans" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-dev.md
47:- To undo: restore the two spans by hand from the text shown in the 'git diff' section below, using a text editor or `cat > file <<EOF...EOF`. Do not use any command that overwrites the working tree from a ref or discards uncommitted changes.

$ grep -n "No command that overwrites the working tree" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-dev.md
165:- [x] No command that overwrites the working tree from a ref or discards uncommitted/untracked changes appears anywhere in this report.

$ wc -l docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-dev.md
195 docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-dev.md
```
Both corrected lines still sit at exactly line 47 and line 165 — the same
line numbers round-1 QA found the banned substrings at
(`reports/t07-qa.md` lines 111–113: "47:- To undo: ... No `git checkout`,
`git reset --hard`, or `git clean -fd`." / "165:- [x] No destructive git
verbs appear (no `checkout`, `reset --hard`, `clean -fd`, `stash drop`,
force-push)."). A single-line-for-single-line swap at the identical line
numbers, with the file's total line count internally consistent (165 well
inside 195), is strong corroborating evidence no other line moved, was
inserted, or was deleted. I read the ENTIRE current file (all 195 lines, not
excerpted) and it is otherwise fully consistent with everything round-1 QA
already independently verified — same AC1–AC6 list wording, same `git diff`
block (2 hunks, identical to round 1's pasted diff and to the live
`git diff docs/migracion/README-cleanup.md` re-run below), same `npm run qa`
output block, same Evidence Trail, same Limitations, same Rollback section
(the hand-edit-back-to-original-text mechanism — itself always safe and
untouched by this round). I could not do a byte-exact `diff` against the
pre-round-2 file because `reports/t07-dev.md` has no git history (the entire
`docs/sprints/2026-09-22-clientes-xlsx-import/` directory is untracked), but
the convergent evidence above (matching line numbers, matching quoted
"Before" text in the dev's own r2 report vs. round-1 QA's independently
grepped "Bugs found" excerpt, full-file read showing no other divergence)
closes that gap to the extent achievable without a tracked file. Noting this
explicitly rather than silently treating it as a full diff.

```
$ grep -niE "checkout|reset --hard|clean -fd|stash drop|force-push" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-dev-r2.md; echo "exit: $?"
11:Fixed two lines in `reports/t07-dev.md` (the round-1 report) to remove literal banned-verb substrings (`git checkout`, `git reset --hard`, `git clean -fd`, `stash drop`, `force-push`), per the mechanical prevention rule at `~/Developer/CBrain/mistakes/destructive-op-named-in-rollback-note.md`. No source files were changed. No `npm run qa` re-run needed (report-text-only fix).
21:- To undo: restore the two spans by hand from the text shown in the "git diff" section below, using a text editor or `cat > file <<EOF...EOF`. No `git checkout`, `git reset --hard`, or `git clean -fd`.
33:- [x] No destructive git verbs appear (no `checkout`, `reset --hard`, `clean -fd`, `stash drop`, force-push).
48:$ cd /Users/johancito/Developer/Elibry && grep -niE "checkout|reset --hard|clean -fd|stash drop|force-push" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t07-dev.md
exit: 0
```
4 hits in the NEW round-2 report itself. Assessed each individually, per the
task's explicit "before"-quoting carve-out:
- **Line 11** (Summary): names the banned substrings as a list to describe
  *what was removed*, not as an instruction. Not a rollback note, not
  prescriptive. Acceptable, though it is the least clean-cut of the four
  (it paraphrases rather than block-quotes) — flagged as borderline-but-fine
  below.
- **Line 21**: explicitly under a `**Before:**` heading, block-quoting the
  OLD line-47 text verbatim to document the defect being corrected. This is
  the exact "quoting the old banned text as a before example" convention the
  task called acceptable, and matches round-1 QA's own independently-grepped
  original text character-for-character.
- **Line 33**: same, under `**Before:**` for the old line-165 text. Matches
  round-1 QA's original text character-for-character.
- **Line 48**: the literal grep COMMAND being pasted as evidence (the regex
  pattern itself contains the words as a search pattern, not as an
  instruction to run a destructive command). Standard evidence-citation
  convention used throughout this sprint's QA reports (round-1 QA's own
  report does the identical thing).

None of the four are a rollback note prescribing a destructive action in
`reports/t07-dev-r2.md` itself. This report is a round-2 status/evidence
document, not a rollback artifact — its own "what to do to undo this round's
edit" content, if any, would need the same scrutiny, but this report does
not carry a rollback section of its own (the operative rollback note lives
in `reports/t07-dev.md`, already fixed and re-verified 0-hit above).
Verdict on this file: no defect.

```
$ git diff docs/migracion/README-cleanup.md | grep -c '^@@'
2
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
Byte-for-byte identical (same 2 hunks, same content, same index hashes
`80381e7..9bfdf32`) to what round-1 QA independently verified and pasted in
`reports/t07-qa.md`. Confirms `docs/migracion/README-cleanup.md` was NOT
touched this round.

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
12 entries, identical set to round 1's snapshot (round-1 QA's own report,
`reports/t07-qa.md`, lines 86–99, lists the same 12). `CLAUDE.md` and the 9
other untracked top-level entries are pre-existing/out-of-scope (confirmed
already at the start of THIS session per the environment's own git-status
snapshot, unrelated to t07). `docs/migracion/README-cleanup.md` shows the
same round-1 diff (verified above — unchanged). The entire
`docs/sprints/2026-09-22-clientes-xlsx-import/` directory is one untracked
entry containing every sprint report; within it this round only touched:
`reports/t07-dev.md` (edited, 2 lines), `reports/t07-dev-r2.md` (new), and
`scratchpad.md` (dev appended a "t07 junior-r2" handoff row — read in full,
contains only the same acceptable before/after-summary pattern discussed
above, no new defect). No other file under that directory shows evidence of
this-round modification (all other report files' mtimes predate this round's
work per the `ls -la` timestamp check below).

```
$ ls -la docs/sprints/2026-09-22-clientes-xlsx-import/reports/ | tail -6
-rw-r--r--   1 johancito  staff   2827 Sep 22 17:51 t07-dev-r2.md
-rw-r--r--   1 johancito  staff   9213 Sep 22 17:51 t07-dev.md
-rw-r--r--   1 johancito  staff   4325 Sep 22 17:50 t07-lead.md
-rw-r--r--   1 johancito  staff  15515 Sep 22 17:48 t07-qa.md
```
Only `t07-dev.md` and `t07-dev-r2.md` carry this round's timestamp (17:51);
`t07-lead.md` and `t07-qa.md` (round 1 artifacts) are untouched, as expected.

```
$ npm run qa
```
NOT RE-RUN this round. This is correct, not an omission: no source file
changed (only report prose in `reports/t07-dev.md`, a new report
`reports/t07-dev-r2.md`, and a scratchpad append), and the shipped file
`docs/migracion/README-cleanup.md` is confirmed byte-identical to round 1
above. Round 1's `npm run qa` result — independently re-run and confirmed by
round-1 QA (`reports/t07-qa.md` lines 118–141: exit 0, typecheck clean, lint
0 errors/28 pre-existing warnings, 30/30 test files, 825/825 tests) — still
stands and is not invalidated by this round's report-text-only edit. Per the
lead's own instruction (`reports/t07-lead.md`: "`npm run qa` does not need to
be re-run for this fix"), skipping the re-run this round is correct.

---

## Acceptance criteria (plan `docs/plans/clientes-xlsx-import.md` L529–540)

1. AC1 (2 hunks, confined to two spans) — PASS (round 1, reconfirmed unchanged this round).
2. AC2 (replacement wording bounded by evidence) — PASS (round 1, reconfirmed unchanged this round).
3. AC3 (other guidance untouched) — PASS (round 1, reconfirmed unchanged this round).
4. AC4 (no credential/host/key) — PASS (round 1, reconfirmed unchanged this round).
5. AC5 / `npm run qa` sub-clause — PASS (round 1 result stands; no re-run required, verified correct not to re-run).
6. AC5 / "rollback note prose, no git verb" sub-clause (this round's specific target) — **PASS.** Independently grepped `reports/t07-dev.md` myself: 0 hits, exit 1. The corrected wording ("Do not use any command that overwrites the working tree from a ref or discards uncommitted changes" / "No command that overwrites the working tree from a ref or discards uncommitted/untracked changes appears anywhere in this report") still accurately conveys the prohibition without naming a banned verb, matches the lead's prescribed wording verbatim, and the underlying rollback *mechanism* (hand-edit the two spans back from the quoted original text / `cat > file <<EOF...EOF`) remains the same safe, non-destructive approach approved in round 1.

---

## Out-of-scope changes: none

Every file touched this round is accounted for: `reports/t07-dev.md` (edited,
2 targeted lines only), `reports/t07-dev-r2.md` (new, this round's dev
report), `scratchpad.md` (dev's own handoff row append, within the sprint
directory's normal convention). `docs/migracion/README-cleanup.md` — the
actual shipped artifact — was NOT touched, confirmed via `git diff` byte-match
against round 1's already-verified diff. No other tracked or untracked file
changed.

---

## Bugs found: none

Round 1's single finding (banned-verb substrings in `reports/t07-dev.md`
lines 47 and 165) is fixed and independently re-verified 0-hit. The new
round-2 report (`reports/t07-dev-r2.md`) contains the same substrings only in
acceptable "before"-quoting / command-echo context (see grep analysis
above) — not a rollback note of its own, not a recurrence of the underlying
mistake-class defect.

---

## Suggested fixes: none

Task complete as scoped. No further action needed on t07. Sprint may proceed
(e.g., to T8's sprint-wide banned-verb audit, which this round's fix should
now clear).

---

## Attack Log (show your work)

- **RLS:** N/A — no table, schema, or data-access code touched; this round
  is a two-line report-text edit with no DB/isolation surface (same as
  round 1).
- **Optimistic UI:** N/A — no UI/client code touched.
- **Realtime:** N/A — no realtime subscriber code touched.
- **Edge cases tried:**
  1. Did not trust the dev's pasted grep output in `reports/t07-dev-r2.md` —
     independently re-ran the identical grep against the live file myself;
     confirmed 0 hits / exit 1.
  2. Checked the corrected lines are still at the SAME line numbers (47,
     165) as the original banned text round-1 QA found, as circumstantial
     proof no other lines were inserted/removed elsewhere in the file
     (an insertion anywhere above line 47 or between 47 and 165 would have
     shifted at least one of these two numbers).
  3. Read the ENTIRE current `reports/t07-dev.md` (all 195 lines), not just
     the two claimed-changed lines, to catch any undisclosed additional
     edit — found the rest of the file (AC list, git diff block, npm run qa
     output, Evidence Trail, Limitations, Rollback section) fully consistent
     with round-1 QA's own independently-verified content, no divergence.
  4. Grepped the NEW round-2 report itself
     (`reports/t07-dev-r2.md`) for the same banned-verb substrings, since it
     also discusses the fix and could have reintroduced the defect while
     explaining it — found 4 hits, individually inspected each in context;
     all are either explicit `**Before:**`-labeled quotes of the original
     defective text (matching round-1 QA's own independently-grepped
     original character-for-character) or a pasted grep command's search
     pattern — none is a prescriptive rollback instruction. Flagged the
     least clean-cut instance (line 11's paraphrased list) explicitly rather
     than silently waving it through.
  5. Re-ran `git diff docs/migracion/README-cleanup.md` myself rather than
     trusting the dev's claim it is unchanged — byte-identical to round 1's
     independently-verified diff (same 2 hunks, same blob hashes).
  6. Re-ran `git status --short` myself and accounted for every one of the
     12 entries, cross-checked file mtimes via `ls -la` to confirm only
     `reports/t07-dev.md` and `reports/t07-dev-r2.md` carry this round's
     timestamp — no silent additional touch elsewhere in the sprint
     directory.
- **What I tried that could have broken this:** I specifically hunted for
  the same defect class recurring in the NEW round-2 report itself (a
  well-documented recurring failure mode per
  `~/Developer/CBrain/mistakes/destructive-op-named-in-rollback-note.md`,
  where an agent explaining a banned-verb fix reintroduces the verb) rather
  than assuming a report ABOUT a fix is automatically safe — found 4 raw
  hits, and had to individually verify each was quoting-not-prescribing
  before clearing them, rather than accepting the dev's own "0 hits
  expected" framing (which only covered `reports/t07-dev.md`, not its own
  `reports/t07-dev-r2.md`) at face value.

---

## Rollback note for this QA report

This is a review-only artifact (`reports/t07-qa-r2.md`, newly created — no
source file touched). To undo: delete this file by hand
(`reports/t07-qa-r2.md` did not exist before this round).
