# t03 lead decision — `02`: denormalised-balance disclosure (AC9a-d) + line-budget flag (AC12)

## Decision: A — APPROVE

## What shipped
`docs/migracion/02-cleanup-execute.sql` gains a new SECTION 5 (read-only,
between Section 4's post-condition and the FINAL REPORT) that probes, via
runtime `information_schema.columns` introspection, which of the five
candidate denormalised balance columns (`balance_reserva`, `balance_general`,
`balance_abonado`, `monto_pagado`, `abonado_contabilidad`) exist on
`reservas`, and surfaces their current value + an explicit possibly-stale
warning as five new columns on the file's existing FINAL REPORT result grid.
Zero `UPDATE` statements added. File grew from 579 to 631 lines (over the
500-line ceiling); flagged per HC-2, not split.

## Plan cross-check
Read `docs/plans/db-cleanup-decisions-amend.md` T3 block (lines 269-281), HC-1
(80-90), HC-2 (91-93), §4 (DB/RLS, none), the standing S1-S5 ACs (229-235),
and the scratchpad §0 brief + §1 ledger + t01/t02/t03 handoffs in §2 for the
in-progress state (t01, t02 both already PASSed on the same file).

## Verification of the evidence chain (not a re-run of QA's work)
Spot-checked the live file directly rather than trusting either report's
paste alone:
- `sed`-read lines 555-632 of `docs/migracion/02-cleanup-execute.sql` —
  byte-for-byte matches both the dev report's pasted diff and the QA report's
  `sed -n '555,640p'` quote. SECTION 5 sits exactly where the plan requires:
  after Section 4's `END $$;` and before the FINAL REPORT header.
- `rg -n "^\s*UPDATE " docs/migracion/02-cleanup-execute.sql` → 0 hits
  (independently re-run by me; matches AC9a).
- Confirmed file is exactly 631 lines and line 631 is `COMMIT;` (matches
  `wc -l` claim in both reports and the single-transaction invariant — no
  `ROLLBACK;`, still one `BEGIN;`/one `COMMIT;`).
- Confirmed the disclosure lands as five real subquery columns
  (`*_disclosure`) on the FINAL REPORT's `SELECT`, not inside any
  `RAISE NOTICE` — satisfies AC9c and the sprint brief's hard constraint
  that NOTICE-only would be invisible in the Supabase SQL editor
  (`02:606-608` states this explicitly, matching the file's own pre-existing
  rationale at the top of the FINAL REPORT section).
- Confirmed column detection is genuine runtime introspection
  (`FOREACH v_col IN ARRAY v_cols LOOP` guarded by
  `IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema =
  'public' AND table_name = 'reservas' AND column_name = v_col)`), not a
  hardcoded assumption — satisfies the sprint brief's runtime-detection
  constraint and matches Guard 3's (T2, already-PASSed) exact convention.
- Confirmed AC9d's inline reasoning (lines 559-581) cites all three HC-1
  points: the `scripts/027` vs `scripts/030` contradiction, the unreachable
  live schema, and `app/reservas/ver/[id]/page.tsx:196-215`'s read-time
  recompute. QA additionally cross-checked that citation against the real
  app file (not fabricated) — I consider this sufficient corroboration and
  did not re-read the app file myself.
- AC10/AC11 regression: independently confirmed 0 uncommented Section-B
  `DELETE`, Guard 3 (line 77) still precedes the first `DELETE FROM` (line
  268), and `_keep_pago` still shows only its 5 pre-existing comment-only
  hits from t01/t02 — unchanged by T3.

## Against the sprint brief's hard-ruled constraints
- **Zero UPDATE statements ever** — confirmed 0 hits by both the dev, QA,
  and my own independent grep, plus QA's broader case-insensitive
  covert-write sweep (dynamic `EXECUTE`/`format` calls, `SET`-clause search)
  found no disguised write. Satisfied.
- **Disclosure must reach the FINAL REPORT result grid, not RAISE
  NOTICE-only** — confirmed: the five `*_disclosure` columns are real
  `SELECT` subqueries on the file's one existing result grid. Satisfied.
- **Runtime `information_schema` detection, not hardcoded** — confirmed:
  candidate columns are looped and checked via `information_schema.columns`
  at run time; nothing is assumed to exist. Satisfied.
- **No file split despite being over the 500-line ceiling — flag only** —
  confirmed: dev report carries an explicit `**FLAG: refactor signal,
  .claude/rules/file-size.md**` citing the 631-line count and the HC-2
  rationale (splitting a single `BEGIN;…COMMIT;` would create a second
  commit trigger, `mistakes/confirm-gate-false-commit`); the file was not
  split (single `BEGIN;`/`COMMIT;` confirmed at lines 33/631). Satisfied.

## HARD GATES (CLAUDE.md)
- Real diff pasted (two hunks, in full) — yes.
- `npm run qa` actually run with output shown, by both dev and QA
  independently, identical shape to t01/t02's already-PASSed baseline
  (tsc clean, eslint 0 errors/28 pre-existing warnings, 30 files/825 tests) —
  yes.
- No files outside declared scope — `git status --porcelain` shows only
  `docs/migracion/02-cleanup-execute.sql` modified; the two `??` untracked
  entries (the plan amendment doc, `docs/sprints/`) pre-date this task and
  were already present in t01/t02's PASSed reports — yes.
- New table without RLS — the only new "table" is `_balance_disclosure`, a
  `CREATE TEMP TABLE ... ON COMMIT DROP` that dies with the transaction and
  is never queryable outside this one run. Per the plan's §4 ruling, temp
  tables inside `02`'s own transaction are not schema and are explicitly out
  of RLS scope (same precedent already applied to t01/t02's own temp
  tables and to this ADR: `decisions/0011-elibry-single-tenant-for-now`).
  Not a gate violation.
- Existing RLS weakened/bypassed — no RLS-related statement touched
  (confirmed via AC10 regression grep: 0 hits for `CREATE POLICY`,
  `DROP POLICY`, `DISABLE ROW LEVEL SECURITY`).
- Rollback note present — one line, correct reference point (post-t02,
  579-line state), no banned destructive git verb, no `>` redirection.
- Acceptance criteria — none marked FAIL; AC9a-d, AC12, AC10, AC11 all PASS
  per both reports and my spot checks.
- Out-of-scope files — none.

No HARD GATE is triggered. QA's verdict (PASS) is internally consistent with
its own pasted evidence, and my independent spot-checks reproduce the same
facts (0 UPDATE hits, 631 lines, disclosure in the result grid, runtime
introspection, FLAG present, no split, AC10/AC11 clean).

## Confirmation of what shipped
`02-cleanup-execute.sql` now discloses (read-only, via runtime schema
introspection) which denormalised balance columns exist on `reservas` and
their current value for the kept reserva, with an explicit staleness
warning, surfaced in the script's one result grid — zero mutations added,
and the file's 500-line overage (631 lines) is flagged per HC-2, not
silently split.

Verdict: **A — APPROVE.** T4 may proceed (depends on T1, already approved;
independent of T3).
