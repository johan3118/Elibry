# FACTURA # lookup contract — pin the two-outcome seam + compile-time omission guard

**Spec:** frozen & human-approved (AC-7 explicitly ruled SHIP).
**Baseline:** `sprint/reserva-document-entry-points` @ `89cc76e` per the spec — **the session-start
gitStatus block is STALE and disagrees with it** (it shows branch `v0/johan3118-18a6bc40`, HEAD
`8f00cdc`, and a dirty tree). Task 0 re-verifies this before a single byte is written.
**Risk class:** fiscal-adjacent → senior-only, **mandatory human gate before merge**.
**DB / RLS changes: NONE.** No table, no column, no migration, no `scripts/*.sql`, no NCF
allocation, no new `.select()`. ADR-0006 ("every NEW table ships an RLS policy") is **not
triggered** because this sprint creates no table; ADR-0011's single-tenant posture is untouched.

---

## Architecture Reasoning (show your work)

**Invariants in play + the exact existing mechanism each follows**

1. **ADR-0012's design rule — the two outcomes must never collapse.** Mechanism today:
   `app/facturacion/proforma/page.tsx:434-442` inlines the discrimination
   (`facturaResultado.ok ? .numeroFactura : null`, plus `if (!ok && reason === "LOOKUP_FAILED")
   toast({...})`). It lives inside `generarConfirmacion` (`:386`), a closure inside a ~1010-line
   `"use client"` component → **not importable, therefore not testable, therefore not pinned**.
   That is the whole defect this sprint fixes.
2. **Block-never-default, applied to an absence (`mistakes/stockin-zero-price`).** Mechanism:
   `lib/confirmacion-data.ts:364` — `facturaNumero: esTextoValido(input.facturaNumero) ?
   (input.facturaNumero as string) : null`. This line's **runtime behaviour must not change**
   (AC-7's constraint). `null` is a *legitimate* value here; over-rejecting it would be as much a
   failure as fabricating one.
3. **Node-seam test precedent, not a new harness.** `lib/proforma-passengers.ts` and
   `lib/crm-casos-logic.ts` both exist solely because *"Next generates a per-route type in
   `.next/types` asserting that a page module exports NOTHING but `default`"* (their own header
   comments) — a page that also exports a helper breaks `tsc --noEmit` after a build. Tests:
   `tests/proforma-page.test.ts:1` (`// @vitest-environment node`) imports
   `@/lib/proforma-passengers` directly. `vitest.config.ts` already defaults `environment: "node"`
   and aliases `@` → repo root. **The new unit goes in `lib/`, never exported from a page.**
4. **Type-only import across the server-action boundary is already house style.**
   `lib/proforma-passengers.ts:11` does `import type { TipoPax } from "@/app/actions/documentos-actions"`.
   The new unit does the same for `FacturaNumeroResult` (`app/actions/documentos-actions.ts:985`),
   so no Supabase client is ever loaded into the node test.
5. **Single call site.** `getFacturaNumeroPorReservaAction` is called in exactly ONE production
   place (`proforma/page.tsx:434`); `buildConfirmacionData` is called in exactly ONE production
   place (`proforma/page.tsx:503`). Grep-verified. This is what makes the 3-file cap achievable.
6. **Optimistic UI / realtime / RLS: not in play.** This path has no optimistic mutation (nothing
   is written), no realtime subscriber, no auth check. There is no rollback function to copy
   because there is no mutation — the only "rollback" is `git revert` of each task's commit.

**Approaches considered**

- **(A) Extract a pure helper that RETURNS a toast descriptor; the page fires it.** Smallest diff.
  **Rejected by the spec itself (S1)** and independently correct to reject: it leaves the emission
  in the page, so AC-6 ("exactly one emission site, inside the unit the tests import") is
  unsatisfiable and the tests would assert a *descriptor* — an adjacent value, not the effect —
  i.e. `fake-green-tests` anti-pattern #6 (decoupled payload proxy).
