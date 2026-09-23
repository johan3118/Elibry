# T1 — Live preflight dev report

**Channel used for all DB queries:** `supabase db query --db-url "$POSTGRES_URL_NON_POOLING"` (Supabase CLI v2.116.0,
installed at `/opt/homebrew/bin/supabase`), which opens a direct Postgres connection using the
project's own `.env.local` connection string (never printed — see redaction note below). `psql`
itself is not installed on this machine; `supabase db query` is the psql-equivalent channel named
in the plan ("psql with a live connection string ... or the Supabase SQL editor") — it executes
arbitrary SQL against the live database, unlike the anon PostgREST endpoint, which the plan
correctly rules out because it cannot read `information_schema`. No 521s were encountered; every
query below succeeded on the first attempt (no retries needed).

**Redaction note:** the connection string, anon key and service-role key are never included below.
The CLI's raw output additionally prepended a boilerplate advisory ("RLS is disabled on 27
tables...") to every call — that advisory is Supabase CLI noise unrelated to this task (Elibry is
single-tenant, ADR 0011: no orgs, RLS intentionally off, this sprint creates no table), so it is
omitted from the transcripts below to keep this report bounded; only the `rows` payload of each
query is quoted, verbatim, plus the per-call random `boundary` token as a liveness fingerprint
(proves each block is a distinct, real response, not a copy-paste).

---

## Q1 — Full live constraint inventory on `clientes`

**Query 1** (`pg_constraint`):
```sql
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.clientes'::regclass
ORDER BY contype, conname;
```
**Captured output (rows):**
```json
[
  { "conname": "chk_empresa_fields", "contype": "c",
    "definition": "CHECK (((((tipo_cliente)::text = 'EMPRESA'::text) AND (rnc IS NOT NULL) AND (razon_social IS NOT NULL) AND (nombre_comercial IS NOT NULL) AND (responsable IS NOT NULL)) OR (((tipo_cliente)::text = 'NORMAL'::text) AND (identificacion IS NOT NULL) AND (nombre_completo IS NOT NULL) AND (sexo IS NOT NULL))))" },
  { "conname": "clientes_compania_check", "contype": "c",
    "definition": "CHECK (((compania)::text = ANY ((ARRAY['MARCA 1'::character varying, 'MARCA 2'::character varying])::text[])))" },
  { "conname": "clientes_sexo_check", "contype": "c",
    "definition": "CHECK (((sexo)::text = ANY ((ARRAY['FEMENINO'::character varying, 'MASCULINO'::character varying, 'OTROS'::character varying, 'N/A'::character varying])::text[])))" },
  { "conname": "clientes_status_check", "contype": "c",
    "definition": "CHECK (((status)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying])::text[])))" },
  { "conname": "clientes_tipo_cliente_check", "contype": "c",
    "definition": "CHECK (((tipo_cliente)::text = ANY ((ARRAY['EMPRESA'::character varying, 'NORMAL'::character varying])::text[])))" },
  { "conname": "clientes_pkey", "contype": "p", "definition": "PRIMARY KEY (id)" }
]
```
Boundary (liveness token): `4c73a943a5d720eb4bf1066052d3b4f0`

**Query 2** (NOT NULL columns, `information_schema.columns`):
```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO'
ORDER BY ordinal_position;
```
**Captured output (rows):**
```json
[
  {"column_name":"id","is_nullable":"NO"},
  {"column_name":"tipo_cliente","is_nullable":"NO"},
  {"column_name":"compania","is_nullable":"NO"},
  {"column_name":"telefonos","is_nullable":"NO"},
  {"column_name":"email","is_nullable":"NO"},
  {"column_name":"direccion","is_nullable":"NO"},
  {"column_name":"registrado_por","is_nullable":"NO"},
  {"column_name":"status","is_nullable":"NO"}
]
```
Boundary: `8311045be887634204c290a7374ac118`

**Verdict per constraint vs `scripts/005-update-clientes-structure.sql`** (cross-reference target
only — the evidence is the live query above, not the script):

