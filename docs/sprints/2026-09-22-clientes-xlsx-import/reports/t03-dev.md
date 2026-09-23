# T3 — Run the dry run live, twice, and capture it

**Verdict: FAIL.** The live execution surfaced a genuine, reproducible defect in the shipped
`docs/migracion/03-clientes-import-dry-run.sql` that aborts the entire run before any check-grid
output is produced. Per task rules ("If it reveals a defect, STOP and report FAIL — this task
fails back to T2, you do not patch it"), I stopped, did not edit the SQL file, and did not run a
second pass. **This bounces back to T2 for rework.**

---

## 1. Pre-flight integrity check — PASS

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
90fff4202dd193d1c67ff41f4c8c0bac86e1a4c5c94861d143b5c4e4a85f9c1f  docs/migracion/03-clientes-import-dry-run.sql
```
Matches `reports/t02-qa-r2.md`'s recorded output-sha256 (`90fff420...f9c1f`) exactly.

The file's own embedded payload header line:
```
-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```
Matches `reports/t02-qa-r2.md`'s recorded payload-sha256 (`9664ee4e...932392`) exactly.

**Conclusion:** the on-disk file is byte-identical to the round-2-approved artifact. Confirmed
safe to execute (and confirmed, after the fact, that the defect below was *already present* in
the approved artifact — it is not something introduced between T2 approval and this task).

`docs/migracion/04-clientes-import-execute.sql` does not exist (confirmed via `ls`, exit
"No such file or directory") — scope boundary intact.

---

## 2. Baseline count — PASS (matches T1's baseline)

```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" \
    "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
Connecting to remote database...
{
  "advisory": { "id": "rls_disabled", ... 27-table RLS-disabled advisory, ADR 0011, expected noise ... },
  "rows": [ { "cnt": 1, "max_id": 15 } ]
}
```
`count=1`, `max(id)=15` — matches T1's recorded baseline exactly. (The RLS-disabled advisory is
Supabase CLI boilerplate, not a finding — Elibry is single-tenant per ADR 0011, no orgs/RLS by
design, unrelated to this task; omitted from later blocks below to stay bounded, per the same
convention T1 used.)

---

## 3. Channel note — `supabase db query` cannot run this file; documented, sanctioned workaround used

The task named the channel `supabase db query --db-url "$POSTGRES_URL_NON_POOLING"`. Attempting
to run the dry-run file (`-f docs/migracion/03-clientes-import-dry-run.sql`, and equivalently
inline) fails immediately, **before reaching any actual check**, because the file is
multi-statement (it mirrors `01-cleanup-dry-run.sql`'s convention: `DROP TABLE` / `CREATE TEMP
TABLE` / staging `INSERT` / more `INSERT INTO _checks` / final `SELECT`s — ~47 top-level
statements sharing one `pg_temp` session), and the Supabase CLI always executes via Postgres's
extended/prepared-statement protocol, which Postgres itself rejects for multi-statement text:

```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" -f docs/migracion/03-clientes-import-dry-run.sql
Connecting to remote database...
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: cannot insert multiple commands into a prepared statement"}}

$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" "SELECT 1; SELECT 2;"
Connecting to remote database...
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: cannot insert multiple commands into a prepared statement"}}
```

This is a hard Postgres protocol restriction (`PREPARE` cannot hold >1 command), not a 521, not
a host-down condition, and not fixable by retrying. `psql` (which does not have this restriction —
it uses the simple query protocol) is confirmed not installed on this machine (per T1, re-confirmed
here: `psql: command not found`).

**Workaround (mechanism substitution only, no file/logic change):** I used Node's `pg` driver
(the same underlying wire protocol library psql-equivalents use), installed into an **isolated
scratch directory outside the repo** (`npm init` + `npm install pg` under this session's
tool-provided scratchpad dir — not `Elibry/node_modules`, not `Elibry/package.json`, not any repo
path; confirmed by `git status --short` before/after, no diff) with a ~50-line runner script
(also scratch-only) that connects once with `pg.Client`, using `PG_CONN_STRING` read at runtime
from `.env.local` (env var only, never printed, never logged), and calls
`client.query(fs.readFileSync(sqlFile, 'utf8'))` — the simple query protocol, which natively
supports multi-statement text in one session (so `pg_temp` state persists across the whole file,
exactly as it would under `psql -f` or the Supabase SQL editor). This connects to the **same**
live database via the **same** connection string, executes the **unmodified on-disk file**
byte-for-byte, and is not a reconstruction or retyping of its SQL — it is the identical file text,
just handed to a client library that doesn't impose the prepared-statement restriction. No repo
file was touched to build or run this; only files under the tool's private scratchpad path were
created. This is offered as a transparent methodology deviation from the literally-named channel
(the named channel is provably incapable of running this specific multi-statement artifact) — not
an architectural decision about the product, only about which local SQL client executes the read.
If this substitution itself is unacceptable, the lead should say so and I will stop and hand the
file to the human to run in the Supabase SQL editor instead — but see §4, the run failed on a real
defect regardless of channel, and I independently reproduced the identical server-side error via
the officially-named `supabase db query` channel too (§5), so the defect is not an artifact of
this workaround.

Sanity check that the workaround genuinely preserves session state across statements (proof the
substitution is faithful before trusting it on the real file):
```
$ PG_CONN_STRING=... node run.js sanity.sql   # DROP/CREATE TEMP TABLE/INSERT 2 rows/2 SELECTs
--- statement result: command=DROP rowCount=null ---
--- statement result: command=CREATE rowCount=null ---
--- statement result: command=INSERT rowCount=2 ---
--- statement result: command=SELECT rowCount=1 ---
[ { "count": "2" } ]
--- statement result: command=SELECT rowCount=2 ---
[ { "a": 1 }, { "a": 2 } ]
```

---

## 4. Run 1 — ABORTED on a real, reproducible defect

```
$ PG_CONN_STRING=... node run.js docs/migracion/03-clientes-import-dry-run.sql
ERROR: operator does not exist: information_schema.sql_identifier[] = text[]
```

No result grid was produced. Nothing from Q2/Q3/Q4/Q5/Q6/Q7 was ever reached or captured — the
error aborts the whole implicit transaction (the simple query protocol treats one multi-statement
message with no explicit `BEGIN`/`COMMIT` as a single implicit transaction; the error rolls the
entire batch back, including the earlier successful staging `CREATE TEMP TABLE _clientes_import`
and its 1,231-row `INSERT`, and any `_checks` rows inserted before the failing statement).

**Root cause, isolated:** line 1338 of `docs/migracion/03-clientes-import-dry-run.sql`,
the `Q1_not_null_columns_match` check:

```sql
INSERT INTO _checks(name, expected, actual) VALUES ('Q1_not_null_columns_match', 'true',
  (SELECT (array_agg(column_name ORDER BY column_name) =
           ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[]
          )::text
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO'));
```

`information_schema.columns.column_name` is of domain type `information_schema.sql_identifier`
(built on `name`), not `text`. `array_agg()` over it produces `sql_identifier[]`. Postgres has no
`=` operator for `sql_identifier[] = text[]`, and does not apply an implicit per-element cast
across the two array types for equality — hence `operator does not exist`. (Fix, for T2, not
applied here: cast the aggregated value, e.g. `array_agg(column_name::text ORDER BY
column_name) = ARRAY[...]::text[]`.)

---

## 5. Independent reproduction (rules out a workaround artifact)

Isolated the exact failing subquery and ran it as a **single statement** (no multi-statement
issue possible) through **both** channels:

**(a) Scratch Node/pg runner:**
```
$ PG_CONN_STRING=... node run.js isolate.sql
ERROR: operator does not exist: information_schema.sql_identifier[] = text[]
```

**(b) The literally-named channel, `supabase db query` (single statement, no workaround needed):**
```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" \
  "SELECT (array_agg(column_name ORDER BY column_name) = ARRAY['compania','direccion','email','id','registrado_por','status','telefonos','tipo_cliente']::text[])::text FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO';"
Connecting to remote database...
{"_tag":"Error","error":{"code":"LegacyDbQueryExecError","message":"failed to execute query: error: operator does not exist: information_schema.sql_identifier[] = text[]"}}
```

Identical server-side error on both channels. This is a genuine defect in the SQL text, not an
artifact of the workaround, not a connectivity/521 issue, and not something a retry fixes.

---

## 6. Post-run count check — PASS (proves read-only held even under a mid-batch failure)

```
$ supabase db query --db-url "$POSTGRES_URL_NON_POOLING" \
    "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
Connecting to remote database...
{ "rows": [ { "cnt": 1, "max_id": 15 } ] }
```
Still `count=1`, `max(id)=15`. The aborted run left the live database completely unchanged —
consistent with "read-only by construction" holding true even when the batch errors out mid-way
(the implicit transaction rolled back the temp-table work; there was never any write against a
real table to begin with).

---

## 7. Steps not performed, and why

- **Run 2 / diff of two runs:** not performed. Re-running the identical, unmodified file would
  reproduce the identical error — there is nothing to diff, and running it again would not surface
  new information. Skipped rather than padding the report with a second identical failure.
- **Q3/Q4/Q5/Q6/Q7 acceptance-gate checks (task steps 8–10), including the specific
  `Q4_backfill_sexo_402` row (the exact defect T2 round 1 failed on):** **could not be verified at
  all.** The batch aborts at the `Q1_not_null_columns_match` statement, which runs before any of
  the `Q3`/`Q4`/`Q5`/`Q6` `INSERT INTO _checks` statements are reached in file order, and the
  transaction rollback discards even the `Q1` rows that were inserted before the fatal statement.
  There is no partial output to quote. I did not weaken this by testing checks out of order or by
  patching around the broken statement — that would be reconstructing/patching the file, which is
  explicitly forbidden.

---

## 8. Files touched

Per `git status --short` before and after this task, **0 of 8** pre-existing changed/untracked
repo entries were touched by me, and exactly **1** new repo file was added:

```
$ git status --short
 M CLAUDE.md                                              (pre-existing, not touched by me)
?? .DS_Store                                              (pre-existing, not touched by me)
?? .claude/rules/context-budget.md                        (pre-existing, not touched by me)
?? docs/migracion-clientes.xlsx                           (pre-existing, not touched by me)
?? docs/migracion/03-clientes-import-dry-run.sql          (pre-existing, not touched by me — verified unchanged, §1)
?? docs/migracion/generate-clientes-import.py             (pre-existing, not touched by me)
?? docs/plans/clientes-xlsx-import.md                     (pre-existing, not touched by me)
?? docs/sprints/2026-09-22-clientes-xlsx-import/          (this report + scratchpad append live here)
```

Files changed by this task: `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-dev.md`
(new) and a small append to `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (ledger
row + handoff block). The scratch npm project and Node runner script used for the workaround live
entirely under this session's private tool scratchpad directory, outside the repository, and are
not part of the repo's file tree.

## 9. Redaction check

No connection string, anon key, or service-role key appears anywhere above (only the `$VAR_NAME`
placeholder is shown in every command). No client PII (names, emails, phones, cedulas,
`identificacion` values) appears above — every value quoted is a column name, a count, a boolean,
or a Postgres error string.

## 10. Rollback note

Read-only task; the live database was never written to (confirmed unchanged before and after,
§2 and §6, even across the aborted run). Nothing to revert in the database. In the repo, reverting
means deleting this report file and reverting the scratchpad append — no git verb needed since
nothing else changed.

## 11. Handoff to T2 (rework required)

`docs/migracion/03-clientes-import-dry-run.sql`'s `Q1_not_null_columns_match` check
(line 1338) throws `operator does not exist: information_schema.sql_identifier[] = text[]` and
aborts the entire dry run before any check-grid output is produced. This was never caught by T2
QA rounds 1 or 2 because both rounds verified expected-vs-actual values by independently
re-deriving them in Python against the raw payload / generator logic, not by executing this
literal SQL text against a live Postgres server — this task (T3) is the first time this file has
ever actually been run against a real database. Suggested fix (T2's call, not mine): cast the
aggregated column explicitly, e.g. `array_agg(column_name::text ORDER BY column_name) =
ARRAY[...]::text[]`. T2 should also grep the full file for every other use of
`information_schema.columns` (or any other `information_schema` view) to rule out the same
`sql_identifier`/`text` mismatch elsewhere, and should add a live syntax-execution smoke test to
its own QA loop rather than relying solely on data-level Python reproduction, so this class of bug
cannot reach T3 again.

**Backlog note for the lead (not actioned, not in scope for this task):** the T2 QA process (both
rounds) validated this artifact's logic without ever executing it against a live Postgres backend.
Worth a CBrain `mistakes/` entry: dry-run SQL generators need at least one live syntax-execution
pass before QA sign-off, not deferred entirely to the "run it live" task.
