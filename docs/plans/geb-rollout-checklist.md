# GEB Rollout Checklist — live DB verification for `geb-documents-real-data`

**Discharges:** the standing human ruling quoted throughout `docs/plans/geb-documents-real-data.md` —
*"Static review only; defer live verification to a rollout checklist."* Every DB-adjacent task in that
sprint (T1/T5/T7/T11/T12) deferred its live verification here. This is that checklist.

**Scope of this document:** verification only. It does not modify schema, does not run migrations for
you, and does not touch application code. It assumes an operator with real `psql`/Supabase SQL Editor
access to the **target environment**, and a copy of this repo checked out alongside it.

**Grounded against (read, not inferred):**
- `docs/plans/geb-documents-real-data.md` — §0 grounding table, §4 DB changes, §9 HC-1..HC-5, §13 R1-R14
- `scripts/061-create-reserva-pasajeros-ocupaciones.sql`
- `scripts/062-add-voucher-fields-to-reservas.sql`
- `scripts/063-allow-discrepancia-in-auditoria.sql`
- `app/actions/documentos-actions.ts` (the `getFacturaNumeroPorReservaAction` query, verified at
  `:882-932` as read at the time this checklist was written)
- `lib/user-context.tsx`, `components/auth-guard.tsx`, `middleware.ts` (HC-1 verification, §6)
- `tests/supabase-client.test.ts` (confirms `lib/supabase.ts`'s client is a lazy proxy, not an
  authenticated session)

Every claim below is either traceable to one of the files above (cited inline) or marked
**UNVERIFIED — [what to check]** where it cannot be confirmed without live DB/network access this
agent does not have.

---

## 0. PRE-FLIGHT / BLOCKING GATE — run this BEFORE anything else

If either check in this section fails, **STOP**. Do not proceed to §1. Nothing below this gate is
safe to run until both pass.

### 0.1 Postgres version — `scripts/061` requires PG15+

`scripts/061-create-reserva-pasajeros-ocupaciones.sql:84-86` uses
`FOREIGN KEY (ocupacion_id, reserva_id) REFERENCES reserva_ocupaciones (id, reserva_id) ON DELETE SET NULL (ocupacion_id)`
— the **column-list form** of `ON DELETE SET NULL`, which is a **PostgreSQL 15+ only** syntax. On
PG14 and earlier this statement is a syntax error.

The script's own header (`scripts/061:50-57`) notes it is wrapped in an explicit `BEGIN`/`COMMIT` —
a deliberate exception to the rest of this repo's un-wrapped migrations — specifically so that a
syntax failure on PG14 aborts the **whole file atomically** rather than leaving
`reserva_ocupaciones` created and `reserva_pasajeros` missing. That protects you from a half-applied
schema, but it does **not** make the migration work on PG14 — it still cannot land as written.

- [ ] **Run:**
  ```sql
  SHOW server_version_num;
  -- or, for a human-readable string:
  SELECT version();
  ```
- [ ] **Expected:** `server_version_num >= 150000` (PG15.0+).
- [ ] **On failure (< 150000):** STOP. Do not run `scripts/061`. This is an architectural fork the
  plan did not resolve — either (a) get the environment upgraded to PG15+, or (b) send `scripts/061`
  back to the architect for a PG14-compatible rewrite (a single-column `ON DELETE SET NULL` that
  nulls `reserva_id` too would violate `reserva_pasajeros.reserva_id NOT NULL` and abort deletes —
  see the script's own comment at `:34-41` — so this is **not** a mechanical downgrade; it needs a
  real decision). Do not guess at a workaround here.

### 0.2 `comprobantes_fiscales` real column shape — the single most important query of the rollout

Per finding F1 (`docs/plans/geb-documents-real-data.md:66-68`), `scripts/038` creates a
**supplier-invoice** `comprobantes_fiscales` with **no `reserva_id` and no `numero_factura`**, and
`scripts/039:2` then `DROP TABLE IF EXISTS comprobantes_fiscales CASCADE`s it. The shape the app
actually reads — `reserva_id`, `numero_factura` — exists **only in the live production database**,
created out of band, and has never been verified against this repo's migrations.

The code that depends on this (`app/actions/documentos-actions.ts:882-932`,
`getFacturaNumeroPorReservaAction`) already defends itself at runtime: it issues exactly one
`SELECT *` filtered `.eq("reserva_id", reservaId)`, and if the live table lacks `reserva_id` the
query itself errors (→ `LOOKUP_FAILED`); if the row lacks `numero_factura` as a key at all, an
explicit `hasOwnProperty` check catches it (→ `LOOKUP_FAILED`, `documentos-actions.ts:912-915`). This
is risk **R3**: with that BLOCK in place, an environment missing either column cannot generate **any**
CONFIRMACIÓN — a potential **total feature outage**, by design, in preference to printing a wrong or
blank fiscal number.

