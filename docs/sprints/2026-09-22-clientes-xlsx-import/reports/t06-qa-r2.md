# T6 round 2 — §10 email-count fix — QA report

**Verdict: PASS**

Round 1's single defect (§10's "roughly 644" claim conflating a combined sum with a
disjoint placeholder-only bucket) is fixed. The new sentence states the correct,
disjoint 45/599 breakdown, cites a real `_checks` row for 599
(`Q4_backfill_email_599`), and the dev's claim that this check exists and computes
exactly 599 is independently confirmed, not fabricated. Diff is confined to exactly
the one bullet. Scope, file length, redaction, and `npm run qa` all re-verified clean
by me from scratch, using my own methods (not the dev's script).

---

## 1. Exact new wording (read live from the file, not from the dev's report)

```
$ sed -n '268,273p' docs/migracion/README-clientes-import.md
- **Some imported email addresses are not well-formed; this import does not clean them
  up.** 45 rows have an email value that doesn't match a normal `name@domain.tld` shape,
  and 599 rows have `email = 'N/A'` (`Q4_backfill_email_599`; no other empty-email rows
  exist). This import backfills missing data — it does not clean existing dirty values.
  If someone later opens one of these clients in `/clientes/editar` and tries to save
  without fixing the email first, the form's own email validation will reject the save
```

Matches the dev-r2 report's claimed wording verbatim.

## 2. `Q4_backfill_email_599` citation — verified real, not fabricated

```
$ grep -n "Q4_backfill_email_599" docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
docs/migracion/03-clientes-import-dry-run.sql:1358:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_email_599', '599', (SELECT count(*)::text FROM _clientes_import WHERE email = 'N/A'));
docs/migracion/04-clientes-import-execute.sql:1282:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_email_599', '599', (SELECT count(*)::text FROM _clientes_import WHERE email = 'N/A'));
docs/migracion/04-clientes-import-execute.sql:1340:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_Q4_backfill_email_599', '599', (SELECT count(*)::text FROM clientes WHERE email = 'N/A'));
```

Present in both files at the line numbers claimed (03:1358, 04:1282, plus a
`_post_checks` mirror at 04:1340), and the literal SQL text is exactly
`count(*) FROM _clientes_import WHERE email = 'N/A'` expected `'599'` — matches the
dev's citation exactly. **Accurate, not fabricated.**

## 3. Independent re-derivation of the email breakdown (own method, own bugs, own fix)

I did not reuse the dev's or round-1 QA's parser. I wrote my own Python tokenizer from
scratch against the raw `_clientes_import` INSERT block (confirmed via `grep`/`awk`
that the statement spans lines 85 (header) through 1316 (last row, id=1240), 1231 data
rows — verified independently: `awk 'NR>=86 && NR<=1319 && /^  \(/{c++}'` and a direct
`grep -n "(1240, 'NORMAL'"` / `grep -n "^);"` cross-check pinned the true end at line
1316, not 1319 as I first guessed).

My first run had a real bug (forgot to `btrim`/strip whitespace before regex-matching,
exactly the same NBSP/whitespace-normalization trap logged in this sprint's own
scratchpad for T2 round 4). It produced N/A=599 but dirty=54 (wrong). I diagnosed it
against the SQL's own literal predicate (`btrim(replace(email, chr(160), ' ')) !~
'^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$'`), added the missing `.strip()` to match `btrim`
exactly, and re-ran:

```
N/A: 599 empty: 0 dirty: 45 sum N/A+dirty: 644
```

This exactly reproduces the SQL's own two checks:

```
$ grep -n "Q4_backfill_email_599\|Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
1358:...('Q4_backfill_email_599', '599', ...)
1368:...('Q5_dirty_email_count', '45', ...)
```

**Independently confirmed: N/A = 599, empty = 0, dirty (non-N/A regex-mismatch) = 45,
disjoint sum = 644.** These three categories are disjoint by construction — the SQL's
own dirty predicate explicitly excludes `email = 'N/A'` (`email <> 'N/A' AND ...`).

## 4. Sentence accuracy / internal consistency

The new sentence states 45 (dirty) and 599 (`email = 'N/A'`, cited to
`Q4_backfill_email_599`) as two separate, correctly-labeled figures, and explicitly
adds "no other empty-email rows exist" (matches my independently-derived empty count
of 0). It nowhere states a combined "644" figure that could be mistaken for a third,
disjoint bucket — the exact failure mode round 1 caught is gone. No remaining
internal-consistency problem found.

## 5. Scope — `git status --short` before/after

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

Identical 11 entries to the session-opening snapshot and to round 1's QA report.
`README-clientes-import.md` was already `??` (edited in place, as in round 1); no new
top-level file. Both `.sql` files and the generator untouched.

## 6. File length

```
$ wc -l docs/migracion/README-clientes-import.md
     300 docs/migracion/README-clientes-import.md
```

Exactly 300 — at, not over, the plan's ≤300-line ceiling. Length-neutral, as required.

## 7. Diff confinement — reconstructed round-1 file vs. current

```
$ sed -n '132,431p' docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-dev.md | sed -e 's/^+//' > r1_full.md
$ wc -l r1_full.md
     300 r1_full.md
$ diff -u r1_full.md docs/migracion/README-clientes-import.md
@@ -264,13 +264,13 @@
 ...recorded, not fixed.
-- **Some imported email addresses are not well-formed; this import does not clean
-  them up.** 45 rows have an email value that doesn't match a normal
-  `name@domain.tld` shape, and roughly 644 rows carry a placeholder or empty email.
-  This import backfills missing data — it does not clean existing dirty values. If
-  someone later opens one of these clients in `/clientes/editar` and tries to save
-  without fixing the email first, the form's own email validation will reject the
-  save until it's corrected. Accepted consequence of "backfill, don't clean."
+- **Some imported email addresses are not well-formed; this import does not clean them
+  up.** 45 rows have an email value that doesn't match a normal `name@domain.tld` shape,
+  and 599 rows have `email = 'N/A'` (`Q4_backfill_email_599`; no other empty-email rows
+  exist). This import backfills missing data — it does not clean existing dirty values.
+  If someone later opens one of these clients in `/clientes/editar` and tries to save
+  without fixing the email first, the form's own email validation will reject the save
+  until it's corrected. Accepted consequence of "backfill, don't clean."
 ...before this run. Two of the 42 pre-write checks and one of the 33 after-the-fact
```

**Exactly one hunk, this bullet only.** Everything else in the 300-line file —
including all §9/§10 disclosures round 1 already verified (RAISE EXCEPTION citations,
PROCEED/ABORT logic, freeze-rationale citations, channel guidance, dangling
`cambios_provisionales id=69`, stale header comment) — is byte-identical to round 1.
This also satisfies item 10's spot-check: those sections are unchanged by construction
of this diff, no separate re-derivation needed.

## 8. `npm run qa` (re-run independently)

```
$ npm run qa
> tsc --noEmit          (clean, 0 errors)
> eslint .              ✖ 28 problems (0 errors, 28 warnings) — identical warning set/files to every prior round
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Duration  3.80s
$ echo $?
0
```

Full regression gate green, exit 0. No `app/`, `lib/`, `components/`, `hooks/`, or
`tests/` file touched.

## 9. Redaction / destructive-git-verb sweep (re-run)

```
$ grep -inE "git checkout|reset --hard|clean -fd|stash drop|force-push|force push|git reset" docs/migracion/README-clientes-import.md
(no output, exit 1 — 0 hits)

$ grep -inE "postgres://|postgresql://|service_role|anon_key|eyJ|sslmode=require&|@.*\.supabase\.co" docs/migracion/README-clientes-import.md
(no output, exit 1 — 0 hits)

$ grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/migracion/README-clientes-import.md
268:name@domain.tld

$ grep -noE "[0-9]{6,}" docs/migracion/README-clientes-import.md
(no output, exit 1 — 0 hits)
```

No destructive git verb, no connection string/key, only the pre-existing illustrative
`name@domain.tld` placeholder. No new PII introduced (`Q4_backfill_email_599`, `599`,
`N/A` are not PII).

---

## Acceptance criteria (this round's scope)

1. §10 malformed/placeholder-email bullet states correct, unambiguous, disjoint
   numbers (45 dirty, 599 placeholder, 0 empty) — PASS
2. New 599 citation (`Q4_backfill_email_599`) is real and traceable in both `.sql`
   files at the cited lines — PASS
3. No other section/file touched; diff confined to exactly one hunk/bullet — PASS
4. File length ≤300 lines, length-neutral vs. round 1 — PASS
5. `npm run qa` clean re-run, full output pasted — PASS
6. Redaction / destructive-git-verb sweep clean — PASS

## Out-of-scope changes

None. `git status --short` unchanged (11 entries) from the session-opening snapshot
and from round 1's QA report. Only `docs/migracion/README-clientes-import.md` (one
bullet) plus this task's own report/scratchpad edits.

## Bugs found

None remaining. Round 1's single defect (the "roughly 644" conflation) is fixed and
independently re-verified correct.

## Suggested fixes

None. Task is complete as submitted.

---

## Attack Log (adversarial QA required output)

- RLS: N/A — documentation-only task, no table/policy/app code touched (carried over
  from round 1, not re-litigated; confirmed still true by the diff-confinement check
  in item 7 above).
- Optimistic UI: N/A — no UI code touched.
- Realtime: N/A — no subscriber-facing code touched.
- Edge cases tried: (1) did not trust the dev's claimed line span for the INSERT
  block — independently re-derived it (85 header / 1316 last row) via `awk`+`grep`
  and caught my own initial off-by-3 guess before it produced wrong output; (2)
  deliberately did NOT copy the dev's or round-1 QA's parser — wrote my own from
  scratch, which reproduced round-1 QA's exact NBSP/`btrim` mistake, then fixed it
  the same way T2-r4's scratchpad entry documents, rather than assuming my first
  (wrong, dirty=54) run was correct; (3) independently verified the `Q4_backfill_
  email_599` citation exists byte-for-byte in both `.sql` files rather than trusting
  the dev's grep output; (4) re-checked that the 45/599/0 categories are disjoint by
  construction (SQL's own `email <> 'N/A' AND ...` predicate) rather than assuming
  non-overlap; (5) reconstructed the full round-1 file from t06-dev.md's own pasted
  diff and re-diffed against the live file to confirm no other section was touched.
- What I tried that could have broken this: independently re-derived the 599/45/0
  breakdown from raw SQL text with my own tokenizer rather than re-running the dev's
  script or trusting the pasted numbers — this is the same category of check that
  caught the round-1 defect, and applying it again this round turned up no further
  discrepancy (my own first attempt did produce a wrong number, which is exactly the
  kind of failure this check exists to catch — it just happened to be my own parser
  bug this time, not a runbook defect, and I fixed it before concluding).

---

Rollback note (this QA task itself): this report and the scratchpad update are
new/appended-only; `rm docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-qa-r2.md`
removes this report. No source file was edited by QA.
