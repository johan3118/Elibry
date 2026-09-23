# T3 QA — Adversarial, independent verification

**Two distinct verdicts, per the task's own framing (see §7):**
- **T3's own task execution: Verdict: PASS.**
- **The artifact under test (`docs/migracion/03-clientes-import-dry-run.sql`): FAIL — confirmed broken, bounces to T2.**

These are not the same question. Everything below shows my own independently-run
commands (not retyped from the dev's report) proving both.

---

## 1. Pre-flight hash — independently reproduced, MATCH

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
90fff4202dd193d1c67ff41f4c8c0bac86e1a4c5c94861d143b5c4e4a85f9c1f  docs/migracion/03-clientes-import-dry-run.sql

$ grep -n "payload-sha256" docs/migracion/03-clientes-import-dry-run.sql
19:-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```

Both hashes match the dev's report **and** `reports/t02-qa-r2.md`'s recorded values exactly
(`90fff420...f9c1f` output-sha256, `9664ee4e...932392` payload-sha256). Re-hashed a second time
after all my own live runs below — unchanged. **No drift.**

---

## 2. The claimed bug — read the file myself, confirmed real

```
$ grep -n "Q1_not_null_columns_match" docs/migracion/03-clientes-import-dry-run.sql
1338:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_not_null_columns_match', 'true',
(SELECT (array_agg(column_name ORDER BY column_name) =
ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text
FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO'));
```

Line number, predicate shape, and literal array all match the dev's quote exactly — this is not a
retyped paraphrase, this is the on-disk line.

I did **not** take the dev's word that `column_name` is `sql_identifier` — I queried it live myself:

```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" \
  "SELECT pg_typeof(column_name) AS t FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' LIMIT 1;"
Connecting to remote database...
{
  "rows": [ { "t": "information_schema.sql_identifier" } ]
}
```

Confirmed empirically (not from memory of Postgres docs): `column_name` really is
`information_schema.sql_identifier`, and Postgres has no `sql_identifier[] = text[]` operator, so
this genuinely throws `operator does not exist` in real Postgres. Not SQLite, not a hypothetical —
verified against the live server this task targets.

I additionally verified the dev's suggested fix actually resolves it (extra corroboration, not
required but strengthens the diagnosis):

```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" \
  "SELECT (array_agg(column_name::text ORDER BY column_name) = ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO';"
{ "rows": [ { "text": "true" } ] }
```

Casting to `::text` fixes it and returns the expected `true`. Also grepped the whole file for other
uses of `information_schema` to check the dev's "re-grep the file" recommendation myself:

```
$ grep -n "information_schema" docs/migracion/03-clientes-import-dry-run.sql
24:-- information_schema.character_maximum_length; direccion/observacion are
1338:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_not_null_columns_match', ...
```

Only 1 executable occurrence (line 24 is a comment). The bug is isolated to this one check, as the
dev implied but did not explicitly grep-prove in their report.

---

## 3. Independent live reproduction — done myself, on 3 separate channels

**Environment note (own finding, not in the dev's report):** `source .env.local` in a plain bash
shell **breaks** — the file's raw `&`-bearing connection-string values are not shell-quoted, so
`source`ing it as a script throws a parse error (`.env.local:1: parse error near '&'`). I worked
around this the same way the dev's report implies (reading the specific var via a small script,
never printing it, never exporting the whole file). This is a legitimate, disclosed necessity, not
scope creep — I made zero repo file changes to do it (confirmed via `git status --short` before/
after, identical 8-entry list both times).

**(a) Official channel, whole file (`-f`), confirms multi-statement is rejected — same as dev's claim:**
```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" -f docs/migracion/03-clientes-import-dry-run.sql
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: cannot insert multiple commands into a prepared statement"}}

$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" "SELECT 1; SELECT 2;"
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: cannot insert multiple commands into a prepared statement"}}
```
Confirms the channel gap is real and is a hard Postgres extended-protocol restriction, not
something `-f` behaves differently on (tried both forms myself, both fail identically).

**(b) Official channel, isolated single statement — reproduces the exact defect, no workaround needed:**
```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" \
  "SELECT (array_agg(column_name ORDER BY column_name) = ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO';"
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: operator does not exist: information_schema.sql_identifier[] = text[]"}}
```
Identical error text to the dev's §5(b). Independently reproduced by me, not copy-pasted from their
report.

**(c) My own scratch workaround (own script, own install — not reused from the dev's session),
running the FULL, UNMODIFIED, on-disk file:**

I built a scratch npm project + a `pg`-based runner from scratch, entirely under this session's
private scratchpad directory (`/private/tmp/claude-501/.../scratchpad/qa-t03/`), never touching the
repo. Verified before and after with `git status --short` (identical 8-entry list both times, shown
in §5 below). The runner reads `POSTGRES_URL_NON_POOLING` from `.env.local` via a line-parser (never
shell-sourced, never printed, never logged) and executes via `pg.Client.query()` (simple query
protocol, same class of workaround the dev used, independently re-implemented by me):

```
$ NODE_TLS_REJECT_UNAUTHORIZED=0 node run.js /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql --file
ERROR: operator does not exist: information_schema.sql_identifier[] = text[]
```

Same error, same wording, reached by running the real, unmodified 1,384-line file through a
completely independent script I wrote myself. Three separate channels ((a) whole-file via CLI —
fails on protocol, not the bug; (b) isolated statement via CLI — reproduces the bug; (c) full file
via my own scratch runner — reproduces the bug) all agree. This is not an artifact of the dev's (or
my) workaround.

---

## 4. Run 2 / negative claims — assessed, not just trusted

**Run 2 was genuinely never executed** by the dev (their report says so explicitly, §7) and I did
not find a second full-file run anywhere in their report or the scratchpad. This is a real gap
against the plan's literal AC3 text ("The script is run a second time and the two outputs are
diff-identical"). However: AC4 gives an explicit escape hatch ("...or the task reports FAIL loudly
and stops — no 'close enough'"), and the task's own scope note says "if the dry run reveals a
payload defect, the task FAILS back to T2 rather than patching in place" — i.e. the task is
explicitly designed to stop early on a genuine defect. Given the defect is a **deterministic SQL
syntax/type error** (not flaky, not data-dependent, not connectivity-related — confirmed by me
getting the byte-identical error text on 3 independent channels/runs above), a literal second
full-file run would provide zero additional information; it would fail identically every time. I
judge skipping the literal second full run as a reasonable, disclosed judgment call under the AC4
escape hatch — not evidence of a missed step — but it is technically a partial AC3 gap, and I flag
it explicitly rather than silently accepting "the spirit was met."

**Q3/Q4/Q5/Q6/Q7 absence is genuine, not cherry-picked.** I independently confirmed via `grep -n`
that `Q1_not_null_columns_match` (line 1338) is the first `_checks` INSERT in the file after the
`_checks` temp table is created (line ~1332), and that the batch is one uninterrupted SQL string with
no explicit `BEGIN`/`COMMIT` — meaning Postgres's simple-query-protocol implicit-transaction rule
applies (a multi-statement message with no explicit transaction control is executed as a single
implicit transaction; an error anywhere in it aborts the whole batch). My own full-file run (§3c)
independently reached the exact same abort point with the exact same error and produced no
check-grid output either — confirming there is nothing to have omitted; the batch genuinely never
gets past line 1338.

---

## 5. Read-only preserved — independently confirmed, before and after

```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
{ "rows": [ { "cnt": 1, "max_id": 15 } ] }   # before my runs
```
```
$ NODE_TLS_REJECT_UNAUTHORIZED=0 node run.js "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
[{"cnt":"1","max_id":15}]   # after my full-file run in §3(c)
```
Matches the T1 baseline (`count=1`, `max_id=15`) and the dev's before/after claims exactly, run
independently by me, not copy-pasted.

On the "TEMP tables in an aborted transaction never persist" claim: this is standard, well-defined
Postgres behavior (DDL is transactional in Postgres, unlike some other engines) — the whole batch,
having no explicit `BEGIN`/`COMMIT`, is one implicit transaction per protocol rules, so the earlier
`CREATE TEMP TABLE _clientes_import` + 1,231-row `INSERT` is rolled back along with everything else
when the later statement errors. This doesn't matter for the read-only guarantee anyway, since
`grep -c "information_schema" ` and a manual read of the file (§2) confirm zero DDL/DML against any
real table anywhere in this file (`CREATE TEMP TABLE` only) — the count check above is the direct,
sufficient proof, independent of the transactional-rollback reasoning.

---

## 6. Scope and process audit

```
$ git status --short   (run before any of my QA commands, and again after cleanup)
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```
Identical, 8 entries, both times. **0 of 8** pre-existing entries touched by the dev or by me.
`docs/migracion/04-clientes-import-execute.sql` confirmed absent:
```
$ ls docs/migracion/04-clientes-import-execute.sql
ls: docs/migracion/04-clientes-import-execute.sql: No such file or directory
```
Files actually changed by T3: `reports/t03-dev.md` (new) + the scratchpad append. Matches the dev's
claim.

**No INSERT/UPDATE/DELETE/DDL executed against real tables** — confirmed by reading the file (only
`CREATE TEMP TABLE`/`DROP TABLE IF EXISTS pg_temp.*`), and by the unchanged count in §5.

**No PII / no credentials in `reports/t03-dev.md`:**
```
$ grep -inE "@gmail|@hotmail|cedula|identificacion|telefono|postgres://|postgresql://|SUPABASE_SERVICE_ROLE" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-dev.md
(no matches — only the literal placeholder $POSTGRES_URL_NON_POOLING and the word "email" as a column-name literal appear)
```

**Workaround legitimacy:** confirmed myself, independently, that `supabase db query -f <file>` fails
identically to the inline multi-statement form (§3a) — the `-f` flag does not change protocol
behavior, it's still routed through the extended/prepared-statement path. There genuinely is no
other CLI-native way to run a 47-statement batch requiring shared `pg_temp` session state through
`supabase db query`; the Node+`pg` (simple query protocol) workaround is the standard, documented
way `psql -f` itself works under the hood, and the dev correctly cross-validated it wasn't the cause
of the defect by reproducing the same error through the un-workaround-affected channel (§3b), which
I also independently reproduced myself in §3b.

---

## 7. Verdict for T3's own execution (explicit, per the task framing)

**T3 task execution: PASS.** The dev:
- Preserved read-only (proven, not asserted, before and after — independently reconfirmed by me).
- Did not edit the SQL file (hash-proven, independently reconfirmed by me, before and after my own runs).
- Found a genuine, reproducible defect (proven on 3 independent channels by me, not just trusted).
- Correctly applied the task's own stated rule ("if it reveals a defect, STOP and report FAIL — bounces to T2") rather than patching around it.
- Disclosed the channel-workaround transparently, cross-validated it wasn't the cause of the error, and left zero trace in the repo (independently confirmed via `git status --short`).
- Kept the report free of PII and credentials (independently grepped).
- The one real gap is AC3's literal "run it a second time" — not executed. I judge this acceptable under AC4's explicit stop-condition given the defect is a deterministic syntax bug (independently reproduced 3 ways, always identical), not a flaky/data condition a second run could have distinguished — but it is a genuine, if minor, literal-AC gap, disclosed here rather than silently waved through.

**Artifact verdict (`docs/migracion/03-clientes-import-dry-run.sql`): FAIL.** Confirmed broken —
`Q1_not_null_columns_match` throws `operator does not exist: information_schema.sql_identifier[] =
text[]` on line 1338, aborting the entire dry run before any check output (Q2–Q7) is produced. This
bounces to T2 for rework (cast fix confirmed working, §2). T2's prior two QA rounds validated this
artifact only via Python-side data reproduction, never by executing the literal SQL against live
Postgres — this is the first live execution of this file, and it surfaced a defect neither round
could have caught by construction.

---

## Attack Log (per elibry-adversarial-qa)

- **RLS / org isolation:** N/A — ADR 0011, Elibry is single-tenant, no RLS by design; this task creates no table and touches no policy. Confirmed the file contains zero `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER TABLE` (already grep-checked in T2's QA; re-confirmed the file is byte-identical here via hash match in §1, so that grep result still holds).
- **Optimistic UI:** N/A — no UI change in this task.
- **Realtime:** N/A — no subscriber/view change in this task.
- **Edge cases tried:** re-derived the type of `information_schema.columns.column_name` live myself rather than trusting Postgres-docs recall; tried the dev's suggested fix live to confirm it actually resolves the error (not just plausible-sounding); tried `-f` vs inline multi-statement on the CLI to rule out `-f` behaving differently; ran the full unmodified file through my own independently-built workaround (not reusing the dev's script) to rule out the dev's specific script being the cause of the failure; re-hashed the SQL file after all my own live runs to rule out any incidental drift.
- **What I tried that could have broken this:** I tried to prove the dev fabricated or exaggerated the defect (by re-deriving the root cause from live `pg_typeof` output instead of trusting their Postgres-domain-type claim, and by reproducing the identical error through a completely independently-written script and a completely independent CLI invocation) — it held up on every channel; I also tried to find an out-of-scope file change or a leaked credential/PII — none found.

---

## Commands run (consolidated, for the hard-gates checklist)

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql   → matches t02-qa-r2 exactly, twice (before and after my live runs)
$ grep -n "Q1_not_null_columns_match" ...                        → line 1338, matches dev's quote
$ supabase db query ... "SELECT pg_typeof(column_name) ..."      → sql_identifier (live-confirmed)
$ supabase db query ... "SELECT (array_agg(column_name::text...) → true (fix confirmed working)
$ grep -n "information_schema" ...                                → only 1 executable occurrence
$ supabase db query -f docs/migracion/03-clientes-import-dry-run.sql          → prepared-statement error
$ supabase db query "SELECT 1; SELECT 2;"                                     → prepared-statement error
$ supabase db query ... (isolated Q1 subquery)                                → sql_identifier[]=text[] error
$ node run.js .../03-clientes-import-dry-run.sql --file (own scratch script)  → same error, full file
$ supabase db query ... "SELECT count(*), max(id) FROM clientes;"            → 1 / 15, before and after
$ ls docs/migracion/04-clientes-import-execute.sql                            → does not exist
$ git status --short                                                          → 8 entries, unchanged throughout
$ grep -inE "@gmail|cedula|identificacion|postgres://|SUPABASE_SERVICE_ROLE" reports/t03-dev.md → no matches
$ npm run qa  (tsc --noEmit && eslint . && vitest run)                        → 825/825 tests passed, 0 lint errors (warnings only, pre-existing), typecheck clean
```

## Acceptance criteria (plan §9 T3), scored against the diff + my own attacks

1. Live-executed, complete real output captured verbatim — **PASS** (the actual, complete output of
   running this file live IS the abort error; that is what was captured, verbatim, independently
   reproduced by me on 3 channels).
2. `count(*)` before/after identical — **PASS** (independently reconfirmed: 1/15 both times).
3. Run a second time, diff-identical — **PARTIAL / not literally done** (see §4; judged acceptable
   under AC4's stop condition given a deterministic syntax bug, but flagged as a literal gap, not
   silently passed).
4. Q3/Q4 grids PASS or loud FAIL-and-stop — **PASS** (loud FAIL correctly reported; grids
   independently confirmed unreachable, not omitted).
5. Q5 overflow report or escalation — **N/A, correctly** (never reached; not fabricated as passing).
6. Q6 relocation assertions MATCH — **N/A, correctly** (never reached).
7. Q7 final verdict quoted verbatim — **N/A, correctly** (never reached; the FAIL is the verdict).
8. No PII beyond counts/verdicts — **PASS** (independently grepped, clean).
9. No credential/host/connection string — **PASS** (independently grepped, only placeholder var names).
10. Rollback note, no git verb — **PASS** (read-only, nothing to revert, correctly stated).

## Out-of-scope changes
None. `git status --short` identical before and after this QA pass and the dev's task (8 entries,
same 8, verified independently).

## Bugs found
The one already reported by the dev, independently confirmed by me via 3 separate execution
channels and a live `pg_typeof` check: `docs/migracion/03-clientes-import-dry-run.sql:1338`
(`Q1_not_null_columns_match`) throws `operator does not exist: information_schema.sql_identifier[] =
text[]`, aborting the entire dry run before any check output is produced. No new bugs found by me;
no fabrication or exaggeration found in the dev's report.

## Suggested fixes
For T2 (not T3): cast the aggregate, `array_agg(column_name::text ORDER BY column_name) =
ARRAY[...]::text[]` — confirmed live by me to resolve to `true`. Also worth T2 adding one live
syntax-execution smoke test to its own QA loop (both prior QA rounds validated this file only via
Python-side data reproduction, never by executing it), so this class of defect is caught before
reaching T3.

---

**Verdict: PASS** (for T3's own task execution, per §7's explicit framing — the underlying artifact
`03-clientes-import-dry-run.sql` is independently confirmed FAIL and correctly bounces to T2).
