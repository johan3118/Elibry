# T1 lead decision — `02`: unconditional `pagos` wipe + migrate all nine `_keep_pago` consumers

Reviewed: plan `docs/plans/db-cleanup-decisions-amend.md` (§0.1 inventory, §10 pre-mortem
item 1, §11 T1 section: AC1-AC6, AC10, AC11, Standing ACs S1-S5), scratchpad §0/§1/§2 (t01
block), dev report `reports/t01-dev.md`, QA report `reports/t01-qa.md`.

## Decision: A — APPROVE

## Evidence

**Scope discipline (pre-mortem item 1, plan line 219).** The plan flags T1 as "the most
drift-prone" task and requires QA to reject any hunk outside
`{76-82, 95-101, 117-124, 137-143, 216-238, 400-416, 426-434}`. QA re-derived the hunk list
independently (`git diff --stat` + `grep "^@@"`, t01-qa.md lines 34-57) and confirmed all 8
hunks fall inside those ranges, with Guards 1-2 (lines 40-75) byte-identical to `3faa20c`
(t01-qa.md lines 59-64). No Section B/C/D or FISCAL GATE hunk. This satisfies the
pre-mortem's specific pre-emption, not just AC10/AC11 in isolation.

**AC1-AC6 (plan lines 244-249).** Each is independently re-run by QA, not reused from the
dev's pasted output (t01-qa.md lines 66-149):
- AC1: bare `DELETE FROM pagos;` at line 157, no WHERE/NOT IN — PASS.
- AC2: every `_keep_pago` hit is a `--` comment — PASS (see discrepancy note below).
- AC3: `_keep_cliente` built from `_keep_reserva.cliente_id` alone, C9 rewritten with the
  deliberate-consequence note — PASS.
- AC4: both polymorphic `'pagos'` branches commented with the exact required wording —
  PASS.
- AC5: QA ran the "deepest scrutiny" adversarial check the task brief calls for — grepped
  `v_before\.n_pagos` for 0 hits and read the *original* file's post-condition block
  side-by-side to confirm the old equality check is fully removed, not left alongside the
  new `v_n_pagos <> 0` check (t01-qa.md lines 130-143) — PASS.
- AC6: final report `n_pagos` unchanged, comment added — PASS.

**AC10/AC11 (plan lines 250-251).** Regression greps for destructive DDL/RLS verbs = 0 live
hits (only pre-existing comment prose, unchanged line numbers); single `BEGIN;`/`COMMIT;`,
no `ROLLBACK;`; 0 uncommented `DELETE FROM` against any Section-B table, Section B read in
full and confirmed unchanged (t01-qa.md lines 151-182) — PASS both. The undischarged fiscal
gate is not touched.

**Standing ACs S1-S5 (plan lines 230-235).** All independently confirmed by QA
(t01-qa.md lines 201-231): S1 scope-only diff, S2 `npm run qa` re-run fresh (tsc clean,
eslint 0 errors/28 pre-existing warnings, vitest 825/825, exit 0 — identical shape to dev's
paste), S3 every AC backed by pasted command output, S4 UNVERIFIED labelling correct given
no live DB, S5 rollback note names `3faa20c` as the reference point (independently confirmed
as the correct pre-task blob, 439 lines), no banned verb, no `>` redirection.

**RLS/org isolation.** Zero DDL, zero `CREATE POLICY`/`DROP POLICY`/`DISABLE ROW LEVEL
SECURITY` hits (part of the AC10 grep). Consistent with `decisions/0011-elibry-single-tenant-
for-now` — this file carries no RLS by design; T1 neither adds nor weakens it. No HARD GATE
triggered here.

**Discrepancies QA flagged — reviewed and confirmed non-blocking.** (1) Dev report prose
says "6 hits" for the `_keep_pago` grep where the pasted output (both dev's and QA's) shows
5 lines — a narrative miscount only; every one of the 5 actual hits is comment-only, so AC2
is unaffected. (2) The scratchpad §2 t01 handoff says the deliberate-consequence note is
"restated in C1's replacement comment" when it is actually only cross-referenced from C1 —
AC3 only requires the consequence be stated at C9, which it is; the dev report's own C1-C9
table does not repeat this overclaim. Neither touches the SQL diff, neither fails any AC or
Standing AC, neither is a fake-green-test pattern. I concur with QA's classification: cosmetic,
not a basis for send-back.

**HARD GATES check (CLAUDE.md / anti-agent-theater).** Real diff pasted in full (not
summarized) — met. Real `npm run qa` output pasted, run independently twice (dev + QA) — met.
No files outside declared scope changed (the scratchpad ledger edit is expected
sprint-tracking practice per the plan's own §1/§2 convention, not a source-file scope
violation) — met. No new table, so no RLS gate applies; existing RLS not weakened — met. No
optimistic UI involved — n/a. One-line rollback note present, correct reference point, no
banned verb — met. No AC marked FAIL — met. No auth/payment/destructive-DB-change outside the
plan — this task's destructive change (`DELETE FROM pagos;` unconditional) is exactly what
the plan's §0 brief authorizes ("wipe ALL `pagos` unconditionally"), not an unapproved
addition.

## Verdict

QA verdict line: "Verdict: PASS" (t01-qa.md line 293). All named ACs (AC1-AC6, AC10, AC11)
and all Standing ACs (S1-S5) independently re-verified with pasted, real command output. No
HARD GATE violation. **APPROVE.** T2 may build on this file.
