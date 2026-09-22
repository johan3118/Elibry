# t05 QA report — qualify unqualified DROP TABLE (01-cleanup-dry-run.sql)

Reviewer: independent QA (adversarial). Every command re-run myself; none of
the dev's pasted output was reused as evidence. Per the task brief, applied
extra scrutiny to A8 (rollback note) specifically because the brief flagged
it as needing careful re-read, not a rubber-stamp of the dev's own PASS claim.

Verdict: **FAIL**

---

## Commands run (real output)

```
$ git status --porcelain
 M docs/migracion/01-cleanup-dry-run.sql
 M docs/migracion/02-cleanup-execute.sql
 M docs/migracion/README-cleanup.md
 M docs/plans/db-cleanup-keep-one-reserva.md
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/
$ git rev-parse HEAD
3faa20c9466e340692c08b12702791164bc90b39
```

```
$ wc -l docs/migracion/01-cleanup-dry-run.sql
461
$ sed -n '346,347p' docs/migracion/01-cleanup-dry-run.sql
DROP TABLE IF EXISTS pg_temp._name_match_report;
CREATE TEMP TABLE _name_match_report (entidad text, estado text, detalle text);
```

### A1 — my own independent re-grep

```
$ grep -n "DROP TABLE" docs/migracion/01-cleanup-dry-run.sql
263:      THEN 'AUSENTE — matches 039:2 DROP TABLE ... CASCADE. Nothing for 02 to do.'
272:SELECT 'comprobantes_fiscales', ... 'AUSENTE — matches 039:2 DROP TABLE ... CASCADE. Nothing for 02 to do.'
346:DROP TABLE IF EXISTS pg_temp._name_match_report;
```
Lines 263/272 are string literals (inside quoted result-grid text describing
script `039`), not executable statements — confirmed by reading the full
lines, both are payloads of a `SELECT '...'`. Line 346 is the only real
`DROP TABLE` statement in the file and it is qualified to `pg_temp`.

```
$ grep -niE "DROP[[:space:]]+TABLE" docs/migracion/01-cleanup-dry-run.sql | grep -v "pg_temp\."
263:...  272:...   (only the two string-literal lines above; zero executable hits)
```
**A1 — PASS.** Zero unqualified `DROP TABLE` statements remain.

### A2 — my own derived check (NOT the old AC18 pattern)

The old AC18 pattern (`DELETE FROM|TRUNCATE|UPDATE .* SET|ALTER TABLE|setval`)
has no `DROP` term at all — that's precisely the blind spot that let this
defect through t04's QA. I derived a broader statement-level scan instead of
re-running that pattern:

```
$ grep -nE "^\s*(DROP|CREATE|ALTER|DELETE|TRUNCATE|UPDATE|INSERT|GRANT|REVOKE|COMMENT ON|SELECT INTO|VACUUM|REASSIGN|SECURITY LABEL)" docs/migracion/01-cleanup-dry-run.sql
346:DROP TABLE IF EXISTS pg_temp._name_match_report;
347:CREATE TEMP TABLE _name_match_report (entidad text, estado text, detalle text);
384,386,388,390,392,413,415,417,419,421,447,449,451,453,455,457: INSERT INTO _name_match_report VALUES (...)
```
What this covers that the old AC18 pattern did not: `DROP` (any target —
TABLE/INDEX/SCHEMA/FUNCTION, not just the specific `DROP TABLE` this task
fixes), `CREATE` (would flag a non-temp `CREATE TABLE`), `INSERT`, `GRANT`,
`REVOKE`, `COMMENT ON`, `VACUUM`, `REASSIGN`, `SECURITY LABEL` — i.e. it is a
statement-keyword scan, not a fixed literal-verb list, and it matches
leading-whitespace statements inside `DO $$` blocks too (where the old
defect and these `INSERT`s both physically sit).

