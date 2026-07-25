---
name: elibry-spec-thinking
description: >
  Reasoning methodology for turning a rough Elibry request into a frozen,
  scope-locked spec. ALWAYS use this whenever writing or refining a spec,
  defining scope/non-goals, freezing requirements, or whenever a request is
  vague enough that it could balloon mid-sprint. Kills scope creep before it
  starts — use it even for requests that look simple. Produces a full reasoning
  dump in one pass; never asks the human interactive questions.
---

# Elibry Spec Thinking

> [!important] Brain binding (KuboTI CBrain)
> This skill is Elibry's instantiation of the canonical methodology in
> `~/Developer/CBrain/thinking/spec-thinking.md`. **Read and follow that note as the source of truth** — it receives the team-wide upgrades. This file only adds Elibry's specifics.

## Ground first — including the negative space
Read `~/Developer/CBrain/projects/elibry.md` and the repo's real modules before spec'ing. Then **grep the negative space**: `~/Developer/CBrain/decisions` (rejected alternatives) and `~/Developer/CBrain/mistakes` (prevention rules). Don't re-open a settled non-goal or re-spec an existing module (Clientes, Productos, Suplidores, Reservas, Pagos, CRM, Facturación, Configuración) without new evidence.

## Elibry-specific scope discipline
- **One outcome per sprint.** A spec that touches both Reservas *and* Facturación is two features — split it.
- **Fiscal is high-stakes.** Anything touching NCF / e-CF / `comprobantes_fiscales` is senior + a mandatory human gate — flag it in Risks and as an Open Question, never silently in scope. See `~/Developer/CBrain/domains/dgii-ecf.md`.
- **Money is high-stakes.** Reservation totals, payment balances (total − paid = pending), DOP/USD handling, commissions — every criterion must be exactly checkable.
- Enumerate temptations (the adjacent module, the "while we're in here" refactor, the "make it configurable" urge) and mark each IN/OUT with a reason.

## Output
Produce the `product.md` structure (Goal / Scope / Non-goals / User flow / Acceptance criteria / Risks / Open questions) PLUS the **Scope Reasoning** block and a **Negative space checked** line — exactly as `spec-thinking.md` requires.
