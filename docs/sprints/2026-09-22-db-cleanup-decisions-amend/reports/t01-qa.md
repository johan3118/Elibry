# T1 QA report — `02`: unconditional `pagos` wipe + migrate all nine `_keep_pago` consumers

Reviewer: QA (independent, adversarial). Dev report reviewed: `reports/t01-dev.md`.
Every command below was RE-RUN by QA against the current working tree — none of the dev's
pasted output was reused as evidence.

## Commands run (verbatim, real output)

```
$ git log --oneline -5
3faa20c fix
3b551fe fixes
63f468c T9: document the placeholder-company-data → settings path (B-24)
f1ee46f T8b: derive status badge from the rounded balance (fixes PARCIAL vs RD$0.00 divergence)
b411d49 T8: PaymentReceipt gains company header + real attribution (item 4b)

$ git status --porcelain
 M docs/migracion/02-cleanup-execute.sql
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/

$ wc -l docs/migracion/02-cleanup-execute.sql
     461 docs/migracion/02-cleanup-execute.sql
```
HEAD is `3faa20c`, matching the scratchpad §0 claim that the sprint opened at that commit
with a clean tree. Since t01 is the sprint's first task, "the file's state at the start of
the task" == the blob at `3faa20c`, confirmed identical (`git show 3faa20c:...sql | wc -l` →
439, matching the dev report and the plan's "439 lines at open" note). Only the one in-scope
file is modified; the two `??` entries are the sprint's own plan/scratchpad scaffolding
(pre-existing per this conversation's own git-status snapshot at session start), not a
scope violation.

```
$ git diff --stat -- docs/
 docs/migracion/02-cleanup-execute.sql | 56 ++++++++++++++++++++++++-----------
 1 file changed, 39 insertions(+), 17 deletions(-)

$ git diff -- docs/migracion/02-cleanup-execute.sql | grep "^@@"
@@ -75,11 +75,21 @@ END $$;
@@ -92,13 +102,12 @@ CREATE TEMP TABLE _keep_suplidor ON COMMIT DROP AS
@@ -121,7 +130,11 @@ SELECT
@@ -139,8 +152,9 @@ DELETE FROM seguimiento_casos;
@@ -219,7 +233,8 @@ WHERE NOT (
@@ -231,7 +246,8 @@ WHERE NOT (
@@ -411,8 +427,11 @@ BEGIN
@@ -430,6 +449,9 @@ SELECT
```
8 hunks total, matching the dev report's own count. All 8 fall inside the KEEP-set block
(old lines 76-143: SECTION 1 header, `_keep_pago`, `_keep_cliente`, `_before_snapshot`,
Step 3's `DELETE FROM pagos`), the two polymorphic-branch `WHERE NOT (...)` lists (old
216-238 territory — verified against the original file's content at those exact line
numbers, both are `cambios_provisionales`/`acciones_pendientes` OR-lists), the post-condition
`DO $$ ... BEGIN` block (old ~411-418), and the final report `SELECT` grid (old ~430-435).
Read the original file directly (not trusted from line numbers alone) to confirm none of
these hunks is near Section B (`comprobantes_disponibles` etc., original ~296-325), Section
C (sequence sync, ~328-350), Section D (~353-364), or the FISCAL GATE block (~182-209) —
confirmed clean, none of those blocks appear in any hunk's context lines.

```
$ sed -n '40,75p' docs/migracion/02-cleanup-execute.sql | diff - <(git show 3faa20c:docs/migracion/02-cleanup-execute.sql | sed -n '40,75p')
GUARDS 1-2 UNCHANGED (lines 40-75 identical)
```
Guard 1 and Guard 2 (the file's first two safety checks, out of T1's scope) are byte-identical
to the pre-task version.

### AC1 — bare `DELETE FROM pagos`
```
$ rg -n "DELETE FROM pagos" docs/migracion/02-cleanup-execute.sql
157:DELETE FROM pagos;
453:  -- 3's unconditional `DELETE FROM pagos;`, so no pago row can exist here
```
Line 157 read directly in context (full file dump, line 153-157): no `WHERE`, no `NOT IN`,
no keep-set reference. Bare and unconditional. **PASS.**

### AC2 — every remaining `_keep_pago` hit is comment-only
```
$ rg -n "_keep_pago" docs/migracion/02-cleanup-execute.sql
89:-- `_keep_pago`, so that client survived even though it was not the kept
105:-- _keep_pago temp table REMOVED (db-cleanup-decisions-amend, T1): `pagos` has
136:  -- `pagos` (the removed `_keep_pago` temp table no longer exists).
237:  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
250:  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
```
6 raw string hits — wait, actual re-grep gives 5 hits, not 6 as the dev report claims (dev
report's own pasted output also shows 5 lines, but its prose says "6 hits" — this is a minor
internal miscount in the dev report's prose, harmless since every one of the 5 actual hits
*is* inside a `--` comment, verified by reading each line in the full-file dump above (89,
105, 136 are prose; 237, 250 are commented-out SQL branches). Zero executable references.
**AC2: PASS** (with the miscounted "6 hits" prose flagged as a discrepancy, not a functional
bug — see Discrepancies section).

### AC3 — `_keep_cliente` rebuilt from `_keep_reserva.cliente_id` alone; C9 rewritten
```
$ rg -n -A4 "CREATE TEMP TABLE _keep_cliente" docs/migracion/02-cleanup-execute.sql
109:CREATE TEMP TABLE _keep_cliente ON COMMIT DROP AS
110-  SELECT cliente_id AS id FROM _keep_reserva WHERE cliente_id IS NOT NULL;
111-
112-CREATE TEMP TABLE _keep_detalle ON COMMIT DROP AS
113-  SELECT id FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva);
```
No `pagos`/`_keep_pago` term, no UNION. Read the full Section-1 header comment (new lines
76-93): the old "`_keep_cliente` reads `pagos`" rationale is gone, replaced with an
AMENDMENT block that states the deliberate consequence (a `pagos.cliente_id` divergent from
`reservas.cliente_id` is no longer protected). **PASS.**

### AC4 — both polymorphic `'pagos'` branches commented out, exact words present
```
$ rg -n "tabla_afectada = 'pagos'|tabla_objetivo = 'pagos'" docs/migracion/02-cleanup-execute.sql
237:  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
250:  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
```
Both are `-- OR` (commented), each preceded on the line above by "always false — no pago row
ever survives the full wipe" (new lines 236, 249, read directly). **PASS.**

### AC5 — `_before_snapshot` count repurposed + post-condition strictly stronger
```
$ rg -n "v_n_pagos|n_pagos" docs/migracion/02-cleanup-execute.sql
137:  (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos_a_destruir;
384:  v_n_pagos integer;
419:  SELECT count(*) INTO v_n_pagos      FROM pagos               WHERE reserva_id = v_id;
433:  IF v_n_pagos <> 0 THEN
434:    RAISE EXCEPTION 'POST-CHECK FAILED: expected 0 pagos rows for kept reserva after the unconditional wipe, found %. Aborting, nothing will be committed.', v_n_pagos;
438:    v_id, v_cliente_id, v_producto_id, v_n_detalles, v_n_pasajeros, v_n_ocupaciones, v_n_pagos;
452:  -- n_pagos is 0 by construction (AMENDMENT T1): this SELECT runs after Step
455:  (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos,
```
`_before_snapshot`'s field is `n_pagos_a_destruir` (line 137), sourced directly from `pagos
WHERE reserva_id IN (...)` — matches the plan's C3 requirement exactly.

**Adversarial check, specifically requested:** searched for the old comparison surviving
*alongside* the new one:
```
$ rg -n "v_before\.n_pagos" docs/migracion/02-cleanup-execute.sql
(no output — 0 hits, exit 1)
```
Confirmed with a full read of the original file's post-condition block
(`git show 3faa20c:...sql | sed -n '400,420p'`) — the old file had
`IF v_n_pagos <> v_before.n_pagos THEN RAISE EXCEPTION 'POST-CHECK FAILED: pagos count for
kept reserva changed from % to %. Aborting.', v_before.n_pagos, v_n_pagos; END IF;`.
That exact line and its `v_before.n_pagos` references are **entirely gone**, not left in
alongside the new check — the new sole check is `IF v_n_pagos <> 0 THEN ...`. This is the
one AC the task brief called out as needing the deepest scrutiny; it holds up.
**AC5: PASS.**

### AC6 — final report `n_pagos` unchanged + comment
Read directly (new lines 449-455): the sub-select is byte-identical to the original
(`(SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS
n_pagos`), with a 3-line comment above it stating it is 0 by construction because it runs
after Step 3's wipe. **PASS.**

### AC10 — regression: no destructive DDL / RLS verbs, transaction shape intact
```
$ rg -n "TRUNCATE|DROP TABLE|DROP VIEW|DROP POLICY|session_replication_role|RESTART WITH|CREATE POLICY|DISABLE ROW LEVEL SECURITY" docs/migracion/02-cleanup-execute.sql
24:--   - SET session_replication_role = replica;  (056:8 — disables FK/trigger
26:--   - ALTER SEQUENCE ... RESTART WITH ...       (056:91-141 — fatal here because
29:--   - TRUNCATE, DROP TABLE, DROP VIEW, DROP POLICY, ALTER ... DISABLE ROW LEVEL
30:--     SECURITY, CREATE POLICY
148:-- set is genuinely empty (plan §4) -> bare DELETE FROM, chosen over TRUNCATE
206:    RAISE NOTICE 'comprobantes_fiscales does not exist (matches 039:2 DROP TABLE ... CASCADE) — nothing to do.';
260:-- keep set -> bare DELETE, chosen over TRUNCATE to stay in this transaction.
330:-- Rows survive in most tables, so ALTER SEQUENCE ... RESTART WITH 1 (the
347:-- permitted form here — never RESTART WITH 1, since another future run of this
```
All 8 hits are pre-existing comment/NOTICE-string prose (unchanged by this diff — none of
these line numbers appear in any hunk above), zero live statements. **PASS.**
```
$ head -1 docs/migracion/02-cleanup-execute.sql
-- =============================================================================
$ rg -n "^BEGIN;|^COMMIT;|^ROLLBACK;" docs/migracion/02-cleanup-execute.sql
33:BEGIN;
461:COMMIT;
```
Single `BEGIN;`/`COMMIT;` pair, no `ROLLBACK;` anywhere. **AC10: PASS.**

### AC11 — 0 uncommented `DELETE FROM` against Section-B tables
```
$ rg -n "^\s*DELETE FROM (usuarios|usuarios_sistema|colaboradores|datos_maestros|parametros_sistema|tipos_productos|configuracion_empresa|permisos_roles|comprobantes_disponibles)" docs/migracion/02-cleanup-execute.sql
(no output — 0 hits)
```
**PASS.** Additionally, read Section B in full (new lines 296-325): every statement is still
prefixed `-- DELETE FROM ...`, unchanged from the original — the undischarged fiscal gate is
untouched.

### §0.1 nine-consumer-site inventory — verified row by row against the CURRENT file (not grep hit counts alone)

| # | Site | Verified against current file | Verdict |
|---|---|---|---|
| C1 | `CREATE TEMP TABLE _keep_pago` | Removed at old line 95-96; replaced by comment at new 105-107. | PASS |
| C2 | `_keep_cliente` UNION branch | Now single `SELECT ... FROM _keep_reserva`, no UNION, no `_keep_pago` (new 109-110). | PASS |
| C3 | `_before_snapshot.n_pagos` | Renamed `n_pagos_a_destruir`, sourced directly from `pagos` (new 137). | PASS |
| C4 | `DELETE FROM pagos WHERE id NOT IN (...)` | Now bare `DELETE FROM pagos;` (new 157). | PASS |
| C5 | `cambios_provisionales` `'pagos'` branch | Commented, "always false" wording present (new 236-237). | PASS |
| C6 | `acciones_pendientes` `'pagos'` branch | Commented, "always false" wording present (new 249-250). | PASS |
| C7 | post-condition equality check (non-literal) | `v_before.n_pagos` comparison **fully removed** (confirmed via direct grep, 0 hits); replaced with `IF v_n_pagos <> 0` (new 433). | PASS |
| C8 | final report `n_pagos` sub-select (non-literal) | Unchanged SQL, comment added stating 0-by-construction (new 449-455). | PASS |
| C9 | Section-1 header comment (non-literal, prose) | Old "`_keep_cliente` reads `pagos`" framing removed; AMENDMENT block states the deliberate consequence (new 76-93). No lingering "before vs after" framing anywhere in the file for `pagos`. | PASS |

All nine conceptual consumers (6 literal + 3 non-literal, matching the plan's own
§0.1 breakdown) are migrated. No site is left asserting a payment survives.

### Standing ACs (S1-S5)

```
$ npm run qa   (run independently by QA, NOT reusing the dev's pasted output)
> tsc --noEmit                          → no output (clean)
> eslint .                              → 28 problems (0 errors, 28 warnings), all pre-existing
                                            react-hooks/exhaustive-deps + @next/next/no-img-element
                                            warnings in files this task never touched
> vitest run                            → Test Files 30 passed (30) / Tests 825 passed (825)
Exit code: 0
```
Identical shape to the dev's pasted output (same 0 errors/28 warnings, same 30/825 test
counts). Since this task's scope is a single `docs/` SQL file with zero `app/`/`lib/`/
`components/`/`tests/`/config files touched, this **is** effectively the sprint baseline.
**S2: PASS.**

- **S1** `git status --porcelain` → only `docs/migracion/02-cleanup-execute.sql` modified. **PASS.**
- **S3** Every AC above is backed by a pasted, independently-run command. **PASS.**
- **S4** Dev report's "UNVERIFIED runtime claims" section correctly labels every runtime
  claim (e.g. "all pagos rows are deleted") as literally UNVERIFIED, since no live DB exists
  to execute against. **PASS.**
- **S5** Rollback note: *"The file's state at the START of this task ... is the current
  committed HEAD version at commit 3faa20c ... restore that blob's content into
  docs/migracion/02-cleanup-execute.sql to undo this task."* No `git checkout <ref> --`, no
  `reset --hard`, no `clean -fd`, no `stash drop`, no `>` redirection anywhere in the note.
  Reference point (3faa20c) independently confirmed correct: t01 is the sprint's first task
  and `3faa20c` is HEAD with the pre-edit 439-line blob (`git show 3faa20c:...sql | wc -l` →
  439). **PASS.**
- **DB/RLS/org isolation** — zero DDL, zero `CREATE POLICY`/`DROP POLICY`/`DISABLE ROW LEVEL
  SECURITY` (see AC10 grep). This file carries no RLS by design (`decisions/
  0011-elibry-single-tenant-for-now`); T1 neither adds nor weakens it. **PASS.**

## AC-by-AC table

| AC | Description | Verdict |
|---|---|---|
| AC1 | Bare unconditional `DELETE FROM pagos` | PASS |
| AC2 | Every remaining `_keep_pago` hit is comment-only | PASS |
| AC3 | `_keep_cliente` rebuilt from `_keep_reserva.cliente_id` alone; C9 rewritten with deliberate-consequence note | PASS |
| AC4 | Both polymorphic `'pagos'` branches commented, exact "always false" wording | PASS |
| AC5 | `_before_snapshot` count repurposed + sourced directly; post-condition is `v_n_pagos <> 0` only, old equality check fully removed | PASS |
| AC6 | Final report `n_pagos` unchanged, comment added (0 by construction) | PASS |
| AC10 | Regression: no TRUNCATE/DROP/RLS-disable/CREATE POLICY; single BEGIN/COMMIT, no ROLLBACK | PASS |
| AC11 | 0 uncommented DELETE against Section-B tables | PASS |
| S1 | `git status --porcelain` scoped to declared file only | PASS |
| S2 | `npm run qa` actually run, output matches baseline shape | PASS |
| S3 | Every AC backed by pasted command output | PASS |
| S4 | Runtime claims labelled UNVERIFIED | PASS |
| S5 | Rollback note: correct reference point, no banned verb, no `>` redirection | PASS |

## Discrepancies with the dev's claims (minor, non-blocking)

1. **Miscounted grep hit count in prose.** The dev report's prose says `rg -n "_keep_pago"`
   gives "6 hits" but the pasted command output (both the dev's own and QA's independent
   re-run) shows exactly **5** lines. This does not affect AC2's actual pass condition (every
   hit, whether 5 or 6, is comment-only) — it is a copy-paste/counting slip in the narrative,
   not in the evidence itself. Flagged per this sprint's zero-paraphrase discipline
   (`decisions/0014-bounded-evidence-rule`).