- [ ] **Run against the TARGET (production or whichever environment is being rolled out to):**
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'comprobantes_fiscales'
  ORDER BY ordinal_position;
  ```
- [ ] **Expected:** the result set includes a row with `column_name = 'reserva_id'` and a row with
  `column_name = 'numero_factura'`.
- [ ] **Cross-check against what the code actually queries** — confirm these are the two columns the
  code depends on:
  ```
  $ grep -n '\.from(COMPROBANTES_FISCALES_TABLA)\|\.eq("reserva_id"\|numero_factura' app/actions/documentos-actions.ts
  ```
  (At the time this checklist was written: `documentos-actions.ts:888` `.from(COMPROBANTES_FISCALES_TABLA)`,
  `:890` `.eq("reserva_id", reservaId)`, `:917` `filaMasReciente.numero_factura`, `:912`
  `hasOwnProperty.call(filaMasReciente, "numero_factura")`.)
- [ ] **On failure (either column missing, or the table itself does not exist):** **STOP** — this is
  not a code bug to patch quietly. Per HC-2 the application will BLOCK every CONFIRMACIÓN with
  `"FACTURA #: no se pudo consultar el comprobante fiscal — problema técnico, no de datos: <detalle>"`.
  That is the *correct*, designed behavior (never fabricate an NCF), but it means the feature is
  **not usable in this environment until the real schema is confirmed and, if necessary, migrated**.
  Escalate to the architect/human before writing a new migration for this table — schema for a
  fiscal document is explicitly senior + human-gated per `CLAUDE.md`.
- [ ] **Also confirm the table exists at all**, independent of columns:
  ```sql
  SELECT to_regclass('comprobantes_fiscales');
  ```
  **Expected:** non-null. If `NULL`, the table doesn't exist in this environment — same STOP as above.

---

## 1. APPLY ORDER for 061 / 062 / 063

**Order: `scripts/061` → `scripts/062` → `scripts/063`.**

Reasoning:
- **061 first** — it is the only one of the three with a hard version dependency (§0.1) and the only
  one creating new tables. Nothing downstream reads `reserva_pasajeros`/`reserva_ocupaciones`, so
  there is no forward dependency forcing a different order, but running the highest-risk,
  atomically-wrapped migration first means any failure is caught immediately, before touching
  `reservas` or `auditoria`.
- **062 second** — purely additive columns on the pre-existing `reservas` table
  (`scripts/062:66-70`, all `ADD COLUMN IF NOT EXISTS`), independent of 061 and 063. No ordering
  requirement forces it after 061, but doing new-table work before touching an existing,
  actively-written table (`reservas`) is the more conservative order.
- **063 last** — widens `auditoria.accion`'s CHECK constraint. Independent of both 061 and 062 (it
  only touches `auditoria`), but it is the one migration that discovers its target constraint's real
  name dynamically at run time (`scripts/063:82-107`), so running it last means if it needs to be
  re-run after a fix, it doesn't re-trigger the version-sensitive 061.

There is no code path in this sprint that requires 062 or 063 to complete before the other — verified
by grep: neither script references a table or column the other creates.

### 1.1 Idempotency — verified against the actual SQL, not asserted

- [ ] **`scripts/061` is idempotent.** `CREATE TABLE IF NOT EXISTS` (`:60`, `:73`),
  `CREATE INDEX IF NOT EXISTS` (`:89-90`), and — because `CREATE POLICY` has **no** `IF NOT EXISTS`
  form in Postgres — an explicit `DROP POLICY IF EXISTS ... ; CREATE POLICY ...` pair for each policy
  (`:106-108`, `:110-112`), exactly as the script's own comment at `:102-105` states. Re-running the
  whole file is safe.
- [ ] **`scripts/062` is idempotent.** Every statement is `ALTER TABLE reservas ADD COLUMN IF NOT
  EXISTS ...` (`:66-70`). Re-running is a no-op on the second pass.
- [ ] **`scripts/063` is idempotent by construction, not just by guard.** It is wrapped in a `DO $$
  ... END $$` block (`:82-107`) that looks up whatever CHECK constraint currently constrains `accion`
  via `pg_constraint`/`pg_get_constraintdef` (`:89-93`), drops it by its **actual** name (`:95-97`,
  never a hardcoded guess), and re-adds it under the fixed name `auditoria_accion_check` with the
  4-value list. Re-running finds the just-widened 4-value constraint and replaces it with the same
  4-value definition — a true no-op on the second pass. It also no-ops cleanly (with a `RAISE NOTICE`,
  `:104-105`) if `auditoria` doesn't exist at all, mirroring `scripts/058-fix-auditoria-table.sql:8`'s
  existence guard.
- [ ] **Run each script a second time immediately after the first** and confirm: no error, and (for
  063) the `RAISE NOTICE` on the second run still reports the widened constraint, not a fresh DROP of
  something unexpected.

---

## 2. POST-APPLY STRUCTURAL VERIFICATION

### 2.1 `reserva_pasajeros` / `reserva_ocupaciones` — full column dump

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('reserva_pasajeros', 'reserva_ocupaciones')
ORDER BY table_name, ordinal_position;
```