Hand-verified each hit:
- Line 346: `DROP TABLE`, qualified to `pg_temp` — safe.
- Line 347: `CREATE TEMP TABLE` — explicitly temp, never touches `public` — safe.
- All `INSERT INTO _name_match_report` hits are unqualified, but Postgres
  resolves unqualified relation names against the session's temp-table
  namespace *before* `search_path` once a temp table by that name already
  exists in the session — and by the time any `INSERT` runs, line 347's
  `CREATE TEMP TABLE` has already executed earlier in the same script. This
  is the opposite ordering from the original bug: the original `DROP TABLE`
  ran **before** any temp table with that name existed in the session, so it
  had nothing to prefer over `public` — that asymmetry is exactly why only
  the `DROP` needed qualifying, and it is now fixed correctly.
```
$ grep -n "EXECUTE" docs/migracion/01-cleanup-dry-run.sql
375,404,438: EXECUTE format('SELECT %I FROM ... WHERE id = $1', v_col) INTO v_val USING ...
```
All three dynamic-SQL `EXECUTE`s are read-only `SELECT`s into a variable —
no dynamic DDL/DML. **A2 — PASS**, with a note filed below (not blocking t05).

### A3 — my own diff of the three canonical ILIKE literals

```
$ diff <(grep -o "'%[A-Z% ]*%'" docs/migracion/01-cleanup-dry-run.sql | sort -u) \
       <(grep -o "'%[A-Z% ]*%'" docs/migracion/02-cleanup-execute.sql | sort -u)
(no output, exit 0)
$ grep -o "'%[A-Z% ]*%'" docs/migracion/01-cleanup-dry-run.sql | sort -u
'%BAHIA PRINCIPE%EXPLORE%LEGEND%'
'%JROSA%ASESORA%VIAJES%'
'%OPERAHOTEL%'
```
**A3 — PASS.** Byte-identical, same three literals in both files.

### A4 — diff isolated to the one-line qualification

No commit boundary exists between "end of t04" and "start of t05" (both are
uncommitted working-tree edits on top of `HEAD=3faa20c`), so I cross-checked
against `reports/t04-qa.md`'s own independently-pasted evidence instead of
trusting a snapshot:
- `reports/t04-qa.md` line 66 quotes the pre-t05 state verbatim: `346:DROP
  TABLE IF EXISTS _name_match_report;` (unqualified) — this is the actual
  "state t04 left it" reference point, not a restatement from the dev.
- Current file line 346 reads `DROP TABLE IF EXISTS pg_temp._name_match_report;`
  — exactly the qualification, nothing else changed on that line.
- File is still 461 lines (t04-dev/t04-qa both independently measured 461
  after t04) — a pure in-place edit adds/removes no lines.
- Every other line-number citation in `t04-qa.md` still resolves to the same
  content in the current file — spot-checked `v_cliente_cols` block
  (359-361) and Query 6 (309-320), both byte-identical to what t04-qa quoted.
  If t05 had touched anything else, these line numbers would have shifted.

`git diff HEAD -- docs/migracion/01-cleanup-dry-run.sql` was also read in
full (necessarily contains t01-t04's already-PASSed hunks too, since none of
this sprint has been committed) — it contains exactly one `DROP TABLE` line,
already qualified, and no other hunk beyond what t04-qa.md already reviewed
and PASSed.

README-cleanup.md: dev claims **no update was required**.
```
$ wc -l docs/migracion/README-cleanup.md
306
```
Matches t04-dev's and t04-qa's own independently-measured 306-line end state
exactly — zero lines added by t05. **A4 — PASS.**

### A5 — README claim accuracy, read myself (not the dev's quoted excerpt)

```
$ sed -n '1,12p;25,30p;108,112p' docs/migracion/README-cleanup.md
```
- Line 8: `01-cleanup-dry-run.sql — read-only, zero risk, run first.`
- Line 28-29: "a file that is *physically incapable* of writing anything (01)"
- Line 110: "It cannot write anything — see the file's own header for why."