- **(B) jsdom/RTL mount of the real page and assert the rendered Radix toast.** Would close the
  residual wiring gap. **Rejected:** explicit spec NON-GOAL ("first jsdom/RTL component-mount
  suite"), would need `@/lib/supabase`, `next/navigation` and `useUser` mocked against a 1010-line
  component, and blows the file/line cap. The gap is disclosed instead of hidden (see Residual risk).
- **(C) CHOSEN — extract an importable unit that EMITS through an INJECTED notifier, and make the
  document builder's `facturaNumero` input a REQUIRED property.** The unit
  (`lib/factura-numero-confirmacion.ts`) owns both outcomes and owns the title constant, so the
  tests drive the real production code path (not a mirror) and the grep in AC-6 has exactly one
  hit. Making `BuildConfirmacionDataInput.facturaNumero` non-optional weaponizes `tsc --noEmit`:
  delete the resolution call and `npm run qa` fails at typecheck, while the runtime line at
  `lib/confirmacion-data.ts:364` is **byte-identical**, so ADR-0012's `delete input.facturaNumero
  → ok:true / null` tests stay green with their intent unmodified (they already use
  `delete (input as any).facturaNumero`, verified at `tests/confirmacion-data.test.ts:388, 401,
  445, 460, 470, 480`). Blast radius: 3 production files, 1 new test file.

**Seam map (the total file budget) and its complement**

| # | File | Kind | Why it is in the budget | Line cap (ins+del, `git diff --stat`) |
|---|------|------|-------------------------|---------------------------------------|
| P1 | `lib/factura-numero-confirmacion.ts` | **NEW** production | S1's importable unit + the single toast-title constant | **≤ 34 added** |
| P2 | `app/facturacion/proforma/page.tsx` | EDIT production | Replace the inline resolution+toast with a call to P1, injecting `toast` | **≤ 18 changed** |
| P3 | `lib/confirmacion-data.ts` | EDIT production | S2/AC-7: `facturaNumero` becomes a REQUIRED input property (type only) | **≤ 8 changed** |
| T1 | `tests/factura-numero-confirmacion.test.ts` | **NEW** test | S3: AC-1…AC-5 in the node environment | not counted (tests excluded) |

**Total production budget: 3 files, ≤ 60 changed lines — exactly AC-11.** The per-file sub-caps
are binding: they exist because this repo's house style writes 20–30-line comment headers, and one
such header on P1 alone would breach AC-11.

**MUST NOT TOUCH** (a diff here is an automatic task FAIL):
`app/actions/documentos-actions.ts` (incl. `getFacturaNumeroPorReservaAction`, its two verbatim
messages, `mensajeLookupFailed`, `MENSAJE_SIN_COMPROBANTE`) · `lib/document-generator.tsx`
(`generateConfirmacionHTML`, the `FACTURA #:` label) · the **runtime** expression at
`lib/confirmacion-data.ts:364` and every other required-field check in that file ·
`tests/confirmacion-data.test.ts` · `tests/confirmacion-html.test.ts` ·
`tests/documentos-actions.test.ts` (incl. the known-fragile `:473-481`, ruled backlog) ·
`app/facturacion/voucher/page.tsx` · `app/facturacion/fiscal/page.tsx` ·
`app/reservas/ver/[id]/page.tsx` · anything under `scripts/` · `lib/supabase.ts` ·
`components/ui/toast*.tsx` · `hooks/use-toast.ts` · `package.json` · `vitest.config.ts` ·
`CLAUDE.md` · `MEMORY/`. The page's five other untested toasts, the `proforma/page.tsx` split
(B-1/B-9), and the `.next/types` backlog item are all out of scope.

**Negative space checked** — `~/Developer/CBrain/decisions` + `~/Developer/CBrain/mistakes` read,
not just grepped:
- **ADR-0012 rejected (i) keep blocking / (ii) fabricate-or-placeholder / (iii) `reserva_id` +
  `numero_factura` on `comprobantes_fiscales` / (iv) build client invoicing.** **None is
  re-proposed.** Nothing here blocks generation, nothing introduces a placeholder (AC-5 mutations
  return `""`, `"N/A"` and today's date and must all go RED), no schema is touched, no invoicing is
  built. AC-7 strengthens ADR-0012's own "must never collapse" rule at compile time; it does **not**
  reopen the blocking question, because the *runtime* of `lib/confirmacion-data.ts:364` is unchanged
  and the ADR's own regression tests must stay green **with their intent unmodified**.
- **ADR-0011 (single-tenant, no auth, no RLS on ~29 legacy tables).** Untouched — zero auth, zero
  RLS, zero DB access added. ADR-0006 not triggered (no new table).
- **`fake-green-tests` (6 recurrences, 11 banned anti-patterns).** The design is shaped *by* it:
  #7 mirror-test → the test imports the **real** unit, no hand-copied stand-in; #6 payload proxy →
  approach (A) rejected for exactly this; #4 source-text assertion → AC-6 is a **QA repo grep**, and
  encoding it as a test assertion is an automatic FAIL (note `tests/confirmacion-data.test.ts:555-575`
  contains pre-existing source-text greps — **do not copy that shape into the new file**); #10
  wrong-reason RED → every mutation must name **which assertion** failed and why; #11 no-harness
  excuse → void, `tests/proforma-page.test.ts` is the precedent and jsdom/RTL are in `package.json`.
- **`assertion-without-verification` / `unrun-command-claimed-green`** → every AC below names the
  literal command whose pasted output is the only accepted evidence.
- **`stockin-zero-price`** → cuts both ways here; `null` is the correct, legitimate value and P3
  must not turn "absent at runtime" into a block.
- **`premature-success-signal`** → the success toast's position (after `openDocumentInNewWindow`)
  is an AC-8 invariant.
- **`environment-reliability-incidents`** → ONE write-capable agent on this tree; Task 0 stops the
  sprint if the tree is dirty rather than stashing/cleaning it.
- **`schema-source-of-truth`** → this sprint makes **no schema claim** and issues **no** new query;
  the `information_schema` ↔ `lib/supabase.ts` reconciliation stays backlog.

**Pre-mortem — most drift-prone task + mitigation.** **Task 2 (the page edit)** is the drift
magnet: `app/facturacion/proforma/page.tsx` is ~1010 lines (already over the 500-line healthy
range — **flagged**, split is B-1/B-9 and explicitly NOT this sprint), and the dev will be tempted
to (a) also wire the other five untested toasts, (b) rewrite the 12-line HC-2 comment block at
`:422-433` in house style, or (c) "tidy" the `Suspense` wrapper. Any of those breaches AC-8/AC-11.
Mitigations baked in: the ≤18-line sub-cap makes a comment rewrite arithmetically impossible; Task 2's
AC requires `git diff app/facturacion/proforma/page.tsx` to show changes **only** inside
`:422-442` plus one import line; and Task 0 captures the baseline so `git diff --stat` is checkable
at every step. **Second-most drift-prone: Task 3** — the dev may "helpfully" also change the
runtime line `:364` or add a `missing.push("FACTURA #")`. Its AC therefore pins `:364` as
byte-identical and requires `grep -c "FACTURA #" lib/confirmacion-data.ts` to be unchanged.

**Genuinely hard calls flagged for the human** — two, and neither is pretended away:
1. **Residual wiring gap (unsolvable within this spec's non-goals).** After Task 2, tests prove the
   *unit* calls its injected notifier exactly once with the exact payload. **Nothing proves the
   notification actually reaches the operator through the real Radix `<Toaster/>`** — that needs a
   jsdom/RTL mount (spec NON-GOAL) or the still-owed §8.3 interactive click-through (no browser
   automation connected — a human step). The sprint summary **must state this in these terms** and
   must not claim "full coverage."
2. **AC-7 makes an optional input property required.** That is the mechanism, and it is
   deliberate: from now on, *any* future caller of `buildConfirmacionData` must pass `facturaNumero`
   explicitly (passing `null` is fine and is the normal state). This is a small, permanent tax on
   future callers, accepted because it is the only way "the whole step vanished" fails a gate. It
   changes **no runtime behaviour**; if the human disagrees, the alternative is no compile-time
   guard at all.

---

## Technical approach (one paragraph)

Extract the FACTURA #-result → (value, notification) decision out of the `generarConfirmacion`
closure in `app/facturacion/proforma/page.tsx` into a new, directly-importable
`lib/factura-numero-confirmacion.ts`, following the exact `lib/proforma-passengers.ts` /
`lib/crm-casos-logic.ts` precedent (in `lib/`, never exported from a page, because `.next/types`
forbids extra page exports). The unit takes the discriminated `FacturaNumeroResult` (type-only
import) plus an **injected notifier** and *emits* the destructive toast itself for `LOOKUP_FAILED`
only, returning `numeroFactura` on `ok` and `null` on both failures; the page's only remaining job
is `resolverFacturaNumeroConfirmacion(await getFacturaNumeroPorReservaAction(reserva.id), toast)`
at the same position in the same order, so the toast title literal exists exactly once in
production source and the tests drive the real emission path rather than a descriptor. Separately,
`BuildConfirmacionDataInput.facturaNumero` changes from `facturaNumero?: string | null` to
`facturaNumero: string | null` — a **type-only** change that makes `tsc --noEmit` (and therefore
`npm run qa`) fail if the resolution step is ever deleted from the generation path, while the
normalization expression at `lib/confirmacion-data.ts:364` stays byte-identical so ADR-0012's
"absent → `null`, never blocks" runtime contract and its existing tests are untouched.

---

## File map

**CREATE — `lib/factura-numero-confirmacion.ts`** (≤34 lines total). Exports:
- `TITULO_ERROR_TECNICO_COMPROBANTE = "Error técnico al consultar el comprobante fiscal"` — the
  **only** occurrence of this string in production source after Task 2.
- `NotificacionFacturaNumero` — `{ title: string; description: string; variant: "destructive" }`.
- `NotificadorFacturaNumero` — `(n: NotificacionFacturaNumero) => void`.
- `resolverFacturaNumeroConfirmacion(resultado: FacturaNumeroResult, notificar: NotificadorFacturaNumero): string | null`
  — `ok` → `resultado.numeroFactura` verbatim, no call; `SIN_COMPROBANTE` → `null`, **no call**;
  `LOOKUP_FAILED` → emits exactly once with `{ title: TITULO_…, description: resultado.message,
  variant: "destructive" }` then returns `null`. Never throws.
- Header comment ≤10 lines: point at ADR-0012 and this plan; do **not** re-narrate HC-2.
- `import type { FacturaNumeroResult } from "@/app/actions/documentos-actions"` (type-only —
  matches `lib/proforma-passengers.ts:11`; keeps the node test free of Supabase).

**EDIT — `app/facturacion/proforma/page.tsx`** (≤18 changed lines):
- add one import line for `resolverFacturaNumeroConfirmacion`;
- replace `:434-442` (the `const facturaResultado` / ternary / `if (…LOOKUP_FAILED) toast({…})`
  block) with the single call, assigned to a `const facturaNumero: string | null`;
- the surrounding comment `:422-433` stays (edit at most 2 lines to point at the new module);
- `:503-512`'s `buildConfirmacionData({ …, facturaNumero, … })` call is **unchanged**.

**EDIT — `lib/confirmacion-data.ts`** (≤8 changed lines):
- `BuildConfirmacionDataInput.facturaNumero?: string | null` → `facturaNumero: string | null`
  (`:184`), and its 4-line doc comment updated to say *the property is required so an omitted
  resolution step is a compile error; its VALUE is still optional-by-`null` and absent still
  normalizes to `null` (ADR-0012)*. **`:364` is byte-identical. No `missing.push` is added.**

**CREATE — `tests/factura-numero-confirmacion.test.ts`** (not counted against the cap):
`// @vitest-environment node` first line; imports the real unit from
`@/lib/factura-numero-confirmacion`; a `vi.fn()` notifier per test (fresh instance, never shared,
never mutated in place — anti-pattern #1).

## DB changes

**None.** No table, no column, no view, no index, no policy, no `scripts/*.sql`, no seed. Nothing
is written to `auditoria`. No new `.select()` anywhere. Org-isolation/RLS posture is unchanged
(ADR-0011); ADR-0006 is not triggered because no table is created.

## API / service changes

**None.** `getFacturaNumeroPorReservaAction`'s signature, its two verbatim messages, its single
`SELECT`, and its `FacturaNumeroResult` union are untouched. `buildConfirmacionData`'s **runtime**
is untouched; only the *type* of one input property tightens.

## UI changes

**None visible.** Same toast title, same `description` (the action's own `message`, verbatim,
including the technical detail), same `variant: "destructive"`, same position in the flow
(persist → read passengers → resolve FACTURA # → build → open window → success toast), same
document output (`FACTURA #:` label with an empty value in the normal state).

## Edge cases

| Case | Where it is handled |
|---|---|
| **Normal state (no comprobante — every reserva in production today)** | `SIN_COMPROBANTE` → unit returns `null`, notifier **not called**. AC-1 asserts 0 calls **as the first assertion in the test body** (anti-pattern #10: the strongest structural claim must be reachable). |
| **Technical failure** | `LOOKUP_FAILED` → exactly one call, payload deep-equal; value `null`; generation continues. AC-2. |
| **Empty/whitespace/`null` `numero_factura` in the DB** | Already collapsed to `SIN_COMPROBANTE` inside the action (`documentos-actions.ts:1036`) — unchanged, not re-implemented in the unit. |
| **Value exists** | Returned byte-for-byte, no call. AC-5. |
| **Unit throws** | It cannot: no `await`, no I/O, no property access on a possibly-undefined value. AC-4 asserts `expect(() => …).not.toThrow()` for all three shapes. A notifier that itself throws is **out of scope** (the real `toast` does not throw); do not add a `try/catch` — it would swallow real errors and cost lines. |
| **Concurrent edits / realtime races** | Not applicable — read-only path, no subscription, no shared mutable state. The unit is stateless and pure apart from the injected call. |
| **Rollback** | No optimistic mutation exists, so there is no rollback function to copy; per-task rollback is `git revert <task commit>` (each task ships one commit). |
| **Deep link `?reserva_id=`** | Unchanged (`resolverReservaDeepLink`, `:307-333`) — must not be touched. |

## Test plan (the exact commands; nothing is evidence until its output is pasted)

```bash
# Baseline + every task gate (the repo's real QA command — package.json:12)
rm -rf .next && npm run qa          # = tsc --noEmit && eslint . && vitest run
npx next build                       # AC-8/AC-9 clean-compile proof

# AC-6 — the ONE-EMISSION-SITE repo check (a grep, NEVER a test assertion)
grep -rn --include='*.ts' --include='*.tsx' \
  "Error técnico al consultar el comprobante fiscal" app lib components hooks | wc -l
# MUST print 1, and the single hit MUST be lib/factura-numero-confirmacion.ts

# AC-8 / AC-11 — surface proof
git diff --stat <baseline-sha>
git diff <baseline-sha> -- app/facturacion/proforma/page.tsx lib/confirmacion-data.ts

# AC-10 — no fiscal side effects
git status --porcelain scripts/            # MUST be empty
git diff <baseline-sha> | grep -nE "\.select\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|ncf|NCF"
# MUST return nothing
```

Mutation protocol for every mutation below (`fake-green-tests` #10): run it, paste the RED output,
**name the file:line of the specific failing assertion and why it failed**, restore, re-run
`npm run qa` green. "The failure count went up" is not evidence.

---

## Task list

> Every task is **senior-dev**. This is deliberate, not padding: `CLAUDE.md` and the briefing both
> rule fiscal/NCF-adjacent work senior + human-gated, and each task here either authors the tests
> that must survive adversarial mutation or edits the CONFIRMACIÓN generation path. There is no
> junior-safe slice; manufacturing one on a fiscal path would itself be the mistake.

### Task 0 — Baseline verification & sprint preflight
- **Owner:** senior-dev
- **Depends on:** —
- **Files in scope:** **NONE.** This task writes nothing. Any file modification = FAIL.
- **DB/RLS:** none.
- **Do:** `git rev-parse HEAD`, `git status --porcelain`, `git log --oneline -3`, then
  `rm -rf .next && npm run qa` and `npx next build`.
- **Acceptance (PASS/FAIL):**
  1. HEAD sha, branch, and `git status --porcelain` pasted. **The spec claims `89cc76e` but the
     session-start snapshot shows `8f00cdc` on `v0/johan3118-18a6bc40` with 4 modified files and 2
     untracked** — if HEAD ≠ the spec's baseline **or** the tree is not clean, **STOP and escalate to
     the human**. FAIL if the agent commits, stashes, resets, checks out, or `git clean`s anything
     (`mistakes/environment-reliability-incidents` — one write-capable agent, and an in-flight
     sprint's uncommitted work must never be destroyed to unblock this one).
  2. `npm run qa` output pasted **verbatim** on a clean `.next`: record the exact **test count**
     (spec says 618), **warning count** (baseline 30), **0 lint errors, 0 failures**. These are the
     numbers AC-9 is measured against. FAIL if any number is asserted without pasted output
     (`mistakes/unrun-command-claimed-green`, `mistakes/assertion-without-verification`).
  3. `npx next build` pasted, clean compile.
  4. `grep -rn --include='*.ts' --include='*.tsx' "Error técnico al consultar el comprobante fiscal" app lib components hooks`
     pasted — expected: exactly 1 hit, `app/facturacion/proforma/page.tsx:438` (the pre-move state).
  5. The recorded baseline sha is written into the task report and used by every later
     `git diff <sha>`.
- **Rollback:** nothing to roll back (no writes).

### Task 1 — Create the importable two-outcome unit + its node tests (S1, S3, AC-1…AC-5)
- **Owner:** senior-dev
- **Depends on:** Task 0
- **Files in scope (exact):** `lib/factura-numero-confirmacion.ts` (**new, ≤34 lines**),
  `tests/factura-numero-confirmacion.test.ts` (**new**). **Nothing else.** The page is NOT touched
  in this task — the toast title will transiently exist in two places; **AC-6 is Task 2's, do not
  evaluate it here.**
- **DB/RLS:** none.
- **Acceptance (PASS/FAIL):**
  1. The unit exists at `lib/factura-numero-confirmacion.ts` with the exports listed in the File
     map, uses `import type` for `FacturaNumeroResult`, and has **zero** value imports from
     `@/app/actions/documentos-actions`, zero Supabase imports, zero React imports.
     `grep -n "^import" lib/factura-numero-confirmacion.ts` pasted.
  2. `wc -l lib/factura-numero-confirmacion.ts` ≤ 34, pasted.
  3. The test file's first line is `// @vitest-environment node` and it imports the **real** unit
     from `@/lib/factura-numero-confirmacion` (`mistakes/fake-green-tests` #7 — a hand-copied
     stand-in of the function inside the test file is an automatic FAIL; #11 — "no harness exists"
     is void here, `tests/proforma-page.test.ts` is the in-repo precedent).
  4. **AC-1** — driven with `{ok:false, reason:"SIN_COMPROBANTE", message}`: the **first assertion
     in the test body** is `expect(notificar).toHaveBeenCalledTimes(0)`; then
     `expect(valor).toBeNull()`. Assertion order is load-bearing (`fake-green-tests` #10) — an
     ordering that puts the 0-calls claim last is a FAIL.
  5. **AC-2** — driven with `{ok:false, reason:"LOOKUP_FAILED", detail, message}`:
     `toHaveBeenCalledTimes(1)` **first**, then `expect(notificar).toHaveBeenCalledWith({ title:
     "Error técnico al consultar el comprobante fiscal", description: <the result's `message`
     verbatim, technical detail included>, variant: "destructive" })` (deep-equal, full object —
     not `expect.objectContaining`, not a substring), then `expect(valor).toBeNull()`.
  6. **AC-4** — `expect(() => resolverFacturaNumeroConfirmacion(r, notificar)).not.toThrow()` for
     all three shapes.
  7. **AC-5** — `{ok:true, numeroFactura:"B0100000123"}` → returns exactly `"B0100000123"`
     (`toBe`, not `toContain`); both failure shapes → exactly `null` (`toBeNull`, never
     `toBeFalsy`).
  8. Each test uses its **own fresh `vi.fn()`** notifier (no shared/mutated mock —
     `fake-green-tests` #1). **No `readFileSync`/regex-on-source assertion anywhere in the new test
     file** (#4) — note `tests/confirmacion-data.test.ts:555-575` has that shape for an unrelated
     purity check; copying it here is an automatic FAIL.
  9. **Mutations — all five run against the REAL unit, each shown RED with the failing
     assertion's file:line and reason NAMED, then restored (AC-3 (i)+(ii), AC-4, AC-5):**
     (a) delete the notifier emission → RED on AC-2's call-count/payload assertion;
     (b) emit for **every** non-ok result (drop the `reason` discrimination) → RED on AC-1's
     0-calls assertion;
     (c) make the `LOOKUP_FAILED` path `throw` → RED on the no-throw assertion;
     (d)(e)(f) return `""`, `"N/A"`, and `new Date().toISOString().slice(0,10)` instead of `null` →
     each RED on AC-5. (`mistakes/stockin-zero-price` cuts both ways: `null` is the *legitimate*
     value; a mutation that makes the unit *block* would also be wrong.)
 10. `npm run qa` pasted green after restore, with test count **strictly greater than the Task 0
     baseline**.
- **Rollback:** `git revert` this task's commit — nothing imports the new file yet, so removing it
  restores the pre-task state exactly.

### Task 2 — Rewire the page to the unit; one emission site (S1 completion, AC-6, AC-8)
- **Owner:** senior-dev
- **Depends on:** Task 1
- **Files in scope (exact):** `app/facturacion/proforma/page.tsx` **only** (≤18 changed lines,
  confined to the import block + `:422-442`).
- **DB/RLS:** none.
- **Acceptance (PASS/FAIL):**
  1. `:434-442` is replaced by a single `const facturaNumero: string | null =
     resolverFacturaNumeroConfirmacion(await getFacturaNumeroPorReservaAction(reserva.id), toast)`
     (multi-line formatting allowed). `toast` (from `useToast()`, `:147`) is passed **directly**;
     a one-line adapter `(n) => toast(n)` is permitted **only** if `tsc` rejects the direct pass,
     and it must contain **no** title/description/variant literal.
  2. `buildConfirmacionData({ …, facturaNumero, … })` at `:503-512` is unchanged; the call's
     **position** in `generarConfirmacion` is unchanged (persist → read passengers → resolve
     FACTURA # → build → discrepancy → `generateConfirmacionHTML` → `openDocumentInNewWindow` →
     success toast). The success toast still fires **after** the window opens
     (`mistakes/premature-success-signal`).
  3. **AC-6 (repo check, not a test):**
     `grep -rn --include='*.ts' --include='*.tsx' "Error técnico al consultar el comprobante fiscal" app lib components hooks | wc -l`
     prints **exactly 1**, and the hit is in `lib/factura-numero-confirmacion.ts`. Output pasted.
     **Encoding this as a test assertion is `fake-green-tests` #4 and an automatic FAIL of AC-6.**
  4. `git diff <baseline-sha> -- app/facturacion/proforma/page.tsx` pasted: changed hunks appear
     **only** in the import block and `:422-442`. Any hunk elsewhere (the other five toasts, the
     `Suspense` wrapper, the `:363-385` docblock beyond ≤2 pointer lines, formatting churn) = FAIL.
  5. `git diff --stat` shows ≤18 changed lines for this file.
  6. **AC-8** — zero operator-visible change: no diff hunk alters any user-facing string, any
     `variant`, or the statement order above; `npx next build` pasted clean.
  7. **Mutation (proves the page is really wired to the unit, not just importing it):** change the
     page to pass a no-op notifier `() => {}` instead of `toast` → the unit tests stay green (they
     test the unit) **and** the AC-6 grep still prints 1, so this mutation is *deliberately*
     undetectable by the suite. **Report this honestly as the residual wiring gap** — it is the
     boundary of this sprint's evidence, not a defect to hide (`mistakes/assertion-without-verification`).
     Restore `toast`.
  8. `rm -rf .next && npm run qa` pasted green (clean `.next` is mandatory — the `.next/types`
     per-route rule is why the unit lives in `lib/`).
- **Rollback:** `git revert` this task's commit — the page returns to its inline toast; the unit
  and its tests remain green and harmless.

### Task 3 — Compile-time omission guard (S2 / AC-7), runtime provably unchanged
- **Owner:** senior-dev
- **Depends on:** Task 2
- **Files in scope (exact):** `lib/confirmacion-data.ts` **only** (≤8 changed lines).
- **DB/RLS:** none.
- **Acceptance (PASS/FAIL):**
  1. `BuildConfirmacionDataInput.facturaNumero` (`:184`) is now **required**: `facturaNumero:
     string | null`. Its doc comment states the property is required so that omitting the
     resolution step is a **compile error**, while the *value* stays optional-by-`null` per
     ADR-0012.
  2. **Runtime unchanged, proven:** `git diff <baseline-sha> -- lib/confirmacion-data.ts` shows
     **no** change to `:364`'s expression, no new `missing.push`, and no change to any other
     required-field check. `grep -n "FACTURA #" lib/confirmacion-data.ts` output is identical to
     baseline (pasted both times).
  3. `tests/confirmacion-data.test.ts` and `tests/confirmacion-html.test.ts` are **not edited**
     (`git status --porcelain tests/` shows neither) and stay green — specifically the ADR-0012
     cases at `:386-433` (`delete (input as any).facturaNumero` → `ok:true`, `data.facturaNumero`
     `null`). Their intent must be **unmodified**; weakening/rewriting any of them to accommodate
     the type change = FAIL.
  4. **AC-7 mutation, run and pasted:** in `app/facturacion/proforma/page.tsx`, delete the FACTURA #
     resolution call **and** the `facturaNumero` argument it feeds into
     `buildConfirmacionData` → `npm run qa` **FAILS at typecheck** with `error TS2345`/`TS2739`
     naming `facturaNumero` (paste the exact `tsc` error text and file:line). Restore → `npm run qa`
     green, pasted. A mutation that fails for any *other* reason (e.g. `Cannot find name`) must be
     re-run in the "argument removed too" form so the RED is for the right reason
     (`fake-green-tests` #10).
  5. A **second, subtler mutation:** keep the call but pass `facturaNumero: undefined` explicitly →
     must ALSO fail typecheck (or, if it type-checks, say so plainly in the report and do not claim
     the guard is airtight — `mistakes/assertion-without-verification`).
  6. `rm -rf .next && npm run qa` pasted green; `npx next build` pasted clean.
- **Rollback:** `git revert` this task's commit — the property returns to optional; the unit, the
  page wiring and all tests stay green (nothing depends on the property being required).

### Task 4 — Whole-sprint gate evidence + human-gate packet (AC-8, AC-9, AC-10, AC-11)
- **Owner:** senior-dev
- **Depends on:** Task 3
- **Files in scope:** **NONE.** Verification only. Any source edit here = FAIL (and would void
  `CLAUDE.md`'s "the lead has NOT edited any source file" sprint rule).
- **DB/RLS:** none.
- **Acceptance (PASS/FAIL):**
  1. **AC-9:** `rm -rf .next && npm run qa` pasted showing **0 lint errors**, **warnings ≤ 30**,
     **test count strictly > 618** (and > Task 0's recorded baseline), **0 failures**;
     `npx next build` pasted, clean compile.
  2. **AC-11:** `git diff --stat <baseline-sha>` pasted showing **exactly 3 production files**
     (`lib/factura-numero-confirmacion.ts`, `app/facturacion/proforma/page.tsx`,
     `lib/confirmacion-data.ts`) totalling **≤60 changed lines**, plus test files (excluded from
     the cap). A 4th production file = FAIL.
  3. **AC-10:** `git status --porcelain scripts/` empty; the `.select(`/`insert`/`update`/`upsert`/
     `delete`/`ncf` grep over the full diff returns nothing; no `auditoria`/telemetry write was
     added; no auth or RLS file touched. All outputs pasted.
  4. **AC-8:** the full `git diff <baseline-sha>` reviewed and reported line-by-line for
     operator-visible strings, toast variants, statement order, and document output — **zero
     change** on all four, with the specific diff hunks quoted.
  5. **AC-6 re-run** at final state, output pasted, still exactly 1.
  6. **Residual-risk disclosure, verbatim in the report:** "The unit's notifier contract is pinned
     by node tests; **nothing here proves the toast reaches the operator through the real Radix
     toaster** — that requires a jsdom/RTL mount (spec NON-GOAL) or the still-owed §8.3 human
     click-through. Coverage is NOT complete." A summary claiming full coverage = FAIL.
  7. **Human gate:** the packet is handed to the human for approval **before merge** (fiscal-adjacent
     — `CLAUDE.md`). Merging without it = FAIL.
  8. Per-task rollback notes (Tasks 1–3) restated in one place.
- **Rollback:** n/a (no writes).

---

## Sequencing

`Task 0 → Task 1 → Task 2 → Task 3 → Task 4`. Strictly linear; no task depends on a later one.
One task at a time, each with its own QA pass before the next starts (`CLAUDE.md` workflow rule).
Note the transient states this ordering accepts on purpose: after Task 1 the toast title exists in
**two** places (AC-6 is not evaluated until Task 2), and after Task 2 the compile-time guard does
not exist yet (AC-7 is not evaluated until Task 3).

## File-size note (`.claude/rules/file-size.md`)

`app/facturacion/proforma/page.tsx` is ~1010 lines — **already well over the 500-line healthy
range. Flagged, not fixed here.** This sprint *reduces* it by ~4 lines. The split is B-1/B-9 and is
an explicit spec NON-GOAL; bundling it into any task above is a FAIL. `lib/confirmacion-data.ts`
(~420 lines) and the new `lib/factura-numero-confirmacion.ts` (≤34) are both within range.

PLAN_PATH: docs/plans/factura-numero-lookup-contract.md