- [ ] **Expected — `reserva_ocupaciones`** (`scripts/061:60-71`):
  | column | type | nullable | default |
  |---|---|---|---|
  | id | integer | NO | `nextval(...)` (serial) |
  | reserva_id | integer | NO | none |
  | orden | integer | NO | none |
  | cantidad | integer | NO | none |
  | ocupacion | text | NO | none |
  | categoria | text | NO | none |
  | fecha_creado | timestamptz | NO | `now()` |
  | registrado_por | text | YES | none |
- [ ] **Expected — `reserva_pasajeros`** (`scripts/061:73-87`):
  | column | type | nullable | default |
  |---|---|---|---|
  | id | integer | NO | `nextval(...)` (serial) |
  | reserva_id | integer | NO | none |
  | ocupacion_id | integer | **YES** | none |
  | orden | integer | NO | none |
  | nombre_completo | text | NO | none |
  | tipo_pax | text | NO | none |
  | documento | text | **YES** | none |
  | fecha_creado | timestamptz | NO | `now()` |
  | registrado_por | text | YES | none |
- [ ] **On failure (a column missing, wrong type, or unexpectedly nullable/non-nullable):** STOP —
  do not proceed to §3. This means `scripts/061` did not apply as written, or an out-of-band change
  exists in this environment (the same class of drift finding F1 found for `comprobantes_fiscales`).
  Re-run `scripts/061` and re-check before going further; if the mismatch persists, escalate — do not
  hand-patch the live schema to match this checklist's expectation.

### 2.2 The 5 new `reservas` columns — nullability is load-bearing, not incidental

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'reservas'
  AND column_name IN ('localizador', 'regimen', 'pax_adultos', 'pax_ninos', 'pax_infantes')
ORDER BY column_name;
```

- [ ] **Expected — ALL FIVE rows show `is_nullable = 'YES'` AND `column_default IS NULL`.** No
  exceptions. This is the sprint's core rule made concrete: `NULL` means "not supplied", and per
  `scripts/062:13-20`, a `DEFAULT 0` (or any default) would make "nobody filled this in"
  indistinguishable from "genuinely zero adults/children/infantes" — the exact
  mistakes/stockin-zero-price failure this sprint exists to eliminate, reintroduced at the schema
  level where no application code could ever catch it. **If any of the five has a non-null default,
  this is a BLOCKING defect — stop and escalate; do not silently drop the default yourself without
  confirming why it's there.**
  | column | expected type | nullable | default |
  |---|---|---|---|
  | localizador | text | YES | NULL |
  | regimen | text | YES | NULL |
  | pax_adultos | integer | YES | NULL |
  | pax_ninos | integer | YES | NULL |
  | pax_infantes | integer | YES | NULL |
- [ ] **On failure:** STOP. Do not proceed until corrected. A `DEFAULT` here silently defeats the
  entire BLOCK-never-default design (`docs/plans/geb-documents-real-data.md:285`).

### 2.3 Constraint checks

**Composite FK, its UNIQUE dependency, and the passenger-name CHECK — do not assume names, read
them from `pg_constraint`:**

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'reserva_pasajeros'::regclass
ORDER BY contype, conname;
```
- [ ] **Expected rows (names may vary — verify by DEFINITION, not by guessing a name):**
  - a `f` (foreign key) constraint whose definition matches
    `FOREIGN KEY (ocupacion_id, reserva_id) REFERENCES reserva_ocupaciones(id, reserva_id) ON DELETE SET NULL (ocupacion_id)`
  - a `f` constraint on `reserva_id` alone `REFERENCES reservas(id) ON DELETE CASCADE`
  - a `u` (unique) constraint on `(reserva_id, orden)`
  - a `c` (check) constraint whose definition includes `nombre_completo ~ '\S'::text` (or equivalent
    escaped form)
  - a `c` constraint whose definition includes `tipo_pax = ANY (ARRAY['ADULTO'::text, 'NINO'::text, 'INFANTE'::text])` (or equivalent)

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'reserva_ocupaciones'::regclass
ORDER BY contype, conname;
```
- [ ] **Expected rows:**
  - a `f` constraint on `reserva_id` `REFERENCES reservas(id) ON DELETE CASCADE`
  - a `u` constraint on `(reserva_id, orden)`
  - **a `u` constraint on `(id, reserva_id)`** — this is the composite-FK target
    `reserva_pasajeros.ocupacion_id` depends on; Postgres requires a unique constraint whose column
    set exactly matches the referenced columns, and the plain `PRIMARY KEY (id)` does **not** satisfy
    that for a 2-column reference (`scripts/061:28-32`). If this is missing, the FK creation in
    `reserva_pasajeros` would already have failed at apply time — so its presence here is really a
    confirmation that §2.1/§1 succeeded, not a new risk.
  - a `c` constraint `cantidad > 0`
- [ ] **On failure (any constraint absent or with a different definition than stated):** STOP. This
  is either an incomplete apply of `scripts/061` or a hand-edited schema. Do not add the missing
  constraint by hand from memory — re-run `scripts/061` (it's idempotent, §1.1) and re-check.

### 2.4 `auditoria.accion` CHECK — widened by exactly one value, nothing narrowed

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'auditoria'::regclass AND contype = 'c';
```
- [ ] **Run this query BEFORE applying `scripts/063`** and record the output (expected: one row,
  `accion = ANY (ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying]::text[])`
  or equivalent, name likely — but not assumed — `auditoria_accion_check`).
