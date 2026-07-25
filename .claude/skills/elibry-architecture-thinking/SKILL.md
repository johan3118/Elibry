---
name: elibry-architecture-thinking
description: >
  Reasoning methodology for turning a frozen Elibry spec into a bounded
  technical plan. ALWAYS use this whenever producing a technical plan, a task
  list, a file map, or any architecture decision for a sprint. Stops scope
  creep at the PLAN level — every task scoped to an exact, justified set of
  files so implementation cannot drift. Produces the full reasoning in one pass.
---

# Elibry Architecture Thinking

> [!important] Brain binding (KuboTI CBrain)
> This skill is Elibry's instantiation of the canonical methodology in
> `~/Developer/CBrain/thinking/architecture-thinking.md`. **Read and follow that note as the source of truth.** This file only adds Elibry's specifics.

## Non-skippable grounding (incl. negative space)
Inspect the REAL Next.js 15 code paths the spec touches (App Router server/client components, the Supabase client/helpers, the real table schemas + RLS policies). Quote real file paths and table/column names. Then **grep the negative space**: `~/Developer/CBrain/decisions` + `~/Developer/CBrain/mistakes` — an approach a prior ADR rejected is off the table unless you carry new evidence.

## Elibry invariants
- **Org isolation:** every new table gets an RLS policy; name it. Existing RLS is never weakened (see `~/Developer/CBrain/decisions/0006-rls-org-isolation-default.md`).
- **Fiscal integrity:** NCF sequence / `comprobantes_fiscales` logic is senior-only and human-gated; never let a plan quietly renumber or reuse a fiscal sequence.
- **Money math:** reservation totals, `reserva_detalles` line items, payment balances, DOP/USD — keep the source of truth single and server-computed.
- **Server/client boundary:** don't leak service-role access into client components.

## Output
Produce the full `architect.md` plan (file map, DB/RLS changes, task list with owners/acceptance/deps) PLUS the **Architecture Reasoning** block with a **Negative space checked** line, ending with the literal `PLAN_PATH:` line — exactly as `architecture-thinking.md` requires.