| Constraint | Live definition matches 005? | Verdict |
|---|---|---|
| `chk_empresa_fields` | Same predicate (Postgres canonicalized `=` form), same 4 EMPRESA fields + 3 NORMAL fields | **PRESENT, unmodified** |
| `clientes_tipo_cliente_check` (`IN ('EMPRESA','NORMAL')`) | Same 2 values, canonicalized to `= ANY(ARRAY[...])` | **PRESENT, unmodified** |
| `clientes_compania_check` (`IN ('MARCA 1','MARCA 2')`) | Same 2 values | **PRESENT, unmodified** |
| `clientes_sexo_check` (`IN ('FEMENINO','MASCULINO','OTROS','N/A')`) | Same 4 values | **PRESENT, unmodified** |
| `clientes_status_check` (`IN ('ACTIVO','INACTIVO')`, `DEFAULT 'ACTIVO'`) | Same 2 values; live `column_default` for `status` is `'ACTIVO'::character varying` (see Q4) | **PRESENT, unmodified** |
| `clientes_pkey` | `PRIMARY KEY (id)`, `id SERIAL` | **PRESENT, unmodified** |
| `NOT NULL`: `tipo_cliente, compania, telefonos, email, direccion, registrado_por` (+`id` PK, +`status` via DEFAULT+NOT NULL) | Exactly the 8 columns 005 declares NOT NULL | **PRESENT, unmodified** |
| Any `UNIQUE` on `identificacion`/`rnc`/`email` | 005 declares none; live has none (see Q5) | **ABSENT in both — consistent** |

No constraint is MODIFIED or newly ABSENT relative to 005; every constraint 005 created at table-creation time is still live byte-for-byte (module canonicalization by Postgres aside). The live table also carries no CHECK/NOT NULL constraint that 005 doesn't declare.

---

## Q2 — Row counts referencing client id = 15

`to_regclass` existence check first:
```sql
SELECT
  (to_regclass('public.seguimiento_casos') IS NOT NULL) AS seguimiento_casos_exists,
  (to_regclass('public.cambios_provisionales') IS NOT NULL) AS cambios_provisionales_exists,
  (to_regclass('public.acciones_pendientes') IS NOT NULL) AS acciones_pendientes_exists,
  (to_regclass('public.documentos') IS NOT NULL) AS documentos_exists,
  (to_regclass('public.pagos') IS NOT NULL) AS pagos_exists;
```
**Captured output:** `[{"acciones_pendientes_exists":true,"cambios_provisionales_exists":true,"documentos_exists":true,"pagos_exists":true,"seguimiento_casos_exists":true}]`
Boundary: `ee04132b5bc9011e411648f679ba9ce4` — all 5 tables exist.

**Column-shape discovery** (the plan assumed `cliente_id`/`registro_id` columns on all 5 tables; live
schema does not match that assumption uniformly, so the count query had to be derived per table):
```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('seguimiento_casos','cambios_provisionales','acciones_pendientes','documentos','pagos')
  AND (column_name ILIKE '%cliente%' OR column_name ILIKE '%registro%');
```
**Captured output:** `[{"table_name":"acciones_pendientes","column_name":"registro_id"},{"table_name":"cambios_provisionales","column_name":"registro_id"},{"table_name":"pagos","column_name":"cliente_id"},{"table_name":"pagos","column_name":"estado_registro"}]`
Boundary: `09d119411c4119c1888a3291da15ecb5`

Full column dump for the two tables that produced **zero** cliente/registro matches confirmed why:
- `seguimiento_casos` has **no column referencing `clientes` at all** — it is a distributor-case
  table keyed by free-text `email_distribuidor`/`nombre_distribuidor`, not an FK to `clientes`.
  (Boundary: `b831d51bd5a8612550d27396b2490e96`)
- `documentos` uses a **polymorphic** `tipo_entidad` + `entidad_id` pair, not `cliente_id`.
  (Boundary: `b831d51bd5a8612550d27396b2490e96`)
