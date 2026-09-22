# Plan — Destructive DB cleanup keeping only `RES-1787875561067`

**Slug:** `db-cleanup-keep-one-reserva`
**Author:** architect (Elibry) · **Date:** 2026-09-09
**Deliverables (the ONLY two files this plan may create):**
- `docs/migracion/cleanup-keep-RES-1787875561067.sql`
- `docs/migracion/cleanup-keep-RES-1787875561067.md`

**No source file, no `scripts/` migration, no test, no config may be touched.**

---

## 0. Grounding — what I actually inspected

Everything below is derived from files in this repo. I did **not** connect to any
database (the configured Supabase project is unreachable). Every FK/trigger claim
carries its file:line.

Read in full or in part: all 60 files in `scripts/*.sql`; `lib/supabase.ts`;
`lib/user-context.tsx`; `lib/provisional-system.ts`; `app/reservas/crear/page.tsx`;
`app/reservas/editar/[id]/page.tsx`; `app/facturacion/fiscal/page.tsx`;
`app/actions/documentos-actions.ts`; `package.json`. Plus a repo-wide
`.from("<table>")` census across `app/`, `lib/`, `tests/`.

### 0.1 The complete `CREATE TABLE` census in `scripts/`

This is the **only** DDL evidence that exists in the repo. 18 tables, 2 views.

| Table | Declared at | Notes |
|---|---|---|
| `tipos_productos` | `001-create-tables.sql:5`, `003-update-tables-fixed.sql:249` | |
| `suplidores` | `001-create-tables.sql:15` | |
| `colaboradores` | `001-create-tables.sql:32`, `005-create-colaboradores-table.sql:2` | |
| `clientes` | `001-create-tables.sql:46`; **dropped + recreated** at `005-update-clientes-structure.sql:2-4` | |
| `productos` | `001-create-tables.sql:72`, `003-update-tables-fixed.sql:28` | |
| `reservas` | `001-create-tables.sql:91`, `003-update-tables-fixed.sql:56`, `007-create-reservas-table.sql:2`, `026-fix-reservas-relationships.sql:9` | |
| `pagos` | `001-create-tables.sql:137`, `024-create-pagos-table.sql:2`, `025-fix-pagos-table.sql:8`, `050-add-provisional-fields-all-tables.sql:19` | 4 divergent shapes |
| `auditoria` | `001-create-tables.sql:158` | |
| `reserva_detalles` | `022-create-reserva-detalles-table.sql:2`, `023-create-reserva-detalles-table-fixed.sql:2` | |
| `seguimiento_casos` | `031:2`, `035:2`; **dropped + recreated** `036-fix-seguimiento-tables.sql:6,9` | |
| `seguimiento_comentarios` | `031:20`, `035:20`; **dropped + recreated** `036:5,27` | |
| `comprobantes_fiscales` | `038-create-comprobantes-fiscales-table.sql:2` — **then `DROP TABLE ... CASCADE` at `039-create-comprobantes-disponibles-table.sql:2`** | see §3.2 |
| `comprobantes_disponibles` | `039-create-comprobantes-disponibles-table.sql:6` | DGII NCF sequence state |
| `acciones_pendientes` | `045-create-acciones-pendientes-table.sql:2` | |
| `usuarios` | `046-create-usuarios-table.sql:2` | |
| `cambios_provisionales` | `048-create-cambios-provisionales-table.sql:2` | |
| `reserva_ocupaciones` | `061-create-reserva-pasajeros-ocupaciones.sql:60` | **RLS enabled** `061:94` |
| `reserva_pasajeros` | `061-create-reserva-pasajeros-ocupaciones.sql:73` | **RLS enabled** `061:93` |
| *view* `v_comprobantes_fiscales` | `038:43`; **dropped** at `039:3` | |
| *view* `v_comprobantes_disponibles` | `039:35` | |

### 0.2 Tables named in `CLAUDE.md` that DO NOT EXIST in any migration

`usuarios_sistema` · `datos_maestros` · `parametros_sistema` ·
`configuracion_empresa` · `permisos_roles` · `audit_logs` · `logs` ·
`performance_metrics` · `documentos`

Evidence: they appear in **zero** `CREATE TABLE` statements (grep over
`scripts/**`, results in §0.1) and in **zero** `.from("…")` calls anywhere in
`app/`, `lib/`, or `tests/`. `CLAUDE.md`'s own header warns it may be stale;
this is that case.

Two specific corrections:
- **`documentos` is a Supabase *Storage bucket*, not a table** —
  `lib/supabase.ts:68` (`const BUCKET = "documentos"`). A SQL `DELETE` cannot
  touch it. See §6 "not covered".
- `configuracion_empresa` / `parametros_sistema` have zero live code paths —
  independently recorded in `lib/empresa-info.ts:6-17` and in the brain note
  `~/Developer/CBrain/projects/elibry.md`.

