# t03 dev report — `02`: denormalised-balance disclosure (AC9) + line-budget flag (AC12)

## Files changed

- `docs/migracion/02-cleanup-execute.sql` (only)

## What was built

Implemented HC-1 branch (b) — disclosure, not repair — as a new **SECTION 5**
inserted between the Section 4 post-condition `DO $$` block and the FINAL
REPORT, plus five new columns appended to the existing FINAL REPORT `SELECT`.

1. A read-only `information_schema.columns` probe (runtime self-detection,
   matching Guard 3's exact pattern) checks, per candidate, whether it exists
   on `reservas`: `balance_reserva`, `balance_general`, `balance_abonado`,
   `monto_pagado`, `abonado_contabilidad`.
2. Results land in a new `_balance_disclosure` temp table (`ON COMMIT DROP`,
   dies with the transaction like every other temp table in this file):
   `(balance_column text, note text)`.
   - **Absent** → `'ABSENT from this schema at run time -- nothing to
     disclose.'`
   - **Present** → `'PRESENT, current value = <X> -- POSSIBLY STALE: pagos
     was unconditionally wiped above (Step 3) and this column was NOT
     recomputed here (disclosure only, HC-1 branch b); verify by hand or
     trust the app's read-time recompute (app/reservas/ver/[id]/page.tsx:
     196-215, lib/finance.ts).'`
   These two message shapes never collapse into one generic string — absent
   vs. present-with-value are always distinguishable, and any present value
   is explicitly flagged possibly-stale.
3. The FINAL REPORT `SELECT` (the file's one existing result grid) gains five
   new columns — `balance_reserva_disclosure`, `balance_general_disclosure`,
   `balance_abonado_disclosure`, `monto_pagado_disclosure`,
   `abonado_contabilidad_disclosure` — each a subquery against
   `_balance_disclosure`. This is a genuine queryable result-grid row, not a
   `RAISE NOTICE`, per AC9c (the file's own header already says NOTICE isn't
   reliably surfaced by the Supabase SQL editor).
4. AC9d — the branch-(b)-over-(a) reasoning is documented inline in SECTION
   5's header comment: `scripts/027:53` vs `scripts/030:35` define
   `balance_reserva` contradictorily; the live schema is unreachable this
   sprint (no DB to introspect); and `app/reservas/ver/[id]/page.tsx:196-215`
   already recomputes these columns from live `pagos` via `lib/finance.ts`
   before rendering, so the operator-facing read path self-heals.

**Zero `UPDATE` statements were added.** No balance column is written to
anywhere in the file — verified below.

## Real diff (both hunks, in full)

```diff
@@ -411,17 +545,67 @@ BEGIN
   IF v_n_ocupaciones <> v_before.n_ocupaciones THEN
     RAISE EXCEPTION 'POST-CHECK FAILED: reserva_ocupaciones count for kept reserva changed from % to %. Aborting.', v_before.n_ocupaciones, v_n_ocupaciones;
   END IF;
-  IF v_n_pagos <> v_before.n_pagos THEN
-    RAISE EXCEPTION 'POST-CHECK FAILED: pagos count for kept reserva changed from % to %. Aborting.', v_before.n_pagos, v_n_pagos;
+  -- AMENDMENT (T1): strictly stronger than the old "before vs after equality"
+  -- check — pagos has no keep set, so the ONLY correct count after the
+  -- unconditional wipe is exactly 0, for every reserva including this one.
+  IF v_n_pagos <> 0 THEN
+    RAISE EXCEPTION 'POST-CHECK FAILED: expected 0 pagos rows for kept reserva after the unconditional wipe, found %. Aborting, nothing will be committed.', v_n_pagos;
   END IF;
 
   RAISE NOTICE 'All post-condition assertions passed. reserva RES-1787875561067 (id=%) is intact: cliente_id=%, producto_id=%, detalles=%, pasajeros=%, ocupaciones=%, pagos=%.',
     v_id, v_cliente_id, v_producto_id, v_n_detalles, v_n_pasajeros, v_n_ocupaciones, v_n_pagos;
 END $$;
 
+-- =============================================================================
+-- SECTION 5 — BALANCE DISCLOSURE (db-cleanup-decisions-amend, T3). READ-ONLY —
+-- zero UPDATE statements anywhere in this file, on purpose. HC-1 branch (b)
+-- chosen over branch (a) [recompute the denormalised balance columns]: (1)
+-- scripts/027:53 sets balance_reserva = precio_total - abonado_contabilidad
+-- while scripts/030:35 sets balance_reserva = precio_total and puts the
+-- payment-derived figure in balance_general instead — the repo contradicts
+-- itself, and scripts/*.sql is not evidence of live semantics anyway
+-- (mistakes/schema-source-of-truth); (2) the live schema is unreachable this
+-- sprint (briefing: DNS + REST both down), so there is nothing to introspect
+-- to settle it; (3) app/reservas/ver/[id]/page.tsx:196-215 already recomputes
+-- balance_reserva/balance_general/balance_abonado in memory from live `pagos`
+-- via lib/finance.ts before rendering, so the operator-facing screen already
+-- self-heals without this script writing to a single money column.
+-- Candidate columns are detected at run time via information_schema.columns,
+-- never hardcoded (mistakes/schema-source-of-truth): balance_reserva,
+-- balance_general, balance_abonado, monto_pagado, abonado_contabilidad
+-- (scripts/007:34-36, 026:53-54 — corroboration only, not proof). "Absent"
+-- and "present, value = X" are reported as distinct, non-collapsed states
+-- (decisions/0012-elibry-confirmacion-without-factura-numero); any present
+-- value is flagged possibly stale because Step 3 above already deleted every
+-- `pagos` row unconditionally.
+-- =============================================================================
+CREATE TEMP TABLE _balance_disclosure (balance_column text, note text) ON COMMIT DROP;
+
+DO $$
+DECLARE
+  v_col  text;
+  v_id   integer;
+  v_val  text;
+  v_cols text[] := ARRAY['balance_reserva','balance_general','balance_abonado','monto_pagado','abonado_contabilidad'];
+BEGIN
+  SELECT id INTO v_id FROM _keep_reserva;
+  FOREACH v_col IN ARRAY v_cols LOOP
+    IF EXISTS (
+      SELECT 1 FROM information_schema.columns
+      WHERE table_schema = 'public' AND table_name = 'reservas' AND column_name = v_col
+    ) THEN
+      EXECUTE format('SELECT %I::text FROM reservas WHERE id = $1', v_col) INTO v_val USING v_id;
+      INSERT INTO _balance_disclosure VALUES (v_col, format('PRESENT, current value = %s -- POSSIBLY STALE: pagos was unconditionally wiped above (Step 3) and this column was NOT recomputed here (disclosure only, HC-1 branch b); verify by hand or trust the app''s read-time recompute (app/reservas/ver/[id]/page.tsx:196-215, lib/finance.ts).', COALESCE(v_val, 'NULL')));
+    ELSE
+      INSERT INTO _balance_disclosure VALUES (v_col, 'ABSENT from this schema at run time -- nothing to disclose.');
+    END IF;
+  END LOOP;
+END $$;
+
 -- =============================================================================
 -- FINAL REPORT — one result grid, because RAISE NOTICE is not reliably
--- surfaced by the Supabase SQL editor.
+-- surfaced by the Supabase SQL editor. Balance disclosure columns (SECTION 5)
+-- are appended here so they reach the operator the same way, not NOTICE-only.
 -- =============================================================================
 SELECT
   'RES-1787875561067' AS reserva_kept,
@@ -430,7 +614,15 @@ SELECT
   (SELECT producto_id FROM reservas WHERE codigo = 'RES-1787875561067') AS producto_id,
   (SELECT count(*) FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_detalles,
   (SELECT count(*) FROM reserva_pasajeros WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pasajeros,
+  -- n_pagos is 0 by construction (AMENDMENT T1): this SELECT runs after Step
+  -- 3's unconditional `DELETE FROM pagos;`, so no pago row can exist here
+  -- regardless of reserva_id.
   (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos,
+  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_reserva') AS balance_reserva_disclosure,
+  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_general') AS balance_general_disclosure,
+  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_abonado') AS balance_abonado_disclosure,
+  (SELECT note FROM _balance_disclosure WHERE balance_column = 'monto_pagado') AS monto_pagado_disclosure,
+  (SELECT note FROM _balance_disclosure WHERE balance_column = 'abonado_contabilidad') AS abonado_contabilidad_disclosure,
   current_user, session_user, current_database();
 
 -- =============================================================================
```

(Everything above old-line 411 in `git diff`'s output — 6 earlier hunks — is
t01's and t02's already-PASSed work; unchanged by me. Confirmed by
construction: this task used exactly two `Edit` calls with narrow,
non-overlapping `old_string` matches, both anchored inside/after Section 4's
post-condition block. Full `git diff --stat`: `1 file changed, 210
insertions(+), 18 deletions(-)` cumulative since `HEAD` (3faa20c) across
t01+t02+t03; my two hunks above are the only ones this task touched.)

## Evidence

### `rg -n "^\s*UPDATE " docs/migracion/02-cleanup-execute.sql` (AC9a — must be 0 hits)

```
(no output, rg exit code 1 = no matches)
```

### `rg -n "balance|stale" docs/migracion/02-cleanup-execute.sql` (AC9 — disclosure present)

```
562:-- chosen over branch (a) [recompute the denormalised balance columns]: (1)
563:-- scripts/027:53 sets balance_reserva = precio_total - abonado_contabilidad
564:-- while scripts/030:35 sets balance_reserva = precio_total and puts the
565:-- payment-derived figure in balance_general instead — the repo contradicts
570:-- balance_reserva/balance_general/balance_abonado in memory from live `pagos`
574:-- never hardcoded (mistakes/schema-source-of-truth): balance_reserva,
575:-- balance_general, balance_abonado, monto_pagado, abonado_contabilidad
579:-- value is flagged possibly stale because Step 3 above already deleted every
582:CREATE TEMP TABLE _balance_disclosure (balance_column text, note text) ON COMMIT DROP;
589:  v_cols text[] := ARRAY['balance_reserva','balance_general','balance_abonado','monto_pagado','abonado_contabilidad'];
598:      INSERT INTO _balance_disclosure VALUES (v_col, format('PRESENT, current value = %s -- POSSIBLY STALE: pagos was unconditionally wiped above (Step 3) and this column was NOT recomputed here (disclosure only, HC-1 branch b); verify by hand or trust the app''s read-time recompute (app/reservas/ver/[id]/page.tsx:196-215, lib/finance.ts).', COALESCE(v_val, 'NULL')));
600:      INSERT INTO _balance_disclosure VALUES (v_col, 'ABSENT from this schema at run time -- nothing to disclose.');
621:  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_reserva') AS balance_reserva_disclosure,
622:  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_general') AS balance_general_disclosure,
623:  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_abonado') AS balance_abonado_disclosure,
624:  (SELECT note FROM _balance_disclosure WHERE balance_column = 'monto_pagado') AS monto_pagado_disclosure,
625:  (SELECT note FROM _balance_disclosure WHERE balance_column = 'abonado_contabilidad') AS abonado_contabilidad_disclosure,
```

### `wc -l docs/migracion/02-cleanup-execute.sql` (AC12)

```
631 docs/migracion/02-cleanup-execute.sql
```

**FLAG: refactor signal, `.claude/rules/file-size.md`.** File is now 631
lines (was 579 at the start of this task, already past the 500-line ceiling
before T3 even began, per HC-2's own prediction). Per the plan's explicit
HC-2 ruling and the scratchpad's standing instruction, this is flagged, not
split — splitting this file's single `BEGIN;…COMMIT;` would create a second
commit trigger, which is `mistakes/confirm-gate-false-commit`. Scratchpad §3
already carries the HC-2 backlog line from t02; not duplicating it, just
reaffirming the number here as required.

### AC10 + AC11 regression (re-run in full, post-T3)

```
$ rg -n "TRUNCATE|DROP TABLE|DROP VIEW|DROP POLICY|session_replication_role|RESTART WITH|CREATE POLICY|DISABLE ROW LEVEL SECURITY" docs/migracion/02-cleanup-execute.sql
24:--   - SET session_replication_role = replica;  (056:8 — disables FK/trigger
26:--   - ALTER SEQUENCE ... RESTART WITH ...       (056:91-141 — fatal here because
29:--   - TRUNCATE, DROP TABLE, DROP VIEW, DROP POLICY, ALTER ... DISABLE ROW LEVEL
30:--     SECURITY, CREATE POLICY
266:-- set is genuinely empty (plan §4) -> bare DELETE FROM, chosen over TRUNCATE
324:    RAISE NOTICE 'comprobantes_fiscales does not exist (matches 039:2 DROP TABLE ... CASCADE) — nothing to do.';
378:-- keep set -> bare DELETE, chosen over TRUNCATE to stay in this transaction.
448:-- Rows survive in most tables, so ALTER SEQUENCE ... RESTART WITH 1 (the
465:-- permitted form here — never RESTART WITH 1, since another future run of this
```
All 9 hits are comments (identical set to t02's baseline — I added nothing here).

```
$ head -1 docs/migracion/02-cleanup-execute.sql
-- =============================================================================
$ rg -n "^BEGIN;|^COMMIT;|^ROLLBACK;" docs/migracion/02-cleanup-execute.sql
33:BEGIN;
631:COMMIT;
```
One `BEGIN;`, one `COMMIT;` (now at line 631, shifted by my addition), no `ROLLBACK;`. Still one transaction, one commit trigger.

```
$ rg -n "^\s*DELETE FROM (usuarios|usuarios_sistema|colaboradores|datos_maestros|parametros_sistema|tipos_productos|configuracion_empresa|permisos_roles|comprobantes_disponibles)" docs/migracion/02-cleanup-execute.sql
(no output — 0 hits)
```
Section B still fully commented; untouched by this task.

```
$ rg -n "_keep_pago" docs/migracion/02-cleanup-execute.sql
207:-- `_keep_pago`, so that client survived even though it was not the kept
223:-- _keep_pago temp table REMOVED (db-cleanup-decisions-amend, T1): `pagos` has
254:  -- `pagos` (the removed `_keep_pago` temp table no longer exists).
355:  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
368:  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
```
5 hits, all comment-only, all still in place — unchanged from t02's already-PASSed state.

```
$ rg -n "GUARD 3" docs/migracion/02-cleanup-execute.sql | head -1
77:-- GUARD 3 (db-cleanup-decisions-amend, T2) — preflight three-entity name
$ rg -n "^DELETE FROM" docs/migracion/02-cleanup-execute.sql | head -3
268:DELETE FROM seguimiento_comentarios;                    -- CASCADE child of casos (036:34); explicit anyway
269:DELETE FROM seguimiento_casos;
275:DELETE FROM pagos;
```
Guard 3 (line 77) still precedes the first `DELETE FROM` (line 268) — untouched by this task.

### `git status --porcelain`

```
 M docs/migracion/02-cleanup-execute.sql
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/
```
Only `docs/migracion/02-cleanup-execute.sql` shows as **modified**. The two
`??` (untracked) entries pre-date this task — they are the plan and this
sprint's own scratchpad/report directory (present in `git status` at the
start of the conversation, before I touched anything), not files I created
or edited as part of T3's scope.

## `npm run qa` (full, real run — identical shape to t01/t02 baseline)

```
$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit

> my-v0-project@0.1.0 lint
> eslint .

(28 pre-existing react-hooks/exhaustive-deps and @next/next/no-img-element warnings,
 same files/lines as t01/t02's pasted baseline — full list omitted here for
 length, unchanged from prior tasks' reports)

✖ 28 problems (0 errors, 28 warnings)

> my-v0-project@0.1.0 test
> vitest run

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  07:26:01
   Duration  1.85s (transform 999ms, setup 1.63s, collect 1.93s, tests 491ms, environment 5ms, prepare 2.08s)
```

Exit code 0. `tsc` clean, `eslint` 0 errors / 28 pre-existing warnings, `vitest`
30 files / 825 tests passing — identical in shape to t01's and t02's baseline
(expected: no `app/`, `lib/`, `components/`, `tests/`, or config file is in
this task's scope).

## Prevention rules named and evidenced

- **`mistakes/schema-source-of-truth`** — the five candidate balance columns
  are never assumed to exist. SECTION 5 detects each one at run time via
  `information_schema.columns WHERE table_schema = 'public' AND table_name =
  'reservas'`, the exact same convention Guard 3 (T2) already established at
  lines 122-125/145-148/173-176. `scripts/007:34-36` and `scripts/026:53-54`
  are cited only as corroboration, never as proof — matching the file's
  standing convention.
- **`mistakes/unrequested-hardening-regression`** — the diff adds exactly
  what AC9 requires (the probe, the temp table, the five report columns, the
  inline HC-1 rationale) and nothing else. It does not touch Guards 1-3,
  Section 1's KEEP-set construction, Section A's DELETE ordering, the FISCAL
  GATE, Section B/C/D, or the post-condition's `v_n_pagos <> 0` check (that
  line is shown only as unchanged diff context, not edited). It does not
  attempt to "resolve" the `scripts/027` vs `scripts/030` contradiction, does
  not add any `UPDATE`, and does not touch any FK/trigger citation comment
  elsewhere in the file.

## Rollback

Reference point: the file's state at the **start of this task** (post-t02,
579 lines, `HEAD` = `3faa20c` plus t01's and t02's already-landed edits). To
roll back T3 only: re-open `docs/migracion/02-cleanup-execute.sql` and revert
the two hunks shown above (remove the new SECTION 5 block between the Section
4 `DO $$ ... END $$;` and the FINAL REPORT header, and remove the five
`*_disclosure` columns plus their preceding comment from the FINAL REPORT
`SELECT`), restoring the file to its exact post-t02 579-line content. No
destructive git verb used or required.