- `acciones_pendientes` and `cambios_provisionales` use a polymorphic `tabla_objetivo`/
  `tabla_afectada` + `registro_id` pair, not a direct `cliente_id` FK column.
  (Boundary: `59d3368a67e2cd9fd31b5572de037079`)

**Final counts** (queries built from the actual live column shapes above):
```sql
SELECT
  (SELECT count(*) FROM public.acciones_pendientes WHERE tabla_objetivo = 'clientes' AND registro_id = 15) AS acciones_pendientes_ref_15,
  (SELECT count(*) FROM public.cambios_provisionales WHERE tabla_afectada = 'clientes' AND registro_id = 15) AS cambios_provisionales_ref_15,
  (SELECT count(*) FROM public.pagos WHERE cliente_id = 15) AS pagos_ref_15,
  (SELECT count(*) FROM public.documentos) AS documentos_total_rows,
  (SELECT count(*) FROM public.seguimiento_casos) AS seguimiento_casos_total_rows;
```
**Captured output:**
```json
[{"acciones_pendientes_ref_15":0,"cambios_provisionales_ref_15":1,"documentos_total_rows":0,"pagos_ref_15":0,"seguimiento_casos_total_rows":0}]
```
Boundary: `0d8dd4b481e62825e4241c55ffcea181`

| Table | Result |
|---|---|
| `acciones_pendientes` (`tabla_objetivo='clientes' AND registro_id=15`) | **0** |
| `cambios_provisionales` (`tabla_afectada='clientes' AND registro_id=15`) | **1** — see finding below |
| `pagos` (`cliente_id=15`) | **0** |
| `documentos` | table is **empty** (0 rows total, so trivially 0 for id 15) |
| `seguimiento_casos` | table is **empty** (0 rows total) and has no FK-shaped column to `clientes` regardless |

**Finding requiring T2/T3 awareness:** there is exactly **one** live `cambios_provisionales` row
referencing `registro_id=15` on `tabla_afectada='clientes'`. Non-PII metadata only:
`id=69, tipo_cambio='CREATE', estado_cambio='PENDIENTE'`. This is a dangling pending
"CREATE" change request pointed at id 15 — it does not block T1 and I am not resolving it (out of
scope), but the relocation design (delete id 15, re-insert sheet row 15) will leave this
`cambios_provisionales` row's `registro_id` pointing at a client that momentarily doesn't exist and
then at a different client (the sheet's row-15 client) after re-insert. Flagging for the backlog /
T3's runbook author to decide whether this warrants a note.

---

## Q3 — FK from `reservas.cliente_id`, and the trigger set

**FK:**
```sql
SELECT conname, confupdtype, confdeltype, condeferrable, condeferred, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.reservas'::regclass AND contype = 'f'
  AND pg_get_constraintdef(oid) ILIKE '%cliente_id%';
```
**Captured output:**
```json
[{"conname":"fk_reservas_cliente","confupdtype":"a","confdeltype":"n","condeferrable":false,"condeferred":false,
  "definition":"FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL"}]
```
Boundary: `50183966d1eaab9993530e30687726d0`

`confupdtype='a'` = **NO ACTION on UPDATE** (no `ON UPDATE` clause was ever declared — this is the
Postgres default), `confdeltype='n'` = **SET NULL on DELETE**. Not deferrable. This confirms the
architect's note verbatim: a plain `UPDATE clientes SET id=1185` would be rejected outright (NO
ACTION on update of a referenced key with existing referencing rows), so the plan's explicit
`UPDATE reservas` repoint-before-delete design is required, not optional.

