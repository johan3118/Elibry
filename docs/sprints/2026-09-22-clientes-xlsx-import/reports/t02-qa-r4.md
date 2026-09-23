# T2 — Generator + generated dry-run SQL — QA, ROUND 4 (independent re-verification)

**Verdict: PASS.**

Everything the dev's round-4 report (`reports/t02-dev-r4.md`) claims was independently
re-derived from scratch this round — new hashes taken myself, a brand-new Node+`pg` runner
written from zero (not the dev's `pg_run.js`/`sweep.js`), a brand-new XLSX parser written from
zero for AC5, and the generator run twice independently for determinism. One minor, non-blocking
report-accuracy defect was found (described below) that does not change the verdict.

---

## Channel / tooling used (built fresh, outside the repo)

All live-DB tooling lives at
`/private/tmp/claude-501/-Users-johancito-Developer-Elibry/97ebd1c1-b8b5-4d51-921d-39df2d76ffd1/scratchpad/qa-t02-r4/`
(this session's private scratch dir, never inside `Elibry/`). I reused the already-present `pg`
npm package from an earlier round's scratch install (`.../scratchpad/pgtool/node_modules`, via a
symlink in my own dir) — reusing a third-party dependency is not the same as reusing the dev's
script; my `myrun.js` (the actual query runner/session logic) is my own, written from scratch, and
is a different implementation from the dev's `pg_run.js`/`sweep.js` (different structure: single
generic file/inline-text runner, no separate sweep script — I instead used the fact that the real
file already issues 42 individual `INSERT` statements sequentially in one session, so a single
full-file run **is** the individual-statement sweep, confirmed by inspecting the per-statement
JSON line count below).

I independently confirmed the channel gap the dev cites, rather than trusting it:

```
$ supabase db query --db-url "$CONN" "SELECT 1 AS a; SELECT 2 AS b;"
Connecting to remote database...
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: cannot insert multiple commands into a prepared statement"}}
```
Confirmed: `supabase db query` genuinely cannot run multi-statement text. My own Node+`pg`
"simple query protocol" runner (`client.query(sqlText)` with no params array) was required, and I
verified session/temp-table persistence across statements myself before trusting it on the real
file:
```
$ node myrun.js -e "DROP TABLE IF EXISTS pg_temp._myqa_sanity; CREATE TEMP TABLE _myqa_sanity (a int); INSERT INTO _myqa_sanity VALUES (1),(2); SELECT count(*) FROM _myqa_sanity; SELECT a FROM _myqa_sanity ORDER BY a;"
{"command":"DROP","rowCount":null,"rows":[]}
{"command":"CREATE","rowCount":null,"rows":[]}
{"command":"INSERT","rowCount":2,"rows":[]}
{"command":"SELECT","rowCount":1,"rows":[{"count":"2"}]}
{"command":"SELECT","rowCount":2,"rows":[{"a":1},{"a":2}]}
```

---

## 1. Re-hash the file myself

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
$ grep -n "payload-sha256" docs/migracion/03-clientes-import-dry-run.sql
19:-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```
Both match the dev's claimed hashes exactly (output-sha256 `a5f74af3...42cc4`, payload-sha256
`9664ee4e...932392`).

## 2. Read the generator diff myself

```
$ sed -n '272,276p' docs/migracion/generate-clientes-import.py
        ("Q1_audit_clientes_trigger_absent", "true",
         "(SELECT (NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass "
         "AND tgname ILIKE '%audit%' AND NOT tgisinternal))::text)"),
        ("Q1_serial_sequence_resolvable", "true",
```
Confirmed: the outer parens around `NOT EXISTS(...)` are present, before the cast — the claimed
fix is genuinely in place (not just claimed).

```
$ grep -n "Q5_dirty_email_count" -A3 -B1 docs/migracion/generate-clientes-import.py
330-        # round-4 fix: mirrors count_dirty_emails()'s v.strip() (NBSP is Python whitespace, not ASCII-only btrim()).
331:        ("Q5_dirty_email_count", str(dirty_email_count),
332-         r"(SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A' AND "
333-         r"btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$')"),
```
Confirmed: `btrim(replace(email, chr(160), ' '))` wrapper is genuinely present around the email
check's normalized side.

```
$ sed -n '1338p;1341p' docs/migracion/03-clientes-import-dry-run.sql
1338:...('Q1_not_null_columns_match', 'true', (SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY[...]::text[])::text FROM information_schema.columns ...));
1341:...('Q1_audit_clientes_trigger_absent', 'true', (SELECT (NOT EXISTS(...))::text));
```
Round-3's `column_name::text` fix (line 1338) is confirmed still intact in the regenerated SQL.

## 3. Load-bearing check — independently execute the ENTIRE file live, read-only, myself

Baseline before any live work this round, my own connection:
```
$ node myrun.js -e "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```

