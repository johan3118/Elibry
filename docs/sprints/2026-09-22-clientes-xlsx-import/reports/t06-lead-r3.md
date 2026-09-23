# T6 round 3 — process-integrity verification — lead decision

**Decision: A — APPROVE**

Plan read fresh before this decision: `docs/plans/clientes-xlsx-import.md` (T6 AC1–AC8,
`runbook-pass-condition-misdescribes-behavior`, `destructive-op-named-in-rollback-note`,
ADR 0014 bounded-evidence rule, the file-size/line-count ceilings). T1–T5 approvals and
this task's prior T6 rounds (`t06-lead.md` FAIL basis, `t06-lead-r2.md` APPROVE) read for
lineage context, per the orchestrator's brief.

---

## 1. Ruling on the CURRENT LIVE §10 text — approvable on its own merits

Yes. Independently of any prior round's paperwork, the text that is actually live in
`docs/migracion/README-clientes-import.md:266-272` right now is correct and properly
sourced:

- **45** → `Q5_dirty_email_count`, `03-clientes-import-dry-run.sql:1368` — dev cited it,
  QA re-derived it from a fresh parse of the raw 1,231-row staged payload (not the
  hardcoded `expected` literal) and got 45, with 5 of the 45 spot-checked by hand as
  genuinely malformed.
- **599** → `Q4_backfill_email_599`, `03:1358` / `04:1282` (+ post-check mirror
  `04:1340`) — same independent-recompute treatment, matches.
- **0 empty** → not a named check, correctly not cited as one; traced to the
  blank→`'N/A'` mapping rule in the generator. QA's recompute confirms 0 empty strings
  in the actual payload.
- **644** → confirmed to be prose arithmetic (45+599), asserted by no `_checks`/
  `_post_checks` row under any name (QA counted 42 such rows and checked all 42 names).
  The runbook's own framing ("a sum, not a check value") is accurate.

QA's method here is materially stronger than a plausibility check: it recomputed all
four figures from the actual staged data with an independent parser, not merely
confirmed that the SQL *asserts* the cited numbers. That closes the exact class of gap
(`assertion-without-verification`) this sprint's rules exist to prevent.

Two things QA flagged are correctly treated as non-blocking, and I agree with that
framing on independent review:

- **Two citation errors in `t06-dev-r3.md` §3** (a line-number citation of 95 that
  should be 63; a count of "40" `_checks` rows that should be 42). Both are errors in
  the *dev report's own citations*, not in the live runbook text, and neither changes
  the underlying conclusion — QA independently verified the correct line (63) and the
  correct count (42) and reached the same result either way. This does not meet the bar
  for a send-back: the live artifact under review (the runbook) is unaffected.
- **Scratchpad overflow** (438 lines vs. the 300-line cap in
  `.claude/rules/context-budget.md`). This is pre-existing (already ~408 lines before
  r3's 30-line append) and the rule itself states the cap is enforced **at sprint
  close**, not mid-sprint. Correctly deferred, not a T6 defect.

`npm run qa` was run fresh by both dev and QA this round (825/825 tests, 0 lint errors,
tsc clean, exit 0) — pure regression evidence, consistent with every prior round, since
this sprint touches no `app/`, `lib/`, `components/`, or `tests/` file. Both `.sql` file
hashes are unchanged and re-verified. Scope is confirmed narrow: exactly
`reports/t06-dev-r3.md` (new) plus a narrow scratchpad edit, inside the same
pre-existing `??` sprint-directory entry — 0 new top-level entries against
`git status --short`'s 11-entry baseline. No HARD GATE is violated: no source file was
edited this round, tests were actually run with output shown, no new table/RLS surface,
no optimistic-UI concern, rollback notes are present and git-verb-free in both reports.

**Ruling: the live §10 text is approved on its own merits, independent of any prior
round's paper trail.**

## 2. The provenance gap — stated plainly, not smoothed over

`reports/t06-qa-r2.md` (Verdict: PASS) and `reports/t06-lead-r2.md` (Decision: A —
APPROVE) certify wording that is **no longer live**. They were written against the
first, 599-only round-2 fix. That fix was superseded twice in place — once by a
legitimate self-correction ("r2b", citing 45+599+0-empty+644-as-sum) from the same
task-runner, and a second time by a different dev who picked up a stale duplicate
dispatch, found the repo already in the post-r2b state, and re-applied the same
overwrite believing it was first. Both overwrites landed on the same two paths: the
live runbook's §10 sentence, and `reports/t06-dev-r2.md`'s content.

Net effect: `t06-dev-r2.md`'s original, `t06-qa-r2.md`-approved content (the 599-only
wording) **no longer exists anywhere** — not in the live file, not in the report that
described it. It cannot be reconstructed without fabricating evidence
(`reconstructed-output-presented-as-captured`), and this round correctly did not
attempt to.

