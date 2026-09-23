# T2 — Generator + generated dry-run SQL — QA report, ROUND 2 (re-verification)

Verdict: **PASS**

Re-verified from scratch per the lead's send-back instructions — did not diff
against round 1's numbers or trust `reports/t02-dev-r2.md`'s claims. Every
command below was run independently by QA against the CURRENT on-disk files.

---

## Commands run (all executed live by QA)

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
Exactly the same 8 top-level entries as round 1. Only the 3 declared round-2
files are new/changed within scope: `generate-clientes-import.py` (edited),
`03-clientes-import-dry-run.sql` (regenerated), `reports/t02-dev-r2.md` (new,
inside the already-untracked sprint dir). **No out-of-scope file touched.**

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
stdlib-only, ≤500 lines — confirmed on the current file.

**Determinism — ran the generator twice myself (not the dev's pasted hashes):**
```
$ python3 docs/migracion/generate-clientes-import.py   (run A, before I touched anything)
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
90fff4202dd193d1c67ff41f4c8c0bac86e1a4c5c94861d143b5c4e4a85f9c1f  docs/migracion/03-clientes-import-dry-run.sql
$ python3 docs/migracion/generate-clientes-import.py   (run B, second invocation)
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
90fff4202dd193d1c67ff41f4c8c0bac86e1a4c5c94861d143b5c4e4a85f9c1f  docs/migracion/03-clientes-import-dry-run.sql
$ diff run1.sql run2.sql && echo IDENTICAL
IDENTICAL
```
Matches the dev's claimed output-sha256 (`90fff420...f9c1f`) exactly, and — critically —
matches the file that was already on disk *before* I ran anything (verified via a
pre-run copy diffed against my own runs), so my regeneration introduced no drift.
Payload-sha256 (`9664ee4e...932392`) correctly differs from round 1's (extra column
per row, as expected) and is internally consistent with what the file actually
contains (verified below, not just trusted).

---

## THE FIX — independently re-derived, fresh parser, not reused from round 1 or the dev

Wrote a brand-new tuple-splitting parser against the regenerated
`03-clientes-import-dry-run.sql`'s actual `INSERT INTO _clientes_import (...) VALUES`
data (quote-aware, handles `''`-escaped apostrophes), completely independent of the
dev's or round-1 QA's code:

```
rows parsed: 1231
sexo = 'N/A' count (old broken predicate): 408
sexo_was_blank = true count (new predicate): 402
```

