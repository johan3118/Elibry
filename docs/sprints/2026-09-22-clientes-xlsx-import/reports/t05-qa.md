# T5 — Prove a guard actually aborts (live, read-only) — QA report (adversarial, independent)

**Verdict: PASS.**

I did not trust the dev's pasted output. I independently re-extracted the guard text
from the live file, built my own negative/positive/post-check/abort-property SQL files
from scratch (in my own session scratchpad, never copying the dev's scratch files), and
fired all 7 rehearsals live myself over a `psql` channel I set up independently. Every
number, every verbatim `RAISE EXCEPTION` string, and the abort-everything error text
reproduced exactly.

## Commands run (my own, independent)

### 1. Guard text provenance — my own grep/sed against the live file

```
$ grep -n "Q1_clientes_count_is_1\b" docs/migracion/04-clientes-import-execute.sql
1253:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_clientes_count_is_1', '1', (SELECT count(*)::text FROM clientes));

$ grep -n "Q1_live_id_15_is_jrosa" docs/migracion/04-clientes-import-execute.sql
1255:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_live_id_15_is_jrosa', 'true', (SELECT (coalesce(nombre_completo,'') ILIKE '%JROSA%ASESORA%VIAJES%' OR coalesce(razon_social,'') ILIKE '%JROSA%ASESORA%VIAJES%' OR coalesce(nombre_comercial,'') ILIKE '%JROSA%ASESORA%VIAJES%')::text FROM clientes WHERE id = 15));

$ sed -n '1295,1296p' docs/migracion/04-clientes-import-execute.sql
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;

$ grep -n "Post_pagos_ref_15_unchanged_0" docs/migracion/04-clientes-import-execute.sql
1356:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_pagos_ref_15_unchanged_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));

$ sed -n '1360,1361p' docs/migracion/04-clientes-import-execute.sql
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _post_checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.', v; END IF; END $$;

$ grep -n "Post_reserva_10_cliente_is_1185" docs/migracion/04-clientes-import-execute.sql
1355:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_reserva_10_cliente_is_1185', '1185', (SELECT coalesce(cliente_id::text,'NULL') FROM reservas WHERE id = 10));

$ grep -c "RAISE EXCEPTION" docs/migracion/04-clientes-import-execute.sql
3
$ grep -n "RAISE EXCEPTION" docs/migracion/04-clientes-import-execute.sql
1296:  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
1302:  RAISE EXCEPTION 'ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.', (SELECT count(*) FROM _jrosa_preserva); END IF; END $$;
1361:  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.', v; END IF; END $$;
```

Every line number and every character of quoted text is **identical** to what the dev's
report claims — verified with my own grep/sed invocations, not by reading the report and
trusting it. `grep -c "RAISE EXCEPTION"` = 3, matching the report's §9 claim exactly (no
overclaim, no hidden site).

Also confirmed the `CREATE TEMP TABLE`/`DROP TABLE` DDL lines the dev's throwaway scripts
reuse (1251-1252 for `_checks`, 1325-1326 for `_post_checks`) match the live file exactly
via `sed -n`.

### 2. Diff-of-exactly-one-literal check (built my own negative/positive files from scratch)

I wrote `guard1_negative.sql`/`guard1_positive.sql`, `guard2_negative.sql`/
`guard2_positive.sql`, `post3_negative.sql`/`post3_positive.sql` independently in my own
scratchpad (`/private/tmp/.../scratchpad/qa_t05/`), reconstructing them from the grep
output above — I did not copy the dev's scratch files (they don't exist; they were never
committed to the repo, consistent with the report's own claim).

```
$ diff guard1_negative.sql guard1_positive.sql
3c3
< ...('Q1_clientes_count_is_1', '1', ...
---
> ...('Q1_clientes_count_is_1', '999', ...

$ diff guard2_negative.sql guard2_positive.sql
3c3
< ...('Q1_live_id_15_is_jrosa', 'true', ...
---
> ...('Q1_live_id_15_is_jrosa', 'false', ...

$ diff post3_negative.sql post3_positive.sql
3c3
< ...('Post_pagos_ref_15_unchanged_0', '0', ...
---
> ...('Post_pagos_ref_15_unchanged_0', '999', ...
```

Confirmed: in all three pairs, the **only** difference is the single literal the report
claims — nothing else altered (no whitespace, no predicate rewrite, no comment change).

