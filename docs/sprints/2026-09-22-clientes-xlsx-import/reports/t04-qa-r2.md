# T4 round 2 — QA report (independent re-verification)

Owner: QA (independent). Scope reviewed: `docs/migracion/generate-clientes-import.py`
(docstring lines 1-26 of the pre-edit file only), `reports/t04-dev-r2.md`, and the dev's
own scratchpad handoff. Everything below was run by QA directly against the live files in
this repo — nothing here is copy-pasted from the dev's report. The absolute prohibition
(never run `04-clientes-import-execute.sql` for real writes — no COMMIT, no BEGIN/ROLLBACK)
was honored throughout; `04` was only regenerated as output and inspected with `grep`/`diff`.

**Verdict: PASS**

## AC1 — docstring corrected, hunks confined to lines 1-26 of the pre-edit file — PASS

Read the live docstring (`docs/migracion/generate-clientes-import.py` lines 1-35, since the
docstring is now 9 lines longer than pre-edit):

```
$ sed -n '1,35p' docs/migracion/generate-clientes-import.py
#!/usr/bin/env python3
"""
generate-clientes-import.py — deterministic generator for the `clientes` XLSX
import artifact set (sprint docs/sprints/2026-09-22-clientes-xlsx-import).
Reads the PINNED workbook (hash-verified below) and emits BOTH
docs/migracion/03-clientes-import-dry-run.sql — a READ-ONLY dry run that
stages all 1,231 mapped rows into a TEMP table and reports every guard,
distribution and backfill-count assertion the plan requires — and
docs/migracion/04-clientes-import-execute.sql — the write-capable execute
script, generated from the SAME `checks` list so both files' pre-write guard
predicates stay byte-identical (the `weak-backstop-guard` invariant). Neither
run of this generator itself writes to any business table — it only emits
SQL text. Python 3 STDLIB ONLY (zipfile + xml.etree) — no openpyxl, no new
dependency. Determinism: no timestamps/usernames/hostnames/absolute paths in
either OUTPUT file; two consecutive runs must be byte-identical for both.
`_jrosa_preserva` (T4, plan §3 statement 1; see PRESERVE_COLUMNS below) is
the 17 live `clientes` columns with no sheet source (T1 Q4's 35 columns
minus the 18 sheet-sourced ones) — a strict superset of the frozen spec's
7-col MUST-PRESERVE floor.

This file is exempted from the normal 500-line ceiling in
.claude/rules/file-size.md, up to 650 lines, for the life of this sprint's
artifacts only — see docs/plans/clientes-xlsx-import-amendment-a.md
(scope-limited, non-precedential).

The sheet-column -> DB-column mapping (plan T2 AC 8) is the MAPPING_TABLE
constant below, rendered verbatim into 03-...sql's header (never silently
dropped). ...
"""
```

Confirmed: the stale "ONLY the dry run" / "T4's job … DEFERRED" language is gone from the
docstring, and it now states the generator emits BOTH `03` and `04` from one `checks` list,
and that `_jrosa_preserva` is the 17 non-sheet columns.

