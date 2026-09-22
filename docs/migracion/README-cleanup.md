# DB cleanup — keep only reserva `RES-1787875561067`

Operator runbook for the two SQL files in this directory. Read this whole file
before running either script. Spec: `docs/plans/db-cleanup-keep-one-reserva.md`
(architect's research — schema evidence, file:line citations, all the "why").

**Files:**
- `01-cleanup-dry-run.sql` — read-only, zero risk, run first.
- `02-cleanup-execute.sql` — destructive, real `COMMIT`, no dry-run mode.

**Design note — why two files instead of one dry-run-via-ROLLBACK script:**
The original plan wrapped everything in one file that ended in `ROLLBACK;` by
default. That was rejected: the Supabase SQL editor wraps whatever you paste
in its own implicit transaction (`scripts/061-create-reserva-pasajeros-
ocupaciones.sql:53-57` already documents that a nested `BEGIN` there "just
emits a harmless NOTICE and continues in the same outer transaction"), and
whether an explicit `ROLLBACK` inside that outer transaction is honored
depends on the editor version — untestable from this workspace. If it isn't
honored, a "dry run" would silently commit a full data wipe. Splitting into a
file that is *physically incapable* of writing anything (01) and a separate
file that *always* really commits (02) removes that failure mode structurally
instead of trying to detect it at runtime.

---

## Step 1 — Backup (do this before anything else)

The credentials in this repo's `.env.local` are **dead** — the Supabase
project they point to no longer exists. You must obtain **live** credentials
for the actual target database before you can do anything below, including
the backup.

Once you have live credentials, take one of these backups:

```bash
# Option A — pg_dump (run from wherever you have psql/pg_dump and the live
# connection string; NOT this dead .env.local):
pg_dump "postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require" \
  --format=custom --file="elibry_backup_$(date +%Y%m%d_%H%M%S).dump"

# Verify the dump is non-empty and actually restorable-shaped:
pg_restore --list "elibry_backup_$(date +%Y%m%d_%H%M%S).dump" | head -20
```

```bash
# Option B — Supabase dashboard: Database > Backups > "Create backup now",
# or Database > Branching > create a branch from the current state before
# running 02. Either way, confirm the backup/branch timestamp is AFTER the
# moment you read this, not a stale nightly backup.
```

**Do not proceed to Step 2 until you have a verified, restorable backup.**
For a committed run of `02-cleanup-execute.sql`, restoring this backup is the
*only* way to undo it — there is no undo script (see "Rollback" at the
bottom).

---

## Step 2 — Transaction-honoring probe (do this before pasting 02 anywhere)

This is cheap and non-destructive. Paste it alone into whatever client you
plan to run `02-cleanup-execute.sql` through:

```sql
BEGIN;
CREATE TEMP TABLE _tx_probe(x int);
ROLLBACK;
SELECT to_regclass('pg_temp._tx_probe');   -- MUST return NULL
```

- **Returns `NULL`** → your client honors an explicit `ROLLBACK` inside its
  own wrapping transaction. Either channel below is safe.
- **Returns anything else (non-NULL)** → your client did **not** honor the
  rollback. **Do not trust ROLLBACK-based dry runs in this client for
  anything, ever.** This does not block you from running `02` (it has no
  ROLLBACK — it is a real, honest transaction that always ends in `COMMIT` or
  aborts entirely on error), but it does mean: never paste ad-hoc
  `BEGIN; ...; ROLLBACK;` experiments into this client expecting them to be
  undone.

**Recommended channel:** `psql` from a terminal, not a browser SQL editor:

```bash
psql "postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require" \
  -v ON_ERROR_STOP=1 -f 01-cleanup-dry-run.sql
```

`-v ON_ERROR_STOP=1` makes `psql` stop at the first error instead of plowing
through the rest of the file — important for `02` in particular, though `02`
is already one transaction so a mid-file error aborts everything regardless.
The Supabase SQL editor is an acceptable fallback for `01` (it's read-only,
nothing to lose) and, after the probe passes, for `02` as well.

---

## Step 3 — Run the dry run

```bash
psql "<live connection string>" -v ON_ERROR_STOP=1 -f 01-cleanup-dry-run.sql
```

or paste `01-cleanup-dry-run.sql` into the Supabase SQL editor. It cannot
write anything — see the file's own header for why. It produces 5 result
grids: **Query 1** — loud abort-or-proceed status if the reserva isn't found
or isn't unique. **Query 2** — the resolved KEEP set (ids). **Query 3** — the
main table: `rows_total` / `rows_to_keep` / `rows_to_delete` per business
table. **Query 4** — `comprobantes_fiscales` existence + shape (ambiguous,
see below). **Query 5** — existence of the 9 tables named in `CLAUDE.md` that
no migration in `scripts/*.sql` declares.

## Step 4 — Read the report

- If **Query 1** says ABORT, stop. Do not run `02`.
- In **Query 3**, `rows_to_delete` for section `A` rows is exactly what `02`
  will remove by default. Section `B` rows show what an *opt-in* run would
  remove — `02` leaves them alone unless you hand-uncomment a line.
- A suspicious row looks like: a table you expected to have a large
  `rows_to_keep` showing `0` (the KEEP set didn't resolve what you thought),
  or `rows_to_keep` for `reservas` not equal to `1`.
- `auditoria`'s `rows_to_delete` in the dry run is a **lower bound** — every
  delete in Section A writes a fresh row into `auditoria` via the trigger at
  `scripts/001-create-tables.sql:220-260`, so `02` will remove more rows from
  `auditoria` than `01` reported. This is documented in `02`'s own comments
  at the `auditoria` step and is expected, not a bug.
- **RLS caveat:** `reserva_pasajeros` / `reserva_ocupaciones` have RLS enabled
  (`scripts/061-create-reserva-pasajeros-ocupaciones.sql:93-94`) with a policy
  granted `TO authenticated` only, and neither table has `FORCE ROW LEVEL
  SECURITY`, so the table **owner** bypasses RLS. If you run `02` as any role
  other than the table owner, its `DELETE`s on these two tables could silently
  match zero rows. Check `current_user` in `02`'s final report grid against
  who owns these tables if those counts look wrong.

---

## Step 5 — Sign-offs before running `02`

- [ ] **Fiscal sign-off.** `02`'s `-- FISCAL GATE --` block deletes rows from
  `comprobantes_fiscales` (a supplier-invoice table,
  `scripts/038-create-comprobantes-fiscales-table.sql:9-10`) that are not
  linked to the kept reserva — but only if the table exists **and** has a
  `reserva_id` column, both checked at runtime. Per `CLAUDE.md` ("Fiscal (NCF
  / e-CF) correctness is high-stakes → senior + human-gated"), get a fiscal
  sign-off before running `02`, or comment out the whole `FISCAL GATE` block
  (instructions are inline in `02`) to skip it entirely.
- [ ] **Section B opt-in decision.** By default `02` does not touch any
  config/master-data table. If you want to also wipe any of `usuarios`,
  `colaboradores`, `tipos_productos`, etc., decide which ones now and
  uncomment only those lines in `02`'s Section B. Do **not** uncomment
  `comprobantes_disponibles` without separate fiscal authority — see the
  compliance warning in `02`'s own Section B header (it holds live DGII NCF
  sequence state).
- [ ] **Section C (sequences) opt-in decision.** Optional, commented out.
  Only needed if you plan to insert new rows via the raw sequence (most of
  this app's write paths compute `id` client-side instead — see
  `lib/provisional-system.ts:132-142`).

---

## Step 6 — Run `02-cleanup-execute.sql`

```bash
psql "<live connection string>" -v ON_ERROR_STOP=1 -f 02-cleanup-execute.sql
```

This is one real transaction: `BEGIN;` ... `COMMIT;`. There is no `ROLLBACK`
in this file — if any statement errors, Postgres aborts the whole transaction
automatically and nothing is changed. Watch for:

- **`ABORT: expected exactly 1 reserva ...`** (Guard 1) — the reserva wasn't
  found, or wasn't unique. Nothing was touched. Investigate before re-running.
- **`ABORT: reserva ... has cliente_id/producto_id IS NULL`** (Guard 2) — the
  reserva to keep is already a partial husk (legal since
  `scripts/058-fix-auditoria-table.sql:64-65` dropped `NOT NULL` from both
  columns). Nothing was touched. This needs a human decision, not a re-run.
- **`record "new" is not assigned yet`** (or similar, around the
  `reserva_detalles` delete) — this is the unresolved **R-TRIGGER** risk:
  `recalcular_totales_reserva()` (`scripts/023-create-reserva-detalles-table-
  fixed.sql:49-94`) references `NEW` in a DELETE-only context. If you see
  this, uncomment the two `ALTER TABLE ... DISABLE/ENABLE TRIGGER` lines
  bracketing that one `DELETE FROM reserva_detalles` in `02`, then re-run the
  **whole file from the top** (the aborted transaction changed nothing). Also
  report this separately — it is a live app bug, not something this cleanup
  should paper over silently.
- **`POST-CHECK FAILED: ...`** — the integrity assertions at the end caught
  something wrong (the kept reserva lost its client/product link, or a child
  row count changed). The whole transaction aborts; nothing is committed.
  This is the safety net for the fact that the two `SET NULL` foreign keys
  (`scripts/021-fix-reservas-relationships.sql:54-63`,
  `scripts/058-fix-auditoria-table.sql:53-56`) would otherwise fail silently.
- **Success** looks like a `RAISE NOTICE 'All post-condition assertions
  passed...'` followed by one result grid (reserva id, cliente_id,
  producto_id, and child counts) and then a normal `COMMIT`.

---

## The KEEP set

**Español:** Se conserva la reserva con código `RES-1787875561067`, su
cliente (`cliente_id`), su producto (`producto_id`), el suplidor de ese
producto (`suplidor_id`), y todo lo que depende de esa reserva: sus líneas de
detalle (`reserva_detalles`), sus pasajeros (`reserva_pasajeros`), sus
ocupaciones de habitación (`reserva_ocupaciones`), y sus pagos (`pagos`).
También se conservan los registros de `cambios_provisionales` y
`acciones_pendientes` que apunten (por texto, no por FK) a cualquiera de los
registros anteriores. Todo lo demás en las tablas de negocio se elimina.

**English:** The reserva with code `RES-1787875561067` is kept, along with its
client (`cliente_id`), its product (`producto_id`), that product's supplier
(`suplidor_id`), and everything downstream of that reserva: its line items
(`reserva_detalles`), its passengers (`reserva_pasajeros`), its room
occupancies (`reserva_ocupaciones`), and its payments (`pagos`).
`cambios_provisionales` and `acciones_pendientes` rows that reference (by
text, not FK) any of the rows above are also kept. Everything else in the
business tables is deleted.

---

## What is NOT covered by either script

- **Supabase Storage objects.** `documentos` is a Storage **bucket**
  (`lib/supabase.ts:68`), not a SQL table — no `DELETE` can reach it. Deleted
  rows leave their referenced files orphaned in Storage. This affects, at
  minimum: `reservas.documentos_urls` / `factura_cliente_url` /
  `factura_proveedor_url` (`scripts/060-add-reserva-documentos-columns.sql:
  15-17`), `clientes.documentos_urls`
  (`scripts/add_documentos_clientes.sql:2`), and
  `comprobantes_fiscales.documento_url`
  (`scripts/038-create-comprobantes-fiscales-table.sql:20`). Cleaning up
  Storage is a separate, un-scoped task.
- **`auth.users`** and anything outside the `public` schema.
- **Anything created out-of-band** that `to_regclass()` doesn't find at run
  time — both scripts report `AUSENTE` for such tables rather than guessing.

---

## Rollback

- **These three files themselves** are new, untracked additions to the repo.
  To undo just having written them:
  `rm docs/migracion/01-cleanup-dry-run.sql docs/migracion/02-cleanup-execute.sql docs/migracion/README-cleanup.md`
- **A run of `01-cleanup-dry-run.sql`** needs no rollback — it cannot change
  anything.
- **A run of `02-cleanup-execute.sql` that aborted** (any `RAISE EXCEPTION`,
  or any other error) needs no rollback — Postgres already discarded the
  whole transaction.
- **A run of `02-cleanup-execute.sql` that committed successfully** can only
  be undone by **restoring the Step 1 backup**. There is no undo script — a
  `DELETE` of the majority of the business data has no inverse once
  committed.