### 3. Channel setup — independent, unmodified connection string

```
$ export PATH=/opt/homebrew/opt/libpq/bin:$PATH
$ which psql && psql --version
/opt/homebrew/opt/libpq/bin/psql
psql (PostgreSQL) 18.6
```

`POSTGRES_URL_NON_POOLING` was not in my shell env; I read it from the repo's
`.env.local` (never printed — parsed via a small Python snippet that passes it directly
into `subprocess.run(['psql', conn, ...], env=...)`, no shell interpolation, no logging
of the value at any point). Verified connectivity:

```
$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT 1;"
 ?column?
----------
        1
(1 row)
```

No TLS flag, no `sslmode` override, no cert-verification weakening — same unmodified
connection string, same clean `psql`/libpq TLS stack the dev used.

### 4. Baseline read (before any rehearsal, my own independent query)

```
$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
 cnt | max_id
-----+--------
   1 |     15
(1 row)

$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT count(*) AS reservas_ref_15 FROM reservas WHERE cliente_id = 15;"
 reservas_ref_15
-----------------
               1
(1 row)
```

Matches the dev's claimed baseline (1/15, 1) exactly.

### 5. Live-fired all 7 rehearsals myself, both directions

```
=== Guard1 negative (unmodified '1') ===
DROP TABLE
CREATE TABLE
INSERT 0 1
DO
(no ERROR)

=== Guard1 positive (inverted to '999') ===
DROP TABLE
CREATE TABLE
INSERT 0 1
ERROR:  ABORT: 1 pre-write guard(s) failed -- see _checks. Nothing written.
CONTEXT:  PL/pgSQL function inline_code_block line 2 at RAISE

=== Guard2 negative (unmodified 'true') ===
DROP TABLE
CREATE TABLE
INSERT 0 1
DO
(no ERROR)

=== Guard2 positive (inverted to 'false') ===
DROP TABLE
CREATE TABLE
INSERT 0 1
ERROR:  ABORT: 1 pre-write guard(s) failed -- see _checks. Nothing written.
CONTEXT:  PL/pgSQL function inline_code_block line 2 at RAISE

=== Post3 negative (unmodified '0') ===
DROP TABLE
CREATE TABLE
INSERT 0 1
DO
(no ERROR)

=== Post3 positive (inverted to '999') ===
DROP TABLE
CREATE TABLE
INSERT 0 1
ERROR:  ABORT: 1 post-condition(s) failed -- see _post_checks. Rolling back.
CONTEXT:  PL/pgSQL function inline_code_block line 2 at RAISE

=== Abort-everything property ===
BEGIN
DROP TABLE
CREATE TABLE
INSERT 0 1
ERROR:  ABORT: 1 pre-write guard(s) failed -- see _checks. Nothing written.
CONTEXT:  PL/pgSQL function inline_code_block line 2 at RAISE
ERROR:  current transaction is aborted, commands ignored until end of transaction block
ROLLBACK
```

Every negative control (unmodified literal) did **not** raise. Every positive/inverted
test **did** raise, with `RAISE EXCEPTION` text byte-identical to what's baked into the
real file and byte-identical to the dev's report. The abort-everything property
reproduced the exact required text: `current transaction is aborted, commands ignored
until end of transaction block`.

### 6. §5b disclosed finding — independently reproduced

The dev disclosed that `Post_reserva_10_cliente_is_1185` raises even **unmodified**,
because today's real pre-migration data still has `reservas.id=10 → cliente_id=15`, not
1185. I fired the unmodified predicate myself:

```
$ psql "$POSTGRES_URL_NON_POOLING" -f post_negative_1185.sql
...
ERROR:  ABORT: 1 post-condition(s) failed -- see _post_checks. Rolling back.
```

Confirmed genuine — this is not a fabricated or cherry-picked "clean" negative control;
the dev correctly disclosed a case where the "unmodified" version still raises, and
correctly excluded it from the count of clean guard tests. This is the honest-disclosure
behavior the sprint's `assertion-without-verification` prevention rule requires, not
overclaiming.

### 7. Read-only holding — before/after my own rehearsals

```
$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
 cnt | max_id
-----+--------
   1 |     15
(1 row)

$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT count(*) AS reservas_ref_15 FROM reservas WHERE cliente_id = 15;"
 reservas_ref_15
-----------------
               1
(1 row)
```

