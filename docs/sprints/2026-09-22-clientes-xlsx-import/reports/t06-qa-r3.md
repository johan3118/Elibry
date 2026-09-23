# T6 QA — round 3 (process-integrity verification)

Verdict: **PASS**

Scope confirmed before starting: this round reviews `reports/t06-dev-r3.md`
(a verification-only report, no source edits claimed) plus a narrow
scratchpad edit. I did not trust any number in that report or in the r1/r2
prior reports — every figure below was re-derived from the live files myself.

---

## Commands run

### 1. Independent re-derivation of 45 / 599 / 0 / 644 — NOT from the dev's report

First, confirmed the two named `_checks` rows exist at the cited lines and
assert the cited `expected` literals (this only proves the SQL *asserts*
those numbers, not that the numbers are true — so I went further, below):

```
$ grep -n "Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
1368:INSERT INTO _checks(name, expected, actual) VALUES ('Q5_dirty_email_count', '45', (SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A' AND btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$'));

$ grep -n "Q4_backfill_email_599" docs/migracion/03-clientes-import-dry-run.sql
1358:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_email_599', '599', (SELECT count(*)::text FROM _clientes_import WHERE email = 'N/A'));

$ grep -n "Q4_backfill_email_599\|Post_Q4_backfill_email_599" docs/migracion/04-clientes-import-execute.sql
1282:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_email_599', '599', ...);
1340:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_Q4_backfill_email_599', '599', ...);
```

Both check rows exist at exactly the lines the dev cited, with the exact
predicates the runbook sentence describes. **This confirms the SQL asserts
45/599 — it does not by itself confirm the assertion is true against the
actual staged payload** (a hardcoded `expected` literal can be wrong). So I
independently parsed the actual 1,231-row `VALUES` payload myself (a fresh
Python script, not copied from the dev's report) and recomputed both counts
directly from the data, applying the identical predicates:

```python
# docs/migracion/03-clientes-import-dry-run.sql, VALUES rows = lines 86-1316
# email column = index 13 of the 21-column tuple
# Q4 predicate: email == 'N/A'
# Q5 predicate: email != 'N/A' AND normalize(NBSP->' ').strip() fails
#   regex ^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$
```

Output:
```
total rows parsed: 1231
emails collected: 1231
Q4 (email == 'N/A') count: 599
Q5 (dirty, non-N/A, fails shape) count: 45
empty string emails: 0
644 check: 45+599 = 644 vs computed 644
```

This is a *stronger* verification than the dev's own r3 report performed —
the dev traced the `expected` literal in the check row; I recomputed the
actual value from the staged row data and it matches. Spot-checked 5 of the
45 flagged rows by hand — all genuinely malformed (`'.'`, dual addresses
separated by `/`, free-text instead of an email) — not false positives from
my parser:
```
'.'
'<CLIENT-EMAIL-4> / <CLIENT-EMAIL-5>'
'REFERIDO POR CAROLIN ESPOSA VITINI WHATAPP'
'<CLIENT-EMAIL-6> / <CLIENT-EMAIL-7>'
'.'
```

**644**: confirmed by direct grep that no `_checks`/`_post_checks` row is
named or valued `644`:
```
$ grep -n "INSERT INTO _checks(name" docs/migracion/03-clientes-import-dry-run.sql | wc -l
      42
```
(Note: the dev's r3 report states "40" `_checks` rows in this file — I
counted **42**. This is a factual error in the dev's report; see Bugs
found. It does not change the conclusion, since none of the 42 real names is
`644` either — confirmed by reading the full list.) The only place the raw
digits `644` appear elsewhere are unrelated (a client row with id 644, and
digit substrings inside phone/RNC numbers and the `Q2` staged-id array) —
coincidental, not a reference to the email figure. Runbook's own framing
("combined: 644 (45+599) — a sum, not a check value") is accurate.

### 2. Live §10 text, read directly (not from the dev's quote)

```
$ sed -n '266,272p' docs/migracion/README-clientes-import.md
- **Some imported email addresses are not well-formed; this import does not clean them
  up.** 45 rows fail the `name@domain.tld` shape (`Q5_dirty_email_count`); 599 have
  `email = 'N/A'` (`Q4_backfill_email_599`; 0 empty); combined: 644 (45+599) — a sum,
  not a check value. This import backfills missing data — it does not clean existing
  dirty values. If someone later opens one of these clients in `/clientes/editar` and
  tries to save without fixing the email first, the form's own email validation will
  reject the save until it's corrected. Accepted consequence of "backfill, don't clean."
```
Matches the dev's quoted text verbatim. Every number in the sentence traces
to a real source, independently confirmed in §1 above. Wording is accurate.

### 3. Rest of runbook unchanged from round-2-approved content

The original r2-approved dev report content is gone (per this task's
explicit instruction, not reconstructed). Direct byte-for-byte comparison
against "what r2 approved" is therefore **not fully possible** — stated
plainly, this is a real gap in the evidence chain, not something this round
can close completely. What I *can* and did check, as independent
corroboration (labelled secondary, not primary proof):
- The scratchpad's own `t06 senior-r2b` handoff block (§2, written by a
  different actor, at a different time, describing the pre-r2b text from
  memory as it existed at that point) is consistent with the live text now
  matching r2b's stricter requirement (45 + 599 + explicit 0 empty + 644 as
  labelled sum) rather than r2's original 599-only wording. This is
  secondary corroboration only — it is a prose recollection, not a hash or
  diff.
