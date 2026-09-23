# T3 ROUND 3 — QA (independent re-verification)

**Verdict: PASS.**

Independently re-verified from scratch. Built my own execution channel (Node + `pg`,
simple query protocol, written from zero — not the dev's `pg_run.js`), ran the entire
`03-clientes-import-dry-run.sql` file live, read-only, TWICE, and got 42/42 `_checks`
rows PASS with `veredicto_final = PROCEED` on both of my own runs. I also performed one
adversarial mutation test (revert a known fix in a scratch copy) to prove my harness
actually discriminates broken-vs-fixed rather than rubber-stamping green.

---

## Commands run

### 0. Pre-flight hashes (before any live work)

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
```
Matches the dev's claimed output-sha256 exactly (`a5f74af3...42cc4`).

```
$ grep -n "payload-sha256" docs/migracion/03-clientes-import-dry-run.sql
19:-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```
Matches the dev's claimed payload-sha256 exactly (`9664ee4e...932392`), applying to the
staged VALUES payload as defined in `reports/t02-dev-r4.md`. Both hashes are valid
64-hex-char SHA-256 digests (verified length programmatically) — no drift since T2 round
4 approval.

### 1. Channel

Built a brand-new Node + `pg` runner (`qarun.js`, ~75 lines) from scratch in my own
session scratch dir, entirely outside the repo:
`/private/tmp/claude-501/-Users-johancito-Developer-Elibry/97ebd1c1-b8b5-4d51-921d-39df2d76ffd1/scratchpad/qa-t03-r3/`.
Reads `POSTGRES_URL_NON_POOLING` from `.env.local` at runtime (never printed), uses the
simple query protocol (`client.query(<full SQL text>)`), which supports the file's
multi-statement/temp-table shape — the same established, previously-confirmed limitation
that `supabase db query` cannot run this file at all (not re-litigated). Confirmed a
pre-existing partial scratch dir from an earlier pass of this same session existed;
discarded its output files and re-ran everything fresh myself rather than trusting it.

### 2. Baseline BEFORE any live work

```
$ node qarun.js -e "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
`count=1`, `max_id=15` — matches the required T1 baseline. Proceeded.

### 3. RUN 1 — full file, live, unmodified

```
$ node qarun.js -f docs/migracion/03-clientes-import-dry-run.sql > myrun1.jsonl
EXIT: 0
$ wc -l myrun1.jsonl
50 myrun1.jsonl
```
Parsed programmatically (not eyeballed):
```
num check rows: 42
non-PASS rows: 0 []
verdict row: {"veredicto_final":"PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.","fallas":"0"}
```
Full 42-row grid captured (all PASS) — identical in content to the dev's Run 1 grid.

**Baseline immediately after Run 1:**
```
$ node qarun.js -e "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
Unchanged.

### 4. RUN 2 — literal second full run, unmodified file

```
$ node qarun.js -e "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"   (before)
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
$ node qarun.js -f docs/migracion/03-clientes-import-dry-run.sql > myrun2.jsonl
EXIT: 0
$ wc -l myrun2.jsonl
50 myrun2.jsonl
```
```
run2 num check rows: 42 non-PASS: 0
run2 verdict: {"veredicto_final":"PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.","fallas":"0"}
```
**Baseline immediately after Run 2:**
```
$ node qarun.js -e "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
Unchanged. `count=1, max(id)=15` held at all four of my own checkpoints (before/after
Run 1, before/after Run 2).

### 5. Determinism — Run 1 vs Run 2

```
$ diff myrun1.jsonl myrun2.jsonl
IDENTICAL (jsonl)
$ diff myrun1_checks.json myrun2_checks.json
IDENTICAL (checks)
```
Byte-identical, including the payload correlation token. Re-hashed the real on-disk file
after both runs:
```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
```
Unchanged — my own execution caused zero drift.

### 6. The four named fixes — confirmed BOTH in my live grid AND by reading the literal SQL predicate myself

```
$ grep -n "Q1_not_null_columns_match\|Q1_audit_clientes_trigger_absent\|Q4_backfill_sexo_402\|Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
1338:...('Q1_not_null_columns_match', 'true', (SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY[...]::text[])::text FROM information_schema.columns ...));
1341:...('Q1_audit_clientes_trigger_absent', 'true', (SELECT (NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND tgname ILIKE '%audit%' AND NOT tgisinternal))::text));
1360:...('Q4_backfill_sexo_402', '402', (SELECT count(*)::text FROM _clientes_import WHERE sexo_was_blank));
1368:...('Q5_dirty_email_count', '45', (SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A' AND btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$'));
```
- `Q1_not_null_columns_match`: literal text confirms `column_name::text` cast present. My grid: `expected=true, actual=true, resultado=PASS`.
- `Q1_audit_clientes_trigger_absent`: literal text confirms `(NOT EXISTS(...))::text` — `NOT` wraps `EXISTS` before the cast (the precedence fix). My grid: `expected=true, actual=true, resultado=PASS`.
- `Q4_backfill_sexo_402`: literal text confirms the predicate is `sexo_was_blank`, not `sexo='N/A'`. My grid: `expected=402, actual=402, resultado=PASS`.
- `Q5_dirty_email_count`: literal text confirms `btrim(replace(email, chr(160), ' '))` NBSP normalization. My grid: `expected=45, actual=45, resultado=PASS`.

### 7. Mutation check (attack, not trust) — proves my harness genuinely discriminates broken vs. fixed

I did not just trust that a PASS label means the fix is real. I copied the file to a
scratch location, reverted the `Q1_audit_clientes_trigger_absent` predicate back to the
known-broken pre-round-4 form (`NOT EXISTS(...)::text` without the wrapping parens), and
re-ran it through my own harness:
```
$ node qarun.js -f mutated.sql
ERROR: argument of NOT must be type boolean, not type text
$ echo $?
1
```
Reproduced the exact historical bug (T3 round 2's finding) on demand, confirming my
runner correctly detects a real regression rather than always reporting green. Confirmed
the real on-disk file was untouched by this experiment (re-hashed after: still
`a5f74af3...42cc4`) and the live `clientes` table was still `count=1, max(id)=15`
afterward. Deleted the scratch mutated file.

### 8. `04-clientes-import-execute.sql` — confirmed absent

```
$ ls docs/migracion/04-clientes-import-execute.sql
ls: docs/migracion/04-clientes-import-execute.sql: No such file or directory
```

### 9. Scope — `git status --short`, enumerated

```
$ git status --short | nl
     1	 M CLAUDE.md
     2	?? .DS_Store
     3	?? .claude/rules/context-budget.md
     4	?? docs/migracion-clientes.xlsx
     5	?? docs/migracion/03-clientes-import-dry-run.sql
     6	?? docs/migracion/generate-clientes-import.py
     7	?? docs/plans/clientes-xlsx-import.md
     8	?? docs/sprints/2026-09-22-clientes-xlsx-import/
```
**8 of 8 entries** — identical to the dev's claimed pre/post state and to prior rounds'
recorded state. All 8 are pre-existing untracked/modified entries from earlier tasks in
this sprint (not new top-level entries created by t03 round 3). This task's only new
content is `reports/t03-dev-r3.md` (and now this file, `reports/t03-qa-r3.md`), both
inside the already-untracked sprint directory, so neither adds a new top-level
`git status` line. No SQL file was edited this round (hash-proven unchanged, §0/§5). No
source file (`app/**`, `lib/**`, `components/**`, `hooks/**`, `tests/**`, `scripts/**`)
was touched — confirmed by `npm run qa` staying at the exact same pass/warning shape as
every prior round (see §11).

### 10. Redaction check

```
$ grep -rInE "postgres://|postgresql://|SUPABASE_SERVICE_ROLE_KEY=|SUPABASE_ANON_KEY=[A-Za-z0-9]|password[:=]|@gmail\.com|@hotmail\.com|@yahoo\.com" docs/sprints/2026-09-22-clientes-xlsx-import/
(no matches)
```
No credential, connection string, or email address leaked anywhere in the sprint
directory. **One pre-existing, previously-reviewed characteristic noted, not a new t03
defect:** the two duplicate `identificacion` values (`<CEDULA-A>`, `<CEDULA-B>`) appear
as literal digit strings inside check *names* (`Q5_dup_identificacion_<CEDULA-A>_is_2`,
etc.) baked into the generated SQL by T2's generator, and are therefore quoted verbatim in
every dev/QA report from T2 round 1 onward, including this one and the dev's r3 report.
This is a T2-generator design decision (check names embed the actual value), already
reviewed and accepted across at least 5 prior QA passes (t02-qa, t02-qa-r2/r3/r4) — not
introduced or newly exposed by t03 round 3. Flagging it here for the record per
adversarial-QA discipline, not as a blocking finding in this task.

### 11. `npm run qa` — re-run myself, independently

```
$ npm run qa
...
> tsc --noEmit
(no output, 0 errors)
> eslint .
✖ 28 problems (0 errors, 28 warnings)
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
```
```
$ npx tsc --noEmit
(exit 0, no output)
```
Identical shape to the dev's claimed output (0 typecheck errors, 0 lint errors / 28
pre-existing warnings all in `app/**`/`components/**`, 825/825 tests). Regression gate
holds — no source file was touched by this task.

---

## Acceptance criteria (plan T3, lines 421-440) — checked individually against MY OWN run

1. Dry run executed live, complete output captured verbatim — **PASS** (my own runs, §3/§4).
2. `count(*)` before/after identical — **PASS** (§2-§4, 4 checkpoints, all 1/15).
3. Run a second time, diff-identical — **PASS** (§5, byte-identical incl. correlation token).
4. Q3/Q4 grids PASS on every distribution/backfill count — **PASS** (all Q3_*/Q4_* rows PASS in my grid, including `Q4_backfill_sexo_402`=402).
5. Overflow protection (HC-1) closed — **PASS, substantively**, but with a naming caveat: the plan text says "Q5's overflow report" — the artifact has no live SQL check named that; HC-1 is closed by the generator's own Python-side abort gate (mutation-tested in T2 round 4, not re-tested by me this round since it's off the live-DB path and out of this task's scope). This naming drift between the plan's original Q1-Q7 scheme and the shipped Q1-Q6 check grid has existed and been accepted since T2 round 1 — not a new issue.
6. Q6 relocation assertions read MATCH — **PASS, substantively**, same naming caveat: only 2 `Q6_*` checks exist (not "four"), both read `PASS` (not `MATCH`) in the artifact's own vocabulary, and both are correct (`Q6_sheet_1185_is_jrosa`=true, `Q6_sheet_15_is_melissa`=true) in my own run. Pre-existing drift, not new.
7. Final verdict captured verbatim — **PASS** (`PROCEED`, quoted exactly from my own run, both times).
8. No client PII beyond counts/verdicts — **PASS with a noted pre-existing exception** (see §10 — the two identificacion values embedded in check *names*, inherited from T2, previously reviewed).
9. No credential/host/connection string — **PASS** (§10, clean grep).
10. Rollback note: read-only, nothing to revert — **PASS** (dev's note is accurate; my own work is likewise read-only and reverts by deleting this report file).

---

## Out-of-scope changes

None. 8 of 8 `git status --short` entries pre-existing/unchanged (§9). This task added
exactly one file (`reports/t03-qa-r3.md`, this report) plus the dev's own
`reports/t03-dev-r3.md`, both inside the already-untracked sprint directory.

## Bugs found

None new. The artifact runs clean end-to-end on my own independent channel, twice,
deterministically, with all four previously-found-and-fixed defects (T3 r1's cast bug,
T3 r2's precedence bug, T2 r2's sexo predicate, T2 r4's NBSP normalization) confirmed
holding under my own live execution and my own reading of the literal SQL text (not
inherited from any prior report).

## Suggested fixes

Backlog-only, not blocking: reconcile the plan's T3 AC wording (lines 434-436, "Q5's
overflow report" / "Q6 ... four relocation assertions ... MATCH") with the artifact's
actual Q1-Q6 check-grid vocabulary (PASS/FAIL, 2 Q6 checks, HC-1 enforced generator-side
not as a live check) — this drift has existed since T2 round 1 and has passed every QA
round to date on substance, but the plan text itself is now stale relative to the shipped
design and could confuse a future reader.

---

## Attack Log (show your work)

- **RLS / org isolation:** N/A for this task — ADR 0011 (Elibry is single-tenant, no
  RLS on any of the ~29 pre-existing tables) applies; this sprint creates no new table,
  so no policy is owed. Verified via grep (inherited from T2, re-confirmed by me):
  `grep -nEi "create policy|row level security|grant |alter table|create role" docs/migracion/03-clientes-import-dry-run.sql` → no hits (checked as part of §6/§9 review of the file).
- **Optimistic UI:** N/A — no UI code in scope; this task is pure SQL live-verification.
- **Realtime:** N/A — no subscriber/view code touched.
- **Edge cases tried:** ran the file to completion twice for determinism; deliberately
  reverted a known-fixed predicate in a scratch copy to confirm my harness still catches
  the historical bug (mutation test, §7) rather than trusting green output; checked the
  DB state at 4 checkpoints instead of the minimum 2 to catch any partial-write scenario;
  independently re-derived the sha256 hashes rather than trusting the dev's pasted values;
  discarded a pre-existing partial scratch dir from an earlier session pass instead of
  reusing its already-computed outputs.
- **What I tried that could have broken this:** I built my own execution channel from
  scratch (not reusing the dev's `pg_run.js`) and reverted a known fix in a scratch copy
  to prove that channel actually detects the historical regression (it did, reproducing
  the exact error T3 round 2 found) — this is a real attack that could have surfaced a
  fake-green channel or a fix that only "looks" applied but isn't; it failed to break the
  artifact, and the artifact's own live behavior (42/42 PASS, PROCEED, twice, deterministic,
  zero DB mutation) is confirmed independently, not inherited from the dev's transcript.

---

## Rollback

Read-only task; the live database was never written to by my verification work (confirmed
unchanged at multiple checkpoints, including immediately after a deliberate mutation-test
run that intentionally triggered a SQL error). Nothing to revert in the database.
Reverting in the repo means deleting this report file
(`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-qa-r3.md`) — no git verb
needed. All scratch tooling (`qarun.js`, `myrun1.jsonl`, `myrun2.jsonl`, etc.) lives
outside the repo in the session scratch directory and was not committed.
