-- Widen auditoria.accion's CHECK constraint by exactly one value: 'DISCREPANCIA'
-- (geb-documents-real-data sprint, Task 5 — see docs/plans/geb-documents-real-data.md §4.3/§9 HC-3)
--
-- WHY: the human ruled (HC-3) that when a reserva's Σreserva_detalles.total
-- disagrees with reservas.precio_total, CONFIRMACIÓN DE SERVICIOS still
-- generates normally, and the discrepancy is recorded as a REAL PERSISTED
-- ROW — never console.log/console.warn. The architect chose the EXISTING
-- `auditoria` table (scripts/001-create-tables.sql:158-167) over two
-- rejected alternatives (see below), because its shape already fits: tabla,
-- registro_id, datos_nuevos JSONB, usuario NOT NULL, fecha DEFAULT NOW().
-- The one obstacle: `accion VARCHAR(20) NOT NULL CHECK (accion IN
-- ('INSERT','UPDATE','DELETE'))` has no value meaning "observation, no row
-- changed" — hence this migration widens it by exactly one value.
--
-- REJECTED ALTERNATIVES (do not re-propose — see §4.3):
--   - acciones_pendientes (lib/admin-actions.ts): an approval QUEUE surfaced
--     to operators as live work items (estado:'PENDIENTE',
--     usuario_solicitante). Writing a discrepancy there would inject a
--     phantom approval task onto a live workflow screen. Wrong semantics.
--   - A dedicated new table `documento_discrepancias`: would be a NEW TABLE
--     requiring its own RLS policy under §4.1's rule. Not the smaller
--     change versus a one-value CHECK widening. If the human prefers a
--     dedicated table, that is a new T1-style schema task with a named
--     policy — a dev must not swap unilaterally.
--
-- EXISTENCE IS NOT ASSUMED: scripts/058-fix-auditoria-table.sql:8 already
-- guards `auditoria` with an information_schema.tables check, because the
-- table may be absent in some environments (the same class of uncertainty
-- as finding F1). This migration mirrors that guard and no-ops (with a
-- RAISE NOTICE) when the table does not exist.
--
-- THE REAL CONSTRAINT NAME IS NOT ASSUMED EITHER: scripts/001 declares the
-- CHECK inline (`accion VARCHAR(20) NOT NULL CHECK (accion IN (...))`), so
-- Postgres auto-generated its name. `auditoria_accion_check` is the
-- EXPECTED name under Postgres's default <table>_<column>_check
-- convention, but per the plan it must be READ from pg_constraint rather
-- than guessed. This migration does that at ALTER-time: it looks up the
-- real CHECK constraint on `auditoria` whose definition mentions `accion`,
-- drops THAT (whatever it is actually named), and re-adds a constraint
-- (explicitly named `auditoria_accion_check` going forward, for a stable,
-- greppable name) with 'DISCREPANCIA' added to the allowed list. This is
-- also what makes the script idempotent: re-running it finds and replaces
-- whatever constraint is currently there (original 3-value or already-
-- widened 4-value) with the same widened definition.
--
-- RLS: none required. This is not a new table — auditoria has no RLS today
-- (repo-wide grep: zero policies anywhere) and this migration does not add
-- or weaken any policy. The discrepancy write goes through the service-role
-- server action (registrarDiscrepanciaTotalesAction) regardless, per
-- Approach C.
--
-- DEFERRED — cannot be verified live in this environment (no .env, no
-- psql, no supabase CLI, Docker down; STANDING HUMAN RULING: DB work is
-- verified by static review only for this sprint). The closing command to
-- run against the target DB, both BEFORE and AFTER applying this file:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'auditoria'::regclass AND contype = 'c';
-- BEFORE should show the original 3-value CHECK (name TBD, expected
-- 'auditoria_accion_check'); AFTER should show the 4-value CHECK including
-- 'DISCREPANCIA', named 'auditoria_accion_check'. Also confirm `auditoria`
-- exists at all (`SELECT to_regclass('auditoria');` should be non-null)
-- before assuming this migration did anything other than no-op.
--
-- ROLLBACK:
--   DO $$
--   DECLARE
--     v_conname text;
--   BEGIN
--     IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'auditoria') THEN
--       SELECT conname INTO v_conname FROM pg_constraint
--         WHERE conrelid = 'auditoria'::regclass AND contype = 'c'
--           AND pg_get_constraintdef(oid) ILIKE '%accion%';
--       IF v_conname IS NOT NULL THEN
--         EXECUTE format('ALTER TABLE auditoria DROP CONSTRAINT %I', v_conname);
--       END IF;
--       ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check
--         CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE'));
--     END IF;
--   END $$;

DO $$
DECLARE
  v_conname text;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'auditoria') THEN
    -- Find the real CHECK constraint on auditoria that constrains `accion`,
    -- whatever Postgres actually named it — never assume 'auditoria_accion_check'.
    SELECT conname INTO v_conname
    FROM pg_constraint
    WHERE conrelid = 'auditoria'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%accion%';

    IF v_conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE auditoria DROP CONSTRAINT %I', v_conname);
    END IF;

    ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check
      CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE', 'DISCREPANCIA'));

    RAISE NOTICE 'auditoria.accion CHECK widened to include DISCREPANCIA (previous constraint name: %)',
      COALESCE(v_conname, '<none found>');
  ELSE
    RAISE NOTICE 'Tabla auditoria no existe — migración 063 fue un no-op (mismo patrón de guarda que scripts/058-fix-auditoria-table.sql:8)';
  END IF;
END $$;