**They may still exist**, created out of band in the Supabase dashboard (this is
exactly `mistakes/schema-source-of-truth`: "the `scripts/` migrations folder is
not evidence"). The script therefore handles all nine via runtime
`to_regclass()` guards and reports "AUSENTE" when they are not there.

### 0.3 Declared foreign keys and their delete behaviour

| Child | Column(s) | Parent | ON DELETE | Evidence |
|---|---|---|---|---|
| `productos` | `suplidor_id` | `suplidores(id)` | **SET NULL** | `058-fix-auditoria-table.sql:53-56` (`productos_suplidor_id_fkey`) — supersedes the bare `REFERENCES` at `001:78` |
| `reservas` | `cliente_id` | `clientes(id)` | **SET NULL** | `021-fix-reservas-relationships.sql:54-56` (`fk_reservas_cliente`) |
| `reservas` | `producto_id` | `productos(id)` | **SET NULL** | `021-fix-reservas-relationships.sql:61-63` (`fk_reservas_producto`) |
| `reserva_detalles` | `reserva_id` | `reservas(id)` | **CASCADE** | `023-…-fixed.sql:22-25` (`fk_reserva_detalles_reserva`); also `022:4` |
| `reserva_pasajeros` | `reserva_id` | `reservas(id)` | **CASCADE** | `061:75` |
| `reserva_ocupaciones` | `reserva_id` | `reservas(id)` | **CASCADE** | `061:62` |
| `reserva_pasajeros` | `(ocupacion_id, reserva_id)` | `reserva_ocupaciones(id, reserva_id)` | **SET NULL (ocupacion_id)** | `061:84-86` |
| `pagos` | `reserva_id` | `reservas(id)` | **NO ACTION** (blocks) | `025-fix-pagos-table.sql:106` (`fk_pagos_reserva`) |
| `pagos` | `cliente_id` | `clientes(id)` | **NO ACTION** (blocks) | `025-fix-pagos-table.sql:110` (`fk_pagos_cliente`) |
| `seguimiento_comentarios` | `caso_id` | `seguimiento_casos(id)` | **CASCADE** | `036:34`; also `031:22`, `035:22` |

**The two SET NULL FKs are the single most dangerous thing here.** Deleting a
`cliente` or `producto` that the surviving reserva points at raises **no error** —
Postgres silently nulls `reservas.cliente_id` / `reservas.producto_id` and the kept
reservation becomes a data husk. The KEEP set is what protects it, not the FK.
`058:64-65` also dropped `NOT NULL` from both columns, so nothing downstream
catches it either.

### 0.4 Implied links with NO FK constraint — inferred from app code (the risky ones)

Flagged per the brief. These are **inferences**, not declared constraints:

| "Link" | Shape | Where I inferred it from |
|---|---|---|
| `auditoria.tabla` + `auditoria.registro_id` | polymorphic text+int | `001:224-235` (`audit_trigger()`), `app/actions/documentos-actions.ts:878-881` (`tabla: "reservas"`, `registro_id: payload.reservaId`) |
| `cambios_provisionales.tabla_afectada` + `registro_id` | polymorphic | `048:5-6`; writer `lib/provisional-system.ts:39-40`, `:71-72`, `:160-161` |
| `acciones_pendientes.tabla_objetivo` + `registro_id` | polymorphic | `045:6-7`; `lib/admin-actions.ts:21` |
| `comprobantes_fiscales.reserva_id` / `.cliente_id` | **columns that exist only in TypeScript** | `app/facturacion/fiscal/page.tsx:56-57` (`interface FacturaFiscal`), `:674-675` (insert payload). **`038`'s DDL declares neither.** |
| `productos.tipo` → `tipos_productos` | text ↔ text | `001:77` (`tipo VARCHAR(50)`) vs `001:7` (`tipos_productos.nombre`) — no FK |
| `reservas.referido_por` / `.atendido_por` → `colaboradores` | free-text names | `001:97-98`; writer `app/reservas/crear/page.tsx:456-457`. Repo-wide grep for `colaborador_id`: **zero hits.** |

### 0.5 Triggers that change the answer (nobody finds these by reading FKs)

1. **`audit_clientes` / `audit_productos` / `audit_reservas` / `audit_pagos` /
   `audit_suplidores`** — `001-create-tables.sql:242-260`, calling `audit_trigger()`
   at `001:221-239`, which on `TG_OP = 'DELETE'` does
   `INSERT INTO auditoria (…) VALUES (TG_TABLE_NAME, OLD.id, …)` (`001:224-227`).
   **Consequence: every DELETE this script performs writes a new `auditoria` row.**
   Therefore `auditoria` must be emptied **last**, after all other deletes, or the
   cleanup's own audit exhaust survives the cleanup. This is not an FK-ordering
   constraint and no FK graph would reveal it.

2. **`trigger_recalcular_totales_delete`** — `023:109-113`, calling
   `recalcular_totales_reserva()` (`023:49-94`), which runs
   `UPDATE public.reservas SET … editado_por = COALESCE(NEW.editado_por, OLD.editado_por, 'Sistema')`
   (`023:88-90`) after every `reserva_detalles` delete. `NEW` is unassigned in a
   DELETE trigger. This is **RISK R-TRIGGER** (§7) — I cannot resolve it without
   executing it, and I will not claim it is safe.

3. **`obtener_proximo_ncf()`** — `039:114-155` reads and **increments**
   `comprobantes_disponibles.numero_actual`. That column is live DGII sequence
   state, which is why `comprobantes_disponibles` is Section B, not Section A.

### 0.6 Two premises in the brief that the code contradicts — stated, not silently obeyed

- **"deleting `usuarios` … can lock the operator out of the app" — false for THIS
  repo.** Login is a hardcoded two-entry array at `lib/user-context.tsx:23-38`,
  matched client-side at `:59` and persisted to `localStorage` at `:69`. There is
  **no `.from("usuarios")` call anywhere in the repo.** The warning is still worth
  writing (an out-of-repo consumer may read the table), but it must be written
  *accurately*, with this citation, not as an unqualified claim. Consistent with
  ADR-0011's finding that Elibry has no real authentication.
- **`reservas.codigo` generation is at `app/reservas/crear/page.tsx:452`**, not 450
  (`codigo: \`RES-${Date.now()}\``). Line 450 is a comment. Minor, but the brief's
  citation should not be copied forward uncorrected.

### 0.7 `scripts/056-database-cleanup-and-id-reset-final.sql` — prior art, and what NOT to copy

A previous full-wipe script already exists. It is the template for how **not** to
do this:
- `056:8` `SET session_replication_role = replica;` — disables **all** FK checks
  and **all** user triggers for the session. It makes ordering irrelevant by
  removing the safety net that would have caught a mistake. **Banned in our script.**
- `056:25-78` — bare `DELETE FROM <t>;` on every table, no keep set at all.
- `056:91-141` — `ALTER SEQUENCE … RESTART WITH 1/101/111` on tables that it had
  just emptied. Safe there because nothing survived; **fatal here** because
  `RES-1787875561067` and its dependencies survive. See §5.
- It has no transaction wrapper at all: a failure halfway leaves a half-wiped DB.

---

## 1. Technical approach (one paragraph)

Ship a single, self-contained, **dry-run-by-default** SQL script that opens an
explicit transaction, aborts immediately via `RAISE EXCEPTION` if
`reservas.codigo = 'RES-1787875561067'` is absent, **materialises the entire KEEP
set into temp tables before touching anything** (so no later `DELETE` can shrink
the set that a subsequent `DELETE` reads from), records a per-table BEFORE count,
performs leaf-first deletes each explicitly bounded by `NOT IN (SELECT … FROM
_keep_*)`, records AFTER counts, emits a single result-grid report plus a set of
integrity assertions on the surviving reservation, and then **`ROLLBACK`s**. A
`COMMIT;` line is present but commented and labelled; the operator flips it only
after reading the dry-run grid. Every maybe-absent table is reached through
`to_regclass()` + `EXECUTE format(…)` inside `DO` blocks, so the script parses and
runs unchanged whether or not the nine undeclared `CLAUDE.md` tables exist.
`auditoria` is emptied last because the delete triggers at `001:242-260` write to
it *during* the run. No `TRUNCATE`, no `session_replication_role`, no `DROP`, no
`ALTER SEQUENCE … RESTART` — nothing that escapes the transaction or bypasses a
constraint.

## 2. File map

| File | Action | What it does |
|---|---|---|
| `docs/migracion/cleanup-keep-RES-1787875561067.sql` | **CREATE** | The script. Sections: 0 preflight · 1 KEEP materialisation · 2 BEFORE counts · **A** business deletes · **B** config deletes (commented out) · **C** sequence sync (optional, commented) · **D** untouched-table ledger · 3 AFTER counts + report · 4 integrity assertions · `-- COMMIT;` / `ROLLBACK;`. Budget ≤ 500 lines (`.claude/rules/file-size.md`). |
| `docs/migracion/cleanup-keep-RES-1787875561067.md` | **CREATE** | Operator runbook. Backup is step 1. Includes the transaction-honouring probe (§7 HC-1), the KEEP set in Spanish + English, the dry-run→read→COMMIT sequence, "not covered", and the rollback note. Budget ≤ 250 lines. |

**Nothing else.** In particular: `scripts/` gains no file — this is an operational
one-shot, not a migration, and adding it to the numbered sequence would invite a
future "re-run all migrations" to wipe a database.

## 3. DB changes

### 3.1 Schema changes: **none**

This plan creates no table, no column, no index, no view, no policy. It is
DML-only. **RLS is neither added, removed, weakened, nor relied upon.**
ADR-0006's "no table without a policy" has no new table to apply to;
ADR-0011 (single-tenant, no auth, ~29 tables with no RLS) is unchanged in both
directions.

**One RLS interaction the operator must know about:** `reserva_pasajeros` and
`reserva_ocupaciones` have `ENABLE ROW LEVEL SECURITY` (`061:93-94`) with policies
`reserva_pasajeros_staff_all` / `reserva_ocupaciones_staff_all` granted `TO
authenticated` only (`061:106-112`). Neither table has `FORCE ROW LEVEL SECURITY`,
so the table **owner** bypasses RLS and the deletes work when run as `postgres`.
Run as any other non-owner role, `DELETE` would silently match **zero rows** and
the report would show a false "0 deleted". The preflight therefore emits
`current_user` and `session_user` into the report, and the runbook tells the
operator what value to expect.

### 3.2 `comprobantes_fiscales` — genuinely ambiguous, flagged not guessed

Three mutually incompatible pieces of evidence:
1. `038:2` creates it; **`039:2` drops it** (`DROP TABLE IF EXISTS
   comprobantes_fiscales CASCADE;`). If migrations ran in order, it is gone.
2. `app/facturacion/fiscal/page.tsx:137` reads it and orders by
   `fecha_creado` — a column `038` never declares (`038:23` declares
   `fecha_registro`). `:141-143` swallows the error with the comment
   *"No lanzar error si la tabla no existe"*. The app itself does not know.
3. `:674-675` inserts `reserva_id` and `cliente_id`, columns `038` never declares
   — implying a live table with a **different shape** than any migration.

I cannot resolve this from the repo. The script handles it by branching on
`to_regclass('public.comprobantes_fiscales')` **and** on the presence of a
`reserva_id` column, and reports which branch it took. See §7 HC-2 for the fiscal
gate this raises.

## 4. The KEEP set (expressed as SQL, no hardcoded IDs)

Materialised **once, before any delete**, into `ON COMMIT DROP` temp tables.

```
_keep_reserva   := SELECT id, cliente_id, producto_id
                     FROM reservas WHERE codigo = 'RES-1787875561067'

_keep_cliente   := (SELECT cliente_id FROM _keep_reserva WHERE cliente_id IS NOT NULL)
                   UNION
                   (SELECT cliente_id FROM pagos
                     WHERE reserva_id IN (SELECT id FROM _keep_reserva)
                       AND cliente_id IS NOT NULL)     -- pagos.cliente_id may diverge

_keep_producto  := SELECT producto_id FROM _keep_reserva WHERE producto_id IS NOT NULL

_keep_suplidor  := SELECT suplidor_id FROM productos
                    WHERE id IN (SELECT id FROM _keep_producto)
                      AND suplidor_id IS NOT NULL      -- FK at 058:53-56

_keep_pago      := SELECT id FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)
```

Downward children need no separate temp table — they are all reachable by
`reserva_id IN (SELECT id FROM _keep_reserva)`: `reserva_detalles`,
`reserva_pasajeros`, `reserva_ocupaciones`, `pagos`.

**Why materialise:** `_keep_cliente` reads `pagos`. If `pagos` were deleted before
`clientes`, an inline CTE would return a *smaller* client set on the second
evaluation and the kept client could be deleted. Materialising first makes the
delete order irrelevant to the keep set's contents. This is the concurrency-shaped
bug in a single-session script, and it is the reason temp tables are mandatory
rather than stylistic.

**Deliberately EMPTY keep sets, and why:**
- `tipos_productos` — `productos.tipo` is `VARCHAR(50)` (`001:77`), not an FK, and
  the column name on `tipos_productos` is itself contested (`001:7` says `nombre`,
  `056:209` inserts `nombre_tipo`). A name-match keep would be a guess. **Section B,
  untouched by default.**
- `colaboradores` — repo-wide grep for `colaborador_id`: zero hits.
  `reservas.referido_por` / `atendido_por` hold free-text names
  (`app/reservas/crear/page.tsx:456-457`). No resolvable link. **Section B,
  untouched by default.**
- `comprobantes_fiscales` — see §3.2. Keep set is *conditional on a column that may
  not exist*.
- `seguimiento_casos` / `seguimiento_comentarios` — CRM cases key off
  `email_distribuidor` (`036:13`), with no reserva/cliente link of any kind. Keep
  set is genuinely empty → bare `DELETE FROM`.
- `auditoria` — see §5, step 15.

## 5. Delete order (Section A), leaf-first

Ordering is chosen so that **no FK is violated even if every cascade were absent**
(the brief's requirement), and so that trigger side-effects land where intended.

| # | Table | Bound by | Why here |
|---|---|---|---|
| 1 | `seguimiento_comentarios` | bare `DELETE FROM` | CASCADE child of casos (`036:34`); deleted explicitly anyway so the ordering does not depend on the cascade |
| 2 | `seguimiento_casos` | bare `DELETE FROM` | nothing to keep (§4) |
| 3 | `pagos` | `WHERE id NOT IN _keep_pago` | **must precede `reservas` and `clientes`** — both its FKs are NO ACTION (`025:106,110`) and would block |
| 4 | `reserva_pasajeros` | `WHERE reserva_id NOT IN _keep_reserva` | before ocupaciones, to avoid pointless `SET NULL (ocupacion_id)` churn (`061:86`) |
| 5 | `reserva_ocupaciones` | `WHERE reserva_id NOT IN _keep_reserva` | |
| 6 | `reserva_detalles` | `WHERE reserva_id NOT IN _keep_reserva` | fires R-TRIGGER (§7); explicit so we see its row count |
| 7 | `comprobantes_fiscales` | conditional (§3.2) | before `reservas`/`clientes` in case the live table really does carry those FKs |
| 8 | `reservas` | `WHERE id NOT IN _keep_reserva` | all children now gone |
| 9 | `productos` | `WHERE id NOT IN _keep_producto` | after `reservas` — otherwise `fk_reservas_producto`'s **SET NULL** (`021:63`) silently nulls surviving reservas |
| 10 | `clientes` | `WHERE id NOT IN _keep_cliente` | after `reservas` and `pagos` — same SET NULL hazard via `021:56` |
| 11 | `suplidores` | `WHERE id NOT IN _keep_suplidor` | after `productos` — `058:56` SET NULL hazard |
| 12 | `cambios_provisionales` | `WHERE NOT (tabla_afectada,registro_id) IN (keep pairs)` | polymorphic, inferred (§0.4) |
| 13 | `acciones_pendientes` | `WHERE NOT (tabla_objetivo,registro_id) IN (keep pairs)` | polymorphic, inferred (§0.4) |
| 14 | `audit_logs`, `logs`, `performance_metrics` | bare `DELETE FROM`, guarded by `to_regclass` | may not exist (§0.2) |
| 15 | **`auditoria`** | bare `DELETE FROM` — **LAST** | steps 3-11 each fired `audit_trigger()` (`001:224-227`) writing fresh rows. Deleting it earlier leaves the cleanup's own exhaust behind. A commented-out preserving variant (`WHERE NOT (tabla='reservas' AND registro_id IN _keep_reserva)`) is provided for the operator who wants the kept reserva's DISCREPANCIA history retained. |

Steps 12-15 use bare `DELETE FROM t;` where the keep set is empty — **`DELETE`, never
`TRUNCATE`**, so it stays inside the transaction and fires triggers/audit
consistently, exactly as the brief requires. Each such statement carries an inline
comment saying so.

### Section B — configuration / master data (**commented out by default**)

`usuarios` · `usuarios_sistema` · `colaboradores` · `datos_maestros` ·
`parametros_sistema` · `tipos_productos` · `configuracion_empresa` ·
`permisos_roles` · `comprobantes_disponibles`

Header warning must state, with citations:
- **`comprobantes_disponibles` holds live DGII NCF sequence state** —
  `numero_actual` is the next number to issue (`039:12`, `039:163`), read and
  incremented by `obtener_proximo_ncf()` (`039:114-155`). Deleting it is a
  **compliance event, not a cleanup**; a wiped block cannot be reconstructed from
  the app and re-issuing a used NCF is a DGII violation. Requires a human with
  fiscal authority.
- **`usuarios` / `permisos_roles`:** the generic lockout warning, *qualified* by
  §0.6 — in this repo login is hardcoded at `lib/user-context.tsx:23-38` and no
  code reads `usuarios`, so wiping it does not lock you out of **this** app. Do not
  assume the same for anything outside this repo.

### Section C — sequences (**optional, commented out, separate section**)

Only `setval(seq, MAX(id))` **synchronisation**, never `RESTART`. Two reasons:
1. Eight of the tables retain rows. `RESTART WITH 1` (the `056:91-141` pattern)
   would hand the next insert an id that already exists.
2. `lib/provisional-system.ts:132-138` computes `nextId = MAX(id) + 1` **client
   side** and inserts an explicit `id` (`:142`), bypassing the sequence entirely.
   The sequence is therefore already routinely behind `MAX(id)`, and a *sync* is
   the correct operation where a *reset* is actively harmful.

Section C must state, per table, whether rows survive. For any table with survivors
the only permitted statement is the `setval(…, MAX(id), true)` form.

### Section D — intentionally untouched (explicit ledger, no silent omissions)

Every table from §0.1 and §0.2 not appearing in A or B is listed here with a reason:
- `v_comprobantes_disponibles`, `v_comprobantes_fiscales` — **views** (`039:35`,
  `038:43`). They hold no rows; they reflect their base table. Deleting from a view
  is not meaningful here.
- Storage bucket `documentos` (`lib/supabase.ts:68`) — not SQL-reachable.
- Any table whose `to_regclass()` is NULL at run time — reported as `AUSENTE`.

## 6. API / service changes: **none.** UI changes: **none.**

No TypeScript, no React, no Server Action is touched. `npm run qa` output must be
byte-identical to its pre-task baseline; that is a task acceptance criterion, not
an assumption.

## 7. Hard calls, edge cases, risks

**These are genuinely hard. I am not pretending otherwise.**

**HC-1 (hard, must reach the human) — "paste into the Supabase SQL editor" is not
a transaction-safe channel.** The brief mandates `BEGIN;` … `ROLLBACK;` and says a
human will paste it into the Supabase SQL editor. The Supabase editor wraps each
submission in its own implicit transaction; `scripts/061:53-57` already documents
that a nested `BEGIN` there "just emits a harmless NOTICE and continues in the same
outer transaction". Whether an explicit `ROLLBACK` inside that outer transaction
reliably discards the work **depends on the editor version and I cannot test it
here.** If it does not, the "dry run" commits — the exact catastrophe the design
exists to prevent.
Mitigation shipped in the runbook, executable and cheap, as a mandatory gate
before the real script is pasted:
```sql
BEGIN;
CREATE TEMP TABLE _tx_probe(x int);
ROLLBACK;
SELECT to_regclass('pg_temp._tx_probe');   -- MUST return NULL
```
If it returns non-NULL, the client did **not** honour the rollback → **abort; use
`psql` instead.** The runbook makes `psql -v ON_ERROR_STOP=1 -f …` the recommended
channel and the editor the fallback-after-probe.

**HC-2 (fiscal, human-gated) — Section A deletes `comprobantes_fiscales`.** The
brief places it in the always-deleted section. Per `CLAUDE.md` ("Fiscal (NCF /
e-CF) correctness is high-stakes → senior + human-gated") and ADR-0012, I am
executing the brief but surfacing the fork: `comprobantes_fiscales` is a
**supplier-invoice** table (`038:9-10` `proveedor_nombre`/`proveedor_rnc`), and
per the brain note no client invoice has ever been issued. Deleting supplier
fiscal records is a records-retention decision, not a data-cleanup decision. The
script keeps this one `DELETE` in Section A as instructed but wraps it in its own
clearly-labelled `-- FISCAL GATE` sub-block that the operator can comment out in
one line, and the runbook requires a fiscal sign-off checkbox before COMMIT.

**RISK R-TRIGGER (must be resolved by the dry run, not by me).**
`recalcular_totales_reserva()` (`023:49-94`) is wired `AFTER DELETE ON
reserva_detalles` (`023:109-113`) and evaluates `COALESCE(NEW.editado_por,
OLD.editado_por, 'Sistema')` at `023:89`. `NEW` is unassigned in a DELETE trigger,
which in PL/pgSQL can raise *"record 'new' is not assigned yet"*. Counter-evidence
that it may be fine in practice: `app/reservas/editar/[id]/page.tsx:692-695`
performs a live `DELETE … .eq("reserva_id", …)` on that table in shipped code.
**I will not assert either outcome.** The script therefore:
- deletes `reserva_detalles` **explicitly** (step 6) rather than relying on the
  cascade, so the failure surfaces on a named statement with a clean rollback;
- ships a commented, ready-to-uncomment mitigation immediately above it:
  `ALTER TABLE reserva_detalles DISABLE TRIGGER trigger_recalcular_totales_delete;`
  … `ENABLE TRIGGER` after (DDL, transactional in Postgres, rolls back with
  everything else — **not** `session_replication_role`, which would disable
  every trigger and every FK globally, per §0.7);
- the runbook tells the operator the exact error text to watch for.

**Ambiguous keep sets, reported rather than guessed** (also §4): `tipos_productos`,
`colaboradores`, `comprobantes_fiscales`, `seguimiento_*`, `auditoria`.

**Other edge cases and where each is handled:**
| Case | Handling |
|---|---|
| Reserva code not found | `RAISE EXCEPTION` in preflight (§ Section 0) — aborts before any temp table or delete |
| **More than one** row with that `codigo` | `reservas.codigo` is `UNIQUE` (`001:93`), but the script asserts `COUNT(*) = 1` anyway and aborts on 0 or >1 |
| Kept reserva has `cliente_id IS NULL` / `producto_id IS NULL` (legal since `058:64-65`) | Keep set simply contains no client/product; preflight emits a WARNING row into the report rather than failing |
| Empty tables | Counts report `0 → 0`; `DELETE` is a legal no-op |
| Table absent | `to_regclass` guard → report row `AUSENTE`, no statement issued |
| A `DELETE` matching 0 rows because of RLS (non-owner role) | preflight prints `current_user`; the AFTER count exposes it as "before = after ≠ 0" |
| Keep set shrinking mid-run | prevented by materialising into temp tables before step 1 (§4) |
| Cleanup's own audit rows | `auditoria` emptied last (§5 step 15) |
| Sequence collision post-cleanup | Section C `setval` sync; never `RESTART` (§5 Section C) |
| Partial failure | single transaction; any error aborts the whole thing (`ON_ERROR_STOP=1` in the runbook) |
| Orphaned Storage objects | **NOT covered** — documented, see below |

## 8. What must NOT be touched

- Any file outside `docs/migracion/`. Specifically: **no** file in `scripts/`,
  `app/`, `lib/`, `components/`, `tests/`, no `package.json`, no `CLAUDE.md`, no
  `.claude/**`.
- The uncommitted `mockup-census-hide` working tree (25 modified/untracked files
  per `git status`) — this plan must not stage, stash, restore, or otherwise
  disturb it.
- Inside the SQL file, these constructs are **banned** and QA must grep for their
  absence: `TRUNCATE`, `DROP TABLE`, `DROP VIEW`, `DROP POLICY`, `ALTER … DISABLE
  ROW LEVEL SECURITY`, `session_replication_role`, `ALTER SEQUENCE … RESTART`,
  `CREATE POLICY`, and any uncommented `COMMIT`.
- Rollback notes must not name a destructive git verb
  (`checkout <ref> -- <path>`, `reset --hard`, `clean -fd`, `stash drop`) —
  `mistakes/destructive-op-named-in-rollback-note`.

## 9. Test plan (exact commands)

The SQL **cannot be executed in this workspace** — no network path to the Supabase
project, no local Postgres assumed. Nothing in this plan may be reported as
"tested against a database". Every check below is one a QA agent can actually run
here; anything that cannot be run must be recorded verbatim as **UNVERIFIED**.

**Scope / no-regression**
```bash
cd /Users/johancito/Developer/Elibry
git status --porcelain            # only the 2 new docs/migracion files added vs baseline
npm run qa                        # must match the pre-task baseline exactly (paste both)
```

**Structural assertions on the SQL (all run from the repo root)**
```bash
F=docs/migracion/cleanup-keep-RES-1787875561067.sql
tail -n 1 "$F"                                        # must be exactly: ROLLBACK;
rg -n '^\s*COMMIT;' "$F"                              # must return NOTHING (0 hits)
rg -n '^\s*--\s*COMMIT;' "$F"                         # must return >=1 hit
rg -ni 'TRUNCATE|DROP TABLE|DROP VIEW|DROP POLICY|session_replication_role|RESTART WITH' "$F"   # 0 hits
rg -n 'RAISE EXCEPTION' "$F"                          # >=1, in the preflight
rg -n "RES-1787875561067" "$F"                        # appears; and NO other RES- literal
rg -n 'DELETE FROM' "$F" | wc -l                      # cross-check against the §5 table
```

**Completeness (the `incomplete-control-enumeration` prevention rule, applied)**
QA must **re-derive** the table list from source, not from this plan's prose:
```bash
rg -n 'CREATE TABLE' scripts/*.sql | rg -o 'CREATE TABLE (IF NOT EXISTS )?(public\.)?\w+' | sort -u
rg -o '\.from\(\s*"[a-zA-Z_0-9]+"' -r '$0' app lib --glob '*.ts*' | sort -u
```
Every name produced by either command must appear in the SQL file in Section A,
Section B, or Section D. A name appearing in **none** is a FAIL. A name appearing
in **more than one** of A/B/D is a FAIL.

**SQL syntax — conditional, and honestly labelled**
```bash
command -v psql && psql --version          # if absent, record UNVERIFIED
# IF and only if a local/throwaway Postgres is reachable:
#   createdb elibry_syntax_scratch
#   psql -v ON_ERROR_STOP=1 -d elibry_syntax_scratch -f "$F"
#   # Expected: the preflight RAISE EXCEPTION fires (empty DB has no reservas
#   # table) -> proves the file PARSES and that the guard trips. Nothing else is proven.
#   dropdb elibry_syntax_scratch
```
If no Postgres is reachable, the QA report must say **"SQL syntax UNVERIFIED — no
Postgres available in this workspace"** in those words. Not "looks correct".

**Runbook**
```bash
rg -n '^\s*1\.' docs/migracion/cleanup-keep-RES-1787875561067.md | head -1   # step 1 must be the BACKUP step
rg -ni 'pg_dump|supabase db dump|branch|backup' docs/migracion/cleanup-keep-RES-1787875561067.md
rg -ni 'checkout .* -- |reset --hard|clean -fd|stash drop' docs/migracion/*.md docs/migracion/*.sql   # 0 hits
wc -l docs/migracion/cleanup-keep-RES-1787875561067.sql   # <= 500
wc -l docs/migracion/cleanup-keep-RES-1787875561067.md    # <= 250
```

---

## Architecture Reasoning (show your work)

- **Invariants in play + existing mechanism each follows:**
  (1) *The surviving reservation must remain fully joined* — enforced by the KEEP
  set, **not** by FKs, because `fk_reservas_cliente` / `fk_reservas_producto`
  (`021:56,63`) and `productos_suplidor_id_fkey` (`058:56`) are all `ON DELETE SET
  NULL` and would corrupt it silently. Verified by post-delete assertions, not
  assumed. (2) *Org isolation / RLS never weakened* — no policy is created,
  dropped, or altered; `reserva_pasajeros`/`reserva_ocupaciones`'s existing
  `…_staff_all` policies (`061:106-112`) are untouched, and the script explicitly
  refuses `session_replication_role` (which `056:8` used) precisely because it
  would bypass enforcement. ADR-0011's posture is unchanged in both directions.
  (3) *Fiscal integrity* — `comprobantes_disponibles.numero_actual` (`039:12`,
  incremented by `obtener_proximo_ncf()` at `039:114-155`) is quarantined in
  commented-out Section B; `comprobantes_fiscales` gets its own labelled fiscal
  sub-gate (HC-2). (4) *Atomicity* — the whole run is one transaction that ends in
  `ROLLBACK`, following `scripts/061:50-58`'s precedent of wrapping a
  higher-risk script, and explicitly rejecting the un-wrapped `056` pattern.
  (5) *Rollback path* — for a dry run, rollback is the default; for a committed
  run, rollback is **restore-from-backup**, which is why backup is runbook step 1
  and why no "undo script" is offered (a DELETE of 100% of rows has no undo).

- **Approaches considered + trade-offs + choice & why:**
  **A — copy `scripts/056`'s shape** (`session_replication_role = replica` + bare
  `DELETE FROM` + `ALTER SEQUENCE RESTART`). Smallest to write, matches existing
  in-repo precedent. **Rejected:** it disables every FK and trigger, so the two
  `SET NULL` FKs and the audit triggers stop protecting/behaving, and its
  `RESTART WITH 1` is actively wrong when rows survive. Its "precedent" value is
  negative — it is the anti-pattern (§0.7).
  **B — dynamic, fully generic wipe** (loop over `information_schema.tables`,
  delete everything not in a keep manifest). Robust to the nine undeclared tables.
  **Rejected:** an operator cannot review what a loop will do; a destructive script
  a human must approve has to be *readable statement by statement*, and a generic
  loop would happily empty a table nobody enumerated.
  **C (chosen) — explicit, enumerated, leaf-first deletes with materialised keep
  temp tables, `to_regclass` guards only for the nine maybe-absent tables, and a
  dry-run-by-default transaction envelope.** Every destructive statement is
  visible and individually commentable; the guards cover the one genuine unknown
  (§0.2) without making the whole script opaque; ordering holds even with zero
  cascades. Trade-off accepted: more lines, and the table list must be maintained
  by hand — which is why the completeness cross-check is its own QA task (T8).

- **Seam map (file budget) and its complement:**
  Budget = exactly two NEW files, both under `docs/migracion/`:
  `cleanup-keep-RES-1787875561067.sql`, `cleanup-keep-RES-1787875561067.md`.
  Complement (must-not-touch) = **everything else in the repo**, itemised in §8,
  with special mention of `scripts/**` (this is deliberately *not* migration `065`)
  and the 25-file uncommitted working tree.

- **Negative space checked** — grepped `~/Developer/CBrain/decisions` and
  `~/Developer/CBrain/mistakes` for `delete|destructive|truncate|wipe|backup|schema|migration`.
  Relevant and respected:
  **ADR-0006 (RLS org-isolation default)** — no new table, so nothing to police;
  no existing policy touched.
  **ADR-0011 (single-tenant for now)** — its rejected alternative *"retrofit RLS /
  invent an org predicate as a side-quest"* is **not** re-proposed: this plan
  contains zero DDL and zero policy statements. Its inverse temptation
  (disable/bypass RLS to make deletes convenient) is also refused —
  `session_replication_role` is banned and the RLS-owner caveat is surfaced to the
  operator instead.
  **ADR-0012 (CONFIRMACIÓN without factura número)** — its rejected alternative
  *"fabricate or placeholder a fiscal number"* is not re-proposed; nothing here
  invents, renumbers, or resets a fiscal sequence, and `comprobantes_disponibles`
  is quarantined.
  **`mistakes/schema-source-of-truth`** — its prevention rule ("the `scripts/`
  migrations folder is not evidence of the live schema") is the reason the script
  is `to_regclass`-guarded, the reason §0.2 exists at all, and the reason §3.2
  reports `comprobantes_fiscales` as ambiguous instead of assuming `038`'s shape.
  **`mistakes/incomplete-control-enumeration`** — its prevention rule ("QA must
  independently re-derive the list from source, not from the plan's prose") is
  written verbatim into T8's acceptance criteria and §9.
  **`mistakes/destructive-op-named-in-rollback-note`** — its prevention rule ("a
  rollback instruction naming a destructive-shaped verb must be rejected before
  the note is accepted, and strictly before any execution-based verification") is
  written into T7's acceptance criteria and grepped in §9.
  **`mistakes/assertion-without-verification` / `unrun-command-claimed-green`** —
  its rule (paste real output; a command that "would" pass is FAILED) is why §9
  forbids the words "looks correct" for the un-runnable SQL and mandates the
  literal string "SQL syntax UNVERIFIED".
  No ADR-rejected option is being re-proposed and no logged failure path is being
  re-walked.

- **Pre-mortem — most drift-prone task + mitigation:** **T3 (Section A deletes)**.
  It is the task that "needs one more table", and the natural drift is a dev
  reaching into `scripts/` to add a migration `065` that codifies the cleanup, or
  editing `CLAUDE.md`'s stale table list "while they're in there". Mitigations:
  (a) T3's files-in-scope is the single `.sql` file and nothing else;
  (b) the table inventory is frozen by T2's output and cross-checked by T8, so
  "add a table" is a T8 finding routed back to T2, not a T3 edit;
  (c) `git status --porcelain` is an explicit PASS/FAIL criterion on every task;
  (d) §8 lists `scripts/**` and `CLAUDE.md` as must-not-touch by name.
  Second-order risk: T3 is also where a dev might "helpfully" add
  `session_replication_role` to make ordering worries go away — pre-empted by the
  banned-construct grep in §9 running on every task, not only at the end.

- **Any genuinely hard call flagged for the human:**
  **HC-1** — the Supabase SQL editor may not honour an explicit `ROLLBACK`, which
  would turn the mandated dry run into a live wipe. Mitigated by a mandatory
  executable probe + a `psql`-first recommendation, but the human should know the
  brief's stated channel is the weaker one.
  **HC-2** — Section A deletes `comprobantes_fiscales`, a supplier-invoice /
  fiscal-records table. Executed as briefed, but it needs a fiscal sign-off, and it
  rides the *already-undischarged* fiscal gate recorded in
  `~/Developer/CBrain/projects/elibry.md`.
  **R-TRIGGER** — `recalcular_totales_reserva()` may error on `reserva_detalles`
  delete; unresolvable without execution; mitigation shipped commented-out.
  **Ambiguous keep sets** — `tipos_productos`, `colaboradores`,
  `comprobantes_fiscales`, `seguimiento_*`: reported, not guessed.

---

## 10. Task list

All DB/destructive-script work is **[senior]**; per the methodology a schema/DB
task is never tagged junior. T8 is a pure text cross-reference and is junior-safe.

**Global acceptance criteria — applied to EVERY task below, PASS/FAIL:**
- G1. `git status --porcelain` shows changes **only** to the two files in that
  task's declared scope. Any other path = FAIL. *(prevention rule:
  `mistakes/unrequested-hardening-regression` — no unrequested edits ride along.)*
- G2. `npm run qa` output pasted verbatim and identical to the pre-task baseline.
  A paraphrase such as "qa passed" = FAIL. *(prevention rule:
  `mistakes/unrun-command-claimed-green` — a command that "would" pass was not run.)*
- G3. The banned-construct grep from §8/§9 returns 0 hits.
- G4. A one-line rollback note that names **no** destructive git verb.
  *(prevention rule: `mistakes/destructive-op-named-in-rollback-note`.)*
- G5. No claim that any SQL was executed against a database. Unverified things are
  labelled **UNVERIFIED** in those words. *(prevention rule:
  `mistakes/assertion-without-verification`.)*

---

### T1 — Transaction envelope, preflight guard, and session report
**Owner:** dev-senior · **Tag:** [senior] · **Depends on:** none
**Files in scope:** `docs/migracion/cleanup-keep-RES-1787875561067.sql` (create)
**Does:** File header (purpose, danger notice, channel guidance, authorship);
`BEGIN;`; Section 0 preflight that (a) `RAISE EXCEPTION` unless exactly one
`reservas` row has `codigo = 'RES-1787875561067'`, (b) emits `current_user`,
`session_user`, `current_database()`, `version()` for the RLS-ownership caveat
(§3.1), (c) warns (does not fail) if the kept reserva has a NULL `cliente_id` or
`producto_id`; and the file tail `-- COMMIT;   -- <<< flip ONLY after reading the
report` followed by `ROLLBACK;` as the final line.
**Acceptance (PASS/FAIL):**
1. `tail -n 1 <file>` is exactly `ROLLBACK;` — PASS/FAIL.
2. `rg -n '^\s*COMMIT;' <file>` returns 0 hits; `rg -n '^\s*--\s*COMMIT;'` returns ≥1 — PASS/FAIL.
3. `rg -c 'RAISE EXCEPTION' <file>` ≥ 1, and the exception message names the reserva code — PASS/FAIL.
4. `rg -c 'RES-1787875561067' <file>` ≥ 1 and no other `RES-\d+` literal appears — PASS/FAIL.
5. Preflight also asserts `COUNT(*) = 1`, not merely `> 0` — PASS/FAIL.
6. G1-G5.
**DB/RLS changes:** none.

### T2 — KEEP-set materialisation + before/after count harness
**Owner:** dev-senior · **Tag:** [senior] · **Depends on:** T1
**Files in scope:** `docs/migracion/cleanup-keep-RES-1787875561067.sql` (edit)
**Does:** Section 1 — `CREATE TEMP TABLE … ON COMMIT DROP` for `_keep_reserva`,
`_keep_cliente`, `_keep_producto`, `_keep_suplidor`, `_keep_pago`, populated
exactly as §4 (CTEs from `reservas.codigo`, **no hardcoded IDs**), and
**materialised before any DELETE**. Section 2 — `_cleanup_report(tabla,
filas_antes, filas_despues, filas_borradas, nota)` temp table filled by a `DO`
loop over a fixed table-name array using `to_regclass()` + `EXECUTE format(…)`,
writing `AUSENTE` for missing tables. The array is the frozen inventory (§0.1 +
§0.2) and is the artifact T8 checks against.
**Acceptance (PASS/FAIL):**
1. `rg -n 'ON COMMIT DROP' <file>` shows every temp table so declared — PASS/FAIL.
2. Zero integer literals appear as an id in any `_keep_*` population statement
   (`rg -n '_keep' -A3 <file>` reviewed; a bare `= 12` style id = FAIL) — PASS/FAIL.
3. All five `_keep_*` populations appear **textually before** the first
   `DELETE FROM` in the file (verify by comparing `rg -n` line numbers) — PASS/FAIL.
4. `_keep_cliente` unions `reservas.cliente_id` **and** `pagos.cliente_id` (§4) — PASS/FAIL.
5. The name array contains all 18 tables of §0.1 plus the 9 of §0.2 = 27 entries;
   `to_regclass` is used for every one — PASS/FAIL.
6. G1-G5.
**DB/RLS changes:** none (temp tables only, dropped on commit/rollback).

### T3 — Section A: business-data deletes, leaf-first
**Owner:** dev-senior · **Tag:** [senior] · **Depends on:** T2
**Files in scope:** `docs/migracion/cleanup-keep-RES-1787875561067.sql` (edit)
**Does:** The 15 ordered steps of §5 exactly. Each step carries a comment naming
the FK or trigger that dictates its position, with the `file:line` citation from
§0.3/§0.5. `comprobantes_fiscales` (step 7) gets its `-- FISCAL GATE` sub-block
(HC-2). `reserva_detalles` (step 6) gets the commented `DISABLE TRIGGER` /
`ENABLE TRIGGER` mitigation and the R-TRIGGER note. `auditoria` (step 15) is last
and carries the commented preserving variant.
**Acceptance (PASS/FAIL):**
1. The order of `DELETE FROM` statements matches §5 steps 1-15 exactly, verified
   by `rg -n 'DELETE FROM' <file>` line order — PASS/FAIL.
2. `auditoria` is the **last** `DELETE FROM` in Section A — PASS/FAIL.
3. Every table with a non-empty keep set (`pagos`, `reserva_detalles`,
   `reserva_pasajeros`, `reserva_ocupaciones`, `reservas`, `productos`, `clientes`,
   `suplidores`, `cambios_provisionales`, `acciones_pendientes`) has a `WHERE …
   NOT IN (SELECT … FROM _keep_…)` clause. Any bare `DELETE FROM` among these = FAIL.
4. Every bare `DELETE FROM t;` is a table with an empty keep set **and** carries an
   inline comment saying why, and says `DELETE` was chosen over `TRUNCATE` to stay
   inside the transaction — PASS/FAIL.
5. `rg -ni 'TRUNCATE|session_replication_role' <file>` returns 0 hits — PASS/FAIL.
6. `productos`/`clientes`/`suplidores` deletes appear **after** the `reservas`
   delete (the SET NULL hazard, §5 rows 9-11) — PASS/FAIL.
7. Each step's comment cites a real `scripts/<file>:<line>`; QA spot-checks three
   citations by opening the cited lines — PASS/FAIL.
8. G1-G5.
**DB/RLS changes:** none (DML only). No policy statement may appear.

### T4 — Section B: configuration/master data, commented out, with warnings
**Owner:** dev-senior · **Tag:** [senior] · **Depends on:** T3
**Files in scope:** `docs/migracion/cleanup-keep-RES-1787875561067.sql` (edit)
**Does:** Section B header warning (§5 Section B) + nine commented-out
`DELETE FROM` statements, each with a one-line "what breaks if you run this".
**Acceptance (PASS/FAIL):**
1. Every one of the nine Section-B statements is comment-prefixed; `rg -n
   '^\s*DELETE FROM (usuarios|usuarios_sistema|colaboradores|datos_maestros|parametros_sistema|tipos_productos|configuracion_empresa|permisos_roles|comprobantes_disponibles)'`
   returns **0 uncommented hits** — PASS/FAIL.
2. The header states `comprobantes_disponibles` holds DGII NCF sequence state and
   cites `039:12` and `039:114-155`; the words "compliance event" appear — PASS/FAIL.
3. The `usuarios` warning is **qualified** with the `lib/user-context.tsx:23-38`
   citation per §0.6 (an unqualified "you will be locked out" = FAIL, because the
   repo disproves it) — PASS/FAIL.
4. G1-G5.
**DB/RLS changes:** none.

### T5 — Section C (sequences, optional) + Section D (untouched ledger)
**Owner:** dev-senior · **Tag:** [senior] · **Depends on:** T4
**Files in scope:** `docs/migracion/cleanup-keep-RES-1787875561067.sql` (edit)
**Does:** Section C — commented-out `setval(seq, MAX(id), true)` sync statements,
each annotated "rows survive: YES/NO", with the `lib/provisional-system.ts:132-142`
rationale. Section D — the explicit untouched ledger (views, the `documentos`
Storage bucket, absent tables) with reasons.
**Acceptance (PASS/FAIL):**
1. `rg -ni 'RESTART' <file>` returns 0 hits — PASS/FAIL.
2. Every Section-C statement is commented out — PASS/FAIL.
3. No `setval` is proposed (even commented) for a table that Section A leaves with
   surviving rows **without** the `MAX(id)` form; any `setval(…, 1, false)` = FAIL — PASS/FAIL.
4. Section D names both views and the Storage bucket, with citations
   (`039:35`, `038:43`, `lib/supabase.ts:68`) — PASS/FAIL.
5. G1-G5.
**DB/RLS changes:** none.

### T6 — Post-delete integrity assertions + final report SELECT
**Owner:** dev-senior · **Tag:** [senior] · **Depends on:** T5
**Files in scope:** `docs/migracion/cleanup-keep-RES-1787875561067.sql` (edit)
**Does:** Section 3 — AFTER counts written into `_cleanup_report`, then
`SELECT * FROM _cleanup_report ORDER BY tabla;` (a real result grid, because
`RAISE NOTICE` is not reliably surfaced by the Supabase editor). Section 4 —
assertions that `RAISE EXCEPTION` if the surviving reservation is not intact:
exactly 1 row in `reservas`; its `cliente_id` still resolves to a live `clientes`
row (or was NULL before the run — compare against the preflight snapshot); same
for `producto_id`; `reserva_detalles`/`reserva_pasajeros`/`reserva_ocupaciones`/
`pagos` counts for that reserva equal their preflight values.
**Acceptance (PASS/FAIL):**
1. A `SELECT * FROM _cleanup_report …` appears and is positioned **before** the
   final `ROLLBACK;` — PASS/FAIL.
2. ≥5 distinct post-delete assertions exist, each able to `RAISE EXCEPTION` — PASS/FAIL.
3. The `cliente_id`/`producto_id` assertions compare against the **preflight
   snapshot**, not against `NOT NULL` (which would false-FAIL a legitimately NULL
   original, legal since `058:64-65`) — PASS/FAIL.
4. File is ≤ 500 lines (`wc -l`) per `.claude/rules/file-size.md`; if over, the dev
   flags it rather than silently splitting — PASS/FAIL.
5. G1-G5.
**DB/RLS changes:** none.

### T7 — Operator runbook
**Owner:** dev-senior · **Tag:** [senior] · **Depends on:** T6
**Files in scope:** `docs/migracion/cleanup-keep-RES-1787875561067.md` (create)
**Does:** Step 1 = **backup** (`pg_dump` command with real flags, plus the
Supabase dashboard backup / branch alternative, plus how to verify the dump is
non-empty). Step 2 = the HC-1 transaction-honouring probe, verbatim and
executable. Step 3 = run the script as-is (dry run) via
`psql -v ON_ERROR_STOP=1 -f …`. Step 4 = read the report grid; what each column
means; what a suspicious row looks like. Step 5 = the fiscal sign-off checkbox
(HC-2) and the Section-B/C opt-in decisions. Step 6 = flip `-- COMMIT;` → `COMMIT;`
and re-run. Plus: the KEEP set in plain Spanish and English; "what is NOT covered";
the R-TRIGGER error to watch for; and the rollback statement.
**Acceptance (PASS/FAIL):**
1. The first numbered step is the backup step — PASS/FAIL.
2. The probe in step 2 is copy-pasteable and states the expected result (`NULL`)
   and the abort condition — PASS/FAIL.
3. "NOT covered" explicitly lists: Supabase **Storage** objects behind
   `reservas.documentos_urls` / `factura_cliente_url` / `factura_proveedor_url` /
   `clientes.documentos_urls` (`060:15-17`, `add_documentos_clientes.sql:2`) and
   `comprobantes_fiscales.documento_url` (`038:20`) — deleting rows orphans the
   files; `auth.users` and any non-`public` schema; anything created out of band
   that `to_regclass` did not find — PASS/FAIL.
4. The rollback statement says, in substance, "a committed run is reverted only by
   restoring the step-1 backup; there is no undo script" — PASS/FAIL.
5. `rg -ni 'checkout .* -- |reset --hard|clean -fd|stash drop' docs/migracion/*` →
   0 hits — PASS/FAIL. *(prevention rule: `destructive-op-named-in-rollback-note`.)*
6. The KEEP set is stated in both Spanish and English and matches §4 item-for-item
   — PASS/FAIL.
7. File ≤ 250 lines — PASS/FAIL.
8. G1-G5.
**DB/RLS changes:** none.

### T8 — Completeness cross-check: no table silently omitted
**Owner:** dev-junior · **Tag:** [junior] · **Depends on:** T7
**Files in scope:** `docs/migracion/cleanup-keep-RES-1787875561067.sql` (edit —
**comments/Section-D entries only**, no new or changed `DELETE`)
**Does:** Independently re-derive the table universe from source using the two
commands in §9 ("Completeness"), then verify every derived name appears in exactly
one of Section A / Section B / Section D. Any name found in **zero** sections is
recorded and escalated to the architect (**not** patched by adding a `DELETE`
— per `mistakes/incomplete-control-enumeration`, an incomplete plan enumeration is
an architect-level defect, not a dev send-back). Any name in **two** sections is
fixed by removing the duplicate Section-D entry only.
**Acceptance (PASS/FAIL):**
1. The two derivation commands are pasted with their **full raw output** — PASS/FAIL.
2. A table mapping every derived name → its section (A / B / D) is included — PASS/FAIL.
3. Count reconciliation is shown arithmetically: |A| + |B| + |D| = |derived
   universe|, with the numbers written out — PASS/FAIL.
4. Zero names in zero sections; zero names in two sections — PASS/FAIL.
5. No `DELETE FROM` statement was added, removed, or reordered by this task
   (`git diff` shows comment/Section-D lines only) — PASS/FAIL.
6. G1-G5.
**DB/RLS changes:** none.

---

## 11. Rollback for this plan as a whole

Both deliverables are new, untracked files. To undo the entire plan:
`rm docs/migracion/cleanup-keep-RES-1787875561067.sql docs/migracion/cleanup-keep-RES-1787875561067.md`
No git history is touched, nothing else is affected, and no destructive git verb is
involved. (Rolling back a *committed execution of the SQL* is a different thing
entirely — that is restore-from-backup, runbook step 1.)

PLAN_PATH: docs/plans/db-cleanup-keep-one-reserva.md

---

## Amendment (db-cleanup-decisions-amend, 2026-09-22)

This section is **strictly additive**, appended after the plan's original
content (lines 1-822 above) ends. Nothing above this line was rewritten,
reordered, or deleted — the original design record stands as written. This
section records three decision changes made against that original design,
resolved during the `db-cleanup-decisions-amend` sprint. Full acceptance
criteria, technical approach, and reasoning for all three live in the
sprint's own plan, `docs/plans/db-cleanup-decisions-amend.md` — this section
is the decision record, not a redesign, and adds no new SQL or
implementation detail beyond naming the three files that were amended.

### Decision 1 — `pagos` has no keep set; full unconditional wipe

**Recorded per: the operator, via direct question, this session.**

This supersedes §4's `_keep_pago` definition above (line 248, which defined
a `pagos` keep-set scoped to the payments of the kept reserva) and §5 step 3
above (line 287, which removed non-kept `pagos` rows only, preserving that
keep set). As of this decision, `pagos` has **no keep set at all**: every row
in the table is removed unconditionally, including any payment belonging to
the reserva this plan otherwise keeps. This is a deliberate behaviour change
from the original design recorded in §4/§5, not a correction of an error in
it.

### Decision 2 — three-entity name-assertion guard (Guard 3)

**Recorded per: the operator, via direct question, this session.**

A new preflight requirement, absent from this plan's original design: before
touching any row, the destructive script now resolves the kept reserva's
client name, product name, and that product's supplier name, and refuses to
proceed unless all three match a canonical, case-insensitive substring
pattern specific to the intended data. The read-only companion script
previews the same check. This addition runs before §4's KEEP set is ever
materialised and does not alter §4 or §5's original content.

### Decision 3 — Section B stays commented out, unchanged

**Recorded per: the operator, via direct question, this session.**

Section B (`usuarios`, `usuarios_sistema`, `colaboradores`, `datos_maestros`,
`parametros_sistema`, `tipos_productos`, `configuracion_empresa`,
`permisos_roles`, `comprobantes_disponibles`) remains **fully commented out
by default**, exactly as this plan's §5 "Section B" originally specified.
`comprobantes_disponibles` is explicitly reaffirmed unchanged: it still
requires separate fiscal sign-off before anyone uncomments it, on account of
the live DGII NCF sequence state it holds. This amendment neither uncomments
nor proposes uncommenting any Section B line.

### Files amended by these three decisions

- `docs/migracion/02-cleanup-execute.sql`
- `docs/migracion/01-cleanup-dry-run.sql`
- `docs/migracion/README-cleanup.md`

(`docs/plans/db-cleanup-keep-one-reserva.md` — this file — is amended only by
this Amendment section itself.)

PLAN_PATH: docs/plans/db-cleanup-keep-one-reserva.md
