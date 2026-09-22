-- =============================================================================
-- 02-cleanup-execute.sql — DESTRUCTIVE. Real COMMIT. No ROLLBACK theater.
-- =============================================================================
-- Elibry — DB cleanup keeping only reserva RES-1787875561067.
-- Companion files: 01-cleanup-dry-run.sql (read-only, run it FIRST),
--                  README-cleanup.md (operator runbook — READ IT before this file).
-- Spec: docs/plans/db-cleanup-keep-one-reserva.md
--
-- DO NOT run this until you have:
--   1. Taken a real backup (README-cleanup.md step 1). This is the ONLY undo.
--   2. Run 01-cleanup-dry-run.sql and read every result grid, especially Query 3.
--   3. Confirmed your SQL client honors a real transaction (this file opens
--      BEGIN; and ends COMMIT; — nothing here is a dry run, unlike the plan's
--      original ROLLBACK-based design: the Supabase SQL editor's own implicit
--      transaction wrapping made a "dry run via ROLLBACK" unsafe to promise, so
--      that design was replaced by shipping this file and 01 separately).
--
-- Everything below is one transaction. If ANY statement errors, Postgres
-- aborts the WHOLE transaction and nothing is changed — that is the safety
-- net, not an explicit ROLLBACK statement (there is none in this file).
--
-- BANNED in this file, on purpose (scripts/056-database-cleanup-and-id-reset-
-- final.sql is the anti-pattern, do not reintroduce any of these):
--   - SET session_replication_role = replica;  (056:8 — disables FK/trigger
--     enforcement globally; ordering below is correct BECAUSE that stays on)
--   - ALTER SEQUENCE ... RESTART WITH ...       (056:91-141 — fatal here because
--     rows survive and lib/provisional-system.ts:132-142 computes
--     nextId = MAX(id)+1 client-side and inserts an explicit id)
--   - TRUNCATE, DROP TABLE, DROP VIEW, DROP POLICY, ALTER ... DISABLE ROW LEVEL
--     SECURITY, CREATE POLICY
-- =============================================================================

BEGIN;

-- =============================================================================
-- GUARD 1 (first statement in the transaction) — hard-abort if the reserva to
-- keep does not exist, or is not unique. Without this, an empty/wrong DB would
-- proceed to wipe everything while keeping nothing.
-- =============================================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM reservas WHERE codigo = 'RES-1787875561067';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ABORT: expected exactly 1 reserva with codigo = ''RES-1787875561067'', found %. Refusing to run — this transaction would otherwise delete everything while keeping nothing. Fix the data/investigate, then re-run from the top.', v_count;
  END IF;
END $$;

-- =============================================================================
-- GUARD 2 — hard-abort if the kept reserva's cliente_id or producto_id is NULL.
-- Why: fk_reservas_cliente / fk_reservas_producto are ON DELETE SET NULL
-- (scripts/021-fix-reservas-relationships.sql:54-63), and scripts/058-fix-
-- auditoria-table.sql:64-65 dropped NOT NULL from both columns. If either is
-- already NULL, the KEEP set below cannot resolve a client/producto to
-- protect, and a later cleanup elsewhere could silently orphan this reserva
-- with no error at all. We refuse to proceed rather than run against a
-- reservation that is already a partial husk.
-- =============================================================================
DO $$
DECLARE
  v_cliente_id integer;
  v_producto_id integer;
BEGIN
  SELECT cliente_id, producto_id INTO v_cliente_id, v_producto_id
  FROM reservas WHERE codigo = 'RES-1787875561067';

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'ABORT: reserva RES-1787875561067 has cliente_id IS NULL. Cannot resolve a client to keep. Refusing to proceed (SET NULL hazard, see file header).';
  END IF;
  IF v_producto_id IS NULL THEN
    RAISE EXCEPTION 'ABORT: reserva RES-1787875561067 has producto_id IS NULL. Cannot resolve a product to keep. Refusing to proceed (SET NULL hazard, see file header).';
  END IF;
END $$;

