# T7 — Round 2 Lead decision

**Date:** 2026-09-22
**Task:** t07 round 2 (junior) — Correct the stale "dead credentials / 521" claim in
`docs/migracion/README-cleanup.md` (report-text-only send-back cycle)
**Plan reference:** `docs/plans/clientes-xlsx-import.md` L525–540 (T7 acceptance criteria)
**Round 1 QA verdict reviewed:** FAIL (`reports/t07-qa.md`)
**Round 1 lead decision reviewed:** B — SEND BACK (`reports/t07-lead.md`)
**Round 2 dev report reviewed:** `reports/t07-dev-r2.md`
**Round 2 QA verdict reviewed:** PASS (`reports/t07-qa-r2.md`)

---

## Decision: A — APPROVE

This closes T7 for the sprint.

## What shipped (confirmation)

- `docs/migracion/README-cleanup.md`: the "Verification status" block and the
  Step-1 credentials sentence now correctly state that the target Supabase
  project is reachable and `.env.local`'s credentials are verified live and
  functional this sprint (T1/T2-r4/T3-r3/T5 evidence cited), replacing the
  stale "dead credentials / 521" claim — this was already fully verified and
  approved in round 1 (AC1–AC4 PASS, byte-identical diff, 2 hunks) and is
  confirmed byte-identical and untouched this round.
- `reports/t07-dev.md` lines 47 and 165: reworded to remove the literal
  banned destructive-git-verb substrings while preserving the exact same
  safe, non-destructive rollback mechanism (hand-edit the two spans back
  from the quoted original text). This was round 1's sole outstanding
  defect (the AC5 "no git verb" sub-clause), and it is now fixed.

## Why round 2 clears the round-1 send-back

Round 1's send-back (`reports/t07-lead.md`) was narrow and precise: reword
lines 47 and 165 of `reports/t07-dev.md` only, using non-verb-naming language,
re-grep and paste 0-hit evidence, and state explicitly that `npm run qa` did
not need to be re-run (report-text-only fix). The round-2 dev report
(`reports/t07-dev-r2.md`) did exactly that and nothing more:

- Line 47 reworded to: "Do not use any command that overwrites the working
  tree from a ref or discards uncommitted changes" — matches the lead's
  prescribed wording.
- Line 165 reworded to: "No command that overwrites the working tree from a
  ref or discards uncommitted/untracked changes appears anywhere in this
  report" — matches the lead's prescribed wording.
- Grep evidence pasted: `grep -niE "checkout|reset --hard|clean -fd|stash
  drop|force-push" reports/t07-dev.md` → exit 1 (0 hits).
- Explicitly states `docs/migracion/README-cleanup.md` is untouched and
  `npm run qa` was not re-run, per the lead's own instruction.

Round-2 QA (`reports/t07-qa-r2.md`) independently re-verified rather than
trusting the dev's pasted output:

- Re-ran the identical grep against the live file itself — 0 hits, exit 1,
  confirmed.
- Read the entire 195-line `reports/t07-dev.md`, not just the two claimed
  lines, and cross-checked line numbers (47, 165 unchanged) as corroborating
  evidence no other line moved — explicitly noted the file has no git
  history (untracked sprint directory) so a byte-exact `diff` against the
  pre-round-2 state wasn't possible, and disclosed that limitation rather
  than silently treating convergent evidence as a full diff. This is an
  honest evidentiary gap, not a defect — the convergent checks (matching
  line numbers, matching quoted "Before" text against round-1 QA's own
  independently-grepped original, full-file read) are the best available
  substitute for an untracked file and are sufficient here.
- Independently re-diffed `docs/migracion/README-cleanup.md` against round
  1's already-verified diff — byte-identical, same 2 hunks, same blob
  hashes (`80381e7..9bfdf32`) — confirms the shipped file was not touched
  this round.
