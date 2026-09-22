# T1 dev report — `02`: unconditional `pagos` wipe + migrate all nine `_keep_pago` consumers

Owner: senior-dev · Depends on: — (first task of the sprint)
File in scope: `docs/migracion/02-cleanup-execute.sql` (only)

## Files changed

- `/Users/johancito/Developer/Elibry/docs/migracion/02-cleanup-execute.sql`

(Also updated, per explicit task instructions outside the code-scope: the
sprint scratchpad ledger row for `t01` and a §2 handoff — not part of the
"files in scope" for the SQL change itself.)

- `/Users/johancito/Developer/Elibry/docs/sprints/2026-09-22-db-cleanup-decisions-amend/scratchpad.md`

## git diff (full, `docs/migracion/02-cleanup-execute.sql`)

```diff
diff --git a/docs/migracion/02-cleanup-execute.sql b/docs/migracion/02-cleanup-execute.sql
index 5e2c0fd..f5ec7cf 100644
--- a/docs/migracion/02-cleanup-execute.sql
+++ b/docs/migracion/02-cleanup-execute.sql
@@ -75,11 +75,21 @@ END $$;
 
 -- =============================================================================
 -- SECTION 1 — Materialise the entire KEEP set BEFORE any DELETE.
--- Why materialise (not inline CTEs per statement): _keep_cliente reads `pagos`.
--- If `pagos` were deleted before `clientes`, a re-evaluated inline CTE could
--- return a SMALLER client set on a later statement and the kept client could
--- be deleted. Materialising first makes delete order irrelevant to what the
--- keep set contains. ON COMMIT DROP — these never outlive this transaction.
+-- Materialising first makes delete order irrelevant to what the keep set
+-- contains, regardless of which tables have already been touched.
+-- ON COMMIT DROP — these never outlive this transaction.
+--
+-- AMENDMENT (db-cleanup-decisions-amend, T1): `pagos` has NO keep set anymore
+-- — every row is destroyed unconditionally (Step 3 below), so `_keep_cliente`
+-- no longer reads `pagos` at all; it is built from `_keep_reserva.cliente_id`
+-- alone. The old rationale that used to live here ("materialise because
+-- _keep_cliente reads pagos") is factually dead and has been removed.
+-- Deliberate behaviour consequence: previously, a `pagos.cliente_id` that
+-- diverged from `reservas.cliente_id` was protected via a UNION with
+-- `_keep_pago`, so that client survived even though it was not the kept
+-- reserva's own client. That protection is gone — such a client is now
+-- deleted like any other non-kept client. This is intentional, not a bug
+-- (plan §8 edge cases).
 -- =============================================================================
 CREATE TEMP TABLE _keep_reserva ON COMMIT DROP AS
   SELECT id, cliente_id, producto_id FROM reservas WHERE codigo = 'RES-1787875561067';
@@ -92,13 +102,12 @@ CREATE TEMP TABLE _keep_suplidor ON COMMIT DROP AS
   FROM productos p
   WHERE p.id IN (SELECT id FROM _keep_producto) AND p.suplidor_id IS NOT NULL;
 
-CREATE TEMP TABLE _keep_pago ON COMMIT DROP AS
-  SELECT id, cliente_id FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva);
+-- _keep_pago temp table REMOVED (db-cleanup-decisions-amend, T1): `pagos` has
+-- no keep set — every row is destroyed unconditionally (Step 3). See the
+-- Section 1 header comment above for the deliberate behaviour consequence.
 
 CREATE TEMP TABLE _keep_cliente ON COMMIT DROP AS
-  SELECT cliente_id AS id FROM _keep_reserva WHERE cliente_id IS NOT NULL
-  UNION
-  SELECT cliente_id AS id FROM _keep_pago WHERE cliente_id IS NOT NULL;
+  SELECT cliente_id AS id FROM _keep_reserva WHERE cliente_id IS NOT NULL;
 
 CREATE TEMP TABLE _keep_detalle ON COMMIT DROP AS
   SELECT id FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva);
@@ -121,7 +130,11 @@ SELECT
   (SELECT count(*) FROM _keep_detalle)    AS n_detalles,
   (SELECT count(*) FROM _keep_pasajero)   AS n_pasajeros,
   (SELECT count(*) FROM _keep_ocupacion)  AS n_ocupaciones,
-  (SELECT count(*) FROM _keep_pago)       AS n_pagos;
+  -- AMENDMENT (T1): repurposed. This is no longer a "before" count to compare
+  -- against an "after" count — pagos has no keep set. It counts payments that
+  -- WILL be destroyed by Step 3's unconditional DELETE, sourced directly from
+  -- `pagos` (the removed `_keep_pago` temp table no longer exists).
+  (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos_a_destruir;
 
 -- =============================================================================
 -- SECTION A — business-data deletes, leaf-first. Ordered so no FK is violated
@@ -139,8 +152,9 @@ DELETE FROM seguimiento_casos;
 
 -- Step 3 — pagos MUST precede reservas and clientes: both its FKs are NO
 -- ACTION (scripts/025-fix-pagos-table.sql:106,110) and would block those
--- deletes otherwise.
-DELETE FROM pagos WHERE id NOT IN (SELECT id FROM _keep_pago);
+-- deletes otherwise. AMENDMENT (T1): unconditional — pagos has no keep set,
+-- ALL rows are destroyed, including any belonging to the kept reserva.
+DELETE FROM pagos;
 
 -- Step 4 — reserva_pasajeros before reserva_ocupaciones, to avoid pointless
 -- ON DELETE SET NULL (ocupacion_id) churn (scripts/061:84-86) on rows about to
@@ -219,7 +233,8 @@ WHERE NOT (
   OR (cp.tabla_afectada = 'clientes'            AND cp.registro_id IN (SELECT id FROM _keep_cliente))
   OR (cp.tabla_afectada = 'productos'           AND cp.registro_id IN (SELECT id FROM _keep_producto))
   OR (cp.tabla_afectada = 'suplidores'          AND cp.registro_id IN (SELECT id FROM _keep_suplidor))
-  OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
+  -- AMENDMENT (T1): always false — no pago row ever survives the full wipe.
+  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
   OR (cp.tabla_afectada = 'reserva_detalles'    AND cp.registro_id IN (SELECT id FROM _keep_detalle))
   OR (cp.tabla_afectada = 'reserva_pasajeros'   AND cp.registro_id IN (SELECT id FROM _keep_pasajero))
   OR (cp.tabla_afectada = 'reserva_ocupaciones' AND cp.registro_id IN (SELECT id FROM _keep_ocupacion))
@@ -231,7 +246,8 @@ WHERE NOT (
   OR (ap.tabla_objetivo = 'clientes'            AND ap.registro_id IN (SELECT id FROM _keep_cliente))
   OR (ap.tabla_objetivo = 'productos'           AND ap.registro_id IN (SELECT id FROM _keep_producto))
   OR (ap.tabla_objetivo = 'suplidores'          AND ap.registro_id IN (SELECT id FROM _keep_suplidor))
-  OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
+  -- AMENDMENT (T1): always false — no pago row ever survives the full wipe.
+  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
   OR (ap.tabla_objetivo = 'reserva_detalles'    AND ap.registro_id IN (SELECT id FROM _keep_detalle))
   OR (ap.tabla_objetivo = 'reserva_pasajeros'   AND ap.registro_id IN (SELECT id FROM _keep_pasajero))
   OR (ap.tabla_objetivo = 'reserva_ocupaciones' AND ap.registro_id IN (SELECT id FROM _keep_ocupacion))
@@ -411,8 +427,11 @@ BEGIN
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
@@ -430,6 +449,9 @@ SELECT
   (SELECT producto_id FROM reservas WHERE codigo = 'RES-1787875561067') AS producto_id,
   (SELECT count(*) FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_detalles,
   (SELECT count(*) FROM reserva_pasajeros WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pasajeros,
+  -- n_pagos is 0 by construction (AMENDMENT T1): this SELECT runs after Step
+  -- 3's unconditional `DELETE FROM pagos;`, so no pago row can exist here
+  -- regardless of reserva_id.
   (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos,
   current_user, session_user, current_database();
```