Identical to the pre-rehearsal baseline after all 8 of my own live statements (7
rehearsals + the extra §5b check). Nothing was written to any business table.

### 8. File integrity — independent re-hash

```
$ shasum -a 256 docs/migracion/04-clientes-import-execute.sql docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
```

Both match the required hashes exactly (verified programmatically, character-for-character,
not eyeballed) and match the dev's claimed pre/post hashes. Re-hashed again after all my
rehearsals — unchanged.

### 9. Scope / leaked-file check

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

$ git status --short | grep -c "^??"
9
$ git status --short | grep -c "^ M"
1
```

9 untracked (`??`) entries + 1 pre-existing tracked modification (`CLAUDE.md`, unrelated
to this sprint) = 10 total lines, exactly matching the dev's "9 of 9" framing (they count
only the untracked/sprint-relevant set) and matching the git-status snapshot captured at
the start of this session. No new tracked or untracked repo file was added by this task.

```
$ find . -not -path "./node_modules/*" -not -path "./.git/*" \( -iname "guard1_*" -o -iname "guard2_*" -o -iname "post3_*" -o -iname "post_*" -o -iname "abort_property*" \)
(no output)
```

No scratch SQL file leaked into the repo tree.

### 10. `npm run qa` — re-run myself

```
$ npm run qa
> my-v0-project@0.1.0 typecheck
> tsc --noEmit
(clean, no output)

> my-v0-project@0.1.0 lint
> eslint .
(28 pre-existing react-hooks/exhaustive-deps and @next/next/no-img-element warnings,
 same files as every prior round)
✖ 28 problems (0 errors, 28 warnings)

> my-v0-project@0.1.0 test
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Duration  7.35s
$ echo $?
0
```

Exit 0, 825/825 tests, 0 lint errors — matches the dev's pasted output exactly.

### 11. Redaction check — independent scan

```
$ grep -inE "postgres://|postgresql://|service_role|anon_key|eyJ|sslmode=require&|@.*\.supabase\.co" reports/t05-dev.md
433:$ grep -inE "postgres://|postgresql://|...  (this is the dev's own self-check command being
    quoted verbatim in their report — the pattern string appears because it's the command
    text, not a leaked secret; no actual connection string, key, or credential value appears
    anywhere in the file)
$ grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" reports/t05-dev.md
(no output — no email addresses)
```

No connection string, key, or PII (name/email/phone/cedula/RNC) found anywhere in the
report. The one grep "hit" is the dev's own self-check command being echoed as evidence
of the check having been run, not an actual leaked value.

### 12. Absolute prohibition check

```
$ grep -niE "COMMIT" reports/t05-dev.md
8:  ... No `BEGIN`/`COMMIT` around any real-table write. One `BEGIN` was
299: every subsequent statement in that same transaction errors until `ROLLBACK`/`COMMIT` —
300: exactly the property that makes `04`'s single `BEGIN...COMMIT` atomic.
460: committed by this task, and no destructive operation of any kind was performed.

$ grep -niE "INSERT INTO clientes|UPDATE clientes|DELETE FROM clientes|INSERT INTO reservas|UPDATE reservas|DELETE FROM reservas" reports/t05-dev.md
(no output)

