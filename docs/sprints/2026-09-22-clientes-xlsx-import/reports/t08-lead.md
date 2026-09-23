# T8 — Lead review (round 1)

**Date:** 2026-09-23
**Task:** T8 (senior) — sprint-wide artifact audit, read-only
**Plan section reviewed:** `docs/plans/clientes-xlsx-import.md:544-562` (T8 acceptance criteria)
**Dev report:** `reports/t08-dev.md`
**QA report:** `reports/t08-qa.md` (Verdict: PASS)

---

## 1. Acceptance criteria — checked against the plan, one by one

1. **File enumeration N of M via `git status --short` (tracked + `??`), never `git diff`** — dev item 9 enumerates all 12 top-level entries from `git status --short`, states 12 of 12, explicitly invokes the `git-diff-scope-excludes-untracked-files` rule. QA item 10 independently re-ran the same command and got the same 12 entries. **PASS.**
2. **Banned-verb grep over every rollback note this sprint → 0 hits** — dev item 12, QA item 11, both independently run, both distinguish grep-pattern echoes and historical "Before:" quotations from live guidance, both re-confirm `t07-dev.md` (the file that failed on this in round 1) is now clean. **PASS.**
3. **Isolation/DDL/fiscal grep over `03`/`04` → no unexpected hits; ADR 0011/0006 reasoning restated** — dev item 7 and QA item 8 both confirm zero `CREATE TABLE`/`ALTER TABLE`/`CREATE POLICY`/`ROW LEVEL SECURITY` hits in either file, and correctly conclude no RLS policy is owed because no table was created. **Minor gap, non-blocking:** both reports cite only ADR 0011 (elibry's single-tenant exception); neither explicitly restates ADR 0006 (the general RLS-org-isolation-default rule that 0011 is the carve-out from), even though the AC literally asks for "ADR 0011/0006 reasoning." QA's item 3 does independently add a fiscal-boundary check (`comprobante`: 0 hits, citing ADR 0012) that goes beyond the letter of AC3. I read this as a citation-completeness nit, not a substantive isolation gap — the underlying fact (no new table, so neither the default rule nor its exception is even triggered) is correct and doubly verified. Not send-back-worthy on its own.
4. **PII/credential grep over `reports/*.md` and `scratchpad.md` → no client PII, no keys/connection strings** — dev item 10 found a **loud, genuine defect**: real client `identificacion` numbers and email addresses, copied verbatim from the payload, in 12 `reports/*.md` files spanning T1 through T6 (not T8). QA item 5 independently re-derived the same 12 files from scratch, using its own grep patterns (not copied from the dev's citation), and went further with a blanket `\b[0-9]{9,13}\b` sweep to check for anything the dev's targeted two-value grep might have missed — found nothing additional, confirming two look-alike numeric strings are legitimately non-PII synthetic data. Credentials/keys/connection strings: independently confirmed clean by both. See §3 below for how I am routing this.
5. **SHA-256 of `03`/`04` re-shown, matched** — dev item 1, QA item 1, both independently run, both match the required hashes exactly. **PASS.**
6. **`npm run qa` run once more, green** — dev item 13, QA item 9, both independently run fresh: exit 0, `tsc` clean, 28 pre-existing unrelated lint warnings (0 errors), 825/825 tests. **PASS.**
7. **States explicitly the import has not been executed; no agent ran `04`** — dev's "NOT PROVEN" section and item 8 state this plainly; QA independently confirms it did not run `04` either. **PASS.**
8. **Rollback note: read-only, no git verb** — both reports' rollback sections are read-only prose, re-checked by each author before submission. **PASS.**

## 2. Is QA's re-execution genuine, or agreement-with-the-dev theater?

Genuine. QA pasted its own command output for every load-bearing check: both hashes (item 1), the 42/42 parity diff via its own `diff` invocation (item 2), the statement inventory via its own greps (item 3), the live read-only `psql` state check via its own session (item 4), and — most importantly — its own PII/credential sweep built from patterns it derived independently ("using the two duplicate-identificacion values surfaced independently by QA's own regeneration run... not copied from the dev's report"), plus a broader numeric sweep the dev didn't run. QA also independently regenerated the SQL into its own scratch dir (item 7) rather than trusting the dev's two-run comparison. This satisfies the task's own bar: "an audit that is only read and not re-run is not audited."

## 3. The PII finding — how I am routing it

**This is a sprint-level finding, not a T8 defect, and I am not sending T8 back over it.**

Reasoning:
- The plan's own framing for T8 (line 546: "Files in scope: `reports/t08-dev.md` (+ `t08-qa.md`). Read-only over the sprint's files") and the task brief's explicit instruction ("report defects, do not repair them") make T8 a **detection** task, not a **remediation** task. Its declared scope forbids touching the 12 offending T1–T6 report files.
- AC4, read literally ("no client PII... in `reports/*.md`"), is failed **at the sprint level** — by artifacts T8 did not produce and is not permitted to edit. It is not failed by T8's own deliverable. T8's own deliverable is the audit report itself, and that report is complete, accurate, and independently reproducible (confirmed in §2).
- Sending T8 back to "fix AC4" would require the dev to either (a) edit the 12 already-approved T1–T6 report files, which is out of T8's declared scope and would mean re-touching four previously-approved tasks' evidence trails without authorization, or (b) simply re-assert the same finding it already made — which changes nothing and would only teach future audits to soften or bury findings to avoid an unwinnable send-back loop. Grading the detector a FAIL for successfully detecting a pre-existing defect it was explicitly told not to fix is the wrong incentive and contradicts the task's own design.
- This is not a HARD GATE case under the sprint's decision framework either: it is not a new table missing RLS, not weakened RLS, not an optimistic-UI/rollback gap, not an auth/payment/destructive-DB change. It is a documentation-hygiene / `redaction-discipline` violation that predates T8 and spans four already-approved tasks (T1, T2, T3, T6).
- What it **is**: a real cross-tenant-adjacent PII exposure (client cedula numbers and emails sitting in tracked markdown files) that nobody caught until T8's audit specifically because every prior sweep only checked email-shape/key/connection-string patterns, never bare numeric identificacion values. That is exactly the class of finding the plan's "what 'done' means" section and CLAUDE.md's PII directive care about, and it touches four already-approved tasks — reopening or redacting those is a scope decision I am not authorized to make unilaterally (I do not edit source files, and ordering a new scoped task is the orchestrator's/human's call, not mine to execute).

**Routing:** I am recommending — not ordering — that the orchestrator open a new, narrowly-scoped follow-up task (e.g. "T9 — redact leaked client PII from 12 report files") for a future sprint or an immediate small addendum, and that this be surfaced to the human at sprint close alongside my sprint summary, since it involves editing files from four previously-approved tasks and touches real client PII (identification numbers, emails) that must not linger in the repo's report trail. This is a D-shaped item **about the sprint**, not a B/D verdict on T8 itself.

## 4. Anything else incomplete, contradictory, or overstated?

Nothing beyond the ADR-0006 citation nit in §1.3. Specifically checked and found consistent:
- Dev's and QA's `git status --short` outputs match each other and match the repo's actual state (12 entries, same paths) — no discrepancy.
- Dev's "Scratchpad ledger staleness" note (t02/t07 shown as pending in the ledger table but actually closed on disk) was independently re-checked by QA (item 13, "Other claims") and confirmed to be a stale-table cosmetic issue, not a real approval gap — I concur, both `t02-lead-r4.md` and `t07-lead-r2.md` exist with APPROVE verdicts.
- Statement inventory, runbook accuracy, determinism/regeneration, and live-DB-state claims are all independently reproduced by QA with matching numbers, not merely echoed.
- The "PROVEN / NOT PROVEN" summary in the dev report is appropriately hedged — it does not claim the import happened, and QA explicitly checked that this section is "neither overstated nor understated relative to what a read-only audit can prove."

## 5. CBrain filing candidates (not filed by me — for the orchestrator at sprint close)

The dev's report lists four candidates; I am only noting them here for hand-off, not filing them (that is Step 5 of sprint close, done by the orchestrator/lead-at-close role, not this per-task review):
1. Generator file-size exemption (amendment A) as a second scope-limited/non-precedential data point alongside FlowCRM's deploy-runbook exception.
2. "Offline value-derivation cannot catch live SQL type/precedence errors" — three defects this sprint (T3 r1, T3 r2, T2 r4) all escaped Python-side re-derivation and were only caught by live execution.
3. The T6 r2/r2b orchestrator incident — a stale duplicate-round dispatch that overwrote an approved evidence file. Dev explicitly flags this as an **orchestrator process error**, to be filed as such.
4. New: `redaction-discipline` needs a numeric-PII grep (bare `identificacion`/cedula strings), not just email/key/connection-string patterns — this is the gap that let the PII leak in §3 survive six tasks' worth of "clean" PII sweeps.

## Decision

**A — APPROVE.**

T8's own deliverable (the audit) satisfies all 8 acceptance criteria in substance; the one literal AC4 failure is a sprint-level, pre-existing (T1–T6) defect that T8 was built to surface and did surface correctly, loudly, and within its declared read-only scope — not a defect in T8's own work product. QA's re-verification is genuine, independent, and in places (the broader numeric-PII sweep) goes beyond the dev's own evidence.

**Distinct, separate item to surface to the human at sprint close:** the 12-file client-PII leak (real cedula numbers and emails from T1, T2, T3, T6 reports) should not be closed silently. Recommend a scoped follow-up redaction task; do not fold that fix into T8 or into this sprint's close without the human's sign-off, since it touches four already-approved tasks' artifacts.

## Rollback

Read-only review; no source, plan, SQL, generator, runbook, or report file was edited by this review. No git verb used. Nothing to revert.