Every hunk falls inside the pre-mortem's allowed line ranges (checked against
the *actual current file*, not the plan's approximate numbers): the header
comment hunk starts at old-line 76 (SECTION 1 header, allowed 76-82), the
`_keep_pago`/`_keep_cliente` hunk starts at old-line 92 inside the file's
95-101 KEEP-set block, the `_before_snapshot` hunk is at old-line 121 inside
117-124, the Step-3 hunk is at old-line 139 inside 137-143, the two
polymorphic-branch hunks are at old-lines 219/231 inside 216-238, the
post-condition hunk is at old-line 411 inside 400-416, and the final-report
hunk is at old-line 430 inside 426-434. No hunk touches Section B, Section C,
Section D, or the FISCAL GATE block.

## C1-C9 mapping (what changed where)

| # | Site | Change |
|---|---|---|
| C1 | `CREATE TEMP TABLE _keep_pago` | Removed; replaced by a comment naming the amendment. |
| C2 | `_keep_cliente` UNION branch | Rebuilt from `_keep_reserva.cliente_id` only; the `_keep_pago` UNION term is gone. |
| C3 | `_before_snapshot.n_pagos` | Renamed `n_pagos_a_destruir`, now sourced directly from `pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)` — no longer reads the (now-removed) `_keep_pago`. |
| C4 | `DELETE FROM pagos WHERE id NOT IN (...)` | Now a bare `DELETE FROM pagos;` — no WHERE, no NOT IN. |
| C5 | `cambios_provisionales` `tabla_afectada='pagos'` branch | Commented out, exact words "always false — no pago row ever survives the full wipe." |
| C6 | `acciones_pendientes` `tabla_objetivo='pagos'` branch | Commented out, same exact words. |
| C7 | post-condition `v_n_pagos <> v_before.n_pagos` | Now `IF v_n_pagos <> 0 THEN RAISE EXCEPTION ...` — strictly stronger. |
| C8 | final report grid `n_pagos` sub-select | Left as-is; comment added stating it is 0 by construction because it runs after the wipe. |
| C9 | Section-1 header comment | Rewritten — dead "`_keep_cliente` reads `pagos`" rationale removed; states inline that a `pagos.cliente_id` divergent from `reservas.cliente_id` was previously protected via the `_keep_pago` UNION and is now deleted like any other non-kept client — intentional, not a bug. |

