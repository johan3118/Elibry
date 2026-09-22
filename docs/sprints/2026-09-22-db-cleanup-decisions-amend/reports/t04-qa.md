# t04 (MERGED T4+T5+T6+T7) — QA report

Reviewer: independent QA (adversarial). All three files reviewed individually,
end to end, with every command re-run myself (never reused the dev's pasted
output as evidence). `docs/migracion/02-cleanup-execute.sql` was read (not
edited) only to cross-check README claims against its real text.

---

## FILE 1 — `docs/migracion/01-cleanup-dry-run.sql`

### Commands run (real output)

```
$ rg -n "keep_pago" docs/migracion/01-cleanup-dry-run.sql
72:-- keep_pago CTE REMOVED (db-cleanup-decisions-amend, T4): pagos has NO keep
128:-- keep_pago CTE REMOVED (db-cleanup-decisions-amend, T4): pagos has NO keep
157:     -- OR (cp.tabla_afectada = 'pagos'              AND cp.registro_id IN (SELECT id FROM keep_pago))
170:     -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM keep_pago))
```
All 4 hits comment-only. AC13/AC14 confirmed structurally (read the SQL, not just the grep): Query 2's row is relabelled `'pagos: ALL rows will be deleted, no keep set'`; Query 3's pagos row is `count(*), 0, count(*)` — the `0` and second `count(*)` are literal, not derived from any `keep_pago` reference. rows_to_keep is hardwired 0, rows_to_delete == rows_total by construction, independent of data. PASS.

```
$ rg -n -A6 "keep_cliente AS" docs/migracion/01-cleanup-dry-run.sql
75:keep_cliente AS (
76-  -- AMENDMENT: resolves from keep_reserva.cliente_id ONLY ...
81-  SELECT cliente_id AS id FROM keep_reserva WHERE cliente_id IS NOT NULL
--
131:keep_cliente AS (
132-  -- AMENDMENT: resolves from keep_reserva.cliente_id ONLY ...
137-  SELECT cliente_id AS id FROM keep_reserva WHERE cliente_id IS NOT NULL
```
Both instances (Query 2, Query 3) resolve only from `keep_reserva.cliente_id`, no `pagos`/`keep_pago` reference. AC15 PASS.

Query 6 read directly (lines 309-320): a real, distinguishable "OK — 0 payments" state exists, distinct from the "*** WARNING ***" non-zero state — zero reads as a real answer, not blank/error. AC16 PASS.