Full-file run (my own script, `docs/migracion/03-clientes-import-dry-run.sql` unmodified):
```
$ node myrun.js docs/migracion/03-clientes-import-dry-run.sql > full_run_output.jsonl
$ echo EXIT: $?
EXIT: 0
$ wc -l full_run_output.jsonl
50 full_run_output.jsonl
```
Statement-by-statement command list (extracted from my own output): `DROP, CREATE, INSERT(1231
rows), SELECT(1 row payload_token), DROP, CREATE, INSERT×42 (each rowCount=1 — i.e. all 42 of the
file's individual `_checks` INSERT statements ran without error, in the same run, functionally
equivalent to the dev's separate "sweep" claim), SELECT(42 rows — the `_checks` grid), SELECT(1
row — Q7 verdict)`.

**Complete `_checks` grid extracted from my own run's 42-row SELECT, all 42 rows, verbatim:**

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

**Q7 verdict, from my own run's final SELECT:**
```
{'veredicto_final': 'PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.', 'fallas': '0'}
```

**Result: my independent run matches the dev's pasted grid row-for-row — 42/42 PASS, Q7 PROCEED.**
No discrepancy from the dev's claim on this point.

Baseline after all my live work this round, same connection semantics:
```
$ node myrun.js -e "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
Read-only held: `count=1, max(id)=15` identical before and after, on my own connection.

## 4. Independently re-derive the `Q5_dirty_email_count` root cause

Staged the real payload from the on-disk file (extracted its own staging block, ran it in one
session with three diagnostic predicates), on my own connection:
```
$ node myrun.js combined_email_check.sql
...
{"command":"SELECT","rowCount":1,"rows":[{"raw_old_predicate":"54","plain_btrim":"48","nbsp_normalized_new":"45"}]}
{"command":"SELECT","rowCount":3,"rows":[
  {"id":569,"hexval":"c2a06e656d6f7265736572766163696f6e657340676d61696c2e636f6d"},
  {"id":816,"hexval":"57414e44593238313940474d41494c2e434f4dc2a0"},
  {"id":1071,"hexval":"4a41435155454952592e4449534c41323540474d41494c2e434f4dc2a0"}
]}
```
Confirmed independently: raw (unfixed) predicate = **54**, plain `btrim()` = **48**, the NBSP-
normalized new predicate = **45** — matching the dev's numbers exactly. All three cited row IDs
(569, 816, 1071) genuinely carry the `c2a0` (UTF-8 for U+00A0 NBSP) byte sequence, confirmed via
hex encoding only — no plaintext email printed.

**Minor discrepancy found (report-accuracy only, not a functional bug):** the dev's report states
"id=569: hex ends c2a0". My independent hex dump shows id=569's `c2a0` is at the **start** of the
hex string (a **leading** NBSP), not the end — `c2a0` only appears once, at position 0. IDs 816
and 1071 do genuinely end in `c2a0` (trailing NBSP), matching the dev's claim for those two. This
is a one-word inaccuracy in the dev's prose for one of three IDs; it does not affect correctness
of the fix (`replace(email, chr(160), ' ')` then `btrim()` correctly strips NBSP regardless of
leading/trailing position) or any of the reported counts, which are all independently confirmed
correct. Flagged for the record, not blocking.

## 5. Independent bug-class sweep

```
$ grep -n "NOT " docs/migracion/generate-clientes-import.py
... (comment lines only, plus the 4 executable-SQL lines already accounted for: line ~271
Q1_trigger_fecha_editado_present's inner NOT inside its own EXISTS subquery boolean context — not
the bug class; line ~273-274 the fixed Q1_audit_clientes_trigger_absent site; line ~276
Q1_serial_sequence_resolvable, already correctly parenthesized; line ~285 Q3_compania_other_values_0's
`NOT IN`, a different operator with no adjacent cast — not the bug class.)
$ grep -n "information_schema" docs/migracion/generate-clientes-import.py
265: FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO')"),
391: (comment only, HC-1 doc text, not executable SQL)
```
Confirmed independently: exactly 1 live site for class (a) (the fixed one), exactly 1 live site
for class (b) (the fixed `Q1_not_null_columns_match`, round 3), and the NBSP mismatch is the one
instance of class (c) found. I did not find an additional defect of any of the three classes.
Corroborated further by the fact that my own full-file live run (§3) completed with 0 SQL errors
and 42/42 PASS — a fourth latent coercion bug, if one existed on this payload, would very likely
have surfaced as either a SQL error or a data-assertion mismatch, and none did.

## 6. Determinism, verified myself

```
$ cp docs/migracion/03-clientes-import-dry-run.sql onDisk_before.sql
$ python3 docs/migracion/generate-clientes-import.py
OK: wrote .../03-clientes-import-dry-run.sql
  ... payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
  output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4