**This round (r3) is what formally re-establishes current, valid PASS/APPROVE evidence
against what is actually live in the runbook today.** `t06-qa-r2.md` and
`t06-lead-r2.md` should be read, going forward, as historical record of a decision made
against wording that has since changed underneath it — not as current sign-off on
today's file. `t06-qa-r3.md` and this record (`t06-lead-r3.md`) are the operative
verdicts for the live text as it stands at sprint close.

## 3. Damaged/superseded evidence — preserved as-is, not touched

Per this sprint's evidence-integrity rules and this round's explicit instruction, I am
**not** editing, annotating in place, or reconstructing any of the following — they stay
on disk exactly as they are, as the honest record of what happened:

- `reports/t06-dev-r2.md` — content overwritten twice; the original 599-only text it
  once held is gone and unrecoverable. Left as-is.
- `reports/t06-qa-r2.md` (PASS) — left as-is; superseded in effect by §2 above, not
  retracted or rewritten.
- `reports/t06-lead-r2.md` (APPROVE) — left as-is; superseded in effect by §2 above, not
  retracted or rewritten.
- `reports/t06-dev.md`, `reports/t06-qa.md`, `reports/t06-lead.md` (round 1) — untouched,
  unaffected by any of this; the original FAIL/send-back lineage remains accurate
  history.

No new file was created to "correct" the r2 record. The correction lives here, in this
r3 lead record, and in `t06-dev-r3.md`/`t06-qa-r3.md`'s own lineage sections — pointing
at the damaged evidence rather than papering over it.

## 4. CBrain mistake-filing candidate — flagged for sprint close, not smoothed over

**"Orchestrator dispatched a duplicate round against already-approved work because it
read a lower round's reports and missed a higher round's already-existing approval."**

This is a real, costly process failure, not a one-off curiosity:

- It consumed a full extra dev+QA+lead cycle (this round, r3) purely to re-establish
  evidence integrity, with zero net change to the actual deliverable.
- It **destroyed** a piece of primary evidence permanently: the original, validly
  approved r2 dev report content is gone and cannot be recovered without fabrication.
  That is not a "no harm done" near-miss — real evidence was lost.
- The root cause is structural, not a one-time slip: the orchestrator's dispatch
  decision read only round-1 state and did not check for a higher round already on
  disk before generating a "round 2" brief. That failure mode can recur on any task
  with more than one round in flight.
- It compounded with (did not cause, but was made worse by) a second, independent actor
  choosing to trust a stale dispatch brief over the live repo state it found — a second,
  related lesson (when a dispatch brief and the live repo disagree, that disagreement
  itself should halt and escalate, not resolve silently in favor of either source).

I am flagging this explicitly as a mistake-filing candidate for sprint close (Step 5),
per `~/Developer/CBrain/meta/consolidation.md`'s "for EVERY task sent back with a real
bug" and negative-space-audit instructions — this is exactly the kind of durable,
costly, structural failure that belongs in `mistakes/`, not something to smooth over
because the end state (r3) happened to land on PASS.

## 5. HARD GATES checked against this round

- Real diff produced → N/A, verification-only round, correctly disclosed as such; no
  source file edit claimed or found.
- Tests run, output shown → yes, `npm run qa` run fresh by both dev and QA, full output
  pasted, exit 0, 825/825 tests, 0 lint errors, tsc clean.
- New table without RLS → N/A, no table touched.
- Existing RLS weakened → N/A.
- Missing rollback note → present in both reports, prose-only, no git verb.
- Acceptance criterion marked FAIL → none; QA's own AC list is all PASS (one item
  explicitly labelled "PASS, with an explicitly disclosed gap" for the r2-provenance
  point, which I have independently ruled on in §2 above rather than deferring to QA's
  framing).
- Optimistic UI with no rollback → N/A.
- Auth/payment/destructive DB change not in plan → N/A; `04` was not run (confirmed by
  QA via mtimes and the absence of any execution-log artifact, with the epistemic limit
  stated honestly rather than overclaimed).
- Out-of-scope files changed → none; `git status --short` shows the same 11 top-level
  entries as every prior round, with only the new report file and the narrow scratchpad
  edit inside the pre-existing sprint-directory entry.

No gate is tripped. QA's verdict (PASS) stands on independent re-check.

## 6. Decision

**A — APPROVE.** The live §10 text in `docs/migracion/README-clientes-import.md` is
correct, source-traced, and independently re-verified by both dev and QA this round
using stronger methods than a prior-round rubber stamp would require. The r2/r2b
provenance gap is real, disclosed, and not closable by reconstruction — it is recorded
here rather than hidden, and this round's PASS/APPROVE is what now stands as current,
valid evidence for what is live on disk. T6 is **formally closed as of round 3.**

## 7. Scratchpad edit made

Narrow edit only, to the existing t06 row in §1 of
`docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` — appended a short note
that lead-r3 has APPROVED and that T6 is formally closed as of round 3. No other row,
no §2 handoff block, and no other content in the scratchpad was touched.
