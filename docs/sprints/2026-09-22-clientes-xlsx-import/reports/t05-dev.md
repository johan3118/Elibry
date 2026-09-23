# T5 — Prove a guard actually aborts (live, read-only) — dev report

**Verdict: DONE.** `04-clientes-import-execute.sql` was never executed in whole or in
part beyond its own read-only guard predicates: only `SELECT`, `pg_temp`-scoped
`CREATE TEMP TABLE`/`DROP TABLE`/`INSERT INTO _checks|_post_checks` (throwaway, gone on
connection close), and `DO $$ ... RAISE EXCEPTION $$` blocks were run. No `INSERT`,
`UPDATE`, or `DELETE` against any real business table (`clientes`, `reservas`, `pagos`,
etc.) was ever issued. No `BEGIN`/`COMMIT` around any real-table write. One `BEGIN` was
used for the abort-property rehearsal below and it ends in `ROLLBACK`, touching only
throwaway temp-table DDL/DML.

## 0. Files touched (scope)

```
$ git status --short   (before this task)
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
                                                        (9 entries)

$ git status --short   (after this task)
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
                                                        (9 entries, unchanged)
```

**9 of 9** entries identical before/after — this task added **zero** new tracked or
untracked repo files. Only touches: this report (new file inside the already-`??`
`docs/sprints/.../` tree) and the scratchpad's own row/handoff (also inside that same
tree). No SQL file, no generator, no app/lib/component/test file was edited. All
throwaway SQL and the scratch runner live entirely under this session's private
scratchpad directory (`/private/tmp/claude-501/.../scratchpad/t05pg/`), outside the repo
— confirmed absent from `git status --short` above.

Files changed:
- `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t05-dev.md` (this file, new)
- `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (own row + own handoff)

## 1. Channel

`supabase db query` was re-confirmed (not re-litigated) to reject multi-statement text
— every rehearsal below needs `DROP TABLE` + `CREATE TEMP TABLE` + `INSERT` + a `DO $$`
block in one session so `pg_temp` state survives across statements, which is >1 command.

**New for this round:** rather than reaching for a Node+`pg` simple-query runner (T3/T4's
pattern, which required weakening `pg`'s TLS certificate verification —
`ssl:{rejectUnauthorized:false}` — to get past Supabase's certificate chain, an action
this session's sandbox explicitly denies as a TLS/Auth-weakening operation), I installed
`libpq`'s `psql` client via Homebrew (`brew install libpq`, a read-only package-manager
action, not a repo change) and connected with the **unmodified** `POSTGRES_URL_NON_POOLING`
connection string (`sslmode=require`, no client-side override). `psql`'s libpq-native TLS
stack negotiated the connection with **no verification weakening of any kind** — no flag,
no env var, no relaxed cert check:

```
$ export PATH=/opt/homebrew/opt/libpq/bin:$PATH
$ psql --version
psql (PostgreSQL) 18.6
$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT 1;"
 ?column?
----------
        1
(1 row)
```

`psql -f <file>` sent multiple statements over one session (one connection, one backend
process), so `pg_temp` tables created by one statement are visible to the next statement
in the same invocation — exactly the property T3/T4 needed a Node+`pg` workaround for.

**Carried forward for T6 (per this task's brief):** `psql` (via `brew install libpq`,
`PATH=/opt/homebrew/opt/libpq/bin:$PATH`) against the unmodified
`POSTGRES_URL_NON_POOLING` string is a working multi-statement, session-persistent,
TLS-clean channel — the human running the real `04` script for real can use it directly
(`psql "$POSTGRES_URL_NON_POOLING" -f docs/migracion/04-clientes-import-execute.sql`).
`supabase db query` still cannot run this file (still true, re-confirmed, not
re-litigated). The Node+`pg`-simple-query approach T3/T4 used works too, but requires an
explicit TLS-verification override this session declined to make when a verification-clean
alternative (`psql`) was available.

## 2. Pre-flight — files unchanged, baseline read

```
$ shasum -a 256 docs/migracion/04-clientes-import-execute.sql docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
```
Both match the required hashes exactly (`9146d0d5...689b1` and `a5f74af3...42cc4`) — this
task edited neither file, confirmed both before and after all live work (§6).

```
$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
 cnt | max_id
