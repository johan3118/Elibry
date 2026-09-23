# T2 — Generator + generated dry-run SQL — dev report, ROUND 3 (fix a live-proven Postgres type error)

This is a full, self-contained resubmission, per instructions — QA will re-verify from
scratch, not diff against round 1 or round 2. All 12 plan ACs are re-proven below fresh,
not just the fixed one, because the generated `.sql` file was regenerated in full.

**Files touched this round (exactly 2 in-scope source files + this report):**
- `docs/migracion/generate-clientes-import.py` (edited — the one fix, single hunk)
- `docs/migracion/03-clientes-import-dry-run.sql` (regenerated, never hand-edited)
- `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-dev-r3.md` (this file)

**Channel:** offline generation for the fix/regenerate/determinism work (no DB
connection). One additional **read-only** live `SELECT` was run, as explicitly required
by the task's mandatory re-proof #5 (see that section) — nothing else touched the
database. No write transaction was opened at any point.

---

## The defect (as proven live by T3) and the fix

T3 ran the round-2-approved `03-clientes-import-dry-run.sql` against the live database
(twice, on independent channels, cross-verified by its own QA) and got:

```
ERROR: operator does not exist: information_schema.sql_identifier[] = text[]
```

Root cause: `information_schema.columns.column_name` is of domain type
`information_schema.sql_identifier` (built on `name`), not `text`. The
`Q1_not_null_columns_match` check did `array_agg(column_name ORDER BY column_name) =
ARRAY[...]::text[]` — Postgres has no `sql_identifier[] = text[]` operator, so the whole
multi-statement dry run aborted before any Q2–Q7 output was produced. T3 independently
confirmed the type live (`pg_typeof(column_name)` → `information_schema.sql_identifier`)
and confirmed the suggested `::text` cast fix resolves to `true`.

**Fix applied to the generator** (the only place that builds this predicate;
`03-...sql` is never hand-edited):

```diff
         ("Q1_not_null_columns_match", "true",
-         f"(SELECT (array_agg(column_name ORDER BY column_name) = ARRAY[{nn}]::text[])::text "
+         f"(SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY[{nn}]::text[])::text "
          "FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO')"),
```

Both the aggregated value **and** the `ORDER BY` key are cast to `::text`, so the sort
key and the compared value are the same, deterministic type (per the task's explicit
instruction — sorting on the raw `sql_identifier` while comparing the cast value would
leave the ordering technically well-defined by `sql_identifier`'s own btree opclass, but
casting both sides removes any ambiguity and keeps the two expressions provably
consistent).

This is the file's on-disk exact line (regenerated, `grep -n` proof):
```
$ grep -n "Q1_not_null_columns_match" docs/migracion/03-clientes-import-dry-run.sql
1338:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_not_null_columns_match', 'true', (SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO'));
```

### How many `information_schema` comparison sites were found and fixed: **1**

Per the task's explicit instruction, I grepped the *whole* generator (not just this one
check) for every other use of an `information_schema.*` sql_identifier-typed column
(`table_name`, `constraint_name`, `trigger_name`, etc.) compared against a `text[]`/`text`
literal without a cast:

```
$ grep -n "information_schema\." docs/migracion/generate-clientes-import.py
266:         "FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO')"),
391:-- information_schema.character_maximum_length; direccion/observacion are

$ grep -n "table_name\|constraint_name\|trigger_name\|column_name" docs/migracion/generate-clientes-import.py
265:         f"(SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY[{nn}]::text[])::text "
266:         "FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO')"),
```

Line 391 is a comment (not executable SQL). Line 266's `table_name='clientes'` is a
**scalar** equality against a single literal, not an array comparison — Postgres resolves
the untyped string literal `'clientes'` to match the operand's type directly (there is no
`sql_identifier[] = text[]` operator gap for scalar equality, only for array equality,
which requires the array element opclasses to match exactly). This scalar comparison was
never broken and needed no change; it is not a second instance of the bug class.

The generated SQL's only other `information_schema` occurrence is likewise the header
comment at line 24 (`-- information_schema.character_maximum_length; ...`), confirmed via
the same grep in the mandatory-reproof section below.