- [ ] **Run it again AFTER applying `scripts/063`.**
- [ ] **Expected AFTER:** exactly one row, `conname = 'auditoria_accion_check'`, definition includes
  **all four** values `'INSERT'`, `'UPDATE'`, `'DELETE'`, `'DISCREPANCIA'`.
- [ ] **The failure mode that matters most here is not "DISCREPANCIA missing" — it's "INSERT/UPDATE/
  DELETE silently dropped."** A widened constraint that narrowed something else is exactly the
  regression `scripts/063`'s own header (`:15-24`) exists to avoid by reading the real constraint
  name instead of assuming it. Confirm all 4 pre-existing + new values are present, not just the new
  one.
- [ ] **Functional confirmation — insert one row of each:**
  ```sql
  BEGIN;
  INSERT INTO auditoria (tabla, registro_id, accion, usuario) VALUES ('test','0','INSERT','rollout-check');
  INSERT INTO auditoria (tabla, registro_id, accion, usuario) VALUES ('test','0','UPDATE','rollout-check');
  INSERT INTO auditoria (tabla, registro_id, accion, usuario) VALUES ('test','0','DELETE','rollout-check');
  INSERT INTO auditoria (tabla, registro_id, accion, usuario) VALUES ('test','0','DISCREPANCIA','rollout-check');
  ROLLBACK; -- do not leave test rows behind
  ```
  **Expected:** all four `INSERT`s succeed (no CHECK violation). **Expected on a fifth, deliberately
  invalid value** (e.g. `'BOGUS'`): a CHECK constraint violation error — confirms the constraint is
  still enforcing, not just present.
- [ ] **On failure (any of the first four rejected, or the fifth accepted):** STOP. Do not proceed to
  wiring T5/T8's discrepancy-logging path against this table until the constraint is correct.
- [ ] **If `auditoria` does not exist in this environment at all** (`SELECT to_regclass('auditoria');`
  returns `NULL`): per `scripts/063:26-30,86,104-105` this is a known, guarded no-op — the migration
  will `RAISE NOTICE` and do nothing. That is by design (mirrors `scripts/058:8`), not a failure of
  this migration — but it does mean `registrarDiscrepanciaTotalesAction` (HC-3's persistence path)
  has nowhere to write in this environment, which should be flagged to the team separately (this is
  the same class of finding as F1, not something to fix inside this checklist).

---

## 3. RLS VERIFICATION — never probed live, only statically reviewed until now

### 3.1 RLS is actually enabled

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('reserva_pasajeros', 'reserva_ocupaciones');
```
- [ ] **Expected:** both rows show `relrowsecurity = true`. (`relforcerowsecurity` is expected
  `false` — the plan never asked for `FORCE ROW LEVEL SECURITY`, which would additionally restrict
  the table owner; not requested, not required, not a failure if absent.)
- [ ] **On failure:** STOP. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (`scripts/061:93-94`) either
  didn't run or was reverted. Do not proceed to any write-path testing until this is `true`.

### 3.2 The policies exist and are scoped `TO authenticated`

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('reserva_pasajeros', 'reserva_ocupaciones');
```
- [ ] **Expected:** exactly one policy per table — `reserva_pasajeros_staff_all` and
  `reserva_ocupaciones_staff_all` (`scripts/061:107-108`, `:111-112`) — each with `roles = {authenticated}`,
  `cmd = ALL`, `qual = true`, `with_check = true`. **Confirm `roles` does NOT include `anon` or
  `public`** — the script never grants to `anon` (`scripts/061:97`, stated explicitly in its own
  comment), and this is the entire point of Approach C (HC-1, §9 of the plan): the browser client is
  unauthenticated `anon`, so these policies must never be reachable from it directly.
- [ ] **On failure (policy missing, or `roles` includes `anon`/`public`):** STOP. This is a
  security-relevant failure — do not proceed to any functional testing until fixed. Do not weaken
  this to make the app "just work"; if the app can't reach the table, the fix is to route through
  `app/actions/documentos-actions.ts`'s service-role client, never to loosen the policy (Approach C
  was chosen specifically to avoid Approach B, "permissive `TO anon, authenticated USING (true)`",
  which the plan explicitly rejected — `docs/plans/geb-documents-real-data.md:115-117`).