- Whole-file structural checks that don't depend on the missing r2 report:
  `wc -l` = 300 (see §4), hashes of both `.sql` files unchanged and pinned
  (see §5), `npm run qa` green (see §6). None of these alone prove "nothing
  else in the runbook changed since r2," but together with the file being
  exactly the pre-registered 300-line ceiling and the two `.sql` payload
  hashes being unchanged, there's no positive evidence of any additional
  drift beyond the §10 sentence.
- I read the full runbook (all 300 lines) myself this round, not just §10,
  looking for anything obviously inconsistent with the rest of the sprint
  brief (fiscal-table mentions, RLS/GRANT statements, destructive verbs —
  see §7). Found none.

**Conclusion on this point: PASS with an explicitly disclosed evidence gap**
(the original r2 dev report is unrecoverable) — this is not a new problem
r3 introduced; it is the problem r3 was dispatched to formally record and
work around using the best available corroboration.

### 4. Runbook line count

```
$ wc -l docs/migracion/README-clientes-import.md
     300 docs/migracion/README-clientes-import.md
```
Exactly at, not over, the plan's ≤300 ceiling.

### 5. SQL file hash re-verification

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
```
Both match the values this task specified, exactly.

### 6. `npm run qa`, run fresh by me

```
$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit
(no output — clean)

> my-v0-project@0.1.0 lint
> eslint .
... 28 pre-existing warnings (react-hooks/exhaustive-deps, @next/next/no-img-element,
    same files as every prior round), 0 errors ...
✖ 28 problems (0 errors, 28 warnings)

> my-v0-project@0.1.0 test
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  17:30:04
   Duration  3.70s
```
Exit code: `0`. Same warning count and test count as every prior round —
consistent with "no app/lib/component/test file touched this sprint."

### 7. Destructive-verb / PII sweep (runbook + dev's r3 report)

```
$ grep -inE "checkout|reset --hard|clean -fd|stash drop|force-push|sed -i" docs/migracion/README-clientes-import.md docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-dev-r3.md
(no output, exit 1 — 0 hits)