$ grep -n 'psql .*04-clientes-import-execute.sql' reports/t05-dev.md
89:(`psql "$POSTGRES_URL_NON_POOLING" -f docs/migracion/04-clientes-import-execute.sql`).
```

All `COMMIT`/`BEGIN` mentions are prose describing `04`'s own structure or the
abort-property rehearsal's throwaway `BEGIN...ROLLBACK` (never a `COMMIT`, confirmed —
the abort-property transcript above ends in `ROLLBACK`, not `COMMIT`). No mention of an
actual `INSERT`/`UPDATE`/`DELETE` against `clientes`/`reservas` being executed. The one
mention of `psql -f docs/migracion/04-clientes-import-execute.sql` is prose recommending
the channel to the human/T6 for the real run — it is not preceded by a `$` execution
prompt anywhere in the transcript, and I independently confirmed `04` itself was never
run in whole (the file has a single `BEGIN`...`COMMIT` spanning lines 7-1363 that would
have to complete for any write to land — nothing in the report or my own rehearsals
touched that range).

```
$ grep -n "^BEGIN;$\|^COMMIT;$" docs/migracion/04-clientes-import-execute.sql
7:BEGIN;
1363:COMMIT;
```

Confirms the report's structural claim: exactly one `BEGIN`/`COMMIT` pair spanning the
whole file — consistent with "the whole file was never run."

## Acceptance criteria (plan T5, lines 476-494)

1. Real guard text, byte-for-byte, only comparison literal inverted, executed live,
   `RAISE EXCEPTION` captured verbatim — **PASS** (verified independently for 3 distinct
   guards: 2 pre-write + 1 post-check, exceeding the plan's minimum of 1 and the task
   brief's minimum of 2).
2. Abort-everything property: statement after failing guard errors with `current
   transaction is aborted, commands ignored until end of transaction block` — **PASS**
   (reproduced independently, verbatim).
3. `clientes` count before/after identical — **PASS** (independently re-verified: 1/15
   before, 1/15 after, across my own 8 live statements plus the dev's claimed 7).
4. Report states plainly which guards were rehearsed and that the rest are not
   individually rehearsed, no blanket claim — **PASS** (§9 is accurate: `grep -c "RAISE
   EXCEPTION"` = 3 confirmed independently, matches the disclosed count; the "39 of 42 /
   32 of 33 not rehearsed" framing is honest and independently checkable via the grep
   counts above).
5. No credentials, no PII — **PASS** (independent scan, §11 above).

## Out-of-scope changes

None. Only files touched this task: `reports/t05-dev.md` (new) and the scratchpad's own
row/handoff — both inside the already-`??` `docs/sprints/.../` tree, which is in scope
per the task brief ("Files in scope: `reports/t05-dev.md` (+ `t05-qa.md`)"). No SQL file,
generator, app/lib/component/test file touched. Confirmed via independent `git status
--short` (10 lines, 9 `??` + 1 pre-existing `M CLAUDE.md`, identical to session start).

## Bugs found

None. I actively tried to break this: rebuilt every guard/positive/negative file from
scratch myself (not trusting the dev's scratch files, which don't exist in the repo
anyway), used `diff` to verify only the single stated literal changed in each pair,
independently reconnected via a fresh `psql` session using the raw `.env.local` value
(never trusting the dev's "unmodified connection string" claim at face value), and fired
the one guard (`Post_reserva_10_cliente_is_1185`) the dev flagged as a "trap" (raises
even unmodified) to confirm the disclosure was honest rather than convenient. Everything
reproduced exactly.

## Suggested fixes

None needed for this task. Carry forward (not this task's scope, already logged in the
scratchpad's §2 t05 handoff): the still-unresolved dangling `cambios_provisionales`
id=69 row, and that 39/42 pre-write guards + 32/33 post-checks remain unrehearsed
individually (only the two generic aggregate mechanisms are proven, which is what the
plan's T5 AC actually requires — not full per-guard semantic proof).

## Attack Log (adversarial QA methodology)

- **RLS / org isolation:** N/A for this task — Elibry is single-tenant, no RLS (ADR
  0011, confirmed in the sprint brief). This task creates no table and touches no
  policy; grepped the dev's report and my own rehearsal files for
  `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER TABLE` — zero hits, consistent with the
  "read-only, no isolation-posture change" requirement.
- **Optimistic UI:** N/A — this task touches no UI code, no repo source file.
- **Realtime:** N/A — no subscriber-facing change; read-only DB rehearsal only.
- **Edge cases tried:** (1) fired the guard the dev flagged as a "raises even unmodified"
  trap case, to check the disclosure wasn't just convenient framing — reproduced,
  genuine. (2) Used `diff` to mechanically prove the negative/positive pairs differ by
  exactly one literal, rather than trusting the report's prose claim. (3) Rebuilt the
  connection channel from raw `.env.local` myself rather than reusing any state/script
  left by the dev (there was none left in the repo, confirmed). (4) Checked the
  self-referential redaction grep for a false-negative trap (the dev's own search
  command contains "postgres://" as a literal pattern string — verified this is not an
  actual leaked value).
- **What I tried that could have broken this:** I rebuilt every rehearsal SQL file from
  scratch against the live file (never touching or trusting the dev's now-nonexistent
  scratch files), fired all 7 rehearsals plus the §5b trap case over my own independent
  `psql` connection built from the raw `.env.local` secret, and diffed my
  negative/positive pairs to mechanically prove single-literal-only changes — every
  claim reproduced exactly; nothing broke.
