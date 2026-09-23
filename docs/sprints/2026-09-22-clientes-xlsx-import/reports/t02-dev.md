# T2 — Generator + generated dry-run SQL — dev report

Files in scope for this task (all satisfied, no other file touched):
- `docs/migracion/generate-clientes-import.py` (new)
- `docs/migracion/03-clientes-import-dry-run.sql` (new, generated)
- `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-dev.md` (this file)

**Channel:** offline generation only, per plan. No DB connection was opened anywhere in
this task; the generator reads the pinned local `.xlsx` and writes a local `.sql` file.
Nothing in this task touched Supabase.

---

## Files changed (N of M against `git status --short`)

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
```

**2 of 8** entries are this task's output: `docs/migracion/03-clientes-import-dry-run.sql`
and `docs/migracion/generate-clientes-import.py`. The other 6 predate this task (T1's and
the architect's work, plus environment noise `.DS_Store`) and were **not** touched here —
`docs/migracion-clientes.xlsx` was opened read-only (hash-verified, never written), and
`docs/sprints/2026-09-22-clientes-xlsx-import/` already contained `scratchpad.md` and
`reports/t01-*.md` before this task started; this task added only `reports/t02-dev.md`
under that already-untracked directory, so it doesn't change the top-level count above.

---

## git diff

The generator (`generate-clientes-import.py`) is code with zero client PII — shown in
full below via `git diff --no-index` (it is untracked, so plain `git diff` shows
nothing — `git-diff-scope-excludes-untracked-files`).

```
$ git --no-pager diff --no-index -- /dev/null docs/migracion/generate-clientes-import.py
```
(506 lines — the file itself is 500 lines; the diff adds a `diff --git`/`new file
mode`/`index`/`---`/`+++` preamble. Full text is in the file at the path above; omitted
here only to avoid a second 500-line duplicate paste in this report — every line of it
is inspectable directly at `docs/migracion/generate-clientes-import.py`, and is not
sensitive.)

**The generated `03-clientes-import-dry-run.sql` (1,384 lines) is deliberately NOT
pasted here, in whole or via `git diff`, per ADR-0014 (bounded evidence — "paste the
full file" was rejected) and the sprint's `redaction-discipline` mistake note ("don't
quote PII rows out of it into your report"). It holds the real 1,231-row payload with
client names/emails/phones/addresses by necessity — it stays in the repo. Below is
counts, greps, non-PII head/tail excerpts (header + Q7 verdict, no VALUES rows), and
SHA-256, per the plan's own test-plan table.**

---

## AC 1 — stdlib-only, hard-coded pinned path, ≤500 lines

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
No `openpyxl`, no third-party import, no `package.json` change. `SOURCE_PATH` is
hard-coded relative to the script's own location
(`os.path.join(_SCRIPT_DIR, "..", "migracion-clientes.xlsx")` →
`docs/migracion-clientes.xlsx`, the T1-pinned path) — not read from an argument or
environment variable, so it cannot silently point elsewhere.

---

## AC 2 — determinism (two runs, same SHA-256, shown twice)

```
$ python3 docs/migracion/generate-clientes-import.py
OK: wrote /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql
  ...
  payload-sha256: 43afd381fb8ff8f8cf187b3d3f093583a72de8ec54ebf58055880c19f9b25ced
  output sha256: 68ff202506c43163a340471af16c1aace49043f1ea967e80e79b704edc500d58
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
68ff202506c43163a340471af16c1aace49043f1ea967e80e79b704edc500d58  docs/migracion/03-clientes-import-dry-run.sql

$ python3 docs/migracion/generate-clientes-import.py   # second, independent run
OK: wrote /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql
  ...
  payload-sha256: 43afd381fb8ff8f8cf187b3d3f093583a72de8ec54ebf58055880c19f9b25ced
  output sha256: 68ff202506c43163a340471af16c1aace49043f1ea967e80e79b704edc500d58
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
68ff202506c43163a340471af16c1aace49043f1ea967e80e79b704edc500d58  docs/migracion/03-clientes-import-dry-run.sql

