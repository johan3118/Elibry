# Elibry — Project Sprint State
# as of 2026-07-27

---

## Completed sprints

### 2026-07-27 — recibo-escape-and-input-guards (T1–T2, uncommitted)

**Plan:** `docs/plans/recibo-escape-and-input-guards.md` · **Slug:** `recibo-escape-and-input-guards`
**Commits:** none. All four changed/new files sit **uncommitted** in the working tree as of this
entry. The sprint began from a clean tree at `da57ef6` "wave 3". Rollback is `git checkout --` /
`rm`, not `git revert`.

#### 1. What shipped (user-facing)

- **RECIBO (payment receipt) is no longer a stored-XSS surface.** `generateReciboHTML`
  (`lib/document-generator.tsx:1589`, sole caller `app/pagos/buscar/page.tsx:206` inside
  `regenerarRecibo`) now returns `renderHtml(html\`…\`)` — the same escaping seam already used by
  `generateVoucherDocHTML`/`generateConfirmacionHTML` — so all 17 interpolated values (client name,
  payment reference, service description, etc.) are HTML-escaped before the receipt is opened in a
  new window. RECIBO was the **only** document actually rendering unescaped user data to a customer
  today: CONFIRMACIÓN and VOUCHER were escaped last sprint and are both currently hard-blocked (see
  Deferred below), so this closes the one live surface.
- **Two input guards added to the voucher Server Action path** in
  `app/actions/documentos-actions.ts`: an `Number.isInteger` guard on `OcupacionInput.cantidad`
  (`validateOcupacionesInput`, ~:120-126) and a `typeof` guard on `localizador`/`regimen`
  (`validateDatosVoucherInput`, ~:1021-1035). Both reject with a named-field error before any
  Supabase call — block-never-coerce, no `Math.trunc`/`|| 0`/`Number()` casting. This is
  defense-in-depth at a directly-callable Next.js Server Action boundary; see caveat below.
- No schema, RLS, auth, NCF, UI, or API-signature change. No new dependency, no file split.

#### 2. Evidence (gate command `npm run qa` = `tsc --noEmit` → `eslint .` → `vitest run`)

- **T1 (B-12)** PASS, round 1, no send-backs. 2-line diff in `lib/document-generator.tsx`
  (`return \`` → `return renderHtml(html\``; closing `` ` `` → `` `) ``); new
  `tests/recibo-html.test.ts` (199 lines, 18 tests). QA ran `npm run qa` twice independently (24
  files / 516 tests, exit 0), a stashed baseline (498/498), and a byte-identical lint diff
  before/after. QA independently re-ran M1/M2/M3 from a hash-verified clean copy and added four
  novel mutations/probes (paren-only revert caught by `tsc`; a second field wrapped in `raw()` to
  prove per-field coverage; four hostile payload classes absent from the fixtures, all escaped
  correctly; occurrence-count/context checks). QA independently verified the ICU currency literals
  on the actual runtime (Node v22.11.0) rather than trusting a guess. All 17 interpolation sites
  confirmed to land only in element content or `<title>` — zero in an attribute, URL, `<style>`, or
  `<script>` body. 12/12 acceptance criteria PASS.
- **T2 (B-15 + B-16)** round 1 FAIL, sent back. QA finding: the new "rejects a fractional cantidad"
  test was not genuinely mutation-killing — under mutation M4 it went RED only because an un-queued
  Supabase mock crashed (`TypeError: Cannot read properties of undefined (reading 'select')`), so
  `expect(result.success).toBe(false)` passed vacuously and the DB-not-called assertion, placed
  last, was never reached and was empirically false when QA reordered it. Same weakness pre-existed
  in two sibling tests. Lead sent back with a 7-point fix list (reorder `mockFrom`-first in all three
  cantidad tests, add crash-detection, correct a rollback note pointing at a nonexistent commit
  hash) without touching the forbidden shared mock harness.
  Round 2 PASS. Finding independently confirmed closed — test now fails at the genuine
  `expect(mockFrom).not.toHaveBeenCalled()` signal. QA ran `npm run qa` three times (24 files / 519
  tests, exit 0 each), added two new mutations (a buggy-message isolation probe; forcing the `orden`
  guard to `if (false)`, reproducing the same fragility class in a test outside the fix list —
  logged as new backlog, not fixed in-task). Production diff confirmed byte-identical to round 1;
  shared mock harness untouched; Task 1's files untouched. 11 changed production lines, within the
  ≤15 budget.

#### 3. Deferred / descoped

- **Item (a) — rollout pre-flight**: skipped by the human. No Supabase credentials exist anywhere in
  this workspace (verified: no `.env`/`.env.local`); `docs/plans/geb-rollout-checklist.md` is run
  externally by the human only.
- **B-17 — proxy hardening**: skipped by the human as ambiguous under two readings
  (`lib/supabase.ts`'s lazy client per this state file vs. `lib/voucher-data.ts`'s `VoucherDocData`
  per the goal text). Needs a product ruling before it can be specced.
- **B-14 — 22-file fixture-strength sweep**: cut by the orchestrator as an audit producing zero
  working code, against the human's steer "skip any overengineer thing, let's make it work."