2. **Scratchpad §2 handoff overclaims a restatement.** The scratchpad's t01 handoff says the
   deliberate consequence is "stated inline at C9 AND restated in C1's replacement comment."
   Reading C1's actual replacement comment (new lines 105-107), it only cross-references
   ("See the Section 1 header comment above for the deliberate behaviour consequence") — it
   does not restate the consequence text itself. AC3's actual wording only requires the
   consequence be stated at C9, which it is, so this does not fail any AC — it is an
   over-description in the handoff note, not in the dev report proper (the dev report's own
   C1-C9 mapping table does not repeat this overclaim).

Neither discrepancy is a fake-green-test pattern (no test was touched by this task; a mutation
check does not apply to a pure SQL/comment diff with no executable assertions this repo's
suite runs against). Neither is blocking.

## Out-of-scope changes

None in the SQL file. `docs/sprints/2026-09-22-db-cleanup-decisions-amend/scratchpad.md`
(ledger row + §2 handoff) was also touched by the dev, which is expected sprint-tracking
practice explicitly called out in the dev report, not a scope violation of the "files in
scope: `docs/migracion/02-cleanup-execute.sql` (only)" declaration for the *SQL change
itself*.

## Bugs found

None. All nine C1-C9 sites are correctly migrated; the strengthened post-condition genuinely
supersedes (not supplements) the old before/after equality check; no forbidden section
(Section B/C/D, FISCAL GATE, Guards 1-2) was touched.

## Suggested fixes

None blocking. Optional/cosmetic for the dev to note in a future pass (not this diff, per
`mistakes/unrequested-hardening-regression`): correct the "6 hits" → "5 hits" miscount in the
dev report prose, and tighten the scratchpad §2 handoff's "restated in C1" claim to "cross-
referenced from C1" to match what the diff actually does.

Verdict: PASS
