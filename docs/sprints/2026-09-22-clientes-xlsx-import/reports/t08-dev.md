# T8 — Sprint-wide artifact audit (round 1)

**Date:** 2026-09-23
**Task:** T8 (senior) — whole-sprint consistency audit, read-only apart from this report + own scratchpad handoff
**Scope:** `reports/t08-dev.md` only (plus own `scratchpad.md` §1/§2 entries). No SQL, generator, runbook, plan, or amendment file edited. `04` was never run, not even in `BEGIN`/`ROLLBACK`.

---

## 1. Artifact hashes still current

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
```

Both hashes match the required values **exactly**. No loud fail.

## 2. Regenerate-and-compare (determinism re-proven at sprint end, not carried over)

Ran the generator twice into two isolated scratch directories outside the repo (each with its own copy of the pinned `docs/migracion-clientes.xlsx` and `generate-clientes-import.py`, preserving the script's relative-path assumptions), never touching the committed files:

```
$ cd <scratch>/run1 && python3 docs/migracion/generate-clientes-import.py
OK: wrote .../run1/docs/migracion/03-clientes-import-dry-run.sql
  ... payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
  ... output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4
OK: wrote .../run1/docs/migracion/04-clientes-import-execute.sql
  guard checks: 42, post-checks: 33
  execute output sha256: 9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1

$ cd <scratch>/run2 && python3 docs/migracion/generate-clientes-import.py
(identical output, identical hashes)
```

```
$ diff run1/03 run2/03 && echo "03 IDENTICAL run1/run2"
03 IDENTICAL run1/run2
$ diff run1/04 run2/04 && echo "04 IDENTICAL run1/run2"
04 IDENTICAL run1/run2
$ diff run1/03 docs/migracion/03-clientes-import-dry-run.sql && echo "03 IDENTICAL scratch-vs-committed"
03 IDENTICAL scratch-vs-committed
$ diff run1/04 docs/migracion/04-clientes-import-execute.sql && echo "04 IDENTICAL scratch-vs-committed"
04 IDENTICAL scratch-vs-committed
$ git status --short   # after both regen runs — proves committed files untouched
 M CLAUDE.md
 M docs/migracion/README-cleanup.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql
?? docs/migracion/README-clientes-import.md
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import-amendment-a.md
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```

**Determinism holds now, at sprint end, run fresh (not reused from any prior report).** Both scratch runs are byte-identical to each other and to the committed files; the committed files are provably untouched by the regen.

## 3. Amendment is real and scope-locked

- `docs/plans/clientes-xlsx-import-amendment-a.md` exists (read in full).
- `$ wc -l docs/migracion/generate-clientes-import.py` → **644** (≤650 ceiling holds).
- Docstring citation, grepped live:
  ```
  22:.claude/rules/file-size.md, up to 650 lines, for the life of this sprint's
  23:artifacts only — see docs/plans/clientes-xlsx-import-amendment-a.md
  24:(scope-limited, non-precedential).
  ```
- Amendment's own exemption-scope language, quoted exactly:
  > "## Exemption scope — deliberately narrow, non-precedential
  > This exemption covers **exactly one path**: `docs/migracion/generate-clientes-import.py`, at **≤650 lines**, for the life of the `2026-09-22-clientes-xlsx-import` sprint and its artifacts."
  Scoped to exactly one path, non-precedential — confirmed verbatim, not paraphrased.

## 4. File-size compliance

```
$ wc -l docs/migracion/generate-clientes-import.py docs/migracion/README-clientes-import.md docs/migracion/README-cleanup.md .claude/rules/file-size.md docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
     644 docs/migracion/generate-clientes-import.py
     300 docs/migracion/README-clientes-import.md
     311 docs/migracion/README-cleanup.md
      12 .claude/rules/file-size.md
    1384 docs/migracion/03-clientes-import-dry-run.sql
    1363 docs/migracion/04-clientes-import-execute.sql