- **New backlog item from QA**: `tests/documentos-actions.test.ts:473-481` ("rejects a missing
  orden") has the same assertion-ordering fragility QA found and fixed elsewhere this sprint —
  `expect(mockFrom).not.toHaveBeenCalled()` needs to move first. Not fixed in-task; confirmed
  in-scope-for-backlog by the lead, not overruled.
- **B-1 / B-9 carried forward, slightly worse**: `lib/document-generator.tsx` is 1822 lines,
  `app/actions/documentos-actions.ts` is 1146 lines, `tests/documentos-actions.test.ts` is ~2100
  lines — all breach the repo's ≤500-line rule and all grew slightly this sprint. Splits remain
  their own scoped tasks, never bundled into a feature task.
- **B-13** — dead `generateProformaHTML` (byte-freeze-protected), still not deleted.
- **Stale UI strings** — "Generar vouchers de pago" at `app/page.tsx:995` and
  `app/dashboard/page.tsx:295`, plus the misleading voucher block message at
  `app/facturacion/voucher/page.tsx:1149-1152`. Not touched (out of file scope).

#### 4. Rollback path (whole sprint — nothing committed)

- Task 1: `git checkout -- lib/document-generator.tsx && rm tests/recibo-html.test.ts`
- Task 2: `git checkout -- app/actions/documentos-actions.ts tests/documentos-actions.test.ts`
- End-to-end: both commands together return the repo to the exact pre-sprint state (`da57ef6`); no
  DB migration, commit, or destructive operation occurred, so there is nothing to unwind beyond the
  working tree.

#### 5. The honest part

- **Both fiscal-adjacent documents remain hard-blocked in any unmigrated environment**, verified by
  code trace this sprint, not asserted: CONFIRMACIÓN blocks at
  `app/facturacion/proforma/page.tsx:361` → `documentos-actions.ts:147` (reads
  `reserva_pasajeros`, created by unapplied `scripts/061`). VOUCHER blocks at
  `voucher/page.tsx:324` → `documentos-actions.ts:1089` (selects `reservas.localizador`, added by
  unapplied `scripts/062`), and its generate buttons render `disabled` — the operator cannot even
  attempt it. `scripts/063` is non-blocking by design (discrepancy write is console.error-only).
  Applying 061+062 unblocks VOUCHER; CONFIRMACIÓN additionally needs `comprobantes_fiscales` to
  carry `reserva_id`/`numero_factura` (R3, unconfirmed).
- **Task 2's guards sit on an inert path** in any environment where `scripts/062` is unapplied —
  defense-in-depth at a directly-callable Server Action boundary, not a live fix. Applied-state is
  not verifiable from this workspace (no credentials).
- **No security overclaim.** Per ADR `0011-elibry-single-tenant-for-now` (HC-1,
  accepted-and-open): Elibry still has no authentication, the browser still runs as PostgREST
  `anon`, and ~29 pre-existing tables still have zero RLS. The public anon key remains a full
  read/write credential to `clientes`, `reservas`, `pagos`, and `comprobantes_fiscales`. This
  sprint closed one stored-XSS surface in one document and added input hygiene at one Server
  Action boundary. **It did not make Elibry meaningfully more secure.**
- **Environment reliability, recurring, root cause still unresolved**
  (`~/Developer/CBrain/mistakes/environment-reliability-incidents.md`): an architect subagent was
  killed mid-run by an API connection error this sprint and had to be resumed from its transcript
  — another instance of the same unresolved pattern already on file in the brain.

#### 6. Backlog carried forward

- **B-1 / B-9** — `lib/document-generator.tsx` (1822 lines), `app/actions/documentos-actions.ts`
  (1146 lines), `tests/documentos-actions.test.ts` (~2100 lines), all over the 500-line rule; each
  split is its own scoped task.
- **B-13** — delete dead `generateProformaHTML`.
- **B-17** — proxy hardening, needs a product ruling on which reading is correct.
- **B-14** — 22-file fixture-strength sweep, still backlog.
- **New** — reorder `expect(mockFrom).not.toHaveBeenCalled()` first in the "rejects a missing
  orden" test at `tests/documentos-actions.test.ts:473-481` (same fragility class QA closed
  elsewhere this sprint).
- **Stale voucher strings** — `app/page.tsx:995`, `app/dashboard/page.tsx:295`,
  `app/facturacion/voucher/page.tsx:1149-1152`.

**Not fixed, explicitly out of scope, must be surfaced again before any future sprint touches auth
or RLS broadly:** HC-1 (no authentication, no RLS on ~29 pre-existing tables — ADR 0011).

---

## Remaining backlog (highest priority first)

_(see docs/plans/: feature-audit-sprint, module-audit-polish, crm-reservas-fixes,
test-suite-sprint1. Fiscal / NCF / e-CF work is high-stakes → senior + human-gated.
Also see the geb-documents-real-data sprint entry above for B-1, B-9, B-13, B-14, B-17,
the unresolved HC-1 / R1 authentication-and-RLS exposure, and the
recibo-escape-and-input-guards entry above for the current uncommitted-diff status,
the two hard-blocked fiscal documents pending scripts/061+062, and the
assertion-ordering fragility backlog item at tests/documentos-actions.test.ts:473-481.)_