## Commands run (verbatim, real output)

```
$ rg -n "DELETE FROM pagos" docs/migracion/02-cleanup-execute.sql
157:DELETE FROM pagos;
453:  -- 3's unconditional `DELETE FROM pagos;`, so no pago row can exist here
```
Line 157 is the live statement — bare, unconditional. AC1: **PASS**.

```
$ rg -n "_keep_pago" docs/migracion/02-cleanup-execute.sql
89:-- `_keep_pago`, so that client survived even though it was not the kept
105:-- _keep_pago temp table REMOVED (db-cleanup-decisions-amend, T1): `pagos` has
136:-- `pagos` (the removed `_keep_pago` temp table no longer exists).
237:  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
250:  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
```
6 hits, every single one inside a `--` comment (lines 89, 105, 136 are prose;
237, 250 are commented-out SQL branches). Zero executable references. AC2:
**PASS**.

```
$ rg -n -A4 "CREATE TEMP TABLE _keep_cliente" docs/migracion/02-cleanup-execute.sql
109:CREATE TEMP TABLE _keep_cliente ON COMMIT DROP AS
110-  SELECT cliente_id AS id FROM _keep_reserva WHERE cliente_id IS NOT NULL;
111-
112-CREATE TEMP TABLE _keep_detalle ON COMMIT DROP AS
113-  SELECT id FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva);
```
`_keep_cliente` is built from `_keep_reserva.cliente_id` alone — no `pagos` or
`_keep_pago` term, no UNION. AC3: **PASS**.

