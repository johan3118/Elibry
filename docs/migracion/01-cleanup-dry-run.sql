-- =============================================================================
-- 01-cleanup-dry-run.sql — READ-ONLY. Physically incapable of harm.
-- =============================================================================
-- Elibry — DB cleanup keeping only reserva RES-1787875561067
-- Companion files: 02-cleanup-execute.sql (destructive), README-cleanup.md (runbook)
--
-- This file contains ZERO DELETE / TRUNCATE / UPDATE / ALTER / setval statements.
-- Every statement below is a SELECT (a small number use to_regclass()/
-- information_schema, which are themselves read-only catalog lookups). It is
-- safe to paste this whole file into any SQL client, any number of times, in
-- any order, against the live database — nothing it does can change a row.
--
-- Run this FIRST. Read every result grid. Only after you understand and accept
-- what Query 3 says will be deleted should you open 02-cleanup-execute.sql.
--
-- Spec: docs/plans/db-cleanup-keep-one-reserva.md (architect's research —
-- schema evidence, file:line citations, and the hazards below are inherited
-- from it; read it for the "why", this file is the "what you will see").
--
-- HOW TO READ QUERY 3's caveats:
--   - "auditoria" rows_to_delete is a LOWER BOUND. scripts/001-create-tables.sql:
--     220-260 installs AFTER INSERT/UPDATE/DELETE triggers on clientes/
--     productos/reservas/pagos/suplidores that write a NEW row into `auditoria`
--     on every DELETE. Running 02 will therefore leave MORE rows in `auditoria`
--     mid-run than this dry run shows, until the script's own final DELETE FROM
--     auditoria (which runs LAST, see 02's Section A step 17).
--   - "comprobantes_fiscales" and the 9 CLAUDE.md-undeclared tables (see Query 5)
--     use PLANNER ROW-COUNT ESTIMATES (pg_stat_user_tables.n_live_tup), not exact
--     COUNT(*). This is a deliberate, documented trade-off: a table that may not
--     exist cannot appear in a static FROM clause without erroring the whole
--     script (Postgres validates table references at parse time, not runtime),
--     so an exact conditional COUNT(*) for an uncertain table requires dynamic
--     SQL/EXECUTE — which this file refuses to use anywhere, on principle, to
--     keep it trivially auditable as "only SELECT". If a row in Query 5 shows
--     existe = true and you want an exact count, run
--     `SELECT count(*) FROM <tabla>;` by hand for that one table. n_live_tup can
--     be stale if the table hasn't been ANALYZEd recently; run `ANALYZE;`
--     yourself first (outside this file) if you want a fresher estimate — this
--     file does not do it for you because ANALYZE is not a SELECT either.
-- =============================================================================


-- =============================================================================
-- QUERY 1 — Loud preflight status. READ THIS FIRST.
-- =============================================================================
SELECT
  CASE
    WHEN cnt = 1 THEN 'OK — exactly one reserva with codigo = ''RES-1787875561067'' found. Safe to read on.'
    WHEN cnt = 0 THEN '*** ABORT *** reserva RES-1787875561067 NOT FOUND in reservas. DO NOT RUN 02-cleanup-execute.sql — it has its own hard guard and will refuse to run too, but stop here regardless and investigate first.'
    ELSE '*** ABORT *** ' || cnt || ' rows share codigo = ''RES-1787875561067'' (should be UNIQUE — reservas.codigo UNIQUE NOT NULL, scripts/007-create-reservas-table.sql:4). Investigate a schema/data integrity problem before proceeding.'
  END AS estado_preflight,
  cnt AS filas_encontradas
FROM (SELECT count(*) AS cnt FROM reservas WHERE codigo = 'RES-1787875561067') s;


-- =============================================================================
-- QUERY 2 — The resolved KEEP set (upward + downward closure of RES-1787875561067).
-- Mirrors the CTEs 02-cleanup-execute.sql will materialise into temp tables.
-- No ids are hardcoded anywhere — everything is derived from reservas.codigo.
-- =============================================================================
WITH keep_reserva AS (
  SELECT id, cliente_id, producto_id FROM reservas WHERE codigo = 'RES-1787875561067'
),
keep_producto AS (
  SELECT producto_id AS id FROM keep_reserva WHERE producto_id IS NOT NULL
),
keep_suplidor AS (
  SELECT p.suplidor_id AS id
  FROM productos p
  WHERE p.id IN (SELECT id FROM keep_producto) AND p.suplidor_id IS NOT NULL
),
keep_pago AS (
  SELECT id, cliente_id FROM pagos WHERE reserva_id IN (SELECT id FROM keep_reserva)
),
keep_cliente AS (
  SELECT cliente_id AS id FROM keep_reserva WHERE cliente_id IS NOT NULL
  UNION
  SELECT cliente_id AS id FROM keep_pago WHERE cliente_id IS NOT NULL
),
keep_detalle AS (
  SELECT id FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM keep_reserva)
),
keep_pasajero AS (
  SELECT id FROM reserva_pasajeros WHERE reserva_id IN (SELECT id FROM keep_reserva)
),
keep_ocupacion AS (
  SELECT id FROM reserva_ocupaciones WHERE reserva_id IN (SELECT id FROM keep_reserva)
)
SELECT 'reserva.id' AS entidad, id::text AS valor FROM keep_reserva
UNION ALL SELECT 'reserva.cliente_id (raw, may be NULL)', cliente_id::text FROM keep_reserva
UNION ALL SELECT 'reserva.producto_id (raw, may be NULL)', producto_id::text FROM keep_reserva
UNION ALL SELECT 'keep_cliente.id (reserva + pagos union)', id::text FROM keep_cliente
UNION ALL SELECT 'keep_producto.id', id::text FROM keep_producto
UNION ALL SELECT 'keep_suplidor.id', id::text FROM keep_suplidor
UNION ALL SELECT 'keep_pago.id', id::text FROM keep_pago
UNION ALL SELECT 'keep_detalle.id (reserva_detalles)', id::text FROM keep_detalle
UNION ALL SELECT 'keep_pasajero.id (reserva_pasajeros)', id::text FROM keep_pasajero
UNION ALL SELECT 'keep_ocupacion.id (reserva_ocupaciones)', id::text FROM keep_ocupacion
ORDER BY 1, 2;