**Trigger list** on both tables:
```sql
SELECT tgrelid::regclass AS tbl, tgname, pg_get_triggerdef(oid) AS def
FROM pg_trigger
WHERE tgrelid IN ('public.clientes'::regclass, 'public.reservas'::regclass) AND NOT tgisinternal
ORDER BY tbl, tgname;
```
**Captured output:**
```json
[
  {"tbl":"reservas","tgname":"audit_reservas","def":"CREATE TRIGGER audit_reservas AFTER INSERT OR DELETE OR UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION audit_trigger()"},
  {"tbl":"reservas","tgname":"trigger_update_reservas_fecha_editado","def":"CREATE TRIGGER trigger_update_reservas_fecha_editado BEFORE UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION update_fecha_editado()"},
  {"tbl":"clientes","tgname":"trigger_update_clientes_fecha_editado","def":"CREATE TRIGGER trigger_update_clientes_fecha_editado BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION update_fecha_editado()"}
]
```
Boundary: `1c5c8eaae7048fb9fb671b56c1ca8dc7`

**One-sentence verdict (as required by the plan):** the live trigger set confirms the plan's
insert-then-delete design makes the `fecha_editado` tension moot, because `clientes` carries
exactly one trigger, `trigger_update_clientes_fecha_editado`, and it is **BEFORE UPDATE only** (no
BEFORE INSERT trigger exists on `clientes` at all), so neither the 1,231 sheet inserts, the id-1185
insert, nor the id-15 delete can ever fire it.

**Additional finding for T2/T3/T4 (Q6 overlaps here — see below):** `clientes` has **no audit
trigger at all**. The only audit-family trigger in this whole pair of tables is `audit_reservas`
on `reservas`. This directly contradicts the sprint brief's §0 "Accepted, disclosed side effects
(HC-2)" line, which states "~1,232 new `auditoria` rows via `audit_clientes`". There is no
`audit_clientes` trigger live — inserting the 1,231 sheet rows plus the id-1185 relocation insert
plus the id-15 delete will produce **zero** `auditoria` rows, because nothing on `clientes` writes
to it. The one live audit side effect from this sprint's design is `audit_reservas` firing once
(AFTER UPDATE) for the single `reservas` repoint UPDATE — consistent with the brief's second
disclosed side effect (`reservas.fecha_editado` rewrite).

---

## Q4 — Complete live column list of `clientes`

```sql
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default, is_identity, identity_generation
FROM information_schema.columns
WHERE table_schema='public' AND table_name='clientes'
ORDER BY ordinal_position;
```
Boundary: `c48748e02202ec03b6166b9d78c97ffe` — **35 columns**, in ordinal order:

| # | column_name | data_type | char_max_len | is_nullable | column_default |
|---|---|---|---|---|---|
| 1 | id | integer | — | NO | `nextval('clientes_id_seq'::regclass)` |
| 2 | tipo_cliente | character varying | 20 | NO | — |
| 3 | compania | character varying | 50 | NO | — |
| 4 | rnc | character varying | 20 | YES | — |
| 5 | razon_social | character varying | 200 | YES | — |
| 6 | nombre_comercial | character varying | 200 | YES | — |
| 7 | responsable | character varying | 200 | YES | — |
| 8 | identificacion | character varying | 20 | YES | — |
| 9 | nombre_completo | character varying | 200 | YES | — |
| 10 | sexo | character varying | 20 | YES | — |
| 11 | fecha_nacimiento | date | — | YES | — |
| 12 | telefonos | character varying | 200 | NO | — |
| 13 | email | character varying | 200 | NO | — |
| 14 | direccion | text | — | NO | — |
| 15 | observacion | text | — | YES | — |
| 16 | referido_por | character varying | 200 | YES | — |
| 17 | registrado_por | character varying | 200 | NO | — |
| 18 | status | character varying | 20 | NO | `'ACTIVO'::character varying` |
| 19 | fecha_creado | timestamp with time zone | — | YES | `now()` |
| 20 | fecha_editado | timestamp with time zone | — | YES | `now()` |
| 21 | editado_por | character varying | 200 | YES | — |
| 22 | imagen_url | text | — | YES | — |
| 23 | estado_registro | character varying | 20 | YES | `'PERMANENTE'::character varying` |
| 24 | usuario_creacion | character varying | 100 | YES | — |
| 25 | fecha_provisional | timestamp without time zone | — | YES | — |
| 26 | dependencias_ids | text | — | YES | — |
| 27 | telefonos_json | jsonb | — | YES | `'[]'::jsonb` |
| 28 | emails_json | jsonb | — | YES | `'[]'::jsonb` |
| 29 | documentos | jsonb | — | YES | `'[]'::jsonb` |
| 30 | cedula_url | text | — | YES | — |
| 31 | registro_mercantil_url | text | — | YES | — |
| 32 | documento_cedula_url | text | — | YES | — |
| 33 | documento_registro_mercantil_url | text | — | YES | — |
| 34 | documentos_urls | ARRAY | — | YES | — |
| 35 | pais | character varying | 100 | YES | — |