-----+--------
   1 |     15
(1 row)

$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT count(*) AS reservas_count FROM reservas; SELECT id, cliente_id FROM reservas WHERE cliente_id = 15;"
 reservas_count
----------------
              1
(1 row)

 id | cliente_id
----+------------
 10 |         15
(1 row)
```
Baseline before any rehearsal: `clientes` count=1, max(id)=15; `reservas` has exactly 1
row and it is `id=10, cliente_id=15`.

## 3. Guard 1 (pre-write, load-bearing) — `Q1_clientes_count_is_1`

**Source line, extracted verbatim via `grep`/`sed` (not retyped):**
```
$ grep -n "Q1_clientes_count_is_1" docs/migracion/04-clientes-import-execute.sql
1253:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_clientes_count_is_1', '1', (SELECT count(*)::text FROM clientes));
```
**Pre-write guard DO block, extracted verbatim:**
```
$ sed -n '1295,1296p' docs/migracion/04-clientes-import-execute.sql
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
```
**Throwaway files built by `sed` extraction** (`CREATE TEMP TABLE _checks` DDL from lines
1251-1252 + the one guard-row `INSERT` + the DO block above — no line hand-typed except
the one literal substitution):

`guard1_negative.sql` (unmodified `'1'`):
```
DROP TABLE IF EXISTS pg_temp._checks;
CREATE TEMP TABLE _checks (name text, expected text, actual text);
INSERT INTO _checks(name, expected, actual) VALUES ('Q1_clientes_count_is_1', '1', (SELECT count(*)::text FROM clientes));
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
```

`guard1_positive.sql` (**only** `'1'` inverted to `'999'` on the `expected` position,
built via `sed "s/'Q1_clientes_count_is_1', '1',/'Q1_clientes_count_is_1', '999',/"` on
the same extracted line):
```
DROP TABLE IF EXISTS pg_temp._checks;
CREATE TEMP TABLE _checks (name text, expected text, actual text);
INSERT INTO _checks(name, expected, actual) VALUES ('Q1_clientes_count_is_1', '999', (SELECT count(*)::text FROM clientes));
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
```

**Negative control (unmodified) — live run:**
```
$ psql "$POSTGRES_URL_NON_POOLING" -f guard1_negative.sql
psql:guard1_negative.sql:1: NOTICE:  schema "pg_temp" does not exist, skipping
DROP TABLE
CREATE TABLE
INSERT 0 1
DO
```
No `ERROR`, no `RAISE`. The `DO` block completed normally — the real, unmodified guard
genuinely does not fire against current production state. **Confirms the current state
truly satisfies the guard.**

**Positive test (expected inverted `1`→`999`) — live run:**
```
$ psql "$POSTGRES_URL_NON_POOLING" -f guard1_positive.sql
psql:guard1_positive.sql:1: NOTICE:  table "_checks" does not exist, skipping
DROP TABLE
CREATE TABLE
INSERT 0 1
psql:guard1_positive.sql:5: ERROR:  ABORT: 1 pre-write guard(s) failed -- see _checks. Nothing written.
CONTEXT:  PL/pgSQL function inline_code_block line 2 at RAISE
```
**Verbatim `RAISE EXCEPTION` text captured:**
`ERROR:  ABORT: 1 pre-write guard(s) failed -- see _checks. Nothing written.` — exactly
the message text baked into the real file's line 1296, proving the same guard mechanism
that will run inside `04` genuinely aborts when its predicate is false.

## 4. Guard 2 (pre-write, load-bearing companion) — `Q1_live_id_15_is_jrosa`

This is the second half of the load-bearing precondition this task calls out ("id=15
really is JROSA").

**Source line, extracted verbatim:**
```
$ grep -n "Q1_live_id_15_is_jrosa" docs/migracion/04-clientes-import-execute.sql
1255:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_live_id_15_is_jrosa', 'true', (SELECT (coalesce(nombre_completo,'') ILIKE '%JROSA%ASESORA%VIAJES%' OR coalesce(razon_social,'') ILIKE '%JROSA%ASESORA%VIAJES%' OR coalesce(nombre_comercial,'') ILIKE '%JROSA%ASESORA%VIAJES%')::text FROM clientes WHERE id = 15));
```
Same DO block as §3 (lines 1295-1296, verbatim, reused unmodified — it is the single
generic aggregate guard the real file evaluates all 15 `Q1_*` pre-write checks with).

**Negative control (unmodified `'true'`) — live run:**
```
$ psql "$POSTGRES_URL_NON_POOLING" -f guard2_negative.sql
psql:guard2_negative.sql:1: NOTICE:  table "_checks" does not exist, skipping
DROP TABLE
CREATE TABLE
INSERT 0 1
DO
```
No `ERROR`. The real, unmodified guard does not fire — live id=15 genuinely name-matches
JROSA today.

**Positive test (expected inverted `'true'`→`'false'`) — live run:**
```
$ psql "$POSTGRES_URL_NON_POOLING" -f guard2_positive.sql
psql:guard2_positive.sql:1: NOTICE:  table "_checks" does not exist, skipping
DROP TABLE
CREATE TABLE
INSERT 0 1
psql:guard2_positive.sql:5: ERROR:  ABORT: 1 pre-write guard(s) failed -- see _checks. Nothing written.
CONTEXT:  PL/pgSQL function inline_code_block line 2 at RAISE
```
Verbatim `ERROR: ABORT: 1 pre-write guard(s) failed -- see _checks. Nothing written.`
— identical mechanism fires correctly.

## 5. Post-condition guard — `Post_pagos_ref_15_unchanged_0`

The plan's own text: post-conditions are the safety net for the `SET NULL` FK path (T1's
`fk_reservas_cliente`). I fired one to comply with this task's explicit instruction to
test the post-check block, not just pre-write guards.

**Source line, extracted verbatim:**
```
$ grep -n "Post_pagos_ref_15_unchanged_0" docs/migracion/04-clientes-import-execute.sql
1356:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_pagos_ref_15_unchanged_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
```
**Post-condition DO block, extracted verbatim:**
```
$ sed -n '1360,1361p' docs/migracion/04-clientes-import-execute.sql
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _post_checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.', v; END IF; END $$;
```

**Negative control (unmodified `'0'`) — live run:**
```
$ psql "$POSTGRES_URL_NON_POOLING" -f post3_negative.sql
psql:post3_negative.sql:1: NOTICE:  schema "pg_temp" does not exist, skipping
DROP TABLE
CREATE TABLE
INSERT 0 1
DO
```
No `ERROR`. `pagos` currently has 0 rows referencing `cliente_id=15` (true both before
and after migration, since `pagos` never referenced the old id=15 JROSA row) — this
particular post-check is one of the few whose predicate happens to already hold in the
pre-migration state, so it is a legitimate unmodified negative control.

**Positive test (expected inverted `'0'`→`'999'`) — live run:**
```
$ psql "$POSTGRES_URL_NON_POOLING" -f post3_positive.sql
psql:post3_positive.sql:1: NOTICE:  table "_post_checks" does not exist, skipping
DROP TABLE
CREATE TABLE
INSERT 0 1
psql:post3_positive.sql:5: ERROR:  ABORT: 1 post-condition(s) failed -- see _post_checks. Rolling back.
CONTEXT:  PL/pgSQL function inline_code_block line 2 at RAISE
```
Verbatim: `ERROR: ABORT: 1 post-condition(s) failed -- see _post_checks. Rolling back.`
— the post-condition block's own `RAISE EXCEPTION` text, confirmed fired.

### 5b. Disclosed finding, not a bug — `Post_reserva_10_cliente_is_1185` raises even unmodified

I also tried `Post_reserva_10_cliente_is_1185` (`expected='1185'`,
`actual=(SELECT coalesce(cliente_id::text,'NULL') FROM reservas WHERE id = 10)`,
line 1355) as a candidate post-condition guard. Its **unmodified** version raises live
too:
```
$ psql "$POSTGRES_URL_NON_POOLING" -f post_negative.sql
...
ERROR:  ABORT: 1 post-condition(s) failed -- see _post_checks. Rolling back.
```
This is **not a defect** — this specific post-check asserts the *post-migration* state
(reserva 10 repointed to the new JROSA id 1185), and today's real, pre-migration state
still has `reservas.id=10 → cliente_id=15` (confirmed §2 baseline). Every `Post_*` check
whose expected value differs between pre- and post-migration state will raise if
evaluated against today's data — this is expected and is exactly what T4's own dev report
(§8e) already disclosed ("the expected post-migration values... can only be confirmed
true by an actual run"). I did not count this as one of the negative-control-clean guards
above; I report it here plainly rather than silently dropping it, since it corroborates
that the post-check mechanism is discriminating correctly between pre- and
post-migration state, not merely rubber-stamping.

## 6. Abort-everything property (plan's original T5 AC2 — kept, not superseded)

Demonstrates that once a guard's `RAISE EXCEPTION` fires inside an explicit transaction,
every subsequent statement in that same transaction errors until `ROLLBACK`/`COMMIT` —
exactly the property that makes `04`'s single `BEGIN...COMMIT` atomic.

```sql
BEGIN;
DROP TABLE IF EXISTS pg_temp._checks;
CREATE TEMP TABLE _checks (name text, expected text, actual text);
INSERT INTO _checks(name, expected, actual) VALUES ('Q1_clientes_count_is_1', '999', (SELECT count(*)::text FROM clientes));
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
SELECT 1 AS should_be_blocked;
ROLLBACK;
```
(Body is `guard1_positive.sql` from §3, unmodified, wrapped in an explicit `BEGIN`/
`ROLLBACK` — nothing here touches a business table.)

```
$ psql "$POSTGRES_URL_NON_POOLING" -f abort_property_test.sql
BEGIN
psql:abort_property_test.sql:2: NOTICE:  table "_checks" does not exist, skipping
DROP TABLE
CREATE TABLE
INSERT 0 1
psql:abort_property_test.sql:6: ERROR:  ABORT: 1 pre-write guard(s) failed -- see _checks. Nothing written.
CONTEXT:  PL/pgSQL function inline_code_block line 2 at RAISE
psql:abort_property_test.sql:7: ERROR:  current transaction is aborted, commands ignored until end of transaction block
ROLLBACK
```
The `SELECT 1 AS should_be_blocked;` statement, issued *after* the guard's `RAISE
EXCEPTION`, errors verbatim with **`current transaction is aborted, commands ignored
until end of transaction block`** — the exact text the frozen spec's AC required. The
`ROLLBACK` at the end closes the (already-aborted) transaction cleanly; nothing was
written (only throwaway `pg_temp` DDL/DML occurred, and even that never took effect since
the whole block rolled back).

## 7. Read-only proof — before/after every rehearsal

```
$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
 cnt | max_id
