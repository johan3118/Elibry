# T3 ROUND 2 — Run the corrected dry run live, twice, and capture it

**Verdict: FAIL.** The live execution surfaced a **second, genuine, reproducible defect** in
`docs/migracion/03-clientes-import-dry-run.sql` — different from the one T3 round 1 found and T2
round 3 fixed — that again aborts the entire run before any Q2–Q7 check-grid output is produced.
Per task rules ("do NOT patch the SQL... a payload defect bounces back to T2"), I stopped, did not
edit the SQL file, and did not run a second full pass (nothing new to learn from re-running an
unmodified, unconditionally-broken file — same judgment call T3 round 1 made and documented).
**This bounces back to T2 for rework.**

---

## 1. Pre-flight integrity check — PASS (file matches T2 round 3's approved hashes exactly)

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4  docs/migracion/03-clientes-import-dry-run.sql
```
Matches `reports/t02-dev-r3.md`'s recorded output-sha256 (`63fbe5a1...0aba4`) exactly.

```
$ grep -n "payload-sha256" docs/migracion/03-clientes-import-dry-run.sql
19:-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```
Matches `reports/t02-dev-r3.md`'s recorded payload-sha256 (`9664ee4e...932392`) exactly.

**Conclusion:** the on-disk file is byte-identical to the round-3-approved artifact. Nothing has
drifted since t02 round 3's approval. Confirmed safe to execute (and confirmed, after the fact,
that the defect below was already present in that exact approved artifact, not introduced between
approval and this task).

`docs/migracion/04-clientes-import-execute.sql` does not exist (confirmed via `ls`: "No such file
or directory") — scope boundary intact.

---

## 2. Baseline count — PASS (matches T1's baseline)

Channel: Node + `pg`, simple query protocol (see §3 for why). Connection string read at runtime
from `.env.local`, never printed.

```
$ node pg_run.js baseline.sql
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
(`baseline.sql`: `SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;`)

`count=1`, `max_id=15` — matches T1's recorded baseline exactly.

---

## 3. Channel used — Node + `pg` (simple query protocol), same reasoning as T3 round 1

`supabase db query` executes via Postgres's extended/prepared-statement protocol, which rejects
any multi-statement text (`cannot insert multiple commands into a prepared statement`) — confirmed
again this round (unchanged Postgres behavior, not re-pasted here since round 1 already proved it
and nothing about that constraint changed). `psql` is still not installed on this machine
(`psql: command not found`).

**Channel actually used:** a small (~35 line) Node script (`pg_run.js`) using the `pg` npm
package's `Client.query(<multi-statement string>)` call, which uses the **simple query protocol**
(natively supports multi-statement text in one session, so `pg_temp` state persists across the
whole file, exactly as `psql -f` or the Supabase SQL editor would behave). Built entirely under
this session's private tool scratchpad directory
(`/private/tmp/claude-501/.../scratchpad/pgtool/`), reusing an already-present `pg`
`node_modules` install from an earlier round's scratch work in that same scratch directory — **not**
`Elibry/node_modules`, **not** `Elibry/package.json`, no repo file touched to build or run it.
Connection string read at runtime from `.env.local` via a tiny inline env-file parser (env var
value only, never printed or logged — only variable *names* appear in this report).

