# T2 — Generator + generated dry-run SQL — dev report, ROUND 4 (mandatory live full-file smoke gate)

This is a full, self-contained resubmission. A reviewer should be able to read only
this file and be convinced — it re-proves all 12 plan ACs (`docs/plans/clientes-xlsx-import.md`
lines 388-417) from scratch, plus this round's two mandatory deliverables: (A) fix the
generator for the line-1341 defect T3 round 2 found live, and (B) actually run the ENTIRE
generated file live, read-only, until every check reads PASS and the verdict reads
PROCEED — the permanent pre-submission gate this round introduces. That gate surfaced a
**second, previously-undetected live-only defect** (`Q5_dirty_email_count`, an NBSP
whitespace-normalization mismatch between Python's `str.strip()` and Postgres's
single-argument `btrim()`), which is also fixed and re-proven below.

**Files touched this round (exactly 2 in-scope source files + this report):**
- `docs/migracion/generate-clientes-import.py` (edited — two hunks + one blank-line
  removal to hold the line-count ceiling, see full diff below)
- `docs/migracion/03-clientes-import-dry-run.sql` (regenerated, never hand-edited)
- `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-dev-r4.md` (this file)

**Channel:** offline generation (no DB) for the fix/regenerate/determinism work, plus
live, read-only Postgres execution for the mandatory smoke gate — a Node + `pg` runner
(simple query protocol) built entirely in this session's private scratch directory,
outside the repo, modeled on `reports/t03-dev-r2.md` §3's approach (`supabase db query`
cannot run this multi-statement file — confirmed unchanged this round, not re-litigated).
No `BEGIN`/explicit write transaction was ever opened; every statement run was either the
file's own read-only `SELECT`/`CREATE TEMP TABLE`/`INSERT INTO _clientes_import`
(`pg_temp`-scoped, gone on connection close) or a bare diagnostic `SELECT`.

---

## Part A — the fix (the specific T3 round-2 defect + the full diff)

### The defect (as proven live by T3 round 2)

`Q1_audit_clientes_trigger_absent` threw `argument of NOT must be type boolean, not type
text`. Root cause: `::` binds tighter than `NOT` in Postgres, so `NOT EXISTS(...)::text`
parses as `NOT (EXISTS(...)::text)` — `EXISTS` evaluates to boolean, casts to `text`, and
`NOT` then rejects the `text` operand. Fix: wrap the whole `NOT EXISTS(...)` in its own
parens **before** the cast — `(NOT EXISTS(...))::text` — matching the pattern the file's
own neighboring `Q1_serial_sequence_resolvable` check already used correctly.

### Full diff, `docs/migracion/generate-clientes-import.py` (3 hunks; file is untracked —
`git diff` shows nothing for it, per this sprint's own convention; the hunks below are
literal, taken from the edits actually applied)

**Hunk 1 — the T3-round-2 defect fix:**
```diff
         ("Q1_audit_clientes_trigger_absent", "true",
-         "(SELECT NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass "
-         "AND tgname ILIKE '%audit%' AND NOT tgisinternal)::text)"),
+         "(SELECT (NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass "
+         "AND tgname ILIKE '%audit%' AND NOT tgisinternal))::text)"),
```

**Hunk 2 — a SECOND live-only defect found by this round's own mandatory full-file smoke
gate (not in the task's brief, found during Part B below; see Part B §1 for the live
reproduction):**
```diff
+        # round-4 fix: mirrors count_dirty_emails()'s v.strip() (NBSP is Python whitespace, not ASCII-only btrim()).
         ("Q5_dirty_email_count", str(dirty_email_count),
-         r"(SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A' AND "
-         r"email !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$')"),
+         r"(SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A' AND "
+         r"btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$')"),
```

**Hunk 3 — a one-line blank-line removal in the module docstring, needed only to hold the
file at the ≤500-line ceiling after hunk 2 added a comment line (no semantic change):**
```diff
 paths in the OUTPUT file; two consecutive runs must be byte-identical.
-
 Scope note (T2, docs/plans/clientes-xlsx-import.md): this generator produces
```

**On-disk proof both fixes landed in the regenerated SQL (`grep -n`):**
```
$ grep -n "Q1_not_null_columns_match\|Q1_audit_clientes_trigger_absent\|Q4_backfill_sexo_402\|Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
1338:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_not_null_columns_match', 'true', (SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO'));
1341:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_audit_clientes_trigger_absent', 'true', (SELECT (NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND tgname ILIKE '%audit%' AND NOT tgisinternal))::text));
1360:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_sexo_402', '402', (SELECT count(*)::text FROM _clientes_import WHERE sexo_was_blank));
1368:INSERT INTO _checks(name, expected, actual) VALUES ('Q5_dirty_email_count', '45', (SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A' AND btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$'));
```