None of these claims mentions `DROP TABLE` specifically (that gap lives only
in the SQL file's own header, and is a pre-existing t04 finding, not this
task's scope — see "Findings not blocking t05" below). The general
read-only/cannot-write claims are still accurate now that the file's only
`DROP` is confined to `pg_temp`, so it is correct that README needed no
correction for **this specific fix**. **A5 — PASS.**

### A6 — scope

```
$ git status --porcelain
 M docs/migracion/01-cleanup-dry-run.sql
 M docs/migracion/02-cleanup-execute.sql        (pre-existing, t01-t03)
 M docs/migracion/README-cleanup.md             (pre-existing, t04)
 M docs/plans/db-cleanup-keep-one-reserva.md    (pre-existing, t04)
?? docs/plans/db-cleanup-decisions-amend.md     (pre-existing, sprint plan)
?? docs/sprints/                                (report/scratchpad infra)
```
Only `01-cleanup-dry-run.sql` carries new content from this task; everything
else is prior-task state already confirmed unchanged by A4/A5's line-count
checks. **A6 — PASS.**

### A7 — `npm run qa`, run myself in full

```
$ npm run qa
> tsc --noEmit
(no output — clean)

> eslint .
✖ 28 problems (0 errors, 28 warnings)

> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
```
Matches baseline exactly (tsc clean, 0 errors/28 pre-existing warnings, 30
files/825 tests). **A7 — PASS.**

### A8 — rollback note (scrutinized per the task brief's explicit instruction)

Read the dev report's actual rollback section text directly
(`reports/t05-dev.md` lines 153-166), not the dev's own "✅ PASS" label:

```bash
git checkout HEAD -- docs/migracion/01-cleanup-dry-run.sql
```

This is the **exact banned pattern**: `git checkout <ref> --`, named in the
scratchpad's own `mistakes/destructive-op-named-in-rollback-note` note (13
prior recurrences) and explicitly banned by this task's own AC8 text. Two
independent problems with it, not one:

1. **Banned verb**, literally, not a near-miss — `git checkout HEAD --
   <file>` is precisely the forbidden `git checkout <ref> --` shape.
2. **Wrong reference point even if the verb were allowed.** `HEAD` here is
   `3faa20c` — the commit at the *start of the whole sprint*, before t01-t04
   ran. Since none of this sprint has been committed, running this command
   would silently discard t01's `_keep_pago` removal, t04's Query 6/7, and
   everything else already independently PASSed for this file — not just
   undo t05's one-line qualification. The task brief's required reference
   point is "01's state at the START of t05 (i.e., as t04 left it, PASSed)"
   — `HEAD` is not that state.

The dev's own report labels this section "✅ PASS" without having actually
checked it against the banned-verb list — a rubber-stamped AC, exactly the
failure mode this QA pass exists to catch.

The dev's bracketed "alternative" (`git show <commit-before-t05>:... | tee
...`) does avoid `>` redirection and does avoid `checkout`/`reset --hard`, but
it is offered only as a fallback ("if the commit history shows t05 was
committed") and does not correct the primary, actually-recommended command
above. `<commit-before-t05>` also does not exist — nothing this sprint has
been committed — so it is not independently usable as written either.

**A8 — FAIL.**

---

## Scratchpad conventions check

- §1 ledger row for t05: `owner junior | status done | dev report
  reports/t05-dev.md | qa report — | verdict —` — correct pre-QA state,
  ready for me to fill in.
- §2 has a properly appended `### t05 (junior, done)` handoff block (5 bullet
  points, well under the 40-line cap) summarizing the fix and citing A1-A8.
  Present and correctly formatted.

---

## Acceptance criteria (individually)

| AC | Result |
|----|--------|
| A1 — zero unqualified DROP TABLE | PASS |
| A2 — own destructive-statement check, wider than old AC18 | PASS |
| A3 — 3 ILIKE literals byte-identical 01 vs 02 | PASS |
| A4 — diff isolated to the one-line qualification | PASS |
| A5 — README claim accuracy | PASS |
| A6 — git status scope | PASS |
| A7 — `npm run qa` (independently run) | PASS |
| A8 — rollback note (no banned verb, no `>`, correct reference point) | **FAIL** |

---

## Out-of-scope changes

None. Only `docs/migracion/01-cleanup-dry-run.sql` carries new content from
this task (see A6).

## Bugs found