```

- generator: 644 ≤ 650 (amendment A exemption) — PASS.
- `README-clientes-import.md`: 300 ≤ 300 ceiling — PASS, at the line.
- `README-cleanup.md`: 311 lines. `git diff --stat` shows `+15/-10`, `git diff ... | grep -c '^@@'` = **2** hunks, matching t07's own description exactly (full diff pasted below, item 12/9 evidence reused). No unexplained length drift.
  ```
  $ git diff --stat docs/migracion/README-cleanup.md
   docs/migracion/README-cleanup.md | 25 +++++++++++++++----------
   1 file changed, 15 insertions(+), 10 deletions(-)
  $ git diff docs/migracion/README-cleanup.md | grep -c '^@@'
  2
  ```
- The two generated `.sql` files (1384, 1363 lines) are the only files over 500, both covered by the pre-approved plan §2 exemption (never hand-edited, generated output).
- `.claude/rules/file-size.md`: **byte-unchanged this sprint.**
  ```
  $ git status --short -- .claude/rules/file-size.md   (no output — clean)
  $ git diff -- .claude/rules/file-size.md              (no output — empty diff)
  $ git log -1 --format=%H -- .claude/rules/file-size.md
  32e892bfccf80c6d015e051ae8017323488999ba
  ```

## 5. weak-backstop-guard parity, re-proven at sprint end

```
$ grep -c "^INSERT INTO _checks" docs/migracion/03-clientes-import-dry-run.sql
42
$ grep -c "^INSERT INTO _checks" docs/migracion/04-clientes-import-execute.sql
42
$ diff <(grep -n "^INSERT INTO _checks" 03...sql | sed 's/^[0-9]*://') <(grep -n "^INSERT INTO _checks" 04...sql | sed 's/^[0-9]*://')
(no output)
42/42 IDENTICAL
```

## 6. Statement inventory on 04, re-proven

```
$ grep -c "^INSERT INTO clientes" docs/migracion/04-clientes-import-execute.sql
3
$ grep -cE "^UPDATE " docs/migracion/04-clientes-import-execute.sql
1
$ grep -cE "^DELETE " docs/migracion/04-clientes-import-execute.sql
1
$ grep -nE "^UPDATE |^DELETE " docs/migracion/04-clientes-import-execute.sql
1313:UPDATE reservas SET cliente_id = 1185 WHERE id = 10;
1316:DELETE FROM clientes WHERE id = 15;
$ grep -nE "^CREATE |^DROP " docs/migracion/04-clientes-import-execute.sql
10:DROP TABLE IF EXISTS pg_temp._clientes_import;
11:CREATE TEMP TABLE _clientes_import (
1251:DROP TABLE IF EXISTS pg_temp._checks;
1252:CREATE TEMP TABLE _checks (name text, expected text, actual text);
1299:DROP TABLE IF EXISTS pg_temp._jrosa_preserva;
1300:CREATE TEMP TABLE _jrosa_preserva AS SELECT ... FROM clientes WHERE id = 15;
1325:DROP TABLE IF EXISTS pg_temp._post_checks;
1326:CREATE TEMP TABLE _post_checks (name text, expected text, actual text);
```
DDL confined to `pg_temp`/TEMP-table constructs only — zero permanent DDL.

```
$ for tok in "ALTER TABLE" "CREATE POLICY" "ROW LEVEL SECURITY" "GRANT" "REVOKE" "CREATE ROLE" "comprobante" "balance_" "monto_pagado" "abonado_contabilidad"; do echo "$tok: $(grep -ci "$tok" docs/migracion/04-clientes-import-execute.sql)"; done
ALTER TABLE: 0
CREATE POLICY: 0
ROW LEVEL SECURITY: 0
GRANT: 1
REVOKE: 0
CREATE ROLE: 0
comprobante: 0
balance_: 0
monto_pagado: 0
abonado_contabilidad: 0
```
The one case-insensitive `GRANT` hit is a false positive from client payload data, not a SQL statement:
```
$ grep -ni "grant" docs/migracion/04-clientes-import-execute.sql
505:  (488, 'NORMAL', 'MARCA 1', ..., 'A06341164', 'KARLA ROSANGELES GRANT', 'FEMENINO', ...
$ grep -n "^GRANT \|^REVOKE \| GRANT \| REVOKE " docs/migracion/04-clientes-import-execute.sql
(no output, exit 1)
```
Confirmed: zero actual `GRANT`/`REVOKE` SQL statements.

```
$ grep -ni "pagos" docs/migracion/04-clientes-import-execute.sql
1259:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
1356:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_pagos_ref_15_unchanged_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
```
Both `pagos` references are read-only guard `SELECT`s — no write to `pagos` anywhere.

```
$ grep -c "RAISE EXCEPTION" docs/migracion/04-clientes-import-execute.sql
3
$ grep -n "RAISE EXCEPTION" docs/migracion/04-clientes-import-execute.sql
1296:  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
1302:  RAISE EXCEPTION 'ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.', ...; END IF; END $$;
1361:  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.', v; END IF; END $$;
```
Exactly 3 `RAISE EXCEPTION` sites — matches every prior report's citation (1296/1302/1361) and the runbook's own citation (item 11 below).

## 7. Isolation posture unchanged (ADR 0011)

```
$ grep -ni "CREATE TABLE\|CREATE SCHEMA\|ALTER TABLE\|CREATE POLICY\|ROW LEVEL SECURITY\|ENABLE ROW LEVEL" docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
(no output — 0 hits in either file)
$ grep -n "CREATE TABLE" docs/migracion/0{3,4}-*.sql | grep -v TEMP
(no output)
```
Neither file creates a permanent table, schema, or column in `public` — only `pg_temp` TEMP tables (item 6). Per ADR 0011 (single-tenant, no RLS on the ~29 pre-existing tables), no new table means **no RLS policy is owed**; none was added. Isolation posture is unchanged.

## 8. Live state untouched by this sprint

Supabase is reachable (not a 521 this session). `psql` was already installed from T5's `brew install libpq` action; located and used directly (no re-install needed):

```
$ export PATH="/opt/homebrew/Cellar/libpq/18.6/bin:$PATH"
$ PGURL=$(grep '^POSTGRES_URL_NON_POOLING=' .env.local | cut -d '=' -f2-)
$ psql "$PGURL" -X -c "SELECT count(*) AS clientes_count, max(id) AS clientes_max_id FROM clientes;"
 clientes_count | clientes_max_id
----------------+-----------------
              1 |              15
(1 row)

$ psql "$PGURL" -X -c "SELECT count(*) AS total_reservas FROM reservas;"
 total_reservas
----------------
              1
(1 row)

$ psql "$PGURL" -X -c "SELECT id, cliente_id FROM reservas;"
 id | cliente_id
----+------------
 10 |         15
(1 row)

$ psql "$PGURL" -X -c "SELECT count(*) AS pagos_count FROM pagos;"
 pagos_count
-------------
           0
(1 row)
```
`clientes` count=1/max(id)=15; `reservas` total count=1, its one row is `id=10, cliente_id=15`; `pagos` empty — **exactly the baseline every prior task (T1/T2-r4/T3-r3/T5) recorded.** Live state is untouched by this sprint. No 521 encountered; no human hand-off needed this round. `04` was not run — not with `COMMIT`, not in `BEGIN`/`ROLLBACK`.

## 9. Scope, N of M against `git status --short`

```
$ git status --short
 M CLAUDE.md
 M docs/migracion/README-cleanup.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql
?? docs/migracion/README-clientes-import.md
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import-amendment-a.md
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```
**12 top-level entries** (2 tracked-`M`, 10 untracked-`??`, one of which — `docs/sprints/2026-09-22-clientes-xlsx-import/` — is a directory containing all 47 report files + the scratchpad, enumerated separately below via `find`). This is 12 of 12 — full enumeration, not a `git diff` sample (`git-diff-scope-excludes-untracked-files` honored).

- `M CLAUDE.md`: confirmed via `git diff CLAUDE.md` to be the "Project contract" scaffold block (brain slug, stack, QA gate, sprint-loop table) — unrelated to T1–T8's clientes-import content. Matches the task brief's own framing exactly.
- `M docs/migracion/README-cleanup.md`: T7's 2-hunk edit (item 4/12).
- `?? .claude/rules/context-budget.md`: content is the token-discipline rule referenced throughout this sprint's scratchpad. **Confirmed pre-existing, not created by T1–T8**: its mtime (`Sep 22 09:31:55`) predates the plan file (`Sep 22 09:50:18`) and T1's own dev report (`Sep 22 10:32:16`) — it existed before this sprint's plan was even written. Not touched by any task in this sprint.
- `?? .DS_Store`: macOS Finder artifact, mtime `Sep 22 09:22:07` — also predates the plan file. Unrelated noise, not sprint work, not touched by any task.
- All remaining `??` entries (`docs/migracion-clientes.xlsx`, `03`/`04`/.py/README-clientes-import.md, both plan/amendment files, the sprint dir) are this sprint's actual deliverables, all under `docs/`.

Confirmed **nothing under `app/`, `lib/`, `components/`, `hooks/`, `tests/`, `scripts/`, or `MEMORY/`** appears anywhere in `git status --short` — zero entries under any of those paths.

## 10. PII/credential sweep — **LOUD FINDING, not clean**

### Credentials/connection strings — clean

```
$ grep -rnHiE "eyJ[A-Za-z0-9_-]{10,}|postgres(ql)?://[^ ]*:[^ ]*@|service_role|SUPABASE_SERVICE" <all 51 sprint files>
(only self-referential hits: grep-command text being echoed as evidence in QA reports, and two placeholder templates in README-cleanup.md: `postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require` — a template, not a real value)
```
No real key, connection string, host, or password anywhere.

### Client PII — **not clean**

Real client email addresses copied verbatim from the payload appear in QA reports, outside the two `.sql` files. **Redacted here deliberately — repeating the leaked PII in this report would compound the very violation being flagged; the file:line citations below are sufficient for the lead to independently open and confirm each hit:**

```
$ grep -nHoiE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" <51 files> | grep -viE "name@domain\.tld|example\.com|anthropic\.com|cepedaabiel@gmail\.com"
docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-qa-r2.md:150-151  (3 real client email addresses, comma-separated, quoted as "verbatim preservation" evidence for one row's multi-address cell)
docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-qa-r3.md:66,68   (4 real client email addresses, quoted as spot-check examples of "genuinely malformed" dirty-email rows)
```

Real client `identificacion` (cedula/RNC) numbers copied verbatim from the payload (the two values already used sprint-wide as the "duplicate identificacion" example pair) appear across **eleven** report files — **also redacted here for the same reason, file:line is sufficient**:

```
$ grep -l "<the two duplicate-identificacion values>" docs/sprints/2026-09-22-clientes-xlsx-import/reports/*.md
reports/t01-dev.md        (lines 313, 396 — the original T1 disclosure)
reports/t01-qa.md
reports/t02-dev.md
reports/t02-dev-r2.md
reports/t02-dev-r3.md
reports/t02-dev-r4.md
reports/t02-qa.md
reports/t02-qa-r2.md
reports/t02-qa-r4.md
reports/t03-dev-r3.md
reports/t03-qa-r3.md
```

This traces to **T1**, the very first task in the sprint (dev report timestamped before any QA/lead review existed), and was then repeated as corroborating evidence by nearly every subsequent T2/T3 dev and QA report re-verifying the duplicate-`identificacion` fact. **Twelve report files total** (the 11 above plus `t06-qa-r3.md` for the email leak) contain real client PII copied out of the payload.

This is a genuine, sprint-wide violation of the `redaction-discipline` mistake note ("no client PII... in any report, the scratchpad, or the CBrain vault. The payload SQL holds PII by necessity; it stays in the repo and is never quoted out of it.") — present since T1 and never caught, because every prior task's own PII sweep grepped only for email-shaped strings, connection strings, and keys — **never for bare numeric `identificacion`/cedula values**, which is exactly the class that leaked.

**Confirmed confined to `reports/*.md` only** — the scratchpad, both runbooks, the plan, and the amendment are clean:
```
$ grep -n "<the two identificacion values>|<the leaked email domains>" docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md docs/migracion/README-clientes-import.md docs/migracion/README-cleanup.md docs/plans/clientes-xlsx-import.md docs/plans/clientes-xlsx-import-amendment-a.md
(no output in any of the five files)
```
So the leak is real but bounded: it never reached the scratchpad, the runbooks, the plan, or the amendment — only 12 of 47 `reports/*.md` files. It did not reach the CBrain vault (out of this audit's file set, not checked here — flagged below as a backlog item, not actioned).

**This is not something T8 can fix** (scope is read-only apart from this report). Reporting it prominently as required; recommend the lead open a follow-up scoped redaction task against the 12 named files.

## 11. Runbook accuracy spot-check

```
$ grep -n "1296\|1302\|1361\|BEGIN\|COMMIT" docs/migracion/README-clientes-import.md
166:The whole file is one transaction: it opens with `BEGIN;` (line 7) and closes with
167:`COMMIT;` (line 1363). ...
177:`RAISE EXCEPTION` statements in the whole file — grep-confirmed, cited by line below):
179:1. **Line 1296** — `ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.`
184:2. **Line 1302** — `ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.`
189:3. **Line 1361** — `ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.`
```
Cross-checked against item 6's live grep of `04`: `BEGIN`/`COMMIT` lines and all three `RAISE EXCEPTION` texts match **verbatim, line-for-line**.

Email figures (45 / 599 / 0 / 644), re-read live from the runbook:
```
$ sed -n '267,272p' docs/migracion/README-clientes-import.md
- **Some imported email addresses are not well-formed; this import does not clean them
  up.** 45 rows fail the `name@domain.tld` shape (`Q5_dirty_email_count`); 599 have
  `email = 'N/A'` (`Q4_backfill_email_599`; 0 empty); combined: 644 (45+599) — a sum,
  not a check value. ...
```
Matches this task's own T6-r3 resolution exactly: 45 fails traced to `Q5_dirty_email_count`, 599 to `Q4_backfill_email_599`, 0 stated as explicit (not a separate check — a mapping-rule fact), 644 stated as an explicit prose sum, not a fabricated check value. Independently re-confirmed against the regenerated (item 2) generator's own stdout this round: `dirty email count: 45`, `backfill counts: {'email': 599, ...}` — both figures reproduced from a fresh run, not copied from any prior report.

## 12. Destructive-verb sweep

```
$ grep -rniE <the five-verb banned-substring pattern used throughout this sprint's own QA reports> <51 sprint files>
```
Hits fall into exactly two categories, both non-live:

1. **Grep-pattern/command echoes** — QA/lead reports pasting their own verification command line (which necessarily contains the search pattern itself) as evidence that the check was run. This is a search pattern, not a rollback instruction.
2. **Historical "Before" quotations** — `reports/t07-lead.md`, `t07-qa.md`, `t07-dev-r2.md`, `t07-qa-r2.md` quote the now-superseded round-1 text of `reports/t07-dev.md` verbatim, to document what was fixed and why (a correction record, not new guidance). The scratchpad's §0 brief and the plan itself (`docs/plans/clientes-xlsx-import.md:516`) state the mechanical rule and its own grep pattern as documentation of the invariant, not as an instruction to run any of those verbs.

**Zero live instances** of a rollback note or instruction *recommending* a destructive verb as future guidance. In particular, `reports/t07-dev.md` — the one file that failed on this exact defect in round 1 — is confirmed clean now via the same pattern, applied to that file alone: 0 hits (exit 1).

This matches the reasoning already adjudicated and approved in `reports/t07-lead-r2.md` (the "historical quote / grep-pattern-echo is not the same defect class as a prescriptive rollback note" distinction) — not re-litigated here, only re-confirmed still holds.

**This report's own rollback note (§ Rollback below) is read-only prose and contains no destructive git verb, negated or otherwise** — checked by rereading it before submission.

## 13. `npm run qa`

```
$ npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit

(clean, no output — 0 errors)

> my-v0-project@0.1.0 lint
> eslint .

... (28 pre-existing react-hooks/exhaustive-deps and @next/next/no-img-element warnings, same files as every prior round: app/clientes/balance-reserva/page.tsx, app/clientes/editar/page.tsx, app/clientes/ver/page.tsx, app/crm/casos/page.tsx, app/facturacion/fiscal/page.tsx, app/facturacion/voucher/page.tsx, app/page.tsx, app/pagos/page.tsx, app/pagos/ver/page.tsx, app/productos/editar/page.tsx, app/productos/registrar/page.tsx, app/productos/ver/page.tsx, app/reservas/pendientes/page.tsx, app/reservas/seguimiento/page.tsx, and others)
✖ 28 problems (0 errors, 28 warnings)

> my-v0-project@0.1.0 test
> vitest run

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  14:07:36
   Duration  1.96s (transform 1.05s, setup 1.73s, collect 1.96s, tests 531ms, environment 4ms, prepare 2.34s)

$ echo $?
0
```
Exit 0. tsc clean, 0 lint errors (28 pre-existing warnings, unrelated files, unchanged since T1), 825/825 tests passing — identical to every prior task's baseline this sprint.

---

## State of the artifact — blunt summary

**PROVEN, with fresh evidence this round:**
- `03` and `04` hash to the required, unchanged values (item 1).
- The generator is deterministic **right now**, at sprint close, not just when T2 closed: two independent scratch regenerations this round are byte-identical to each other and to the committed files (item 2).
- The `04` generator amendment (A) is real, the generator is within its 650-line exemption, cites the amendment, and the exemption text is scoped to exactly one path and marked non-precedential (item 3).
- File sizes across the sprint are compliant: generator 644/650, runbook 300/300, README-cleanup.md's edit is exactly T7's described 2-hunk diff, the two `.sql` files are the only >500-line files (documented exemption), `.claude/rules/file-size.md` is byte-unchanged (item 4).
- `weak-backstop-guard` parity is 42/42 identical between `03` and `04` (item 5).
- `04`'s statement inventory is exactly 3 `INSERT INTO clientes` / 1 `UPDATE` / 1 `DELETE`, DDL confined to TEMP-table constructs, zero real banned-token hits, both `pagos` references are read-only `SELECT`s, exactly 3 `RAISE EXCEPTION` sites (item 6).
- Neither file creates anything in the `public` schema — no RLS policy is owed, none was added, ADR 0011's isolation posture is unchanged (item 7).
- Live DB state is unmodified: `clientes` count=1/max(id)=15, `reservas` count=1 (`id=10, cliente_id=15`), `pagos` empty — read live this round, not asserted from a prior report (item 8).
- Scope is 12 of 12 `git status --short` entries enumerated; nothing under `app/`, `lib/`, `components/`, `hooks/`, `tests/`, `scripts/`, `MEMORY/` was touched; the pre-existing `M CLAUDE.md` is the unrelated project-contract scaffold (item 9).
- No credential or connection string anywhere in any sprint artifact (item 10, credentials half).
- The runbook's pass/fail claims (RAISE EXCEPTION texts, BEGIN/COMMIT lines, the 45/599/0/644 email figures) all trace to the literal cited SQL lines, independently re-verified (item 11).
- No live destructive-verb-as-guidance instance anywhere in the sprint; the one historical instance (`t07-dev.md` round 1) is confirmed fixed (item 12).
- `npm run qa` is green: 825/825 tests, 0 lint errors, clean `tsc` (item 13).

**NOT PROVEN, and cannot be without actually running it:**
- **`04-clientes-import-execute.sql` has never been executed end-to-end by anyone.** No agent has run it in whole, with `COMMIT` or otherwise, at any point in this sprint. This audit did not run it either.
- Of the 42 pre-write guards, only **2** (`Q1_clientes_count_is_1`, `Q1_live_id_15_is_jrosa`) were individually fired live, each proven both directions (T5). Of the 33 post-checks, only **1** (`Post_pagos_ref_15_unchanged_0`) was individually fired live. The remaining 39 pre-write guards and 32 post-checks have only their *shared* `RAISE EXCEPTION` mechanism proven generically (T5) — each individual predicate's live semantic correctness against real payload/post-migration data is unproven.
- Per T4's own disclosed limitation (`reports/t04-dev.md` §8e): the **expected post-migration values** of every `Post_*` check (row count=1231, the id-set, `registrado_por='N/A'` count=1230, `estado_registro IS NULL` count=0, `reserva.cliente_id=1185`, sequence ≥1240) can only be confirmed true by an actual run. Today they correctly read pre-migration state (expected, not a defect). The 10 brand-new `Post_*` predicates (not reused from `03`) were validated for syntax/type correctness only (`EXPLAIN`), never for producing the literally-expected value against real post-migration data, because that data cannot exist without running `04`.
- Whether the live DB will 521 for the human's real run is unknowable in advance; this session happened to be reachable.

**This is as verified as it can be without running `04` for real.** There is no hedge beyond that — the artifact chain (hashes, determinism, guard parity, statement inventory, isolation posture, runbook accuracy, QA) is fully and freshly proven at sprint close; the *behavior of the actual write* remains, by design and by explicit prohibition in this task and T4/T5's scope, an inference from syntax-checked and partially-live-rehearsed pieces, not a demonstrated end-to-end fact.

**One genuine defect found this round, not present in any prior task's own self-check:** real client PII (`identificacion` numbers, emails) copied verbatim from the payload into 12 `reports/*.md` files, starting at T1 — see item 10. This is a `redaction-discipline` violation that survived every prior task's own "no PII found" sweep because none of those sweeps checked for bare numeric identificacion values. Confined to `reports/*.md`; the scratchpad, both runbooks, the plan, and the amendment are clean.

**Scratchpad ledger staleness (not a defect in the shipped artifacts, but worth recording):** the scratchpad's §1 ledger table shows t02 and t07 as "pending QA" for their latest rounds, but the actual on-disk reports show both are fully closed: `reports/t02-qa-r4.md` (PASS) + `reports/t02-lead-r4.md` (APPROVE), and `reports/t07-qa-r2.md` (PASS) + `reports/t07-lead-r2.md` (APPROVE). This matches the orchestrator's own framing at the top of this task ("Approved so far: t01, t02 (r4), t03 (r3), t04 (r2), t05, t06 (r3), t07 (r2)") — i.e. the ledger table just wasn't updated with the lead's decision, the underlying approvals are real and independently re-confirmed above (item 3's amendment reasoning, item 6's statement inventory, item 11's runbook citations all depend on and are consistent with the approved t02-r4/t03-r3/t04-r2 artifacts).

---

## CBrain filing candidates (for the lead/orchestrator to file — not filed by this task)

1. **Generator file-size exemption, scope-limited, non-precedential** (amendment A) — a second data point alongside flowcrm's unformalised 754-line deploy-runbook exception (`docs/plans/default-pipeline-deploy.md`). Both are one-shot migration/deploy tooling that outlived its own editing life. Worth a `patterns/` note if a third instance appears.
2. **Offline value-derivation cannot catch live SQL type/precedence errors.** Three defects this sprint — `information_schema.sql_identifier[]` vs `text[]` (T3 round 1), `NOT EXISTS(...)::text` operator-precedence (T3 round 2), and NBSP/`btrim()` email-count mismatch (T2 round 4) — all escaped every Python-side re-derivation and were only caught by live execution. The fix that stuck: making a live full-file smoke gate a standing pre-submission requirement for T2, not an optional nice-to-have.
3. **Orchestrator dispatched a duplicate round against already-approved work** (the T6 r2/r2b incident): the orchestrator read only round-1 reports, missed r2/r2b, and dispatched a stale duplicate "round 2" task; a different dev picked it up believing it was first and overwrote `reports/t06-dev-r2.md` a second time, destroying the original approved r2 evidence file. This is an orchestrator process error and must be filed as such, not smoothed over as a normal send-back cycle.
4. **New: redaction-discipline needs a numeric-PII grep, not just email/key/connection-string patterns.** Every prior "PII sweep" this sprint (T1 through T6) grepped for email shapes, `postgres://`, and key patterns, but never for bare `identificacion`/cedula numeric strings — which is exactly what leaked, starting at T1 and repeated in 11 more report files. Worth codifying as a specific grep addition to the `redaction-discipline` mistake note (`\b[0-9]{9,11}\b` or similar, cross-checked against the pinned workbook's actual identificacion values) so future sprints touching PII-bearing data catch this class before it compounds across 12 files.

---

## Files changed

- `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t08-dev.md` (this report — new file)
- `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (own §1 t08 row updated only; §2 folded per the file's own cap rule — it was 485 lines, over the 300-line cap already flagged twice by prior tasks and never actioned — condensed t02-r4 through t07's detailed handoffs into one paragraph each in the file's existing "Folded" style, preserving every load-bearing fact (approval status, the T6 r2/r2b process incident, T4's §8e disclosure) and all report-path pointers; appended this task's own ≤40-line handoff. Result: 197/300 lines, §0 unchanged at 21/80, every individual block ≤40 lines. Re-swept the updated scratchpad for PII and destructive-verb hits after the fold — clean.)

No other file in the repository was modified. `git status --short` before and after this task is identical (12 entries, shown in item 9) except for the two files listed above.

## Commands run

All commands and their real, unedited output are pasted inline above under items 1–13 (hashes, regeneration, greps, `psql` queries, `npm run qa`). Nothing was truncated or summarized in place of pasted output.

## Rollback

This task is read-only over every sprint artifact except this report and this task's own scratchpad entry. There is nothing to revert.
