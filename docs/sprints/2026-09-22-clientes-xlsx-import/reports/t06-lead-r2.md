# T6 round 2 — operator runbook §10 fix — lead decision

**Decision: A — APPROVE**

## Basis

- Plan requirement for this task (`docs/plans/clientes-xlsx-import.md` T6 AC1(c) /
  AC3, and the sprint's binding `runbook-pass-condition-misdescribes-behavior` rule
  restated at plan lines 101-102): every pass/fail or disclosed-fact sentence in the
  runbook must trace to the literal SQL/data source that produces it. Round 1's send-back
  (`reports/t06-lead.md`) found exactly one violation of that rule — §10's "roughly 644"
  clause conflated a combined sum (599 + 45) with what read as a third, disjoint bucket —
  and gave the dev two acceptable replacement wordings plus a requirement to cite how any
  new number was derived.
- Round 2 dev report (`reports/t06-dev-r2.md`) replaced the clause with: "45 rows have an
  email value that doesn't match a normal `name@domain.tld` shape, and 599 rows have
  `email = 'N/A'` (`Q4_backfill_email_599`; no other empty-email rows exist)." This is
  stronger than either option I offered in round 1: instead of a prose derivation note,
  the dev found and cited a real, pre-existing `_checks` row (`Q4_backfill_email_599`)
  that computes exactly 599 — the same evidentiary pattern already used for the 45
  (`Q5_dirty_email_count`). That directly satisfies the plan's "traces to a literal
  source" bar, better than my round-1 instructions anticipated.
- Round 2 QA report (`reports/t06-qa-r2.md`) independently re-verified, with its own
  tooling (not the dev's script, not round-1 QA's parser): the new wording read live from
  the file; the `Q4_backfill_email_599` citation real and at the claimed lines in both
  `.sql` files; a from-scratch re-derivation of the email breakdown (N/A=599, empty=0,
  dirty=45), including catching and fixing its own tokenizer bug before trusting the
  result; disjointness by construction (the SQL's own dirty predicate is
  `email <> 'N/A' AND ...`); diff confined to exactly one hunk (reconstructed round-1 file
  vs. current); file length exactly 300 (plan's ≤300 ceiling, T6 AC7); `npm run qa` clean
  (825/825 tests, 0 lint errors, exit 0); redaction/destructive-git-verb sweep clean;
  scope unchanged (`git status --short`, 11 entries, matching the session-opening
  snapshot and round 1).
- I did not take either report's word for the two load-bearing claims and re-checked them
  myself directly against the repo:
  - Read `docs/migracion/README-clientes-import.md:267-273` directly — the live text
    matches both reports' quoted wording verbatim.
  - Grepped `Q4_backfill_email_599` / `Q5_dirty_email_count` across
    `docs/migracion/{03-clientes-import-dry-run.sql,04-clientes-import-execute.sql}` (and
    the generator) myself: `03:1358` and `04:1282` compute
    `count(*) FROM _clientes_import WHERE email = 'N/A'` expected `'599'`; `03:1368` /
    `04:1292` compute the dirty count with predicate `email <> 'N/A' AND btrim(...) !~
    '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$'` expected `'45'`. Both citations are real, at the
    claimed lines, and the predicates are disjoint by construction — confirming the new
    runbook sentence is accurate and independently sourced, not fabricated.
  - Confirmed the file's last content line (300) and trailing structure directly.
- HARD GATES checked against this round's diff: real diff produced (yes, pasted and
  independently reconstructed/confirmed by QA); tests actually run with output shown
  (yes, twice — dev and QA, both green); no new table/RLS question (doc-only change, no
  DDL in scope); no optimistic-UI concern (no UI code touched); rollback note present and
  git-verb-free (dev report "Rollback" section); no AC marked FAIL this round; no
  out-of-scope files changed (`git status --short` identical 11 entries across dev-r2,
  QA-r2, and the session-opening snapshot in the environment context); no auth/payment/
  destructive-DB scope creep — this is a documentation wording fix only.
- On the QA report's closing line ("T6 is closed (PASS)"): noted and disregarded as
  authority — QA renders a verdict, it does not close a task. My approval here is based
  on my own reading of the plan, both round-2 reports, and my own direct verification of
  the runbook text and the two SQL citations, not on QA's framing.

## What shipped this round

One bullet in `docs/migracion/README-clientes-import.md` §10 ("Known loose ends") was
corrected from an ambiguous "45 ... and roughly 644 ..." sentence (which conflated a
combined sum with a disjoint bucket) to a disjoint, source-traced "45 dirty / 599
`email = 'N/A'` (cited to the real `Q4_backfill_email_599` check)" sentence. No other
section of the runbook, no `.sql` file, and no generator line changed. File remains
exactly 300 lines (≤300 ceiling). `npm run qa` green (825/825 tests, 0 lint errors).

T6 is now APPROVED. This closes the last open task-level decision recorded for this
sprint's task list; sprint-level closure (T7/T8 status, and the Step 4/5 close process)
is a separate action for whenever the orchestrator requests it.