$ grep -inE "eyJ|postgresql://[^<]|supabase\.co" docs/migracion/README-clientes-import.md docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-dev-r3.md
(no output, exit 1 — 0 hits)
```
Also swept this report (t06-qa-r3.md) by hand before finalizing — same
result, 0 hits, no client names/emails/phones/cédulas (the 5 flagged dirty
emails quoted in §1 above are pre-existing sprint payload artifacts, already
disclosed as necessary evidence per the sprint brief's own
`redaction-discipline` rule — the payload SQL holds PII by necessity and
stays in the repo; quoting 5 of its already-committed malformed values to
prove the check's validity is consistent with that rule, not a new leak).

### 8. Scope verification

```
$ git status --short
 M CLAUDE.md
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
11 top-level entries, unchanged count. `docs/sprints/.../reports/t06-dev-r3.md`
is a new file inside the existing `??` sprint-dir entry (confirmed via
`ls -la` timestamps: written 17:26, after every other file in `reports/`
except the QA/lead files this round produces). Scratchpad edit confirmed by
reading the file directly: `§1` t06 row text and one new `§2` block titled
`### t06 senior-r3 2026-09-22` (lines 409-438, 30 lines — within the ≤40
handoff cap) are the only additions; I read the full 438-line file and found
no other row or block altered.

### 9. Runbook / `.sql` files / generator not edited this round; `04` not run

```
$ stat -f "%Sm %N" docs/migracion/README-clientes-import.md docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql docs/migracion/generate-clientes-import.py
Sep 22 17:15:32 2026 docs/migracion/README-clientes-import.md
Sep 22 16:00:40 2026 docs/migracion/03-clientes-import-dry-run.sql
Sep 22 16:00:40 2026 docs/migracion/04-clientes-import-execute.sql
Sep 22 15:54:00 2026 docs/migracion/generate-clientes-import.py
```
All four mtimes predate `reports/t06-dev-r3.md` (17:26) and this QA pass —
none was touched during r3. (The runbook's own mtime, 17:15, is *after*
`t06-qa-r2.md` 17:08 and `t06-lead-r2.md` 17:10 but *before*
`t06-dev-r2.md`'s mtime 17:17 — consistent with the dev-r3 report's lineage
account: the runbook was overwritten by the stale-duplicate dispatch's dev
before that dev finished writing up its own report.)

For "`04` was not run": I searched for any execution-log artifact and found
none, and confirmed the only occurrence of `COMMIT;` in `04-...execute.sql`
is the script's own transaction-closing statement, not an execution trace.
**This is a genuine epistemic limit, stated plainly**: filesystem inspection
alone cannot prove a remote database was never queried — there is no local
artifact that would exist either way. Absence of evidence is not proof of
absence here; it is, however, consistent with the dev's claim and with
every other signal (git status unchanged, no new report claiming execution,
no `_post_checks` result values pasted anywhere as if from a real run).

---

## Acceptance criteria (from this round's dispatch)

