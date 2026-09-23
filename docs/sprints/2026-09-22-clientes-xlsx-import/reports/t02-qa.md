# T2 — Generator + generated dry-run SQL — QA report

Verdict: **FAIL** (one confirmed, reproducible bug in the generated SQL's own
verification check; everything else independently verified and correct)

---

## Commands run (all executed live by QA, not copied from the dev report)

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
Exactly the 2 in-scope new files (`generate-clientes-import.py`,
`03-clientes-import-dry-run.sql`) plus this sprint's own report addition under
the already-untracked sprint dir. No file outside scope changed. `package.json`
has zero diff / zero status entry — stdlib-only claim corroborated.

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
≤500 lines, stdlib-only, no `openpyxl`.

**Determinism (two independent runs by QA, not the dev's pasted output):**
```
$ python3 docs/migracion/generate-clientes-import.py   (run A)
  payload-sha256: 43afd381fb8ff8f8cf187b3d3f093583a72de8ec54ebf58055880c19f9b25ced
  output sha256:  68ff202506c43163a340471af16c1aace49043f1ea967e80e79b704edc500d58
$ python3 docs/migracion/generate-clientes-import.py   (run B, second invocation)
  payload-sha256: 43afd381fb8ff8f8cf187b3d3f093583a72de8ec54ebf58055880c19f9b25ced
  output sha256:  68ff202506c43163a340471af16c1aace49043f1ea967e80e79b704edc500d58
$ diff /tmp/qa_run1.sql /tmp/qa_run2.sql && echo BYTE-IDENTICAL CONFIRMED
BYTE-IDENTICAL CONFIRMED
```
Matches the dev's claimed hash exactly. AC 2 independently reproduced, not
just trusted.

**Row count / id-set (recomputed independently, own extraction script, not the
dev's grep):**
```
$ grep -c "^  ([0-9]" docs/migracion/03-clientes-import-dry-run.sql
1231
```
Python re-extraction of every `^  (id, ...)` row line + set comparison against
`range(1,1241) - {126,444,817,878,952,953,983,1148,1216}` → **exact match**,
zero extra, zero missing. AC 3 confirmed by independent computation.

**HC-1 gate — mutation-tested, not read-and-trusted:** patched a throwaway copy
of the generator, lowering `COLUMN_LIMITS["pais"]` from 100 to 5 (the real
`pais` literal measures 20 chars), pointed `SOURCE_PATH` at a scratch copy of
the pinned xlsx, and ran it:
```
$ python3 /tmp/generate_mutated_pathfixed.py
ABORT (HC-1): the following values exceed their live column length —
human ruling required, truncation forbidden:
  id=1 col=pais len=20 limit=5
  ... (all 1231 ids)
EXIT CODE: 1
$ ls /tmp/hc1test/03-clientes-import-dry-run.sql
ls: No such file or directory
```
Confirms the gate is real: it measures live-column-derived lengths, aborts
non-zero via `sys.exit`, and — critically — **produces no output file** when it
fires. Not decorative. `COLUMN_LIMITS` in the source matches T1's live
`character_maximum_length` values exactly for every column named in the task
brief (rnc/identificacion/sexo/tipo_cliente/status/estado_registro=20;
telefonos/email/razon_social/nombre_comercial/responsable/nombre_completo/
referido_por/registrado_por=200; compania=50; pais=100).

**`pais` literal (independently re-parsed, all 1231 rows, not sampled):**
```
distinct pais values across all 1231 rows: {'República Dominicana'}
```
Exact accented literal per the human-ruling amendment T1/T2 both cite (this
QA task's own brief also names this as the binding value to check against —
treated as legitimate, not re-litigated).

**`cedula_pasaporte`:**
```
$ grep -n "cedula_pasaporte" docs/migracion/generate-clientes-import.py docs/migracion/03-clientes-import-dry-run.sql
generate-clientes-import.py:26:`cedula_pasaporte` does not exist live (T1 Q4, refuted) and is never used.
```
Only appears inside a comment explaining it is *not* used. Never referenced as
a column, mapping target, or literal anywhere. Confirmed absent from
`DB_COLUMNS` and the emitted `CREATE TEMP TABLE`/`INSERT` column list.

**Isolation/DDL/fiscal grep (run by QA):**
```
$ grep -nEi "create policy|row level security|grant |alter table|create role|comprobante|pagos|balance_" docs/migracion/03-clientes-import-dry-run.sql
1335:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
```
Inspected this exact line: a read-only `SELECT count(*) FROM pagos WHERE
cliente_id = 15` embedded inside a `_checks` INSERT. Genuinely benign — matches
the plan's own accepted carve-out (plan §3 statement 7 / guard G9, which
explicitly checks `pagos` read-only before the `DELETE`). No `CREATE POLICY`,
`ROW LEVEL SECURITY`, `GRANT`, `ALTER TABLE`, `CREATE ROLE`, `comprobante*`, or
`balance_` anywhere. Only DDL in the file is two `CREATE TEMP TABLE` /
`DROP TABLE IF EXISTS pg_temp.*` pairs — no `public` schema object created, so
per ADR 0011 (single-tenant, no RLS) no policy is owed. Not weakened.

**Header:**
```
$ head -20 docs/migracion/03-clientes-import-dry-run.sql
-- 03-clientes-import-dry-run.sql — READ-ONLY. DO NOT EDIT — generated by ...
-- File-size exemption (pre-approved, .claude/rules/file-size.md, plan §2): ...
-- payload-sha256: 43afd381fb8ff8f8cf187b3d3f093583a72de8ec54ebf58055880c19f9b25ced
```
All four required elements present (read-only, DO NOT EDIT — generated,
file-size exemption, `-- payload-sha256:` line).

**Placeholder-backfill discipline:**
```
$ grep -oE "'N/A[0-9@]" docs/migracion/03-clientes-import-dry-run.sql | wc -l
0
```
Independently re-parsed all 1231 rows: `observacion` and `fecha_nacimiento`
are bare `NULL` on **every** row (0 exceptions) — never `'N/A'` or any
invented value.

**NBSP (U+00A0) finding — verified real:**
```
python3: total NBSP occurrences in file: 26
'<CEDULA-A>' cell at ID_CLIENTE=941: has_nbsp=True (trailing U+00A0)
'<CEDULA-A>' cell at ID_CLIENTE=1106: has_nbsp=False
```
Confirmed present, exactly as the dev reported. Verification-check
normalization confirmed real, not decorative:
```
$ grep -n "chr(160)" docs/migracion/03-clientes-import-dry-run.sql
1366: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-A>'
1367: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-B>'
```
The dup-identificacion checks normalize the NBSP before comparing, so they
will not silently mis-detect the duplicate pair as non-matching. Dev's claim
holds.

**PII/redaction spot check:**
```
$ grep -nEi "@[a-z0-9.]+\.(com|net|org)" reports/t02-dev.md scratchpad.md
(no hits)
$ grep -nE "[0-9]{9,}" reports/t02-dev.md | grep -viE "sha256|md5|payload-sha|boundary"
193/194: the two identificacion values '<CEDULA-A>'/'<CEDULA-B>'
```
Those two values are explicitly pre-cleared as non-secret by this task's own
binding inputs (same precedent T1 used) — not a violation. No email, phone,
name, key, or connection string found in the report or scratchpad.

**`npm run qa` (run independently by QA):**
```
$ npm run qa
> tsc --noEmit          (clean, no output)
> eslint .              28 warnings, 0 errors — all pre-existing, all in
                        app/** files this task never touched
> vitest run            Test Files  30 passed (30)
                        Tests       825 passed (825)
```
Green, matches the dev's claim, reproduced independently.

---

## THE BUG — `Q4_backfill_sexo_402` check is provably wrong

This is the one attack that broke something: I independently re-parsed every
one of the 1231 emitted `sexo` values (two independent parsers, same result)
instead of trusting the dev's Python-summary claim of "sexo: 402".

```
sexo N/A:    408   (not 402)
sexo NULL:   226
FEMENINO:    405
MASCULINO:   188
OTROS:         4
(sum = 1231)
```

Root cause, confirmed by parsing the raw pinned `.xlsx` directly: the sheet's
`sexo` column has **6 rows where the cell is not blank but already contains
the literal text `"N/A"`** (a legitimate value — `'N/A'` is in the live
`clientes_sexo_check` CHECK constraint's allowed set, and in the generator's
own `VALID_SEXO`). Those 6 rows are correctly passed through verbatim (not
backfilled, not blank) — that part of the mapping is correct. But:

- The generator's **Python-side summary** counts only *backfilled* blanks
  (628 blank sexo cells total, 226 of which belong to EMPRESA rows and map to
  `NULL`, leaving 402 NORMAL-row blanks that get backfilled to `'N/A'`) — so
  it correctly prints `402`.
- The **SQL check embedded in `03-clientes-import-dry-run.sql`**,
  `Q4_backfill_sexo_402`, uses the predicate `WHERE sexo = 'N/A'` — this
  counts the *final value*, which cannot distinguish "backfilled from blank"
  from "verbatim sheet literal N/A". It will return **408**, not 402, when
  actually run against the staged payload.

```sql
INSERT INTO _checks(name, expected, actual) VALUES
  ('Q4_backfill_sexo_402', '402',
   (SELECT count(*)::text FROM _clientes_import WHERE sexo = 'N/A'));
```
`expected='402'`, live `actual` will be `'408'` → **MISMATCH**, which per this
check's own row in `_checks` will flip the file's final Q7 verdict
(`SELECT ... WHERE expected <> actual`) to `*** ABORT ***`, even though
nothing is actually wrong with the data — it's a false alarm baked into the
artifact by an SQL predicate that can't see backfill provenance.

This is not a hypothetical: T3's own AC 4 requires "Q3/Q4 grids read PASS on
every distribution and every backfill count, or the task reports FAIL loudly
and stops — no 'close enough'." If T2 ships as-is, **T3 will genuinely fail
this specific check** when the dry run is executed live, and per its own
instructions must stop and bounce back to T2 — exactly the rework this defect
should be caught before, not after.

Every other backfill-count check (`responsable`, `direccion`, `email`,
`telefonos`, `identificacion`, `nombre_completo`) uses the same
value-equality predicate shape and I independently re-verified all six of
those against the raw sheet/emitted payload — they have **no** literal-value
collision with their placeholder, so those five checks are correct as
written. This defect is specific to `sexo`, because `'N/A'` happens to be
both a valid domain value there and the placeholder literal.

**Suggested fix (specific, for the dev):** either (a) correct the check's
`expected` literal to `'408'` and separately assert the true backfill-only
count (`402`) via a provenance-aware predicate — e.g. stage an extra boolean
column in `_clientes_import` (`sexo_was_blank boolean`) set by the generator
per-row during transform, and check `WHERE sexo_was_blank` = 402 — or (b) if
408 is judged the more meaningful live-checkable fact, rename the check
(`Q4_sexo_na_total_408`) and keep `402` only as a generation-time-only
(Python-side) fact, not a live SQL assertion. Do not ship a check whose
`expected` value is known-wrong for the predicate it runs.

---

## Acceptance criteria (plan §9 T2, each checked individually)

1. Stdlib-only, hard-coded pinned path, ≤500 lines — **PASS** (verified: 500 lines, only stdlib imports, `SOURCE_PATH` hard-coded relative to script dir)
2. Deterministic, byte-identical across 2 runs, no timestamp/username/host/path — **PASS** (independently reproduced twice; grepped for `/Users/`, found none in the emitted SQL — only prose paths as commented instructions)
3. Exactly 1231 rows, id-set matches expected gaps — **PASS** (independently re-derived and diffed against `1..1240` minus the 9 gaps — exact match)
4. Mapping fidelity (compania, referido_por, observacion/fecha_nacimiento NULL, pais literal, estado_registro) — **PASS** (independently recomputed: compania {MARCA 1: 1010, MARCA 2: 221}; referido_por containing MARCA: 0; observacion/fecha_nacimiento bare NULL on all 1231; pais literal `'República Dominicana'` on all 1231; estado_registro PERMANENTE 1230 / NULL 1)
5. Placeholder-backfill counts + no invented values — **FAIL** (five of six sites — responsable 229, direccion 910, email 599, telefonos 255, identificacion 15, nombre_completo 15 — independently confirmed exact; **`sexo` is the sixth site and its live-checkable SQL assertion is wrong** — see bug above. The *generator's* Python summary is right; the *shipped SQL artifact*'s own check is not.)
6. Verbatim preservation (3-comma email, 45 dirty emails, both duplicate identificacion pairs) — **PASS** (structure of checks inspected; NBSP normalization in the dup-identificacion check independently confirmed correct and necessary)
7. HC-1 gate measures live limits and aborts on overflow — **PASS** (mutation-tested: forced an artificial overflow, confirmed real abort + zero output file)
8. Mapping table (sheet→DB) printed in report + generated header, nothing silently dropped — **PASS** (verified `MAPPING_TABLE` constant present in generator and rendered in `03-...sql` header; all 35 live columns accounted for)
9. `03-...sql` header states read-only/DO NOT EDIT/exemption/payload-sha256 — **PASS**
10. Isolation/DDL/fiscal grep — no unexpected hits — **PASS** (1 expected, benign `pagos` read-only guard, inspected)
11. `npm run qa` green — **PASS** (independently run; tsc clean, eslint 0 errors, 825/825 tests)
12. Rollback note, no git verb — **PASS** (prose-only, names exactly the 2 files to delete)

**Net: 11 of 12 individually-checked ACs pass. AC 5 fails on one of its six
required sites** — not a cosmetic nit; the check as shipped will produce a
real, false ABORT signal on T3's live run, per the mismatch demonstrated
above.

---

## Judgment calls from the dev's report

**Deferred Q6 "7 preserved columns capturable" sub-check:** reviewed plan
§9 T2's own numbered AC list (lines 388–417) — it does **not** mention Q6 or
`_jrosa_preserva` anywhere. Q6 (including the "7 preserved columns
capturable" line) lives in plan §5 (dry-run *contents* design, lines 284–286),
which is architect-level design context for what `03-...sql` should
eventually contain, not T2's graded AC list. `_jrosa_preserva` itself is
explicitly a T4 construct (`CREATE TEMP TABLE _jrosa_preserva AS SELECT <7
cols> FROM clientes WHERE id = 15`, plan §3 statement 1, inside T4's DB-changes
table, not T2's). The dev implemented the two unambiguous Q6 assertions
(`Q6_sheet_1185_is_jrosa`, `Q6_sheet_15_is_melissa`) plus the related
`Q1_live_id_15_is_jrosa` precondition — confirmed present in the SQL by grep —
and disclosed, rather than silently dropped, the one sub-check requiring a
column-list decision that is genuinely T4's to make (weak-backstop-guard: an
unpinned 7-column guess here would become T4's inherited, unreviewed
contract). **My own judgment: this is correctly scoped out of T2 and correctly
disclosed; not a blocker, not a reason to fail this task on its own.** It does
not change the FAIL verdict above, which rests entirely on the sexo check bug.

**"Human ruling" on `pais` (accented, overriding the plan's frozen
'REPUBLICA DOMINICANA' text):** this QA task's own brief independently names
the accented value as the one to verify against, so I have treated the
ruling as legitimate and out of scope to re-litigate here, per instructions.
Flagging only for the record: this diverges from the plan text at HC-4
("Frozen by the spec ... not to be 'fixed'"), so the paper trail for *where*
this human ruling was actually made (as opposed to asserted by T1's report)
is worth the lead confirming exists outside the agent chain before T3 locks
it in further.

---

## Out-of-scope changes

None. `git status --short` shows exactly the 2 declared new files for this
task (plus this QA report and the pre-existing, already-untracked sprint
files/architect artifacts that predate T2).

## Bugs found

1. **`Q4_backfill_sexo_402` check in `docs/migracion/03-clientes-import-dry-run.sql`
   asserts `expected='402'` against a predicate (`sexo = 'N/A'`) that actually
   evaluates to `408`** on the real staged payload (6 sheet rows have a
   pre-existing literal `"N/A"` sexo value distinct from the 402
   backfilled-from-blank rows). This will produce a false `*** ABORT ***` at
   T3's live run. Independently confirmed via two separate parsers against
   both the generated SQL and the raw pinned `.xlsx`.

## Suggested fixes

- Fix `Q4_backfill_sexo_402`: either track backfill provenance explicitly
  (stage a `sexo_was_blank boolean` alongside the value, assert on that column
  = 402) and keep the value-population fact as a separately-named, correctly-
  expected check, or rename/re-baseline the existing check to the true
  value-population count (408) and drop the implied "= backfill count"
  framing. Do not ship a `_checks` row whose `expected` is provably wrong for
  its own predicate.
- Everything else in this task's diff is correct and independently verified;
  no other fix required for T2 itself.

---

## Attack Log (adversarial-qa mandatory block)

- RLS: N/A — no table created, ADR 0011 (no RLS, single-tenant) applies; grep-verified zero `CREATE POLICY`/`GRANT`/`ALTER TABLE`/`ROW LEVEL SECURITY` in the generated SQL; the one `pagos` hit is a read-only guard SELECT, inspected line-by-line.
- Optimistic UI: N/A — no UI/React file touched this task (plan states `Realtime | no`, zero app files in scope).
- Realtime: N/A — no realtime subscriptions in this project (plan-confirmed); no view-to-view surface exists.
- Edge cases tried: mutated `COLUMN_LIMITS["pais"]` to force an HC-1 overflow and confirmed a real abort with no output file; independently re-derived every distribution/backfill count from the raw payload instead of trusting the generator's printed summary; independently re-derived the id-set instead of trusting the grep count; ran the generator twice myself for determinism instead of accepting the dev's pasted hashes.
- What I tried that could have broken this: recomputed every one of the six backfill-count sites against the actual emitted SQL data (not the generator's self-reported summary) — for five of six sites the artifact was exactly right, but for `sexo` this attack found a real, reproducible mismatch (408 actual vs 402 expected) baked into the shipped SQL's own live-verification check, which would falsely abort T3's live run. This is a genuine defect this attack surfaced, not a rubber stamp.

## Rollback

This QA task wrote only this report file
(`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-qa.md`) and updated
the scratchpad ledger/handoff. Nothing else was touched; delete this file to
revert. No database was touched; no git verb applies.