$ diff run1.sql run2.sql && echo IDENTICAL
IDENTICAL
```
Byte-identical across two independent runs, same output SHA-256 and same
`payload-sha256`. `grep -c` for timestamps/usernames/absolute paths in the output finds
none (the file contains no `/Users/`, no `$USER`, no `date`/`now()` literal text, only
the relative artifact names `docs/migracion/generate-clientes-import.py` and
`03-...sql`/`04-...sql` as prose).

---

## AC 3 — exactly 1231 rows staged, id-set proven

```
$ grep -c "^  ([0-9]" docs/migracion/03-clientes-import-dry-run.sql
1231
```
Generator's own summary: `rows staged: 1231 (expected 1231)`, `id set matches
expected: True` (compared against `1..1240` minus the 9 known gaps
`{126,444,817,878,952,953,983,1148,1216}`). The generated SQL also re-asserts this
live, at T3 run time, via `Q2_staged_row_count` (expected `'1231'`) and
`Q2_staged_id_set_matches_expected` (expected `'true'`) in the `_checks` table — so the
count is proven twice: once by the generator's Python arithmetic, once by a live query
against the staged temp table.

---

## AC 4 — mapping fidelity (bounded excerpts)

All four verified by dedicated live-checks in the generated SQL (`_checks` table,
re-run in T3) **and** cross-confirmed independently in Python during this task:

| Assertion | Q3/Q4 check name | Expected | Confirmed |
|---|---|---|---|
| `compania` is `'MARCA 1'`/`'MARCA 2'` only | `Q3_compania_other_values_0`, `_MARCA1_1010`, `_MARCA2_221` | 0 / 1010 / 221 | matches independent Python `Counter` on the mapped payload |
| `referido_por` holds literal ATEB/GEB (0 rows containing `MARCA`) | `Q3_referido_por_never_contains_MARCA` | 0 | Python check: `referido_por containing MARCA: []` |
| `observacion`/`fecha_nacimiento` bare `NULL`, never `'N/A'` | `Q3_observacion_null_all_1231`, `Q3_fecha_nacimiento_null_all_1231` | 1231 / 1231 | generator hard-`ABORT`s if any cell is ever non-blank (defensive — see `transform()`); it did not abort, so all 1231 are genuinely blank in the source and mapped to bare `NULL` |
| `pais` is `'República Dominicana'` on all 1231 | `Q3_pais_literal_all_1231` | 1231 | Python: `pais distinct: {'República Dominicana'}` (forced literal, per the human ruling — **not** the sheet's own `'REPUBLICA DOMINICANA'` value, which is discarded) |
| `estado_registro` is `'PERMANENTE'` for the 1230 non-JROSA rows | `Q4_estado_registro_permanente_1230`, `Q4_estado_registro_null_1_jrosa_deferred` | 1230 / 1 | Python: PERMANENTE count 1230, NULL count 1 (the staged id=1185 row only — see "Deferred decision" below) |

---

## AC 5 — placeholder-backfill counts (six sheet-conditional sites) + no invented values

Generator summary (this run):
```
backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402,
'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
```
Matches the plan's six sheet-conditional counts **exactly**: responsable 229 / direccion
910 / email 599 / telefonos 255 / sexo 402 / identificacion 15, plus `nombre_completo`
15 (the same 15 rows as `identificacion` — confirmed by direct id-set comparison during
investigation, both sets are `{773,778,892,893,1063,1092,1118,1119,1121,1122,1154,1155,
1237,1238,1239}`, i.e. the "15(+15)" pairing in the AC is one physical site, two
columns). `registrado_por = 'N/A'` on all 1231 is an **addition beyond the plan's six
sites**, required by this task's binding inputs ("NOT NULL on ... registrado_por ...
the placeholder backfill is required in full") — `registrado_por` has no sheet column
at all (T1's Q4 35-column list confirms it), so it is unconditionally backfilled the
same way, using the same single placeholder literal `'N/A'`.

**Exactly one placeholder literal, no invented values:** the generator asserts, at
generation time, that every field it ever flags as "backfilled" is set to exactly the
string `'N/A'` (`main()`'s invariant loop — `sys.exit` if violated); the run completed
without hitting that abort. Independently:
```
$ grep -oE "'N/A[0-9@]" docs/migracion/03-clientes-import-dry-run.sql | wc -l
       0