### 3.3 The 8-request anon probe — all rejected

Using **only** the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` from this environment, never the
service-role key), against the PostgREST endpoint directly:

```bash
export SUPABASE_URL="<target project URL>"
export ANON_KEY="<target NEXT_PUBLIC_SUPABASE_ANON_KEY>"

# reserva_pasajeros
curl -s -o /dev/null -w "SELECT  reserva_pasajeros: %{http_code}\n" \
  "$SUPABASE_URL/rest/v1/reserva_pasajeros?select=*&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

curl -s -o /dev/null -w "INSERT  reserva_pasajeros: %{http_code}\n" \
  -X POST "$SUPABASE_URL/rest/v1/reserva_pasajeros" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reserva_id":1,"orden":1,"nombre_completo":"Anon Probe","tipo_pax":"ADULTO"}'

curl -s -o /dev/null -w "UPDATE  reserva_pasajeros: %{http_code}\n" \
  -X PATCH "$SUPABASE_URL/rest/v1/reserva_pasajeros?id=eq.1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"nombre_completo":"Hacked"}'

curl -s -o /dev/null -w "DELETE  reserva_pasajeros: %{http_code}\n" \
  -X DELETE "$SUPABASE_URL/rest/v1/reserva_pasajeros?id=eq.1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# reserva_ocupaciones — repeat all four
curl -s -o /dev/null -w "SELECT  reserva_ocupaciones: %{http_code}\n" \
  "$SUPABASE_URL/rest/v1/reserva_ocupaciones?select=*&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

curl -s -o /dev/null -w "INSERT  reserva_ocupaciones: %{http_code}\n" \
  -X POST "$SUPABASE_URL/rest/v1/reserva_ocupaciones" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reserva_id":1,"orden":1,"cantidad":1,"ocupacion":"DOBLE","categoria":"Probe"}'

curl -s -o /dev/null -w "UPDATE  reserva_ocupaciones: %{http_code}\n" \
  -X PATCH "$SUPABASE_URL/rest/v1/reserva_ocupaciones?id=eq.1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"categoria":"Hacked"}'

curl -s -o /dev/null -w "DELETE  reserva_ocupaciones: %{http_code}\n" \
  -X DELETE "$SUPABASE_URL/rest/v1/reserva_ocupaciones?id=eq.1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

- [ ] **Expected:** every one of the 8 requests returns **either an empty result with 200/206 (SELECT
  reading zero rows, because RLS filters them all out) or 401/403** for the write attempts. **A `200`
  with a non-empty body on SELECT, or a `200`/`201`/`204` on INSERT/UPDATE/DELETE, is an automatic
  FAIL** — RLS is not doing its job.
- [ ] **On failure:** STOP. Treat as a security incident, not a checklist item to fix casually —
  escalate immediately. Do not proceed to §4 (functional round-trip) or announce rollout success.

### 3.4 THE COUNTER-PROBE — matters more than the probe itself

Without this step, a network failure, a wrong URL, or an expired/rotated anon key produces the
**exact same result** as §3.3 (every request fails) — a false green that looks identical to "RLS is
protecting me." Prove the anon key is actually a *working* credential first:

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  "$SUPABASE_URL/rest/v1/productos?select=id,nombre&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

(`productos` is chosen because `docs/plans/geb-documents-real-data.md:71` confirms — via a repo-wide
grep for `ENABLE ROW LEVEL SECURITY`/`CREATE POLICY` across all 60 pre-`061` files in `scripts/` —
that **no pre-existing table has RLS**, so this table is genuinely, unconditionally readable by
`anon` today. Any other pre-existing table works equally well; `clientes` or `suplidores` are
reasonable substitutes if `productos` is empty in this environment.)

- [ ] **Expected:** `HTTP 200` with a real JSON row (or an empty array `[]` **only** if the table is
  genuinely empty in this environment — confirm row count separately if so:
  `SELECT count(*) FROM productos;`).
- [ ] **On failure (401, 403, connection error, or empty response with a nonzero row count):** **STOP
  — §3.3's results are invalid and must be re-run.** A key that can't even read an admittedly-open
  table proves nothing about RLS on the new tables; you have a broken key or broken connectivity, not
  a secured feature. Fix the key/URL/connectivity, re-run §3.4 until it passes, **then** re-run §3.3.

### 3.5 Negative-insert rejections (business-rule enforcement, not RLS — run via the service-role
path or with a valid `authenticated` session, since `anon` is already blocked by §3.3)

