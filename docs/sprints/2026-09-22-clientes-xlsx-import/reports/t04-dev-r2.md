# T4 round 2 — dev report (docstring fix under amendment A)

Owner: senior-dev. Ruling followed verbatim: `docs/plans/clientes-xlsx-import-amendment-a.md`,
section "T4 round 2 — closing instructions". Files touched — exactly three, none outside scope:
`docs/migracion/generate-clientes-import.py` (lines 1-26 only), this report, and the sprint
scratchpad (own row + own new handoff). `docs/migracion/03-clientes-import-dry-run.sql` and
`docs/migracion/04-clientes-import-execute.sql` were regenerated as OUTPUT (never hand-edited);
`04` was never executed (no BEGIN, no COMMIT, nothing) — the round-1 absolute prohibition holds.

## AC1 — docstring corrected, hunks confined to lines 1-26 of the pre-edit file — PASS

The repo file is untracked (`??` in `git status --short`), so there is no git-tracked base to
`diff` against. I reconstructed the exact pre-edit file deterministically: I captured the literal
`old_string`/`new_string` passed to the edit tool and replayed the substitution against the
current on-disk file in reverse (string-level, not regenerated from memory), which by
construction guarantees byte-identical content everywhere except the substituted span. The
reconstruction produced a file of exactly **635 lines** — matching the pre-edit `wc -l` recorded
in round 1's report and in this round's own pre-edit check below — corroborating the
reconstruction is faithful.

Pre-edit `wc -l` (recorded before any edit this round):
```
     635 docs/migracion/generate-clientes-import.py
```

`diff -u` of the reconstructed BEFORE file against the current on-disk AFTER file:
```
--- generate-clientes-import.BEFORE.py
+++ docs/migracion/generate-clientes-import.py
@@ -2,17 +2,26 @@
 """
 generate-clientes-import.py — deterministic generator for the `clientes` XLSX
 import artifact set (sprint docs/sprints/2026-09-22-clientes-xlsx-import).
-Reads the PINNED workbook (hash-verified below) and emits
+Reads the PINNED workbook (hash-verified below) and emits BOTH
 docs/migracion/03-clientes-import-dry-run.sql — a READ-ONLY dry run that
 stages all 1,231 mapped rows into a TEMP table and reports every guard,
-distribution and backfill-count assertion the plan requires. Writes no
-business table. Python 3 STDLIB ONLY (zipfile + xml.etree) — no openpyxl, no
-new dependency. Determinism: no timestamps/usernames/hostnames/absolute
-paths in the OUTPUT file; two consecutive runs must be byte-identical.
-Scope note (T2, docs/plans/clientes-xlsx-import.md): this generator produces
-ONLY the dry run. The execute script (04-...sql) and its `_jrosa_preserva`
-capture of JROSA's non-sheet columns are T4's job — see the "DEFERRED" note
-in SECTION Q6 below.
+distribution and backfill-count assertion the plan requires — and
+docs/migracion/04-clientes-import-execute.sql — the write-capable execute
+script, generated from the SAME `checks` list so both files' pre-write guard
+predicates stay byte-identical (the `weak-backstop-guard` invariant). Neither
+run of this generator itself writes to any business table — it only emits
+SQL text. Python 3 STDLIB ONLY (zipfile + xml.etree) — no openpyxl, no new
+dependency. Determinism: no timestamps/usernames/hostnames/absolute paths in
+either OUTPUT file; two consecutive runs must be byte-identical for both.
+`_jrosa_preserva` (T4, plan §3 statement 1; see PRESERVE_COLUMNS below) is
+the 17 live `clientes` columns with no sheet source (T1 Q4's 35 columns
+minus the 18 sheet-sourced ones) — a strict superset of the frozen spec's
+7-col MUST-PRESERVE floor.
+
+This file is exempted from the normal 500-line ceiling in
+.claude/rules/file-size.md, up to 650 lines, for the life of this sprint's
+artifacts only — see docs/plans/clientes-xlsx-import-amendment-a.md
+(scope-limited, non-precedential).
 
 The sheet-column -> DB-column mapping (plan T2 AC 8) is the MAPPING_TABLE
 constant below, rendered verbatim into 03-...sql's header (never silently
```

