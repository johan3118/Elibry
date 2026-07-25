-- Shared passenger + room-occupancy storage for CONFIRMACIÓN DE SERVICIOS & VOUCHER
-- (geb-documents-real-data sprint, Task 1 — see docs/plans/geb-documents-real-data.md §4.1)
--
-- Two tables, created together. Deliberate, stated deviation from the spec's
-- grouping: the spec listed room-occupancy under Part B, but OQ2/OQ1 supersedes
-- with "ONE shared table/structure designed once and reused by BOTH documents…
-- VOUCHER's room-grouped display". A passenger row's room grouping is a foreign
-- key into the occupancy table; creating that table in Part B would force
-- reserva_pasajeros to ship a dangling nullable int here and gain its FK
-- constraint eight tasks later. Creating both tables now honors "designed once".
--
-- reserva_pasajeros.nombre_completo is NOT NULL with a CHECK that it contains at
-- least one non-whitespace character (block-never-default, per
-- mistakes/stockin-zero-price): a missing, empty, or all-whitespace (including
-- tab/newline-only, which bare btrim() would miss — ASCII space is not the only
-- whitespace character) passenger name can never be persisted as if it were real
-- data. The CHECK uses the `\S` regex escape (Postgres ARE syntax, matches
-- `[^[:space:]]`) rather than `length(btrim(...)) > 0`, since btrim only strips
-- spaces by default and would let a tab- or newline-only string through. No
-- column in either table carries a DEFAULT that could stand in for real data.
--
-- reserva_pasajeros.ocupacion_id is a COMPOSITE foreign key on
-- (ocupacion_id, reserva_id) -> reserva_ocupaciones(id, reserva_id), not a
-- single-column FK on ocupacion_id alone. A single-column FK only guarantees the
-- referenced occupancy row exists somewhere; it does not guarantee that row
-- belongs to the SAME reservation as the passenger, which would let a future bug
-- in a service-role action link a passenger to another reservation's room group.
-- The composite FK closes that hole. It requires a matching UNIQUE (id,
-- reserva_id) on reserva_ocupaciones (Postgres requires a unique constraint
-- whose column set exactly matches the referenced columns; the existing PRIMARY
-- KEY on `id` alone does not satisfy that for a 2-column reference, even though
-- id alone already guarantees the tuple is unique).
--
-- The FK uses `ON DELETE SET NULL (ocupacion_id)` — the Postgres 15+ column-list
-- form — rather than a bare `ON DELETE SET NULL`. A bare SET NULL on a composite
-- FK nulls ALL referencing columns, which here would include reserva_id; since
-- reserva_pasajeros.reserva_id is NOT NULL, deleting a single reserva_ocupaciones
-- row (independent of its parent reserva) while passengers still reference it
-- would raise a NOT NULL violation and abort the delete. The column-list form
-- nulls only ocupacion_id, correctly unlinking the passenger from its room group
-- without touching reserva_id.
--
-- Single-tenant posture per OQ3: NO org_id is invented (repo-wide grep found
-- zero existing RLS policies; Elibry is single-tenant as of this sprint). RLS
-- is enabled on both tables with a `TO authenticated` FOR ALL policy — see the
-- comment on the policy block below for the retrofit rationale.
--
-- ROLLBACK: DROP TABLE IF EXISTS reserva_pasajeros; DROP TABLE IF EXISTS reserva_ocupaciones;

-- Wrapped in an explicit transaction — a deliberate exception to this repo's other 58 migrations
-- (which run un-wrapped): 061 is the first migration here with a version-gated hard syntax dependency
-- (the PG15-only `ON DELETE SET NULL (col)` form below), so a partial apply on PG14 is a real risk in a
-- way it is not for the others; atomicity is now a property of the FILE, not of whoever remembers a flag
-- later (works the same whether invoked as bare `psql -f`, `psql -f -v ON_ERROR_STOP=1`, or pasted into the
-- Supabase SQL Editor, which already opens its own transaction — nesting BEGIN there just emits a harmless
-- NOTICE and continues in the same outer transaction). Do NOT copy this BEGIN/COMMIT wrap into future
-- migrations that don't share this specific version-gated risk.
BEGIN;

CREATE TABLE IF NOT EXISTS reserva_ocupaciones (
  id             serial PRIMARY KEY,
  reserva_id     integer NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  orden          integer NOT NULL,                       -- render order
  cantidad       integer NOT NULL CHECK (cantidad > 0),   -- "X 8 HABITACIONES"
  ocupacion      text    NOT NULL,                        -- "DOBLE" | "TRIPLE" | ...
  categoria      text    NOT NULL,                        -- "Junior Suite Superior"
  fecha_creado   timestamptz NOT NULL DEFAULT now(),
  registrado_por text,
  UNIQUE (reserva_id, orden),
  UNIQUE (id, reserva_id)                                 -- composite-FK target for reserva_pasajeros.ocupacion_id
);

CREATE TABLE IF NOT EXISTS reserva_pasajeros (
  id              serial PRIMARY KEY,
  reserva_id      integer NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  ocupacion_id    integer NULL,                           -- NULL allowed (MATCH SIMPLE, the default); FK below
  orden           integer NOT NULL,                       -- CONFIRMACIÓN's "1) 2) 3)"
  nombre_completo text    NOT NULL CHECK (nombre_completo ~ '\S'),
  tipo_pax        text    NOT NULL CHECK (tipo_pax IN ('ADULTO','NINO','INFANTE')),
  documento       text    NULL,                           -- cédula/pasaporte
  fecha_creado    timestamptz NOT NULL DEFAULT now(),
  registrado_por  text,
  UNIQUE (reserva_id, orden),
  FOREIGN KEY (ocupacion_id, reserva_id)
    REFERENCES reserva_ocupaciones (id, reserva_id)
    ON DELETE SET NULL (ocupacion_id)                     -- nulls only ocupacion_id; reserva_id (NOT NULL) is untouched
);

CREATE INDEX IF NOT EXISTS idx_reserva_pasajeros_reserva_id ON reserva_pasajeros(reserva_id);
CREATE INDEX IF NOT EXISTS idx_reserva_ocupaciones_reserva_id ON reserva_ocupaciones(reserva_id);

-- RLS — mandatory, both tables.
ALTER TABLE reserva_pasajeros   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserva_ocupaciones ENABLE ROW LEVEL SECURITY;

-- Single-tenant posture per OQ3. NO org_id is invented.
-- No grant to `anon`: the browser (which runs as anon, see finding F2) is denied.
-- All application access is designed to go through app/actions/documentos-actions.ts (T2, not yet
-- started), whose service-role client bypasses RLS. The `TO authenticated` grant is the retrofit
-- seam: when real Supabase Auth lands, staff read/write turns on with no reshape,
-- and when multi-tenancy lands, `true` becomes the org predicate in-place.
--
-- DROP POLICY IF EXISTS guards make the script safely re-runnable (this repo's
-- CREATE TABLE / CREATE INDEX statements above use IF NOT EXISTS for the same
-- reason; CREATE POLICY has no IF NOT EXISTS form in Postgres).
DROP POLICY IF EXISTS reserva_pasajeros_staff_all ON reserva_pasajeros;
CREATE POLICY reserva_pasajeros_staff_all   ON reserva_pasajeros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS reserva_ocupaciones_staff_all ON reserva_ocupaciones;
CREATE POLICY reserva_ocupaciones_staff_all ON reserva_ocupaciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