-----+--------
   1 |     15
(1 row)

$ psql "$POSTGRES_URL_NON_POOLING" -c "SELECT count(*) AS reservas_ref_15 FROM reservas WHERE cliente_id = 15;"
 reservas_ref_15
------------------
                1
(1 row)
```
Identical to the §2 pre-flight baseline (`clientes` count=1/max(id)=15; `reservas` has
exactly 1 row with `cliente_id=15`, i.e. reserva id=10 still points at JROSA) — captured
again after all 7 live rehearsals (guard1 ×2, guard2 ×2, post3 ×2, abort-property ×1).
**Nothing was written to any business table at any point in this task.**

## 8. `04`/`03` unchanged — final re-hash

```
$ shasum -a 256 docs/migracion/04-clientes-import-execute.sql docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
```
Both match the values required by this task's own AC4 exactly, and match §2's pre-flight
hashes — this task edited **no SQL file**.

## 9. Which guards were NOT rehearsed (plain statement, `assertion-without-verification`)

Only **2 pre-write guards** (`Q1_clientes_count_is_1`, `Q1_live_id_15_is_jrosa`, out of
15 `Q1_*` + 27 `Q2`-`Q6` = 42 total pre-write `_checks` rows) and **1 post-condition**
(`Post_pagos_ref_15_unchanged_0`, out of 33 `_post_checks` rows) were individually fired
live this task, in both directions. I do **not** claim the other 39 pre-write guards or
32 post-checks are individually proven to abort correctly — that would be
`assertion-without-verification`. What IS established, and does generalize:

- All 42 pre-write guards and all 33 post-checks share the exact same two generic
  aggregate mechanisms (`DO $$ ... SELECT count(*) ... WHERE expected <> actual ...
  RAISE EXCEPTION ... $$`, one for `_checks`, one for `_post_checks`) — I did not test a
  bespoke per-check `IF` branch per guard (there isn't one; the file has exactly these 2
  aggregate `DO` blocks, confirmed by `grep -c "RAISE EXCEPTION" docs/migracion/04-clientes-import-execute.sql`
  → 3 total: the two aggregate blocks above plus G6's own, tested separately by T4).
  Firing one row through each of the two aggregate blocks (§3/§4 through the pre-write
  block, §5 through the post-write block) proves the **mechanism** — that a mismatched
  row in either temp table causes that block's `RAISE EXCEPTION` — for every guard that
  feeds it, since they are all evaluated by the identical `SELECT count(*) FROM ... WHERE
  expected <> actual` query, not by 42+33 separate `IF` statements.
- What is **not** proven: that every individual guard's own `SELECT`-based predicate
  (e.g. the `array_agg(...) = ARRAY[...]::int[]` id-set check, or the 17-column
  `IS NOT DISTINCT FROM` chain) is itself semantically correct against the real
  1,231-row payload and the real post-migration data — those were checked for
  **syntax/type validity only** in T4 (§8b-§8d of `reports/t04-dev.md`), and their
  **values** genuinely cannot be proven without running `04` for real, which remains
  prohibited in this task.
- `_jrosa_preserva`'s G6 guard (`DO $$ ... _jrosa_preserva must have exactly 1 row ...
  $$`, lines 1301-1302) was fired live (both directions) already in T4 (`reports/t04-dev.md`
  §8b) — not repeated here to avoid duplicating accepted evidence, but it is the third
  distinct `RAISE EXCEPTION` site in the file and was already proven live once.

## 10. `npm run qa`

```
$ npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test


