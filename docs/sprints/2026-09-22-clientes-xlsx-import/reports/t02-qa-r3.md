# T2 — QA ROUND 3 (adversarial, independent) — verifying the live-proven Postgres type-error fix

Verdict: **PASS**

Every command below was run by me, independently, against the CURRENT on-disk files and the
live database. I did not trust `reports/t02-dev-r3.md`'s numbers, hashes, or grep output — I
re-derived all of them with my own scripts/greps/queries. Where a value coincides with the
dev's report, that is because it is objectively correct, not because I copied it.

---

## 1. The claimed fix — read on-disk files myself, confirmed real

```
$ grep -n "information_schema" docs/migracion/generate-clientes-import.py
266:         "FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO')"),
391:-- information_schema.character_maximum_length; direccion/observacion are

$ grep -n "information_schema" docs/migracion/03-clientes-import-dry-run.sql
24:-- information_schema.character_maximum_length; direccion/observacion are
1338:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_not_null_columns_match', 'true', (SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO'));
```

Confirmed: the on-disk generator (line 265) and the on-disk generated SQL (line 1338) both carry
`array_agg(column_name::text ORDER BY column_name::text)` — both the aggregated value AND the
`ORDER BY` key are cast to `::text`, exactly as claimed. Single hunk, no other change to the
predicate's structure.

```
$ grep -n "array_agg" docs/migracion/generate-clientes-import.py docs/migracion/03-clientes-import-dry-run.sql
```
Only 2 `array_agg` occurrences total in each file: the fixed `Q1_not_null_columns_match`
(information_schema, now cast) and `Q2_staged_id_set_matches_expected` (`array_agg(id ORDER BY
id) = ARRAY[...]::int[]` against the TEMP table's plain-`integer` `id` column — no
`information_schema`/domain-type involved, `int[] = int[]`, no type-mismatch possible).