```
zero occurrences of `'N/A` immediately followed by a digit or `@` (i.e., no
digit-shaped or `@`-shaped placeholder was ever fabricated).

---

## AC 6 — verbatim preservation (bounded, no PII quoted)

- **3-comma email cell:** confirmed present at sheet `ID_CLIENTE=890` (72 raw chars,
  2 embedded commas → 3 email addresses concatenated verbatim). Re-checked directly in
  the generated SQL by parsing that row's quoted email field with a
  quote-aware splitter (not a naive string search): **length 75 chars including the
  2 surrounding quotes (73 content chars), comma count inside = 2** — byte-for-byte
  match to the source cell, no trimming, no splitting. Content itself is not quoted
  here (`redaction-discipline`).
- **45 dirty emails:** `Q5_dirty_email_count` expects `'45'`
  (`email !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$'`, excluding the `'N/A'` placeholder
  itself). Independently recomputed against the raw sheet with the same regex: **45**,
  broken down as 1 comma-separated / 5 space-containing / 35 missing-`@` / 4
  missing-a-dot-after-`@` — all preserved verbatim, none normalized.
- **Both duplicate `identificacion` values, each on exactly 2 rows** (these two exact
  numeric values are pre-cleared as non-secret by this task's own binding inputs,
  matching T1's precedent — not fetched fresh, just re-verified):
  `'<CEDULA-A>'` and `'<CEDULA-B>'`, each 2 rows. **Genuine finding surfaced by this
  task:** one of the two `'<CEDULA-A>'` cells (sheet `ID_CLIENTE=941`) carries a
  **trailing U+00A0 (non-breaking space)** that the other (`ID_CLIENTE=1106`) does not.
  Per the "no trimming" AC, the generator does **not** strip it — the stored value is
  preserved byte-for-byte, so the two rows are not literally identical strings in the
  database. The verification check (`Q5_dup_identificacion_*`, in the generated SQL)
  therefore compares on a whitespace/NBSP-normalized key
  (`btrim(replace(identificacion, chr(160), ' '))`) — documented in the SQL as a
  comment immediately above the two check rows, and in `find_duplicates()`'s
  docstring. This NBSP also appears (unrelated to the duplicate pair) on 26 other
  cells across `direccion`(8), `nombre_completo`(7), `email`(3), `razon_social`(2),
  `nombre_comercial`(2), `telefonos`(1) — none of them blank-after-strip, so none were
  affected by backfill logic; all are preserved verbatim in the payload, untouched by
  this fix (the fix only changed *detection*, never the stored value).

---

## AC 7 — HC-1 gate (measured, not assumed)

Generator computed the actual max length per column against T1's live
`character_maximum_length` and did **not** abort (no overflow found — as the task
anticipated, but actually measured, not assumed):
```
compania: measured max 7 chars vs live limit 50 OK
email: measured max 72 chars vs live limit 200 OK
estado_registro: measured max 10 chars vs live limit 20 OK
identificacion: measured max 13 chars vs live limit 20 OK
nombre_comercial: measured max 65 chars vs live limit 200 OK
nombre_completo: measured max 46 chars vs live limit 200 OK
pais: measured max 20 chars vs live limit 100 OK
razon_social: measured max 65 chars vs live limit 200 OK
referido_por: measured max 4 chars vs live limit 200 OK
registrado_por: measured max 3 chars vs live limit 200 OK
responsable: measured max 3 chars vs live limit 200 OK
rnc: measured max 11 chars vs live limit 20 OK
sexo: measured max 9 chars vs live limit 20 OK
status: measured max 8 chars vs live limit 20 OK
telefonos: measured max 36 chars vs live limit 200 OK
tipo_cliente: measured max 7 chars vs live limit 20 OK
```
(`direccion`/`observacion` are live `text`, unbounded, correctly excluded from this
table.) HC-1 did **not** fire — no human ruling needed. This exact table is also
embedded verbatim in `03-...sql`'s header comment.

---

## AC 8 — mapping table (sheet column → DB column)

Printed as a data constant `MAPPING_TABLE` in `generate-clientes-import.py` and
rendered verbatim into `03-...sql`'s header. No sheet column is silently dropped —
`pais` is listed as **mapped to a forced literal** (not a passthrough, not dropped).

| Sheet column | DB column | Rule |
|---|---|---|
| `ID_CLIENTE` | `id` | verbatim (integer), staged PK |
| `tipo_cliente` | `tipo_cliente` | verbatim; validated NORMAL/EMPRESA |
| `compania` | `compania` | mapped ATEB→'MARCA 1', GEB→'MARCA 2' |
| `rnc` | `rnc` | verbatim; blank→NULL |
| `razon_social` | `razon_social` | verbatim; blank→NULL |
| `nombre_comercial` | `nombre_comercial` | verbatim; blank→NULL |
| `responsable` | `responsable` | verbatim if present; blank+EMPRESA→'N/A'; blank+NORMAL→NULL |
| `identificacion` | `identificacion` | verbatim if present; blank+NORMAL→'N/A'; blank+EMPRESA→NULL |
| `nombre_completo` | `nombre_completo` | verbatim if present; blank+NORMAL→'N/A'; blank+EMPRESA→NULL |
| `sexo` | `sexo` | verbatim if present (validated enum); blank+NORMAL→'N/A'; blank+EMPRESA→NULL |
| `fecha_nacimiento` | `fecha_nacimiento` | dropped as a value source (100% blank, verified) → always bare NULL; generator ABORTS on any non-blank cell |
| `telefonos` | `telefonos` | verbatim if present; blank→'N/A' |
| `email` | `email` | verbatim if present; blank→'N/A' |
| `direccion` | `direccion` | verbatim if present; blank→'N/A' |
| `pais` | `pais` | **forced literal** `'República Dominicana'` on ALL rows (human ruling; supersedes both the sheet's own value and the plan's original text) |
| `observacion` | `observacion` | dropped as a value source (100% blank, verified) → always bare NULL |
| `referido_por` | `referido_por` | verbatim; 0% blank → no backfill |
| `status` | `status` | verbatim; validated ACTIVO/INACTIVO |
| *(no sheet column)* | `registrado_por` | `'N/A'` for all rows (NOT NULL, no sheet source) |
| *(no sheet column)* | `estado_registro` | `'PERMANENTE'` for 1230 rows; `NULL` for the staged id=1185 row (deferred, see below) |

The remaining 15 live `clientes` columns (`fecha_creado`, `fecha_editado`,
`editado_por`, `imagen_url`, `usuario_creacion`, `fecha_provisional`,
`dependencias_ids`, `telefonos_json`, `emails_json`, `documentos`, `cedula_url`,
`registro_mercantil_url`, `documento_cedula_url`,
`documento_registro_mercantil_url`, `documentos_urls`) have no sheet source and no
forced literal — they are absent from the staged column list, taking the live table's
own `DEFAULT`/`NULL`. `cedula_pasaporte` does not exist live (T1 Q4, refuted) and is
never referenced.

---

## AC 9 — 03-...sql header

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
-- payload-sha256: 43afd381fb8ff8f8cf187b3d3f093583a72de8ec54ebf58055880c19f9b25ced
```
States read-only, `DO NOT EDIT — generated`, the file-size exemption, and the
`-- payload-sha256:` line — all four present.

---

## AC 10 — isolation/DDL/fiscal grep

```
$ grep -nEi "create policy|row level security|grant |alter table|create role|comprobante|pagos|balance_" docs/migracion/03-clientes-import-dry-run.sql
1335:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
```
**1 hit, expected and documented.** It is the plan's own T1-derived guard reading
`pagos` read-only to confirm zero rows reference the client being relocated — the same
carve-out the plan explicitly grants T4 ("outside the guard/abort text that
deliberately checks pagos"), and the same discipline `01-cleanup-dry-run.sql` already
uses throughout (that file references `pagos` in a read-only `SELECT` many times).
Zero `CREATE POLICY`, zero `ROW LEVEL SECURITY`, zero `GRANT`, zero `ALTER TABLE`,
zero `CREATE ROLE`, zero `comprobante*`, zero `balance_`. Only DDL in the file:
```
$ grep -nE "^(CREATE|DROP|ALTER)" docs/migracion/03-clientes-import-dry-run.sql
76:DROP TABLE IF EXISTS pg_temp._clientes_import;
77:CREATE TEMP TABLE _clientes_import (
1327:DROP TABLE IF EXISTS pg_temp._checks;
1328:CREATE TEMP TABLE _checks (name text, expected text, actual text);
```
Both are `pg_temp` tables. No `ALTER TABLE` anywhere. ADR 0011/0006 reasoning restated:
this task creates no table in `public`, so no RLS policy is owed.

---

## AC 11 — `npm run qa`

```
$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit
(no output — clean)

> my-v0-project@0.1.0 lint
> eslint .
... 28 pre-existing warnings in app/** files this task never touched (react-hooks/exhaustive-deps, @next/next/no-img-element) ...
✖ 28 problems (0 errors, 28 warnings)

> my-v0-project@0.1.0 test
> vitest run
...
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  11:10:10
   Duration  3.33s

$ echo $?
0
```
Green: `tsc --noEmit` clean, `eslint .` 0 errors (28 pre-existing warnings, all in
`app/**` files untouched by this task), 825/825 tests pass. Pure regression gate, as
expected (no `app/`, `lib/`, `components/`, `hooks/`, or `tests/` file was touched).

---

## AC 12 — rollback note

This task created exactly two new untracked files. Reverting means **deleting exactly
these two paths**: `docs/migracion/generate-clientes-import.py` and
`docs/migracion/03-clientes-import-dry-run.sql`. Nothing else was written, no schema
touched, no live query run — there is nothing else to undo.

---

## Deferred decision, flagged for the lead's backlog (not resolved in this task)

Plan §5's Q6 "JROSA relocation preview" calls for a check that "the 7 preserved
columns are capturable" — i.e. a preview of `_jrosa_preserva`'s eventual `SELECT <7
cols> FROM clientes WHERE id = 15` (plan §3 statement 1). **This task's own numbered
Report ACs (1–12) do not require it**, and the plan's own T2 AC list is also silent on
it — building it correctly requires pinning the *exact* 7-column identity, which the
plan states only implicitly (scattered across the brief's "7 non-sheet columns" line,
the T1 Q4 AC's 8-name list minus 2 refuted/reclassified names, and the repeated
emphasis on `fecha_editado` specifically). That is an architectural decision the plan
does not make explicitly, and it directly seeds T4's `_jrosa_preserva` capture
(weak-backstop-guard: whatever list I picked here would become the de-facto binding
answer for T4 to reuse byte-for-byte). Rather than guess into a committed artifact, I
implemented everything the plan's §5 Q1–Q5 sections require in full, plus the two
**unambiguous** parts of Q6 that need no such decision (sheet-side name-pattern checks
`Q6_sheet_1185_is_jrosa` / `Q6_sheet_15_is_melissa`, confirmed live against the staged
payload, and the live `Q1_live_id_15_is_jrosa` precondition), and left the "7 preserved
columns capturable" sub-check as a documented, explicit gap (commented in the
generator's `build_checks()` and disclosed here) for the architect/T4 owner to resolve
with a real decision rather than an inherited guess. My own best-effort reading, for
whoever picks this up: `{estado_registro, usuario_creacion, fecha_provisional,
documentos_urls, imagen_url, dependencias_ids, fecha_editado}` (6 of T1's Q4-named
candidates, `pais`/`cedula_pasaporte` excluded since one is a sheet column and the
other doesn't exist, plus `fecha_editado` — the column the whole insert-then-delete
design exists to protect) — but this is a hypothesis, not a verified fact, and should
not be treated as pre-approved.

Also flagged (not a blocker, informational): the identificacion NBSP finding above
(one of the two known duplicate values carries a trailing U+00A0) is new data-quality
information not previously surfaced in T1's report — worth a one-line mention in T6's
runbook disclosures if the human wants it named explicitly, though it doesn't change
any AC or require any code change (the "keep both, don't touch" design already covers
it correctly).

## Rollback

Delete `docs/migracion/generate-clientes-import.py` and
`docs/migracion/03-clientes-import-dry-run.sql`. No database was touched; nothing else
to revert.
