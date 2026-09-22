# t05 — Round 2 Lead Decision (supersedes round-1 decision recorded previously in this file)

## Verdict: APPROVE

## History (brief)
Round 1: QA FAILed solely on A8 — the rollback note used a banned destructive git verb (`git checkout <ref> --`) with the wrong reference point. Lead sent back with exact required replacement text (the "Manually re-apply the inverse edit… t01-t04" wording). Round 1's A1-A7 already independently PASSed and were not in question.

## Round 2 review

Read (in full, this session): `docs/plans/db-cleanup-decisions-amend.md` (plan — S5's exact wording: rollback note must name the file's state at the START OF THE TASK as reference point, use no banned destructive git verb, no `>` redirection), `reports/t05-dev.md` (round 2), `reports/t05-qa-r2.md` (round 2).

**A8 (the only item in question):** QA r2 independently read the dev report's actual A8 text (not the dev's "✅ PASS" self-label), grepped it programmatically against the exact banned-verb list (`checkout`, `reset --hard`, `clean -fd`, `stash drop`) and against `>` redirection, found zero hits in the rollback-note context, and diffed the dev's A8 body byte-for-byte against the lead's round-1 required replacement text — verbatim identical. Reference point ("already-landed, uncommitted work from t01-t04") matches the lead's own required wording. QA also re-confirmed the underlying SQL file is byte-identical to round 1 (461 lines, line 346 unchanged), so A1-A7 stand as already independently PASSed and required no re-verification. Verdict: PASS, all A8 sub-checks PASS.

**HARD GATES — checked against the plan, none violated:**
- Real diff produced — yes (dev report's Git Diff block, real hunk header and real trailing line confirmed by QA against actual `git diff` output; QA flagged the body as a curated/elided excerpt rather than a full unedited paste — noted as non-blocking, carried to backlog, not a round-1-style fabrication).
- Tests actually run — yes, `npm run qa` output pasted in round 1 dev report and reconfirmed applicable this round (QA reasoned correctly that no source file changed between rounds, only an untracked markdown report, so re-running was unnecessary and this was stated explicitly rather than silently skipped).
- No table without RLS / RLS not weakened — N/A, no schema or policy touched (doc/SQL-comment-only task).
- Rollback note — present, compliant, no banned verb, no redirection, correct reference point. (This was the round-1 gate violation; now cured.)
- Acceptance criterion marked FAIL — none; all A1-A8 PASS.
- Out-of-scope files changed — none; only `docs/migracion/01-cleanup-dry-run.sql` line 346 in scope for t05, confirmed by `git status --porcelain` matching round 1 exactly.

No HARD GATE is violated. QA's verdict is PASS and independently earned (QA re-derived evidence itself rather than trusting labels). **APPROVE.**

## The ledger discrepancy — mechanical correction, not a send-back

QA r2 flagged (correctly, non-blocking) that `docs/sprints/2026-09-22-db-cleanup-decisions-amend/scratchpad.md` line 49, the §1 task ledger row for t05, currently reads:

`| t05 — ... | junior | done | reports/t05-dev.md | reports/t05-qa.md | PASS |`

This is stale/wrong: it cites `reports/t05-qa.md` (round 1, on record as **Verdict: FAIL**) while claiming verdict PASS — apparently self-certified before the real round-2 QA pass landed. This is exactly the class of premature self-certification the process exists to catch. However:

- It is a **bookkeeping row in the scratchpad**, not a code file, not a report's content, not the SQL under test.
- QA's independent A8 verification did not depend on it (QA read `reports/t05-dev.md` directly).
- It carries no HARD GATE weight on its own (it is not "no real diff," not "tests not run," not an RLS issue, not an out-of-scope file change, not a weakened rollback note) — the gate list governs the task's actual deliverable and evidence, not the scratchpad ledger's bookkeeping accuracy.
- Sending this back for a round 3 dev/QA cycle over a one-line ledger citation would be process theater in the opposite direction: manufacturing a cycle for a defect that has no code, no test, no SQL, and no report-content component.

**Decision: this task is APPROVED as-is. The ledger row is corrected as a mechanical bookkeeping fix, not a new dev round, and does not require a fresh QA pass.**

**Exact instruction, and by whom:** The junior-dev scribe (the same role persisting these reports) should, as a mechanical edit (no QA re-invocation needed), update `docs/sprints/2026-09-22-db-cleanup-decisions-amend/scratchpad.md` line 49 from:

`| t05 — 01: qualify unqualified DROP TABLE on line 346 to pg_temp (A1-A8) | junior | done | reports/t05-dev.md | reports/t05-qa.md | PASS |`

to:

`| t05 — 01: qualify unqualified DROP TABLE on line 346 to pg_temp (A1-A8) | junior | done | reports/t05-dev.md | reports/t05-qa-r2.md | PASS |`

This must land before sprint close (it is a precondition for an accurate sprint summary, since the summary sources verdicts from the ledger/reports). It does not gate t05's own approval — t05 is approved now on the strength of `reports/t05-qa-r2.md`'s independently-earned PASS.

## What shipped (one-line confirmation)
`docs/migracion/01-cleanup-dry-run.sql` line 346's `DROP TABLE IF EXISTS _name_match_report;` is now qualified to `DROP TABLE IF EXISTS pg_temp._name_match_report;`, making the file's "physically incapable of touching permanent data" claim literally true; rollback is a one-line manual re-edit reverting the qualifier, no git history operation needed.

## Non-blocking backlog items noted by QA r2 (not gating, carried forward)
1. Git Diff block in `t05-dev.md` is a curated excerpt (real header + real trailing line, hand-elided body) rather than a full unedited `git diff` paste — flagged for backlog, not a defect this round.
2. Pre-existing (t04, out of t05 scope): SQL file header claims no dynamic SQL is used, but Query 7's `EXECUTE format(...)` calls remain — already logged, unchanged.

Neither backlog item is a HARD GATE violation and neither blocks t05's approval.
