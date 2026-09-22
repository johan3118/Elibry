# t02 lead decision — Guard 3, three-entity name-assertion guard

Plan read: `docs/plans/db-cleanup-decisions-amend.md` §7 ("The name guard (T2)")
and §11 T2 task block (AC7a-e, AC8, AC10, AC11, S1-S5). Also read scratchpad
§0 brief, §1 ledger (t01 PASS, t02 PASS), §2 t01/t02 handoffs, §3 close queue
(HC-1, HC-2, backlog B-a..e — none touch this task).

## Decision: A — APPROVE

## Verification against the plan's acceptance criteria

- **AC7a** — Guard 3 resolves cliente/producto/suplidor names and
  `RAISE EXCEPTION`s unless all three ILIKE-match. Confirmed in the pasted
  diff (lines 302-392 of the new file) and independently re-checked by QA
  against the live file text, not just dev's claims.
- **AC7b** — Guard 3's `DO $$` at line 102, strictly before the first
  executable `DELETE FROM` at line 268. QA re-ran `rg -n` independently and
  got the same line numbers.
- **AC7c** — name columns self-detected via `information_schema.columns` at
  run time (3 `FOREACH` loops, dynamic `EXECUTE format(...)`), zero hardcoded
  single-column dependency. Matches plan §7's candidate lists exactly
  (`clientes`: nombre_completo/razon_social/nombre_comercial; `productos`:
  nombre_producto/nombre_original; `suplidores`: razon_social/nombre_comercial).
- **AC8** — literals are byte-exact to plan §7
  (`'%JROSA%ASESORA%VIAJES%'`, `'%BAHIA PRINCIPE%EXPLORE%LEGEND%'`,
  `'%OPERAHOTEL%'`), confirmed both in the executable ILIKE lines and header
  comment. QA wrote its own independent substitution argument (own
  counter-entities, not copied from dev) and additionally ran an adversarial
  probe (`COOPERAHOTEL` coincidental-substring case), correctly judged
  not a plausible real entity per AC8's bar, and did not let it pass as a
  finding that overturns PASS — that is exactly the rigor `mistakes/weak-backstop-guard`
  calls for.
- **AC7d** — four distinct, non-collapsing abort states per plan §7 / decision
  0012 (no-candidate-column, name-null-or-empty, no-match, suplidor-id-null),
  confirmed by direct read of all 10 `RAISE EXCEPTION` messages. "MISMATCH"
  appears exactly once, only inside the negating header comment.
- **AC7e** — Guards 1-2 (lines 40-74) byte-identical. QA did not stop at
  trusting the dev's hunk-header pointer: it independently reconstructed the
  pre-t02 file by excising exactly the Guard-3 block from the working tree
  and diffing the remainder against `HEAD` (3faa20c) — byte-identical,
  hunk-for-hunk, to t01's already-approved diff. This is a stronger scope
  proof than the plan requires and rules out any hidden edit.
- **AC10 / AC11** — regression greps re-run in full, 0 executable hits for
  banned DDL/policy ops, file still `BEGIN;`...`COMMIT;`, no `ROLLBACK;`, 0
  uncommented `DELETE` against Section-B/fiscal-gate tables. Undischarged
  fiscal gate untouched.
- **HC-2 (line budget)** — file now 579 lines, past the 500 ceiling. Per
  plan's explicit ruling (splitting a single-transaction file is forbidden,
  `mistakes/confirm-gate-false-commit`), the correct response is to flag, not
  split. Dev flagged it loudly; QA confirmed no split occurred and the flag
  is recorded at scratchpad §3 (HC-2).

## Hard gates (CLAUDE.md)

- Real diff produced: yes, full hunk-level diff pasted (not a summary).
- Tests/typecheck/lint actually run, output pasted: yes, `npm run qa` — tsc
  clean, eslint 0 errors/28 pre-existing warnings, 825/825 tests passing,
  exit 0 — independently re-run by QA with matching output.
- No new table → no RLS question; single-tenant/no-RLS-this-sprint decision
  (`decisions/0011`) respected, confirmed by 0 hits for
  `CREATE POLICY`/`DROP POLICY`/`DISABLE ROW LEVEL SECURITY`.
- No optimistic UI in scope (N/A, correctly marked so by QA).
- Rollback note present, correct reference point (461 lines, start of t02,
  cross-checked against t01-qa.md's own `wc -l`), no banned destructive verb,
  no `>` redirection.
- No acceptance criterion marked FAIL.
- Scope: `git status --porcelain` shows only
  `docs/migracion/02-cleanup-execute.sql` modified; QA's independent
  excision-and-diff test proves no out-of-scope edit hid inside a hunk.

No hard gate is violated. QA verdict PASS is earned, not asserted — evidence
is bounded, commands were independently re-run (not copy-pasted), and QA
went beyond the plan's minimum proof bar on both AC7e (scope) and AC8
(adversarial substring probe) without let either pass as an unrequested
finding or scope creep.

## What shipped (one-line confirmation)

Guard 3 — a preflight three-entity (cliente/producto/suplidor) ILIKE
name-assertion — is inserted into `docs/migracion/02-cleanup-execute.sql` as
a pure addition (lines 76-232, new `DO $$` at 102), strictly before Section 1
and the first `DELETE FROM`, self-detecting name columns at run time and
raising one of four distinguishable abort messages per entity; Guards 1-2 and
all of t01's prior work are untouched.

T3 may proceed on this same file.