**Stale-phrase sweep, whole file (not just the docstring):**
```
$ grep -n "DEFERRED\|ONLY the dry run" docs/migracion/generate-clientes-import.py
102:    ("(no sheet column)", "estado_registro", "'PERMANENTE' for 1230 rows; NULL for the single staged row id=1185 (sheet JROSA row) — real value DEFERRED to T4's JROSA-preservation merge"),
359:        # columns are capturable" sub-check from plan §5 Q6 is DEFERRED to T4
```
Zero hits for "ONLY the dry run" anywhere. The two remaining `DEFERRED` hits are outside the
docstring (lines 102, 359 — matching the dev's cited "~93 and ~350"), describe an unrelated,
still-true fact (JROSA's real `estado_registro` value, and a distinct Q6 sub-check note), and
are untouched — consistent with the dev's claim.

**Independent reconstruction sanity-check.** The file is untracked (`??`), so there is no git
base to `diff` against, and no other on-disk copy exists (`git log --all -- <path>` returns
nothing; `git stash list` is empty; no other copy of the filename found on disk). QA cannot
independently re-derive the literal pre-edit bytes from a source other than the dev's own
transcript-based reconstruction — this is a genuine, disclosed limitation of untracked-file
review, same class as prior rounds' disclosed limitations. Two independent corroborations were
used instead of trusting the dev's reconstruction outright:
1. **Third-party quote, written *before* this round's edit existed.** The architect's own
   ruling (`docs/plans/clientes-xlsx-import-amendment-a.md` lines 96-98, dated before T4 round 2
   ran) independently quotes the stale docstring: `"this generator produces ONLY the dry run"`
   and `"04 / _jrosa_preserva are T4's job … DEFERRED"`. This is a second, earlier witness to the
   pre-edit content — not the dev's own claim.
2. **Line-count arithmetic, computed independently by QA.** Pre-edit `wc -l` = 635 (matches T4
   round 1's own recorded `wc -l` in `reports/t04-dev.md:423`, a report about a different, prior
   change — good cross-round corroboration). Pre-edit docstring spans lines 1-26 (26 lines) ⇒
   635 − 26 = **609 lines of code below the docstring**. Post-edit: `wc -l` = 644, docstring now
   closes at line 35 (confirmed: `grep -n '^"""$'` → lines 2 and 35) ⇒ 644 − 35 = **609 lines of
   code below the docstring** — identical. This is an independent numeric proof (not reliant on
   the dev's reverse-substitution claim) that exactly the docstring grew (+9 lines) and nothing
   else in the file changed length.
3. **Mutation attack (real, not asserted) — see AC4 below** for a genuine adversarial probe
   proving the docstring's content cannot affect either output file's bytes.

**PASS**, with the disclosed limitation stated above (untracked file, no independently
reproducible byte-for-byte BEFORE copy) carried forward rather than hidden.

## AC2 — docstring cites the amendment path + 650-line ceiling — PASS

```
$ grep -n "clientes-xlsx-import-amendment-a.md\|650" docs/migracion/generate-clientes-import.py
22:.claude/rules/file-size.md, up to 650 lines, for the life of this sprint's
23:artifacts only — see docs/plans/clientes-xlsx-import-amendment-a.md
```
Both the amendment path and the 650-line ceiling are present verbatim. **PASS.**

## AC3 — line count ≤ 650 — PASS

```
$ wc -l docs/migracion/generate-clientes-import.py
     644 docs/migracion/generate-clientes-import.py
```
644 ≤ 650. **PASS.**

## AC4 — hash neutrality, re-proven by QA (two runs) + adversarial mutation test — PASS

Two independent runs against the real repo files:
```
$ python3 docs/migracion/generate-clientes-import.py   # run 1
OK: wrote .../03-clientes-import-dry-run.sql
  output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4
OK: wrote .../04-clientes-import-execute.sql
  execute output sha256: 9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql

$ python3 docs/migracion/generate-clientes-import.py   # run 2
OK: wrote .../03-clientes-import-dry-run.sql
  output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4
OK: wrote .../04-clientes-import-execute.sql
  execute output sha256: 9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
```
Both files hash to exactly the required values (`03` = `...442cc4`, `04` = `...689b1`),
identical across both runs. This matches the pre-edit approved values (t03-r3 for `03`, T4
round 1 for `04`) exactly, so neither is re-opened.

**Adversarial mutation test (attack, not a re-run of the dev's numbers).** In an isolated
scratchpad copy (never touching the repo), QA:
1. Copied the generator + its pinned workbook, injected a sentinel sentence into the live
   docstring text (`... is never used. MUTATION_SENTINEL_QA_ATTACK.\n"""`), re-ran the
   generator — **both output hashes stayed exactly `...442cc4` / `...689b1`**, unchanged.
2. Negative control: in a second isolated copy, mutated an actual data-affecting constant
   (`PAIS_LITERAL = "República Dominicana"` → `"MUTATED_COUNTRY"`), re-ran the generator —
   both hashes **changed** (`03` → `9500cff8...`, `04` → `9794c4f2...`), proving the hash
   check is a real, sensitive guard and not a vacuous one.

This is a genuine attack per the anti-rubber-stamp gate: it does not merely re-run the dev's
claim, it proves by construction that docstring content cannot influence either artifact's
bytes, while confirming the guard would catch a real functional regression. **PASS.**

## AC5 — `weak-backstop-guard` parity, re-proven — PASS

```
$ grep -c "^INSERT INTO _checks" docs/migracion/03-clientes-import-dry-run.sql
42
$ grep -c "^INSERT INTO _checks" docs/migracion/04-clientes-import-execute.sql
42
$ diff <(grep "^INSERT INTO _checks" docs/migracion/03-clientes-import-dry-run.sql) \
       <(grep "^INSERT INTO _checks" docs/migracion/04-clientes-import-execute.sql) && echo IDENTICAL
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
`CREATE TEMP TABLE`/`DROP TABLE IF EXISTS pg_temp.*`, zero hits on the banned-token grep, and
both `pagos` hits are read-only `SELECT count(*)` expressions embedded in check-table `INSERT
... VALUES` clauses — no write to `pagos` anywhere. Also confirmed no ADR-0011/0012 isolation
tokens present (per sprint brief: this sprint creates no table, so no RLS policy is owed —
zero `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER TABLE` hits above, consistent with the
sprint's isolation invariant). Matches the dev's reported numbers exactly. **PASS.**

## AC7 — `npm run qa` actually run by QA — PASS

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
(all react-hooks/exhaustive-deps and @next/next/no-img-element warnings, in app/**/*.tsx —
none touched this round)

> my-v0-project@0.1.0 test
> vitest run
...
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  16:01:26
   Duration  7.23s
$ echo "EXIT: $?"
EXIT: 0
```
Exit code 0, tsc clean, 0 lint errors, 825/825 tests passed — matches the dev's claim exactly,
independently re-run. **PASS.**

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
9 top-level entries, matching the dev's accounting. QA independently checked the one tracked
modification (`CLAUDE.md`, ` M`):
```
$ git diff CLAUDE.md
```
shows a "Project contract" table + a Next.js version-string correction (14.2 vs 15) — content
unrelated to the clientes-import sprint. This matches the git status snapshot recorded at the
**start of this conversation** (identical entries, identical `M CLAUDE.md`), i.e. this
modification predates and is untouched by this round. `generate-clientes-import.py` is
confirmed hand-edited (docstring only, per AC1); `03`/`04` are confirmed regenerated with
byte-identical hashes (AC4); the sprint directory gained only this report + the dev's own
scratchpad handoff (both in scope). No scope creep found. **PASS.**

## AC9 — no PII/credentials/connection strings — PASS

```
$ grep -inE "@[a-z0-9.]+\.(com|net|do)|[0-9]{3}-[0-9]{3}-[0-9]{4}|password|service_role|anon_key|postgres://|supabase\.co" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t04-dev-r2.md
(1 hit: line 239, the report's own AC9 sentence stating no such data is present — not an
actual leaked value)
$ grep -inE same-pattern on the t04-r2 scratchpad handoff span
(no hits)
```
No client name, email, phone, cedula/RNC value, connection string, or key found anywhere in
the dev report or this round's scratchpad addition. **PASS.**

## AC10 — rollback note, prose-only, no git verb — PASS

Dev report text: *"To revert this round's change: restore lines 1-26 of
`docs/migracion/generate-clientes-import.py` to the 'BEFORE' text shown on the left-hand (`-`)
side of the diff pasted in AC1 above, then re-run `python3 docs/migracion/generate-clientes-
import.py` and re-confirm both `03` hashes to ... and `04` hashes to ...."*

```
$ grep -inE "checkout|reset --hard|clean -f|stash drop|force-push|git rm" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t04-dev-r2.md
(no hits)
```
The word "revert" is used as plain English ("to revert this round's change: restore lines...")
describing a manual text restoration + re-run, not an invocation of `git revert` or any other
destructive git command. No banned destructive-git-verb pattern
(`checkout`/`reset --hard`/`clean -fd`/`stash drop`/force-push) appears. **PASS.**

## Absolute prohibition check — honored

```
$ grep -inE "BEGIN;|COMMIT;|psql.*04-clientes|pg\..*04-clientes-import-execute" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t04-dev-r2.md
(no hits)
```
No evidence anywhere this round that `04` was executed for real writes (no `BEGIN`, no
`COMMIT`, no transaction against it). QA itself only regenerated `04` as output and inspected
it with `grep`/`diff` — never opened a DB connection this round. Round 1's live guard run
(accepted, not re-litigated) is the only live execution on record for this artifact chain.

## Attack Log (per elibry-adversarial-qa)

- RLS / org isolation: N/A for this specific docstring-only edit (no schema/table change; the
  sprint's own binding invariant, ADR 0011, is that Elibry has no RLS anywhere and this sprint
  creates no table). Re-confirmed by grep that no `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER
  TABLE` token appears in the regenerated `04` (AC6).
- Optimistic UI: N/A — no UI code touched this round (pure docs/tooling change).
- Realtime: N/A — no realtime subscriber code touched.
- Edge cases tried: (1) mutated the docstring content in an isolated copy to see if it leaks
  into either output file's bytes — it does not (hashes unchanged); (2) mutated a real,
  output-affecting constant in a second isolated copy as a negative control — hashes DID
  change, proving the guard is real, not vacuous; (3) grepped the entire generator file (not
  just lines 1-26) for the two stale phrases to catch any missed leftover instance; (4)
  independently re-derived the pre-edit/post-edit code-length invariant via line arithmetic
  instead of trusting the dev's reverse-substitution reconstruction; (5) diffed `CLAUDE.md`'s
  pre-existing tracked modification to confirm it's unrelated content, not silently-expanded
  scope.
- What I tried that could have broken this: ran a real adversarial mutation (docstring-only,
  then a data-affecting negative control) against an isolated copy of the generator to test
  whether the "hash neutrality" claim actually holds by construction rather than by luck — it
  held, and the negative control confirms the hash check would have caught a real regression.
  Combined with independently re-running every AC's commands from scratch (not reusing the
  dev's pasted output) and cross-checking AC1's reconstruction against a source written before
  this round (the architect's ruling) plus independent line-count arithmetic, this is more than
  "the dev's tests passed."

## Fake-green-tests check

No mutable-mock or indirect-assertion anti-pattern applies here — this task has no unit test
file in scope; the "test" is the deterministic byte-for-byte output of a generator script,
verified by re-running it (not by reading a test assertion). The adversarial mutation test
above is the mutation-check equivalent for this artifact class: reverting/mutating the fix
(the docstring) and confirming the thing being guaranteed (hash neutrality) genuinely still
holds, and that a real functional change would have been caught.

## Summary

All 10 acceptance criteria independently re-verified PASS by QA, using fresh commands run
against the real repository files (not the dev's pasted output). One disclosed, unavoidable
limitation carried forward: the file is untracked with no git history, so the literal pre-edit
byte content cannot be independently re-derived from git — QA corroborated the dev's
reconstruction instead via (a) a third-party quote of the stale text pre-dating this round
(the architect's ruling), (b) independent line-count arithmetic proving only the docstring
grew, and (c) a real adversarial mutation test proving the docstring cannot affect either
output file's bytes, with a negative control proving the hash check is a real guard. No
scope creep found beyond the three declared files (plus regenerated, byte-identical `03`/`04`
output). No PII/credentials found. Rollback note is prose-only with no destructive git verb.
The absolute prohibition on executing `04` for real writes was honored throughout, by both
the dev and this QA pass.

**Verdict: PASS**