-- =============================================================================
-- GUARD 3 (db-cleanup-decisions-amend, T2) — preflight three-entity name
-- assertion. Resolves the kept reserva's cliente name, producto name, and
-- that producto's suplidor name, and aborts unless all three match a
-- canonical pattern, case-insensitively (ILIKE). Purpose: Guards 1-2 only
-- prove a reserva with this exact codigo exists and has non-NULL FKs — they
-- cannot tell a wrong-DB/wrong-seed run apart from the real one. This guard
-- can, by checking who those FKs actually point to.
-- Name columns are NEVER hardcoded to a single column — each candidate list
-- below is checked against information_schema.columns at run time
-- (mistakes/schema-source-of-truth: the live DB is unreachable this sprint,
-- scripts/*.sql is corroboration only, so this file self-detects or refuses).
-- Canonical ILIKE patterns (owned here — 01's preview report, T5, copies
-- these verbatim; they must never drift, plan §7):
--   cliente:  '%JROSA%ASESORA%VIAJES%'
--   producto: '%BAHIA PRINCIPE%EXPLORE%LEGEND%'
--   suplidor: '%OPERAHOTEL%'
-- Four distinct abort states, never collapsed into one generic "MISMATCH"
-- (decisions/0012-elibry-confirmacion-without-factura-numero):
--   (a) a candidate name value is present but does not match the pattern
--   (b) every candidate name column exists but is NULL/empty
--   (c) no candidate name column exists on that table at run time
--   (d) suplidor only: productos.suplidor_id IS NULL, so no suplidor row can
--       even be resolved (Guard 2 checks cliente_id/producto_id, not
--       suplidor_id — this state is reachable today).
-- =============================================================================
DO $$
DECLARE
  v_cliente_id    integer;
  v_producto_id   integer;
  v_suplidor_id   integer;
  v_col           text;
  v_val           text;
  v_cols_found    integer;
  v_any_nonnull   boolean;
  v_matched       boolean;
  v_cliente_cols  text[] := ARRAY['nombre_completo', 'razon_social', 'nombre_comercial'];
  v_producto_cols text[] := ARRAY['nombre_producto', 'nombre_original'];
  v_suplidor_cols text[] := ARRAY['razon_social', 'nombre_comercial'];
BEGIN
  SELECT cliente_id, producto_id INTO v_cliente_id, v_producto_id
  FROM reservas WHERE codigo = 'RES-1787875561067';

  -- CLIENTE ---------------------------------------------------------------
  v_cols_found := 0; v_any_nonnull := false; v_matched := false;
  FOREACH v_col IN ARRAY v_cliente_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = v_col
    ) THEN
      v_cols_found := v_cols_found + 1;
      EXECUTE format('SELECT %I FROM clientes WHERE id = $1', v_col) INTO v_val USING v_cliente_id;
      IF v_val IS NOT NULL AND btrim(v_val) <> '' THEN
        v_any_nonnull := true;
        IF v_val ILIKE '%JROSA%ASESORA%VIAJES%' THEN v_matched := true; END IF;
      END IF;
    END IF;
  END LOOP;
  IF v_cols_found = 0 THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, no-candidate-column) — clientes has none of the candidate name columns (nombre_completo, razon_social, nombre_comercial) at run time. Cannot verify cliente identity. Refusing to proceed.';
  ELSIF NOT v_any_nonnull THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, name-null-or-empty) — clientes.id = % has every candidate name column NULL or empty. Cannot verify cliente identity. Refusing to proceed.', v_cliente_id;
  ELSIF NOT v_matched THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, no-match) — clientes.id = % name does not match expected pattern %%JROSA%%ASESORA%%VIAJES%%. This does not look like the intended cliente to keep. Refusing to proceed.', v_cliente_id;
  END IF;

  -- PRODUCTO --------------------------------------------------------------
  v_cols_found := 0; v_any_nonnull := false; v_matched := false;
  FOREACH v_col IN ARRAY v_producto_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'productos' AND column_name = v_col
    ) THEN
      v_cols_found := v_cols_found + 1;
      EXECUTE format('SELECT %I FROM productos WHERE id = $1', v_col) INTO v_val USING v_producto_id;
      IF v_val IS NOT NULL AND btrim(v_val) <> '' THEN
        v_any_nonnull := true;
        IF v_val ILIKE '%BAHIA PRINCIPE%EXPLORE%LEGEND%' THEN v_matched := true; END IF;
      END IF;
    END IF;
  END LOOP;
  IF v_cols_found = 0 THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, no-candidate-column) — productos has none of the candidate name columns (nombre_producto, nombre_original) at run time. Cannot verify producto identity. Refusing to proceed.';
  ELSIF NOT v_any_nonnull THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, name-null-or-empty) — productos.id = % has every candidate name column NULL or empty. Cannot verify producto identity. Refusing to proceed.', v_producto_id;
  ELSIF NOT v_matched THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, no-match) — productos.id = % name does not match expected pattern %%BAHIA PRINCIPE%%EXPLORE%%LEGEND%%. This does not look like the intended producto to keep. Refusing to proceed.', v_producto_id;
  END IF;

  -- SUPLIDOR ----------------------------------------------------------------
  SELECT suplidor_id INTO v_suplidor_id FROM productos WHERE id = v_producto_id;
  IF v_suplidor_id IS NULL THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, suplidor-id-null) — productos.id = % (the kept producto) has suplidor_id IS NULL. No suplidor row can be resolved to verify. Refusing to proceed.', v_producto_id;
  END IF;

  v_cols_found := 0; v_any_nonnull := false; v_matched := false;
  FOREACH v_col IN ARRAY v_suplidor_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'suplidores' AND column_name = v_col
    ) THEN
      v_cols_found := v_cols_found + 1;
      EXECUTE format('SELECT %I FROM suplidores WHERE id = $1', v_col) INTO v_val USING v_suplidor_id;
      IF v_val IS NOT NULL AND btrim(v_val) <> '' THEN
        v_any_nonnull := true;
        IF v_val ILIKE '%OPERAHOTEL%' THEN v_matched := true; END IF;
      END IF;
    END IF;
  END LOOP;
  IF v_cols_found = 0 THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, no-candidate-column) — suplidores has none of the candidate name columns (razon_social, nombre_comercial) at run time. Cannot verify suplidor identity. Refusing to proceed.';
  ELSIF NOT v_any_nonnull THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, name-null-or-empty) — suplidores.id = % has every candidate name column NULL or empty. Cannot verify suplidor identity. Refusing to proceed.', v_suplidor_id;
  ELSIF NOT v_matched THEN
    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, no-match) — suplidores.id = % name does not match expected pattern %%OPERAHOTEL%%. This does not look like the intended suplidor to keep. Refusing to proceed.', v_suplidor_id;
  END IF;
END $$;

-- =============================================================================
-- SECTION 1 — Materialise the entire KEEP set BEFORE any DELETE.
-- Materialising first makes delete order irrelevant to what the keep set
-- contains, regardless of which tables have already been touched.
-- ON COMMIT DROP — these never outlive this transaction.
--
-- AMENDMENT (db-cleanup-decisions-amend, T1): `pagos` has NO keep set anymore
-- — every row is destroyed unconditionally (Step 3 below), so `_keep_cliente`
-- no longer reads `pagos` at all; it is built from `_keep_reserva.cliente_id`
-- alone. The old rationale that used to live here ("materialise because
-- _keep_cliente reads pagos") is factually dead and has been removed.
-- Deliberate behaviour consequence: previously, a `pagos.cliente_id` that
-- diverged from `reservas.cliente_id` was protected via a UNION with
-- `_keep_pago`, so that client survived even though it was not the kept
-- reserva's own client. That protection is gone — such a client is now
-- deleted like any other non-kept client. This is intentional, not a bug
-- (plan §8 edge cases).
-- =============================================================================
CREATE TEMP TABLE _keep_reserva ON COMMIT DROP AS
  SELECT id, cliente_id, producto_id FROM reservas WHERE codigo = 'RES-1787875561067';

CREATE TEMP TABLE _keep_producto ON COMMIT DROP AS
  SELECT producto_id AS id FROM _keep_reserva WHERE producto_id IS NOT NULL;

CREATE TEMP TABLE _keep_suplidor ON COMMIT DROP AS
  SELECT p.suplidor_id AS id
  FROM productos p
  WHERE p.id IN (SELECT id FROM _keep_producto) AND p.suplidor_id IS NOT NULL;

-- _keep_pago temp table REMOVED (db-cleanup-decisions-amend, T1): `pagos` has
-- no keep set — every row is destroyed unconditionally (Step 3). See the
-- Section 1 header comment above for the deliberate behaviour consequence.

CREATE TEMP TABLE _keep_cliente ON COMMIT DROP AS
  SELECT cliente_id AS id FROM _keep_reserva WHERE cliente_id IS NOT NULL;

CREATE TEMP TABLE _keep_detalle ON COMMIT DROP AS
  SELECT id FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva);

CREATE TEMP TABLE _keep_pasajero ON COMMIT DROP AS
  SELECT id FROM reserva_pasajeros WHERE reserva_id IN (SELECT id FROM _keep_reserva);

CREATE TEMP TABLE _keep_ocupacion ON COMMIT DROP AS
  SELECT id FROM reserva_ocupaciones WHERE reserva_id IN (SELECT id FROM _keep_reserva);

-- =============================================================================
-- SECTION 2 — BEFORE snapshot of the kept reserva's downward-child counts, used
-- by the post-condition assertions in Section 4 (a delete-order bug that
-- shrinks these would otherwise pass silently).
-- =============================================================================
CREATE TEMP TABLE _before_snapshot ON COMMIT DROP AS
SELECT
  (SELECT cliente_id FROM _keep_reserva)  AS cliente_id,
  (SELECT producto_id FROM _keep_reserva) AS producto_id,
  (SELECT count(*) FROM _keep_detalle)    AS n_detalles,
  (SELECT count(*) FROM _keep_pasajero)   AS n_pasajeros,
  (SELECT count(*) FROM _keep_ocupacion)  AS n_ocupaciones,
  -- AMENDMENT (T1): repurposed. This is no longer a "before" count to compare
  -- against an "after" count — pagos has no keep set. It counts payments that
  -- WILL be destroyed by Step 3's unconditional DELETE, sourced directly from
  -- `pagos` (the removed `_keep_pago` temp table no longer exists).
  (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos_a_destruir;

-- =============================================================================
-- SECTION A — business-data deletes, leaf-first. Ordered so no FK is violated
-- even if every ON DELETE clause were absent (per docs/plans/db-cleanup-keep-
-- one-reserva.md §5). Each step cites the FK/trigger that dictates its
-- position.
-- =============================================================================

-- Step 1/2 — seguimiento_* has no reserva/cliente link of any kind
-- (email_distribuidor only, scripts/036-fix-seguimiento-tables.sql:13). Keep
-- set is genuinely empty (plan §4) -> bare DELETE FROM, chosen over TRUNCATE
-- so it stays inside this transaction and fires any triggers consistently.
DELETE FROM seguimiento_comentarios;                    -- CASCADE child of casos (036:34); explicit anyway
DELETE FROM seguimiento_casos;

-- Step 3 — pagos MUST precede reservas and clientes: both its FKs are NO
-- ACTION (scripts/025-fix-pagos-table.sql:106,110) and would block those
-- deletes otherwise. AMENDMENT (T1): unconditional — pagos has no keep set,
-- ALL rows are destroyed, including any belonging to the kept reserva.
DELETE FROM pagos;

-- Step 4 — reserva_pasajeros before reserva_ocupaciones, to avoid pointless
-- ON DELETE SET NULL (ocupacion_id) churn (scripts/061:84-86) on rows about to
-- be deleted anyway.
DELETE FROM reserva_pasajeros WHERE reserva_id NOT IN (SELECT id FROM _keep_reserva);

-- Step 5
DELETE FROM reserva_ocupaciones WHERE reserva_id NOT IN (SELECT id FROM _keep_reserva);

-- Step 6 — RISK R-TRIGGER (unresolved, see plan §0.5/§7): trigger_recalcular_
-- totales_delete (scripts/023-create-reserva-detalles-table-fixed.sql:109-113)
-- fires recalcular_totales_reserva(), which at 023:88-90 evaluates
-- COALESCE(NEW.editado_por, OLD.editado_por, 'Sistema') — NEW is unassigned in
-- a DELETE trigger, which CAN raise "record ""new"" is not assigned yet" in
-- PL/pgSQL. Counter-evidence it may be fine: app/reservas/editar/[id]/
-- page.tsx:692-695 performs this exact kind of DELETE in shipped code. Neither
-- outcome is asserted here. If the DELETE below errors with that message,
-- uncomment the two ALTER TABLE lines immediately around it, re-run this
-- entire file from BEGIN;, and separately report the trigger as broken (then
-- re-enable it — do not leave it disabled going forward).
-- ALTER TABLE reserva_detalles DISABLE TRIGGER trigger_recalcular_totales_delete;
DELETE FROM reserva_detalles WHERE reserva_id NOT IN (SELECT id FROM _keep_reserva);
-- ALTER TABLE reserva_detalles ENABLE TRIGGER trigger_recalcular_totales_delete;

-- Step 7 — FISCAL GATE. comprobantes_fiscales is a SUPPLIER-invoice table
-- (038-create-comprobantes-fiscales-table.sql:9-10, proveedor_nombre/
-- proveedor_rnc), fiscally sensitive per CLAUDE.md ("Fiscal (NCF / e-CF)
-- correctness is high-stakes -> senior + human-gated"). Per the frozen
-- decision, rows belonging to the KEPT reserva are retained regardless — only
-- unlinked rows are removed. Schema is genuinely ambiguous: 038 creates the
-- table, 039:2 DROPs it CASCADE, but app/facturacion/fiscal/page.tsx:674-675
-- inserts reserva_id/cliente_id columns neither migration declares. Handled by
-- runtime guards, never assumed.
-- To SKIP this entire block (leave comprobantes_fiscales fully untouched),
-- prefix every non-comment line in this DO block with "-- ".
-- ---- FISCAL GATE: comprobantes_fiscales ----
DO $$
BEGIN
  IF to_regclass('public.comprobantes_fiscales') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'comprobantes_fiscales' AND column_name = 'reserva_id'
    ) THEN
      EXECUTE 'DELETE FROM comprobantes_fiscales WHERE reserva_id NOT IN (SELECT id FROM _keep_reserva)';
    ELSE
      RAISE NOTICE 'comprobantes_fiscales exists but has no reserva_id column (declared shape, 038, has no reserva link) — leaving all rows untouched rather than guessing.';
    END IF;
  ELSE
    RAISE NOTICE 'comprobantes_fiscales does not exist (matches 039:2 DROP TABLE ... CASCADE) — nothing to do.';
  END IF;
END $$;
-- ---- END FISCAL GATE ----

-- Step 8 — all children of reservas are now gone.
DELETE FROM reservas WHERE id NOT IN (SELECT id FROM _keep_reserva);

-- Step 9 — MUST run after reservas: fk_reservas_producto is ON DELETE SET
-- NULL (scripts/021-fix-reservas-relationships.sql:61-63). Deleting productos
-- first would silently null the surviving reserva's producto_id with no error.
DELETE FROM productos WHERE id NOT IN (SELECT id FROM _keep_producto);

-- Step 10 — same hazard via fk_reservas_cliente (021:54-56); also after pagos.
DELETE FROM clientes WHERE id NOT IN (SELECT id FROM _keep_cliente);

-- Step 11 — after productos: productos_suplidor_id_fkey is ON DELETE SET NULL
-- (scripts/058-fix-auditoria-table.sql:53-56).
DELETE FROM suplidores WHERE id NOT IN (SELECT id FROM _keep_suplidor);

-- Step 12/13 — polymorphic links, inferred from app code, not a declared FK
-- (plan §0.4): cambios_provisionales.tabla_afectada/registro_id
-- (lib/provisional-system.ts:39-40,71-72,160-161); acciones_pendientes.
-- tabla_objetivo/registro_id (lib/admin-actions.ts:21).
DELETE FROM cambios_provisionales cp
WHERE NOT (
     (cp.tabla_afectada = 'reservas'            AND cp.registro_id IN (SELECT id FROM _keep_reserva))
  OR (cp.tabla_afectada = 'clientes'            AND cp.registro_id IN (SELECT id FROM _keep_cliente))
  OR (cp.tabla_afectada = 'productos'           AND cp.registro_id IN (SELECT id FROM _keep_producto))
  OR (cp.tabla_afectada = 'suplidores'          AND cp.registro_id IN (SELECT id FROM _keep_suplidor))
  -- AMENDMENT (T1): always false — no pago row ever survives the full wipe.
  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
  OR (cp.tabla_afectada = 'reserva_detalles'    AND cp.registro_id IN (SELECT id FROM _keep_detalle))
  OR (cp.tabla_afectada = 'reserva_pasajeros'   AND cp.registro_id IN (SELECT id FROM _keep_pasajero))
  OR (cp.tabla_afectada = 'reserva_ocupaciones' AND cp.registro_id IN (SELECT id FROM _keep_ocupacion))
);

DELETE FROM acciones_pendientes ap
WHERE NOT (
     (ap.tabla_objetivo = 'reservas'            AND ap.registro_id IN (SELECT id FROM _keep_reserva))
  OR (ap.tabla_objetivo = 'clientes'            AND ap.registro_id IN (SELECT id FROM _keep_cliente))
  OR (ap.tabla_objetivo = 'productos'           AND ap.registro_id IN (SELECT id FROM _keep_producto))
  OR (ap.tabla_objetivo = 'suplidores'          AND ap.registro_id IN (SELECT id FROM _keep_suplidor))
  -- AMENDMENT (T1): always false — no pago row ever survives the full wipe.
  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
  OR (ap.tabla_objetivo = 'reserva_detalles'    AND ap.registro_id IN (SELECT id FROM _keep_detalle))
  OR (ap.tabla_objetivo = 'reserva_pasajeros'   AND ap.registro_id IN (SELECT id FROM _keep_pasajero))
  OR (ap.tabla_objetivo = 'reserva_ocupaciones' AND ap.registro_id IN (SELECT id FROM _keep_ocupacion))
);

-- Step 14 — audit_logs / logs / performance_metrics: named in CLAUDE.md but
-- absent from every CREATE TABLE in scripts/ AND from every .from("...") call
-- in app/lib/tests (plan §0.2). May exist out-of-band. Guarded by to_regclass
-- so this file parses and runs unchanged whether or not they exist. Empty
-- keep set -> bare DELETE, chosen over TRUNCATE to stay in this transaction.
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'DELETE FROM audit_logs';
  ELSE
    RAISE NOTICE 'audit_logs: AUSENTE, nothing to do.';
  END IF;

  IF to_regclass('public.logs') IS NOT NULL THEN
    EXECUTE 'DELETE FROM logs';
  ELSE
    RAISE NOTICE 'logs: AUSENTE, nothing to do.';
  END IF;

  IF to_regclass('public.performance_metrics') IS NOT NULL THEN
    EXECUTE 'DELETE FROM performance_metrics';
  ELSE
    RAISE NOTICE 'performance_metrics: AUSENTE, nothing to do.';
  END IF;
END $$;

-- Step 15 — auditoria: MUST BE LAST in Section A. Steps 3-11 above each fire
-- audit_trigger() (scripts/001-create-tables.sql:220-260), which INSERTs a
-- fresh row into `auditoria` on every DELETE (001:224-227). Deleting
-- `auditoria` any earlier would leave this cleanup's own exhaust behind.
-- Because of this, the row count 01-cleanup-dry-run.sql reported for
-- `auditoria` is a LOWER BOUND, not what actually gets removed here — that is
-- expected and correct, not a bug in the dry run.
DELETE FROM auditoria;
-- Commented, preserving alternative for an operator who wants to keep the kept
-- reserva's DISCREPANCIA/audit history instead of wiping it entirely:
-- DELETE FROM auditoria
-- WHERE NOT (tabla = 'reservas' AND registro_id IN (SELECT id FROM _keep_reserva));


-- =============================================================================
-- SECTION B — configuration / master data. COMMENTED OUT BY DEFAULT.
-- Per the frozen decision: "Keep configuration/master data. Wipe business data
-- only." To opt in to wiping any of these, uncomment ONLY that statement —
-- do not blanket-uncomment the section.
--
-- comprobantes_disponibles holds LIVE DGII NCF SEQUENCE STATE: numero_actual
-- is the next fiscal number to issue (scripts/039-create-comprobantes-
-- disponibles-table.sql:12,163), read and incremented by obtener_proximo_ncf()
-- (039:114-155). Deleting it is a COMPLIANCE EVENT, not a cleanup — a wiped
-- block cannot be reconstructed from the app, and re-issuing an already-used
-- NCF is a DGII violation. Requires sign-off from someone with fiscal
-- authority, not just this script's operator.
--
-- usuarios / permisos_roles: the generic "you'll be locked out" warning does
-- NOT apply to this repo. Login is a hardcoded two-entry array at
-- lib/user-context.tsx:22-38, matched client-side and persisted to
-- localStorage; there is no `.from("usuarios")` call anywhere in this repo.
-- Wiping `usuarios` will NOT lock you out of THIS app. It may still matter to
-- an out-of-repo consumer of that table — do not assume the same elsewhere.
-- =============================================================================
-- DELETE FROM usuarios;                 -- see lockout note above: does NOT lock you out of this app
-- DELETE FROM usuarios_sistema;         -- AUSENTE from scripts/*.sql (plan §0.2) — may exist out-of-band; to_regclass-guard if uncommenting
-- DELETE FROM colaboradores;
-- DELETE FROM datos_maestros;           -- AUSENTE from scripts/*.sql (plan §0.2)
-- DELETE FROM parametros_sistema;       -- AUSENTE from scripts/*.sql (plan §0.2); zero live code paths (lib/empresa-info.ts:6-17)
-- DELETE FROM tipos_productos;
-- DELETE FROM configuracion_empresa;    -- AUSENTE from scripts/*.sql (plan §0.2); zero live code paths
-- DELETE FROM permisos_roles;           -- AUSENTE from scripts/*.sql (plan §0.2)
-- DELETE FROM comprobantes_disponibles; -- COMPLIANCE EVENT — see warning above. Requires fiscal sign-off.


-- =============================================================================
-- SECTION C — sequence sync (OPTIONAL, commented out). SYNC ONLY, never RESET.
-- Rows survive in most tables, so ALTER SEQUENCE ... RESTART WITH 1 (the
-- scripts/056:91-141 pattern) would hand the next insert an id that already
-- exists. lib/provisional-system.ts:132-142 also computes nextId = MAX(id)+1
-- client-side and inserts an explicit id, bypassing the sequence entirely, so
-- the sequence is already routinely behind MAX(id) — a SYNC is correct, a
-- RESET is actively harmful. Uncomment only the lines for tables you use
-- sequence-based inserts against.
-- rows survive: YES (kept reserva + closure) — sync only, never reset:
-- SELECT setval(pg_get_serial_sequence('reservas', 'id'), COALESCE((SELECT max(id) FROM reservas), 1), true);
-- SELECT setval(pg_get_serial_sequence('clientes', 'id'), COALESCE((SELECT max(id) FROM clientes), 1), true);
-- SELECT setval(pg_get_serial_sequence('productos', 'id'), COALESCE((SELECT max(id) FROM productos), 1), true);
-- SELECT setval(pg_get_serial_sequence('suplidores', 'id'), COALESCE((SELECT max(id) FROM suplidores), 1), true);
-- SELECT setval(pg_get_serial_sequence('pagos', 'id'), COALESCE((SELECT max(id) FROM pagos), 1), true);
-- SELECT setval(pg_get_serial_sequence('reserva_detalles', 'id'), COALESCE((SELECT max(id) FROM reserva_detalles), 1), true);
-- SELECT setval(pg_get_serial_sequence('reserva_pasajeros', 'id'), COALESCE((SELECT max(id) FROM reserva_pasajeros), 1), true);
-- SELECT setval(pg_get_serial_sequence('reserva_ocupaciones', 'id'), COALESCE((SELECT max(id) FROM reserva_ocupaciones), 1), true);
-- rows survive: NO (emptied by Section A, but MAX(id) sync is still the only
-- permitted form here — never RESTART WITH 1, since another future run of this
-- same script would empty it again from a nonzero baseline anyway):
-- SELECT setval(pg_get_serial_sequence('auditoria', 'id'), COALESCE((SELECT max(id) FROM auditoria), 1), true);
-- SELECT setval(pg_get_serial_sequence('seguimiento_casos', 'id'), COALESCE((SELECT max(id) FROM seguimiento_casos), 1), true);


-- =============================================================================
-- SECTION D — intentionally untouched. Explicit ledger, no silent omissions.
--   - v_comprobantes_disponibles (scripts/039:35) and v_comprobantes_fiscales
--     (scripts/038:43) are VIEWS. They hold no rows of their own; they reflect
--     their base table. Deleting "from" a view is not meaningful here.
--   - Storage bucket `documentos` (lib/supabase.ts:68, const BUCKET =
--     "documentos") is NOT a SQL table — a DELETE cannot reach it. See
--     README-cleanup.md "NOT covered" for what this means for orphaned files.
--   - Any table whose to_regclass() was NULL at run time in the DO blocks
--     above (audit_logs / logs / performance_metrics / comprobantes_fiscales)
--     was already reported AUSENTE via RAISE NOTICE and skipped — not omitted.
-- =============================================================================


-- =============================================================================
-- SECTION 4 — Post-condition integrity assertions. This is the safety net
-- that makes the whole operation reversible-by-abort: fk_reservas_cliente /
-- fk_reservas_producto (021:54-63) and productos_suplidor_id_fkey (058:53-56)
-- are all ON DELETE SET NULL and raise NO error if the wrong row was deleted.
-- These assertions re-read the kept reserva and RAISE EXCEPTION (aborting the
-- whole transaction, nothing committed) if anything is wrong.
-- =============================================================================
DO $$
DECLARE
  v_id integer;
  v_cliente_id integer;
  v_producto_id integer;
  v_reserva_count integer;
  v_n_detalles integer;
  v_n_pasajeros integer;
  v_n_ocupaciones integer;
  v_n_pagos integer;
  v_before RECORD;
BEGIN
  SELECT * INTO v_before FROM _before_snapshot;

  SELECT count(*) INTO v_reserva_count FROM reservas WHERE codigo = 'RES-1787875561067';
  IF v_reserva_count <> 1 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: expected exactly 1 surviving reserva RES-1787875561067, found %.', v_reserva_count;
  END IF;

  SELECT id, cliente_id, producto_id INTO v_id, v_cliente_id, v_producto_id
  FROM reservas WHERE codigo = 'RES-1787875561067';

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: reserva.cliente_id is NULL after cleanup (was % before) — a SET NULL FK fired, the kept client was deleted. Aborting, nothing will be committed.', v_before.cliente_id;
  END IF;
  IF v_producto_id IS NULL THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: reserva.producto_id is NULL after cleanup (was % before) — a SET NULL FK fired, the kept product was deleted. Aborting, nothing will be committed.', v_before.producto_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = v_cliente_id) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: reserva.cliente_id = % no longer exists in clientes. Aborting.', v_cliente_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM productos WHERE id = v_producto_id) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: reserva.producto_id = % no longer exists in productos. Aborting.', v_producto_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM productos p WHERE p.id = v_producto_id AND p.suplidor_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM suplidores s WHERE s.id = p.suplidor_id)
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: kept producto''s suplidor_id no longer resolves in suplidores. Aborting.';
  END IF;

  SELECT count(*) INTO v_n_detalles   FROM reserva_detalles   WHERE reserva_id = v_id;
  SELECT count(*) INTO v_n_pasajeros  FROM reserva_pasajeros   WHERE reserva_id = v_id;
  SELECT count(*) INTO v_n_ocupaciones FROM reserva_ocupaciones WHERE reserva_id = v_id;
  SELECT count(*) INTO v_n_pagos      FROM pagos               WHERE reserva_id = v_id;

  IF v_n_detalles <> v_before.n_detalles THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: reserva_detalles count for kept reserva changed from % to %. Aborting.', v_before.n_detalles, v_n_detalles;
  END IF;
  IF v_n_pasajeros <> v_before.n_pasajeros THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: reserva_pasajeros count for kept reserva changed from % to %. Aborting.', v_before.n_pasajeros, v_n_pasajeros;
  END IF;
  IF v_n_ocupaciones <> v_before.n_ocupaciones THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: reserva_ocupaciones count for kept reserva changed from % to %. Aborting.', v_before.n_ocupaciones, v_n_ocupaciones;
  END IF;
  -- AMENDMENT (T1): strictly stronger than the old "before vs after equality"
  -- check — pagos has no keep set, so the ONLY correct count after the
  -- unconditional wipe is exactly 0, for every reserva including this one.
  IF v_n_pagos <> 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: expected 0 pagos rows for kept reserva after the unconditional wipe, found %. Aborting, nothing will be committed.', v_n_pagos;
  END IF;

  RAISE NOTICE 'All post-condition assertions passed. reserva RES-1787875561067 (id=%) is intact: cliente_id=%, producto_id=%, detalles=%, pasajeros=%, ocupaciones=%, pagos=%.',
    v_id, v_cliente_id, v_producto_id, v_n_detalles, v_n_pasajeros, v_n_ocupaciones, v_n_pagos;
END $$;

-- =============================================================================
-- SECTION 5 — BALANCE DISCLOSURE (db-cleanup-decisions-amend, T3). READ-ONLY —
-- zero UPDATE statements anywhere in this file, on purpose. HC-1 branch (b)
-- chosen over branch (a) [recompute the denormalised balance columns]: (1)
-- scripts/027:53 sets balance_reserva = precio_total - abonado_contabilidad
-- while scripts/030:35 sets balance_reserva = precio_total and puts the
-- payment-derived figure in balance_general instead — the repo contradicts
-- itself, and scripts/*.sql is not evidence of live semantics anyway
-- (mistakes/schema-source-of-truth); (2) the live schema is unreachable this
-- sprint (briefing: DNS + REST both down), so there is nothing to introspect
-- to settle it; (3) app/reservas/ver/[id]/page.tsx:196-215 already recomputes
-- balance_reserva/balance_general/balance_abonado in memory from live `pagos`
-- via lib/finance.ts before rendering, so the operator-facing screen already
-- self-heals without this script writing to a single money column.
-- Candidate columns are detected at run time via information_schema.columns,
-- never hardcoded (mistakes/schema-source-of-truth): balance_reserva,
-- balance_general, balance_abonado, monto_pagado, abonado_contabilidad
-- (scripts/007:34-36, 026:53-54 — corroboration only, not proof). "Absent"
-- and "present, value = X" are reported as distinct, non-collapsed states
-- (decisions/0012-elibry-confirmacion-without-factura-numero); any present
-- value is flagged possibly stale because Step 3 above already deleted every
-- `pagos` row unconditionally.
-- =============================================================================
CREATE TEMP TABLE _balance_disclosure (balance_column text, note text) ON COMMIT DROP;

DO $$
DECLARE
  v_col  text;
  v_id   integer;
  v_val  text;
  v_cols text[] := ARRAY['balance_reserva','balance_general','balance_abonado','monto_pagado','abonado_contabilidad'];
BEGIN
  SELECT id INTO v_id FROM _keep_reserva;
  FOREACH v_col IN ARRAY v_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reservas' AND column_name = v_col
    ) THEN
      EXECUTE format('SELECT %I::text FROM reservas WHERE id = $1', v_col) INTO v_val USING v_id;
      INSERT INTO _balance_disclosure VALUES (v_col, format('PRESENT, current value = %s -- POSSIBLY STALE: pagos was unconditionally wiped above (Step 3) and this column was NOT recomputed here (disclosure only, HC-1 branch b); verify by hand or trust the app''s read-time recompute (app/reservas/ver/[id]/page.tsx:196-215, lib/finance.ts).', COALESCE(v_val, 'NULL')));
    ELSE
      INSERT INTO _balance_disclosure VALUES (v_col, 'ABSENT from this schema at run time -- nothing to disclose.');
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- FINAL REPORT — one result grid, because RAISE NOTICE is not reliably
-- surfaced by the Supabase SQL editor. Balance disclosure columns (SECTION 5)
-- are appended here so they reach the operator the same way, not NOTICE-only.
-- =============================================================================
SELECT
  'RES-1787875561067' AS reserva_kept,
  (SELECT id FROM _keep_reserva) AS reserva_id,
  (SELECT cliente_id FROM reservas WHERE codigo = 'RES-1787875561067') AS cliente_id,
  (SELECT producto_id FROM reservas WHERE codigo = 'RES-1787875561067') AS producto_id,
  (SELECT count(*) FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_detalles,
  (SELECT count(*) FROM reserva_pasajeros WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pasajeros,
  -- n_pagos is 0 by construction (AMENDMENT T1): this SELECT runs after Step
  -- 3's unconditional `DELETE FROM pagos;`, so no pago row can exist here
  -- regardless of reserva_id.
  (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos,
  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_reserva') AS balance_reserva_disclosure,
  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_general') AS balance_general_disclosure,
  (SELECT note FROM _balance_disclosure WHERE balance_column = 'balance_abonado') AS balance_abonado_disclosure,
  (SELECT note FROM _balance_disclosure WHERE balance_column = 'monto_pagado') AS monto_pagado_disclosure,
  (SELECT note FROM _balance_disclosure WHERE balance_column = 'abonado_contabilidad') AS abonado_contabilidad_disclosure,
  current_user, session_user, current_database();

-- =============================================================================
-- This is a real commit. Nothing above this line was a dry run.
-- =============================================================================
COMMIT;
