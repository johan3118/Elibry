-- 064 — PROFORMA gets its own passenger list, independent of VOUCHER's.
-- (reserva-document-entry-points sprint, Task 1 — docs/plans/reserva-document-entry-points.md §4)
--
-- HUMAN RULING 1 (settled): PROFORMA and VOUCHER keep SEPARATE passenger lists in
-- reserva_pasajeros, discriminated by a new column, still reached through the SAME
-- service-role server-action module. HUMAN RULING 2 (settled): every EXISTING row is
-- tagged 'VOUCHER' — VOUCHER sees exactly the rows it sees today, bit for bit, and
-- PROFORMA therefore starts empty on every current reserva.
--
-- WHY THE COLUMN IS NOT CALLED `documento`: reserva_pasajeros.documento ALREADY EXISTS
-- (scripts/061:80) and holds the PASSENGER'S cédula/pasaporte — it is written by
-- app/actions/documentos-actions.ts:314 and read into the CONFIRMACIÓN at
-- app/facturacion/proforma/page.tsx:383. Reusing that name would overwrite real ID
-- numbers with the literal string 'VOUCHER'. `documento_destino` = "the document this
-- passenger row belongs to". The two are unrelated and must never be conflated.
--
-- NOT PURELY ADDITIVE — READ THIS: scripts/061:83 declares UNIQUE (reserva_id, orden).
-- Both editors number their rows 1..N, so with two lists per reserva the SECOND
-- document's first INSERT violates it (SQLSTATE 23505) and the feature is structurally
-- impossible. The constraint is therefore DROPPED and RE-CREATED including the
-- discriminator. NO ROW IS DELETED and NO DATA IS DESTROYED by this migration — but it
-- does more than add a column, and that is why it is human-gated.
--
-- DEFAULT 'VOUCHER' is a DEPLOY-WINDOW SAFETY DEVICE, not an application default: it
-- keeps the live VOUCHER write path working unchanged between this migration and Task 3
-- landing. It is NOT a licence for app code to omit the value — Task 3 makes
-- documentoDestino a REQUIRED parameter with no TypeScript default, so after Task 3 no
-- INSERT from this app can ever rely on it (mistakes/stockin-zero-price: the DB default
-- covers pre-existing rows, whose value is genuinely known to be 'VOUCHER'; it never
-- stands in for an unknown one).
--
-- RLS: untouched. This is a COLUMN on an existing table, so ADR-0006's "every new table
-- ships a named policy" was already satisfied by scripts/061:106-108
-- (reserva_pasajeros_staff_all, FOR ALL TO authenticated, anon denied). There is no
-- CREATE/DROP/ALTER POLICY, no GRANT, and no ENABLE/DISABLE ROW LEVEL SECURITY below.
--
-- BEGIN/COMMIT wrap: deliberate, same reasoning as scripts/061 — this file's steps are
-- interdependent (a half-apply that adds the column but leaves the OLD unique constraint
-- in place is worse than no apply at all, because it looks done and fails only on
-- PROFORMA's first save).
--
-- ROLLBACK (verbatim, in this order):
--   BEGIN;
--   ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_reserva_id_documento_destino_orden_key;
--   ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_documento_destino_check;
--   DELETE FROM reserva_pasajeros WHERE documento_destino = 'PROFORMA';  -- required: the old
--     -- UNIQUE (reserva_id, orden) cannot be restored while two lists share an `orden`.
--     -- THIS DELETES PROFORMA PASSENGER DATA. Export it first if it matters.
--   ALTER TABLE reserva_pasajeros DROP COLUMN IF EXISTS documento_destino;
--   ALTER TABLE reserva_pasajeros ADD CONSTRAINT reserva_pasajeros_reserva_id_orden_key UNIQUE (reserva_id, orden);
--   COMMIT;

BEGIN;

-- 1. Additive column, nullable for one statement so the backfill below is real and reviewable.
ALTER TABLE reserva_pasajeros ADD COLUMN IF NOT EXISTS documento_destino text;

-- 2. HUMAN RULING 2 — THE BACKFILL. Every row that exists today belongs to VOUCHER.
UPDATE reserva_pasajeros SET documento_destino = 'VOUCHER' WHERE documento_destino IS NULL;

-- 3. Lock it down.
ALTER TABLE reserva_pasajeros ALTER COLUMN documento_destino SET DEFAULT 'VOUCHER';
ALTER TABLE reserva_pasajeros ALTER COLUMN documento_destino SET NOT NULL;

-- 4. CHECK constraint (same style as scripts/061:79's tipo_pax). DROP-then-ADD because
--    Postgres has no ADD CONSTRAINT IF NOT EXISTS; this keeps the file re-runnable.
ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_documento_destino_check;
ALTER TABLE reserva_pasajeros ADD CONSTRAINT reserva_pasajeros_documento_destino_check
  CHECK (documento_destino IN ('VOUCHER','PROFORMA'));

-- 5. THE UNIQUENESS SWAP. If the name on the next line does not match pre-flight query (2),
--    FIX IT BEFORE RUNNING — a no-op DROP here ships a latent 23505.
ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_reserva_id_orden_key;
ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_reserva_id_documento_destino_orden_key;
ALTER TABLE reserva_pasajeros ADD CONSTRAINT reserva_pasajeros_reserva_id_documento_destino_orden_key
  UNIQUE (reserva_id, documento_destino, orden);

COMMIT;
