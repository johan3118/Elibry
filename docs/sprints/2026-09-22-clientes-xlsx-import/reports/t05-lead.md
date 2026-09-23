# T5 — Lead decision record

**Decision: A — APPROVE.**

## What was reviewed
- Plan: `docs/plans/clientes-xlsx-import.md` lines 476-494 (T5 acceptance criteria).
- Scratchpad §0 brief (ADR 0011/0012/0014, `assertion-without-verification`,
  `weak-backstop-guard`, `redaction-discipline`, `git-diff-scope-excludes-untracked-files`)
  and the newest §2 handoffs (t04 qa-r2, t05 dev, t05 qa).
- `reports/t05-dev.md` (full) and `reports/t05-qa.md` (full), in that order, after the plan.

## Plan AC check (lines 476-494)
1. Real guard text, byte-for-byte, only comparison literal inverted, executed live,
   `RAISE EXCEPTION` captured verbatim — **met**. Dev fired 3 distinct guards (2 pre-write:
   `Q1_clientes_count_is_1`, `Q1_live_id_15_is_jrosa`; 1 post-check:
   `Post_pagos_ref_15_unchanged_0`), exceeding the plan's minimum of 1. QA independently
   re-extracted the same source lines via its own `grep`/`sed`, rebuilt the SQL files from
   scratch (not copying the dev's scratch files), and reproduced identical verbatim
   `RAISE EXCEPTION` text for all 3.
2. Abort-everything property (statement after failing guard errors with `current
   transaction is aborted, commands ignored until end of transaction block`) — **met**,
   reproduced independently by QA, verbatim text matches.
3. `clientes` count before/after identical — **met**. Both dev and QA captured baseline
   (`count=1, max(id)=15`) before any rehearsal and re-confirmed it unchanged after all
   live statements (7 by dev, 8 by QA incl. the trap case).
4. Report states plainly which guard was rehearsed and that the rest are not individually
   rehearsed, no blanket claim — **met**. Dev report §9 discloses only 2 of 42 pre-write
   guards and 1 of 33 post-checks were individually fired, explains why the shared
   generic aggregate mechanism generalizes, and explicitly does NOT claim every
   individual predicate's semantic correctness is proven. QA independently confirmed the
   `grep -c "RAISE EXCEPTION"` = 3 count matches the disclosure exactly (no hidden site,
   no overclaim).
5. No credentials, no PII; rollback note read-only/no git verb — **met**, both dev and QA
   ran independent redaction greps (no hits beyond a self-referential echo of the search
   command itself, correctly identified as not a leak) and the rollback note states
   plainly that nothing was written and no SQL file was edited.

All 5 plan ACs: PASS, independently corroborated (not just asserted by dev).

## Hard-gate check (CLAUDE.md)
- Real diff produced: N/A in the code-diff sense (this task's scope is evidence-only,
  no source file edited) — but "real diff" is satisfied in spirit: pasted live query
  output, verbatim `RAISE EXCEPTION` text, and hash comparisons, not summarized claims.
- Tests run with output shown: `npm run qa` pasted by both dev and QA independently —
  825/825 tests, 0 lint errors, exit 0.
- No out-of-scope files changed: confirmed by both via `git status --short` (9 `??` +
  1 pre-existing unrelated `M CLAUDE.md`, identical before/after). Only
  `reports/t05-dev.md`, `reports/t05-qa.md`, and the shared scratchpad were touched —
  matches the plan's declared scope for T5 exactly.
- RLS/org isolation: N/A — no table created, ADR 0011 (single-tenant, no RLS) confirmed
  in the brief; QA grepped for `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER TABLE` — zero
  hits.
- Optimistic UI rollback: N/A — no UI code touched.
- Rollback note present: yes, read-only, no git verb, nothing to revert.
- No acceptance criterion marked FAIL.
- Auth/payment/destructive DB change not in plan: none occurred. This is the single
  hardest gate on this task and both reports independently establish it beyond ambiguity:
  `04-clientes-import-execute.sql` has exactly one `BEGIN` (line 7) / `COMMIT` (line
  1363) spanning the whole file; nothing in either transcript executes any statement in
  that range. Every live statement either (a) reads a business table via plain `SELECT`,
  or (b) writes only to a `pg_temp`-scoped throwaway table (`_checks`/`_post_checks`),
  never `clientes`/`reservas`/`pagos`/etc. QA specifically grepped the dev report for
  `INSERT INTO clientes|UPDATE clientes|DELETE FROM clientes|INSERT INTO reservas|...`
  (zero hits) and for the one `psql -f docs/migracion/04-...sql` mention, confirming it
  is prose recommending the channel to T6/the human, never an executed command in this
  transcript. No ambiguity.

No hard gate is violated.

## Specific scrutiny points (per the orchestrator's brief)
1. **"No repo file changed" claim** — genuinely true. Both `03` and `04` SHA-256 hashes
   were captured before and after all rehearsals by both dev and QA, all four
   reads identical (`9146d0d5...689b1` / `a5f74af3...42cc4`), and match the values
   already approved earlier in the sprint (t02-r4, t03-r3, t04-r2). Chain of custody on
   these two files is unbroken across the whole sprint. `git status --short` count
   (9 untracked + 1 pre-existing unrelated tracked mod) is identical before/after,
   independently confirmed twice.
2. **Never ran `04`'s real INSERT/UPDATE/DELETE** — unambiguous. See hard-gate analysis
   above. The rehearsal SQL files are minimal, self-contained extractions
   (`DROP TABLE IF EXISTS pg_temp._checks` / `CREATE TEMP TABLE` / one `INSERT` into that
   temp table / the guard's own `DO $$...RAISE EXCEPTION$$` block) — never the full file,
   never a range reaching the file's DML. QA's independent structural check (single
   `BEGIN`/`COMMIT` pair spanning lines 7-1363, nothing in either transcript touching that
   range) closes the ambiguity gap completely.
3. **§9 disclosure honesty** — matches the `assertion-without-verification` prevention
   rule correctly: plainly states 39/42 pre-write and 32/33 post-checks were NOT
   individually rehearsed, and separately explains what IS proven (the two shared
   generic aggregate mechanisms) versus what is NOT (per-guard semantic correctness of
   each predicate against real payload/post-migration data). QA did not just read the
   disclosure and trust it — it independently fired the one guard the dev flagged as a
   "raises even unmodified" trap (`Post_reserva_10_cliente_is_1185`) specifically to test
   whether the disclosure was honest or convenient framing, and confirmed it reproduces
   genuinely. This is exactly the adversarial behavior the sprint's brain-derived
   prevention rule calls for, and it landed clean.
4. **Channel discovery (`psql` via `brew install libpq`)** — legitimate and useful, not a
   shortcut that weakens anything. It replaces T3/T4's Node+`pg` workaround (which
   required `ssl:{rejectUnauthorized:false}`, an explicit TLS-verification weakening)
   with a strictly cleaner alternative: the unmodified `POSTGRES_URL_NON_POOLING` string,
   no client-side override, libpq's native TLS stack. `brew install libpq` is a local
   package-manager action, not a repo change, and does not touch `.env.local` or any
   connection parameter. QA independently reconnected using the same approach, reading
   the connection string from raw `.env.local` itself (never printed) rather than trusting
   the dev's claim, and confirmed no TLS/cert weakening of any kind. This is a genuine
   improvement worth carrying to T6, correctly flagged as "carried forward" rather than
   silently assumed.
5. **File scope** — confirmed exactly `reports/t05-dev.md`, `reports/t05-qa.md`, and the
   shared scratchpad's own t05 rows were touched, matching the plan's declared scope for
   T5 ("Files in scope: `reports/t05-dev.md` (+ `t05-qa.md`)"). No SQL file, generator,
   app/lib/component/test file was touched, confirmed independently by both dev and QA.

## QA methodology assessment
QA did not rubber-stamp. It rebuilt every rehearsal SQL file from scratch in its own
scratchpad, used `diff` to mechanically prove each negative/positive pair changes exactly
one literal (not trusting the dev's prose claim), reconnected via an independently-built
`psql` session sourced from raw `.env.local`, re-fired all 7 rehearsals plus the disclosed
trap case, and ran its own structural greps (`RAISE EXCEPTION` count, `BEGIN`/`COMMIT`
line search, business-table DML search) rather than accepting the dev's framing. This
meets the bar for independent adversarial verification on the sprint's highest-stakes
task (live DB rehearsal against production data).

## Decision
**A — APPROVE.** T5 shipped: live, read-only proof that 3 of the execute script's real
guards (2 pre-write incl. the load-bearing "clientes count=1 AND id=15 is genuinely
JROSA" precondition, 1 post-condition) genuinely abort the transaction when their
condition is false, that the unmodified guards do not fire against current production
state, and that the abort-everything transaction property holds — all captured verbatim,
independently reproduced by QA from scratch, with an honest, non-overclaiming disclosure
of what remains unrehearsed. No repo file was changed beyond the two reports and the
scratchpad; `03`/`04` hashes are unchanged and match the sprint's already-approved
values; `04`'s real DML was never executed, with no ambiguity. T6 (runbook) may proceed.
