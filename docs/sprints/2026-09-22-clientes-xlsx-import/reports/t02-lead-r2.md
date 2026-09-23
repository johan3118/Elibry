# T2 — Generator + generated dry-run SQL — lead decision record, ROUND 2

**Decision: A — APPROVE**

---

## Plan reviewed

`docs/plans/clientes-xlsx-import.md`, §9 T2 (lines 384-417), 12 numbered
acceptance criteria — re-read in full before either round-2 report, per
process (never decide from memory of round 1). Also re-read my own round-1
decision record (`reports/t02-lead.md`) for continuity: round 1 issued
Decision B on a single HARD GATE ("acceptance criterion marked FAIL") —
AC 5's `Q4_backfill_sexo_402` check asserted `expected='402'` against a
predicate that actually evaluated to 408, because the placeholder literal
`'N/A'` collides with 6 sheet rows whose `sexo` cell was genuinely,
legitimately `'N/A'` already. I offered two fix options (A: provenance-aware
boolean column; B: re-baseline the check to 408 with a renamed, honest
assertion) and required a full fresh resubmission re-proving all 12 ACs, not
just the fixed one.

## What changed this round

The dev chose **Option A**, exactly as specified: a diagnostic-only
`sexo_was_blank boolean` column staged into the `_clientes_import` TEMP
table (set from the generator's already-correct `flags["sexo"]` provenance
tracking, no change to mapping/validation logic), with
`Q4_backfill_sexo_402`'s predicate repointed from `sexo = 'N/A'` to
`WHERE sexo_was_blank` (expected literal unchanged at `'402'`). Regenerated
`03-clientes-import-dry-run.sql` in full (never hand-edited, per the header's
own `DO NOT EDIT — generated` rule) and resubmitted a complete, self-contained
`t02-dev-r2.md` re-proving all 12 plan ACs, not a diff-only addendum — matching
what I required in round 1.

## HARD GATES — verified individually, none triggered

- **Real diff produced:** yes — 5 exact hunks pasted (`DB_COLUMNS` list,
  `transform()` assignment, `build_values_lines()`, the check-predicate
  tuple, and the `CREATE TEMP TABLE` column list), not a summary.
- **Tests actually run, output shown:** yes — `npm run qa` (tsc clean,
  eslint 0 errors/28 pre-existing warnings, vitest 825/825) pasted by the dev
  **and independently re-run by QA**, matching.
- **New table without RLS:** none. `sexo_was_blank` lives only inside
  `pg_temp._clientes_import`, a session-scoped TEMP table, not a `public`
  object — QA grep-confirmed zero `CREATE POLICY`/`ROW LEVEL SECURITY`/
  `GRANT`/`ALTER TABLE`/`CREATE ROLE` in the emitted SQL. Per ADR-0011
  (Elibry is single-tenant, no auth, no RLS on the ~29 pre-existing tables),
  no policy is owed here regardless.
- **Existing RLS weakened/bypassed:** N/A, no RLS system in this project.
- **Missing rollback note:** present, prose-only, no git verb, names exactly
  the two files to restore/delete.
- **Acceptance criterion marked FAIL:** none. QA's round-2 verdict is PASS,
  12 of 12 ACs individually re-checked and passed — this is the gate round 1
  tripped on, and it is now clear.
- **Optimistic UI with no rollback:** N/A, no UI/React file touched.
- **Auth/payment/destructive DB change not in plan:** none — offline
  generation only, no DB connection opened this task, confirmed by both
  reports.
- **Out-of-scope files changed:** none. QA independently ran
  `git status --short` and confirmed exactly the 8 pre-existing top-level
  entries (same as round 1), with only the 3 declared round-2 files
  (`generate-clientes-import.py`, `03-clientes-import-dry-run.sql`,
  `t02-dev-r2.md`) new/changed inside scope.

## Why I'm trusting this verdict (not rubber-stamping)

QA's round-2 report is not a re-assertion of the dev's numbers — it
independently re-derived the fix from first principles twice:

1. A brand-new parser against the regenerated SQL's `VALUES` data reproduced
   both halves of the original diagnosis on the **current** payload:
   `sexo_was_blank = true` count is 402 (matches the check's own
   `expected='402'`), and the **old, broken** predicate (`sexo = 'N/A'`) is
   still 408 on this payload — proving the round-1 bug was real and this fix
   addresses it, not a coincidental pass.
2. A second, independent script reading the raw pinned `.xlsx` directly
   (bypassing the generator entirely) found 628 blank `sexo` cells (402
   NORMAL + 226 EMPRESA) and exactly 6 non-blank literal `'N/A'` cells, then
   spot-checked all 6 colliding row IDs (480, 995, 1032, 1087, 1095, 1197)
   against the raw sheet and against the generated SQL's
   `sexo_was_blank=false` flag for those rows — confirming the fix tracks
   genuine per-row provenance, not a hardcoded 402.
3. `sexo_was_blank`'s leak surface was traced explicitly: absent from
   `MAPPING_TABLE` (correct — it has no sheet source and isn't a live
   `clientes` column), lives only inside `pg_temp`, and carries an inline
   "T4 must not select it" comment at both definition sites. T2's scope
   contains no code path that could select it into a real table.
4. The other 11 ACs were re-verified with fresh scripts, not trusted
   unchanged from round 1 — row count/id-set, all 5 other backfill sites,
   mapping fidelity, verbatim preservation (3-comma email, 45 dirty emails,
   both NBSP-normalized duplicate `identificacion` pairs), HC-1
   mutation-tested again (real abort, zero output file on overflow),
   isolation/DDL grep (1 expected benign `pagos` read), header, and
   `npm run qa`.
5. Cross-checked the "only 5 hunks changed" claim against round 1's
   still-on-disk `t02-dev.md`: every independently-measured value (line
   count, other backfill counts, distributions, HC-1 lengths, dirty-email
   count, NBSP count, isolation grep) is identical round-to-round except the
   two SHA-256 hashes (expected — payload gained a column) and the `sexo`
   predicate itself.

This is a narrow, single-site fix, implemented exactly per the option I
specified in round 1, independently re-derived rather than asserted. I have
no basis to withhold approval.

## Judgment items — carried forward, still not verdict-affecting

Both items from round 1 remain open as **process** items, not T2 rework, and
neither was touched this round (correctly, per my round-1 instruction not to
re-litigate them):

1. **Q6 "7 preserved columns capturable" deferral to T4** — plan §9 T2's AC
   list is silent on it; it is T4's territory (plan §3 statement 1). Still
   correctly out of scope for T2. Whoever picks up T4 must resolve the
   7-column identity against T1's Q4 column list with a traceable decision,
   not silently inherit the T2 dev's disclosed-but-unapproved hypothesis.
2. **`pais` human-ruling paper trail** — the accented `'República Dominicana'`
   literal supersedes the plan's frozen HC-4 text. This was applied
   identically by T1 (already PASSed), T2's dev, and QA, and is described as
   relayed from the human via the orchestrator. I am not blocking T2 on it —
   unwinding it now would cascade into T1 rework — but I am re-flagging, as I
   did in round 1: **before T3 executes the dry run live, the orchestrator
   should get the human to confirm the `pais` override directly, in their own
   words, in a durable record.** This is unchanged from round 1's note and
   still outstanding.

## Rollback

No DB touched, no git verb, this round or last. This task's artifacts remain
two files: `docs/migracion/generate-clientes-import.py` and
`docs/migracion/03-clientes-import-dry-run.sql`. Reverting means restoring
`generate-clientes-import.py` to its round-1 state (or deleting it) and
regenerating/deleting `03-clientes-import-dry-run.sql` accordingly.

## What shipped (one-line confirmation)

T2 approved: the offline, stdlib-only generator (`generate-clientes-import.py`,
500 lines) and its regenerated, deterministic dry-run SQL
(`03-clientes-import-dry-run.sql`, payload-sha256
`9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392`) that
stages all 1,231 clients with correct mapping, placeholder-backfill
accounting (including the now-fixed `sexo` provenance check), verbatim
preservation, and a live HC-1 length-overflow gate — 12 of 12 plan ACs
independently verified PASS by QA from scratch. T3 (run the dry run live) may
proceed.