- Ran `git status --short` and cross-checked file mtimes via `ls -la` —
  confirmed only `reports/t07-dev.md` and `reports/t07-dev-r2.md` (plus a
  scratchpad append) carry this round's timestamp; no other file in the
  repo changed. No out-of-scope changes.
- Correctly did not re-run `npm run qa` (report-text-only fix, round 1's
  green result still stands and is not invalidated by a prose-only edit to
  an already-approved, unchanged shipped file) — and explicitly justified
  why that is correct rather than an omission.
- Went beyond the round-1 instruction's literal scope and proactively
  grepped the NEW round-2 report itself (`reports/t07-dev-r2.md`) for the
  same banned-verb substrings, per the mistake note's twelfth-instance
  warning that an agent explaining a fix can reintroduce the defect while
  describing it. Found 4 raw hits, individually verified each:
  - Line 21 and line 33: explicitly under `**Before:**` headings,
    block-quoting the OLD defective text verbatim to document what was
    fixed — matches round-1 QA's own independently-grepped original
    character-for-character. This is historical documentation of a past
    defect, not a rollback instruction recommending a future action — it
    does not fall inside the mistake note's actual scope ("a rollback
    note/instruction naming a destructive-shaped verb... as future
    guidance"). `reports/t07-dev-r2.md` has no rollback section of its own;
    the operative rollback note lives in `reports/t07-dev.md`, already
    fixed and re-verified 0-hit.
  - Line 48: the literal grep command's search pattern, pasted as evidence
    — a search string, not a prescribed action.
  - Line 11 (Summary): paraphrases the banned substrings as a list
    describing what was removed. QA flagged this as "least clean-cut" since
    it's a paraphrase rather than a block quote, but correctly assessed it
    is still descriptive-of-history, not prescriptive-of-a-future-action —
    consistent with the mistake note's actual root cause (an artifact
    "recommends an unsafe operation as future guidance"), which line 11
    does not do.

I checked this reasoning directly against the mistake note's own text
(`~/Developer/CBrain/mistakes/destructive-op-named-in-rollback-note.md`).
The note's prevention rule targets a rollback note/instruction that *names a
banned verb as the instruction itself* — every one of its sixteen documented
instances is a case where the artifact recommends running (or ran) the
destructive command. None of the four hits in `reports/t07-dev-r2.md` do
that: two are labeled quotes of already-superseded defective text (a
correction record, not new guidance), one is a paraphrased list in a
Summary describing a fix already applied, and one is a pasted grep pattern.
QA's distinction — "before"-quoting/command-echo context is not the same
defect class as a rollback note prescribing a destructive action — is sound
and does not stretch the rule past its documented scope.

## Acceptance criteria status (plan L529–540), consolidated across both rounds

1. Hunk count = 2, confined to two spans — PASS (round 1, unchanged, reconfirmed round 2).
2. Replacement wording bounded by T1/T3/T2/T5 evidence, cites report paths — PASS (round 1, unchanged).
3. Other guidance untouched — PASS (round 1, unchanged, reconfirmed round 2).
4. No credential/host/key — PASS (round 1, unchanged).
5. `npm run qa` green — PASS (round 1's independently-reproduced green result stands; correctly not re-run this round for a report-text-only change to an unchanged shipped file).
6. Rollback note: prose, no git verb — PASS this round. The only defect from round 1 (banned-verb substrings in `reports/t07-dev.md` lines 47/165, in negated form) is fixed and independently re-verified at 0 hits.

All six acceptance criteria are now PASS with independent QA verification in both rounds. No HARD GATE is violated: real diffs shown, tests actually run and pasted (round 1) with a justified, explicit skip this round, no new table, no RLS surface, no optimistic-UI mutation, rollback note present and now clean, no out-of-scope files touched, no auth/payment/destructive-DB change.

## Rollback note for this decision record

This is a review-only artifact (`reports/t07-lead-r2.md`, newly created — no
source file touched). To undo: delete this file by hand
(`reports/t07-lead-r2.md` did not exist before this round).