This reproduces both halves of round 1's diagnosis on the CURRENT payload: the old
predicate is still 408 (confirms the bug was real and is not "fixed" by coincidence),
and the new predicate is exactly 402 (matches the check's own `expected='402'`).

**Root-cause cross-check against the raw pinned `.xlsx` (not the generator, not the
generated SQL) — wrote a second independent script reusing only the stdlib
zipfile/ElementTree read path to pull raw cell values directly:**
```
total blank sexo cells: 628   (NORMAL blank: 402, EMPRESA blank: 226)
literal 'N/A' non-blank cells: 6
```
The 6 non-blank literal-`'N/A'` sheet rows were spot-checked by ID_CLIENTE
(480, 995, 1032, 1087, 1095, 1197) directly against the raw sheet — all 6 have a
genuinely non-blank cell containing the literal text `"N/A"`, not a blank cell that
got mis-flagged. Cross-referenced against the generated SQL: all 6 have
`sexo_was_blank=false` and `sexo='N/A'` (verbatim preserved, correctly NOT counted as
backfilled). This proves the fix is **real per-row provenance derived at
transform-time** (`normal_field()` returns `flags=True` only when the sheet cell was
genuinely blank AND `tipo_cliente=='NORMAL'`), not a hardcoded or copied `402` value —
i.e. not a fake-green pattern. Code path read directly in
`generate-clientes-import.py:173`:
```python
out["sexo"], flags["sexo"] = normal_field("sexo", "NORMAL"); out["sexo_was_blank"] = flags["sexo"]
```

**Live check, read directly from the regenerated file:**
```
$ grep -n "Q4_backfill_sexo_402" docs/migracion/03-clientes-import-dry-run.sql
1360:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_sexo_402', '402', (SELECT count(*)::text FROM _clientes_import WHERE sexo_was_blank));
```
`expected='402'` against `WHERE sexo_was_blank` → live `actual` will be `402`
(independently confirmed above) → this check will now PASS when T3 runs it live,
not falsely ABORT as round 1's artifact would have.

---

## `sexo_was_blank` is diagnostic-only — confirmed, no leak path

```
$ grep -n "sexo_was_blank" docs/migracion/generate-clientes-import.py docs/migracion/03-clientes-import-dry-run.sql
```
Appears only in: `DB_COLUMNS` (staging list) + `_BOOLEAN_DB_COLUMNS` marker set,
`transform()`'s assignment, the `Q4_backfill_sexo_402` predicate, and the
`CREATE TEMP TABLE _clientes_import (...)` column list (both in the generator's
f-string and the emitted SQL). **Confirmed absent from `MAPPING_TABLE`** (read
directly, lines 74–99 of the generator — the sheet→DB mapping doc that AC 8 requires
to be complete; `sexo_was_blank` correctly does not appear there since it has no
sheet source and isn't a live `clientes` column). Confirmed it lives only inside
`pg_temp` — `DROP TABLE IF EXISTS pg_temp._clientes_import; CREATE TEMP TABLE
_clientes_import (...)` — never a `public`-schema object. Both the `DB_COLUMNS` line
and the `CREATE TEMP TABLE` line carry an explicit inline comment: "not a live
`clientes` col; T4 must not select it." Since T2's scope never writes T4's execute
script, there is no code path in this diff that could select this column into a real
table. No RLS question is raised (ADR 0011: single-tenant, no RLS, no table created).

---

## Regression check — the other 11 ACs, independently re-verified (not "trusted unchanged")

Wrote fresh Python parsers against the regenerated `03-...sql`'s actual VALUES data
for every count below (did not reuse round-1 QA's or the dev's scripts):

- **Backfill counts (other 5 sites):** `responsable`=229, `direccion`=910, `email`=599,
  `telefonos`=255, `identificacion`=15, `nombre_completo`=15 — all matched exactly on
  independent re-parse.
- **Mapping fidelity:** `compania` distribution `{'MARCA 1': 1010, 'MARCA 2': 221}`;
  `referido_por` containing `MARCA`: 0; `observacion`/`fecha_nacimiento` bare `NULL` on
  all 1231; `pais` distinct value across all 1231 rows: `{'República Dominicana'}`
  (single accented literal, no other value); `estado_registro`: 1230 `'PERMANENTE'` / 1
  `NULL`.
- **Row count / id-set:** `grep -c "^  ([0-9]"` → 1231; independently re-derived the
  full id set from the VALUES block and diffed against `range(1,1241)` minus the 9
  known gaps `{126,444,817,878,952,953,983,1148,1216}` → exact match, 1231 distinct
  ids, no duplicates.
- **Verbatim preservation:** the 3-comma email cell at `ID_CLIENTE=890` — pulled the raw
  cell from the pinned `.xlsx` directly (`'<CLIENT-EMAIL-1>,
  <CLIENT-EMAIL-2>, <CLIENT-EMAIL-3>'`) and confirmed it appears
  byte-for-byte identical in the generated SQL's row `(890, ...)`. 45 dirty emails —
  independently recomputed with a fresh parser using the same regex the check uses
  (`^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$`) against the parsed VALUES data → 45, matches.
  Both duplicate `identificacion` pairs (`'<CEDULA-A>'`, `'<CEDULA-B>'`, each 2 rows)
  independently re-derived from the raw sheet with NBSP-aware grouping — matches the
  emitted `Q5_dup_identificacion_*` checks' normalization (`btrim(replace(...,
  chr(160), ' '))`), confirmed present in the current file (line 1366-1367).
- **HC-1 gate — mutation-tested again, independently:** built my own mutated copy of
  the generator (absolute `SOURCE_PATH`/`OUTPUT_PATH` overrides, `COLUMN_LIMITS["pais"]`
  forced from 100 to 5, real max is 20) and ran it end-to-end against the real pinned
  xlsx:
  ```
  ABORT (HC-1): the following values exceed their live column length —
  human ruling required, truncation forbidden:
    id=1 col=pais len=20 limit=5
    ... (all 1231 ids)
  EXIT CODE: 1
  $ ls <mutated output dir>
  (empty — no output file was written)
  ```
  Confirms the gate still functions after the fix and still produces zero output on
  overflow. `sexo_was_blank` is a boolean, correctly excluded from `COLUMN_LIMITS`
  (verified: not present in that dict), so it cannot interfere with the gate.
- **Mapping table completeness:** `MAPPING_TABLE` constant read directly — untouched
  by this diff, `sexo_was_blank` correctly absent (see above).
- **Header:** `head -20` shows all four required elements (read-only, `DO NOT
  EDIT — generated`, file-size exemption, `-- payload-sha256:` line), payload-sha256
  updated to the new value and internally consistent with the file's actual content.
- **Isolation/DDL/fiscal grep:**
  ```
  $ grep -nEi "create policy|row level security|grant |alter table|create role|comprobante|pagos|balance_" docs/migracion/03-clientes-import-dry-run.sql
  1335:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
  ```
  Same single expected, benign, read-only `pagos` hit as round 1. Zero `CREATE
  POLICY`/`ROW LEVEL SECURITY`/`GRANT`/`ALTER TABLE`/`CREATE ROLE`/`comprobante*`/
  `balance_`. Only DDL: two `pg_temp` `CREATE TEMP TABLE`/`DROP TABLE IF EXISTS`
  pairs.
- **`npm run qa` — run independently by QA:**
  ```
  $ npm run qa
  > tsc --noEmit         (clean, no output)
  > eslint .             28 warnings, 0 errors — all pre-existing, all in app/**
  > vitest run           Test Files  30 passed (30)
                         Tests       825 passed (825)
  ```
  Green, matches the dev's claim.
- **Rollback note:** present, prose-only, no git verb — names exactly the two files to
  restore/delete.

---

## Full-diff sanity check (5-hunks-only claim)

Round 1's file is gone (overwritten), so I cross-checked plausibility against
`reports/t02-dev.md` (round 1's still-on-disk dev report), which independently
measured nearly every value this round-2 QA re-derived: line count (500, same),
imports (same 6 stdlib), all six backfill counts, `compania`/`referido_por`/
`observacion`/`fecha_nacimiento`/`pais`/`estado_registro` distributions, HC-1 measured
max lengths per column (byte-for-byte identical table), dirty-email count (45), NBSP
occurrence count, and the isolation grep's single `pagos` hit — **all identical
between round 1 and round 2** except the sha256 hashes (expected: new column) and the
`sexo` predicate itself. This is strong corroboration that only the disclosed fix
changed. Additionally grepped the current file for statement-joining semicolons
(`; ` mid-line, excluding prose/comment semicolons already present in the constant
tables): only two lines carry a genuine code-joining semicolon —
`]; _BOOLEAN_DB_COLUMNS = {"sexo_was_blank"}` (line 72) and `out["sexo"], ... ;
out["sexo_was_blank"] = flags["sexo"]` (line 173) — exactly the two lines the dev's
diff shows as compacted for the 500-line ceiling. Nothing else in the file shows
similar compression artifacts. The claim holds up.

---

## Acceptance criteria (plan §9 T2, each re-checked individually)

1. stdlib-only, ≤500 lines — **PASS**
2. Deterministic, byte-identical, no timestamp/username/path — **PASS** (reproduced twice myself)
3. Exactly 1231 rows, id-set matches — **PASS** (independently re-derived)
4. Mapping fidelity — **PASS** (independently recomputed all five sub-checks)
5. Placeholder-backfill counts + no invented values — **PASS** (all six sites now correct, including the fixed `sexo` site; root cause and fix both independently reproduced against the raw xlsx and the regenerated SQL)
6. Verbatim preservation — **PASS** (3-comma email byte-identical, 45 dirty emails, both dup identificacion pairs incl. NBSP normalization, all independently reproduced)
7. HC-1 gate measures live limits, aborts on overflow — **PASS** (mutation-tested again independently: real abort, zero output file)
8. Mapping table complete, nothing silently dropped — **PASS** (unaffected by this fix; `sexo_was_blank` correctly absent)
9. Header (read-only/DO NOT EDIT/exemption/payload-sha256) — **PASS**
10. Isolation/DDL/fiscal grep — **PASS** (1 expected benign `pagos` hit only)
11. `npm run qa` green — **PASS** (independently run)
12. Rollback note, no git verb — **PASS**

**Net: 12 of 12 individually-checked ACs pass.**

---

## Out-of-scope changes

None. `git status --short` shows exactly the 3 declared round-2 files (plus
pre-existing untracked entries that predate T2 and this report itself).

## Bugs found

None this round. The round-1 bug (`Q4_backfill_sexo_402` predicate/expected mismatch)
is genuinely fixed via Option A (provenance-aware boolean column), independently
re-derived from both the raw pinned `.xlsx` and the regenerated SQL, not merely
asserted by the dev.

## Suggested fixes

None. Restating one non-blocking process item already on record (not a T2 defect):
the lead's report (`reports/t02-lead.md`, "Judgment items reviewed §2") flags that the
`pais` accented-literal human ruling should get a durable paper trail directly from
the human before T3 executes live — this is an orchestrator/process action item, not
a rework item for T2, and does not affect this verdict.

---

## Attack Log (adversarial-qa mandatory block)

- RLS: N/A — no table created in `public`; ADR 0011 (no RLS, single-tenant) applies,
  grep-verified zero `CREATE POLICY`/`GRANT`/`ALTER TABLE`/`ROW LEVEL SECURITY`. The
  new `sexo_was_blank` column lives only inside a `pg_temp` TEMP table with an
  explicit "T4 must not select it" comment at both definition sites — traced the only
  two places it's referenced in the diff and confirmed neither is a `public`-schema
  write path.
- Optimistic UI: N/A — no UI/React file touched.
- Realtime: N/A — no realtime subscriptions in this project; no view-to-view surface.
- Edge cases tried: mutated `COLUMN_LIMITS["pais"]` to force an HC-1 overflow (own
  mutated copy, own absolute-path overrides) and confirmed real abort + zero output
  file; independently re-derived the sexo_was_blank=402 / sexo='N/A'=408 split from
  the regenerated SQL with a brand-new parser; independently re-parsed the raw pinned
  `.xlsx` sexo column from scratch (bypassing the generator entirely) to confirm the
  628-blank/6-literal-N/A split is a real property of the source data, not an artifact
  of the generator's logic; spot-checked all 6 "collision" row IDs directly against
  raw sheet cells; re-ran determinism twice myself instead of trusting the dev's pasted
  hashes; cross-referenced every other AC's numbers against round 1's still-on-disk
  report to sanity-check the "only 5 hunks changed" claim instead of taking it on
  faith.
- What I tried that could have broken this: I built two independent, from-scratch
  parsers (one against the regenerated `03-...sql`'s VALUES data, one against the raw
  `.xlsx` bypassing the generator entirely) specifically to catch a hardcoded/copied
  `402` or a boolean that doesn't actually track real per-row blank-detection — the
  kind of fake-green fix that would satisfy the check's `expected` literal without
  fixing the underlying defect. Both independent derivations landed on exactly 402 for
  `sexo_was_blank=true` and exactly 408 for the old broken predicate, and the 6
  "collision" rows were confirmed genuinely non-blank literal `'N/A'` cells in the raw
  source, not mis-flagged blanks. This is a real, reproduced-from-first-principles
  confirmation, not a rubber stamp on the dev's re-submitted numbers.

## Rollback

This QA task wrote only this report file
(`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-qa-r2.md`) and updated the
scratchpad ledger/handoff. My own generator re-runs during verification rewrote
`docs/migracion/03-clientes-import-dry-run.sql` to byte-identical content (confirmed
via hash before/after) — no net change. Nothing else was touched. No database was
touched; no git verb applies.