```
$ rg -n "tabla_afectada = 'pagos'|tabla_objetivo = 'pagos'" docs/migracion/02-cleanup-execute.sql
237:  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
250:  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
```
Both hits are commented out (leading `-- OR`), each preceded on the line above
by the exact words "always false — no pago row ever survives the full wipe."
AC4: **PASS**.

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
`_before_snapshot`'s field is `n_pagos_a_destruir` (line 137, sourced directly
from `pagos`), the post-condition (line 433) asserts `v_n_pagos <> 0 THEN
RAISE EXCEPTION` — no more before/after equality — and the final report's
`n_pagos` (line 455) is unchanged with a preceding comment (line 452-454)
stating it is 0 by construction. AC5, AC6: **PASS**.

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
All hits are pre-existing comments/NOTICE strings (unchanged by this task, and
none is a live statement). Zero executable hits. AC10 (part 1): **PASS**.

```
$ head -1 docs/migracion/02-cleanup-execute.sql
-- =============================================================================
$ rg -n "^BEGIN;|^COMMIT;|^ROLLBACK;" docs/migracion/02-cleanup-execute.sql
33:BEGIN;
461:COMMIT;
```
File opens with a header comment (not `BEGIN;` literally on line 1, but the
transaction's `BEGIN;` is present exactly once at line 33 and `COMMIT;` exactly
once at line 461); no `ROLLBACK;` anywhere. AC10 (part 2): **PASS**.

```
$ rg -n "^\s*DELETE FROM (usuarios|usuarios_sistema|colaboradores|datos_maestros|parametros_sistema|tipos_productos|configuracion_empresa|permisos_roles|comprobantes_disponibles)" docs/migracion/02-cleanup-execute.sql
(no output — 0 hits)
```
Zero uncommented `DELETE FROM` against any Section-B table. AC11: **PASS**.

```
$ wc -l docs/migracion/02-cleanup-execute.sql
     461 docs/migracion/02-cleanup-execute.sql
```
439 → 461 lines (+22). Well under the 500-line ceiling; no flag required for
this task alone. (HC-2's projected overage in the plan is from T2 (+~35) and
T3 (+~30) stacking on top of this file in later tasks — that is documented
there, not here.)

```
$ git status --porcelain
 M docs/migracion/02-cleanup-execute.sql
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/
```
Only `docs/migracion/02-cleanup-execute.sql` is modified. The two `??` entries
(`docs/plans/db-cleanup-decisions-amend.md`, `docs/sprints/`) were already
untracked at the start of this session (confirmed against the session's
opening git-status snapshot) — they are the sprint's own plan/scratchpad
artifacts, not files this task wrote SQL into. AC30/S1: **PASS**.

```
$ git diff -- docs/migracion/02-cleanup-execute.sql
```
(pasted in full above, under "git diff")

