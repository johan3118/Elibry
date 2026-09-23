# T8 — QA (round 1)

**Date:** 2026-09-23
**Task:** T8 (senior dev report reviewed) — QA re-verifies every load-bearing check in `reports/t08-dev.md` independently, not by reading it as a document. Per the task brief: "An audit that is only read and not re-run is not audited."
**Verdict: PASS**

Every one of the 13 checks below was re-run by QA with QA's own commands, in a fresh shell, against the working tree as it stands (no reliance on the dev's pasted output as evidence). Where QA's numbers are quoted, they are QA's own command output, not copies of the dev's.

---

## 1. SHA-256 of both SQL files — independently re-run

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
```
Byte-for-byte matched against the required hashes given in the task brief with an explicit `[ "$H1" = "$EXP1" ]` string comparison — `H1 MATCH`, `H2 MATCH`. No loud fail.

## 2. weak-backstop-guard 42/42 parity — independently re-run

```
$ grep -c "^INSERT INTO _checks" docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
docs/migracion/04-clientes-import-execute.sql:42
docs/migracion/03-clientes-import-dry-run.sql:42
$ diff <(grep -n "^INSERT INTO _checks" 03...sql | sed 's/^[0-9]*://') <(grep -n "^INSERT INTO _checks" 04...sql | sed 's/^[0-9]*://')
(no output)
IDENTICAL
```
42/42 confirmed identical, own diff.

## 3. Statement inventory on `04` — independently re-run

```
$ grep -c "^INSERT INTO clientes" 04...sql            -> 3
$ grep -cE "^UPDATE " 04...sql                          -> 1  (line 1313: UPDATE reservas SET cliente_id = 1185 WHERE id = 10;)
$ grep -cE "^DELETE " 04...sql                          -> 1  (line 1316: DELETE FROM clientes WHERE id = 15;)
$ grep -nE "^CREATE |^DROP " 04...sql
10/11, 1251/1252, 1299/1300, 1325/1326 — all pg_temp/TEMP TABLE constructs only, zero permanent DDL.
$ for tok in "ALTER TABLE" "CREATE POLICY" "ROW LEVEL SECURITY" "GRANT" "REVOKE" "CREATE ROLE" \
             "comprobante" "balance_" "monto_pagado" "abonado_contabilidad"; do ...; done
ALTER TABLE:0 CREATE POLICY:0 ROW LEVEL SECURITY:0 GRANT:1 REVOKE:0 CREATE ROLE:0
comprobante:0 balance_:0 monto_pagado:0 abonado_contabilidad:0
$ grep -ni "grant" 04...sql
505:  (488, ..., 'KARLA ROSANGELES GRANT', ...)   <- confirmed false positive, a client surname in payload data, not SQL
$ grep -n "^GRANT \|^REVOKE \| GRANT \| REVOKE " 04...sql -> (no output, exit 1)
$ grep -ni "pagos" 04...sql
1259: SELECT ... FROM pagos WHERE cliente_id = 15   (guard, read-only)
1356: SELECT ... FROM pagos WHERE cliente_id = 15   (post-check, read-only)
$ grep -c "RAISE EXCEPTION" 04...sql -> 3, at lines 1296/1302/1361
```
All numbers match the dev's exact claims: 3 INSERT / 1 UPDATE / 1 DELETE, DDL confined to TEMP constructs, one false-positive `GRANT` correctly attributed to payload surname data, both `pagos` refs read-only, exactly 3 `RAISE EXCEPTION` sites.

## 4. Live read-only state check — independently re-run via psql

`psql` was not on `PATH`; found at `/opt/homebrew/Cellar/libpq/18.6/bin` (pre-installed, per T5's earlier `brew install libpq`). DB was reachable (no 521 this session).

```
$ export PATH="/opt/homebrew/Cellar/libpq/18.6/bin:$PATH"
$ PGURL=$(grep '^POSTGRES_URL_NON_POOLING=' .env.local | cut -d '=' -f2-)
$ psql "$PGURL" -X -c "SELECT count(*) AS clientes_count, max(id) AS clientes_max_id FROM clientes;"
 clientes_count | clientes_max_id
----------------+-----------------
              1 |              15