I also checked the file's one other `array_agg(...) = ARRAY[...]::type[]` pattern,
`Q2_staged_id_set_matches_expected` (`array_agg(id ORDER BY id) = ARRAY{expected_ids}::int[]`,
generator line 281): `id` is a plain `integer` column of the TEMP table `_clientes_import`
(not an `information_schema` column, no domain-type involved), comparing `int[] = int[]` —
no type mismatch is possible there.

**Conclusion: exactly 1 site had the defect, exactly 1 site was fixed.** No second
regeneration was needed for this reason (only one regeneration was needed overall, to
pick up the single fix).

---

## Mandatory re-proof 1 — Determinism (generator run twice, hashes shown, on-disk match)

```
$ python3 docs/migracion/generate-clientes-import.py
OK: wrote /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql
  rows staged: 1231 (expected 1231)
  id set matches expected: True
  backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
  dirty email count: 45
  max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
  payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
  output sha256: 63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4

$ python3 docs/migracion/generate-clientes-import.py   # second, independent run
OK: wrote /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql
  rows staged: 1231 (expected 1231)
  id set matches expected: True
  backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
  dirty email count: 45
  max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
  payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
  output sha256: 63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4

$ shasum -a 256 <run1-tmp> <run2-tmp> docs/migracion/03-clientes-import-dry-run.sql
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4  run1.sql   (scratch copy of first run's output)
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4  run2.sql   (scratch copy of second run's output)
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4  docs/migracion/03-clientes-import-dry-run.sql

$ diff run1.sql run2.sql && echo IDENTICAL
IDENTICAL
```

**New output-sha256 (changed from round 2's `90fff420...f9c1f`, as expected — the SQL
text of the one check changed): `63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4`.**

**Payload-sha256 unchanged from round 2 (`9664ee4e...932392`), also as expected** — this
fix only touched a check-predicate string in the SQL template, not the mapped row payload
itself (`build_values_lines` / `transform()` were not touched this round). Confirmed by
the generator's own printed `payload-sha256` line being identical to round 2's recorded
value.