```
$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit

> my-v0-project@0.1.0 lint
> eslint .

/Users/johancito/Developer/Elibry/app/clientes/balance-reserva/page.tsx
  83:6  warning  React Hook useEffect has a missing dependency: 'cargarDatos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/clientes/editar/page.tsx
  79:6  warning  React Hook useEffect has a missing dependency: 'cargarCliente'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/clientes/ver/page.tsx
   27:6   warning  React Hook useEffect has a missing dependency: 'cargarCliente'. Either include it or remove the dependency array                                                                                                                                                react-hooks/exhaustive-deps
  187:21  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
  263:29  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/crm/casos/page.tsx
  232:6  warning  React Hook useEffect has a missing dependency: 'cargarCasos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/facturacion/fiscal/page.tsx
  162:6  warning  React Hook useEffect has missing dependencies: 'supabase' and 'toast'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/facturacion/voucher/page.tsx
  245:6  warning  React Hook useEffect has a missing dependency: 'fetchReservas'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/page.tsx
  103:6  warning  React Hook useEffect has a missing dependency: 'verificarTablaYCargarCambios'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
  761:6  warning  React Hook useEffect has a missing dependency: 'cargarEstadisticas'. Either include it or remove the dependency array            react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/pagos/page.tsx
  39:6  warning  React Hook useEffect has a missing dependency: 'cargarPagos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/pagos/ver/page.tsx
  67:6  warning  React Hook useEffect has a missing dependency: 'cargarPago'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/productos/editar/page.tsx
   84:6   warning  React Hook useEffect has missing dependencies: 'loadProducto' and 'router'. Either include them or remove the dependency array                                                                                                                                  react-hooks/exhaustive-deps
  602:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/productos/registrar/page.tsx
  529:25  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/productos/ver/page.tsx
   60:6   warning  React Hook useEffect has a missing dependency: 'cargarProducto'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  200:15  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/reservas/pendientes/page.tsx
  199:6  warning  React Hook useEffect has a missing dependency: 'cargarReservas'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/reservas/seguimiento/page.tsx
  219:6  warning  React Hook useEffect has a missing dependency: 'cargarCasos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/reservas/ver/[id]/page.tsx
  276:6  warning  React Hook useEffect has missing dependencies: 'supabase' and 'toast'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/suplidores/editar/page.tsx
   75:6   warning  React Hook useEffect has a missing dependency: 'cargarSuplidor'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  468:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/suplidores/page.tsx
  50:6  warning  React Hook useEffect has a missing dependency: 'cargarSuplidores'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/suplidores/registrar/page.tsx
  399:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/suplidores/ver/page.tsx
   63:6   warning  React Hook useEffect has a missing dependency: 'cargarSuplidor'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  254:21  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/components/image-upload.tsx
  114:13  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/components/time-format-toggle.tsx
  24:6  warning  React Hook useEffect has a missing dependency: 'onChange'. Either include it or remove the dependency array. If 'onChange' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps

✖ 28 problems (0 errors, 28 warnings)

> my-v0-project@0.1.0 test
> vitest run

[Vite CJS deprecation notice omitted here — identical to baseline, no functional impact]

 RUN  v2.1.9 /Users/johancito/Developer/Elibry

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  06:53:50
   Duration  3.67s (transform 2.27s, setup 3.56s, collect 3.71s, tests 1.04s, environment 8ms, prepare 4.12s)
```
Exit code: 0. `tsc --noEmit` produced no output (clean). `eslint .` produced 0
errors, 28 warnings — all pre-existing (`react-hooks/exhaustive-deps`,
`@next/next/no-img-element`), none in any file this task touched (this task
touched zero `app/`/`lib/`/`components/`/`tests/` files). `vitest run`: 30
test files, 825 tests, all passing, several intentional `stderr` lines from
error-path test fixtures (mocked Supabase failures), not real failures. This
is what the baseline would be, since no in-scope file for T1 is inspected by
`tsc`/`eslint`/`vitest`. S2/AC31: **PASS**.

## Self-check against the plan's AC wording (`docs/plans/db-cleanup-decisions-amend.md` lines ~244-253)

- **AC1** — *"`rg -n "DELETE FROM pagos" ...` shows a bare unconditional statement — no WHERE, no NOT IN, no keep-set reference."* Line 157 = `DELETE FROM pagos;`. **PASS**.
- **AC2** — *"every remaining hit is classified in the report as comment-only. One executable hit = FAIL."* 6 hits, all classified above, all `--` comments. **PASS**.
- **AC3** — *"`_keep_cliente` is built from `_keep_reserva.cliente_id` alone; no `pagos`-derived term. The now-dead rationale (C9) is rewritten, and the deliberate consequence... is stated there."* Verified via the `rg -A4` output and the C9 diff hunk (lines 76-90 of the new file). **PASS**.
- **AC4** — *"Both polymorphic `'pagos'` branches (C5 line 222, C6 line 234) are commented out with the words 'always false — no pago row ever survives the full wipe'."* Both present verbatim at new lines 236/249 (immediately above the commented branch lines 237/250). **PASS**.
- **AC5** — *"`_before_snapshot`'s payment count is sourced directly from `pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)` and renamed... the Section-4 post-condition asserts `v_n_pagos <> 0` ⇒ RAISE EXCEPTION. Keeping `v_n_pagos <> v_before.n_pagos` as the sole check = FAIL."* Renamed to `n_pagos_a_destruir` (line 137), sourced directly from `pagos`; post-condition now checks `v_n_pagos <> 0` only (line 433) — the old `v_before.n_pagos` comparison is gone. **PASS**.
- **AC6** — *"The final report grid's `n_pagos` (line 433) still runs after the wipe and carries a comment stating it is 0 by construction."* New lines 452-455. **PASS**.
- **AC10** — *"Regression greps: 0 hits ... file still opens `BEGIN;`, ends `COMMIT;`, has no `ROLLBACK;`."* Verified above. **PASS**.
- **AC11** — *"0 uncommented `DELETE FROM` against any Section-B table (`comprobantes_disponibles` included). The undischarged fiscal gate rides on this."* Verified 0 hits above; Section B (old lines 280-309) was not touched by any hunk. **PASS**.