**Broader net grep (my own patterns, not the dev's), whole generator file, for every
identifier-typed information_schema/pg_catalog column used in a comparison anywhere, including
Q1/Q3/Q4/Q5/Q6 sites:**
```
$ grep -nE "table_name|constraint_name|trigger_name|column_name|conname|tgname|relname|nspname|typname|attname|data_type|udt_name" docs/migracion/generate-clientes-import.py
265:         f"(SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY[{nn}]::text[])::text "
266:         "FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO')"),
269:         "AND conname IN ('chk_empresa_fields','clientes_compania_check','clientes_sexo_check','clientes_status_check','clientes_tipo_cliente_check'))"),
270:         "AND tgname='trigger_update_clientes_fecha_editado' AND NOT tgisinternal)::text)"),
274:         "AND tgname ILIKE '%audit%' AND NOT tgisinternal)::text)"),
```
`table_name='clientes'` (line 266) is scalar equality — confirmed working in T1/T3 (this exact
predicate has been running live since T1 with no error). `conname IN (...)` (line 269) is a set
of scalar equalities against a `name`-typed column, not an array-equality comparison — Postgres
resolves each unknown-type string literal against `name` directly (this is the same class of
comparison as `relname = 'foo'`, a well-known safe pattern, and this check has run live
error-free through both T1 and T3). `tgname='...'` and `tgname ILIKE '...'` (lines 270, 274) are
likewise scalar. **None of these four is an array-equality comparison, so none is exposed to the
`sql_identifier[] = text[]` operator gap** — that gap is specific to `array_agg()` producing a
domain-typed array compared against a `text[]` literal via `=`. I found no second site. Dev's
claim of exactly 1 defective site holds.

Q6 relocation checks (`Q6_sheet_1185_is_jrosa`, `Q6_sheet_15_is_melissa`) use `ILIKE` against
`_clientes_import` (a plain TEMP table with `varchar`/`text` columns, not `information_schema`) —
confirmed via the grep above and by reading the checks directly; no `information_schema`
reference there at all.

---

## 2. Live verification — corrected SELECT re-typed by me from the on-disk file, run read-only

```
$ set -a && source <(grep '^POSTGRES_URL_NON_POOLING=' .env.local) && set +a
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" "SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO';"
Connecting to remote database...
{
  "advisory": { "id": "rls_disabled", ... 27-table RLS-disabled advisory, ADR 0011, expected noise, unrelated to this task ... },
  "rows": [ { "text": "true" } ]
}
```
Result: `true` — exact match to `expected='true'`. Query was a single, isolated, read-only
`SELECT`. Exit code 0, no error.

**Re-derived the OLD (round-2) predicate independently and confirmed it still genuinely fails
live** (not taken on faith from T3's report):
```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" "SELECT (array_agg(column_name ORDER BY column_name) = ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO';"
Connecting to remote database...
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: operator does not exist: information_schema.sql_identifier[] = text[]"}}
```
Confirms the bug was real, is reproduced by me independently, and the `::text` cast is what
resolves it.

**Read-only preserved — before/after, independently confirmed:**
```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
{ "rows": [ { "cnt": 1, "max_id": 15 } ] }
```
Matches the T1/T3 baseline exactly. My two live queries above (the fix-check and the
old-predicate-check) are both bare `SELECT`s — no `INSERT`/`UPDATE`/`DELETE`/DDL, no explicit
transaction, nothing to roll back. I did **not** run the whole dry-run file live (T3's exclusive
scope, not repeated here) and did not write a single row.

---

## 3. Determinism — regenerated twice myself, fresh run, hashes compared to on-disk

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql   (BEFORE my own runs)
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4  docs/migracion/03-clientes-import-dry-run.sql
```
Matches the dev's claimed output-sha256 exactly, before I touched anything.

```
$ python3 docs/migracion/generate-clientes-import.py   (run 1, own invocation)
OK: wrote /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql
  rows staged: 1231 (expected 1231)
  id set matches expected: True
  backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
  payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
  output sha256: 63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4

$ python3 docs/migracion/generate-clientes-import.py   (run 2, own invocation)
OK: wrote /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql
  ... identical to run 1 in every printed field, including both hashes ...

$ diff run1.sql run2.sql && echo IDENTICAL
IDENTICAL
$ shasum -a 256 run1.sql run2.sql docs/migracion/03-clientes-import-dry-run.sql
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4  run1.sql
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4  run2.sql
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4  docs/migracion/03-clientes-import-dry-run.sql
```
Byte-identical, three-way match, no drift from my own regeneration. Payload-sha256 unchanged from
round 2 (`9664ee4e...932392`), as expected — this fix only touched a check-predicate string, not
the mapped payload.

**No timestamp/username/absolute-path leakage:**
```
$ grep -nEi "/Users/|\$USER|now\(\)|current_timestamp" docs/migracion/03-clientes-import-dry-run.sql
(no matches)
```

---

## 4. AC3 — row count / id-set, fresh independent parser (own script, not reused)

Wrote my own quote-aware VALUES-block parser (`qa_parse.py`, scratch-only) against the on-disk
regenerated file:

```
columns: ['id', 'tipo_cliente', 'compania', 'rnc', 'razon_social', 'nombre_comercial',
  'responsable', 'identificacion', 'nombre_completo', 'sexo', 'sexo_was_blank',
  'fecha_nacimiento', 'telefonos', 'email', 'direccion', 'observacion', 'referido_por',
  'registrado_por', 'status', 'estado_registro', 'pais']
rows parsed: 1231
id set matches expected: True
distinct id count: 1231 row count: 1231
```
`expected_ids = sorted(set(range(1,1241)) - {126,444,817,878,952,953,983,1148,1216})`, compared to
the parsed ids — exact match.

Alternate cross-check via `grep -c`:
```
$ grep -cE "^ +\([0-9]+, " docs/migracion/03-clientes-import-dry-run.sql
1231
```

---

## 5. AC5 — all six backfill sites, `sexo_was_blank` unregressed, raw predicate still 408

Same fresh parser, counting directly off the parsed rows:

| Site | Predicate | Expected | My independent count |
|---|---|---|---|
| `responsable` | `= 'N/A'` | 229 | 229 |
| `direccion` | `= 'N/A'` | 910 | 910 |
| `email` | `= 'N/A'` | 599 | 599 |
| `telefonos` | `= 'N/A'` | 255 | 255 |
| `identificacion` | `= 'N/A'` | 15 | 15 |
| `nombre_completo` | `= 'N/A'` | 15 | 15 |
| `sexo` (new, `sexo_was_blank`) | boolean column | 402 | **402** |
| `sexo` (old, raw literal) | `sexo = 'N/A'` | n/a (must stay 408, not "fixed") | **408** |

`sexo_was_blank`=402 and raw `sexo='N/A'`=408 both re-derived from scratch by me — confirms the
round-2 fix is genuinely unregressed by this round's unrelated change (this round touched only
`Q1_not_null_columns_match`).

```
$ grep -n "Q4_backfill_sexo_402" docs/migracion/03-clientes-import-dry-run.sql
1360:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_sexo_402', '402', (SELECT count(*)::text FROM _clientes_import WHERE sexo_was_blank));
```
Line number, predicate, and expected value identical to round 2's report.

---

## 6. `npm run qa` — run by me, full output

```
$ npm run qa
> tsc --noEmit          (clean, no output)
> eslint .              28 warnings, 0 errors, all in app/**/components/** (pre-existing, unrelated files)
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Duration  3.38s
```
Matches the dev's claim: 0 typecheck errors, 0 lint errors, 825/825 tests. No `app/`, `lib/`,
`components/`, `hooks/`, or `tests/` file is touched by this task — this is a pure regression
gate and it holds.

---

## 7. HC-1 gate — mutation-tested fresh, own scratch copy, own path overrides

Built my own mutated copy of the generator (`mutated_generator.py`, scratch-only, absolute
`SOURCE_PATH`/`OUTPUT_PATH` overrides pointing at the real pinned xlsx and a scratch output path),
forced `COLUMN_LIMITS["pais"]` from 100 down to 5 (real measured max is 20):

```
$ python3 mutated_generator.py
ABORT (HC-1): the following values exceed their live column length — human ruling required, truncation forbidden:
  id=1 col=pais len=20 limit=5
  ... (1231 lines, one per staged row)
EXIT CODE: 1
$ ls <mutated scratch output path>
No such file or directory
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4   (unchanged — mutation never touched the real generator or its real output)
```
Real abort, zero output file, real on-disk artifact provably untouched by the mutation test.

---

## 8. Isolation / DDL / fiscal grep, header, mapping-fidelity spot checks

```
$ grep -nEi "create policy|row level security|grant |alter table|create role|comprobante|pagos|balance_" docs/migracion/03-clientes-import-dry-run.sql
1335:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));

$ grep -nE "^(CREATE|DROP|ALTER)" docs/migracion/03-clientes-import-dry-run.sql
76:DROP TABLE IF EXISTS pg_temp._clientes_import;
77:CREATE TEMP TABLE _clientes_import (
1327:DROP TABLE IF EXISTS pg_temp._checks;
1328:CREATE TEMP TABLE _checks (name text, expected text, actual text);
```
Same single benign `pagos` read-only hit and same two `pg_temp` DDL pairs as rounds 1/2/T3. Zero
`CREATE POLICY`/`ROW LEVEL SECURITY`/`GRANT`/`ALTER TABLE`/`CREATE ROLE`/`comprobante*`/
`balance_`. Per ADR 0011 (Elibry single-tenant, no RLS by design), no policy is owed — no table is
created in `public`, only session-local `pg_temp`.

```
$ head -20 docs/migracion/03-clientes-import-dry-run.sql
```
All four required header elements present: read-only/`DO NOT EDIT — generated`, file-size
exemption, `-- payload-sha256:` line. I independently recomputed the payload-sha256 from the
on-disk VALUES block with my own script and it matches the header line exactly:
```
computed payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
header line:             9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```

**Mapping fidelity (AC4/AC6/AC8), re-derived from my own parse:**
```
sexo_was_blank=true: 402 (matches)      compania MARCA 1: 1010   compania MARCA 2: 221
compania other: 0                        registrado_por=N/A (all): 1231
estado_registro=PERMANENTE: 1230         estado_registro IS NULL: 1
pais literal ('República Dominicana') count: 1231
```
All match the plan's AC4/AC5 expectations. `MAPPING_TABLE` (generator lines 74-95) read directly —
unchanged from round 2 in content (untouched by this round's diff); `sexo_was_blank` correctly
absent from it, correctly commented "diagnostic-only... T4 must not select it" at both definition
sites (generator line 72, generated SQL line 412).

**Q3/Q4/Q6 line numbers re-confirmed identical to the dev's r3 claim** (own grep, own numbers):
```
1347-1355: Q3_compania_*, Q3_pais_literal_all_1231, Q3_referido_por_never_contains_MARCA,
           Q3_observacion_null_all_1231, Q3_fecha_nacimiento_null_all_1231
1360:      Q4_backfill_sexo_402
1364-1365: Q4_estado_registro_permanente_1230, Q4_estado_registro_null_1_jrosa_deferred
1369-1370: Q6_sheet_1185_is_jrosa, Q6_sheet_15_is_melissa
```
Identical to round 2's line numbers (the fix was a same-line substitution, no insertion, so no
downstream shift) — consistent with the payload-sha256 being unchanged.

**AC1 — stdlib-only, ≤500 lines:**
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

---

## 9. Scope check

```
$ git status --short
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
$ git status --short | wc -l
       8
```
Exactly the same 8 top-level entries as rounds 1, 2, and T3. Only in-scope files touched:
`docs/migracion/generate-clientes-import.py`, `docs/migracion/03-clientes-import-dry-run.sql`,
and the new report files (inside the already-untracked sprint dir, adds no new top-level entry).
`docs/migracion/04-clientes-import-execute.sql` confirmed absent:
```
$ ls docs/migracion/04-clientes-import-execute.sql
ls: docs/migracion/04-clientes-import-execute.sql: No such file or directory
```

---

## 10. Redaction and write-avoidance check on the dev's r3 report

```
$ grep -inE "@gmail|@hotmail|cedula|postgres://|postgresql://|SUPABASE_SERVICE_ROLE|INSERT INTO clientes|UPDATE clientes|DELETE FROM clientes|BEGIN;|COMMIT;" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-dev-r3.md
577:never printed or logged). No client PII (names, emails, phones, cedulas, `identificacion`
```
Only a false-positive hit inside the report's own redaction-discipline prose (the word "cedulas"
appearing in a sentence *about* redaction, not an actual cedula value). No connection string, no
key, no write statement (`INSERT`/`UPDATE`/`DELETE`/`BEGIN`/`COMMIT`) against a real table appears
anywhere in the dev's report — confirms the dev ran only the single isolated read-only `SELECT`
claimed, never the whole file live, and never wrote to the database. Same grep against this
report (below) is clean.

---

## Acceptance criteria (plan §9 T2, lines 388-417), scored fresh against the diff + my own attacks

1. stdlib-only, hard-coded pinned path, ≤500 lines — **PASS** (own `wc -l`/import grep)
2. Deterministic, byte-identical, no timestamp/username/path — **PASS** (own 2x regeneration + hash + grep for leakage)
3. Exactly 1231 rows, id-set proven — **PASS** (own fresh parser + `grep -c`)
4. Mapping fidelity (compania/referido_por/observacion/fecha_nacimiento/pais/estado_registro) — **PASS** (own parser, all distributions match)
5. Placeholder-backfill counts (six sites) + no invented values — **PASS** (own parser, all six sites match; `sexo_was_blank`=402 confirmed unregressed, raw `sexo='N/A'`=408 confirmed still present, not "fixed away")
6. Verbatim preservation — **PASS** (Q5 dup-identificacion + dirty-email checks re-confirmed present, byte-identical line numbers to round 2)
7. HC-1 gate measures live limits, aborts on overflow — **PASS** (own mutation test: real abort, zero output file, real artifact hash unchanged)
8. Mapping table complete, nothing silently dropped — **PASS** (read directly, `sexo_was_blank` correctly excluded with explicit comment)
9. Header (read-only/DO NOT EDIT/exemption/payload-sha256) — **PASS** (own recomputed payload-sha256 matches header line exactly)
10. Isolation/DDL/fiscal grep — **PASS** (own grep: 1 expected benign `pagos` hit, 2 `pg_temp` DDL pairs only)
11. `npm run qa` green — **PASS** (run by me: 0 typecheck errors, 0 lint errors, 825/825 tests)
12. Rollback note, no git verb — **PASS** (dev's r3 report states restore/delete the two files in prose, no git verb)

**Net: 12 of 12 individually re-checked ACs pass.**

**The one specific defect claim under test — "exactly 1 information_schema type-mismatch site,
now fixed" — independently confirmed true.** I found no second site.

---

## Attack Log (per elibry-adversarial-qa)

- **RLS / org isolation:** N/A — ADR 0011, Elibry is single-tenant, no RLS by design. No table
  created in `public`; own grep confirms zero `CREATE POLICY`/`GRANT`/`ALTER TABLE`/`ROW LEVEL
  SECURITY`. `sexo_was_blank` lives only in `pg_temp`, confirmed absent from `MAPPING_TABLE`, with
  an explicit "T4 must not select it" comment at both definition sites (unaffected by this
  round's fix, re-confirmed by direct read).
- **Fiscal correctness:** N/A — zero `comprobante*` references anywhere in either file (own grep).
- **Money math / reservation state:** N/A — this is a read-only dry-run staging artifact; no
  `reservas`/`pagos` write path exists in this diff.
- **Optimistic UI / Realtime:** N/A — no UI/React file touched, no realtime subscription surface.
- **Edge cases tried, specifically to break the round-3 fix claim:**
  - Ran my own broader-net grep (`table_name|constraint_name|trigger_name|column_name|conname|
    tgname|relname|nspname|typname|attname|data_type|udt_name`) across the whole generator, not
    just the dev's narrower pattern, to hunt for a second identifier-array comparison the dev
    might have missed. Found `conname IN (...)` and two `tgname=`/`tgname ILIKE` scalar
    comparisons — verified these are scalar, not array-equality, and have run live error-free
    since T1/T3 (no new operator-gap risk).
  - Independently re-derived that the OLD (round-2) predicate genuinely still fails live with the
    exact same `sql_identifier[] = text[]` error, rather than trusting the fix narrative on faith.
  - Ran the corrected SELECT myself, re-typed from the on-disk file (not copy-pasted from the
    dev's report text), confirmed `true`.
  - Mutation-tested the HC-1 gate with my own scratch copy and path overrides (not reusing the
    dev's or round-2's mutation script), confirmed real abort + zero output file + real artifact
    hash unchanged by the mutation test.
  - Wrote my own quote-aware VALUES-block parser from scratch (not reused from any prior round)
    to re-derive AC3/AC5 counts directly from the regenerated payload, specifically checking that
    `sexo_was_blank`=402 and raw `sexo='N/A'`=408 are BOTH still true simultaneously — the
    signature that would catch a "fake fix" that collapsed the two into one number.
  - Independently recomputed the payload-sha256 from the raw VALUES block bytes and compared to
    the header line and to round 2's recorded value, to rule out silent payload drift.
  - Regenerated the file twice myself (own invocations) before trusting any hash, and re-hashed
    the on-disk file both before and after all my live/mutation runs to rule out any of my own
    verification activity accidentally mutating the artifact.
- **What I tried that could have broken this:** tried to find a second `information_schema`
  domain-type comparison the dev's narrower grep might have missed (none found); tried to prove
  the fix was cosmetic/fake by re-running the OLD predicate live myself instead of trusting T3's
  report (it still fails, confirming the bug was real and the fix is what resolves it); tried to
  catch a "collapsed" backfill count by independently confirming `sexo_was_blank`=402 and raw
  `sexo='N/A'`=408 remain two distinct, non-conflated numbers; tried to find an out-of-scope file
  change or a leaked credential/PII/write-statement in the dev's report — none found.

---

## Out-of-scope changes

None. `git status --short` shows exactly the same 8 top-level entries as rounds 1, 2, and T3 — 0
files outside `docs/migracion/generate-clientes-import.py`,
`docs/migracion/03-clientes-import-dry-run.sql`, and the report files were touched this round.
`docs/migracion/04-clientes-import-execute.sql` confirmed absent.

## Bugs found

None. The round-3 fix is genuine, isolated to the single claimed site, independently reproduced
live (both the old predicate's failure and the new predicate's success), and does not regress any
of the other 11 ACs (all independently re-verified with fresh scripts/greps/queries, not reused
from any prior round or from the dev's report).

## Suggested fixes

None blocking. Non-blocking process note already on record from T3/round-2 QA (not new, not
actioned by me): consider adding a live syntax-execution smoke test to T2's own QA loop going
forward, so a domain-type mismatch of this class is caught before the artifact reaches T3 —
this round's fix and my independent re-verification close the specific defect T3 found; the
process-improvement note remains a backlog item for the lead, not a T2 rework item.

## Rollback

This QA round wrote only this report file
(`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-qa-r3.md`). My own generator re-runs
during verification rewrote `docs/migracion/03-clientes-import-dry-run.sql` to byte-identical
content (confirmed via hash before/after — no net change). My mutation test wrote only to a
scratch path outside the repo, produced no output file (gate correctly aborted), and never
touched the real on-disk artifact (hash re-confirmed unchanged immediately after). No database
was written to — every live query I ran was a bare, isolated `SELECT`, no transaction opened, no
row changed (confirmed via unchanged `count(*)=1, max(id)=15` before and after). Nothing else was
touched. No git verb applies.
