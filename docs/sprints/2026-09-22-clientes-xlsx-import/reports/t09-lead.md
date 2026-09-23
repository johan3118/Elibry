# T9 — Lead review

**Date:** 2026-09-23
**Task:** T9 (senior/junior?) — redact leaked client PII from 12 report files
(`t01`, `t02`, `t03`, `t06` families), human-authorized follow-up to T8's
audit finding (see `reports/t08-lead.md` §3, which explicitly recommended
this exact scoped follow-up and flagged it as requiring human sign-off
before touching four already-approved tasks' artifacts).
**Plan:** `docs/plans/clientes-xlsx-import.md` (T9 is not itself an
enumerated plan section — it is a post-close, human-authorized addendum
triggered by T8's audit; scope is defined by T8's own finding: exactly the
12 named `reports/*.md` files, PII substitutions only).
**Dev report:** `reports/t09-dev.md`
**QA report:** `reports/t09-qa.md` (Verdict: PASS)

---

## 1. Authorization and scope check

- T8's lead review (`reports/t08-lead.md` §3) already did the human-facing
  routing work for this exact task: it declined to fold the fix into T8,
  named the four affected already-approved tasks (T1, T2, T3, T6), and said
  a scoped follow-up must not proceed "without the human's sign-off." T9's
  dev report states that sign-off was obtained ("explicit human
  authorization shown after t08's audit surfaced the leak"). This is
  consistent with what T8's audit trail predicted would be needed, not a
  new or surprising escalation.
- Scope as executed matches scope as authorized: exactly the 12 files T8
  named (`t01-dev.md`, `t01-qa.md`, `t02-dev.md`, `t02-dev-r2.md`,
  `t02-dev-r3.md`, `t02-dev-r4.md`, `t02-qa.md`, `t02-qa-r2.md`,
  `t02-qa-r4.md`, `t03-dev-r3.md`, `t03-qa-r3.md`, `t06-qa-r3.md`), nothing
  more, nothing less. Both dev (§1, §7) and QA (§3, §6) independently
  re-derived this 12-file set from scratch (not by trusting T8's or each
  other's list) and got the same answer twice more.
- Per the sprint's own rule ("changes from already-approved tasks are
  correct and expected, not violations"): T9 editing T1/T2/T3/T6 report
  files is exactly the authorized exception to that rule for this one task,
  scoped to PII-only substitutions. Confirmed the edits are PII-only — see
  §3 below.

## 2. HARD GATES

- **Real diff produced** — PASS. Dev report §3 shows literal unified-diff
  hunks for all 12 files. The "before" side uses masked placeholder tokens
  (`[[PRE-REDACTION-CEDULA-A]]` etc.) instead of the real PII — this is the
  correct choice for a redaction task (showing the real "before" value in
  the evidence trail would recreate the exact leak this task exists to
  fix). The "after" side is the real, current file content. This is not
  "summary as proof": it is real diff text with the one substitution masked
  for the reason that governs this entire task.
- **Tests/lint/typecheck actually run, output shown** — PASS. `npm run qa`
  pasted by dev (825/825 tests, 0 lint errors, tsc clean, exit 0) and
  independently re-run by QA with matching numbers (§8/§9 of dev and QA
  reports respectively).
- **No new table without RLS / RLS not weakened** — N/A. Zero `.sql`,
  `.ts`, `.tsx`, or schema files touched; confirmed by both dev and QA via
  file-touch enumeration.
- **Missing rollback note** — PASS, present. One-line rollback: a
  session-local byte-for-byte backup of all 12 pre-redaction files exists;
  restoring means copying each back over its `reports/` counterpart (no git
  operation needed, files are untracked, no commit was made).
- **Acceptance criterion marked FAIL** — none. QA lists 11 ACs, all PASS.
  One disclosed limitation (AC8: QA cannot do an exhaustive byte-diff
  against true pre-redaction state since that state no longer exists on
  disk outside the dev's session-local backup) is honestly flagged as a
  caveat, not concealed, and is backstopped by the whole-corpus PII sweep
  (§1) plus a 4-of-12-file spot-check (§7) that found no incidental content
  drift. This is a disclosed evidentiary limit, not a failed criterion.
- **Optimistic UI without rollback** — N/A, no UI code touched.
- **Auth/payment/destructive DB change not in plan** — N/A. Markdown-only
  edit, no schema/data/auth/payment surface touched.
- **Out-of-scope files changed** — PASS (none). Both dev and QA
  independently ran a repo-wide (not just sprint-dir) `find -newermt` scan;
  only the 12 named files plus the new `t09-dev.md` (and now this
  `t09-lead.md`) were touched, all under
  `docs/sprints/2026-09-22-clientes-xlsx-import/reports/`. The two
  pre-existing `M` lines (`CLAUDE.md`, `docs/migracion/README-cleanup.md`)
  were independently confirmed to predate this task's session (QA §6,
  `ls -la` mtimes both Sep 22).

No HARD GATE is violated.

## 3. Substance check — is the redaction itself correct, not just "gate-passing"?

- **Completeness (no PII remains):** QA ran independently-constructed
  email-shape, bare-9-13-digit, DR-cédula-dashed, and phone-shape sweeps
  across `reports/*.md` and `scratchpad.md` from scratch — not copied from
  the dev's patterns — and found zero real PII remaining anywhere (QA §1,
  §2). This matches dev's own independent re-sweep (dev §1), which also
  re-confirmed T8's 12-file/two-cédula/seven-email hit set was already
  complete before any edit was made.
- **No over-redaction / coherence preserved:** the sprint's one genuine
  cross-task finding (the two duplicate `identificacion` values, and the
  NBSP defect distinguishing one occurrence of `<CEDULA-A>` from its
  pair-mate) remains fully legible after substitution — verified by both
  dev (§5, quoting the redacted text) and QA (§4, reading full surrounding
  context in four files, not just the diff hunks).
- **No collateral edits:** QA read full context (not just dev's hunks) in
  4 of the 12 files and found every line outside the substitutions
  unchanged from what the dev's diff implies (QA §7, with the disclosed
  spot-check-not-exhaustive caveat noted above).
- **Load-bearing SQL artifacts untouched:** both `03-clientes-import-dry-
  run.sql` and `04-clientes-import-execute.sql` hashes reproduced
  byte-identical to the values pinned since T2/T4/T8, independently by
  dev and QA. These files were never opened for writing by this task.
- **Self-check discipline:** dev grepped its own report for PII before
  submitting (dev §9). QA caught and openly disclosed its own first-draft
  error — an unverified "no matches" claim that turned out to need an
  actual re-run — and corrected it in the final report rather than quietly
  fixing it (QA §10). This is the kind of transparent self-correction the
  `redaction-discipline` mistake note asks for, not a gate violation; both
  final reports are confirmed PII-free.
- **Non-blocking observation carried forward, correctly not treated as a
  T9 defect:** QA flags that the two cédula values are still embedded
  verbatim inside SQL check-*name* identifiers in the hash-pinned,
  deliberately-untouched `03-clientes-import-dry-run.sql` — a T2-generator
  design property already noted in `t03-qa-r3.md` before T9 ran. That file
  is explicitly out of T9's scope (redaction target was `reports/*.md` +
  `scratchpad.md` only); leaving it untouched is correct, not a gap. Worth
  a line in the sprint-close backlog, not a send-back.

## 4. Decision

**A — APPROVE.**

One-line confirmation of what shipped: the two leaked cédula values and
seven leaked client email addresses were redacted to stable sentinels
(`<CEDULA-A>`/`<CEDULA-B>`, `<CLIENT-EMAIL-1..7>`) across exactly the 12
previously-approved report files T8's audit named, with the underlying
duplicate-identificacion finding still fully legible, `npm run qa` green,
zero out-of-scope files touched, and both load-bearing SQL hashes
unchanged — independently re-verified by QA via its own sweeps, its own
file-set derivation, and its own hash/regen checks rather than by trusting
the dev's report.

**Carry-forward for sprint close (not a T9 defect, no action required of
T9):** the generated SQL's check-name identifiers still embed the two real
cédula values by the T2 generator's own design (informational, previously
disclosed, correctly out of T9's scope) — note this in the sprint summary
so the human is aware if `03-clientes-import-dry-run.sql` is ever shared
outside the sprint's trusted circle.

## Rollback

No source file was edited by this review; only this decision record was
written. Read-only over the sprint's artifacts.