`is_identity` is `NO` and `identity_generation` is `null` for every column, including `id` — `id`
is a classic `SERIAL`-style column backed by `clientes_id_seq` (default `nextval(...)`), not a SQL
`GENERATED ... AS IDENTITY` column. See Q6 for the sequence name confirmation.

**Confirm/refute the 8 named columns:**

| Column | Live? |
|---|---|
| `pais` | **CONFIRMED** — `character varying(100)`, nullable, no default |
| `estado_registro` | **CONFIRMED** — `character varying(20)`, default `'PERMANENTE'` |
| `usuario_creacion` | **CONFIRMED** — `character varying(100)`, nullable |
| `fecha_provisional` | **CONFIRMED** — `timestamp without time zone`, nullable |
| `documentos_urls` | **CONFIRMED** — `ARRAY`, nullable |
| `imagen_url` | **CONFIRMED** — `text`, nullable |
| `cedula_pasaporte` | **REFUTED — does not exist.** There is no column of that name anywhere in the
  35-column live list. The closest live columns are `cedula_url` and `documento_cedula_url`
  (both hold URLs to a scanned document, not an ID-document-type/number field). **T2's generator
  must not emit a `cedula_pasaporte` column in its INSERT list.** |
| `dependencias_ids` | **CONFIRMED** — `text`, nullable |

---

## Q5 — Every live index / unique constraint on `clientes`

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='clientes' ORDER BY indexname;
```
**Captured output:**
```json
[
  {"indexname":"clientes_pkey","indexdef":"CREATE UNIQUE INDEX clientes_pkey ON public.clientes USING btree (id)"},
  {"indexname":"idx_clientes_compania","indexdef":"CREATE INDEX idx_clientes_compania ON public.clientes USING btree (compania)"},
  {"indexname":"idx_clientes_email","indexdef":"CREATE INDEX idx_clientes_email ON public.clientes USING btree (email)"},
  {"indexname":"idx_clientes_emails_json","indexdef":"CREATE INDEX idx_clientes_emails_json ON public.clientes USING gin (emails_json)"},
  {"indexname":"idx_clientes_estado_registro","indexdef":"CREATE INDEX idx_clientes_estado_registro ON public.clientes USING btree (estado_registro)"},
  {"indexname":"idx_clientes_identificacion","indexdef":"CREATE INDEX idx_clientes_identificacion ON public.clientes USING btree (identificacion) WHERE (identificacion IS NOT NULL)"},
  {"indexname":"idx_clientes_rnc","indexdef":"CREATE INDEX idx_clientes_rnc ON public.clientes USING btree (rnc) WHERE (rnc IS NOT NULL)"},
  {"indexname":"idx_clientes_status","indexdef":"CREATE INDEX idx_clientes_status ON public.clientes USING btree (status)"},
  {"indexname":"idx_clientes_telefonos_json","indexdef":"CREATE INDEX idx_clientes_telefonos_json ON public.clientes USING gin (telefonos_json)"},
  {"indexname":"idx_clientes_tipo","indexdef":"CREATE INDEX idx_clientes_tipo ON public.clientes USING btree (tipo_cliente)"}
]
```
Boundary: `f048478febf910b2785d3f9cc93f69d4`

**Verdict: NO ESCALATION.** The only `UNIQUE` index on `clientes` is `clientes_pkey` (on `id`).
`idx_clientes_identificacion`, `idx_clientes_rnc` and `idx_clientes_email` are plain, **non-unique**
btree indexes (confirmed by the absence of the word `UNIQUE` in their `indexdef`, and independently
by the `pg_constraint` dump in Q1 showing zero `contype='u'` rows). There is **no live UNIQUE
constraint or unique index on `identificacion`, `rnc`, or `email`** — importing both duplicate
`identificacion` values (`<CEDULA-A>` and `<CEDULA-B>`) is not blocked by any live constraint.
The Q5 escalation trigger does **not** fire.

---

## Q6 — Sequence, and `auditoria`/`audit_clientes`

```sql
SELECT pg_get_serial_sequence('public.clientes','id') AS seq;
```
**Captured output:** `[{"seq":"public.clientes_id_seq"}]` — Boundary: `1b0cb6563326210e6080ca6e32601504`

`id` is backed by a real Postgres sequence, `public.clientes_id_seq` (classic serial, not SQL
identity — corroborated by Q4's `is_identity='NO'`).

```sql
SELECT (to_regclass('public.auditoria') IS NOT NULL) AS auditoria_exists,
       (to_regclass('public.audit_logs') IS NOT NULL) AS audit_logs_exists;