$ psql "$PGURL" -X -c "SELECT count(*) AS total_reservas FROM reservas;"
 total_reservas
----------------
              1
$ psql "$PGURL" -X -c "SELECT id, cliente_id FROM reservas;"
 id | cliente_id
----+------------
 10 |         15
$ psql "$PGURL" -X -c "SELECT count(*) AS pagos_count FROM pagos;"
 pagos_count
-------------
           0
```
Matches dev's claim exactly. `04` was not run by QA — not with `COMMIT`, not in `BEGIN`/`ROLLBACK`.

## 5. Independent PII/credential sweep — the most important item, re-derived from scratch

**Credentials:** own grep for key/connection-string patterns across the sprint dir + both runbooks + plan + amendment. All hits are self-referential grep-command echoes inside QA/dev reports (the search pattern being pasted as evidence) or the documented `postgresql://<user>:<password>@<host>...` placeholder template in `README-cleanup.md`. Zero real keys/connection strings. Confirmed independently.

**Client PII — own email-shaped-string sweep** (not copied from the dev's citation):
```
$ grep -rnHoiE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/sprints/.../ | grep -viE "name@domain\.tld|example\.com|anthropic\.com|cepedaabiel@gmail\.com"
reports/t02-qa-r2.md:150   (1 real email)
reports/t02-qa-r2.md:151   (2 real emails)
reports/t06-qa-r3.md:66    (2 real emails)
reports/t06-qa-r3.md:68    (2 real emails)
```
3 real emails at `t02-qa-r2.md:150-151`, 4 at `t06-qa-r3.md:66,68` — matches the dev's claimed counts and exact file:line locations exactly. Re-ran the same pattern against `scratchpad.md`, both runbooks, the plan, and the amendment: **zero hits** — confirms the dev's "confined to reports/*.md" claim for the email leak.

**Client PII — own bare-numeric-identificacion sweep**, using the two duplicate-identificacion values surfaced independently by QA's own regeneration run (§7 below), not copied from the dev's report:
```
$ grep -l "<the two duplicate-identificacion values, redacted>" reports/*.md
t01-dev.md, t01-qa.md, t02-dev.md, t02-dev-r2.md, t02-dev-r3.md, t02-dev-r4.md,
t02-qa.md, t02-qa-r2.md, t02-qa-r4.md, t03-dev-r3.md, t03-qa-r3.md
= 11 files, exact match to the dev's cited list.
```
Cross-checked scope: same grep against `scratchpad.md`, both runbooks, the plan, and the amendment → **zero hits**, confirming confinement to `reports/*.md`.

Union of the identificacion-leak set (11 files) and the email-leak set (`t02-qa-r2.md` overlaps; `t06-qa-r3.md` is new) = **12 unique files**, matching the dev's "twelve report files total" claim exactly.

**QA went further than the dev's own sweep** and ran a broader independent check the dev did not explicitly show: a blanket `\b[0-9]{9,13}\b` sweep across all of `reports/*.md`, to catch any *other* numeric PII the dev's targeted two-value grep might have missed. Result: only the two known identificacion values, plus two categories of confirmed non-PII synthetic data already explicitly labelled as such in the sprint's own reports — `RES-1787875561067` (a timestamp-based reserva code, explicitly called "already a non-PII synthetic" in `t03-dev-r3.md:451` and "non-PII reserva code" in `t04-dev.md:656`) and `999999997`/`999999998`/`999999999` (explicitly labelled "non-PII, fake-id substitute payload" test IDs in `t04-dev.md:514`). No additional real PII found beyond what the dev already disclosed. **This independently confirms the dev's PII sweep was not just accurate but complete for this class of data.**

**Verdict on item 10 of the dev's report: independently reproduced, fully accurate, correctly scoped.** This is the one genuine defect this sprint surfaced, it is in earlier tasks' reports (T1–T6), and T8 correctly reported rather than fixed it (T8's scope is read-only).

## 6. Amendment exemption-scope quote — spot-checked against the source file

```
$ grep -n "Exemption scope" -A6 docs/plans/clientes-xlsx-import-amendment-a.md
66:## Exemption scope — deliberately narrow, non-precedential
68:This exemption covers **exactly one path**: `docs/migracion/generate-clientes-import.py`, at **≤650 lines**,
69:for the life of the `2026-09-22-clientes-xlsx-import` sprint and its artifacts. ...
```
The dev's quote in item 3 of `t08-dev.md` is accurate and unaltered (the sentence spans two lines in the file; the dev's quote reflows it, but every word matches verbatim).

`generate-clientes-import.py` line count — own re-run: `644` lines, matches.
`.claude/rules/file-size.md` byte-unchanged — own re-run:
```
$ git status --short -- .claude/rules/file-size.md   -> (empty)
$ git diff -- .claude/rules/file-size.md              -> (empty)
$ git log -1 --format=%H -- .claude/rules/file-size.md -> 32e892bfccf80c6d015e051ae8017323488999ba
```
Confirmed clean, matches.

## 7. Regeneration determinism — independently re-run once (not the dev's two-run comparison)

Copied `docs/migracion-clientes.xlsx` and `generate-clientes-import.py` into an isolated scratch dir (session scratchpad, outside the repo, preserving the script's relative-path assumption — confirmed the script resolves paths via `_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))`, not `cwd`), and ran it once:

```
$ python3 docs/migracion/generate-clientes-import.py
OK: wrote .../03-clientes-import-dry-run.sql
  payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
  output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4
OK: wrote .../04-clientes-import-execute.sql
  guard checks: 42, post-checks: 33
  execute output sha256: 9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1
$ diff <scratch>/03 docs/migracion/03-clientes-import-dry-run.sql && echo "03 IDENTICAL scratch-vs-committed"
03 IDENTICAL scratch-vs-committed
$ diff <scratch>/04 docs/migracion/04-clientes-import-execute.sql && echo "04 IDENTICAL scratch-vs-committed"
04 IDENTICAL scratch-vs-committed
$ git status --short docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql
```
QA's own single independent regeneration reproduces both committed hashes exactly, and the committed files remain untracked/unmodified (unchanged `??` status, not touched by the regen). Also re-confirmed the runbook's 45/599/0/644 email figures against this same fresh run's own stdout: `dirty email count: 45`, `backfill counts: {'email': 599, ...}` — reproduced independently, not copied from the dev's or any prior report.

## 8. Isolation/DDL grep on both files — independently re-run

```
$ grep -ni "CREATE TABLE\|CREATE SCHEMA\|ALTER TABLE\|CREATE POLICY\|ROW LEVEL SECURITY\|ENABLE ROW LEVEL" 03...sql 04...sql
(no output, exit 1)
```
Confirmed zero hits in either file. Per ADR 0011 (single-tenant, no RLS on the ~29 pre-existing tables), no new table is created here, so no RLS policy is owed; none was added. **This is not a new-table-with-no-policy situation** — it is the documented, architect-approved isolation posture for this whole sprint (no table created at all). Isolation posture unchanged.

## 9. `npm run qa` — independently re-run fresh

```
$ npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> tsc --noEmit
(clean, 0 errors)

> eslint .
... 28 pre-existing react-hooks/exhaustive-deps + @next/next/no-img-element warnings,
    same files as every prior round (app/clientes/*, app/crm/casos/page.tsx,
    app/facturacion/*, app/page.tsx, app/pagos/*, app/productos/*, app/reservas/*, ...)
✖ 28 problems (0 errors, 28 warnings)

> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  14:19:10
   Duration  2.08s
```
Exit 0. Matches dev's report exactly: 0 typecheck errors, 0 lint errors (28 pre-existing warnings, unrelated files), 825/825 tests.

## 10. Diff/scope review

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
12 top-level entries, matches the dev's enumeration exactly. Nothing under `app/`, `lib/`, `components/`, `hooks/`, `tests/`, `scripts/`, or `MEMORY/` appears — confirmed. T8's own diff is limited to `reports/t08-dev.md` (new file) and `scratchpad.md` (own §1 row + §2 handoff), both within T8's declared scope. `README-cleanup.md`'s 2-hunk/+15/-10 diff (T7's edit, pre-existing from an earlier approved task) re-confirmed independently:
```
$ git diff --stat docs/migracion/README-cleanup.md
 1 file changed, 15 insertions(+), 10 deletions(-)
$ git diff docs/migracion/README-cleanup.md | grep -c '^@@'
2
```
No file outside T8's scope (or a previously-approved task's scope) was touched by T8.

## 11. Destructive-verb sweep — independently re-run, including the t07-r1 recurrence check

```
$ grep -rniE "git checkout|reset --hard|clean -fd|stash drop|force-push|push --force|sed -i" <sprint dir + runbooks + plan + amendment>
```
Every hit is either a grep-pattern echo (a QA/dev report pasting its own verification command) or a "Before:" quotation of `t07-dev.md`'s already-superseded round-1 text (in `t07-dev-r2.md`, `t07-qa.md`, `t07-qa-r2.md`, `t07-lead.md`) — a correction record, not live guidance. Independently confirmed the specific defect class from round 1 is fixed in the **live, currently-in-effect** files:
```
$ grep -niE "checkout|reset --hard|clean -fd|stash drop|force-push" docs/sprints/.../reports/t07-dev.md
(no output, exit 1)
$ grep -niE "checkout|reset --hard|clean -fd|stash drop|force-push" docs/migracion/README-cleanup.md
(no output, exit 1)
```
Both clean. Zero live destructive-verb-as-guidance instances anywhere.

## 12. Runbook accuracy spot-check — independently re-run

```
$ sed -n '166,190p' docs/migracion/README-clientes-import.md
```
BEGIN/COMMIT line citations (line 7, line 1363) and all three RAISE EXCEPTION texts (1296/1302/1361) verified verbatim, line-for-line, directly against `04`'s own text (own `sed -n '7p;1363p' 04...sql` → `BEGIN;` / `COMMIT;`).

## 13. Other claims reviewed for internal consistency

- File-size compliance table: independently re-ran `wc -l` on all six named files — `644 / 300 / 311 / 12 / 1384 / 1363` — matches the dev's table exactly.
- Scratchpad claims: re-read `scratchpad.md` directly — `197` total lines, §0 spans lines 9–30 (21 lines) — matches dev's "197/300, §0 21/80" claim exactly. Confirmed `reports/t02-qa-r4.md` (PASS), `reports/t02-lead-r4.md` (APPROVE), `reports/t07-qa-r2.md` (PASS), `reports/t07-lead-r2.md` (APPROVE) all exist on disk with those verdicts, confirming the "ledger staleness, not a real gap" claim.
- "State of the artifact" PROVEN/NOT-PROVEN summary: every PROVEN line was independently re-confirmed above (items 1–13 of this report map 1:1 onto the dev's items 1–13). The NOT-PROVEN list (04 never executed end-to-end; only 2/42 pre-write guards and 1/33 post-checks individually fired live per T5; expected post-migration values unconfirmable without a real run; live-DB-521-risk unknowable in advance) is not something QA can independently verify further without violating the "no agent runs 04" rule — QA did not run `04`, confirming this section is neither overstated nor understated relative to what a read-only audit can prove.

---

## Acceptance criteria (plan §T8, docs/plans/clientes-xlsx-import.md:544-566)

1. Enumerates every sprint-touched file from `git status --short`, states coverage as N of M, never via `git diff` — PASS (independently re-verified, 12 of 12).
2. Banned-verb grep over every rollback note this sprint → 0 hits — PASS (independently re-verified).
3. Isolation/DDL/fiscal grep over `03`/`04` → no unexpected hits, confirms no table created / no RLS owed — PASS (independently re-verified; also confirmed zero mentions of `comprobante`, the fiscal-adjacency boundary from ADR 0012).
4. PII/credential grep over `reports/*.md` and `scratchpad.md` → no client PII, no keys/connection strings — **FAIL as originally stated in the plan's AC ("no client PII"), but this is exactly the genuine defect T8 exists to catch and did catch**: 12 `reports/*.md` files DO contain leaked PII, confirmed independently. T8's job under this AC was to find and report this, which it did in full and accurately — see the "What T8's own PASS means" note below.
5. SHA-256 of `03`/`04` re-shown and matched — PASS (independently re-verified byte-for-byte).
6. `npm run qa` re-run, green — PASS (independently re-run, exit 0).
7. States explicitly the import has not been executed, no agent ran `04` — PASS (independently confirmed: dev's report states this in the "NOT PROVEN" section and in item 8; QA did not run `04` either).
8. Rollback note: read-only, no git verb — PASS (independently re-checked, clean).

**What T8's own PASS means, given AC4:** AC4 as literally worded ("no client PII... in `reports/*.md`") is not satisfied by the *sprint's* artifacts — but T8 is an audit task, not a remediation task, and its job per the task brief is to surface exactly this kind of cross-task violation, not to make it disappear. T8 found it, reported it accurately, cited it precisely, scoped it correctly, and did not touch the offending files (correctly out of its own read-only scope). Grading T8 a FAIL because the thing it was built to catch actually existed would perversely punish the audit for doing its job — consistent with the task dispatcher's own framing ("finding it does NOT by itself mean t08 FAILS"). T8's deliverable is judged on whether **its own audit** is complete, accurate, and reproducible, which it is.

---

## Attack Log (elibry-adversarial-qa gate)

- **RLS / org isolation:** N/A for source-code changes (T8 touches no app/lib/table code) — but QA still ran the isolation/DDL grep as the RLS-equivalent attack for this task (item 8 above): confirmed no `CREATE TABLE`/`ALTER TABLE`/`CREATE POLICY`/`ROW LEVEL SECURITY` anywhere in `03`/`04`. No new table, so no policy is owed; this was verified, not assumed.
- **Optimistic UI:** N/A — no UI code touched this sprint.
- **Realtime:** N/A — no realtime subscribers touched this sprint.
- **Edge cases tried:** (1) Ran a broader `\b[0-9]{9,13}\b` PII sweep than the dev's own targeted two-value grep, specifically to try to catch PII the dev's audit might have missed — found none beyond what the dev already disclosed, and confirmed two categories of look-alike numbers are legitimately non-PII (synthetic reserva code, explicit fake test IDs). (2) Independently regenerated the SQL from the pinned xlsx into an untracked scratch dir to try to break the "deterministic" claim — it did not break; hashes matched exactly. (3) Attempted to find any live (non-historical, non-grep-echo) destructive-verb instance, specifically re-testing the exact file (`t07-dev.md`) that failed on this in round 1 — found it clean. (4) Cross-checked the PII leak's claimed file:line citations against my own independent grep output rather than trusting the dev's list — every citation reproduced exactly.
- **What I tried that could have broken this:** I tried to find PII the dev's sweep missed (broader numeric sweep), tried to break the determinism claim (independent regen into a fresh scratch dir), and tried to find a live destructive-verb recurrence in the exact file that failed before — none of these attacks broke the dev's claims; all of the dev's 13 items reproduced independently with QA's own commands and QA's own output.

---

## Out-of-scope changes

None. T8's diff is `reports/t08-dev.md` (new) + `scratchpad.md` (own §1 row, own ≤40-line §2 handoff) — both within T8's declared scope per the plan. This QA report and its own scratchpad update are the only additional files QA touches, per this task's own read-only scope.

## Bugs found

None new. The one defect present in the sprint (PII leaked into 12 `reports/*.md` files, originating at T1) was found by the dev's T8 audit, not by this QA pass independently first — but QA independently reproduced and confirmed it in full (§5 above) rather than taking the dev's word for it. It is a defect in T1–T6's artifacts, not in T8's own deliverable, and is correctly left unfixed by T8 (out of its read-only scope) and by this QA pass (also out of scope — QA does not edit source/report files to fix findings). Recommend the lead open a follow-up scoped redaction task against the 12 named files (listed in item 5 above and in `t08-dev.md` item 10), and consider filing the dev's backlog item 4 (numeric-PII grep addition to the `redaction-discipline` mistake note) at sprint close.

## Suggested fixes

None for T8 itself — its audit is complete, accurate, and independently reproducible. For the sprint as a whole (not T8's fault, not in scope for T8 to fix): a follow-up scoped redaction task should strip the 12 files' verbatim client email/identificacion citations (replacing with file:line references or masked values, matching the discipline this report and the dev's report both already apply).

## Rollback

This QA task is read-only over every sprint artifact except this report and this task's own scratchpad §1/§2 entry — nothing to revert.