**Sanity check that the workaround genuinely preserves session state across statements** (run
fresh this round, not reused from round 1's report text):
```
$ node pg_run.js sanity.sql
{"command":"DROP","rowCount":null,"rows":[]}
{"command":"CREATE","rowCount":null,"rows":[]}
{"command":"INSERT","rowCount":2,"rows":[]}
{"command":"SELECT","rowCount":1,"rows":[{"count":"2"}]}
{"command":"SELECT","rowCount":2,"rows":[{"a":1},{"a":2}]}
```
(`sanity.sql`: `DROP TABLE IF EXISTS pg_temp._t3_sanity; CREATE TEMP TABLE _t3_sanity (a int);
INSERT INTO _t3_sanity VALUES (1),(2); SELECT count(*) FROM _t3_sanity; SELECT a FROM _t3_sanity
ORDER BY a;`) — the two `SELECT`s correctly see the temp table created and populated by the
earlier statements in the *same* batch/connection, proving one-connection, one-message,
multi-statement session semantics hold, faithful to how the real file would run under `psql -f`.

No repo file was touched to build or run any of this; only files under the session's private
scratchpad path were created or reused.

---

## 4. Run 1 — ABORTED on a real, reproducible defect (NEW defect, distinct from round 1's)

```
$ node pg_run.js docs/migracion/03-clientes-import-dry-run.sql
ERROR: argument of NOT must be type boolean, not type text
```

No result grid was produced. Nothing from Q2/Q3/Q4/Q5/Q6/Q7 was ever reached or captured — the
error aborts the whole implicit transaction (the simple query protocol treats one multi-statement
message with no explicit `BEGIN`/`COMMIT` as a single implicit transaction; the error rolls the
entire batch back, including the earlier successful staging `CREATE TEMP TABLE _clientes_import`
and its 1,231-row `INSERT`, and any `_checks` rows inserted before the failing statement).

**Root cause, isolated:** line 1341 of `docs/migracion/03-clientes-import-dry-run.sql`, the
`Q1_audit_clientes_trigger_absent` check:

```sql
INSERT INTO _checks(name, expected, actual) VALUES ('Q1_audit_clientes_trigger_absent', 'true',
  (SELECT NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass
                      AND tgname ILIKE '%audit%' AND NOT tgisinternal)::text));
```

This is an **operator-precedence bug**: in Postgres, the cast operator `::` binds *tighter* than
the `NOT` keyword. So `NOT EXISTS(...)::text` parses as `NOT (EXISTS(...)::text)` — i.e. `EXISTS`
evaluates to a boolean, is cast to `text` (producing the string `'true'` or `'false'`), and *then*
`NOT` is applied to that `text` value, which Postgres rejects: `argument of NOT must be type
boolean, not type text`. The neighboring line 1340 (`Q1_trigger_fecha_editado_present`) does not
have this bug because it has no leading `NOT`; line 1342
(`Q1_serial_sequence_resolvable`) does not have this bug because its whole boolean expression is
already wrapped in an extra pair of parens before the `::text` cast:
`((pg_get_serial_sequence(...) IS NOT NULL)::text)`. Line 1341 is missing that same wrapping —
the `NOT EXISTS(...)` needs to be parenthesized as a whole *before* the `::text` cast, e.g.
`(NOT EXISTS(...))::text`. (Fix, for T2, not applied here.)

**Grep for other instances of this bug class in the shipped file** (any bare `NOT` not covered by
`NOT IN`/`NOT NULL`/`NOT EXISTS(...)` immediately preceded by its own enclosing parens):
```
$ grep -n "NOT " docs/migracion/03-clientes-import-dry-run.sql
2:-- 03-clientes-import-dry-run.sql — READ-ONLY. DO NOT EDIT — generated by
62:--   telefonos            -> telefonos        verbatim if present; blank -> 'N/A' (NOT NULL, both types)
63:--   email                -> email            verbatim if present; blank -> 'N/A' (NOT NULL, both types)
64:--   direccion            -> direccion        verbatim if present; blank -> 'N/A' (NOT NULL, both types)
69:--   (no sheet column)    -> registrado_por   'N/A' for all rows (NOT NULL, no sheet source; app sets this from the logged-in user, absent for a bulk import)
1340:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_trigger_fecha_editado_present', 'true', (SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND tgname='trigger_update_clientes_fecha_editado' AND NOT tgisinternal)::text));
1341:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_audit_clientes_trigger_absent', 'true', (SELECT NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND tgname ILIKE '%audit%' AND NOT tgisinternal)::text));
1342:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_serial_sequence_resolvable', 'true', ((pg_get_serial_sequence('public.clientes','id') IS NOT NULL)::text));
1347:INSERT INTO _checks(name, expected, actual) VALUES ('Q3_compania_other_values_0', '0', (SELECT count(*)::text FROM _clientes_import WHERE compania NOT IN ('MARCA 1','MARCA 2')));
```
Lines 2/62/63/64/69 are comments, not executable SQL. Line 1340's inner `AND NOT tgisinternal` is
inside the `EXISTS(...)` subquery, evaluated in boolean context there — not cast, not broken. Line
1347's `NOT IN` is a different operator entirely (no adjacent `::text` cast on its own boolean
result at the top level — it's inside a `count(*)` aggregate). **Line 1341 is the only site with
this exact bug** (a bare `NOT EXISTS(...)` at the top level of a `SELECT`, immediately followed by
`::text` with no enclosing parens around the whole `NOT EXISTS(...)` expression).

---

## 5. Independent reproduction (rules out a workaround artifact) — both channels, and the fix confirmed

**(a) Scratch Node/pg runner, isolated single statement:**
```
$ node pg_run.js isolate2.sql
ERROR: argument of NOT must be type boolean, not type text
```
(`isolate2.sql` is the exact `SELECT` from line 1341, extracted verbatim, run alone.)

**(b) The literally-named channel, `supabase db query` (single statement, no multi-statement
issue possible, no workaround needed):**
```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" \
  "SELECT NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND tgname ILIKE '%audit%' AND NOT tgisinternal)::text;"
Connecting to remote database...
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: argument of NOT must be type boolean, not type text"}}
```

Identical server-side error on both channels — genuine defect in the SQL text, not an artifact of
the workaround, not a connectivity/521 issue (no 521 was seen at any point this round), not
something a retry fixes.

**Confirmed the parenthesized fix actually resolves it, on both channels** (diagnostic only — not
applied to the shipped file):

(a) Scratch Node/pg runner:
```
$ node pg_run.js isolate2_fixed.sql
{"command":"SELECT","rowCount":1,"rows":[{"text":"true"}]}
```
(`isolate2_fixed.sql`: same predicate with `(NOT EXISTS(...))::text` — parens moved to wrap the
whole `NOT EXISTS(...)` before the cast.)

(b) `supabase db query`:
```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" \
  "SELECT (NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND tgname ILIKE '%audit%' AND NOT tgisinternal))::text;"
Connecting to remote database...
{ "rows": [ { "text": "true" } ] }
```
(RLS-disabled advisory boilerplate omitted here — Supabase CLI standard noise, ADR 0011,
unrelated to this task, same convention as prior reports in this sprint.)

Also independently confirmed the underlying trigger fact this check is testing for (diagnostic
only, matches "expected"):
```
$ node pg_run.js diag.sql
{"command":"SELECT","rowCount":1,"rows":[{"audit_trigger_exists":false}]}
```
`audit_clientes`-style trigger genuinely does not exist on `clientes` (consistent with T1's Q6
finding) — so the check's *intended* logic (`expected='true'` for "no audit trigger exists") is
correct; only the SQL's operator precedence is broken, not the check's design or its expected
value.

---

## 6. Post-run count check — PASS (proves read-only held even under a mid-batch failure)

```
$ node pg_run.js baseline.sql
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
Still `count=1`, `max_id=15`. The aborted run left the live database completely unchanged —
the implicit transaction rolled back all temp-table work; there was never any write against a
real table to begin with.

**Final count, once more, at the very end of this task's work (unchanged):**
```
$ node pg_run.js baseline.sql
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```

---

## 7. Steps not performed, and why

- **Run 2 / diff of two runs (task step 4):** not performed. Re-running the identical, unmodified
  file would reproduce the identical parse/execution error at the same line before reaching any
  new statement — there is nothing to diff, and running it again would not surface new
  information. This is the same judgment call T3 round 1 made and documented for the same reason
  (aborting on a syntax-level defect is deterministic, not a flake). Skipped rather than padding
  the report with a second identical failure.
- **Q1 (remaining rows)/Q2/Q3/Q4/Q5/Q6/Q7 acceptance-gate checks (task steps 6–8), including the
  specific `Q4_backfill_sexo_402` and `Q1_not_null_columns_match` rows this round was specifically
  asked to re-prove hold live:** **could not be verified at all.** The batch aborts at the
  `Q1_audit_clientes_trigger_absent` statement (line 1341), which runs in file order *after*
  `Q1_not_null_columns_match` (line 1338, this round's fix target — see §8 below, this one line
  DID get to run and DID insert its `_checks` row before the batch failed) but *before* any
  `Q2`/`Q3`/`Q4`/`Q5`/`Q6` `INSERT INTO _checks` statement is reached, and the transaction rollback
  discards even the `Q1` rows that were inserted before the fatal statement (nothing survives the
  implicit-transaction rollback — there is no partial `_checks` table left to `SELECT` from after
  the error). I did not weaken this by testing checks out of order, by wrapping individual
  statements in savepoints, or by patching around the broken statement — any of those would be
  reconstructing/patching the file's execution semantics, which is explicitly forbidden by this
  task's scope.

## 8. Specifically on item 7 of the task ("prove the round-3 fix holds") — partial answer only

The task explicitly asked me to confirm, quoting the exact row, that `Q1_not_null_columns_match`
reads `PASS` with `actual=true` live now (the round-1/round-3 fix). I can only give a **partial,
non-authoritative** answer: I isolated that exact corrected predicate (line 1338, unchanged since
round 3) as its own single statement and ran it live — it does return `true`:
```
$ node pg_run.js isolate_q1_notnull.sql
{"command":"SELECT","rowCount":1,"rows":[{"text":"true"}]}
```
(`isolate_q1_notnull.sql`: the exact `array_agg(column_name::text ORDER BY column_name::text) =
ARRAY[...]::text[]` predicate from line 1338, extracted verbatim.) This corroborates T2 round 3's
own isolated re-proof and shows the round-1 defect genuinely stays fixed in isolation. **However,
this is not the same thing as the check passing inside the actual file's `_checks` table**, since
the file as a whole never completes a run to produce that row — the batch aborts two statements
later (line 1341) before any `SELECT * FROM _checks` or final verdict is reached. I am not
claiming `Q1_not_null_columns_match` "reads PASS" in the file's own output, because **no such
output was ever produced this round** — only that its predicate, tested in isolation, still
evaluates correctly. The acceptance gate (task step 6) is not met because the file does not run to
completion at all.

---

## 9. Files touched

Per `git status --short` before and after this task, **8 of 8** pre-existing changed/untracked
top-level repo entries are unchanged, and exactly **0** new top-level entries were added (my new
report file sits inside the already-untracked sprint directory, per the same convention every
prior report in this sprint has used):

```
$ git status --short   (before and after — identical)
 M CLAUDE.md                                              (pre-existing, not touched by me)
?? .DS_Store                                              (pre-existing, not touched by me)
?? .claude/rules/context-budget.md                        (pre-existing, not touched by me)
?? docs/migracion-clientes.xlsx                           (pre-existing, not touched by me)
?? docs/migracion/03-clientes-import-dry-run.sql          (pre-existing, not touched by me — verified unchanged, §1)
?? docs/migracion/generate-clientes-import.py             (pre-existing, not touched by me)
?? docs/plans/clientes-xlsx-import.md                     (pre-existing, not touched by me)
?? docs/sprints/2026-09-22-clientes-xlsx-import/          (this report + scratchpad append live here)
```

Files changed by this task: this report file (new,
`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-dev-r2.md`) and a small append to
`docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (ledger row + handoff block).
`reports/t03-dev.md` and `reports/t03-qa.md` (round 1's evidence) were read for context and are
untouched. The scratch npm project and Node runner scripts used for the workaround
(`pg_run.js`, `run_supabase_cli.js`, `sanity.sql`, `baseline.sql`, `isolate2.sql`,
`isolate2_fixed.sql`, `diag.sql`, `isolate_q1_notnull.sql`) live entirely under this session's
private scratchpad directory (`/private/tmp/claude-501/.../scratchpad/pgtool/`), outside the
repository, and are not part of the repo's file tree (confirmed by the `git status --short`
comparison above).

## 10. Redaction check

No connection string, anon key, or service-role key appears anywhere above (only env-var *names*
like `POSTGRES_URL_NON_POOLING` and script filenames are shown; the actual connection string was
read at runtime from `.env.local` and never printed or logged). No client PII (names, emails,
phones, cedulas, `identificacion` values) appears above — every value quoted is a column name, a
trigger name, a count, a boolean, a SHA-256 hash, or a Postgres error string. No grid row in this
report ever reached a state where client data could have been printed, since the batch aborted
before any `_clientes_import`-derived `SELECT` could run.

## 11. Rollback note

Read-only task; the live database was never written to (confirmed unchanged before, mid-task, and
at the very end — §2, §6 — even across the aborted run). Nothing to revert in the database. In the
repo, reverting means deleting this report file and reverting the scratchpad append — no git verb
needed since nothing else changed. No `docs/migracion/04-clientes-import-execute.sql` was created,
drafted, or run. No DDL was run against the `public` schema (only the file's own `pg_temp` TEMP
TABLE DDL was reached before the abort, and that was rolled back with everything else).

## 12. Handoff to T2 (rework required, round 2)

`docs/migracion/03-clientes-import-dry-run.sql`'s `Q1_audit_clientes_trigger_absent` check
(line 1341) throws `argument of NOT must be type boolean, not type text` and aborts the entire dry
run before any Q2–Q7 check-grid output is produced — a **second, distinct** live-syntax defect
from the one T3 round 1 found and T2 round 3 fixed (that one was a `sql_identifier[] = text[]`
type-comparison error at line 1338; this one is an operator-precedence error at line 1341,
`NOT EXISTS(...)::text` parsing as `NOT (EXISTS(...)::text)` because `::` binds tighter than
`NOT`). Suggested fix (T2's call, not mine): wrap the whole `NOT EXISTS(...)` in its own parens
before the cast, e.g. `(NOT EXISTS(SELECT 1 FROM pg_trigger WHERE ... AND NOT tgisinternal))::text`
— the same pattern the file's own neighboring `Q1_serial_sequence_resolvable` check (line 1342)
already uses correctly (`((... IS NOT NULL)::text)`). I re-grepped the whole file for any other
instance of this same bug class (a bare `NOT <expr>` immediately followed by `::text`/`::type`
with no enclosing parens around the whole negated expression) and found **exactly one** site
(line 1341) — see §4's grep. T2 should also re-grep for this specific pattern as part of its own
regeneration/verification loop, and should strongly consider actually **executing** the file live
(single read-only pass, no writes) as its own pre-submission gate before handing it to T3 again,
since this is now the second live-syntax defect in a row that a pure Python-side data
re-derivation approach could not have caught (neither defect is a data/logic bug — both are pure
Postgres syntax/type errors that only surface when the literal SQL text is executed).

**Backlog note for the lead (not actioned, not in scope for this task):** two live-syntax defects
across two T3 rounds, in different checks, both undetected by T2's own QA (rounds 1-3) because
that QA validates check *logic and expected values* by independent Python re-derivation, never by
executing the literal SQL. This reinforces round 1's flagged CBrain `mistakes/` candidate: dry-run
SQL generators need at least one live syntax-execution smoke test (even just "does the whole file
run to completion once, read-only, against a real Postgres instance") as part of T2's own
pre-submission checklist, not deferred entirely to T3.