-- =============================================================================
-- QUERY 3 — Per-table report: rows_total / rows_to_keep / rows_to_delete.
-- Covers the 17 declared tables (scripts/*.sql) whose existence is NOT in doubt
-- (i.e. all 18 declared tables from the plan's §0.1 census EXCEPT
-- comprobantes_fiscales, which scripts/039-create-comprobantes-disponibles-
-- table.sql:2 DROPs — see Query 4 for that one). This is what 02's Section A/B
-- would do if run right now with these rows.
-- seccion: A = business data, deleted by 02 by default.
--          B = config/master data, 02 keeps this COMMENTED OUT by default
--              (rows_to_delete shown here is what WOULD be deleted only if the
--              operator opts in — 02 does not do this unless uncommented).
-- =============================================================================
WITH keep_reserva AS (
  SELECT id, cliente_id, producto_id FROM reservas WHERE codigo = 'RES-1787875561067'
),
keep_producto AS (
  SELECT producto_id AS id FROM keep_reserva WHERE producto_id IS NOT NULL
),
keep_suplidor AS (
  SELECT p.suplidor_id AS id
  FROM productos p
  WHERE p.id IN (SELECT id FROM keep_producto) AND p.suplidor_id IS NOT NULL
),
keep_pago AS (
  SELECT id, cliente_id FROM pagos WHERE reserva_id IN (SELECT id FROM keep_reserva)
),
keep_cliente AS (
  SELECT cliente_id AS id FROM keep_reserva WHERE cliente_id IS NOT NULL
  UNION
  SELECT cliente_id AS id FROM keep_pago WHERE cliente_id IS NOT NULL
),
keep_detalle AS (
  SELECT id FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM keep_reserva)
),
keep_pasajero AS (
  SELECT id FROM reserva_pasajeros WHERE reserva_id IN (SELECT id FROM keep_reserva)
),
keep_ocupacion AS (
  SELECT id FROM reserva_ocupaciones WHERE reserva_id IN (SELECT id FROM keep_reserva)
),
-- polymorphic keep sets (inferred from app code, not a declared FK — plan §0.4)
keep_cambios AS (
  SELECT cp.id
  FROM cambios_provisionales cp
  WHERE (cp.tabla_afectada = 'reservas'           AND cp.registro_id IN (SELECT id FROM keep_reserva))
     OR (cp.tabla_afectada = 'clientes'           AND cp.registro_id IN (SELECT id FROM keep_cliente))
     OR (cp.tabla_afectada = 'productos'          AND cp.registro_id IN (SELECT id FROM keep_producto))
     OR (cp.tabla_afectada = 'suplidores'         AND cp.registro_id IN (SELECT id FROM keep_suplidor))
     OR (cp.tabla_afectada = 'pagos'              AND cp.registro_id IN (SELECT id FROM keep_pago))
     OR (cp.tabla_afectada = 'reserva_detalles'   AND cp.registro_id IN (SELECT id FROM keep_detalle))
     OR (cp.tabla_afectada = 'reserva_pasajeros'  AND cp.registro_id IN (SELECT id FROM keep_pasajero))
     OR (cp.tabla_afectada = 'reserva_ocupaciones' AND cp.registro_id IN (SELECT id FROM keep_ocupacion))
),
keep_acciones AS (
  SELECT ap.id
  FROM acciones_pendientes ap
  WHERE (ap.tabla_objetivo = 'reservas'            AND ap.registro_id IN (SELECT id FROM keep_reserva))
     OR (ap.tabla_objetivo = 'clientes'            AND ap.registro_id IN (SELECT id FROM keep_cliente))
     OR (ap.tabla_objetivo = 'productos'           AND ap.registro_id IN (SELECT id FROM keep_producto))
     OR (ap.tabla_objetivo = 'suplidores'          AND ap.registro_id IN (SELECT id FROM keep_suplidor))
     OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM keep_pago))
     OR (ap.tabla_objetivo = 'reserva_detalles'    AND ap.registro_id IN (SELECT id FROM keep_detalle))
     OR (ap.tabla_objetivo = 'reserva_pasajeros'   AND ap.registro_id IN (SELECT id FROM keep_pasajero))
     OR (ap.tabla_objetivo = 'reserva_ocupaciones' AND ap.registro_id IN (SELECT id FROM keep_ocupacion))
)
SELECT 'reservas' AS tabla, 'A' AS seccion, count(*) AS rows_total,
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_reserva)) AS rows_to_keep,
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_reserva)) AS rows_to_delete
FROM reservas
UNION ALL
SELECT 'clientes', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_cliente)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_cliente))
FROM clientes
UNION ALL
SELECT 'productos', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_producto)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_producto))
FROM productos
UNION ALL
SELECT 'suplidores', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_suplidor)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_suplidor))
FROM suplidores
UNION ALL
SELECT 'pagos', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_pago)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_pago))
FROM pagos
UNION ALL
SELECT 'reserva_detalles', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_detalle)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_detalle))
FROM reserva_detalles
UNION ALL
SELECT 'reserva_pasajeros', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_pasajero)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_pasajero))
FROM reserva_pasajeros
UNION ALL
SELECT 'reserva_ocupaciones', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_ocupacion)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_ocupacion))
FROM reserva_ocupaciones
UNION ALL
SELECT 'cambios_provisionales', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_cambios)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_cambios))
FROM cambios_provisionales
UNION ALL
SELECT 'acciones_pendientes', 'A', count(*),
       count(*) FILTER (WHERE id IN (SELECT id FROM keep_acciones)),
       count(*) FILTER (WHERE id NOT IN (SELECT id FROM keep_acciones))
FROM acciones_pendientes
UNION ALL
-- empty keep sets — everything in these is deleted by Section A (see 02, steps 1/2/15)
SELECT 'seguimiento_comentarios', 'A', count(*), 0, count(*) FROM seguimiento_comentarios
UNION ALL
SELECT 'seguimiento_casos', 'A', count(*), 0, count(*) FROM seguimiento_casos
UNION ALL
SELECT 'auditoria', 'A', count(*), 0, count(*) FROM auditoria
UNION ALL
-- config / master data — Section B, commented out by default in 02 (rows_to_delete
-- here is hypothetical: what an opt-in run would remove, NOT what 02 does by default)
SELECT 'usuarios', 'B', count(*), count(*), 0 FROM usuarios
UNION ALL
SELECT 'colaboradores', 'B', count(*), count(*), 0 FROM colaboradores
UNION ALL
SELECT 'tipos_productos', 'B', count(*), count(*), 0 FROM tipos_productos
ORDER BY seccion, tabla;


-- =============================================================================
-- QUERY 4 — comprobantes_fiscales: existence + shape are AMBIGUOUS (see the
-- plan's §3.2). scripts/038 creates it; scripts/039:2 DROPs it CASCADE; but
-- app/facturacion/fiscal/page.tsx:674-675 inserts reserva_id/cliente_id columns
-- neither migration declares. Existence checked via to_regclass (read-only
-- catalog lookup); row count via planner estimate (see file header) because a
-- table that might not exist cannot appear in a static FROM clause.
-- =============================================================================
SELECT
  'comprobantes_fiscales' AS tabla,
  (to_regclass('public.comprobantes_fiscales') IS NOT NULL) AS existe,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'comprobantes_fiscales' AND column_name = 'reserva_id'
  ) AS tiene_columna_reserva_id,
  s.n_live_tup AS filas_estimadas,
  CASE
    WHEN to_regclass('public.comprobantes_fiscales') IS NULL
      THEN 'AUSENTE — matches 039:2 DROP TABLE ... CASCADE. Nothing for 02 to do.'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'comprobantes_fiscales' AND column_name = 'reserva_id'
    ) THEN 'PRESENTE but no reserva_id column — declared shape (038) has no reserva link. 02 will leave it untouched and print a NOTICE rather than guess.'
    ELSE 'PRESENTE with a reserva_id column (matches app/facturacion/fiscal/page.tsx:674-675, not any migration). 02''s FISCAL GATE will delete rows NOT linked to the kept reserva.'
  END AS nota
FROM (SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = 'comprobantes_fiscales') s
UNION ALL
SELECT 'comprobantes_fiscales', (to_regclass('public.comprobantes_fiscales') IS NOT NULL), false, NULL, 'AUSENTE — matches 039:2 DROP TABLE ... CASCADE. Nothing for 02 to do.'
WHERE NOT EXISTS (SELECT 1 FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = 'comprobantes_fiscales');


-- =============================================================================
-- QUERY 5 — Existence of the 9 CLAUDE.md-named tables absent from every
-- scripts/*.sql CREATE TABLE (plan §0.2). None have a `.from("...")` call
-- anywhere in app/lib/tests either (independently re-grepped for this task).
-- `documentos` is a Storage BUCKET (lib/supabase.ts:68), not a SQL table —
-- it will always show existe = false here, which is correct and expected.
-- =============================================================================
SELECT
  t.tabla,
  (to_regclass('public.' || t.tabla) IS NOT NULL) AS existe,
  s.n_live_tup AS filas_estimadas,
  CASE
    WHEN to_regclass('public.' || t.tabla) IS NULL
      THEN 'AUSENTE — matches scripts/*.sql (never created). Also matches zero .from("' || t.tabla || '") calls in app/lib/tests.'
    ELSE 'EXISTS despite no CREATE TABLE in scripts/ — created out-of-band (Supabase dashboard). Section B (config, commented) in 02, except documentos which is not applicable here.'
  END AS nota
FROM (VALUES
  ('usuarios_sistema'), ('datos_maestros'), ('parametros_sistema'),
  ('configuracion_empresa'), ('permisos_roles'),
  ('audit_logs'), ('logs'), ('performance_metrics'),
  ('documentos')
) AS t(tabla)
LEFT JOIN pg_stat_user_tables s ON s.schemaname = 'public' AND s.relname = t.tabla
ORDER BY t.tabla;
