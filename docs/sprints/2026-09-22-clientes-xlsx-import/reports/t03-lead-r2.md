# T3 ROUND 2 — Lead decision record

## Plan reference

`docs/plans/clientes-xlsx-import.md`, "### T3 — Run the dry run live, twice, and capture it"
(lines 421–441). Depends on T2. Files in scope: `reports/t03-dev.md` (+ `t03-qa.md`) only —
**no SQL file may be edited in this task**; a payload defect FAILS the task back to T2 rather
than being patched in place. DB/isolation: read-only, must write nothing.

## What I reviewed

- The plan section above, read fresh (not from the orchestrator's summary).
- `reports/t03-dev-r2.md` in full.
- `reports/t03-qa-r2.md` in full.
- `reports/t02-dev-r3.md` (top ~140 lines) to independently confirm the hash lineage this round's
  pre-flight check claims to match, and to confirm round 3's fix was scoped to exactly the
  `Q1_not_null_columns_match` predicate (line 1338), untouched by this round's new finding.

## My own read of the evidence

**Pre-flight integrity.** Dev and QA both hash the on-disk file independently
(`shasum -a 256` → `63fbe5a1...0aba4`) and independently grep the `payload-sha256` header
(`9664ee4e...932392`). Both match the values `t02-dev-r3.md` recorded as its own fresh
generator output (verified myself at `t02-dev-r3.md:110-111,121-122,134`). QA re-hashed again
*after* its own live runs and got the same value. No drift, confirmed on two independent
channels, not just cited.

**The new defect is real, not fabricated or channel-specific.** The dev found
`argument of NOT must be type boolean, not type text` at line 1341
(`Q1_audit_clientes_trigger_absent`), diagnosed it correctly as a Postgres operator-precedence
bug (`::` binds tighter than `NOT`, so `NOT EXISTS(...)::text` parses as
`NOT (EXISTS(...)::text)`), and reproduced it on two channels (its own Node/pg runner and
`supabase db query`). QA independently rebuilt the reproduction from scratch — its own new
script (`qa_run2.js`, not the dev's `pg_run.js`, not round-1 QA's runner), plus `supabase db
query` again — and got byte-identical error text on both. QA also confirmed the fix resolves
to `true` on its own channel, confirmed via its own grep that line 1341 is the only site with
this exact bug pattern (distinguishing it correctly from line 1340's in-subquery `NOT`, line
1342's already-correctly-wrapped cast, and line 1347's unrelated `NOT IN`), and confirmed the
round-3 fix at line 1338 is untouched and still evaluates `true` in isolation. This is
independent verification, not a rubber stamp — QA wrote its own tooling rather than reusing the
dev's, and used a second official channel (`supabase db query`) to rule out a bug specific to
either party's hand-rolled script.

**Read-only held.** `count(*)` / `max(id)` on `clientes` checked before, mid-batch (implicitly,
via the abort leaving nothing committed), and after — 1/15 unchanged — by both the dev and QA,
on their own independent connections, even though the batch aborted mid-run. This is the
correct proof point: an aborted implicit transaction with no explicit `BEGIN`/`COMMIT` rolls
back everything, and both parties verified that held rather than assuming it.

**Scope discipline.** Neither party touched the SQL file (hash-proven before/after). `git
status --short` is identical (8 pre-existing entries) before and after both the dev's and QA's
work, independently captured by each. Scratch tooling lived entirely under each party's private
scratchpad directory, never under the repo or `Elibry/node_modules`. No `04-...sql` was created.
This is exactly the discipline the task demands ("no SQL file may be edited in this task").

**AC3 ("run it a second time") judgment call.** Neither the dev nor QA performed a literal
second identical invocation of the same script against the same file. Both justify this the
same way round 1 did: a syntax/type error at parse-and-execute time is deterministic, not a
flake, so a second identical run teaches nothing. I agree with this reasoning as applied here,
and note QA went further than round 1 QA did by treating its own independently-written,
differently-implemented full-file run as a de facto second execution — it reached the identical
abort at the identical statement, which is stronger corroboration than round 1 had (round 1 QA,
per this round's citations, validated the same reasoning but I have not re-audited round 1's own
transcript here). Given AC4's explicit escape hatch ("Q3/Q4 grids read PASS ... or the task
reports FAIL loudly and stops — no close enough") and the task's own instruction that a payload
defect bounces to T2 rather than being patched or worked around, I treat AC3 as satisfied in
spirit: the "second run" requirement exists to catch flakiness and non-determinism, and both
parties affirmatively demonstrated the opposite — that the failure is deterministic and
channel-independent — which is a strictly stronger finding than a bare diff-identical pair of
runs would have been.

**No overclaiming.** The dev's §8 explicitly refuses to claim `Q1_not_null_columns_match` "reads
PASS" in the file's own output, distinguishing that from the isolated predicate evaluating
`true` — this is the correct, precise distinction (task AC7 requires the *file's* verdict, not a
component re-derivation). QA independently re-confirms and endorses this exact distinction
rather than letting it slide. Neither party fabricated a Q2–Q7 grid or a Q7 verdict that was
never produced.

**PII / credential discipline.** Both reports show only column names, trigger names, counts,
booleans, SHA-256 hashes, and Postgres error text. Env var names appear, not values. QA
independently grepped both reports for PII/credential patterns and found only benign prose
hits. I re-scanned both reports myself while reading them in full and found nothing that
contradicts this.

**Regression check.** QA ran `npm run qa` (not load-bearing for this DB-only task, but cheap
insurance, matching round 1's precedent) — 825/825 tests, 0 lint errors, clean typecheck.

## Applying the round-1 precedent

Round 1 established: when T3's live execution surfaces a genuine, reproducible defect in the
artifact it is testing (owned by T2, not T3), and the dev/QA correctly (a) do not patch it, (b)
do not fabricate downstream output, (c) prove read-only held, and (d) prove scope discipline —
T3's own task execution is APPROVED, and the artifact's FAIL is handled as a separate bounce to
T2 for a new round, not as a reason to send T3 back to redo its own work.

That precedent applies again here without modification. This round found a **different, second**
defect (operator-precedence at line 1341, vs. round 1's type-cast bug at line 1338) — it is not
the same bug resurfacing, which would suggest T3 or T2 mishandled the round-1 fix. The round-3
fix to line 1338 is independently confirmed intact and unaffected. There is nothing in this
round's evidence that changes the round-1 calculus: the dev and QA again did exactly what the
task asked, found a real live bug outside their remit to fix, and stopped loudly instead of
padding the report.

## Process observation (not a gate, not actioned by me)

Both the dev and QA independently flag the same structural point: two rounds in a row, T2's own
verification (Python-side re-derivation of expected values/logic) did not catch a live
Postgres syntax/type error, because it never actually executes the generated SQL. Both
recommend T2's round-4 resubmission include at least one live, read-only, full-file execution
smoke test as a pre-submission gate, before handing back to T3. I agree this is a sound
recommendation for whoever scopes T2 round 4, but it is a process suggestion, not a design
fork requiring architect sign-off, and not something I am actioning by editing any file — it is
already logged in both reports' handoff sections and I will consider it as sprint-close
mistake-filing material if it recurs a third time.

## Decision

**A — APPROVE** (T3 round 2's own task execution).

- T3 round 2 is approved for real: a genuinely live-executed run on a channel-appropriate basis,
  real captured output (the abort *is* the output), no fabrication, no scope creep, no PII/
  credential leakage, correct non-patching discipline, read-only preserved and proven, hashes
  verified pre- and post-run with no drift.
- The **artifact** (`docs/migracion/03-clientes-import-dry-run.sql`) is confirmed FAIL and
  bounces to **T2 for a new round (round 4)** to fix the line-1341 operator-precedence bug
  (`(NOT EXISTS(...))::text`), matching the pattern already used correctly at line 1342.
- T2 round 4, once resubmitted and re-passing its own QA, must come back through T3 for a fresh
  live re-run (this will be T3 round 3) before T4 can start — T3's dependency on T2 is unchanged
  by this approval.
- No other task in the plan is affected. T1, T2 (rounds 1–3, as previously approved), and this
  T3 round-2 execution stand. T4/T5/T6 remain blocked on T2 round 4 → T3 round 3 passing.