```
**Captured output:** `[{"auditoria_exists":true,"audit_logs_exists":true}]` — Boundary: `481389fe51e98f6a4c9734f7fec0987a`

Both `auditoria` and `audit_logs` tables exist live. But (see Q3 for the full trigger dump):

```sql
SELECT tgname, tgrelid::regclass AS tbl, pg_get_triggerdef(oid) AS def
FROM pg_trigger WHERE tgrelid = 'public.clientes'::regclass AND tgname ILIKE '%audit%' AND NOT tgisinternal;
```
**Captured output:** `[]` (empty) — Boundary: `2706bc36bb728e736cf9ee630755b733`

**`audit_clientes` is NOT live.** There is no trigger of that name, or any audit-shaped trigger, on
`clientes`. (Confirmed independently by Q3's exhaustive, un-filtered trigger dump on both tables,
which lists exactly 3 triggers total and none on `clientes` besides the fecha_editado one.) See the
Q3 finding above — this contradicts the sprint brief's HC-2 assumption of "~1,232 new `auditoria`
rows via `audit_clientes`"; the actual number of new `auditoria`/`audit_logs` rows produced by the
1,231 inserts + 1 relocation insert + 1 delete on `clientes` is **zero**.

---

## Q7 — Pin the source workbook (HC-5, closed by orchestrator recon — confirm-and-pin only)

```
$ shasum -a 256 docs/migracion-clientes.xlsx
6a0eb8185926e92586ea8006df30a0195ffd37b78b3d089ee7cbfa7f95d3e2c8  docs/migracion-clientes.xlsx
$ md5 docs/migracion-clientes.xlsx
MD5 (docs/migracion-clientes.xlsx) = f354298b2e0f92e718856d6cce38b7d5

