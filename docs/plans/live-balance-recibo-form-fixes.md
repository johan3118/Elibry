# Plan — Live balance, content-complete RECIBO, and reserva-form fixes

**Spec:** APPROVED FROZEN (human-approved 2026-08-14), five items.
**Architect pass:** 2026-08-14. Grounding = real code inspection (every path below was opened, not inferred from `CLAUDE.md`, which is stale — the stack is **Next.js 14.2**, not 15).
**QA command:** `npm run qa` = `npm run typecheck && npm run lint && npm run test` = `tsc --noEmit && eslint . && vitest run` (verified in `package.json:5-13`).
**Baseline to hold:** **28 test files / 625 tests** green (pre-sprint, measured at commit `85eb397`), 0 lint errors, **30 lint warnings** (flat). (After T1 landed this is **633 tests**. The earlier "27 test files / 618 tests" figure written here was **stale** — it predated the unrelated commit `5b9005d`, which added `app/productos/constants.test.ts` as the 28th file; QA re-measured the real baseline empirically during T1 by stashing T1's files and running `npx vitest run` at `85eb397`. The lint half was independently re-verified as correct and is unchanged.)
**Plan corrections:** **2026-08-14, after T1's QA** — the stale test-file/test-count half of the baseline line above was corrected to 28 files / 625 tests, §10's `vitest run` expectation was updated to match so a later task's QA does not chase the same ghost, and backlog **B-25** was added. Recorded here, in the file, rather than only in a session packet: a plan's own prose carries the same evidentiary weight as a dev report (`assertion-without-verification`, instance 4 — "the sharpest instance — the plan itself"), and a correction struck only in a transcript leaves every later reader of this file misled. No task, acceptance criterion, or scope was changed by this correction.

---

## 0. Architecture Reasoning (show your work)

**Invariants in play + the existing mechanism each follows**

| Invariant | Existing mechanism in THIS repo | How this plan respects it |
|---|---|---|
| Money math has ONE source of truth | `lib/finance.ts` — its own header says *"This module is the SINGLE SOURCE OF TRUTH for MONTO PAGADO / BALANCE RESERVA / BALANCE GENERAL. These values must never be recomputed or inlined into a document template."* Consumed today by `lib/confirmacion-data.ts:341` and typed into `app/facturacion/proforma/page.tsx:33`. | Items 1 and 4 call `calcularBalanceReserva` / `calcularMontoPagado` (already exported, already unit-pinned in `tests/finance.test.ts`). **No new arithmetic is written.** One tiny additive selector (`montosDePagosDeReserva`) lands in that same module, not a new one. |
| HTML escaping is a property of the renderer | `lib/html-escape.ts` — `html` tagged template + `renderHtml`; `generateReciboHTML` already returns `renderHtml(html\`…\`)` with all 17 values escaped, pinned by `tests/recibo-html.test.ts` (18 tests) including a `raw(`-count static guard at `:179-189`. | Every new RECIBO field is interpolated **inside the same `html` template** → escaped by construction. `tests/recibo-html.test.ts` gains hostile payloads in the new fields (AC4.7). `raw(` count stays 0. |
| VOUCHER is money-free by compile-time guarantee | `lib/voucher-data.ts:16-20` (pattern `compile-time-omission-guard`). | Item 3 edits **one `<h1>` string** on `app/facturacion/voucher/page.tsx`. `lib/voucher-data.ts` and `generateVoucherDocHTML` are on the must-not-touch list. |
| Deep links into document pages use one contract | `lib/deep-link-reserva.ts:31-46` `resolverReservaDeepLink(param, reservas)`, consumed by `app/facturacion/proforma/page.tsx:314-334`; producers use `router.push(\`/facturacion/proforma?reserva_id=${reserva.id}\`)` (`app/reservas/ver/[id]/page.tsx:365`, `app/reservas/pendientes/page.tsx:1019`). | Item 2 adds a **third producer** with the identical string shape. Zero new mechanism, zero change to the resolver. |
| Optimistic UI / rollback | **There is none in these paths.** Every surface here is load-then-render; `handleSubmit` writes then navigates. Grepped: **no `supabase.channel` / `postgres_changes` anywhere in the repo** → no realtime subscribers to keep compatible. | No optimistic mutation is introduced, so no rollback path is owed. Every task's rollback is `git revert` of a single commit. |
| Org isolation / RLS | ADR-0011: Elibry is single-tenant-for-now, **zero RLS on ~29 pre-existing tables**, no `supabase.auth`, browser runs as PostgREST `anon` (`lib/supabase.ts:26-57`). | **This sprint ships ZERO DDL** — no new table, no new column, no policy, no `GRANT`. ADR-0006 ("every new table gets a policy") is satisfied vacuously and is re-asserted as a hard gate below. **No task may claim Elibry became more secure** (R8). |

**Approaches considered**

*Item 1 — where does the live balance come from?*
- **(A) Re-use `lib/finance.ts` at the call sites. CHOSEN.** `precio_total − Σ pagos` is exactly `calcularBalanceReserva(total, 0, montos)` (with cent-rounding, which `/reservas/ver/[id]:183` lacks). Blast radius: 1 page + 1 additive selector. Rounding is a *bonus*: the unrounded float would make a fully-paid reserva prefill `1e-10` through `.toString()`.
- **(B) Add a DB trigger / recompute `reservas.balance_general` on every payment write.** Rejected: it is a live-DB DDL change on a money column, human-gated, and the spec's non-goals forbid touching the other stale-snapshot displays — a trigger would silently change all of them at once. It also re-walks `schema-source-of-truth` (we cannot see the live schema from here).
- **(C) A new `lib/balances.ts` module.** Rejected: `lib/finance.ts` already claims this responsibility in writing. A second module would be a competing source of truth — the exact failure `lib/finance.ts`'s header exists to prevent.

*Item 4 — company data.*
- **(A) One `lib/empresa-info.ts` PLACEHOLDER module, both renderers read it. CHOSEN** — this is the human's explicit amendment.
- **(B) Read `configuracion_empresa`.** **Forbidden by the spec and by `schema-source-of-truth`.** Verified independently: repo-wide grep for `configuracion_empresa` returns hits in **`CLAUDE.md:134`, `CLAUDE.md:192`, and `docs/plans/recibo-escape-and-input-guards.md:684` only** — zero code paths. Wiring a read to a table whose existence is asserted by a stale doc is precisely the logged mistake.
- **(C) Leave the literal in `app/pagos/buscar/page.tsx:198-203` and hand-copy it into `PaymentReceipt`.** Rejected: two literals that can diverge, and it does not satisfy the human's "we need to set that data in settings" ruling.

*Item 4 — merge the two renderers?* Explicit spec NON-GOAL. Both are fed the same values from the same helpers instead.

**Seam map (total file budget — no task may name a file outside this list)**

| File | Why it is in the budget |
|---|---|
| `lib/finance.ts` | +1 additive pure selector (existing single-source money module) |
| `tests/finance.test.ts` | pins the above |
| `lib/empresa-info.ts` | **NEW** — the one documented PLACEHOLDER company source |
| `app/pagos/registrar/page.tsx` | item 1, all three surfaces + both load paths |
| `app/reservas/crear/page.tsx` | item 5 (horas) and item 2 (redirect) — **shared by two tasks, strictly sequential** |
| `app/facturacion/page.tsx` | item 3, 2 strings |
| `app/facturacion/voucher/page.tsx` | item 3, 1 string |
| `lib/document-generator.tsx` | item 4(a) — `ReciboData` + `generateReciboHTML` ONLY |
| `tests/recibo-html.test.ts` | item 4(a) AC4.7 |
| `app/pagos/buscar/page.tsx` | item 4(a) caller — `regenerarRecibo` + `getClienteData` + local interfaces |
| `components/payment-receipt.tsx` | item 4(b) renderer |
| `app/reservas/ver/[id]/page.tsx` | item 4(b) call site + routing its balance math through `lib/finance.ts` |
| `docs/plans/empresa-info-settings-backlog.md` | **NEW** — the human's "document" deliverable |
| `docs/plans/live-balance-recibo-form-fixes.md` | this plan (architect-owned; devs do not edit it) |

**Complement — MUST NOT TOUCH.** `lib/voucher-data.ts` · `generateVoucherDocHTML` / `generateProformaHTML` / `generateConfirmacionHTML` (byte-frozen, AC4.8) · `lib/document-generator.tsx:1596-1599` (the REAL company footer of the VOUCHER/CONFIRMACIÓN documents — leave it exactly as is) · `downloadVoucherAsPDF` + the `jspdf`/`html2canvas` imports (deliberately kept unwired by 85eb397) · `comprobantes_fiscales` / `comprobantes_disponibles` and anything NCF · `lib/supabase.ts` · `lib/user-context.tsx` · `lib/provisional-system.ts` · `lib/deep-link-reserva.ts` · `app/reservas/editar/[id]/page.tsx` · `app/reservas/pendientes/page.tsx` · `app/clientes/balance*` · `app/page.tsx` / `app/dashboard/page.tsx` · **`scripts/` — no migration is added, edited or run in this sprint** · `docs/VOUCHER GEB-2.docx`, `docs/CONFIRMACION GEB.docx` and **every code comment / test title that names them** (`reproduce-and-flag`) · `.claude/rules/*`, `CLAUDE.md`, any config.

**Negative space checked (grepped `~/Developer/CBrain/decisions` + `~/Developer/CBrain/mistakes`)**
- **ADR-0011 single-tenant-for-now** — rejected alternative "retrofit RLS onto the ~29 pre-existing tables as a side-quest". Not re-proposed: this sprint ships zero DDL and zero auth change (R8).
- **ADR-0012 CONFIRMACIÓN without factura número** — rejected alternatives "fabricate/placeholder a fiscal number" and "build client invoicing inline". Not re-proposed: the FISCAL CONSTRAINT (no NCF, no comprobante, no client-invoice linkage on the RECIBO) is an explicit, grep-verified AC on tasks T7 and T8.
- **ADR-0006 RLS on every new table** — no new table exists; stated explicitly rather than skipped.
- **ADR-0014 bounded evidence** — every AC below is satisfiable with literal diff hunks + a named command/grep. No task requires reproducing a whole file.
- **`schema-source-of-truth`** — binds R2 (company data: `configuracion_empresa` is doc-only, proven above) and R3 (`scripts/030-fix-balance-logic-correct.sql:17` filters `status = 'COMPLETADO'`; **no live path uses a `status` column on `pagos` at all** — see §2.1). Every schema claim in this plan is labelled with its evidence class.
- **`relocated-coverage-gap`** (4 prior instances) — the plan deliberately adds **call sites to already-pinned functions** instead of extracting a fifth helper. The one new selector is additive to an existing pinned module, and T1's ACs name both required mutations and force the "gap is relocated, not closed" disclosure. See HARD CALL #3: the jsdom/RTL harness is now *installable-free* and this is the cheapest moment ever to close the family — but building it is out of this sprint's frozen scope.
- **`stockin-zero-price`** (block-never-default, **both directions**) — binds item 1 (a real `0` balance IS `0`; that falsy-`0` fallthrough is literally the bug) and item 5 (a default is legitimate on a NEW form, never over a stored value). Named inside T2 and T4's own ACs.
- **`premature-success-signal`** — binds T5 (the redirect must stay inside the resolved-success branch).
- **`fake-green-tests`** (12 anti-patterns, incl. homogeneous fixtures) — binds T1 and T7's fixture requirements; QA is told its own invented mutations outrank the plan's.
- **`unrun-command-claimed-green` / `assertion-without-verification`** — every task's rollback must be **executed in a throwaway clone**, output pasted.

**Pre-mortem — most drift-prone task + mitigation.**
**T7 (RECIBO renderer (a))** is the highest drift risk: it edits `lib/document-generator.tsx` (**~1840 lines, already breaching the ≤500 rule**), and the natural instinct is to "while I'm here" split the file or tidy the sibling generators. Mitigations: (i) its AC requires `git diff lib/document-generator.tsx` to show hunks **only** inside `interface ReciboData` and `export function generateReciboHTML`; (ii) `tests/proforma-snapshot.test.ts`, `tests/confirmacion-html.test.ts`, `tests/voucher-html.test.ts` are pinned and must pass unchanged; (iii) the B-1 file split is named in the plan as forbidden-to-bundle, so the dev has a place to put the urge. Runner-up: **T2**, which could drift into "fix the other stale balance displays" — killed by a `git diff --name-only` AC and by the non-goals being restated in the task.

**Genuinely hard calls — flagged, not papered over.** See §7.

---

## 1. Technical approach (one paragraph)

Every one of the five items is a *reuse* change, not a new mechanism. The outstanding balance stops being read from the snapshot columns `reservas.balance_general`/`balance_reserva` (which **nothing decrements** — verified: `app/pagos/registrar/page.tsx:308-337` is a bare `pagos` insert, `lib/provisional-system.ts:100-175` never touches `reservas` balances, and no `pagos`→`reservas` trigger exists in `scripts/024`/`025`) and is instead computed at read time by the module that already owns money math, `lib/finance.ts`, which gains one additive pure selector `montosDePagosDeReserva`. `/pagos/registrar` learns to fetch each candidate reserva's `pagos` rows (one extra `.in("reserva_id", …)` query per load path) and feeds all three of its displayed numbers from a single local function, so they cannot disagree; the same two `lib/finance.ts` calls feed both RECIBO renderers, and `/reservas/ver/[id]`'s existing inline arithmetic is repointed at them so the whole sprint quotes one number. The reserva-creation redirect swaps its destination string for the existing `?reserva_id=` deep-link contract — and the provisional path **does** have the real `reservas.id` (see §2.2), so no id is fabricated. The company block moves out of a page literal into one greppable `lib/empresa-info.ts` PLACEHOLDER module consumed by both renderers, with its migration-to-settings written up as a real deliverable. Item 3 is three string edits; item 5 is two labels, two initial values and one validation guard copied from the sibling `fecha` check.

---

## 2. Grounding — what the real code actually says

### 2.1 The `pagos.estado` value space (R3, verified myself)

`scripts/030-fix-balance-logic-correct.sql:17` filters `AND status = 'COMPLETADO'`. **No runtime path reads or writes a `status` column on `pagos`.** What the app actually writes to `pagos.estado`:

| Writer | Value written | Evidence class |
|---|---|---|
| `app/pagos/registrar/page.tsx:317` (`estado: formData.status`) | `"ACTIVO"` (default, `:69`) or `"ANULADO"` (`:666-667`) | live write site |
| `app/reservas/crear/page.tsx:530` (admin initial payment) | `"CONFIRMADO"` | live write site |
| `app/reservas/crear/page.tsx:564` (provisional initial payment) | `"PENDIENTE"` | live write site |
| `scripts/024-create-pagos-table.sql:14` | column default `'completado'` | migrations folder — **NOT evidence about the live DB** |

`app/pagos/buscar/page.tsx:238-262` filters/labels only `activo`/`anulado`. **Consequence: any `estado === 'ACTIVO'` filter would silently drop real money** (the `CONFIRMADO`/`completado` rows) and overstate the balance — the over-rejection half of `stockin-zero-price`. See HARD CALL #1 for the ruling.

### 2.2 The provisional reserva id IS available (the spec asked me to determine this)

`crearReservaProvisional` → `crearRegistroProvisional("reservas", …)` (`lib/provisional-system.ts:541-543` → `:100-175`) inserts **into the real `reservas` table** with an explicit `id = max(id) + 1` and `estado_registro: "PROVISIONAL"`, then `.select().single()` and returns `{ success: true, data: registroCreado }`. `app/reservas/crear/page.tsx` **already relies on this**: `result.data.id` is used as `reserva_id` at `:558` and `:574`. And `/facturacion/proforma`'s reserva list is an unfiltered `select("*")` (`:156-159`), so a PROVISIONAL row resolves identically to a PERMANENTE one.
**→ AC2.2 is achievable with no fabrication.** Residual hazard, pre-existing and NOT fixed here: `max(id)+1` does not advance the `SERIAL` sequence, so a later sequence-driven insert can collide. Backlog B-22.

### 2.3 `pagos.registrado_por` is a dead field (new finding, blocks a naive AC4.4)

`components/payment-receipt.tsx:246` renders `pago.registrado_por || "Sistema"` and `app/reservas/ver/[id]/page.tsx:662` renders `pago.registrado_por || "N/A"`. Repo-wide grep for `registrado_por` in `**/*.tsx`: **every writer is on `reservas` / `reserva_detalles` / `clientes` / `productos` — not one writes `pagos.registrado_por`.** The column the app actually populates is **`pagos.usuario`** (`app/pagos/registrar/page.tsx:318`, `app/reservas/crear/page.tsx:531`, `:565`; typed as `usuario: string` in `app/pagos/page.tsx:25`, `app/pagos/ver/page.tsx:25`, `app/pagos/editar/page.tsx:31`). AC4.4 must read `usuario`.

### 2.4 `clientes.direccion` — evidence class: corroborated live write/read, NOT `information_schema`

Written by `app/clientes/registrar/page.tsx:180` and `app/clientes/editar/page.tsx:272` (and required by both forms' validation), read by `app/clientes/ver/page.tsx:231` and `app/facturacion/proforma/page.tsx:228`. That is the strongest signal available offline (`schema-source-of-truth`'s positive-corroboration clause) but is **not** an `information_schema` result. Tasks must null-guard and label the claim as such.

### 2.5 Repo-wide `GEB` inventory (item 3)

3 user-visible strings (`app/facturacion/page.tsx:309`, `:319`, `app/facturacion/voucher/page.tsx:874`). All remaining hits are source-of-truth filename references that MUST survive: `lib/voucher-data.ts:10`, `lib/document-generator.tsx:66`, `:141`, `:250`, `:1017`, `app/actions/documentos-actions.ts:674`, `tests/voucher-html.test.ts:38,172,250,267,401`, `MEMORY/project_sprint_state.md:168`. **Plus one false positive QA must expect: `package-lock.json:871` contains the base64 substring `…2HdXDMd9GMgTGrPWnJzP…`.**

### 2.6 Environment facts that shape the test plan

- No realtime anywhere (`supabase.channel` / `postgres_changes`: zero hits in source).
- Page helpers now live in `lib/`, imported by tests as `@/lib/...` (`tests/proforma-page.test.ts:12` → `@/lib/proforma-passengers`). Commit 89cc76e moved them there so `tsc` survives a `next build`. **Do not export new helpers from a page module.**
- `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@vitejs/plugin-react` are **already installed** (`package.json:71-86`) and `vitest.setup.ts` imports `@testing-library/jest-dom`; `vitest.config.ts:8` sets `environment: "node"` globally, so a mount test would need `// @vitest-environment jsdom`. See HARD CALL #3.

---

## 3. DB changes

**NONE. Zero DDL in this sprint.** No new table, no new column, no index, no trigger, no view, no `GRANT`, no `CREATE/ALTER/DROP POLICY`, no `ALTER TABLE … ROW LEVEL SECURITY`. Nothing under `scripts/` is added, edited, or executed.

- **ADR-0006 compliance:** no new table exists, so the "every new table ships an org-isolation policy" rule is satisfied vacuously. Stated explicitly rather than skipped.
- **ADR-0011 status unchanged:** the ~29 pre-existing tables still have no RLS and Elibry still has no authentication. **No task in this sprint may claim any security improvement** (R8).
- **Hard gate:** if any task discovers it needs a migration to satisfy its AC, it **STOPS and returns to the architect**. It does not write SQL.

---

## 4. API / service changes

- `lib/finance.ts` — **one additive export** (T1). Module stays pure: no Supabase import, no side effects, no I/O.
- `lib/empresa-info.ts` — **new**, pure constants (T6). No Supabase, no React, no `"use client"`.
- `lib/document-generator.tsx` — `ReciboData` gains **required** properties (T7). Required, not optional, on purpose: this is the repo's own `compile-time-omission-guard` (an omitted field fails `tsc` at the single caller). Its honest limit must be restated in the task report: **a required property pins PRESENCE, never PROVENANCE** — a hardcoded literal at the call site satisfies it (`relocated-coverage-gap`, ATTACK C1).
- No server action, no `app/actions/*` change. No new Supabase table access; the only new queries are `SELECT`s on `pagos`, on the same anon client the page already uses.

---

## 5. UI changes

| Surface | Change |
|---|---|
| `/pagos/registrar` — Monto field | Prefilled with the **live** balance, on both the client-search flow (`handleReservaSelect`) and the `?reserva_id=` flow (`cargarReservaDirecta`, which today prefills **nothing** — AC1.3 is genuinely new behaviour). `0` prefills as `"0.00"`. |
| `/pagos/registrar` — selected-reserva "Balance:" (`:520-528`) | Live value |
| `/pagos/registrar` — search-result row amount (`:564-569`) | Live value |
| `/pagos/registrar` — unknown balance | `"No disponible"` + the Monto field left **blank** (never a fabricated number) |
| `/reservas/crear` — after submit (both branches) | Redirect to `/facturacion/proforma?reserva_id=<id>` |
| `/reservas/crear` — Hora Entrada / Hora Salida | Labels gain `*`; defaults `15:00` / `12:00`; blank blocks submit with a field-naming toast |
| `/facturacion` cards | `"Proforma"` / `"Voucher"` |
| `/facturacion/voucher` `<h1>` | `"Voucher"` |
| RECIBO (a) — printable HTML | + cliente identificación, cliente dirección, reserva código, concepto, registrado por, total abonado, saldo pendiente; company block now from `lib/empresa-info.ts` |
| RECIBO (b) — `PaymentReceipt` dialog | + company header (it has none today), + cliente dirección, + real "Atendido por" |

---

## 6. Edge cases — mapped to where each is handled

| Case | Handling |
|---|---|
| Reserva with **zero** payments | `montosDePagosDeReserva` returns `[]` → balance = `precio_total`. This is the *legitimate* case that must NOT be confused with "unknown" (`stockin-zero-price`, both directions). |
| Reserva **fully paid** (balance `0`) | Prefills `"0.00"`, displays `RD$0.00`. Note: `validateForm` (`app/pagos/registrar/page.tsx:275-278`) rejects `monto <= 0` — so submit is correctly blocked with "Debe ingresar un monto válido". **This is correct behaviour and is NOT changed in this sprint** (out of scope). |
| **Overpaid** reserva (negative balance) | Displayed honestly (e.g. `-RD$50.00`), Monto prefilled `"-50.00"`, submit blocked by the same existing guard. No clamping to 0 — clamping would hide real data. |
| `pagos` fetch **fails** for a reserva | Entry stays `undefined` (distinct from `[]`) → balance renders `"No disponible"`, Monto stays blank, `console.error`. Never silently falls back to `precio_total` — that fallback IS the bug being fixed. |
| Non-numeric / corrupt `monto` | Propagates as `NaN` by design → balance renders `"No disponible"`. Never coerced to `0` (that would fabricate paid money). Pinned by a unit test in T1. |
| Empty state — client with no reservas | Existing "No se encontraron reservas activas" (`:576`) unchanged. |
| Empty state — reserva with no pagos on the RECIBO | Total abonado `0.00`, saldo = total. Correct, not an error. |
| **Concurrent edits** — another user pays while this form is open | The balance is a read-at-load snapshot; it can go stale between load and submit. Pre-existing, unchanged, and **not** made worse (today's number is stale by construction). No locking is added. AC1.5 covers the reopen case. |
| **Realtime races** | Impossible: zero realtime subscribers in the repo (grep-verified). |
| **Rollback** | No optimistic mutation is introduced anywhere, so no rollback-on-error path is owed. Per-task rollback = `git revert <sha>`, **executed in a throwaway clone** and pasted (`assertion-without-verification`, 10th instance). |
| Re-printing an OLD recibo | Shows **today's** saldo/abonado, not the balance at payment time — same as `PaymentReceipt` does today. Documented, not silently changed. Backlog **B-21** if the human wants point-in-time. |
| Reserva status filter on `/pagos/registrar` | `cargarReservasCliente` filters `.in("status", ["CONFIRMADA","ACTIVA","PENDIENTE"])`. `/reservas/ver` computes `PAGADA`/`PARCIAL` **in memory only** and never persists it, so a fully-paid reserva still appears in this list — AC1.2 is reachable. Unchanged. |
| `?reserva_id=` pointing at a deleted/missing reserva | Existing behaviour (`console.error`, nothing selected) unchanged. |

---

## 7. HARD CALLS — surfaced to the human, not decided quietly

**HARD CALL #1 — do annulled payments (`pagos.estado = 'ANULADO'`) still count as paid?**
Today **yes**, everywhere: `/reservas/ver/[id]:180-182` sums *all* pagos with no `estado` filter, and that is the only live "correct" computation in the repo. Adopting an exclusion would be a **money-semantics decision the frozen spec did not make** (it listed ANULADO semantics as a non-goal), and a naive `estado === 'ACTIVO'` filter would *also* drop the real `CONFIRMADO`/`completado` rows documented in §2.1 — a worse bug.
**Ruling for this sprint: sum ALL payments, no `estado` filter, matching the existing live computation exactly**, with a greppable in-code comment in `lib/finance.ts` naming the gap. Filed as backlog **B-19** for a product ruling. *If the human overrules this, it is a one-line change inside `montosDePagosDeReserva` plus new fixtures — deliberately concentrated in one place for exactly that reason.*

**HARD CALL #2 — `abonado_contabilidad` is excluded from "saldo pendiente" on the payment surfaces.**
`lib/finance.ts` offers two shapes: `calcularBalance(total, pagos)` (used by `/reservas/ver`) and `calcularBalanceReserva(total, abonadoContabilidad, pagos)` (used by `/clientes/balance` and CONFIRMACIÓN). They **disagree** whenever `abonado_contabilidad != 0`. The frozen spec pins `precio_total − Σ pagos`, and `/reservas/ver/[id]:184,606-609` treats `abonado_contabilidad` as a **separate fixed accounting field displayed on its own line**. So this sprint calls `calcularBalanceReserva(total, 0, montos)` — same semantics as the spec, plus cent-rounding. The explicit literal `0` must carry an inline comment naming why. **The `/clientes/balance*` pages will therefore continue to show a different number for reservas with a non-zero `abonado_contabilidad`** — pre-existing, out of scope, backlog **B-20**.

**HARD CALL #3 — the jsdom/RTL mount harness is now unblocked, and this sprint still won't build it.**
`relocated-coverage-gap`'s prevention rule says: *"Three accepted relocations is a harness decision, not a backlog line… the next task in that family should be scoped as building it."* Elibry has had four. `jsdom` + `@testing-library/react` + `@vitejs/plugin-react` are **already in `devDependencies`** and `vitest.setup.ts` already imports `@testing-library/jest-dom` — the historical "we don't have a harness" excuse has expired. Building it is nonetheless **outside this frozen spec**, so this plan does not bundle it. Every task whose proof depends on a page component must therefore state, in those words, that **its coverage gap is relocated, not closed**. Filed as **B-23**; the orchestrator should surface it as the cheapest it will ever be to close.

**Flagged, NOT fixed, NEVER bundled (R6):** `lib/document-generator.tsx` is ~1840 lines and T7 makes it longer. The `.claude/rules/file-size.md` breach is real and worsening. Splitting it is backlog **B-1**, its own scoped task. Any task that splits a file FAILS.

---

## 8. Documentation deliverables (the "document" half of check-fix-document)

1. **This plan file** — §7 HARD CALLS, §2 evidence table, §9 backlog. Architect-owned; devs do not edit it.
2. **In-code, T6:** `lib/empresa-info.ts` carries a header comment marked with the literal, greppable token **`PLACEHOLDER-EMPRESA-SETTINGS`**, stating that these values are placeholders pending a Configuración/settings-driven source, that `configuracion_empresa` is doc-only and must not be wired without live verification, and naming the backlog id.
3. **In-code, T1:** the `montosDePagosDeReserva` doc-comment records HARD CALL #1 (ANULADO) and the `estado` value-space finding from §2.1.
4. **T9 deliverable:** `docs/plans/empresa-info-settings-backlog.md` — the standalone write-up of what must be built to move company data into settings.
5. **Sprint close (lead, not a dev task):** file **B-19…B-23** into `MEMORY/project_sprint_state.md` §Backlog, and the §2.3 (`pagos.registrado_por` dead field) + §2.1 (`estado` value space) findings into the CBrain inbox as a fifth `schema-source-of-truth` data point.

---

## 9. Backlog produced by this plan (for the lead to file at sprint close)

| Id | Item |
|---|---|
| **B-19** | Product ruling: should `pagos.estado = 'ANULADO'` be excluded from paid totals? Also: normalise the `estado` value space (`ACTIVO`/`ANULADO`/`CONFIRMADO`/`PENDIENTE`/`completado` all exist in writers). |
| **B-20** | Reconcile `calcularBalance` vs `calcularBalanceReserva` semantics across `/reservas/ver`, `/pagos/*`, `/clientes/balance*`, `/reservas/pendientes`, dashboard — one definition of "saldo pendiente". |
| **B-21** | Point-in-time recibo: store/derive the balance **as of the payment**, instead of today's. |
| **B-22** | `crearRegistroProvisional`'s `max(id)+1` does not advance the `SERIAL` sequence → future collision risk, now user-visible in a URL. |
| **B-23** | Build the jsdom/RTL component-mount harness (deps already installed). Closes `relocated-coverage-gap` instead of relocating it a fifth time. |
| **B-24** | Wire `lib/empresa-info.ts` to a real settings source (see `docs/plans/empresa-info-settings-backlog.md`). Requires live `information_schema` verification first. Note: the **real** company data already exists hardcoded in the VOUCHER/CONFIRMACIÓN footer at `lib/document-generator.tsx:1596-1599` — the two are inconsistent, and a human must choose the canonical values. |
| **B-25** | **Untested edge of `montosDePagosDeReserva`'s coercion contract (found by QA's T1 Mutation C).** The suite does **not** distinguish the shipped `Number(p.reserva_id) === reservaId` matcher from a hypothetical `String()`-based one: a future refactor to `String(p.reserva_id) === String(reservaId)` would stay GREEN while silently diverging on leading-zero string ids (`"07"` vs `7`) and on `null` ids (`null` vs `0`). **The current implementation is CORRECT** — it uses `Number()`, matching the AC's literal spec — so this is an untested edge, not a bug. Deliberately NOT folded into T1 to avoid mid-task scope expansion; a follow-up adds the two discriminating fixtures. |
| **B-1 / B-9** (carried) | File splits (`lib/document-generator.tsx` ~1840 lines, etc.). Each its own scoped task, never bundled. |

---

## 10. Test plan — the exact commands

**Full gate, run at the end of EVERY task (ADR-0003: a gate not actually run is a FAIL):**
```
npm run qa
```
Expect: `tsc --noEmit` clean; `eslint .` → **0 errors, ≤30 warnings** (any increase must be listed and justified); `vitest run` → **≥625 tests, 0 failures** (the corrected pre-sprint baseline at `85eb397` is 28 files / 625 tests; once T1 has landed the floor is **≥633 tests**). Paste the real tail of the output.
*Known trap:* if a `next build` has been run, `.next/types` makes `tsc --noEmit` fail for pages that export helpers (pre-existing, bisected). Run the gate on a tree with no stale `.next/types`, or say so.

**Targeted suites**
```
npx vitest run tests/finance.test.ts                                  # T1, T2, T7, T8
npx vitest run tests/recibo-html.test.ts                              # T7 (AC4.7)
npx vitest run tests/proforma-snapshot.test.ts tests/confirmacion-html.test.ts tests/voucher-html.test.ts   # T7 AC4.8 — byte-freeze
```

**Static / grep proofs**
```
git diff --name-only                                    # scope lock, every task
grep -rn "GEB" --include=*.ts --include=*.tsx .         # T3: filename refs intact, exactly 3 labels changed
grep -rn "PLACEHOLDER-EMPRESA-SETTINGS" .               # T6/T7/T8: >=3 hits (module + both renderers)
grep -rn "balance_general\s*||\|balance_reserva\s*||" app/pagos/registrar/page.tsx   # T2: 0 hits
grep -rniE "ncf|comprobante" lib/document-generator.tsx components/payment-receipt.tsx | grep -i recibo    # T7/T8: 0 hits
grep -c "raw(" <generateReciboHTML body>                # pinned by tests/recibo-html.test.ts:179-189 → 0
```

**Manual checks (no browser automation is connected — every manual result must be labelled as an observed human/dev check, never asserted).** AC1.1–1.5, AC2.1–2.3, AC3.1–3.3, AC4.1–4.6, AC5.1–5.4 need a real click-through. The §8.3-style debt from prior sprints applies: anything not actually observed is reported **UNVERIFIED**, not "passes".

**R4 — the cross-call-site agreement check (QA-owned, mandatory).**
For ONE real reserva with at least one payment, capture the number shown at **all four** places and prove they are identical:
1. `/pagos/registrar` selected-reserva "Balance:"
2. `/pagos/registrar` Monto prefill
3. RECIBO (a) "Saldo Pendiente" via the `/pagos/buscar` download icon
4. RECIBO (b) "Saldo Pendiente" via `/reservas/ver/[id]` → "Recibo"
"A shared helper exists" is **not** acceptable evidence. The type system pins presence, not use.

---

## 11. Task list

> **File-sharing map — two tasks must NEVER run in parallel on the same file:**
> `app/reservas/crear/page.tsx` → **T4 then T5** (strictly sequential).
> Everything else is disjoint: T2 owns `app/pagos/registrar/page.tsx`; T7 owns `lib/document-generator.tsx` + `tests/recibo-html.test.ts` + `app/pagos/buscar/page.tsx`; T8 owns `components/payment-receipt.tsx` + `app/reservas/ver/[id]/page.tsx`; T3 owns the two `app/facturacion/*` files.
> **Universal ACs (apply to every task, in addition to its own):** real diff hunks pasted · `npm run qa` actually run with output pasted · `git diff --name-only` shows **only** the task's declared files · zero DDL / no `scripts/` change / no RLS weakening / **no claim of improved security** · one-line rollback note, **executed in a throwaway clone** with output pasted · no file split, no unrelated tidy-up.

---

### T1 — `lib/finance.ts`: add `montosDePagosDeReserva` (+ tests)
- **Owner:** senior-dev · **Depends on:** none
- **Files in scope:** `lib/finance.ts`, `tests/finance.test.ts`
- **DB/RLS:** none
- **What:** add one pure export to the module that already declares itself the single source of truth for money:
  ```ts
  export interface PagoMontoInput { reserva_id?: number | string | null; monto?: number | string | null }
  export function montosDePagosDeReserva(reservaId: number, pagos: PagoMontoInput[]): number[]
  ```
  Include a pago when `Number(p.reserva_id) === reservaId`; map `monto` with `Number(p.monto)`. **No `estado` filter** (HARD CALL #1) and **no `|| 0` / `?? 0` coercion of `monto`**.
- **Acceptance criteria (PASS/FAIL):**
  1. New tests in `tests/finance.test.ts` cover: empty input → `[]`; string `reserva_id` (`"7"`) matches numeric `7`; string `monto` (`"100.50"`) → `100.5`; a **non-numeric `monto` (`"abc"`) yields `NaN`, NOT `0`**; a pago belonging to a different reserva is excluded; a fixture containing an `estado: "ANULADO"` pago **is included** (pins HARD CALL #1's ruling so a future change is a deliberate, visible edit).
  2. **`stockin-zero-price` (block, never default — BOTH directions), named here because this task owns the rule:** a legitimate `0` monto is kept as `0`, and a genuinely absent/corrupt monto is **never** silently written as `0`. Both directions have their own test.
  3. **`fake-green-tests` anti-pattern #12 (homogeneous fixtures), named here:** the fixture array contains **at least three pagos across at least two different `reserva_id`s**, so a `return pagos.map(...)` that ignores the filter goes RED.
  4. `lib/finance.ts` still has **zero** imports (no Supabase, no React) — `grep -n "^import" lib/finance.ts` returns nothing.
  5. The new function's doc-comment records: the `pagos.estado` value space from §2.1 (`ACTIVO`/`ANULADO`/`CONFIRMADO`/`PENDIENTE`/`completado`), that `scripts/030`'s `status = 'COMPLETADO'` filter matches **no** live column, and HARD CALL #1 + backlog **B-19**.
  6. **`relocated-coverage-gap`, named here:** the task report states, in these words, which of these two mutations the suite can see — (a) a call site stops calling `montosDePagosDeReserva`, (b) a call site calls it and discards the result. If both stay green, the report says **"the gap is relocated, not closed"** and names B-23. Do not score this task as if it closed the call-site gap.
  7. `npm run qa` green; existing `tests/finance.test.ts` cases unchanged.

---

### T2 — Item 1: `/pagos/registrar` shows the CURRENT balance (all 3 surfaces, both load paths)
- **Owner:** senior-dev (money surface) · **Depends on:** T1
- **Files in scope:** `app/pagos/registrar/page.tsx` **(only)**
- **DB/RLS:** none. Two new read-only `SELECT`s on `pagos` via the page's existing `supabase` import.
- **What:**
  - New state `pagosPorReserva: Record<number, number[] | undefined>` (`undefined` = **unknown**, `[]` = **genuinely no payments** — these must stay distinguishable).
  - `cargarReservasCliente`: after the reservas query, one `supabase.from("pagos").select("reserva_id, monto").in("reserva_id", ids)`; on error leave the entries `undefined` and `console.error`.
  - `cargarReservaDirecta`: same for the single reserva, **and prefill `formData.monto`** (it prefills nothing today).
  - One local `balanceVigenteDeReserva(reserva): number | null` using `calcularBalanceReserva(Number(reserva.precio_total), 0, montosDePagosDeReserva(...))`; returns `null` when the entry is `undefined` or the result is not finite.
  - All three surfaces (`handleReservaSelect` `:254`, selected-reserva Balance `:522-527`, search-row amount `:565-568`) read that ONE function.
  - Monto prefill = `balance.toFixed(2)`; when `null`, Monto is left **blank**.
- **Acceptance criteria (PASS/FAIL):**
  1. **AC1.1** A reserva with `precio_total = X` and payments summing `Y` (0 < Y < X) prefills **X−Y**. Observed, with the real numbers pasted.
  2. **AC1.2** A fully-paid reserva prefills **`0.00`**, not X. **`stockin-zero-price`, named here: `0` is a real value, not "unset" — the falsy-`0` fallthrough at `:254` and `:523` is literally the bug. `grep -n "balance_general ||" app/pagos/registrar/page.tsx` must return 0 hits, and no `|| precio_total` fallback may survive anywhere in the file.**
  3. **AC1.3** Both of the above hold when the page is opened as `/pagos/registrar?reserva_id=<id>` (the `cargarReservaDirecta` path), which must now prefill Monto at all.
  4. **AC1.4** All three displayed numbers agree for the same reserva — proven by the fact that exactly ONE function computes them (`grep -c "balanceVigenteDeReserva" ` ≥ 4: 1 definition + 3 uses) **and** by an observed screenshot/read of all three.
  5. **AC1.5** After registering a payment and re-opening the page, the balance is reduced by exactly that amount. Observed, before/after numbers pasted. This is the proof it is not a snapshot.
  6. A reserva with **zero** payments shows `precio_total` (not "No disponible"), and a reserva whose `pagos` read failed shows **"No disponible"** with a blank Monto. Both directions observed or, if the failure path cannot be induced, the code path is shown in the diff and labelled **UNVERIFIED — failure branch not exercised**.
  7. `git diff --name-only` = exactly `app/pagos/registrar/page.tsx`. **The non-goals are restated as a gate: no change to `/reservas/pendientes`, the reserva list, the dashboard, `/clientes/balance*`, or `validateForm`.**
  8. **`schema-source-of-truth`, named here:** no new column name is invented. `reserva_id` and `monto` on `pagos` are corroborated by the existing live write site `app/pagos/registrar/page.tsx:308-320`. No `status` column is referenced.
  9. `npm run qa` green; lint warnings ≤ 30 (if a new `react-hooks/exhaustive-deps` warning appears, list it and follow the page's existing pattern).

---

### T3 — Item 3: remove "GEB" from the 3 user-visible labels
- **Owner:** junior-dev · **Depends on:** none (fully independent; can run any time)
- **Files in scope:** `app/facturacion/page.tsx`, `app/facturacion/voucher/page.tsx`
- **DB/RLS:** none
- **Acceptance criteria:**
  1. **AC3.1/3.2** `app/facturacion/page.tsx:309` → `Proforma`; `:319` → `Voucher`. Exact strings, no trailing space.
  2. **AC3.3** `app/facturacion/voucher/page.tsx:874` `<h1>` → `Voucher`.
  3. **AC3.4** `git diff` shows **exactly 3 changed string lines, in 2 files**. Then `grep -rn "GEB" --include=*.ts --include=*.tsx .` still shows every filename reference intact: `lib/voucher-data.ts:10`, `lib/document-generator.tsx:66,141,250,1017`, `app/actions/documentos-actions.ts:674`, `tests/voucher-html.test.ts:38,172,250,267,401`. Paste the grep.
  4. **`reproduce-and-flag`, named here: `docs/VOUCHER GEB-2.docx` / `docs/CONFIRMACION GEB.docx` and every code comment or test title naming them are SOURCE-OF-TRUTH references. Renaming any of them breaks the traceability chain and is an automatic FAIL.** (Expect one unrelated false positive: a base64 substring at `package-lock.json:871`.)
  5. The subtitle at `app/facturacion/voucher/page.tsx:876` and the dashboard's known-stale "voucher de pago" copy are **not** touched.
  6. `npm run qa` green; `tests/voucher-html.test.ts` unchanged and passing.

---

### T4 — Item 5: Hora Entrada / Salida required + defaulted
- **Owner:** junior-dev · **Depends on:** none · **SHARES A FILE WITH T5 — must complete and merge before T5 starts**
- **Files in scope:** `app/reservas/crear/page.tsx` **(only)**
- **DB/RLS:** none (`hora_entrada` / `hora_salida` already written at `:440-441`)
- **What:** (1) `:908` → `Hora Entrada *`, `:922` → `Hora Salida *`; (2) `:119-120` → `horaEntrada: "15:00"`, `horaSalida: "12:00"`; (3) a blank-check guard **immediately after** the existing fecha check (`:352-359`), copying its exact toast shape.
- **Acceptance criteria:**
  1. **AC5.1** Both labels render `*`, matching the sibling `Fecha Entrada *` (`:853`) / `Fecha Salida *` (`:878`) convention.
  2. **AC5.2** On a fresh load, before any interaction, the inputs hold `15:00` / `12:00` and the existing hint line (`:915-919`, `:929-933`) shows **3:00 PM / 12:00 PM** in 12h mode. (`formatTimeWithPreference("15:00", false) === "3:00 PM"`, `components/time-format-toggle.tsx:49-64`.)
  3. **AC5.3** Clearing either field blocks submit with a toast that **names the field**, and the guard sits **above** every `supabase.insert` in the diff. The reserva count is unchanged: run a live `select count(*)` before/after if DB access exists, otherwise state **UNVERIFIED — pending DB access** and prove it statically from the diff (the `return` precedes the insert).
  4. **AC5.4** A user-edited time saves the user's value, not the default — verified by reading back the created row (or the captured insert payload), not by reading the code.
  5. **AC5.5 / `stockin-zero-price`, named here: a default is legitimate ONLY on a NEW form and must NEVER override a stored value. `app/reservas/editar/[id]/page.tsx` is NOT in scope and must NOT appear in `git diff --name-only`** — its `""` initial state is overwritten from `reservaData.hora_entrada || ""` at `:315-316`, so it keeps showing the stored value or blank. Confirm by opening an existing reserva for edit and observing that `15:00` is **not** injected.
  6. No other validation in `handleSubmit` is altered; the existing cliente/producto/fechas/servicios checks are byte-identical in the diff.
  7. `npm run qa` green.

---

### T5 — Item 2: redirect reserva creation to the PROFORMA deep link
- **Owner:** junior-dev · **Depends on:** **T4 (same file — never run in parallel)**
- **Files in scope:** `app/reservas/crear/page.tsx` **(only)**
- **DB/RLS:** none
- **What:** change the destination in **both** `setTimeout` blocks — admin `:545-547` → `` `/facturacion/proforma?reserva_id=${reservaCreada.id}` ``; provisional `:606-608` → `` `/facturacion/proforma?reserva_id=${result.data.id}` ``. Keep the 2000 ms delay and the surrounding structure unchanged. Guard the provisional id: if `result.data?.id` is missing, keep `/reservas/pendientes` **and** show a toast saying the proforma could not be opened — **never fabricate an id**.
- **Acceptance criteria:**
  1. **AC2.1** Admin submit navigates to `/facturacion/proforma?reserva_id=<the new id>`. Observed URL pasted.
  2. **AC2.2** Non-admin/provisional submit navigates to the same pattern with the real id. **The id IS available** — `crearRegistroProvisional` inserts into the real `reservas` table and returns the row (`lib/provisional-system.ts:150,170`), and the page already uses `result.data.id` at `:558` and `:574`. Nothing is fabricated. If `result.data?.id` is absent, the fallback branch above fires.
  3. **AC2.3** Landing there opens the existing pre-selected dialog (not a blank list). This exercises the **existing** contract only: `resolverReservaDeepLink` (`lib/deep-link-reserva.ts:31-46`) + the effect at `app/facturacion/proforma/page.tsx:314-334`, whose reserva list is an unfiltered `select("*")` (`:156-159`) → PROVISIONAL and PERMANENTE resolve identically. **`lib/deep-link-reserva.ts` and `app/facturacion/proforma/page.tsx` must NOT appear in `git diff --name-only`.**
  4. The URL string shape is byte-identical to the existing producers (`app/reservas/ver/[id]/page.tsx:365`, `app/reservas/pendientes/page.tsx:1019`).
  5. **`premature-success-signal`, named here: the redirect and its success toast must stay INSIDE the branch that runs after the write resolves** — admin after the `insert(...).select().single()` returns without error, provisional after `result.success`. Moving either earlier (e.g. optimistically before the await) is an automatic FAIL. Show the diff context proving the ordering is unchanged.
  6. Both `setTimeout(..., 2000)` wrappers survive; the diff is 2 destination strings + the id guard, nothing else.
  7. `npm run qa` green.

---

### T6 — New `lib/empresa-info.ts`: one documented PLACEHOLDER company source
- **Owner:** junior-dev · **Depends on:** none
- **Files in scope:** `lib/empresa-info.ts` (**new**)
- **DB/RLS:** none. **Explicitly forbidden: any read of `configuracion_empresa` or any other table.**
- **What:** a pure module exporting `EmpresaInfo` (`nombre`, `direccion`, `telefono`, `email`) and `EMPRESA_PLACEHOLDER`, whose values are **byte-identical** to today's literal at `app/pagos/buscar/page.tsx:198-203`.
- **Acceptance criteria:**
  1. The four values are copied **verbatim** — `"Grupo Ellibry"`, `"Santo Domingo, República Dominicana"`, `"(809) 123-4567"`, `"info@grupoellibry.com"`. **The human ruled the placeholder VALUES stay as they are: inventing, "correcting", or importing real company data in this task is an automatic FAIL.**
  2. The header comment contains the literal token **`PLACEHOLDER-EMPRESA-SETTINGS`** and states: these are placeholders pending a Configuración/settings-driven source; backlog **B-24**.
  3. **`schema-source-of-truth`, named here:** the comment records that `configuracion_empresa` appears **only** in `CLAUDE.md:134,192` and `docs/plans/recibo-escape-and-input-guards.md:684` and is read by **zero** code paths, and that wiring it requires live `information_schema` verification this sprint does not have. `grep -rn "configuracion_empresa" lib/ app/ components/` must return **0 hits** after this task.
  4. The module is pure: no `import` of Supabase or React, no `"use client"`, no function that performs I/O. `grep -n "^import" lib/empresa-info.ts` → nothing.
  5. Under 60 lines. `npm run qa` green (an unused-export warning is acceptable until T7/T8 land; report it if it appears).

---

### T7 — Item 4(a): fortify `generateReciboHTML` + its caller
- **Owner:** senior-dev · **Depends on:** T1, T6
- **Files in scope:** `lib/document-generator.tsx`, `app/pagos/buscar/page.tsx`, `tests/recibo-html.test.ts`
- **DB/RLS:** none. No new query — `app/pagos/buscar/page.tsx:77-99` already loads **all** `pagos`, `reservas`, `clientes`, `productos` into state.
- **What:**
  - `ReciboData` gains **required** fields: `cliente.identificacion`, `reserva.codigo`, `pago.concepto`, `pago.registradoPor`, `reserva.totalAbonado`, `reserva.saldoPendiente`. `cliente.direccion` already exists and is a **confirmed dead field** — start rendering it.
  - `generateReciboHTML` renders all of the above **inside the existing `html` template**, and its company block reads `EMPRESA_PLACEHOLDER`.
  - `regenerarRecibo` (`:152-221`) supplies them: `codigo` from `reservaData.codigo`; `concepto` from `pago.concepto`; **`registradoPor` from `pago.usuario`** (§2.3 — `pagos.registrado_por` has no writer anywhere in the repo); `totalAbonado` = `calcularMontoPagado(0, montos)` and `saldoPendiente` = `calcularBalanceReserva(Number(reservaData.precio_total), 0, montos)` where `montos = montosDePagosDeReserva(pago.reserva_id, pagos)` from the already-loaded state.
  - `getClienteData` (`:115-138`) returns the real `cliente.direccion` instead of the hardcoded `"Dirección no disponible"`; the local `Cliente`/`Pago` interfaces gain `direccion?` / `usuario?`.
  - The company literal at `:198-203` is deleted in favour of the import.
- **Acceptance criteria:**
  1. **AC4.2** Rendered HTML contains the client's identificación **and** dirección.
  2. **AC4.3** Contains the reserva **`codigo`** (the existing numeric `numero` stays too).
  3. **AC4.4** Contains `pago.concepto` and the registering user. **`schema-source-of-truth`, named here: the value MUST come from `pagos.usuario`** (written at `app/pagos/registrar/page.tsx:318`, `app/reservas/crear/page.tsx:531,565`); using `pagos.registrado_por` is an automatic FAIL — grep proves it has no writer. When the value is genuinely absent, render an honest marker, **never a fabricated actor name**.
  4. **AC4.5** Contains Total Abonado and Saldo Pendiente computed via `lib/finance.ts` — `grep -n "balance_general\|balance_reserva" app/pagos/buscar/page.tsx` returns **0 hits** in the recibo path.
  5. **AC4.7** `tests/recibo-html.test.ts` extends the **existing hostile-fixture pattern**: each new field carries a **DISTINCT** hostile payload (not a copy of an existing one — `fake-green-tests` #12, homogeneous fixtures), and the suite asserts each escapes exactly. The `raw(`-count static guard at `:179-189` still yields **0**. **Any raw interpolation reopens the 2026-07-27 stored-XSS fix and is an automatic FAIL.**
  6. **AC4.8** `git diff lib/document-generator.tsx` shows hunks **only** inside `interface ReciboData` and `export function generateReciboHTML`. `generateProformaHTML` / `generateConfirmacionHTML` / `generateVoucherDocHTML` and the company footer at `:1596-1599` have an **EMPTY diff**, and `tests/proforma-snapshot.test.ts`, `tests/confirmacion-html.test.ts`, `tests/voucher-html.test.ts` pass unchanged. Paste the run.
  7. **FISCAL CONSTRAINT (hard):** no NCF, no comprobante-fiscal number, no client-invoice linkage. `grep -rniE "ncf|comprobante" ` over the diff → 0 hits. `comprobantes_fiscales` untouched. **ADR-0012's rejected alternatives (fabricate a fiscal number; build client invoicing inline) are off the table.**
  8. `EMPRESA_PLACEHOLDER` is imported, not re-declared; `grep -n "Grupo Ellibry" app/pagos/buscar/page.tsx` → 0 hits.
  9. **R6, named here: `lib/document-generator.tsx` is ~1840 lines and this task makes it longer. That is FLAGGED, NOT FIXED. Splitting it (backlog B-1) inside this task is an automatic FAIL.**
  10. **`relocated-coverage-gap`:** the report states which of these the suite sees — (a) `regenerarRecibo` stops calling `calcularBalanceReserva`, (b) it calls it and passes a hardcoded number. If neither goes RED, say **"the gap is relocated, not closed"** and name B-23. `ReciboData`'s new required fields buy **presence, not provenance**.
  11. `npm run qa` green; test count rises by the number of new cases.

---

### T8 — Item 4(b): `PaymentReceipt` gains the company header + the missing fields
- **Owner:** senior-dev · **Depends on:** T1, T6
- **Files in scope:** `components/payment-receipt.tsx`, `app/reservas/ver/[id]/page.tsx`
- **DB/RLS:** none
- **What:**
  - `PaymentReceipt` renders a company header from `EMPRESA_PLACEHOLDER` (it has **none** today), adds `cliente.direccion` (same conditional style as the existing `identificacion` block at `:200-205`), and renders the registering user from a real value.
  - The prop type gains `cliente.direccion?` and renames/repoints the attribution to the populated column.
  - `app/reservas/ver/[id]/page.tsx`: pass `direccion` (from the already-loaded `cliente`) and `usuario` (instead of `selectedPago.registrado_por` at `:940`); and replace the inline arithmetic at `:179-191` with `calcularMontoPagado(0, montos)` / `calcularBalanceReserva(precioTotal, 0, montos)` using `montosDePagosDeReserva`.
- **Acceptance criteria:**
  1. **AC4.6** The dialog shows the same company block as renderer (a), from the same module. `grep -rn "PLACEHOLDER-EMPRESA-SETTINGS\|EMPRESA_PLACEHOLDER" components/ app/` shows both renderers importing the single source.
  2. **AC4.2** Client dirección renders (conditionally, matching the component's existing `identificacion` pattern). **`schema-source-of-truth`, named here: `clientes.direccion` is corroborated by real write sites (`app/clientes/registrar/page.tsx:180`, `app/clientes/editar/page.tsx:272`) and read sites (`app/clientes/ver/page.tsx:231`), but is NOT `information_schema`-verified — null-guard it and label the claim that way in the report.**
  3. **AC4.4** "Atendido por" shows the real registering user from **`pagos.usuario`**, never `pagos.registrado_por` (dead field, §2.3). When genuinely absent, render an honest marker — **`stockin-zero-price`, named here: do NOT substitute a fabricated actor such as `"Sistema"` for a missing required attribution.**
  4. **AC4.5** Saldo Pendiente / Total Abonado / Total Reserva come from `lib/finance.ts`. In `app/reservas/ver/[id]/page.tsx` **only the three numeric assignments at `:189-191` change** — the `status:` ternary at `:193-198` and everything else in that block are byte-identical in the diff.
  5. **R4 (mandatory):** for ONE real reserva, renderer (a) and renderer (b) print the **identical** Saldo Pendiente and Total Abonado. Both observed values pasted. "They call the same helper" is **not** acceptable evidence.
  6. **FISCAL CONSTRAINT (hard):** no NCF / comprobante / invoice linkage added. Grep over the diff → 0 hits.
  7. `git diff --name-only` = exactly those 2 files. `/reservas/ver/[id]`'s document entry-point buttons (`:365`, `:374`), the pagos table, and the detalles sections are untouched.
  8. **`relocated-coverage-gap`:** state whether anything forces this call site to keep using `lib/finance.ts`. If not, say **"the gap is relocated, not closed"** and name B-23.
  9. `npm run qa` green; warnings ≤ 30.

---

### T9 — Document the placeholder-company-data → settings path
- **Owner:** junior-dev · **Depends on:** T6 (documents what actually shipped)
- **Files in scope:** `docs/plans/empresa-info-settings-backlog.md` (**new**) — **no source file may appear in `git diff --name-only`**
- **DB/RLS:** none
- **Acceptance criteria:**
  1. The document states which four values are placeholders, quotes their exact current strings, and names `lib/empresa-info.ts` as the single source plus its two consumers (with real paths).
  2. It records the **conflict** the human must resolve: real company data already exists hardcoded in the VOUCHER/CONFIRMACIÓN footer at `lib/document-generator.tsx:1596-1599` (address, phones, RNC 132739622, email) and does **not** match the recibo placeholders. It does **not** decide which is canonical — that is a human ruling.
  3. **`schema-source-of-truth`, named here:** it states that `configuracion_empresa` is referenced **only** in `CLAUDE.md:134,192` and `docs/plans/recibo-escape-and-input-guards.md:684`, is read by **zero** code, and **must not** be assumed to exist — any settings work starts with a live `information_schema` query. It proposes no schema as fact.
  4. It lists the concrete follow-up work as backlog **B-24** (settings table or `parametros_sistema` reuse — *both marked UNVERIFIED*; a Configuración UI; the read path; who may edit).
  5. It contains **no** invented company data and **no** fabricated column names.
  6. `npm run qa` green (a docs-only change must not move any number).

---

## 12. Dependency graph

```
T1 (lib/finance) ─┬─> T2  (item 1: /pagos/registrar)
                  ├─> T7  (item 4a: RECIBO html)   <─┬─ T6 (lib/empresa-info)
                  └─> T8  (item 4b: PaymentReceipt) <┘
T6 ─> T9 (documentation)
T4 (item 5: horas) ─> T5 (item 2: redirect)     [SAME FILE — strictly sequential]
T3 (item 3: GEB)  — independent, any time
```
Suggested commit order: **T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9.** One task at a time; T(n+1) does not start until T(n) has a quoted QA report with `Verdict: PASS`.
