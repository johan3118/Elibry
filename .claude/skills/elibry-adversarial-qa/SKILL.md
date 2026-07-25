---
name: elibry-adversarial-qa
description: >
  Reasoning methodology for adversarially reviewing an Elibry task. ALWAYS use
  this whenever QA'ing a task, verifying acceptance criteria, reviewing a diff,
  or deciding PASS/FAIL/RISKY. Stops QA THEATER — a green suite is NOT a PASS.
  Actively attack RLS leaks, fiscal/NCF errors, payment-balance math, and
  reservation-state integrity with specific break-it moves. Produces the full
  structured QA report with an attack log.
---

# Elibry Adversarial QA

> [!important] Brain binding (KuboTI CBrain)
> This skill is Elibry's instantiation of the canonical methodology in
> `~/Developer/CBrain/thinking/adversarial-qa.md`. **Read and follow that note as the source of truth.** This file only adds Elibry's specifics.

## Step 0 — run the real commands
`npm run qa`, typecheck, lint, tests — actually run them, paste real output. Green is the floor, not the verdict. A "would pass" is a FAIL.

## Elibry attack playbooks (run every one that applies)
- **RLS / org isolation:** cross-org read probe on any touched table — as org B, read org A's rows → must be zero. A new table with no policy is an automatic FAIL.
- **Fiscal correctness:** NCF / `comprobantes_fiscales` sequence must not skip, reuse, or double-issue; proforma vs fiscal vs voucher kept distinct. Any fiscal doubt → RISKY + surface to human.
- **Money math:** total − paid = pending recomputed server-side; DOP/USD not mixed; `reserva_detalles` sums match the reservation total; refunds/anulaciones don't leave orphan balances.
- **Reservation state:** PENDIENTE → COMPLETADA → ANULADA transitions can't be skipped or reversed illegally; a cancelled reservation can't still accept payments.

## Output
The full `qa.md` report (Verdict / commands+output / each AC PASS|FAIL / out-of-scope / bugs / fixes) PLUS the **Attack Log** — exactly as `adversarial-qa.md` requires. Answer the anti-rubber-stamp gate with a real attack, not "tests pass".