> my-v0-project@0.1.0 typecheck
> tsc --noEmit


> my-v0-project@0.1.0 lint
> eslint .

(28 pre-existing react-hooks/exhaustive-deps and @next/next/no-img-element warnings in
app/**/*.tsx files this task never touches — identical set to every prior round, 0 errors)

✖ 28 problems (0 errors, 28 warnings)


> my-v0-project@0.1.0 test
> vitest run

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  16:17:55
   Duration  3.73s (transform 2.27s, setup 3.63s, collect 3.82s, tests 953ms, environment 9ms, prepare 4.32s)
```
Exit code `0`. `tsc --noEmit` clean. `eslint .` 0 errors (28 pre-existing warnings,
unchanged). `825/825` tests pass — pure regression gate holds; no `app/`, `lib/`,
`components/`, `hooks/`, or `tests/` file was touched this task.

## 11. Redaction / PII check

```
$ grep -inE "postgres://|postgresql://|service_role|anon_key|eyJ|sslmode=require&|@.*\.supabase\.co" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t05-dev.md
(no output)
$ grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t05-dev.md
(no output)
```
No client name, email, phone, cedula/RNC value, connection string, or key appears
anywhere in this report — every live query result quoted above is a count, a
boolean/`ERROR` message, or a pattern already disclosed in T1-T4's reports (`JROSA`,
`MELISSA`, `RES-...`, table/column names). The `$POSTGRES_URL_NON_POOLING` shell variable
is referenced by name only, never expanded/printed, in every command shown.

## 12. Out-of-scope changes

None. `git status --short` before/after (§0): 9 → 9 entries, identical. All throwaway
SQL files (`guard1_negative.sql`, `guard1_positive.sql`, `guard2_negative.sql`,
`guard2_positive.sql`, `post_negative.sql`, `post_positive.sql`, `post3_negative.sql`,
`post3_positive.sql`, `abort_property_test.sql`) and the `psql`-only Homebrew install
(`libpq`, a system package manager action, not a repo file) live entirely outside the
repo — confirmed by the unchanged `git status --short` count above.

## Rollback

Read-only task — nothing to revert in the database (confirmed unchanged in §2/§7: count=1,
max(id)=15 throughout) and no SQL file was edited (confirmed unchanged in §8). To remove
this task's only two changes: delete this report
(`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t05-dev.md`) and revert this
task's own scratchpad row/handoff edit. No git verb is needed or implied — nothing was
committed by this task, and no destructive operation of any kind was performed.