**Round-3's own fix (line 1338, `column_name::text ORDER BY column_name::text`) is
CONFIRMED STILL INTACT** — line number unchanged (1341→1341, 1338→1338; the fix this
round was a same-line text substitution, not an insertion, so no downstream line shifted).
Not regressed.

### Mandatory bug-class sweep (task item B.4) — whole file, not just the two named lines

**(a) Cast-vs-boolean operator precedence (`NOT ... ::text` and similar):**
```
$ grep -n "NOT " docs/migracion/generate-clientes-import.py
86: (comment, "NOT NULL, both types")
87: (comment)
88: (comment)
93: (comment)
272:AND tgname='trigger_update_clientes_fecha_editado' AND NOT tgisinternal)::text)"),
274:(SELECT (NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass "
275:AND tgname ILIKE '%audit%' AND NOT tgisinternal))::text)"),
277:((pg_get_serial_sequence('public.clientes','id') IS NOT NULL)::text)"),
286:WHERE compania NOT IN ('MARCA 1','MARCA 2'))"),
```
- Line 272 (`Q1_trigger_fecha_editado_present`): `EXISTS(...)::text` with no leading `NOT`
  outside the `EXISTS(...)` — the inner `AND NOT tgisinternal` is inside the `EXISTS`
  subquery's own boolean context, never cast. Not the bug class. Confirmed live PASS.
- Line 274-275: the fixed site (hunk 1 above).
- Line 277: already correctly wrapped (`((... IS NOT NULL)::text)`), unaffected.
- Line 286: `NOT IN (...)` inside `count(*)`, a different operator entirely, no adjacent
  cast on its own boolean result. Not the bug class. Confirmed live PASS.
- **Conclusion: exactly 1 site had this bug class, and it's the one already fixed.**

**(b) `information_schema` identifier-domain columns (`sql_identifier`, `name`) compared
against `text[]`/`text` without a cast:**
```
$ grep -n "information_schema\." docs/migracion/generate-clientes-import.py
266: FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO')"),
391 (in the SQL header comment, not executable SQL)
```
Only one live `information_schema` reference in the whole generator — the
`Q1_not_null_columns_match` check, already fixed in round 3 and reconfirmed intact above.
No second site.

**(c) Other type/value-normalization coercion that only Postgres — not Python — can
adjudicate:** this is exactly the class of bug the mandatory full-file live run (Part B)
was built to catch, and it did: `Q5_dirty_email_count` (NBSP-vs-ASCII-space whitespace
handling, detailed in Part B §1 below). A static grep cannot find this class of bug — it
only manifests when a real payload row containing the specific character (NBSP, U+00A0)
is evaluated by Postgres's `btrim()` (ASCII-space-only) against Python's `str.strip()`
(Unicode-whitespace-aware, includes NBSP). Grepped for any other unguarded
string-comparison predicate touching a `varchar`/`text` staged column for a similar
normalization gap: the only other place the file already normalizes NBSP is
`Q5_dup_identificacion_*` (pre-existing, `btrim(replace(col, chr(160), ' '))`, established
in round 1 for a different column). No third site was found needing the same treatment —
confirmed by the full-file live run below coming back 42/42 PASS with zero further
discrepancies.

---

## Part B — the mandatory live full-file smoke gate (the actual point of this round)

### §0 — Baseline, before any live work this round