$ shasum -a 256 docs/migracion/migracion-clientes.xlsx
c4f3593205e2ec36422478be4b887aa21aa08c84a745a7e49a11f819c5fc4a27  docs/migracion/migracion-clientes.xlsx
$ md5 docs/migracion/migracion-clientes.xlsx
MD5 (docs/migracion/migracion-clientes.xlsx) = e6fca844ab79529551195597156a6a7b
```

My independently-computed MD5s **match** the orchestrator's pinned values exactly:
- `docs/migracion-clientes.xlsx` → md5 `f354298b2e0f92e718856d6cce38b7d5` ✅ matches
- `docs/migracion/migracion-clientes.xlsx` → md5 `e6fca844ab79529551195597156a6a7b` ✅ matches

No discrepancy — proceeding to pin per the ruling, not re-litigating source selection.

**Row counts** (via the workbook's own zipped `xl/worksheets/sheet1.xml`, counting `<row>` XML
elements — no cell values were read, only XML structure, to stay PII-free):
- `docs/migracion-clientes.xlsx`, sheet "clientes": 1,233 `<row>` elements, numbered 1..1233
  contiguously with no gaps. Row 1 is the header (18 cells). Rows 2–1232 each carry 10–12 cells
  (real data rows = **1,231**). Row 1233 is a single empty formatting artifact
  (`<c r="Q1233" s="5"/>` — a styled cell with no type attribute and no value child, i.e. zero
  data) — not a data row. **1,231 data rows confirmed.**
- `docs/migracion/migracion-clientes.xlsx`, sheet "clientes": exactly 1 `<row>` element (header
  only). **0 data rows confirmed** — this is the empty committed template.
- Both workbooks share the same two-sheet layout (`clientes` + `INSTRUCCIONES`), confirmed via
  `xl/workbook.xml`.

**PINNED SOURCE: `docs/migracion-clientes.xlsx`** (untracked, 1,231 data rows, sha256
`6a0eb818...5d3e2c8`, md5 `f354298b2e0f92e718856d6cce38b7d5`). `docs/migracion/migracion-clientes.xlsx`
is the empty committed template and is **not** used as the import source.

---

## AC 8 — Report is PII-free (self-attest)

No client name, email, phone, cedula/RNC/identificacion value, or address appears anywhere above.
Every DB answer is a count, a type, a constraint/trigger/index definition, or a boolean. The one
row-level fact quoted (the `cambios_provisionales` row referencing client id 15) is limited to its
numeric id, a status enum value, and a change-type enum value — no `datos_anteriores`/
`datos_nuevos` JSON payload (which could contain a PII snapshot) was read or quoted. The two
identificacion values named in the Q5 section (`<CEDULA-A>`, `<CEDULA-B>`) are explicitly
pre-cleared as non-secret by the frozen spec (per this task's instructions) and are quoted only to
state the escalation-check outcome, not fetched from a fresh query. `scripts/005-...sql` was read
only for its DDL/constraint text (used as a comparison target, not as live evidence) — its bundled
sample INSERT rows (synthetic seed data, not real clients) were not quoted anywhere in this report.

## AC 9 — Rollback note

Read-only task: zero rows written, zero DDL run. **Nothing to revert; no git verb applies.** The
only filesystem write this task made is this report file itself (plus the scratchpad ledger/handoff
update), which can simply be deleted if ever unwanted.

---

## Summary of load-bearing findings for T2 (generator)

1. **`pais` amendment (human ruling, post-freeze):** all 1,231 imported rows must carry the exact
   accented literal `'República Dominicana'` (matching `app/clientes/registrar/page.tsx:39`), **not**
   the plan's original `'REPUBLICA DOMINICANA'`. This does not change anything in T1's own work but
   changes T2's generator mapping for the `pais` column and the AC in T2/T3/T4.
2. **Q4 — `cedula_pasaporte` does not exist live.** Do not emit it in the INSERT column list. The
   confirmed live 35-column shape (table above) is the only valid source for T2's INSERT columns.
3. **Q5 — no escalation.** No UNIQUE constraint/index on `identificacion`/`rnc`/`email` — the
   frozen "keep both duplicate identificacion values" design is not blocked.
4. **Q6 — `audit_clientes` does not exist.** Correct the sprint brief's HC-2 assumption: this
   import produces **zero** new `auditoria`/`audit_logs` rows from the `clientes` side (only one
   `audit_reservas` row from the single `reservas` repoint UPDATE).
5. **Q2 — one dangling `cambios_provisionales` row** (`id=69`, `tipo_cambio='CREATE'`,
   `estado_cambio='PENDIENTE'`) already references `registro_id=15`/`tabla_afectada='clientes'`
   before this sprint touches anything. Not resolved here; flagged for T3's runbook / backlog.
6. **Q7 — pinned:** `docs/migracion-clientes.xlsx` is the source (1,231 data rows, sha256
   `6a0eb818...5d3e2c8`, md5 `f354298b2e0f92e718856d6cce38b7d5`), confirmed against the
   orchestrator's recon with no discrepancy.