```
$ diff <(rg -o "'%[A-Z% ]+%'" docs/migracion/01-cleanup-dry-run.sql | sort -u) \
       <(rg -o "'%[A-Z% ]+%'" docs/migracion/02-cleanup-execute.sql | sort -u)
(no output, exit 0)
```
Byte-identical ILIKE literal sets. AC17 PASS. **Attack performed beyond the dev's own check:** I additionally diffed the candidate-*column* arrays and match semantics (not just the string literals), since a dev could copy the literals correctly while still diverging the detection logic:
```
$ rg -n "v_cliente_cols|v_producto_cols|v_suplidor_cols" docs/migracion/02-cleanup-execute.sql
112:  v_cliente_cols  text[] := ARRAY['nombre_completo', 'razon_social', 'nombre_comercial'];
113:  v_producto_cols text[] := ARRAY['nombre_producto', 'nombre_original'];
114:  v_suplidor_cols text[] := ARRAY['razon_social', 'nombre_comercial'];
$ rg -n "v_cliente_cols|v_producto_cols|v_suplidor_cols" docs/migracion/01-cleanup-dry-run.sql
359:  v_cliente_cols  text[] := ARRAY['nombre_completo', 'razon_social', 'nombre_comercial'];
360:  v_producto_cols text[] := ARRAY['nombre_producto', 'nombre_original'];
361:  v_suplidor_cols text[] := ARRAY['razon_social', 'nombre_comercial'];
```
Byte-identical arrays, and hand-read both `DO $$` blocks side by side: `v_matched := true` fires under the exact same condition in both files (any non-null candidate column value `ILIKE` the pattern), and the four non-collapsing outcome precedence order (no-candidate-column → name-null-or-empty → no-match → MATCH, plus suplidor's extra `suplidor-id-null` branch) is identical in both files. This is a real attack that could have found a silent divergence and did not.

All 5 non-collapsing states (MATCH, no-match, name-null-or-empty, no-candidate-column, suplidor-id-null) present verbatim, plus one extra state (`reserva.*_id IS NULL`) that 01 must handle (since it cannot abort like Guard 2 does) — correctly documented as unreachable in Guard 3 itself. No two states collapsed. AC17 PASS.

```
$ rg -n "DELETE FROM|TRUNCATE|UPDATE .* SET|ALTER TABLE|setval" docs/migracion/01-cleanup-dry-run.sql
7:-- This file contains ZERO DELETE / TRUNCATE / UPDATE / ALTER / setval statements.
25:--     mid-run than this dry run shows, until the script's own final DELETE FROM
```
Both hits inside the header comment block (lines 1-40), verified by eye — not just "near" a comment, both physically inside `-- ...` lines. Zero executable hits for the AC18-specified pattern. AC18 PASS as literally specified.

**Finding (RISKY, not a FAIL):** the AC18 command's own pattern list does not include `DROP TABLE`, and Query 7 (new this task) adds:
```
346:DROP TABLE IF EXISTS _name_match_report;
347:CREATE TEMP TABLE _name_match_report (entidad text, estado text, detalle text);
```
This is a real, executable `DROP TABLE` statement. It only ever targets a session-scoped **temp table this same script creates** (never a business table), so it does not compromise the file's actual safety property, and it is a reasonable pattern given `01` has no transaction wrapper (unlike `02`, which uses `CREATE TEMP TABLE ... ON COMMIT DROP` and therefore never needs an explicit `DROP TABLE`). But the file's own header claim — "ZERO DELETE / TRUNCATE / UPDATE / ALTER / setval statements" / "physically incapable of harm" (lines 2, 7) — is now imprecise: it doesn't disclose this exception, and AC18's own safety-invariant grep has a blind spot that would silently pass a `DROP TABLE` targeting a *real* table too. Recommend (not blocking): broaden the header's claim and the AC18 grep to explicitly name `DROP TABLE` with a stated exception for this script's own `_name_match_report`/`_tx_probe`-style temp objects, so a future edit that drops a real table would still be mechanically caught.

```
$ git diff -- docs/migracion/01-cleanup-dry-run.sql
```
(full diff reviewed hunk by hunk, matches dev's pasted diff verbatim). Hunks confined to Query 2 (69-99), Query 3 (117-201 range), and one pure-append hunk after Query 5's closing `ORDER BY t.tabla;`. No hunk adds/removes/changes a line inside Query 1 (46-53), Query 4 (246-273), or Query 5 (276-299). AC19 PASS.

```
$ wc -l docs/migracion/01-cleanup-dry-run.sql
461 docs/migracion/01-cleanup-dry-run.sql
```
No ceiling AC applies to `01`; informational only, matches dev report.

**File 1 verdict: PASS**, with one RISKY note (AC18 grep blind spot on `DROP TABLE` of a self-owned temp table — no actual data-safety impact found).

---

## FILE 2 — `docs/migracion/README-cleanup.md`

### Commands run (real output)

```
$ grep -n "^## Step" docs/migracion/README-cleanup.md
34:## Step 1 — Backup (do this before anything else)
67:## Step 2 — Transaction-honoring probe (do this before pasting 02 anywhere)
104:## Step 3 — Run the dry run
124:## Step 4 — Read the report
172:## Step 5 — Sign-offs before running `02`
204:## Step 6 — Run `02-cleanup-execute.sql`
```
Same six steps, same order as pre-task (cross-checked against `git diff` hunks — no hunk removes or reorders a `## Step` heading). AC21 PASS.

Read the KEEP-set section (lines 241-269) directly: both the **Español** paragraph ("`pagos` NO tiene keep set: se eliminan TODOS los pagos ... INCLUYENDO los pagos de la propia reserva conservada" + "Esto es irreversible sin el backup del Paso 1") and the **English** paragraph ("`pagos` has NO keep set: ALL payment history ... INCLUDING the kept reserva's own payments" + "This is irreversible without the Step 1 backup") state the full/irreversible-without-backup claim in plain prose (not inside a code block/comment). Both languages corrected, not just one. AC20 PASS.

Step 5 checklist read directly (lines 193-200): a new `[ ] **Name-match preflight.**` item requires Query 7 all-MATCH, and states plainly "If any row reads MISMATCH: stop. Do not run 02. Investigate first." Non-collapsing, unambiguous stop condition. AC22 PASS.

**AC23 — cross-checked against `02`'s real Section 5 text, not the README's self-description**, per `mistakes/runbook-pass-condition-misdescribes-behavior`:
```
$ sed -n '/SECTION 5/,/COMMIT;/p' docs/migracion/02-cleanup-execute.sql
```
(full text read — see transcript). Confirmed line-by-line correspondence: candidate columns (`balance_reserva, balance_general, balance_abonado, monto_pagado, abonado_contabilidad`) match exactly; "zero UPDATE statements" claim matches (`grep "^\s*UPDATE "` → 0 hits, independently re-verified); "final report result grid" surfacing (not NOTICE-only) matches `02`'s own FINAL REPORT `SELECT` which appends `*_disclosure` subqueries; ABSENT vs "PRESENT, current value = X -- POSSIBLY STALE" wording matches `02`'s actual `INSERT INTO _balance_disclosure` strings word-for-word; the app read-time-recompute citation (`app/reservas/ver/[id]/page.tsx:196-215`, `lib/finance.ts`) matches `02`'s own inline comment citation. No divergence found between claim and artifact. AC23 PASS.

```
$ sed -n '/^## Rollback/,$p' docs/migracion/README-cleanup.md | rg -n "checkout|reset --hard|clean -fd|stash drop|>"
(no output)
$ rg -n "checkout|reset --hard|clean -fd|stash drop" docs/migracion/README-cleanup.md
(no output, whole file)
```
Zero hits anywhere in the file, not just the rollback section. The reference point is stated as "restore each affected file to the version it had at the start of that task" (not the pre-sprint commit `3faa20c`, no other commit named) — a clean, non-conditional statement. AC24 PASS.

```
$ wc -l docs/migracion/README-cleanup.md
306 docs/migracion/README-cleanup.md
```
306 > 250 ceiling. Dev report explicitly flags this ("**FLAG: over the 250-line ceiling**"), not silently split — matches this sprint's established convention (02 was flagged twice, not split). AC25 PASS (flagged).

```
$ rg -n "UNVERIFIED" docs/migracion/README-cleanup.md
16:Treat every such description as **UNVERIFIED** unless and until you have
159:  mandatory. **UNVERIFIED** — this describes what `02`'s SQL text does; it
```
Read surrounding context for both: line 16 is inside a top-of-file "Verification status" note that scopes **every** behavior claim in the file (no DNS answer, REST 521, nothing executed this sprint); line 159 additionally, specifically labels the new balance-branch paragraph. No claim anywhere in the file states or implies actual execution against a live DB — confirmed by reading Steps 1-6 in full; every imperative is phrased as instruction to the operator, not as an observed result. AC26 PASS.

Line ~238 (old "these three files themselves are new, untracked additions") — read the current Rollback section: rewritten to "These three files are tracked in this repository's git history ... not new or untracked," with a restore instruction using no banned verb. AC-fix PASS.

```
$ git diff -U0 -- docs/migracion/README-cleanup.md | grep "^@@"
@@ -10,0 +11,8 @@ ... @@ -103 +111 @@ ... @@ -109 +117,6 @@ ... @@ -124,0 +138,24 @@ ...
@@ -155,0 +193,8 @@ ... @@ -200,6 +245,11 @@ ... @@ -209,3 +259,8 @@ ... @@ -238,3 +293,5 @@ ... @@ -248,2 +305,2 @@
```
None of these hunks fall inside the RLS caveat bullet (pre-task lines ~162-168, unchanged context confirmed by direct read) or the R-TRIGGER guidance (Step 6, pre-task ~220-228, unchanged). AC-retain PASS.

**File 2 verdict: PASS.**

---

## FILE 3 — `docs/plans/db-cleanup-keep-one-reserva.md`

### Commands run (real output)

```
$ git diff --numstat -- docs/plans/db-cleanup-keep-one-reserva.md
63	0	docs/plans/db-cleanup-keep-one-reserva.md
```
Deletions column is exactly 0. AC27 (part 1) PASS.

```
$ git show HEAD:docs/plans/db-cleanup-keep-one-reserva.md | wc -l
822
$ diff <(git show HEAD:docs/plans/db-cleanup-keep-one-reserva.md) <(head -822 docs/plans/db-cleanup-keep-one-reserva.md)
(no output, exit 0)
$ git diff -U0 -- docs/plans/db-cleanup-keep-one-reserva.md | grep "^@@"
@@ -822,0 +823,63 @@ PLAN_PATH: docs/plans/db-cleanup-keep-one-reserva.md
```
The original file is 822 lines (not 823 — a Read-tool display quirk, as the dev report noted; confirmed independently via `wc -l`/`diff`). Lines 1-822 are byte-identical to `HEAD`. Exactly one hunk, a pure append starting after line 822. Spot-checked several original section headers (`## 9. Test plan`, `## 10. Plan pre-mortem`, `## 11. Task list` — not present in this file since it's the design plan, actually checked `## 4`/`## 5`/`## 11. Rollback for this plan as a whole`) via the diff above — zero changes. AC27 (part 2) PASS.

```
$ rg -n "the operator, via direct question, this session" docs/plans/db-cleanup-keep-one-reserva.md
840: ... 853: ... 865: ...
```
Exactly 3 attributions, each under its own `### Decision N` heading. Read all three decisions in full:
- Decision 1 cites "§4's `_keep_pago` definition above (line 248...)" and "§5 step 3 above (line 287...)" — cross-checked against the actual original file:
```
$ sed -n '246,250p;285,289p' docs/plans/db-cleanup-keep-one-reserva.md
248: _keep_pago := SELECT id FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)
287: | 3 | `pagos` | `WHERE id NOT IN _keep_pago` | ...
```
Citations are accurate, not fabricated.
- Decision 2 records the three-entity name-assertion guard as a new preflight requirement, not altering §4/§5.
- Decision 3 reaffirms Section B (naming `comprobantes_disponibles` explicitly) unchanged, no uncommenting proposed.
AC28 PASS.

```
$ rg -n "SELECT|DELETE|CREATE TEMP|ILIKE" docs/plans/db-cleanup-keep-one-reserva.md | awk -F: '$1>822'
(no output)
```
Used the line-number-correct filter (`$1`, not the task brief's own `$2`, which the dev report correctly identified as non-functional since `awk -F:` puts the line number in `$1`). 0 hits past line 822 either way. AC29 PASS.

```
$ sed -n '814,819p' docs/plans/db-cleanup-keep-one-reserva.md
## 11. Rollback for this plan as a whole
...
`rm docs/migracion/cleanup-keep-RES-1787875561067.sql docs/migracion/cleanup-keep-RES-1787875561067.md`
```
Stale filenames at 816-817 (backlog B-b) untouched by the Amendment — confirmed correctly out of scope.

**File 3 verdict: PASS.**

---

## STANDING CHECKS (all three files)

```
$ git status --porcelain
 M docs/migracion/01-cleanup-dry-run.sql
 M docs/migracion/02-cleanup-execute.sql
 M docs/migracion/README-cleanup.md
 M docs/plans/db-cleanup-keep-one-reserva.md
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/
```
Exactly the 3 in-scope files, plus `02` (pre-existing t01-t03 diff — see below) and the two pre-existing untracked entries (sprint plan + scratchpad/reports infrastructure). AC30 (scope) PASS.

**02-untouched-by-t04 verification (independent, not just trusting the dev's word):**
```
$ wc -l docs/migracion/02-cleanup-execute.sql
631 docs/migracion/02-cleanup-execute.sql
$ git diff --stat -- docs/migracion/02-cleanup-execute.sql
 docs/migracion/02-cleanup-execute.sql | 228 +++++++++++++++++++++++++++++++---
 1 file changed, 210 insertions(+), 18 deletions(-)
$ git diff -- docs/migracion/02-cleanup-execute.sql | grep -n "Query 6\|Query 7\|_name_match_report"
(no output)
```
631 lines matches t03's own claimed final state exactly (t03-qa.md / t03-lead.md, both already `Verdict: PASS` / `A — APPROVE` — checked directly, the scratchpad §1 ledger row for t03 is simply stale/not updated, not a false claim). The insertion/deletion counts are unchanged from what t03's own reports describe, and none of t04's new artifacts (Query 6/7, `_name_match_report`) leaked into `02`'s diff. Combined with the dev's explicit claim of Read-only tool calls this session, this is strong evidence `02` is genuinely untouched by t04. AC30 (02 zero-diff-from-t03) PASS.

**Minor hygiene note (non-blocking):** scratchpad §1 ledger still shows t03 as `dev-done` with `—`/`—` for qa report/verdict, even though `reports/t03-qa.md` (Verdict: PASS) and `reports/t03-lead.md` (A — APPROVE) already exist and are dated before this task. Whoever updates the ledger next should fix t03's row to `done` / PASS.

```
$ npm run qa
...
> tsc --noEmit
(no output — clean)
> eslint .
... 28 problems (0 errors, 28 warnings)
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
```
Full output reproduced myself (see transcript); identical shape to t01/t02/t03's baseline: tsc clean, eslint 0 errors / 28 pre-existing warnings (same file list — `app/clientes/...`, `app/productos/...`, etc.), vitest 30 files / 825 tests passed. AC31 PASS.

AC32 — spot-checked the dev report's pasted command outputs against my own independent re-runs for: `keep_pago` grep, `keep_cliente` grep, the ILIKE-literal diff, the AC18 destructive-verb grep, `git diff --numstat` on the plan, the `awk` line-filter, `wc -l` on both 01 and README, and `npm run qa`. All matched. No paraphrased-only claim found. AC32 PASS.

---

## Attack Log (adversarial-qa mandatory block)

- **RLS:** N/A — this sprint is DML/docs-only by ADR (`decisions/0011-elibry-single-tenant-for-now`); no table, policy, or DDL touched in any of the 3 files. Confirmed by reading every diff hunk: none contains `CREATE POLICY`, `ALTER TABLE ... ROW LEVEL SECURITY`, or a new `CREATE TABLE` against a persistent (non-temp) table.
- **Optimistic UI:** N/A — no app/UI code in scope.
- **Realtime:** N/A — no app/UI code in scope.
- **Edge cases tried:** (1) diffed the *candidate-column arrays and match semantics* between 01's Query 7 and 02's Guard 3, not just the ILIKE literal strings the dev diffed — found byte-identical arrays and identical `v_matched` precedence logic; (2) manually traced what happens if `v_cliente_id`/`v_producto_id` is NULL in both 01 and 02's guard logic, confirmed 01's extra `reserva.*_id IS NULL` state is correctly documented as unreachable in 02 (Guard 2 pre-empts it) rather than a real divergence; (3) hand-verified every AC28 plan citation (line 248, line 287) against the actual pre-existing plan text rather than trusting the Amendment's own prose; (4) grepped for `DROP TABLE`/`CREATE TEMP` across 01, which the AC18 command's pattern list omits — found one real `DROP TABLE IF EXISTS _name_match_report`, traced it to confirm it only ever targets a script-owned temp table, never a business table.
- **What I tried that could have broken this:** I tried to find a silent divergence between `01`'s preview and `02`'s real Guard 3 beyond the dev's own literal-only diff (candidate columns + match precedence + null-handling edge cases), and tried to find an executable statement outside AC18's specific grep pattern that would violate the file's "physically incapable of harm" claim — the first attack failed to find any divergence (the guard preview is genuinely faithful), the second attack found a real but harmless gap (a `DROP TABLE` of a self-owned temp table, outside AC18's literal pattern) worth flagging to the dev, not blocking the task.

---

## Acceptance criteria (all, individually)

| AC | File | Status |
|----|------|--------|
| AC13 | 01 | PASS |
| AC14 | 01 | PASS |
| AC15 | 01 | PASS |
| AC16 | 01 | PASS |
| AC17 | 01 | PASS |
| AC18 | 01 | PASS (RISKY note: grep pattern blind spot, see above) |
| AC19 | 01 | PASS |
| AC20 | README | PASS |
| AC21 | README | PASS |
| AC22 | README | PASS |
| AC23 | README | PASS |
| AC24 | README | PASS |
| AC25 | README | PASS (flagged, not split) |
| AC26 | README | PASS |
| AC-fix | README | PASS |
| AC-retain | README | PASS |
| AC27 | plan | PASS |
| AC28 | plan | PASS |
| AC29 | plan | PASS |
| AC30 | standing | PASS |
| AC31 | standing | PASS |
| AC32 | standing | PASS |

## Out-of-scope changes

None. `git status --porcelain` shows only the 3 declared files modified, plus `02-cleanup-execute.sql` (verified to be entirely t01-t03's pre-existing, already-PASSed diff — see AC30 analysis above) and 2 pre-existing untracked sprint-infrastructure entries.

## Bugs found

None blocking. One RISKY documentation/safety-invariant gap in File 1: `01`'s header claims "ZERO DELETE / TRUNCATE / UPDATE / ALTER / setval statements" / "physically incapable of harm," but Query 7 adds a real `DROP TABLE IF EXISTS _name_match_report` (line 346). It is provably harmless (targets only a script-owned temp table, never a business table), but it is outside AC18's own literal grep pattern, meaning a future, less careful edit that dropped a *real* table in this file would not be mechanically caught by the AC18 check as currently worded.

## Suggested fixes

Not blocking, for the backlog/next touch of this file: (1) broaden AC18's safety-invariant grep to include `DROP TABLE` with an explicit, named exception for `01`'s own `_name_match_report` temp object; (2) update the file's header comment (lines 2, 7) to disclose that one exception explicitly, so the "physically incapable of harm" claim stays accurate to the letter, not just in spirit.

## Scratchpad hygiene (not a task defect)

§1 ledger's t03 row is stale — `reports/t03-qa.md` and `reports/t03-lead.md` already show PASS / A-APPROVE, dated before t04. Recommend the next writer fixes t03's row to `done` / PASS in §1 before sprint close.

---

Verdict: PASS