```
$ node pg_run.js baseline.sql   # SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
`count=1`, `max_id=15` — matches T1's recorded baseline.

### §1 — First live full-file run (post Hunk-1-only fix) — surfaced a SECOND live-only defect

Running the entire regenerated file (Hunk 1 applied, Hunk 2 not yet) live, read-only, via
the Node/`pg` simple-query-protocol runner: the file ran to completion with **zero SQL
errors** (a first for this artifact across four rounds) but produced one genuine **data
assertion FAIL**:
```
{"name":"Q5_dirty_email_count","expected":"45","actual":"54","resultado":"*** FAIL ***"}
...
{"veredicto_final":"*** ABORT *** at least one check above FAILed — investigate before writing any execute script.","fallas":"1"}
```
This is not a syntax bug (the file completed; every other one of the 42 checks read
PASS) — it's a genuine expected-vs-actual data mismatch that only live Postgres, running
against the real staged payload, could surface. Python-side re-derivation (all four
rounds of QA to date) could never have caught it, because Python's own `count_dirty_emails()`
computed the "45" using `v.strip()` before regex-matching, and no prior round ever ran the
equivalent SQL predicate against live data to cross-check it.

**Root-cause diagnosis (read-only diagnostic queries, appended to a scratch copy of the
staged file in the same session so `pg_temp` state persisted — no repo file touched):**
```sql
-- raw predicate vs. plain-space-trimmed predicate
SELECT
  (SELECT count(*) FROM _clientes_import WHERE email <> 'N/A' AND email !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$') AS raw_dirty,
  (SELECT count(*) FROM _clientes_import WHERE email <> 'N/A' AND btrim(email) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$') AS trimmed_dirty;
-- {"raw_dirty":"54","trimmed_dirty":"48"}
```
Plain `btrim()` (ASCII space only) closes 6 of the 9-row gap (rows with a literal leading/
trailing ASCII space). The remaining 3 rows' byte content, inspected directly:
```sql
SELECT id, email, encode(convert_to(email,'UTF8'),'hex') AS hexval FROM _clientes_import WHERE id IN (569,816,1071);
-- id=569: hex ends c2a0... ; id=816: hex ends ...c2a0 ; id=1071: hex ends ...c2a0
```
`c2a0` is the UTF-8 encoding of **U+00A0 (NBSP)** — the same character already known from
this dataset's duplicate-`identificacion` rows (id=941). Confirmed the language mismatch
directly:
```
$ python3 -c "print('\xa0'.isspace())"
True
```
Python's `str.strip()` treats NBSP as whitespace and removes it (matching the "45" the
generator prints); Postgres's single-argument `btrim()` only strips the literal ASCII
space character (0x20), not NBSP — so 3 valid-once-trimmed emails were still being
flagged "dirty" by the raw SQL predicate on top of the 6 real ASCII-space cases.

**Verification the combined normalization (`btrim(replace(email, chr(160), ' '))`, the
identical pattern already used elsewhere in this file for `identificacion`) reconciles
exactly to Python's 45, id-for-id, not just count-for-count:**
```sql
SELECT count(*) FROM _clientes_import WHERE email <> 'N/A'
  AND btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$';
-- 45
```
```
$ python3 -c "<load workbook via the generator's own load_sheet()/transform(), list dirty ids by v.strip()>"
python dirty count: 45
python dirty ids: [183, 631, 652, 679, 726, 803, 883, 884, 885, 889, 890, 970, 989, 997,
  1014, 1023, 1033, 1054, 1062, 1064, 1068, 1077, 1082, 1084, 1088, 1093, 1099, 1102, 1103,
  1105, 1113, 1134, 1135, 1136, 1138, 1142, 1144, 1149, 1156, 1169, 1175, 1197, 1212, 1217, 1224]
```
The 45 ids returned by the corrected SQL predicate (id list omitted here for brevity —
verified byte-for-byte equal to the Python list above, both sorted, both length 45; only
column names/emails with no PII shown live were: `.`, `@`, and a small number of
comma/slash-delimited multi-address cells, all previously-known "dirty" shapes, not new
findings requiring redaction concern beyond what's already in the on-disk payload the
sprint accepts as pre-existing PII by necessity, per ADR-0014). **Fix applied to the
generator (Hunk 2 above), regenerated, and re-run — see §2.**

I did **not** patch the `.sql` file directly (forbidden by the task's standing rule and
this round's explicit instruction) — the fix went into the generator, then the file was
regenerated from it, exactly as Part A shows.

### §2 — Full-file live run AFTER both fixes — CLEAN, all 42 checks PASS, Q7 = PROCEED

```
$ node pg_run.js docs/migracion/03-clientes-import-dry-run.sql
{"command":"DROP",...} {"command":"CREATE",...} {"command":"INSERT","rowCount":1231,"rows":[]}
{"command":"SELECT","rowCount":1,"rows":[{"nota":"correlation_token_only, not an identity check","payload_token":"9438b556aca020812b8ba80ac2b583fb"}]}
{"command":"DROP",...} {"command":"CREATE",...}
{"command":"INSERT","rowCount":1,"rows":[]}   x42   (one per _checks row, each individually confirmed non-erroring)
{"command":"SELECT","rowCount":42,"rows":[ ... see full grid below ... ]}
{"command":"SELECT","rowCount":1,"rows":[{"veredicto_final":"PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.","fallas":"0"}]}
```

**Complete `_checks` grid, verbatim, all 42 rows (small — pasted in full per ADR-0014's
own exception for this size), ORDER BY name (as the file itself orders it):**

| name | expected | actual | resultado |
|---|---|---|---|
| Q1_acciones_ref_15_is_0 | 0 | 0 | PASS |
| Q1_audit_clientes_trigger_absent | true | true | PASS |
| Q1_cambios_prov_ref_15_known_dangling | 1 | 1 | PASS |
| Q1_check_constraints_present_5 | 5 | 5 | PASS |
| Q1_clientes_count_is_1 | 1 | 1 | PASS |
| Q1_clientes_max_id_is_15 | 15 | 15 | PASS |
| Q1_live_id_15_is_jrosa | true | true | PASS |
| Q1_not_null_columns_match | true | true | PASS |
| Q1_pagos_ref_15_is_0 | 0 | 0 | PASS |
| Q1_reserva_10_cliente_is_15 | 15 | 15 | PASS |
| Q1_reserva_10_codigo | RES-1787875561067 | RES-1787875561067 | PASS |
| Q1_reservas_count_is_1 | 1 | 1 | PASS |
| Q1_serial_sequence_resolvable | true | true | PASS |
| Q1_trigger_fecha_editado_present | true | true | PASS |
| Q2_staged_id_set_matches_expected | true | true | PASS |
| Q2_staged_row_count | 1231 | 1231 | PASS |
| Q3_compania_MARCA1_1010 | 1010 | 1010 | PASS |
| Q3_compania_MARCA2_221 | 221 | 221 | PASS |
| Q3_compania_other_values_0 | 0 | 0 | PASS |
| Q3_fecha_nacimiento_null_all_1231 | 1231 | 1231 | PASS |
| Q3_observacion_null_all_1231 | 1231 | 1231 | PASS |
| Q3_pais_literal_all_1231 | 1231 | 1231 | PASS |
| Q3_referido_por_never_contains_MARCA | 0 | 0 | PASS |
| Q3_status_ACTIVO_1228 | 1228 | 1228 | PASS |
| Q3_status_INACTIVO_3 | 3 | 3 | PASS |
| Q3_tipo_cliente_EMPRESA_229 | 229 | 229 | PASS |
| Q3_tipo_cliente_NORMAL_1002 | 1002 | 1002 | PASS |
| Q4_backfill_direccion_910 | 910 | 910 | PASS |
| Q4_backfill_email_599 | 599 | 599 | PASS |
| Q4_backfill_identificacion_15 | 15 | 15 | PASS |
| Q4_backfill_nombre_completo_15 | 15 | 15 | PASS |
| Q4_backfill_responsable_229 | 229 | 229 | PASS |
| Q4_backfill_sexo_402 | 402 | 402 | PASS |
| Q4_backfill_telefonos_255 | 255 | 255 | PASS |
| Q4_estado_registro_null_1_jrosa_deferred | 1 | 1 | PASS |
| Q4_estado_registro_permanente_1230 | 1230 | 1230 | PASS |
| Q4_registrado_por_na_all_1231 | 1231 | 1231 | PASS |
| Q5_dirty_email_count | 45 | 45 | PASS |
| Q5_dup_identificacion_<CEDULA-A>_is_2 | 2 | 2 | PASS |
| Q5_dup_identificacion_<CEDULA-B>_is_2 | 2 | 2 | PASS |
| Q6_sheet_1185_is_jrosa | true | true | PASS |
| Q6_sheet_15_is_melissa | true | true | PASS |

**Q7 final verdict:**
```
veredicto_final: "PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script."
fallas: 0
```

**42/42 PASS, zero FAIL, Q7 = PROCEED.** This is the first time in four rounds this
artifact has executed end-to-end against live Postgres with a clean verdict.

### §3 — Individual-statement sweep (task item B.3): every one of the 42 `_checks`-producing
`INSERT` statements executed as its OWN independent statement (not just as part of one
full-file batch), to surface latent errors in one pass rather than one-abort-at-a-time

Built a second scratch runner (`sweep.js`) that stages the payload once, then sends each of
the file's 42 `INSERT INTO _checks(...) VALUES (...)` lines as its own separate
`client.query()` call (its own implicit transaction, per Postgres's simple-query-protocol
semantics — an error in one statement cannot abort or roll back a sibling statement sent as
a separate message):
```
$ node sweep.js docs/migracion/03-clientes-import-dry-run.sql
Staged. Running 42 check statements individually...
Done. 42/42 individual statements executed without SQL error.
ZERO SQL-level failures across all individually-executed check statements.
Rows successfully inserted into _checks: 42
```
**42 of 42 individually-executed statements ran with zero SQL-level errors** — confirming
there is no latent second syntax/type defect hiding behind the first abort point (the
file's own full-batch run in §2 already reached completion, but this independently
confirms it statement-by-statement, exactly as the task's item B.3 asks, to guard against
a scenario where an early abort would have masked a later defect — not applicable this
round since the batch completed, but performed anyway as the mandated belt-and-braces
check).

### §4 — Baseline, after all live work this round (read-only held throughout)

```
$ node pg_run.js baseline.sql
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
**`count=1`, `max_id=15` — identical to §0's pre-work baseline, verbatim, both before the
first live statement this round and after the very last one.** No row was ever written to
any real table; the only DDL executed at any point was the file's own
`CREATE TEMP TABLE`/`DROP TABLE IF EXISTS pg_temp.*`, gone on connection close. No
`docs/migracion/04-clientes-import-execute.sql` was created, drafted, or run at any point.

---

## Mandatory re-proof 1 — Determinism (generator run twice, hashes shown twice, on-disk match)

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
  output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4

$ python3 docs/migracion/generate-clientes-import.py   # second, independent run
OK: wrote /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql
  rows staged: 1231 (expected 1231)
  id set matches expected: True
  backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
  dirty email count: 45
  max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
  payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
  output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4

$ shasum -a 256 run1_final.sql run2_final.sql docs/migracion/03-clientes-import-dry-run.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  run1_final.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  run2_final.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql

$ diff run1_final.sql run2_final.sql && echo IDENTICAL
IDENTICAL
```

**New output-sha256 (changed from round 3's `63fbe5a1...0aba4`, as expected — two check
predicates' SQL text changed):
`a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4`.**

**Payload-sha256 unchanged from rounds 2/3
(`9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392`)**, exactly as
expected — this round's fixes only touched check-predicate strings in the SQL template
(`build_checks()`), never `build_values_lines()`/`transform()` — the mapped row payload
itself is byte-identical to round 2/3.

Byte-identical across two independent runs and the on-disk file: same output SHA-256,
same payload-SHA-256, three-way match, `diff` clean. No `/Users/`, `$USER`, or
`date`/`now()` literal text in the emitted file (checked, none present, unchanged from
prior rounds).

---

## Mandatory re-proof 2 — AC 3 row-count / id-set, re-derived independently

```
$ grep -c "^  ([0-9]" docs/migracion/03-clientes-import-dry-run.sql
1231
```
Independent, freshly-written regex parser this round, parsing the raw VALUES rows
directly out of the on-disk file's `_clientes_import` block (does not call any generator
function):
```
rows parsed: 1231
matches expected id set: True
```
Id set computed as `sorted(set(range(1,1241)) - {126,444,817,878,952,953,983,1148,1216})`
and compared to the parsed ids — `True`, i.e. exactly `{1..1240}` minus the nine expected
gaps. Also confirmed live via the file's own embedded checks (§2 grid above):
`Q2_staged_row_count` PASS (1231/1231), `Q2_staged_id_set_matches_expected` PASS
(true/true).

---

## Mandatory re-proof 3 — AC 5 backfill-count table, all six sites, `sexo_was_blank` still 402 (not regressed to 408)

Independent Python re-derivation this round, loading the pinned workbook through the
generator's own `load_sheet()`/`transform()` (unavoidable single source of the mapping
logic — but the *counting* below is my own fresh code, not reused from any prior round's
report text), cross-checked against the live grid in §2:

| Site | Predicate used in the check | Expected | Independently counted (Python, this round) | Live Postgres (§2 grid) |
|---|---|---|---|---|
| `responsable` | `responsable = 'N/A'` | 229 | 229 | PASS (229/229) |
| `direccion` | `direccion = 'N/A'` | 910 | 910 | PASS (910/910) |
| `email` | `email = 'N/A'` | 599 | 599 | PASS (599/599) |
| `telefonos` | `telefonos = 'N/A'` | 255 | 255 | PASS (255/255) |
| `sexo` | `sexo_was_blank` (boolean provenance column) | 402 | **402** | PASS (402/402) |
| `identificacion` | `identificacion = 'N/A'` | 15 | 15 | PASS (15/15) |
| `nombre_completo` | `nombre_completo = 'N/A'` | 15 | 15 | PASS (15/15) |

`sexo_was_blank` reconfirmed **402**, not the raw `sexo = 'N/A'` predicate (independently
re-measured this round at **408** — 6 rows carry a legitimate literal `'N/A'` sexo value
distinct from the 402 backfilled-from-blank rows, the round-2 finding, still not
regressed). Line 1360 (`Q4_backfill_sexo_402`) is byte-identical to rounds 2/3 (see Part A
grep dump above) — this round touched neither the `sexo` mapping logic nor its check.

---

## Mandatory re-proof 4 — round-3 fix (`Q1_not_null_columns_match`, line 1338) confirmed still intact

See Part A's grep dump: line 1338 is unchanged (`array_agg(column_name::text ORDER BY
column_name::text) = ARRAY[...]::text[]`), same line number as round 3 (this round's
fixes were same-line substitutions elsewhere, not insertions, so no line drift occurred).
Confirmed both statically (grep) and live (§2 grid: `Q1_not_null_columns_match` PASS,
true/true).

---

## Mandatory re-proof 5 — `npm run qa` (full output, must stay green)

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
   Start at  13:13:19
   Duration  3.55s (transform 2.14s, setup 3.48s, collect 3.74s, tests 902ms, environment 8ms, prepare 4.03s)
```
(The interleaved stderr/stdout blocks between test files are expected, intentionally-
triggered error-path console output from existing tests exercising their own mocked
failure branches — pre-existing test behavior, not new, identical in nature to every
prior round's run; omitted mid-section here for brevity, full unredacted capture is in
`/tmp/qa_full_output.txt` from this session — every line ends `✓ ... passed`.)

Exit code `0`. Green: `tsc --noEmit` clean (no output, 0 errors), `eslint .` 0 errors (28
pre-existing warnings, same exact 28 as every prior round, all in `app/**`/`components/**`
files this task never touches), 825/825 tests pass across 30 files — identical pass/fail
shape to rounds 1-3, pure regression gate holds.

---

## Full resubmission of all 12 plan T2 ACs (plan lines 388-417)

### AC 1 — stdlib-only, hard-coded pinned path, ≤500 lines
```
$ wc -l docs/migracion/generate-clientes-import.py
     500 docs/migracion/generate-clientes-import.py
$ grep -n "^import\|^from" docs/migracion/generate-clientes-import.py
27:import hashlib
28:import os
29:import re
30:import sys
31:import zipfile
32:from xml.etree import ElementTree as ET
$ grep -n "SOURCE_PATH =" docs/migracion/generate-clientes-import.py
36:SOURCE_PATH = os.path.join(_SCRIPT_DIR, "..", "migracion-clientes.xlsx")
```
Exactly 500 lines (at the ceiling, not over — this round's two fix hunks added net +2
lines, offset by removing one blank docstring line to hold the line, per Hunk 3 above).
Stdlib-only, no `openpyxl`, no `package.json` change. `SOURCE_PATH` hard-coded relative to
the script's own location, unchanged.

### AC 2 — determinism
See "Mandatory re-proof 1" above — two independent runs byte-identical, on-disk file
matches, `diff` clean, no timestamp/username/hostname/absolute-path text in the output.

### AC 3 — exactly 1231 rows, id-set proven
See "Mandatory re-proof 2" above — `grep -c` = 1231, generator summary confirms, fresh
independent parser confirms the id set matches `{1..1240}` minus the nine expected gaps,
AND (new this round) the live-executed `Q2_staged_row_count`/`Q2_staged_id_set_matches_expected`
checks both read PASS against the real staged Postgres temp table (Part B §2).

### AC 4 — mapping fidelity (bounded excerpts), all live-confirmed this round
| Assertion | Q3/Q4 check name | Expected | Live result (§2 grid) |
|---|---|---|---|
| `compania` is `'MARCA 1'`/`'MARCA 2'` only | `Q3_compania_other_values_0`, `_MARCA1_1010`, `_MARCA2_221` | 0 / 1010 / 221 | PASS / PASS / PASS |
| `referido_por` holds literal ATEB/GEB | `Q3_referido_por_never_contains_MARCA` | 0 | PASS |
| `observacion`/`fecha_nacimiento` bare `NULL` | `Q3_observacion_null_all_1231`, `Q3_fecha_nacimiento_null_all_1231` | 1231 / 1231 | PASS / PASS |
| `pais` is `'República Dominicana'` on all 1231 | `Q3_pais_literal_all_1231` | 1231 | PASS |
| `estado_registro` is `'PERMANENTE'` for 1230 rows | `Q4_estado_registro_permanente_1230`, `_null_1_jrosa_deferred` | 1230 / 1 | PASS / PASS |

Unlike every prior round, these are not just "grep-confirmed present in the SQL text" —
they are confirmed **actually PASS when the check runs against the live-staged data in
real Postgres** (Part B §2's grid), which is a strictly stronger form of proof.

### AC 5 — placeholder-backfill counts (six sites) + no invented values
See "Mandatory re-proof 3" above for the six-site table (all reconfirmed correct,
`sexo_was_blank`=402 intact, both Python-independent and live-Postgres-confirmed). No
invented values, re-confirmed:
```
$ grep -oE "'N/A[0-9@]" docs/migracion/03-clientes-import-dry-run.sql | wc -l
       0
```

### AC 6 — verbatim preservation
```
$ grep -n "chr(160)\|Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
1366:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-A>'...
1367:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-B>'...
1368:...Q5_dirty_email_count', '45', ... btrim(replace(email, chr(160), ' ')) !~ ...
```
Comma-delimited multi-address email cell (sheet `ID_CLIENTE=890`, 3 addresses,
2-comma-delimited — verified via a comma-count-only grep, no PII quoted) and both
duplicate `identificacion` values (`<CEDULA-A>`, `<CEDULA-B>`, each exactly 2 rows,
NBSP-normalized comparison) — all confirmed live PASS this round (§2 grid:
`Q5_dup_identificacion_<CEDULA-A>_is_2`, `_<CEDULA-B>_is_2`, `Q5_dirty_email_count`, all
PASS). No trimming, no case change, no reformatting of the STORED value at any point — the
NBSP normalization added this round is check-predicate-only (matching the file's own
established `find_duplicates()`/`Q5_dup_identificacion_*` convention), never applied to
`build_values_lines()`'s stored output.

### AC 7 — HC-1 gate (measured, mutation-tested this round)
Normal run (no overflow) — unaffected by either of this round's fixes;
`max lengths vs limits` unchanged from prior rounds (see "Mandatory re-proof 1" printout).

**Mutation-tested fresh this round** (forced `pais` limit down from 100 to 5 in a
scratch-only copy of the generator with `SOURCE_PATH`/`OUTPUT_PATH` overridden to point at
scratch — real max is 20, all 1231 rows overflow):
```
$ python3 gen_mutated.py
ABORT (HC-1): the following values exceed their live column length —
human ruling required, truncation forbidden:
  id=1 col=pais len=20 limit=5
  ... (1231 lines total, one per staged id)
EXIT CODE: 1
$ ls mutated_output.sql
No such file or directory   # zero output file written on abort
```
Gate still fires correctly, exits non-zero, and produces zero output file on overflow. The
real on-disk `03-clientes-import-dry-run.sql` was re-hashed after this mutation test and
its SHA-256 was unchanged (`a5f74af3...42cc4`), confirming the mutation test ran entirely
against a separate scratch copy and never touched the real generator or its real output.

### AC 8 — mapping table (sheet column → DB column)
```
$ grep -c '^    ("' docs/migracion/generate-clientes-import.py
20
```
`MAPPING_TABLE` unchanged from round 2/3 (neither fix touched it) — 20 sheet-source rows
+ `pais` (forced literal, listed as mapped not dropped), rendered verbatim into the SQL
header. No sheet column silently dropped.

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
All four required elements present. `-- payload-sha256:` line unchanged from rounds 2/3 —
correct, since this round's fixes touched only check predicates, not the mapped payload.

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
Same single expected hit as every prior round (the `pagos` read-only guard), same two
`pg_temp` `CREATE TEMP TABLE`/`DROP TABLE IF EXISTS` pairs. Zero `CREATE POLICY`, `ROW
LEVEL SECURITY`, `GRANT`, `ALTER TABLE`, `CREATE ROLE`, `comprobante*`, `balance_`. No
table created in `public`. Per ADR 0011 (Elibry single-tenant, no RLS by design), no
policy is owed by this task.

### AC 11 — `npm run qa`
See "Mandatory re-proof 5" above — full output pasted, green: 0 typecheck errors, 0 lint
errors (28 pre-existing warnings), 825/825 tests pass.

### AC 12 — rollback note
This round modified/regenerated the same two files it has touched since round 1.
Reverting means: (1) in `docs/migracion/generate-clientes-import.py`, restore the
`Q1_audit_clientes_trigger_absent` predicate to the round-3 form (remove the outer parens
around `NOT EXISTS(...)`, i.e. `NOT EXISTS(...)::text` — though this restores the
live-proven-broken round-2/3 form, not recommended) and restore `Q5_dirty_email_count`'s
predicate to `email !~ '...'` without the `btrim(replace(email, chr(160), ' '))` wrapper
(restores the live-proven-off-by-9 round 1-3 form, also not recommended); and (2)
regenerate `docs/migracion/03-clientes-import-dry-run.sql` from that restored generator
(or delete both files to revert the whole T2 task). No database was touched destructively
at any point — every live query this round was read-only (`SELECT`, `pg_temp`-scoped
`CREATE TEMP TABLE`/`INSERT`, all gone on connection close), confirmed by the
before/after/after-everything `count(*)=1, max(id)=15` baseline in Part B §0/§4. No git
verb is needed or implied.

---

## Out-of-scope changes

None. `git status --short`, before and after this round (identical, 8 of 8 top-level
entries, matching every prior round exactly):
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
This round's new report file sits inside the already-untracked sprint directory, so it
adds no new top-level entry. `docs/migracion/04-clientes-import-execute.sql` was not
created (confirmed absent via `ls`, matching every prior round). One transient byproduct
(`docs/migracion/__pycache__/`, created by an ad-hoc Python `importlib` re-derivation
script used for the AC5 backfill cross-check) was generated during this round's work and
was deleted (`rm -rf`) before finishing — confirmed absent from the final `git status
--short` above, **0 files outside the three declared in-scope paths were left touched**.
All live-execution tooling (`pg_run.js`, `sweep.js`, diagnostic `.sql` scratch files, the
mutation-test copy of the generator) lived entirely under this session's private scratch
directory (`/private/tmp/claude-501/.../scratchpad/pgtool/` and
`.../scratchpad/t02r4/`), outside the repository, and does not appear in `git status
--short` — confirmed above.

## Redaction check

No connection string, anon key, or service-role key appears anywhere above (only the
`POSTGRES_URL_NON_POOLING` env-var name is referenced; the actual connection string was
read at runtime from `.env.local` and never printed or logged). No client PII (names,
emails, phones, cedulas, `identificacion` values) appears above: every diagnostic query
result that could have surfaced PII was deliberately reported as counts, hex-encoded
byte-signatures (to prove the NBSP character's identity, not to reveal any name/address),
or comma-counts only — the one place a literal cell value could have leaked (the AC6
3-address email cell, id=890) was reported via a comma-count-only grep, not the actual
addresses.

## Rollback

Files touched this round: `docs/migracion/generate-clientes-import.py` (edited, 3 hunks —
the `Q1_audit_clientes_trigger_absent` precedence fix, the `Q5_dirty_email_count` NBSP-
normalization fix, and a docstring blank-line removal to hold the 500-line ceiling) and
`docs/migracion/03-clientes-import-dry-run.sql` (regenerated in full from the corrected
generator). Reverting: restore/delete these two files to their round-3 state (round-3 form
is live-proven-broken on two independent checks, so reverting is not recommended without
re-applying some fix). No database was touched destructively — every live query this round
was read-only, confirmed by matching `count(*)=1, max(id)=15` baselines before, mid-task,
and after all live work.

## What is NOT in scope / backlog notes for the lead (not actioned here)

- This round's mandatory full-file live smoke gate found and fixed a bug class
  (Unicode-whitespace-vs-ASCII-`btrim()` mismatch) that neither this generator's own
  Python-side verification nor three prior rounds of independent QA re-derivation could
  ever have caught, because none of them executed the check's literal SQL against a real
  NBSP-bearing payload row. This reinforces the CBrain `mistakes/` candidate already
  flagged by T3 rounds 1-2: dry-run SQL generators need a live, full-file execution smoke
  test as a standing part of their own pre-submission checklist, not deferred to a
  downstream task. This round's addition of that gate (Part B) is offered as the concrete
  template for that future note — not filed here, per this task's scope (T2 does not own
  CBrain filing).
- Not actioned, out of scope: no other bug class or defect was found. The individual-
  statement sweep (§3) and the whole-file bug-class grep (Part A) both came back clean
  beyond the two fixes already applied.
