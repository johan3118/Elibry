# T3 — Lead Decision, ROUND 3

**Decision: A) APPROVE.**

## Plan reference

`docs/plans/clientes-xlsx-import.md`, "### T3 — Run the dry run live, twice, and capture it"
(lines 421–441), read fresh for this round. Files in scope: `reports/t03-dev.md` (+
`t03-qa.md`) — this sprint's round-numbered convention (`t03-dev-r3.md` /
`t03-qa-r3.md`) matches the precedent already accepted for T2 (`t02-dev-r4.md` /
`t02-qa-r4.md`, approved in `t02-lead-r4.md`). Constraint: **no SQL file may be edited in
this task** — a live defect must bounce back to T2, not be patched in place. DB/isolation
per plan: read-only, must write nothing.

Scope of this review: round 3 only, on its own merits — (1) is this the first round where
the *artifact itself* is genuinely clean, not just the round's process being sound (rounds
1–2 were legitimate PASS-as-execution / FAIL-as-artifact); (2) did QA's re-verification
happen on an independent channel, with independent evidence, rather than trusting the
dev's transcript; (3) do all 10 plan ACs hold; (4) is scope/read-only/redaction discipline
intact. T1, T2 (rounds 1–4), and T3 rounds 1–2 are closed history (already approved /
already correctly bounced: `t01-qa.md`, `t02-lead.md`, `t02-lead-r2.md`, `t02-lead-r3.md`,
`t02-lead-r4.md`, and the scratchpad's `t03 senior` / `t03 senior-r2` FAIL handoffs) and are
not re-litigated here.

## 1. Is this round's "artifact now genuinely clean" claim actually established, not assumed?

Yes, and on two independent legs, not one:

- **Dev's own live execution**, brand-new scratch working directory (not reused from T2 r4
  or T3 r2), full file run live via Node+`pg` (simple query protocol — `supabase db query`
  still cannot run this multi-statement file, a fact established in T3 r1/r2 and not
  re-litigated). Run 1: 42/42 `_checks` rows PASS, `veredicto_final = PROCEED`. Run 2:
  literal re-invocation of the same on-disk file, byte-identical output including the
  payload correlation token (`diff run1.jsonl run2.jsonl` — no output).