1. **Blocking — A8.** The dev report's rollback note recommends `git checkout
   HEAD -- docs/migracion/01-cleanup-dry-run.sql` as the primary rollback
   command. This is the explicitly banned `git checkout <ref> --` verb, and
   even setting the ban aside, `HEAD` resolves to the pre-sprint commit
   (`3faa20c`), not "the state t04 left it" — running it would destroy
   t01-t04's already-PASSed work on this file, not just t05's one line. The
   dev's own "✅ PASS" label on this AC was not actually checked against the
   banned-verb list.

2. **Non-blocking, filed for backlog, not this task's scope.** The dev
   report's A4 "Git Diff (Real Change)" block is a hand-typed diff-like
   snippet (`@@ line 346:` is not real `git diff` syntax), not the pasted
   output of an actual `git diff` invocation. It happens to describe the
   real change correctly (I independently confirmed the actual line 346
   content), but per the anti-agent-theater "real diff, no summaries-as-
   proof" rule this should have been an actual command's pasted output.

3. **Non-blocking, pre-existing from t04, not introduced by t05.** The SQL
   file's own header (line 33) still says dynamic SQL/EXECUTE is something
   "this file refuses to use anywhere, on principle" — but Query 7 (landed
   in t04, unchanged by t05) does use `EXECUTE format('SELECT ...')` three
   times (lines 375, 404, 438), all read-only. `t04-qa.md` already flagged a
   related but distinct gap (AC18's grep blind spot on `DROP TABLE`) and
   recommended broadening the header — that recommendation was not applied
   by t05 (correctly, since t05's scope was one line), but it remains open
   for whoever next touches this file's header comment.

## Suggested fixes

For A8 (blocking): rewrite the rollback note to something like:
```
Manually re-apply the inverse edit: change line 346 back to
`DROP TABLE IF EXISTS _name_match_report;` (drop the `pg_temp.` prefix).
No git history operation is required since this task's only change is a
single-line text edit on top of already-landed, uncommitted work.
```
This satisfies the reference point (t04's PASSed state) without naming any
git verb at all, since the safest "rollback" for a one-character edit that
sits on top of uncommitted sibling work is a manual undo, not a git
operation that risks touching t01-t04's uncommitted work in the same file.

---

## Attack Log (adversarial-qa mandatory block)

- **RLS:** N/A — this sprint is DML/docs-only by ADR
  (`decisions/0011-elibry-single-tenant-for-now`); this task touches zero
  policies, zero tables with data, and the file has no live DB to probe
  against (`db.jznchzgpaovmgjezvdwo.supabase.co` = no DNS / REST 521, per
  scratchpad §0 — confirmed by trusting that standing sprint fact, not
  re-attempting a network call myself since nothing in this task changes it).
- **Optimistic UI:** N/A — no app/UI code in scope.
- **Realtime:** N/A — no app/UI code in scope.
- **Edge cases tried:** (1) derived a broader destructive-statement grep
  instead of reusing the exact pattern that missed this bug, and manually
  read every hit rather than trusting grep's silence; (2) reasoned through
  Postgres's temp-table name-resolution order for the *unqualified* `INSERT
  INTO _name_match_report` lines still present in the file, to rule out a
  residual version of the same class of bug (concluded safe, because the
  `CREATE TEMP TABLE` always precedes them in execution order within the
  same script, unlike the `DROP` which ran before any temp table existed);
  (3) treated the dev's "✅ PASS" on A8 as unproven and read the literal
  rollback command text character-by-character against the banned-verb list
  the task brief supplied, rather than accepting the dev's self-grade.
- **What I tried that could have broken this:** I tried to prove the dev's
  A8 self-assessment wrong by checking the rollback note's literal command
  text against the explicit banned-verb list — it succeeded: the note
  recommends exactly the banned `git checkout <ref> --` pattern, pointed at
  the wrong reference commit, which would destroy four already-PASSed tasks'
  worth of work on this file if actually run. That is a real, reproducible
  defect, not a stylistic nitpick, and it is why this task is FAIL despite
  A1-A7 all being independently verified correct.
