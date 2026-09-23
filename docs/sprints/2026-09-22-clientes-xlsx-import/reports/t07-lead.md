# T7 — Lead decision

**Date:** 2026-09-22
**Task:** t07 (junior) — Correct the stale "dead credentials / 521" claim in `docs/migracion/README-cleanup.md`
**Plan reference:** `docs/plans/clientes-xlsx-import.md` L525–540 (T7 acceptance criteria)
**QA verdict reviewed:** FAIL (`reports/t07-qa.md`)

---

## Decision: B — SEND BACK TO DEV

## QA finding that triggers this

QA (`reports/t07-qa.md`, "Bugs found") found AC5's sub-clause — "Rollback note:
... prose, **no git verb**" (plan L539–540, mirrored as T7 AC6 in the dev's own
report) — violated not in the shipped file but in the dev's own report text
(`reports/t07-dev.md`):

- Line 47 (Rollback section): `No `git checkout`, `git reset --hard`, or `git clean -fd`.`
- Line 165 (Redaction Checklist): `- [x] No destructive git verbs appear (no `checkout`, `reset --hard`, `clean -fd`, `stash drop`, force-push).`

Both lines literally contain the banned-verb substrings, even though only in
negated/prohibitive form. QA independently confirmed via
`grep -niE "checkout|reset --hard|clean -fd|stash drop|force-push"` against
`reports/t07-dev.md` — 2 hits, lines 47 and 165 — reproduced above verbatim
from the QA report.

I confirmed this against the actual text of the cited mistake note,
`~/Developer/CBrain/mistakes/destructive-op-named-in-rollback-note.md`. Its
prevention rule is explicit and mechanical, with no negation carve-out:

> "As of the tenth 2026-09-11 instance: ... A note that names a banned verb is
> a defect the moment it is written, regardless of whether the hook would also
> have blocked it had someone tried to run it. Continue running the
> review-time grep on every task's rollback section, permanently."

The note's twelfth documented recurrence is exactly this shape — "satisfying
the rule's LETTER with a prose hedge instead of omission" — a
compliance-shaped artifact that names the verb anyway. This sprint's own plan
enforces the same mechanical standard elsewhere with no semantic exception:
T6's AC4 (plan L516) requires a banned-verb grep on the *shipped* runbook file
itself with 0 hits, and T8's AC2 (plan L552) requires a banned-verb grep "over
every rollback note written this sprint (all `reports/*.md`...)" → 0 hits,
again with no carve-out for negated mentions. `reports/t07-dev.md` as it
stands today would fail T8's own sprint-wide audit.

Per this review's own HARD GATES: "Acceptance criterion marked FAIL → B" is
automatic and does not depend on QA's assessment of severity. QA itself rated
this narrow and non-dangerous (the shipped file is clean, the actual
prescribed rollback mechanism is safe, AC1–AC4 and the `npm run qa` sub-clause
of AC5 all PASS) — but "narrow" is not an exception in either the plan's
mechanical grep instructions or the mistake note's prevention rule, and this
review does not have discretion to waive a HARD GATE on severity grounds.

## Instructions for the dev

Reword `reports/t07-dev.md` lines 47 and 165 only — no other file changes,
and no change to `docs/migracion/README-cleanup.md` (QA already confirmed it
is clean). Use QA's suggested rewording or equivalent, describing the
prohibition without spelling the literal banned-verb substrings:

- Line 47: "To undo: restore the two spans by hand from the text shown in the
  'git diff' section below, using a text editor or `cat > file <<EOF...EOF`.
  Do not use any command that overwrites the working tree from a ref or
  discards uncommitted changes."
- Line 165: "- [x] No command that overwrites the working tree from a ref or
  discards uncommitted/untracked changes appears anywhere in this report."

After the edit, re-run `grep -niE "checkout|reset --hard|clean -fd|stash
drop|force-push" reports/t07-dev.md` and paste the output (expect 0 hits /
exit 1) as evidence in the corrected report. `npm run qa` does not need to be
re-run for this fix (report-text-only, no source file touched) — say so
explicitly in the corrected report so QA doesn't have to re-derive that.

## What does NOT need to change

- `docs/migracion/README-cleanup.md` — already correct per AC1–AC4, untouched.
- The prescribed rollback *mechanism* (hand-edit the two spans back using the
  quoted original text) — QA confirmed this is itself safe and correct; only
  the wording naming banned verbs must change.