- [ ] **Whitespace-only name rejected:**
  ```sql
  INSERT INTO reserva_pasajeros (reserva_id, orden, nombre_completo, tipo_pax)
  VALUES (<a real reserva id>, 999, '   ', 'ADULTO');
  ```
  **Expected:** rejected with a CHECK constraint violation on `nombre_completo`. Also try a
  tab-only value (`E'\t'`) — the CHECK uses the `\S` regex escape specifically because `btrim()`
  alone would miss a tab/newline-only string (`scripts/061:12-19`); confirm the tab case is rejected
  too, not just the plain-space case.
- [ ] **Cross-reserva occupancy link rejected:**
  ```sql
  -- Using two DIFFERENT real reserva ids, R1 and R2:
  INSERT INTO reserva_ocupaciones (reserva_id, orden, cantidad, ocupacion, categoria)
  VALUES (<R1>, 1, 2, 'DOBLE', 'Test') RETURNING id;
  -- take the returned id as <ocupacion_id_from_R1>
  INSERT INTO reserva_pasajeros (reserva_id, ocupacion_id, orden, nombre_completo, tipo_pax)
  VALUES (<R2>, <ocupacion_id_from_R1>, 999, 'Cross Reserva Test', 'ADULTO');
  ```
  **Expected:** rejected — the composite FK `(ocupacion_id, reserva_id) REFERENCES
  reserva_ocupaciones(id, reserva_id)` has no matching row, because the occupancy row belongs to
  `R1`, not `R2` (`scripts/061:22-32`'s stated purpose for the composite FK over a single-column one).
- [ ] **On failure (either insert succeeds):** STOP — this is a data-integrity defect, not a
  cosmetic one. A cross-reserva link succeeding means a future bug in a service-role action could
  silently attach a passenger to another reservation's room group. Clean up any test rows inserted
  above (`DELETE FROM reserva_pasajeros WHERE nombre_completo = 'Cross Reserva Test';` etc.) whether
  this step passes or fails.

---

## 4. FUNCTIONAL ROUND-TRIP (requires a real reserva in a NON-PRODUCTION environment — do not run
this section against production data)

- [ ] **Pick or create one throwaway reserva in staging/dev** and note its `id`. Everything in this
  section operates on that one reserva.

### 4.1 T2/T2b — passenger/occupancy save survives a re-save, and orphans are never silent

1. Through the app (or by calling `guardarPasajerosReservaAction`/`guardarOcupacionesReservaAction`
   directly), save 2+ occupancy groups (different `ocupacion`/`categoria`) and 2+ passengers, each
   passenger's `ocupacion_id` pointing at a different group.
2. **Confirm the links persisted:**
   ```sql
   SELECT p.id, p.nombre_completo, p.ocupacion_id, o.orden, o.ocupacion, o.categoria
   FROM reserva_pasajeros p LEFT JOIN reserva_ocupaciones o ON o.id = p.ocupacion_id
   WHERE p.reserva_id = <the reserva id>
   ORDER BY p.orden;
   ```
   **Expected:** every passenger's `ocupacion_id` matches the room they were assigned to.
3. **Re-save the occupancy set with one small change** (e.g. a `categoria` typo fix, per the T2b
   regression test named in the plan — `docs/plans/geb-documents-real-data.md:579`) — same `orden`
   values, same `ocupacion` values, corrected `categoria`.
4. **Re-run the query in step 2.** **Expected:** passenger→room links **survive** by material
   identity (`orden` + `ocupacion` + `categoria` match) — no `ocupacion_id` silently goes to `NULL`
   just because the delete-then-insert cycle issued fresh serial ids. **On failure (any previously
   linked passenger now shows `ocupacion_id IS NULL` with no reported cause):** this is the HC-4
   defect the plan describes at `docs/plans/geb-documents-real-data.md:422-424` — STOP, do not
   consider T2b rolled out correctly, and check the save call's return value for `relinked`/
   `enlacesNoRestablecidos` (§4.1's failure-path check below covers what those should say).
5. **Re-save with a materially different room** (change `ocupacion` or `categoria`, same `orden`).
   **Expected:** the previously linked passenger's `ocupacion_id` is now `NULL` (not re-linked to the
   new, different room), and the save's return value reports it in `enlacesNoRestablecidos`/
   `enlacesDescartados` — never a silently wrong room on what will become a customer-facing document.
6. **Failure-path check:** if the underlying re-save is made to fail (e.g. temporarily revoke insert
   on `reserva_ocupaciones` for the role being used, run the save, then restore the grant), **the
   original occupancy set must be restored**, not left half-deleted. Confirm via:
   ```sql
   SELECT count(*) FROM reserva_ocupaciones WHERE reserva_id = <the reserva id>;
   ```
   **Expected:** same count as before the forced-failure attempt.

### 4.2 T15 AC-1 — `localizador` persists, never regenerated

