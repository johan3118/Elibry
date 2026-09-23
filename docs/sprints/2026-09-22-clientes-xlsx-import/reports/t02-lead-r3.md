# T2 — Lead Decision, ROUND 3

**Decision: A) APPROVE.**

Scope of this review: round 3 only, judged on its own merits — did it genuinely fix the
specific defect T3 found live (`operator does not exist:
information_schema.sql_identifier[] = text[]` in `Q1_not_null_columns_match`), and did it
avoid regressing anything round 2 already earned PASS on. Rounds 1 and 2 are closed
history and not re-litigated here.

## 1. Is the specific T3-found defect genuinely fixed?

Yes, independently proven twice, not asserted once:

- **Dev (t02-dev-r3.md §"Mandatory re-proof 5"):** ran the corrected `SELECT`
  (`array_agg(column_name::text ORDER BY column_name::text) = ARRAY[...]::text[]`) live,
  read-only, single statement, via `supabase db query` — result `true`, matching
  `expected='true'`.
- **QA (t02-qa-r3.md §2), independently, not copy-pasted:** re-typed the same corrected
  SELECT from the on-disk file itself (not from the dev's report text) and got the same
  `true`. QA additionally re-ran the **old, round-2 predicate** live and reproduced the
  exact same error T3 found (`operator does not exist:
  information_schema.sql_identifier[] = text[]`), ruling out the possibility that the bug
  was stale, environment-specific, or already fixed elsewhere. This before/after pairing —
  old predicate still fails, new predicate now succeeds, same live schema, same session —
  is the strongest form of proof available short of re-running the full T3 dry run (which
  is correctly out of scope for T2; that's T3's exclusive job per the plan's own task
  boundary).
- **On-disk artifact confirmed to carry the fix, by both parties reading the file
  directly:** generator line 265/266 and generated SQL line 1338 both show
  `array_agg(column_name::text ORDER BY column_name::text)` — QA grepped this itself
  rather than trusting the dev's quoted diff.
- **No second instance of the bug class:** dev grepped for
  `table_name|constraint_name|trigger_name|column_name`; QA ran an independently
  broader net (`table_name|constraint_name|trigger_name|column_name|conname|tgname|
  relname|nspname|typname|attname|data_type|udt_name`) across the whole generator and
  confirmed every other identifier-typed comparison in the file (`table_name='clientes'`,
  `conname IN (...)`, `tgname='...'`, `tgname ILIKE '...'`) is scalar equality, not array
  equality, and therefore not exposed to the `sql_identifier[] = text[]` operator gap.
  Two independently-constructed greps landing on the same "exactly 1 site" conclusion is
  real corroboration, not restatement.

## 2. Did it regress anything round 2 already fixed?

No. The round-2 `sexo_was_blank`/`Q4_backfill_sexo_402` fix (402 vs. the raw-predicate
408) is re-confirmed intact by both the dev's and QA's independently-written parsers,
run fresh against the round-3-regenerated file, with both numbers (402 and 408)
re-derived and shown to remain distinct — the specific failure signature that would
catch a "collapsed" or silently-reverted fix. Line numbers, predicates, and expected
values for every other check (`Q3_compania_*`, `Q3_pais_literal_all_1231`,
`Q3_referido_por_never_contains_MARCA`, `Q4_estado_registro_*`, `Q5_dirty_email_count`,
NBSP dup-`identificacion` checks) are identical to round 2's, consistent with the
unchanged payload-sha256 (`9664ee4e...932392`) — this round's fix touched only a
check-predicate string, not the mapped row payload, and both parties verify this by hash,
not by assertion.

## 3. Full-12-AC resubmission — genuinely re-verified, not rubber-stamped

QA's report re-derives every one of the plan's 12 T2 ACs (lines 388-417) from scratch
against the current on-disk files: own `wc -l`/import grep (AC1), own two-run
regeneration + three-way hash match + leakage grep (AC2), own quote-aware VALUES parser
for row count/id-set (AC3) and all six backfill sites (AC5), own mapping-fidelity
re-derivation (AC4/AC6/AC8), own from-scratch HC-1 mutation test with a separate scratch
copy and path overrides (AC7), own recomputed payload-sha256 matched against the header
line (AC9), own isolation/DDL grep (AC10), own `npm run qa` invocation with full output
pasted (AC11), and the dev's prose rollback note checked for the absence of a git verb
(AC12). All 12 land PASS. This is the depth of independent re-verification the plan's
"resubmission, not diff" instruction calls for.

## 4. HARD GATES

- Real diff produced — **yes**: single-hunk diff shown (`::text` cast on both sides of
  the `ORDER BY`/comparison), confirmed on-disk by QA's own grep at the same line number.
- Tests actually run, output shown — **yes**: `npm run qa` pasted in full by the dev
  (825/825 tests, 0 lint errors, 28 pre-existing unrelated warnings) and independently
  re-run by QA with matching results.
- RLS / org isolation — **N/A**, ADR 0011 (Elibry single-tenant, no RLS by design), no
  table created in `public`; both parties independently grep zero
  `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER TABLE|CREATE ROLE`.
- Rollback note — **present and correct**: restore the two touched files to round-2 form
  (explicitly flagged as "not recommended, live-proven-broken") or delete both; no git
  verb; the one live query each side ran was a bare read-only `SELECT`, nothing to roll
  back in the database.
- Acceptance criterion marked FAIL — **none**; QA scores 12/12 PASS.
- Out-of-scope files changed — **none**: `git status --short` shows the identical 8
  top-level entries as rounds 1, 2, and T3, confirmed independently by both dev and QA;
  `04-clientes-import-execute.sql` confirmed absent.
- Optimistic UI without rollback — **N/A**, no UI/React file touched.
- Auth/payment/destructive DB change not in plan — **none**: every live query on both
  sides was a single bare `SELECT`, no transaction opened, no row changed
  (`count(*)=1, max(id)=15` reconfirmed unchanged before/after by QA).

None of the automatic-B/D gates fire.

## 5. One process note, flagged but not blocking

The plan's T2 header states "**DB/isolation:** none — offline generation only. No DB
connection" (plan line 387), yet both this round's dev and QA ran a live, read-only,
single-statement `SELECT` against `information_schema.columns`. I do not treat this as a
scope violation: it is the direct, narrowly-bounded consequence of T3 finding a defect
that is only provable against live Postgres (a domain-type operator gap that cannot be
reproduced by static analysis or the offline generator alone), it was explicitly called
out by the dev as a "mandatory re-proof" required by this round's send-back, it is
read-only by construction (a bare `SELECT` cannot mutate), and it was independently
repeated by QA rather than taken on faith. Both sides disclosed it plainly rather than
hiding it inside "ran `npm run qa`, all green." Recording this here so the sprint record
is honest about the deviation, but it does not change the decision — the alternative
(refusing to confirm the fix against live Postgres at all) would be strictly worse
evidence discipline.

## Conclusion

Round 3 does what it needed to do: it fixed exactly the one defect T3 proved live, proved
the fix live and independently on both the dev and QA side (including re-proving the old
predicate still fails, which rules out a false-positive fix), found no second instance of
the bug class via two independently-constructed greps, and re-verified all 12 plan ACs
plus the round-2 `sexo_was_blank` fix are intact with zero payload drift (unchanged
payload-sha256) and zero scope creep (identical 8-entry `git status --short`). QA's PASS
is evidence-backed, not asserted.

**APPROVE T2 (round 3).** T3 may now be re-run in full, from a clean state, against this
regenerated artifact (payload-sha256 `9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392`,
output-sha256 `63fbe5a1ab6710b2c6c6af5d5a555adba34287c819533de610566be9ff20aba4`).