The hunk header (`@@ -2,17 +2,26 @@`) spans old lines 2-18, entirely inside the required 1-26
window (line 1 is the shebang, line 26 is the docstring's closing `"""` in the pre-edit file —
neither is touched). To further corroborate no line past the old line 26 moved or changed
content, I diffed the reconstructed BEFORE file's tail (from its line 27) against the current
file's tail (from its new line 36, i.e. the first line after the now-longer docstring):

```
$ diff <(tail -n +27 BEFORE.py) <(tail -n +36 generate-clientes-import.py) && echo "IDENTICAL tail content (post-docstring code untouched)"
IDENTICAL tail content (post-docstring code untouched)
```

The stale "ONLY the dry run" / "DEFERRED to T4" sentences are gone from the docstring. The two
false claims named in the ruling no longer appear in lines 1-26 (confirmed no `DEFERRED` or
"ONLY the dry run" string remains in that span — the only other `DEFERRED` mentions in the file
are at lines ~93 and ~350, both outside the 1-26 window, both describing an unrelated, still-true
fact — the JROSA row's `estado_registro` real value and a distinct Q6 sub-check note — and are
out of this round's scope, untouched).

**Verdict: PASS.**

## AC2 — docstring cites the amendment by path and states the 650-line ceiling — PASS

New docstring text (see diff above) reads: "This file is exempted from the normal 500-line
ceiling in `.claude/rules/file-size.md`, up to 650 lines, for the life of this sprint's artifacts
only — see `docs/plans/clientes-xlsx-import-amendment-a.md` (scope-limited, non-precedential)."
Both the path and the numeric ceiling are present verbatim. **PASS.**

## AC3 — line count ≤ 650 — PASS

```
$ wc -l docs/migracion/generate-clientes-import.py
     644 docs/migracion/generate-clientes-import.py
```

644 ≤ 650. **PASS.**

## AC4 — hash neutrality, re-proven (two runs, both files) — PASS

```
$ python3 docs/migracion/generate-clientes-import.py   # run 1
OK: wrote .../03-clientes-import-dry-run.sql
  ... output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4
OK: wrote .../04-clientes-import-execute.sql
  ... execute output sha256: 9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1

$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql

$ python3 docs/migracion/generate-clientes-import.py   # run 2
OK: wrote .../03-clientes-import-dry-run.sql
  ... output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4
OK: wrote .../04-clientes-import-execute.sql
  ... execute output sha256: 9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1

$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
```

`03` matches the required `a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4`
exactly (unchanged from T2-r4/T3-r3 approval — t03 is NOT re-opened). `04` matches the required
`9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1` exactly, identical across both
runs. **PASS.**

## AC5 — `weak-backstop-guard` parity, re-proven — PASS

```
$ grep -c "^INSERT INTO _checks" docs/migracion/03-clientes-import-dry-run.sql
42
$ grep -c "^INSERT INTO _checks" docs/migracion/04-clientes-import-execute.sql
42
$ diff <(grep "^INSERT INTO _checks" docs/migracion/03-clientes-import-dry-run.sql) \
       <(grep "^INSERT INTO _checks" docs/migracion/04-clientes-import-execute.sql) && echo "IDENTICAL"
IDENTICAL
```

42/42, IDENTICAL. **PASS.**

## AC6 — statement inventory on regenerated `04` — PASS

```
$ grep -c "^INSERT INTO clientes" docs/migracion/04-clientes-import-execute.sql
3
$ grep -n "^UPDATE " docs/migracion/04-clientes-import-execute.sql
1313:UPDATE reservas SET cliente_id = 1185 WHERE id = 10;
$ grep -n "^DELETE " docs/migracion/04-clientes-import-execute.sql
1316:DELETE FROM clientes WHERE id = 15;
$ grep -n "^CREATE \|^DROP " docs/migracion/04-clientes-import-execute.sql
10:DROP TABLE IF EXISTS pg_temp._clientes_import;
11:CREATE TEMP TABLE _clientes_import (
1251:DROP TABLE IF EXISTS pg_temp._checks;
1252:CREATE TEMP TABLE _checks (name text, expected text, actual text);
1299:DROP TABLE IF EXISTS pg_temp._jrosa_preserva;
1300:CREATE TEMP TABLE _jrosa_preserva AS SELECT ... FROM clientes WHERE id = 15;
1325:DROP TABLE IF EXISTS pg_temp._post_checks;
1326:CREATE TEMP TABLE _post_checks (name text, expected text, actual text);
$ grep -icE "alter table|create policy|row level security|grant |revoke |create role|comprobante|balance_" docs/migracion/04-clientes-import-execute.sql
0
$ grep -n "pagos" docs/migracion/04-clientes-import-execute.sql
1259:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
1356:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_pagos_ref_15_unchanged_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
```

Exactly 3 `INSERT INTO clientes`, 1 `UPDATE` (real table), 1 `DELETE`, all DDL confined to
`CREATE TEMP TABLE` / `DROP TABLE IF EXISTS pg_temp.*`, zero hits on the banned-token grep, and
both `pagos` hits are read-only `SELECT count(*) ... FROM pagos` expressions embedded inside
`INSERT INTO _checks`/`_post_checks` VALUES clauses — no write to `pagos` anywhere. Identical
shape to round 1's inventory (unsurprising: the edit never touched code, only the docstring).
**PASS.**

## AC7 — `npm run qa` actually run — PASS

```
$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit
(clean, no output)

> my-v0-project@0.1.0 lint
> eslint .
✖ 28 problems (0 errors, 28 warnings)
(all 28 are pre-existing react-hooks/exhaustive-deps and @next/next/no-img-element warnings in
app/**/*.tsx and components/**/*.tsx — none touched this round; 0 errors)

> my-v0-project@0.1.0 test
> vitest run
...
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  15:56:04
   Duration  7.99s
```

Full raw output captured; exit code 0. **PASS.**

## AC8 — file scope, N of M against `git status --short` — PASS

```
$ git status --short
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import-amendment-a.md
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```

M = 9 top-level entries. This round hand-edited **1 of 9** (`docs/migracion/generate-clientes-import.py`,
lines 1-26 only). Two more of the 9 (`03-clientes-import-dry-run.sql`, `04-clientes-import-execute.sql`)
were regenerated as output by running the edited generator — their bytes are unchanged (hashes
match the pre-edit approved values, AC4) so there is no functional diff in them. One more of the 9
(`docs/sprints/2026-09-22-clientes-xlsx-import/`) gained this report plus this round's scratchpad
edits, both within this round's declared scope. The remaining 5 entries
(`CLAUDE.md`, `.DS_Store`, `.claude/rules/context-budget.md`, `docs/migracion-clientes.xlsx`,
`docs/plans/clientes-xlsx-import.md`) predate this round and were **not touched** by this task.
`git diff` is not used anywhere in this accounting (every path here is untracked `??` per
`git-diff-scope-excludes-untracked-files`), except `CLAUDE.md` which is pre-existing tracked
modification from before this task and is unrelated/untouched. **PASS.**

## AC9 — no PII/credentials/connection strings — PASS

This report, the diff pasted above, and the scratchpad handoff contain only: file paths, line
numbers, SQL keyword counts, sha256 hex digests, and column/table names. No client name, email,
phone, cedula/RNC value, connection string, or key appears anywhere above. **PASS.**

## AC10 — rollback note (no git verb) — PASS

To revert this round's change: restore lines 1-26 of `docs/migracion/generate-clientes-import.py`
to the "BEFORE" text shown on the left-hand (`-`) side of the diff pasted in AC1 above, then
re-run `python3 docs/migracion/generate-clientes-import.py` and re-confirm both `03` hashes to
`a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4` and `04` hashes to
`9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1`.

## Summary

All 10 acceptance criteria PASS. Docstring is corrected, confined to lines 1-26, cites the
amendment and the 650-line ceiling; file is 644 lines (≤650); both output hashes are unchanged
and reproduced twice; guard parity is 42/42 IDENTICAL; the `04` statement inventory matches round
1's mechanical shape exactly; `npm run qa` is green (825/825 tests, 0 lint errors); file scope is
accounted for 1-of-9 against `git status --short`; no PII/secrets present; rollback stated without
a git verb. Round 1's accepted evidence (mechanical inventory reasoning, determinism methodology,
the live 42/42 read-only guard run, `EXPLAIN`-only validation, and the disclosed limitation that
post-check *values* can only be proven by actually running `04`, which remains prohibited) is not
re-litigated or contradicted here.

**Status: DONE.**