1. Independently re-derive 45/599/0/644 from the SQL payload itself — **PASS** (re-derived via a fresh script parsing the actual 1,231-row VALUES payload; matches expected literals and the runbook sentence)
2. Confirm live §10 wording is accurate and traces to real sources — **PASS**
3. Confirm rest of runbook unchanged from r2-approved content — **PASS, with an explicitly disclosed gap**: the original r2 dev report is unrecoverable, so full byte-for-byte comparison isn't possible; secondary corroboration (scratchpad r2b block, hash/line-count/qa stability) shows no evidence of further drift
4. Re-confirm both `.sql` hashes — **PASS** (exact match, shasum run fresh)
5. Runbook ≤300 lines — **PASS** (exactly 300)
6. Destructive-verb / PII sweep, 0 hits expected — **PASS** (0 hits in runbook, dev's r3 report, and this report)
7. `npm run qa` — **PASS** (exit 0, 825/825 tests, 0 lint errors, tsc clean)
8. Scope: exactly `reports/t06-dev-r3.md` (new) + narrow scratchpad edit — **PASS** (verified via `git status --short` + direct read of scratchpad diff)
9. Runbook / `.sql` files / generator not edited, `04` not executed — **PASS** for the first three (mtime-confirmed); **COULD NOT FULLY CONFIRM** `04` was not run against the remote DB — no local artifact could prove this either way; no evidence found consistent with it not having run

## Out-of-scope changes

None found. `git status --short` shows the same 11 top-level entries as
every prior round; the only new/changed content this round is
`reports/t06-dev-r3.md` (new) and the t06 §1 row + one §2 block in
`scratchpad.md`, both inside the pre-existing sprint-directory `??` entry.

## Bugs found

1. **Citation error in `reports/t06-dev-r3.md` §3** (minor, does not affect
   the live runbook's correctness): the dev cites the email column-mapping
   comment as living at `docs/migracion/03-clientes-import-dry-run.sql:95`.
   I read that line directly — it is a `VALUES` data row (`(10, 'NORMAL', ...
   'MELANY ROCÍO CRUZ ', ...)`), not the mapping-doc comment. The actual
   comment (`--   email  -> email  verbatim if present; blank -> 'N/A' ...`)
   is at **line 63**, not 95. (The `generate-clientes-import.py:95` and
   `:203-205` citations in the same paragraph ARE correct — I confirmed both
   independently.) This is exactly the kind of unverified line-citation this
   round exists to catch; ironic that it appears in the report doing the
   catching. Does not change any conclusion (the underlying mapping rule
   text and "0 empty" reasoning are correct), but the citation itself is
   wrong and should be fixed for anyone who goes to check it.
2. **Count error in the same report, §3**: the dev states "This lists all 40
   `_checks` row names in the file." I ran the same enumeration and counted
   **42**, confirmed twice (`grep -c` and manual count of the full printed
   list). Does not change the conclusion (I independently confirmed none of
   the 42 real names is `644`, matching the dev's underlying claim), but the
   stated count is wrong.
3. **Pre-existing scratchpad-cap overflow, not introduced by r3 but not
   flagged by r3 either**: `.claude/rules/context-budget.md` caps the sprint
   scratchpad at ≤300 lines total (checked at sprint close). The file is
   currently **438 lines** (`wc -l` confirmed) — already over cap *before*
   r3 appended its 30-line block (i.e., it was already ~408 lines from prior
   rounds). The rule says "When it overflows, the next writer folds the
   oldest handoffs into one-line ledger rows first" — r3 appended without
   folding, making the overflow larger (408 → 438). This is a real, if
   currently non-blocking, violation (the rule states it's enforced "at
   sprint close," which hasn't happened yet) — flagging now so it isn't
   missed at close.

## Suggested fixes

- Fix the two citation errors in `reports/t06-dev-r3.md` §3 (line 95 → 63;
  "40" → "42") — a follow-up note or superseding addendum is sufficient; no
  need for a full new round, since neither error changes this round's
  verdict.
- Before sprint close: fold the oldest `§2` handoff blocks (e.g. the
  earliest t02/t03 rounds) into one-line ledger notes to bring
  `scratchpad.md` back under the 300-line cap, per
  `.claude/rules/context-budget.md`'s own instruction — this is a
  lead/architect-level close action, not something this QA round should do
  itself (would mean touching content beyond this round's mandate).

## RLS / org isolation, fiscal, money-math playbooks

Not applicable this round: no source table, RLS policy, fiscal table, or
money computation is touched by t06 (verified: `grep -inE
"CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER TABLE|comprobantes_fiscales"`
against both `.sql` files and the runbook — none of this round's files were
edited, and prior rounds already established 0 hits for these patterns per
the sprint brief's ADR-0011/0012 framing). No new attack surface this round.

---

## Scratchpad update (this QA round)

Updated `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md`:
- `§1` t06 row: verdict column changed to reflect QA round 3 PASS (with the
  disclosed r2/r2b evidence-gap note preserved).
- Appended one new `§2` handoff block, `### t06 qa-r3 2026-09-22` (≤40 lines).
No other row or content touched.