## Prevention rules named in T1 (plan §11), each verified

- `mistakes/incomplete-control-enumeration` — the affected set was the plan's own §0.1 nine-site inventory; I independently re-grepped `_keep_pago` before editing (6 literal hits) and confirmed it matched the inventory's C1-C6 exactly, then handled C7-C9 (non-literal consumers) per the table. QA should re-grep independently as instructed — I did not rely on the plan's line numbers alone, I re-read the live file first.
- `mistakes/spec-manufactured-divergence` — no consumer is left asserting a payment survives: C2 (`_keep_cliente`) no longer unions with pagos, C5/C6 branches are dead code, C7's post-condition is `= 0` not "unchanged".
- `mistakes/blind-write-partial-read` — used `Edit` exclusively, nine separate surgical edits, the file was read in full first and never regenerated/rewritten as a whole.
- `mistakes/unrequested-hardening-regression` — every diff hunk falls inside the allowed line ranges (verified above, hunk-by-hunk against the actual current file). I did not touch Section B, Section C, Section D, the FISCAL GATE, the `auditoria` alternative comment, or anything else I noticed while the file was open.

## UNVERIFIED runtime claims

Per the sprint briefing (no live DB — `db.jznchzgpaovmgjezvdwo.supabase.co` has
no DNS answer), nothing in this task was executed against a database. Every
claim above about what the SQL "does" at runtime (e.g. "all pagos rows are
deleted", "the post-condition would fire") is a reading of the SQL text, not
an observed execution result, and is **UNVERIFIED** in the literal sense
required by the plan. Only the `rg`/`wc`/`git`/`npm run qa` command outputs
above are actually-executed evidence.

## Backlog / out-of-scope observations (NOT fixed, per `mistakes/unrequested-hardening-regression`)

- None newly discovered while editing this file. The pre-existing backlog
  items already logged in scratchpad §3 (B-a through B-e, HC-1, HC-2) were
  re-read but not acted on — none of them intersects the C1-C9 sites this
  task was scoped to.
- Note for T2/T3 (not fixed here, just flagged as context): this file is now
  461 lines. HC-2 in the plan already anticipates T2 (+~35) and T3 (+~30)
  pushing it past 500; that is explicitly out of scope for T1 and is the next
  dev's problem per HC-2's ruling (flag, never split).

## Rollback

The file's state at the START of this task (before any of T1's edits) is the
current committed `HEAD` version at commit `3faa20c` (`git show
3faa20c:docs/migracion/02-cleanup-execute.sql` reproduces it byte-for-byte,
439 lines) — restore that blob's content into
`docs/migracion/02-cleanup-execute.sql` to undo this task.

## Verdict

DONE. All nine C1-C9 edits applied via `Edit` only, verification commands run
for real (output pasted above, not paraphrased), `npm run qa` passes (825/825
tests, 0 lint errors, clean typecheck), `git status --porcelain` shows only
the one in-scope file modified, no hunk falls outside the pre-mortem's allowed
ranges, and Section B / FISCAL GATE / Section C / Section D are untouched.