$ cp docs/migracion/03-clientes-import-dry-run.sql myrun1.sql
$ python3 docs/migracion/generate-clientes-import.py
  (identical printed summary and both hashes, second run)
$ cp docs/migracion/03-clientes-import-dry-run.sql myrun2.sql
$ diff myrun1.sql myrun2.sql && echo IDENTICAL
IDENTICAL
$ diff onDisk_before.sql myrun1.sql && echo "MATCHES ON-DISK BEFORE MY RUN TOO"
MATCHES ON-DISK BEFORE MY RUN TOO
```
Two of my own runs are byte-identical to each other and to the pre-existing on-disk file. After my
regeneration runs, `git status --short docs/migracion/03-clientes-import-dry-run.sql` still shows
only the pre-existing `??` entry (content unchanged) — confirming my own verification runs left no
drift.

## 7. AC3 re-derived independently (fresh regex parser, not reused from the dev)

```
$ python3 -c "
import re
src = open('docs/migracion/03-clientes-import-dry-run.sql', encoding='utf-8').read()
start = src.index('INSERT INTO _clientes_import'); end = src.index(';', start)
block = src[start:end]
ids = [int(m) for m in re.findall(r'\((\d+),', block)]
print('rows found:', len(ids))
expected = set(range(1,1241)) - {126,444,817,878,952,953,983,1148,1216}
print('matches expected set:', set(ids) == expected)
"
rows found: 1231
matches expected set: True
```

## 8. AC5 re-derived independently (fresh XLSX reader, own business-rule logic, not the generator's `transform()`)

```
$ python3 independent_backfill.py
sha256: 6a0eb8185926e92586ea8006df30a0195ffd37b78b3d089ee7cbfa7f95d3e2c8
data row count: 1231
responsable N/A (EMPRESA blanks): 229
direccion N/A: 910
email N/A: 599
telefonos N/A: 255
identificacion N/A (NORMAL blanks): 15
nombre_completo N/A (NORMAL blanks): 15
sexo_was_blank (provenance): 402
sexo raw ='N/A' (backfilled + literal): 408
```
Source file's sha256 matches the pinned `EXPECTED_SHA256` — confirms I read the correct, pinned
workbook, not a stale copy. All six backfill counts match plan/dev claims exactly:
229/910/599/255/402/15(+15). `sexo_was_blank`=402, **not regressed to 408** — confirmed
independently, using my own XLSX parser and my own blank/NORMAL-tipo business-rule logic (written
from scratch, not calling any function from `generate-clientes-import.py`).

## 9. Read-only held

Confirmed at three points on my own connection: baseline before any live work (§3), immediately
after the full-file run (§3), and no destructive statement (`INSERT`/`UPDATE`/`DELETE` against a
real table, `CREATE`/`ALTER`/`DROP` outside `pg_temp`) was ever issued — every statement my runner
sent was either the file's own `SELECT`/`pg_temp`-scoped `CREATE TEMP TABLE`/`INSERT INTO
_clientes_import`/`_checks`, or my own bare diagnostic `SELECT`s. `count(*)=1, max(id)=15` held
throughout.

## 10. `npm run qa`, run myself

```
$ npm run qa
> tsc --noEmit          (clean, 0 errors)
> eslint .              ✖ 28 problems (0 errors, 28 warnings)
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
exit=0
```
Matches the dev's claimed shape exactly (0 typecheck errors, 0 lint errors / 28 pre-existing
warnings in `app/**`/`components/**` files this task never touches, 825/825 tests).

## 11. Scope check

```
$ git status --short   (before my work)
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/

$ git status --short   (after my work, before writing this report)
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```
Identical, byte-for-byte the same 8 entries — confirmed no drift from my own regeneration runs or
mutation test (the mutation test ran against a scratch-only copy outside the repo and touched
nothing in `Elibry/`). `docs/migracion/04-clientes-import-execute.sql` confirmed absent (`ls`:
"No such file or directory"). All my own helper scripts (`myrun.js`, `independent_backfill.py`,
the HC-1 mutation copy, diagnostic `.sql` files) live entirely under
`/private/tmp/claude-501/.../scratchpad/qa-t02-r4/`, outside the repo, and do not appear in `git
status --short`.

## 12. Redaction/PII check

```
$ grep -inE "postgres://|postgresql://|service_role|anon_key|eyJ|sslmode=require&|@.*\.supabase\.co" reports/t02-dev-r4.md
(no output)
$ grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" reports/t02-dev-r4.md
(no output)
```
No connection string, key, or email-shaped PII found in the dev's report. My own report above
uses only hex-encoded byte signatures and counts for the NBSP finding, never a decoded email
address — consistent with ADR-0014 and the task's own redaction instruction.

## 13. Generator file size / stdlib-only, verified myself

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
```
Exactly 500 lines (at, not over, the ceiling), stdlib-only, no new dependency, `package.json`
untouched.

## HC-1 gate, independently mutation-tested

```
$ python3 gen_mut.py   # scratch copy only, pais limit forced 100->5, SOURCE_PATH/OUTPUT_PATH pointed at scratch
ABORT (HC-1): the following values exceed their live column length — human ruling required, truncation forbidden:
  id=1 col=pais len=20 limit=5
  ... (all 1231 rows overflow, as expected)
$ echo $?
1
$ ls mutated_output.sql
No such file or directory
```
Real abort, non-zero exit, zero output file — confirmed. Real on-disk generator/output re-hashed
after the mutation test: unchanged (`49595d3e...dcd70` / `a5f74af3...42cc4`), confirming the
mutation test never touched the real files.

## AC10 / isolation-DDL grep, verified myself

```
$ grep -nEi "create policy|row level security|grant |alter table|create role|comprobante|pagos|balance_" docs/migracion/03-clientes-import-dry-run.sql
1335:...('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
$ grep -nE "^(CREATE|DROP|ALTER)" docs/migracion/03-clientes-import-dry-run.sql
76:DROP TABLE IF EXISTS pg_temp._clientes_import;
77:CREATE TEMP TABLE _clientes_import (...
1327:DROP TABLE IF EXISTS pg_temp._checks;
1328:CREATE TEMP TABLE _checks (...
```
Same single expected benign hit, same two `pg_temp` DDL pairs — no `public`-schema DDL, no
policy/grant/role statements. Per ADR-0011 (single-tenant, no RLS), no policy is owed by this
task; the invariant (do not weaken isolation posture) holds — zero RLS-relevant statements in
either file.

---

## Acceptance criteria — scored against my own independent verification (plan lines 388-417)

1. Stdlib-only, hard-coded pinned path, ≤500 lines — **PASS** (§13, my own `wc -l`/`grep`).
2. Deterministic (byte-identical across 2 runs, no timestamp/username/hostname/path) — **PASS**
   (§6, my own two independent runs + on-disk match).
3. Exactly 1231 rows, id set = 1..1240 minus the 9 gaps — **PASS** (§7, my own fresh parser).
4. Mapping fidelity (compania/referido_por/observacion/fecha_nacimiento/pais/estado_registro) —
   **PASS**, confirmed live on my own run (§3 grid: all Q3/Q4 mapping-fidelity rows read PASS).
5. Exactly one `'N/A'` placeholder at the six forced-backfill sites, counts 229/910/599/255/402/15,
   zero invented values — **PASS** (§8, my own independent XLSX reader; `grep -oE "'N/A[0-9@]"` →
   0 hits, re-run myself).
6. Verbatim preservation (3-comma email cell, 45 dirty emails, both dup-identificacion pairs) —
   **PASS** (§4, independently reproduced 45 via my own live diagnostic query on the real payload;
   dup-identificacion pairs both read PASS live in §3's grid).
7. HC-1 gate fires and exits non-zero on overflow, no output file — **PASS** (mutation-tested
   myself, real files re-hashed unchanged afterward).
8. Mapping table printed, no sheet column silently dropped — **PASS** (`grep -c '^    ("'` → 20,
   confirmed myself; unchanged since round 2/3, this round touched only check predicates).
9. `03-...sql` header states read-only/DO NOT EDIT/file-size exemption/payload-sha256 — **PASS**
   (confirmed via `head -20`, all four elements present).
10. Isolation/DDL grep — no policy/grant/role/fiscal-table hits beyond the one benign `pagos` read
    guard, only `pg_temp` DDL — **PASS** (re-grepped myself, identical result).
11. `npm run qa` green — **PASS** (run myself: 0 typecheck errors, 0 lint errors/28 pre-existing
    warnings, 825/825 tests).
12. Rollback note (no git verb, states exactly which 2 untracked files to delete/restore) — **PASS**
    (dev's rollback note in `t02-dev-r4.md` correctly names the two files and states no destructive
    DB op occurred, no git verb used).

**12/12 PASS**, independently re-derived.

---

## Attack Log (show your work)

- **RLS / org isolation:** N/A for this task — ADR-0011 (single-tenant, no RLS on ~29 pre-existing
  tables) applies; this task creates zero new tables (`pg_temp` only, gone on connection close).
  Verified via my own `grep -nEi "create policy|row level security|grant |alter table|create
  role"` → 0 hits, and via `grep -nE "^(CREATE|DROP|ALTER)"` → only 2 `pg_temp` `CREATE TEMP
  TABLE`/`DROP TABLE IF EXISTS` pairs, no `public`-schema object created.
- **Optimistic UI:** N/A — no app/UI code in scope this task (pure offline SQL-generation
  artifact); no optimistic-write path exists here to attack.
- **Realtime:** N/A — no subscriber/view code touched.
- **Edge cases tried:**
  - Forced an artificial column-length overflow (HC-1 mutation test, `pais` limit 100→5 on a
    scratch-only generator copy) and confirmed a real abort + zero output file, not a silent
    truncation.
  - Ran the OLD (pre-fix) `Q5_dirty_email_count` predicate directly against the live staged
    payload myself to confirm the claimed 54/48/45 progression is real, not asserted.
  - Independently hex-dumped the three specific NBSP row IDs the dev cited, catching a one-word
    inaccuracy in the dev's positional description (leading vs. trailing NBSP for id=569) that a
    pure trust-the-report review would have missed.
  - Tried to find a 4th coercion-bug site via an independent `NOT`/`information_schema` grep
    sweep, and independently confirmed the live full-file run completes error-free with 42/42
    PASS — i.e. actually attempted to break the artifact's correctness claim on data it hadn't
    already been checked against, using my own tooling, rather than re-running the dev's scripts.
  - Ran the generator twice myself and diffed against the pre-existing on-disk file, rather than
    trusting the dev's "byte-identical" claim.
- **What I tried that could have broken this:** I wrote my own SQL-execution runner from scratch
  (different code from the dev's `pg_run.js`/`sweep.js`) and ran the entire regenerated file live
  against the real database myself, independently reproduced the NBSP root-cause diagnostic
  queries against the live payload, independently re-parsed the raw pinned XLSX with my own
  business-rule logic for all six AC5 backfill sites, and independently mutation-tested the HC-1
  gate — none of these attempts found a defect in the artifact itself (only a harmless one-word
  inaccuracy in the dev's prose). PASS is earned on the strength of these independent attempts,
  not on re-running the dev's own tests.

---

## Out-of-scope changes

None. `git status --short` before and after this QA round is byte-identical (§11) — the same 8
entries as every prior round. No file outside `docs/migracion/generate-clientes-import.py`,
`docs/migracion/03-clientes-import-dry-run.sql`, and this new report file was touched.

## Bugs found

One minor, non-blocking **report-accuracy** discrepancy (not a functional/SQL bug): the dev's
report states id=569's NBSP "ends c2a0" — independently verified the NBSP is actually **leading**
(hex starts with `c2a0`, not ends), the only one of the three cited IDs where the dev's positional
description is wrong. Does not affect the correctness of the fix, the count (45, independently
reproduced), or any AC. No other bug found in the artifact itself.

## Suggested fixes

None required to pass. Optional/cosmetic: correct the "id=569: hex ends c2a0" wording in
`reports/t02-dev-r4.md` (or a future report) to "hex starts with c2a0" for accuracy, since the
NBSP is leading on that one row, not trailing.

## Rollback note

Read-only QA task — nothing to revert (no source file touched; this report is a new file inside
the already-untracked sprint directory). All live-DB tooling built for this QA round lives outside
the repo under this session's private scratch directory and was never staged/committed. No git
verb needed.