- **QA's independent re-verification**, from a *different* channel it built itself
  (`qarun.js`, not the dev's `pg_run.js`), with its own hashes, its own two live full-file
  runs (also 42/42 PASS, `PROCEED`, byte-identical to each other and in substance to the
  dev's), and — critically — an **adversarial mutation test**: QA reverted the specific
  `Q1_audit_clientes_trigger_absent` fix (T3 r2's finding, T2 r4's fix) to its known-broken
  pre-fix form in a scratch copy and re-ran it through its own harness, reproducing the
  exact historical error (`argument of NOT must be type boolean, not type text`, exit 1).
  This is the proof the QA channel discriminates broken-vs-fixed rather than always
  reporting green — it is not merely re-running the same happy path twice.
- QA also independently read the literal SQL text at all four named fix sites (the T3-r1
  cast bug, the T3-r2/T2-r4 precedence bug, the T2-r2 `sexo_was_blank` predicate, the T2-r4
  NBSP fix) via its own `grep`, confirming the fixed code is actually on disk, not just
  that a check row happens to read PASS.

This satisfies the round's specific bar: the artifact is shown clean by two independently
built execution channels, one of which was proven (by attack, not assertion) to actually
detect regressions.

## 2. Read-only / DB-safety discipline

`count(*)=1, max(id)=15` held at every checkpoint on both sides: dev's 4 checkpoints
(before/after Run 1, before/after Run 2) and QA's 4 checkpoints (same shape), plus QA's
own mutation-test run against a scratch copy (never against the real file) followed by a
re-check that the real table was still `1`/`15` afterward. No `BEGIN`/explicit write
transaction opened anywhere; the only DDL executed on either side was the file's own
`pg_temp`-scoped `CREATE TEMP TABLE`/`DROP TABLE IF EXISTS`, gone on connection close.
`docs/migracion/04-clientes-import-execute.sql` confirmed absent by both sides (`ls`).

## 3. Plan T3 ACs (lines 421–440) — scored against QA's independent run

1. Dry run executed live, complete output captured verbatim — **PASS** (dev §3/§4, QA §3/§4).
2. `count(*)` before/after identical — **PASS** (4 checkpoints each side, all 1/15).
3. Second run, diff-identical — **PASS** (byte-identical incl. correlation token, both sides).
4. Q3/Q4 grids PASS on every distribution/backfill count — **PASS** (all rows, both grids).
5. Q5 overflow report / HC-1 closed — **PASS, substantively**, with a disclosed naming
   caveat: the artifact's live check grid has no statement literally named "Q5's overflow
   report" — HC-1 is enforced by the generator's own Python-side abort gate (mutation-tested
   in T2 r4, off the live-DB path, correctly out of this task's scope). This wording drift
   between the plan's original Q1–Q7 scheme and the shipped Q1–Q6 grid has existed and been
   accepted since T2 round 1, across every approved T2 round — not a new issue introduced or
   newly exposed this round. Not blocking.
6. Q6 relocation assertions "MATCH" — **PASS, substantively**, same pre-existing drift: only
   2 `Q6_*` checks exist (not four), reading `PASS` (the artifact's own vocabulary, not
   `MATCH`), both correct (`Q6_sheet_1185_is_jrosa`, `Q6_sheet_15_is_melissa` = true) in
   QA's own independently-captured run. Not blocking.
7. Final verdict captured verbatim — **PASS**, quoted exactly and identically by both
   dev and QA, both runs: `PROCEED — every Q1-Q6 check above reads PASS. Still a human
   decision to run any execute script.`
8. No client PII beyond counts/verdicts — **PASS**, with one disclosed pre-existing,
   previously-reviewed exception: the two duplicate `identificacion` values appear as
   literal digit strings inside check *names* (a T2-generator design choice, accepted since
   T2 round 1, quoted in at least 5 prior QA passes). Not new to this round.
9. No credential/host/connection string — **PASS** (clean greps on both reports).
10. Rollback note: read-only, nothing to revert — **PASS**, correct on both sides.

**10/10 ACs met**, with two long-standing, previously-accepted plan-wording-vs-artifact
naming drifts disclosed again (not new to round 3) and correctly scored non-blocking by QA.

## 4. Scope discipline

`git status --short` is byte-identical, 8/8 pre-existing entries, before and after, on both
the dev's and QA's independent captures. No SQL file was edited (hash-proven unchanged at
task start and task end on both sides: output-sha256 `a5f74af3...42cc4`, payload-sha256
`9664ee4e...932392`). This task's only new content is the two round-3 reports, both inside
the already-untracked sprint directory — no new top-level `git status` entry. All live-DB
tooling on both sides lived entirely under each party's own private scratch directory,
outside the repo, confirmed absent from `git status --short`.

## 5. HARD GATES

- Real diff produced — **N/A, correctly**: T3 is a pure live-verification task; no code
  change is claimed by either report, and the plan forbids editing any SQL file in this
  task. Hash-proven zero drift stands in for "no diff," as it should for a read-only task.
- Tests actually run, output shown — **yes**: `npm run qa` pasted in full by the dev
  (825/825 tests, 0 typecheck/lint errors, 28 pre-existing warnings), independently
  re-run by QA with identical shape.
- New table without RLS — **N/A**, no table created.
- Existing RLS weakened/bypassed — **N/A**, ADR-0011 (single-tenant, no RLS on any of the
  ~29 pre-existing tables); isolation-grep re-confirmed clean by QA.
- Missing rollback note — **absent**: both reports state read-only/nothing-to-revert,
  correctly, no git verb.
- Acceptance criterion marked FAIL — **none**; all 10 ACs PASS (§3).
- Optimistic UI without rollback — **N/A**, no UI code in scope.
- Auth/payment/destructive DB change not in plan — **none**: every live statement on both
  channels was read-only or `pg_temp`-scoped; `count(*)=1, max(id)=15` held at 8 combined
  checkpoints across both parties, including immediately after QA's deliberate
  mutation-test error.
- Out-of-scope files changed — **none** (§4).

None of the automatic-B/D gates fire.

## 6. PII / redaction

Both reports show only check names, counts, booleans, hashes, and verdict strings. The one
disclosed non-blocking item (dup-`identificacion` digit strings embedded in check *names*)
is inherited T2-generator design, reviewed and accepted since T2 round 1 — not a new t03
defect. No connection string, anon/service-role key, or client PII beyond that pre-existing,
already-reviewed exception appears in either report.

## Conclusion

Round 3 is the first round where the artifact itself — not just the round's process — is
shown genuinely clean, and that claim is backed by two independently built execution
channels (dev's and QA's), each running the full file live twice with deterministic,
byte-identical output, plus QA's own adversarial mutation test proving its channel actually
discriminates broken-vs-fixed rather than rubber-stamping green. Read-only discipline held
at every checkpoint on both sides. All 10 plan ACs are met, with two long-standing,
previously-accepted plan-wording-vs-artifact naming drifts (Q5/Q6 vocabulary) correctly
re-disclosed as non-blocking. Scope and redaction discipline are intact. No HARD GATE fires.

**APPROVE T3 (round 3).**

T1, T2 (rounds 1–4), and now T3 (round 3) stand approved. Per the plan's dependency chain,
T4 (generated execute script) may now proceed against this artifact
(payload-sha256 `9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392`,
output-sha256 `a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4`).