1. Set a `localizador` value on the reserva through the voucher screen (or
   `guardarDatosVoucherReservaAction`).
2. Reload the page.
3. **Expected:** the same `localizador` value is shown — it must **never** be regenerated (the
   legacy `generateVoucherNumber()`, deleted per the plan, used to mint a fresh
   `date + Math.random()` value on every click and never persisted it —
   `docs/plans/geb-documents-real-data.md:34`, `scripts/062:22-34`). Confirm directly:
   ```sql
   SELECT localizador FROM reservas WHERE id = <the reserva id>;
   ```

### 4.3 T15 AC-13 — field-by-field walk against the real `.docx` files

- [ ] Generate a real VOUCHER for the throwaway reserva and a real CONFIRMACIÓN, and compare **every
  labelled field, in source order**, against `docs/VOUCHER GEB-2.docx` and
  `docs/CONFIRMACION GEB.docx` respectively (both files present in this repo at `docs/`).
- [ ] **Expected:** same sections, same order, same labels — including any known, deliberately
  reproduced source typos (e.g. the VOUCHER's `OBERSACIONES` label, flagged in the plan at
  `docs/plans/geb-documents-real-data.md:880,896` as a source typo that must be reproduced, not
  silently corrected). **On failure:** do not "fix" a labelled drift in the middle of a rollout
  check — record it and route it back through the same reproduce-and-flag process T10/T16 used.

### 4.4 HC-3 — a totals discrepancy still generates, and logs exactly once

1. On the throwaway reserva, make `Σ reserva_detalles.total` disagree with `reservas.precio_total`
   by more than the `0.01` threshold (e.g. edit one `reserva_detalles.total` directly, bypassing the
   trigger's resync — or add/adjust a detalle and don't let the trigger's next recompute run before
   generating the document, if your test setup allows isolating the moment).