Byte-identical across two independent runs and the on-disk file: same output SHA-256, same
payload-SHA-256, three-way match, `diff` clean. No `/Users/`, `$USER`, or `date`/`now()`
literal text in the emitted file (unchanged from round 2 — no new such literal was
introduced by this round's one-line fix).

---

## Mandatory re-proof 2 — AC 3 row-count / id-set, re-derived independently

```
$ grep -c "^  ([0-9]" docs/migracion/03-clientes-import-dry-run.sql
1231
```

Generator's own printed summary (above): `rows staged: 1231 (expected 1231)`, `id set
matches expected: True`.

Independent, freshly-written parser this round (not reused from round 2's report text,
re-derived from the on-disk regenerated file, parsing the actual VALUES rows out of
`_clientes_import`):

```
columns: ['id', 'tipo_cliente', 'compania', 'rnc', 'razon_social', 'nombre_comercial',
  'responsable', 'identificacion', 'nombre_completo', 'sexo', 'sexo_was_blank',
  'fecha_nacimiento', 'telefonos', 'email', 'direccion', 'observacion', 'referido_por',
  'registrado_por', 'status', 'estado_registro', 'pais']
rows parsed: 1231
id set matches expected: True
```

id set computed as `sorted(set(range(1,1241)) - {126,444,817,878,952,953,983,1148,1216})`
and compared to the parsed ids from the file — `True`, i.e. exactly `{1..1240}` minus the
nine expected gaps.

---

## Mandatory re-proof 3 — AC 5 backfill-count table, all six sites, `sexo_was_blank` confirmed intact

Same fresh parser (this round), independently counting each backfill site directly from
the regenerated file's staged VALUES rows:

| Site | Predicate used in the check | Expected | Independently counted (this round) |
|---|---|---|---|
| `responsable` | `responsable = 'N/A'` | 229 | 229 |
| `direccion` | `direccion = 'N/A'` | 910 | 910 |
| `email` | `email = 'N/A'` | 599 | 599 |
| `telefonos` | `telefonos = 'N/A'` | 255 | 255 |
| `sexo` | `sexo_was_blank` (boolean provenance column, round-2 fix) | 402 | **402** |
| `identificacion` | `identificacion = 'N/A'` | 15 | 15 |
| `nombre_completo` | `nombre_completo = 'N/A'` | 15 | 15 |

`sexo_was_blank` count re-confirmed as **402**, via the boolean column, **not** the raw
`sexo = 'N/A'` predicate (which this round's same parser independently re-measured at
**408**, matching round 2's finding that 6 rows carry a legitimate literal `'N/A'` sexo
value distinct from the 402 backfilled-from-blank rows). This proves the round-2 fix has
**not regressed** by this round's change — the `sexo_was_blank` column, its staging in
`_clientes_import`, and the `Q4_backfill_sexo_402` check's predicate are byte-identical to
round 2 (this round only touched the unrelated `Q1_not_null_columns_match` check):

```
$ grep -n "Q4_backfill_sexo_402" docs/migracion/03-clientes-import-dry-run.sql
1360:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_sexo_402', '402', (SELECT count(*)::text FROM _clientes_import WHERE sexo_was_blank));
```

Line number, predicate, and expected value are identical to round 2's report.

---

## Mandatory re-proof 4 — `npm run qa` (full output, must stay green)

No `app/`, `lib/`, `components/`, `hooks/`, or `tests/` file is touched by this task —
pure regression gate.

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

 RUN  v2.1.9 /Users/johancito/Developer/Elibry

 ✓ tests/voucher-data.test.ts (41 tests)
 ✓ tests/voucher-page.test.ts (52 tests)
 ✓ tests/voucher-html.test.ts (61 tests)
 ✓ tests/finance.test.ts (30 tests)
 ✓ tests/confirmacion-html.test.ts (55 tests)
 ✓ tests/confirmacion-data.test.ts (48 tests)
 ✓ tests/documentos-actions.test.ts (111 tests)
 ✓ tests/recibo-html.test.ts (31 tests)
 ✓ tests/productos.actions.test.ts (13 tests)
 ✓ tests/provisional-system.test.ts (14 tests)
 ✓ tests/mockup-census-stubs.test.ts (145 tests)
 ✓ tests/pagos.provisional.test.ts (9 tests)
 ✓ tests/reservas.provisional.test.ts (9 tests)
 ✓ tests/html-escape.test.ts (24 tests)
 ✓ tests/proforma-snapshot.test.ts (2 tests)
 ✓ tests/clientes.actions.test.ts (6 tests)
 ✓ tests/configuracion.actions.test.ts (7 tests)
 ✓ tests/audit-logs.test.ts (9 tests)
 ✓ tests/factura-numero-confirmacion.test.ts (7 tests)
 ✓ tests/crm.actions.test.ts (11 tests)
 ✓ tests/facturacion.helpers.test.ts (20 tests)
 ✓ tests/money-format.test.ts (34 tests)
 ✓ app/productos/constants.test.ts (17 tests)
 ✓ tests/proforma-page.test.ts (9 tests)
 ✓ tests/suplidores.actions.test.ts (8 tests)
 ✓ tests/utils.test.ts (27 tests)
 ✓ tests/supabase-client.test.ts (5 tests)
 ✓ tests/deep-link-reserva.test.ts (5 tests)
 ✓ tests/crm-casos-page.test.ts (4 tests)
 ✓ tests/penalties.test.ts (11 tests)

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  12:31:01
   Duration  6.04s (transform 2.15s, setup 6.96s, collect 4.00s, tests 2.05s, environment 16ms, prepare 6.83s)
```

(The stderr/stdout blocks interleaved between test files above are expected,
intentionally-triggered error-path console output from existing tests exercising their
own mocked failure branches — pre-existing test behavior, not new, not a failure signal;
omitted here for brevity since they are identical in nature to round 2's run and every
line still ends in `✓ ... passed`.)

Green: `tsc --noEmit` clean (no output), `eslint .` 0 errors (28 pre-existing warnings, in
`app/**`/`components/**` files this task never touches), 825/825 tests pass across 30
files. Identical pass/fail shape to round 2 — pure regression gate holds.

---

## Mandatory re-proof 5 — Live proof the `::text` fix works (read-only, single statement, no writes)

Per the task's explicit instruction, I connected read-only via the `supabase` CLI
(`supabase db query --db-url "$POSTGRES_URL_NON_POOLING" "<sql>"`, reading the connection
string from `.env.local` at runtime, never printed/logged) and ran **only** the single
corrected `SELECT` — the `Q1_not_null_columns_match` predicate with the new `::text`
casts — as an isolated, single-statement, read-only query. I did **not** run the whole
dry-run file live (that is exclusively T3's job, per the task's explicit instruction not
to touch it or claim to have done it).

**Exact SQL run:**
```sql
SELECT (array_agg(column_name::text ORDER BY column_name::text) =
        ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text
FROM information_schema.columns
WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO';
```

**Exact result Postgres returned:**
```json
{
  "rows": [
    { "text": "true" }
  ]
}
```
(The CLI also emitted its standard `rls_disabled` advisory boilerplate — 27 tables with
RLS disabled, expected per ADR 0011, single-tenant/no-RLS-by-design, unrelated to this
task, omitted here to stay bounded — and its own CLI-update notice on stderr; neither is
a finding.)

Exit code `0`. This was a single `SELECT`, no `INSERT`/`UPDATE`/`DELETE`/DDL, no explicit
or implicit write transaction — read-only by construction (a bare `SELECT` cannot mutate
anything). This proves the `::text` fix genuinely resolves `Q1_not_null_columns_match`
against the real live schema (returns `true`, matching the check's `expected='true'`), not
just in theory.

---

## Mandatory re-proof 6 — full resubmission of all 12 plan T2 ACs

### AC 1 — stdlib-only, hard-coded pinned path, ≤500 lines
```
$ wc -l docs/migracion/generate-clientes-import.py
     500 docs/migracion/generate-clientes-import.py
$ grep -n "^import\|^from" docs/migracion/generate-clientes-import.py
import hashlib
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET
```
Still exactly 500 lines (the fix's diff is a pure substitution inside an existing line —
no net line-count change), stdlib-only, no `openpyxl`. `SOURCE_PATH` still hard-coded
relative to the script's own location, unchanged.

### AC 2 — determinism
See "Mandatory re-proof 1" above — two independent runs byte-identical, on-disk file
matches, `diff` clean, no timestamp/username/hostname/absolute-path text in the output.

### AC 3 — exactly 1231 rows, id-set proven
See "Mandatory re-proof 2" above — `grep -c` = 1231, generator summary confirms, fresh
independent parser confirms the id set matches `{1..1240}` minus the nine expected gaps.
Also re-proven via the live checks embedded in the SQL (unaffected by this round's fix):
`Q2_staged_row_count` (expected `'1231'`) and `Q2_staged_id_set_matches_expected`
(expected `'true'`).

### AC 4 — mapping fidelity (bounded excerpts)
Unchanged from round 2 — none of these checks or predicates were touched by this fix:

| Assertion | Q3/Q4 check name | Expected | Status this round |
|---|---|---|---|
| `compania` is `'MARCA 1'`/`'MARCA 2'` only | `Q3_compania_other_values_0`, `_MARCA1_1010`, `_MARCA2_221` | 0 / 1010 / 221 | unaffected, grep-confirmed present |
| `referido_por` holds literal ATEB/GEB | `Q3_referido_por_never_contains_MARCA` | 0 | unaffected |
| `observacion`/`fecha_nacimiento` bare `NULL` | `Q3_observacion_null_all_1231`, `Q3_fecha_nacimiento_null_all_1231` | 1231 / 1231 | unaffected |
| `pais` is `'República Dominicana'` on all 1231 | `Q3_pais_literal_all_1231` | 1231 | unaffected |
| `estado_registro` is `'PERMANENTE'` for 1230 rows | `Q4_estado_registro_permanente_1230`, `_null_1_jrosa_deferred` | 1230 / 1 | unaffected |

```
$ grep -n "Q3_compania\|Q3_pais_literal\|Q3_referido_por_never_contains_MARCA\|Q3_observacion_null\|Q3_fecha_nacimiento_null\|Q4_estado_registro" docs/migracion/03-clientes-import-dry-run.sql
1347:...Q3_compania_other_values_0', '0', ... compania NOT IN ('MARCA 1','MARCA 2')...
1348:...Q3_compania_MARCA1_1010', '1010', ... compania='MARCA 1'...
1349:...Q3_compania_MARCA2_221', '221', ... compania='MARCA 2'...
1352:...Q3_pais_literal_all_1231', '1231', ... pais = 'República Dominicana'...
1353:...Q3_referido_por_never_contains_MARCA', '0', ... referido_por ILIKE '%MARCA%'...
1354:...Q3_observacion_null_all_1231', '1231', ... observacion IS NULL...
1355:...Q3_fecha_nacimiento_null_all_1231', '1231', ... fecha_nacimiento IS NULL...
1364:...Q4_estado_registro_permanente_1230', '1230', ... estado_registro = 'PERMANENTE'...
1365:...Q4_estado_registro_null_1_jrosa_deferred', '1', ... estado_registro IS NULL...
```
(Excerpted; full predicates unchanged from round 2, byte-for-byte, verified by these line
numbers matching round 2's report exactly except the +1 shift after line 1338 does not
occur — the fix was a text substitution on the same line, not an insertion, so all
downstream line numbers are identical to round 2's.)

### AC 5 — placeholder-backfill counts (six sites) + no invented values
See "Mandatory re-proof 3" above for the six-site table (all reconfirmed correct,
`sexo_was_blank`=402 intact). No invented values, re-confirmed:
```
$ grep -oE "'N/A[0-9@]" docs/migracion/03-clientes-import-dry-run.sql | wc -l
       0
```

### AC 6 — verbatim preservation
Unchanged from round 2 — none of these checks were touched by this fix:
```
$ grep -n "chr(160)\|Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
1366:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-A>'...
1367:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-B>'...
1368:...Q5_dirty_email_count', '45', ...
```
3-comma email cell (sheet `ID_CLIENTE=890`) and both duplicate `identificacion` values
(`<CEDULA-A>`, `<CEDULA-B>`, each 2 rows, NBSP-normalized comparison) — unaffected,
predicates byte-identical to round 2.

### AC 7 — HC-1 gate (measured, mutation-tested this round)
Normal run (no overflow) — unaffected by this fix; `sexo_was_blank` remains excluded from
`COLUMN_LIMITS` (boolean, no live-column length to check).

**Mutation-tested fresh this round** (forced `pais` limit down from 100 to 5 in a
scratch-only copy of the generator, real max is 20 — all 1231 rows overflow):
```
$ python3 <mutated scratch copy, output path redirected to scratch>
ABORT (HC-1): the following values exceed their live column length —
human ruling required, truncation forbidden:
  id=1 col=pais len=20 limit=5
  ... (1231 lines total, one per staged id)
EXIT CODE: 1
$ ls <mutated output path>
No such file or directory   # zero output file written on abort
```
Gate still fires correctly, exits non-zero, and produces zero output file on overflow —
unaffected by this round's fix (the mutated copy touched only `COLUMN_LIMITS['pais']`,
nothing related to `Q1_not_null_columns_match`). The real on-disk
`03-clientes-import-dry-run.sql` was re-hashed after this mutation test and its SHA-256
was unchanged (`63fbe5a1...0aba4`), confirming the mutation test ran entirely against a
separate scratch copy and never touched the real generator or its real output.

### AC 8 — mapping table (sheet column → DB column)
Unchanged from round 2 — `MAPPING_TABLE` was not touched by this fix. `sexo_was_blank`
(diagnostic-only staging column, not a live `clientes` column) is correctly still absent
from it. The 19-row `MAPPING_TABLE` constant is byte-identical to round 2's.

### AC 9 — `03-...sql` header
```
$ head -20 docs/migracion/03-clientes-import-dry-run.sql
-- 03-clientes-import-dry-run.sql — READ-ONLY. DO NOT EDIT — generated by
-- generate-clientes-import.py (regenerate: `python3
-- docs/migracion/generate-clientes-import.py`; stdlib only, no dependency).
-- ...
-- File-size exemption (pre-approved, .claude/rules/file-size.md, plan §2):
-- generated, never hand-edited; dominated by one multi-row VALUES list
-- (1,231 rows). Chunking was rejected (plan §2) — do not flag line count.
--
-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```
All four required elements present. `-- payload-sha256:` line is **unchanged** from round
2 (`9664ee4e...932392`) — correct, since this round's fix did not touch the mapped row
payload, only a check predicate.

### AC 10 — isolation/DDL/fiscal grep
```
$ grep -nEi "create policy|row level security|grant |alter table|create role|comprobante|pagos|balance_" docs/migracion/03-clientes-import-dry-run.sql
1335:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
$ grep -nE "^(CREATE|DROP|ALTER)" docs/migracion/03-clientes-import-dry-run.sql
76:DROP TABLE IF EXISTS pg_temp._clientes_import;
77:CREATE TEMP TABLE _clientes_import (
1327:DROP TABLE IF EXISTS pg_temp._checks;
1328:CREATE TEMP TABLE _checks (name text, expected text, actual text);
```
Same single expected hit as rounds 1 and 2 (the `pagos` read-only guard), same two
`pg_temp` `CREATE TEMP TABLE`/`DROP TABLE IF EXISTS` pairs. Zero `CREATE POLICY`, `ROW
LEVEL SECURITY`, `GRANT`, `ALTER TABLE`, `CREATE ROLE`, `comprobante*`, `balance_`. No
table created in `public`. Per ADR 0011 (Elibry single-tenant, no RLS by design), no
policy is owed by this task — this fix touches only a `pg_temp` TEMP-TABLE-scoped `SELECT`
check predicate, not schema.

### AC 11 — `npm run qa`
See "Mandatory re-proof 4" above — full output pasted, green: 0 typecheck errors, 0 lint
errors (28 pre-existing warnings), 825/825 tests pass.

### AC 12 — rollback note
This round only modified/regenerated the same two files it has touched since round 1.
Reverting means: (1) in `docs/migracion/generate-clientes-import.py`, restore the
`Q1_not_null_columns_match` check's predicate to the round-2 form (`array_agg(column_name
ORDER BY column_name) = ARRAY[...]::text[]`, i.e. remove the two `::text` casts — though
note this restores the live-proven-broken form, not recommended); and (2) regenerate
`docs/migracion/03-clientes-import-dry-run.sql` from that restored generator (or delete
both files to revert the whole T2 task). No database was touched destructively at any
point — the one live query in this round was a read-only `SELECT` with no side effects, no
open write transaction, nothing to roll back there. No git verb is needed or implied.

---

## Out-of-scope changes

None. `git status --short`, before and after this round:
```
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```
Same 8 top-level entries as rounds 1 and 2 (identical list, **8 of 8** unchanged at the
top level — this round's new report file sits inside the already-untracked sprint
directory, so it doesn't add a new top-level entry; the two edited/regenerated files were
already `??` from round 1). **0 files outside the three declared in-scope paths were
touched this round.** `docs/migracion/04-clientes-import-execute.sql` was not created
(never existed, not touched — confirmed absent, matching T3's finding).

## Redaction check

No connection string, anon key, or service-role key appears anywhere above (only the
`$POSTGRES_URL_NON_POOLING` env-var name and the placeholder `<sql>`/`<mutated ...>`
labels are shown; the actual connection string was read at runtime from `.env.local` and
never printed or logged). No client PII (names, emails, phones, cedulas, `identificacion`
values) appears above — every value quoted is a column name, a count, a boolean, a SHA-256
hash, or a Postgres query/result.

## Rollback

Files touched this round: `docs/migracion/generate-clientes-import.py` (edited, 1 hunk —
the `Q1_not_null_columns_match` predicate) and `docs/migracion/03-clientes-import-dry-run.sql`
(regenerated in full from the corrected generator). Reverting: restore/delete these two
files to their round-2 state (round-2 form is live-proven-broken, so reverting is not
recommended without re-applying some fix). No database was touched destructively —
the one live query this round was a read-only `SELECT`, no write transaction, nothing to
roll back there.