2. Generate a CONFIRMACIÓN for that reserva.
3. **Expected:** the document generates **normally** — no on-screen or on-document warning
   (`docs/plans/geb-documents-real-data.md:418-420`, HC-3's explicit ruling) — **and** exactly one
   new row appears in `auditoria`:
   ```sql
   SELECT * FROM auditoria
   WHERE tabla = 'reservas' AND registro_id = '<the reserva id>' AND accion = 'DISCREPANCIA'
   ORDER BY fecha DESC LIMIT 5;
   ```
   **Expected:** exactly **one** new row (count `1`, not `≥1`) since your last check, with
   `datos_nuevos` containing `source: 'CONFIRMACION'`, the `reserva_id`, `cliente_id`,
   `suma_detalles`, `precio_total`, `delta`, `moneda`, `generado_en` (`docs/plans/geb-documents-real-data.md:307`).
4. **On failure (no row, more than one row, or the document fails to generate):** STOP — this is
   HC-3's core contract. A missing row means the "logged for cleanup" promise (R7) is not being kept
   in this environment; more than one row for a single generation means something is double-writing.

---

## 5. ROLLBACK

**Run these in reverse apply order relative to §1: 063 → 062 → 061**, though none of the three
technically depends on another for its rollback to succeed.

### 5.1 `scripts/063` rollback — safe, no data loss

```sql
DO $$
DECLARE
  v_conname text;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'auditoria') THEN
    SELECT conname INTO v_conname FROM pg_constraint
      WHERE conrelid = 'auditoria'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%accion%';
    IF v_conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE auditoria DROP CONSTRAINT %I', v_conname);
    END IF;
    ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check
      CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE'));
  END IF;
END $$;
```
(Verbatim from `scripts/063:65-80`.) **Data-loss warning: any existing `auditoria` row with
`accion = 'DISCREPANCIA'` will make this rollback itself fail the CHECK** if such rows exist when
you re-add the narrower constraint — Postgres validates existing rows against a newly added CHECK.
**Delete or migrate those rows first** if you need to roll this back after HC-3 has been live and
logging discrepancies:
```sql
-- Only if you intend to also discard the discrepancy history:
DELETE FROM auditoria WHERE accion = 'DISCREPANCIA';
```
This **destroys** every discrepancy record HC-3 wrote — confirm that's actually wanted before running
it.

### 5.2 `scripts/062` rollback — DESTROYS DATA

```sql
ALTER TABLE reservas
  DROP COLUMN IF EXISTS localizador,
  DROP COLUMN IF EXISTS regimen,
  DROP COLUMN IF EXISTS pax_adultos,
  DROP COLUMN IF EXISTS pax_ninos,
  DROP COLUMN IF EXISTS pax_infantes;
```
(Verbatim from `scripts/062:64`.) **This permanently loses every saved `localizador`, `regimen`, and
pax breakdown across every reserva in the environment.** There is no soft-delete or archive step in
this migration — once dropped, that data is gone unless you have a separate DB backup/snapshot from
before the drop. Confirm a backup exists before running this in any environment with real data.

### 5.3 `scripts/061` rollback — DESTROYS DATA (the more severe of the two)

```sql
DROP TABLE IF EXISTS reserva_pasajeros;
DROP TABLE IF EXISTS reserva_ocupaciones;
```
(Verbatim from `scripts/061:48` and the script's rollback header.) **This permanently loses every
saved passenger and every saved room-occupancy group for every reservation in the environment** —
the entire passenger/room data CONFIRMACIÓN and VOUCHER both depend on (OQ1's "one shared table
reused by both documents"). There is no way to recover this data after the drop except from a
separate backup taken before it. **Order matters here too**: dropping `reserva_ocupaciones` first
would fail (or cascade, if `CASCADE` were added, which it is not in the stated rollback) because
`reserva_pasajeros.ocupacion_id` still references it — drop `reserva_pasajeros` first, exactly as
written above.

---

## 6. KNOWN OPEN — NOT FIXED BY THIS ROLLOUT

**Read this section even if every check above passed. Passing this checklist is not a security
sign-off.**

**HC-1 — Elibry has no authentication.** Verified directly against the code, not asserted:

- `lib/user-context.tsx:22-38` — `USERS` is a **hardcoded array of two accounts**
  (`admin@ellibry.com`/`admin123`, `usuario@ellibry.com`/`user123`) checked client-side; the session
  is a `localStorage` flag, not a server-verified credential.
- `components/auth-guard.tsx:1-52` — only ever calls `router.push("/login")` when `user` is falsy. It
  performs no server-side check and cannot, by itself, stop any direct API call.
- `middleware.ts:1-27` — passes every non-`/login` request through with `NextResponse.next()`. It
  does **not** verify a session; the comment on `:15` even says so explicitly ("el AuthGuard manejará
  la redirección" — a client-side, UI-only redirect).
- A repo-wide grep confirms **zero real `supabase.auth.*` usage**: the only hits for `supabase.auth`
  in the entire repo are `app/actions/documentos-actions.ts:19` (a comment stating there is none) and
  `tests/supabase-client.test.ts:79,97` (tests confirming that accessing `.auth` on the unconfigured
  proxy client **throws**, not that any real auth flow exists).
- `lib/supabase.ts` and `lib/supabase-server.ts` are both anon-key / service-role-key clients
  respectively — **not** session-scoped clients. The browser genuinely runs every query as PostgREST
  `anon`.
- A repo-wide grep for `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` across `scripts/` returns hits
  **only** in `scripts/061-create-reserva-pasajeros-ocupaciones.sql` — confirmed by
  `grep -rln "ENABLE ROW LEVEL SECURITY\|CREATE POLICY" scripts/` returning exactly one file. **Not
  one of the ~29 pre-existing tables** (`clientes`, `reservas`, `pagos`, `comprobantes_fiscales`,
  etc.) has RLS. `reserva_pasajeros` and `reserva_ocupaciones` are the **first tables in this
  database's history to have RLS at all.**

**Consequence, stated plainly:** anyone holding the public anon key (which ships in every browser
bundle, by definition — it's `NEXT_PUBLIC_SUPABASE_ANON_KEY`) can read and write `clientes`,
`reservas`, `pagos`, and `comprobantes_fiscales` **directly against PostgREST, bypassing the
application entirely** — no login, no token, nothing. Completing every step in §0-§5 above does
**not** close this. The `TO authenticated` policies added by `scripts/061` are correctly written —
they genuinely deny `anon` (confirmed live in §3) — but they currently protect against an attacker
who does not exist yet in this system's model, because **no request in this application is ever
actually authenticated** as a Supabase Auth user. The moment real `supabase.auth` sessions land, these
policies activate with no reshape needed (`scripts/061:98-101` calls this out as the deliberate
"retrofit seam"); until then, they are a well-built lock on a door standing in a wall with no other
walls around it.

This is tracked as **Risk R1** in the sprint plan
(`docs/plans/geb-documents-real-data.md:1089`) and is explicitly **out of scope** for this sprint
(HC-1, human-acknowledged). **Do not report this checklist's completion as evidence that Elibry
became more secure — it did not, beyond the two new tables.**

---

## Finish-line — what "rollout complete" means

- [ ] §0 pre-flight passed (PG15+, `comprobantes_fiscales` shape confirmed)
- [ ] §1 all three scripts applied in order, idempotency re-verified by a second run
- [ ] §2 structural verification passed for both new tables and the 5 `reservas` columns
- [ ] §3 RLS confirmed enabled, policies confirmed `TO authenticated` only, anon probe all-rejected,
      **counter-probe passed** (§3.4 — do not skip), negative-insert rejections confirmed
- [ ] §4 functional round-trip evidenced on a throwaway non-production reserva
- [ ] §6 read and acknowledged by whoever is signing off this rollout — **it is not a security
      clearance**
