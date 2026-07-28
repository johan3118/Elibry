# GEB Documents — Real Data for CONFIRMACIÓN DE SERVICIOS & VOUCHER

**Slug:** `geb-documents-real-data`
**Author:** architect
**Spec:** frozen (Part 1) + human-decided amendment (Part 2, OQ1/OQ2/OQ3)
**Status:** plan for lead delegation — no code written by architect
**Amended:** HC-2 and HC-3 ruled by the human; T5, T7, §3, §4, §5, §9, §10, §13 updated in place. Task numbering and dependencies unchanged (T1..T16).
**Amended (2):** HC-4 ruled after QA found the occupancy-save orphaning defect. New task **T2b** inserted after T2 (no renumbering); §7, §8, §9, §10, §13 updated; T12/T15 dependencies tightened.
**Amended (3):** HC-5 ruled after QA found that the sprint removes HTML escaping without replacing it. New task **T6b** inserted between T6 and T8 (no renumbering); §0, §1, §3, §7, §8, §9, §10, §13 updated; T9, T10, T13, T14 amended.
**Amended (4):** T14 AC-1 ruled by the **lead** after the dev proved with `npx tsc --noEmit` that an in-place rewrite hard-breaks the two call sites in `app/facturacion/voucher/page.tsx` (`:305`, `:358`) — a file outside T14's scope, on a whole-project typecheck. T14 now ships **`generateVoucherDocHTML(data: VoucherDocData)` alongside the untouched legacy `generateVoucherHTML(data: VoucherData)`**, mirroring the split this plan already pre-authorized at **T3 AC-4** for the CONFIRMACIÓN side. **T15's file scope and acceptance criteria are amended to retire the legacy function and type in the same task.** No change to `VoucherDocData`'s contract, to T13's compile-time money-free guarantee, or to HC-5's escaping rule — only the exported name the new function carries during a one-task gap. §0, §1, §3, §5, §7, §8, §9, §10, §12, §13, T14 and T15 updated. **Architect's note: this corrected a defect in my task boundary, not in the ruling — see §9 "T14 split (Amended 4)".**

---

## 0. Grounding: what the code actually says

Everything below was read, not inferred. `CLAUDE.md` is stale in at least one place (it claims Next.js 15; `package.json:57` pins `"next": "14.2.25"`).

| Claim | Verified at |
|---|---|
| `generateProformaHTML` fabricates 3 IDs | `lib/document-generator.tsx:285-287` (`Math.floor(Math.random() * 9000) + 1000` ×3) |
| Hardcoded `CÉDULA/RNC: N/A` | `lib/document-generator.tsx:713` |
| CHECK IN/OUT = `new Date()` / +3 days | `lib/document-generator.tsx:729-732` |
| `HORA ENTRADA/SALIDA` hardcoded `03:00 PM` / `12:00 PM` | `lib/document-generator.tsx:735-738` |
| `HABITACIONES: 1` hardcoded | `lib/document-generator.tsx:753` |
| Placeholder observaciones | `lib/document-generator.tsx:760` |
| `MONTO PAGADO: 0.00` hardcoded | `lib/document-generator.tsx:820` |
| Fake ×58 FX standing in for BALANCE GENERAL | `lib/document-generator.tsx:832-853` |
| Empty passenger line `1)` | `lib/document-generator.tsx:872` |
| `Bryan Méndez` / `ATEB` hardcoded | `lib/document-generator.tsx:878-881` |
| Policies block has only 3 paragraphs, one with a drifted clause `...gastos 100% o se cancela automáticamente` | `lib/document-generator.tsx:856-868` |
| `direccion: "Dirección no disponible"` ignores real `clientes.direccion` | `app/facturacion/proforma/page.tsx:254` |
| Synthetic single-line-item fallback when zero `reserva_detalles` | `app/facturacion/proforma/page.tsx:344-351` |
| `applyEditableProformaData` regex post-processor | `app/facturacion/proforma/page.tsx:110-159` |
| `generateVoucherNumber()` = date + `Math.random()`, never persisted | `app/facturacion/voucher/page.tsx:225-234`, called at `:209` |
| Voucher random localizador fallback in the generator too | `lib/document-generator.tsx:90` |
| `noches ... : 3` fallback | `lib/document-generator.tsx:117` |
| Voucher CHECK IN/OUT hardcode `03:00 PM` / `12:00 PM` | `lib/document-generator.tsx:258, 263` |
| `habitacion: "STANDARD"`, `regimen: "TODO INCLUIDO"` | `app/facturacion/voucher/page.tsx:213-214` |
| Voucher leaks money today (`reserva.total` → `fmtMoney`) | `lib/document-generator.tsx:228-230`, `VoucherData.reserva.total` at `:12` |
| Voucher fabricates `cliente@email.com` and `"Dirección del cliente"` | `app/facturacion/voucher/page.tsx:274-275, 327-328` |
| **The two voucher call sites T14 must not break** | `app/facturacion/voucher/page.tsx:305, 358` — both pass the page's own structurally incompatible object literal (Amended 4) |
| Voucher `DIRECCIÓN` row prints the **client's** direccion, `TELÉFONO` prints the **agency's** phone | `lib/document-generator.tsx:199, 203` — both wrong per the .docx, which wants the hotel's |
| Exactly two consumers of the generators | `app/facturacion/proforma/page.tsx:24`, `app/facturacion/voucher/page.tsx:30` |

**Data layer / schema (real):**

- Supabase browser client: `lib/supabase.ts` — a lazy `Proxy` over `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`. Exported as both `createClient()` and `supabase`. **Anon key only.**
- Supabase privileged client: `lib/supabase-server.ts` — `SUPABASE_SERVICE_ROLE_KEY`, same Proxy pattern.
- Existing privileged-write convention: `app/actions/crm-actions.ts` (`"use server"`, service-role client, returns `{ success, error, data }`). Consumed from client components at `app/clientes/editar/page.tsx:18`, `app/suplidores/registrar/page.tsx:16`, `app/crm/casos/page.tsx:28`. **This is the repo's existing pattern for server-side writes — the plan reuses it, it does not invent one.**
- `reservas` columns confirmed present: `hora_entrada`, `hora_salida` (`scripts/001-create-tables.sql:103-104`, `TIME`), `pasajeros`, `habitaciones`, `abonado_contabilidad`, `atendido_por`, `referido_por`, `nota_interna_reserva`, `fecha_creado`, `moneda`, `precio_total` (`lib/supabase.ts:189-229`).
- `reserva_detalles`: `scripts/023-create-reserva-detalles-table-fixed.sql` — `concepto`, `descripcion`, `precio_unitario`, `descuento`, `total`, `noches`, `pasajeros`, `habitaciones`. **Has a trigger `recalcular_totales_reserva()` (`:49-113`) that rewrites `reservas.precio_total = SUM(detalles.total)`, `descuento = SUM(...)`, `pasajeros = SUM(...)`, `habitaciones = SUM(...)` on every insert/update/delete of a detalle.**
- `pagos`: `scripts/024-create-pagos-table.sql` — `reserva_id`, `cliente_id`, `monto`, `fecha_pago`.
- `productos.direccion` and `productos.suplidor_id` exist (`lib/supabase.ts:152-167`); `suplidores.telefono` exists (`lib/supabase.ts:136-150`). **Confirms the spec's correction: no new columns for hotel address/phone.**
- **`/clientes/balance` formula, verbatim** (`app/clientes/balance/page.tsx:75-90`):
  `balanceReserva = Number(precio_total)||0 − Number(abonado_contabilidad)||0 − Σ(Number(pago.monto)||0)`, bucketed `(reserva.moneda || "DOP") === "USD" ? balance_usd : balance_rdp`.
- `/reservas/ver/[id]` uses a **different** formula (`app/reservas/ver/[id]/page.tsx:177-191`). Per spec, **not touched** — Risk R4.
- **Audit surface (HC-3 amendment):** `auditoria` is a real table at `scripts/001-create-tables.sql:158-167` — `id, tabla, registro_id, accion VARCHAR(20) NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')), datos_anteriores JSONB, datos_nuevos JSONB, usuario VARCHAR(100) NOT NULL, fecha TIMESTAMPTZ DEFAULT NOW()`. **No application code writes to it.** A repo-wide grep for `.from("auditoria"|"audit_logs"|"logs"|"performance_metrics")` returns exactly one hit, commented out (`app/logs/page.tsx:108`). `lib/admin-actions.ts` writes `acciones_pendientes`, an approval **queue**, not an audit log. `app/logs/auditoria/page.tsx` contains no Supabase call at all.
- **Shipped in T1 (re-read for HC-4) — `scripts/061-create-reserva-pasajeros-ocupaciones.sql`:** `reserva_ocupaciones` carries **`UNIQUE (reserva_id, orden)`** (`:69`) and `UNIQUE (id, reserva_id)` (`:70`). `reserva_pasajeros` carries `UNIQUE (reserva_id, orden)` (`:83`) and the composite FK `FOREIGN KEY (ocupacion_id, reserva_id) REFERENCES reserva_ocupaciones (id, reserva_id) ON DELETE SET NULL (ocupacion_id)` (`:84-86`). **`orden` is unique within a reserva at any instant, but it is a render position — nothing prevents a later save from placing a materially different room at the same `orden`. That distinction is the whole of HC-4.**
- **Shipped in T2 — `app/actions/documentos-actions.ts`:** `reemplazarConjuntoConRestauracion` (`:198-245`) is the shared delete-then-insert helper for both tables; it captures `filasOriginales` internally (`:204-207`) but **does not expose them**. `guardarOcupacionesReservaAction` (`:409-466`) captures passenger links at `:422-431` and re-links **only** on the `restored: true` branch (`:444-447` returns early on success). `relinkPasajerosRestaurados` (`:363-377`) issues one UPDATE per link and **returns on the first error**.
- **Shipped in T6 (re-read for HC-5) — `lib/document-generator.tsx`:** the file now holds four generators — `generateVoucherHTML` (`:91`, legacy), `generateProformaHTML` (`:285`, legacy, byte-frozen by T3's baseline), **`generateConfirmacionHTML` (`:963`, new)**, and `generateReciboHTML` (`:1597`). T3 AC-4's split fallback fired. **A grep for `escapeHtml|sanitize|DOMPurify` across the whole file returns NOTHING.** `generateConfirmacionHTML` interpolates free text raw at `:1428` (`nombre`), `:1431` (`cedulaRnc`), `:1434` (`email`), `:1437` (`whatsapp`), `:1444` (`servicio`), `:1465` (`facturaNumero`), `:1478` (`observaciones`), `:1496` (`linea.descripcion`), `:1497` (`nombre` again, inside `<small>TITULAR:`), `:1552` (`p.nombreCompleto`), `:1558` (`atendidoPor`), `:1561` (`referidoPor`). The **only** `escapeHtml` in the repo is `app/facturacion/proforma/page.tsx:97-103`, used solely by `applyEditableProformaData` (`:117, 125, 138, 146, 154`) — the post-processor **T9 deletes**. `openDocumentInNewWindow` (`:1806`) writes the result into a new window as an executable document. This is HC-5.
- **Typecheck surface (established by the Amended-4 ruling):** `tsconfig.json` includes the whole project, so `npm run qa`'s `tsc --noEmit` step type-checks **every** file regardless of which file a task is allowed to edit. **A signature change in `lib/document-generator.tsx` therefore fails the gate at consumer files a task may not touch.** This is the mechanical fact that forces the split at T14 exactly as it did at T6.
- Test infra real: `package.json:11-12` → `test: "vitest run"`, `qa: "npm run typecheck && npm run lint && npm run test"`. `vitest.config.ts` → `environment: "node"`, `globals: true`, alias `@` → repo root. 18+ test files under `tests/`.

**Two findings the spec did not anticipate — both change the plan:**

### F1 — `comprobantes_fiscales` has no migration matching what the app writes
`scripts/038-create-comprobantes-fiscales-table.sql` creates a **supplier-invoice** table with **no `reserva_id` and no `numero_factura`**. `scripts/039-create-comprobantes-disponibles-table.sql:2` then does `DROP TABLE IF EXISTS comprobantes_fiscales CASCADE`. Meanwhile `app/facturacion/fiscal/page.tsx:54-70, 634, 680` inserts `{ reserva_id, cliente_id, ncf, numero_factura, propina_legal, … }` — a schema that exists **only in production, created out of band**, with the read error silently swallowed (`:142-143`: `if (facturasError) {}`).
→ The `FACTURA #` read is against an **unverified schema**. Per HC-2 it gets its own senior task that verifies the shape at runtime and **BLOCKS** on any failure. Related pre-existing fiscal defect (out of scope, logged as B-4): `generateNCF` at `:200-203` mints NCFs with `Math.random()`.

### F2 — Elibry has no authentication. Every browser query runs as PostgREST `anon`.
`lib/user-context.tsx:23-38` is a **hardcoded array of two users** checked client-side and stored in `localStorage`. `components/auth-guard.tsx` only redirects. `middleware.ts` passes everything through. There is **zero** `supabase.auth.*` usage in the repo. And a repo-wide grep for `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` across all 60 files in `scripts/` returns **nothing** — no table in this database has RLS.
→ **OQ3's literal instruction would break the feature on delivery**: with RLS on and a policy scoped `TO authenticated`, the app — which is `anon` — gets zero rows and failed inserts, while QA's anonymous probe passes. A textbook fake-green. Resolution: Approach C. Escalated as HC-1; **acknowledged by the human and explicitly out of scope** — Approach C stands.

---

## 1. Architecture Reasoning (show your work)

```
Invariants in play + existing mechanism each follows:
- Fiscal integrity. comprobantes_fiscales is READ-ONLY this sprint. No allocation,
  no renumbering, no writes. The write path (app/facturacion/fiscal/page.tsx:634) is
  on the must-not-touch list.
- Money math single-source. lib/finance.ts is the only place balances are computed for
  these documents; the new helpers are pinned by test to /clientes/balance's formula.
- Server/client boundary. Service-role access stays behind "use server" modules in
  app/actions/*, exactly as app/actions/crm-actions.ts does today.
- NO NET LOSS OF PROTECTION. A refactor may MOVE a safeguard but may never DELETE one
  without an equivalent already landed — and the replacement must land BEFORE the code
  path that needs it goes live. HC-5 is this invariant being enforced: T6b ships the
  escaping and BLOCKS T8.
- A TASK'S FILE SCOPE MUST BE CLOSED UNDER THE GATE IT MUST PASS. tsc --noEmit covers
  the whole project, so a task that changes an exported signature owns every consumer of
  it — or it must not change the signature. When the consumer belongs to a later task,
  the answer is to ADD the new export and RETIRE the old one in the task that owns the
  consumer. T6 did this by design; T14 must too (Amended 4). Promoted to an invariant
  because I failed to apply it symmetrically the first time.
- Trigger safety. scripts/023's recalcular_totales_reserva() owns reservas.precio_total,
  descuento, pasajeros, habitaciones. New tables are siblings, not participants.
- Return values never assert a state that is not true. Three send-backs in this sprint
  came from exactly one root cause: a return value claiming more than the code achieved.
- Optimistic UI / realtime: NOT IN PLAY. Grepped — no supabase.channel, no
  postgres_changes anywhere; both document pages are load-then-render.
- Purity of the document builders. lib/confirmacion-data.ts and lib/voucher-data.ts stay
  free of Supabase imports so their tests run offline (patterns/port-and-in-memory-fake).
  They are also TRANSPORT-AGNOSTIC: they carry raw domain values, never HTML-encoded
  ones (HC-5). Escaping is a property of the RENDERER, not of the data.

Approaches considered + trade-offs + choice & why:

  The primary fork is the RLS posture (finding F2), not the rendering.

  A) Ship RLS + policy "TO authenticated" as OQ3 literally says.
     DEAD ON ARRIVAL: the app is anon; zero rows read, every insert fails, while the
     anon probe goes green. mistakes/fake-green-tests as a deployment. REJECTED.
  B) Ship RLS + a permissive "TO anon, authenticated USING (true)".
     App works, but OQ3's criterion becomes unmeetable and the new table is
     world-writable with the public key. REJECTED.
  C) [CHOSEN — human-confirmed at HC-1] RLS enabled + a named policy TO authenticated
     (nothing to anon), AND all access routed through "use server" actions on the
     service-role client — the pattern already in app/actions/crm-actions.ts. The only
     option where OQ3's probe is a REAL gate rather than theater.

  Secondary fork: extend ProformaData in place vs. a parallel type.
     Chosen: a new pure module lib/confirmacion-data.ts (type + validating builder).

  Third fork (HC-3): where the discrepancy log is persisted.
     Chosen: the EXISTING `auditoria` table, accion CHECK widened by one value. §4.3.

  Fourth fork (HC-4): the identity key for re-linking passengers to occupancy rows.
     Chosen: the material tuple (orden, ocupacion, categoria), NOT orden alone. §9.

  Fifth fork (HC-5): where HTML escaping belongs.
     Chosen: a TAGGED TEMPLATE LITERAL (`html` in lib/html-escape.ts) escaping every
     interpolated value BY DEFAULT, with an explicit greppable `raw()` opt-out.
     Rejected: per-site esc() calls; escaping in the data layer; a DOM sanitizer. §9.

  Sixth fork (Amended 4, lead-ruled): in-place rewrite vs. add-alongside at T14.
     Chosen: ADD generateVoucherDocHTML alongside the untouched legacy function, retire
     the legacy one at T15. Same shape as T3 AC-4's pre-authorized split, forced by the
     same mechanical fact (whole-project tsc + a consumer owned by a later task).
     Rejected: waiving T14's qa gate (spends the sprint's evidence discipline to save one
     task boundary); stubbing a VoucherDocData literal into the live page (a fabricated
     value in production code, stockin-zero-price shaped, in the exact file T15 is about
     to rewrite). See §9 "T14 split (Amended 4)".

Seam map (file budget) and its complement (must-not-touch): see §3.

Negative space checked — grep run over ~/Developer/CBrain/decisions and
~/Developer/CBrain/mistakes:
- NO ADR and NO mistake note covers document generation, HTML templating, output
  encoding, or voucher/proforma rendering. New ground. HC-5 is a strong candidate for
  the FIRST such note (§12).
- ADR-0006 rls-org-isolation-default: honored — every new table gets a NAMED policy, and
  its "app-layer checks only" rejection is respected.
- ADR-0003 hard-gates-anti-theater: acceptance criteria demand real command output. This
  is why HC-3 is asserted on a PERSISTED ROW, HC-4 on persisted ocupacion_id values, and
  HC-5 on the RENDERED HTML string. It is also why the Amended-4 ruling did NOT waive
  T14's qa gate — the gate is the evidence.
- ADR-0005 ai-proposes-code-disposes / ADR-0010 guard-the-negative-space: HC-1..HC-5 were
  escalated, not decided unilaterally. Amended 4 is a lead sequencing call, acknowledged.
- mistakes/stockin-zero-price: named in the acceptance criteria of every task that renders
  or persists a field. It is also why the "stub a literal into the live page" option was
  rejected at Amended 4.
- mistakes/fake-green-tests + patterns/mutation-checked-tests: named in every task that
  ships a test.
- mistakes/unrun-command-claimed-green: named in the DoD.
- mistakes/premature-success-signal: named in T8/T15.

Pre-mortem — most drift-prone task + mitigation: see §7.

Any genuinely hard call flagged for the human: FIVE — HC-1..HC-5, all RULED. Plus one
LEAD-ruled sequencing call (Amended 4), acknowledged by the architect as correcting a
defect in the original task boundary.
```

---

## 2. Technical approach (one paragraph)

Both documents stop being decorated placeholders and become pure renderings of validated, structured input. A new offline module per document (`lib/confirmacion-data.ts`, `lib/voucher-data.ts`) owns the document's data contract plus a **validating builder** that returns either `{ ok: true, data }` or `{ ok: false, missing: string[] }` — so a required field that is absent **blocks the document instead of defaulting to `0` / `"N/A"` / today** (mistakes/stockin-zero-price). `lib/finance.ts` gains three helpers pinned by test to the exact arithmetic in `app/clientes/balance/page.tsx:75-90`. The generators in `lib/document-generator.tsx` are rewritten to consume those contracts and nothing else — every `Math.random()`, `new Date()` fallback and hardcoded literal listed in §0 is deleted — with `VoucherDocData` structurally carrying **no money field of any kind**, so a price leak into the voucher is a TypeScript compile error. Each new generator lands **alongside** its legacy counterpart and the legacy one is retired by the task that owns its last caller, because the typecheck gate spans the whole project. Every value those generators interpolate is escaped by default through a tagged template literal (`lib/html-escape.ts`), so retiring the old regex post-processor removes no protection and a field added a year from now cannot silently become an injection site. Data that has no home today lands in two new RLS-protected tables plus five additive `reservas` columns, reached exclusively through `"use server"` service-role actions, because Elibry's browser client is unauthenticated `anon` (finding F2). Because those replace-style saves are delete-then-insert over PostgREST, passenger→room links are captured and rebuilt after every successful occupancy save (HC-4), matching rooms on material identity so a link is either correct or honestly NULL. Where the two totals bases disagree the document still prints (HC-3) and the discrepancy is written to `auditoria`; where the `FACTURA #` lookup fails the document blocks (HC-2).

---

## 3. Seam map — total file budget

**New files (14)**

| Path | Purpose |
|---|---|
| `scripts/061-create-reserva-pasajeros-ocupaciones.sql` | Shared passenger + room-occupancy tables, RLS, policies, rollback header |
| `scripts/062-add-voucher-fields-to-reservas.sql` | Additive `reservas` columns for Part B |
| `scripts/063-allow-discrepancia-in-auditoria.sql` | **(HC-3)** Widen `auditoria.accion` CHECK by one value — §4.3 |
| `app/actions/documentos-actions.ts` | `"use server"` service-role I/O for the new tables, the new `reservas` columns, the read-only `FACTURA #` lookup, the discrepancy write, and **(HC-4)** the success-path re-link |
| `lib/confirmacion-data.ts` | `ConfirmacionData` type + `buildConfirmacionData()` + pure discrepancy **detection** |
| `lib/voucher-data.ts` | Money-free `VoucherDocData` type + `buildVoucherData()` |
| `lib/html-escape.ts` | **(HC-5)** The `html` tagged-template renderer, `raw()` opt-out, and the escaper. Pure, no DOM, no dependency |
| `tests/html-escape.test.ts` | **(HC-5)** Unit tests for the tag, the escaper and the `raw()` seam |
| `tests/confirmacion-html.test.ts` | **(HC-5)** Rendered-output assertions for `generateConfirmacionHTML` incl. the hostile fixture |
| `tests/confirmacion-data.test.ts` | Offline field-by-field + BLOCK + discrepancy-detection tests |
| `tests/documentos-actions.test.ts` | Offline action tests incl. the persisted discrepancy row, the `FACTURA #` block paths, and **(HC-4)** the re-link matrix |
| `tests/voucher-data.test.ts` | Offline field-by-field + BLOCK + no-money tests |
| `tests/fixtures/proforma-baseline.html` | Constraint-5 golden baseline (T3, committed) |
| `tests/proforma-snapshot.test.ts` | Constraint-5 diff harness |

**Edited files (5)**

| Path | Change |
|---|---|
| `lib/finance.ts` | +3 helpers |
| `tests/finance.test.ts` | + cases for the 3 helpers |
| `lib/document-generator.tsx` | New `generateConfirmacionHTML` (T6); `html`-tag application (T6b); **new `generateVoucherDocHTML` added alongside the untouched legacy `generateVoucherHTML` (T14, Amended 4)**; **legacy voucher function + `VoucherData` type retired (T15, Amended 4)** |
| `app/facturacion/proforma/page.tsx` | Real cliente data, real builder call, passenger persistence, block UI, discrepancy-log call, repoint to `generateConfirmacionHTML`, delete `applyEditableProformaData` + policy-edit UI |
| `app/facturacion/voucher/page.tsx` | Real builder call, delete `generateVoucherNumber`, localizador/regimen/ocupaciones persistence, block UI, surface the HC-4 re-link outcome, repoint `:305`/`:358` to the new generator |

**MUST NOT TOUCH** (the complement — a diff outside this list fails the task)

- `app/facturacion/fiscal/page.tsx` — the NCF/comprobante **write** path, **including its silent error swallow at `:142-143`** (Risk R6). Its `generateNCF` `Math.random()` defect is backlog B-4.
- `app/facturacion/comprobantes/**`, `app/facturacion/buscar/**`, `app/facturacion/page.tsx`.
- `scripts/023-create-reserva-detalles-table-fixed.sql` and the `recalcular_totales_reserva()` trigger.
- **`scripts/061-create-reserva-pasajeros-ocupaciones.sql` — SHIPPED AND CLOSED.** HC-4 is solved entirely in application code; **no schema change, no RPC**.
- `reservas.precio_total`, `reservas.descuento`, `reservas.pasajeros`, `reservas.habitaciones` — trigger-owned.
- `app/clientes/balance/page.tsx`, `app/clientes/balance-reserva/page.tsx` — the reference implementation.
- `app/reservas/ver/[id]/page.tsx` — divergent balance formula, out of scope by spec (Risk R4).
- `app/reservas/crear/page.tsx`, `app/reservas/editar/[id]/page.tsx` — **no new document entry point**.
- `lib/admin-actions.ts` and `acciones_pendientes` — the approval queue is not an audit log (§4.3).
- `app/logs/**` — the audit-viewing UI is out of scope (backlog B-7).
- **`generateProformaHTML` (`lib/document-generator.tsx:285-917`) — LEGACY, byte-frozen by `tests/proforma-snapshot.test.ts`.** Deliberately excluded from HC-5's escaping. Deletion is backlog **B-13**.
- **`generateVoucherHTML(data: VoucherData)` and the `VoucherData` interface (`:1-33`) — LEGACY. Untouched by T14 (Amended 4); RETIRED by T15**, which owns their last caller. **Unlike B-13, this is closed inside the sprint, not deferred** — the moment T15 repoints `:305`/`:358` the legacy function has zero callers, and a zero-caller unescaped money-carrying generator must not survive the sprint.
- `generateReciboHTML` (`:1597-1804`) and `openDocumentInNewWindow` (`:1806-1830`) — untouched. The recibo generator is **also unescaped** (pre-existing) — Risk R12, backlog B-12.
- `lib/supabase.ts`, `lib/supabase-server.ts`, `lib/user-context.tsx`, `components/auth-guard.tsx`, `middleware.ts`.
- Any file split / line-count refactor (see §8).

---

## 4. DB changes — every table ships a named policy

### 4.1 `scripts/061-create-reserva-pasajeros-ocupaciones.sql` (T1) — **SHIPPED**

**Deliberate, stated deviation from the spec's grouping:** the spec listed room-occupancy under Part B, but OQ1 supersedes with *"ONE shared table/structure designed once and reused by BOTH documents"*.

```
reserva_ocupaciones
  id serial PK · reserva_id integer NOT NULL REFERENCES reservas(id) ON DELETE CASCADE
  orden integer NOT NULL · cantidad integer NOT NULL CHECK (cantidad > 0)
  ocupacion text NOT NULL · categoria text NOT NULL
  fecha_creado timestamptz NOT NULL DEFAULT now() · registrado_por text
  UNIQUE (reserva_id, orden) · UNIQUE (id, reserva_id)   -- composite-FK target

reserva_pasajeros
  id serial PK · reserva_id integer NOT NULL REFERENCES reservas(id) ON DELETE CASCADE
  ocupacion_id integer NULL · orden integer NOT NULL
  nombre_completo text NOT NULL CHECK (nombre_completo ~ '\S')
  tipo_pax text NOT NULL CHECK (tipo_pax IN ('ADULTO','NINO','INFANTE'))
  documento text NULL · fecha_creado timestamptz NOT NULL DEFAULT now() · registrado_por text
  UNIQUE (reserva_id, orden)
  FOREIGN KEY (ocupacion_id, reserva_id) REFERENCES reserva_ocupaciones (id, reserva_id)
    ON DELETE SET NULL (ocupacion_id)

INDEX idx_reserva_pasajeros_reserva_id · INDEX idx_reserva_ocupaciones_reserva_id
```

**`UNIQUE (reserva_id, orden)` makes `orden` unique within a reserva at any instant — but `orden` is a render position, not a durable identity. That is why HC-4 does not key on it alone.**

```sql
ALTER TABLE reserva_pasajeros   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserva_ocupaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY reserva_pasajeros_staff_all   ON reserva_pasajeros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY reserva_ocupaciones_staff_all ON reserva_ocupaciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**ROLLBACK:** `DROP TABLE IF EXISTS reserva_pasajeros; DROP TABLE IF EXISTS reserva_ocupaciones;`

### 4.2 `scripts/062-add-voucher-fields-to-reservas.sql` (T11)

```sql
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS localizador   TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS regimen       TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS pax_adultos   INTEGER;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS pax_ninos     INTEGER;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS pax_infantes  INTEGER;
```

Additive columns on an existing table, so ADR-0006 is satisfied by §4.1. Enabling RLS on `reservas` retroactively is HC-1, deferred. All five **nullable on purpose**: `NULL` = "not supplied", `0` = "genuinely zero". A `DEFAULT 0` would recreate mistakes/stockin-zero-price at the schema level.

### 4.3 `scripts/063-allow-discrepancia-in-auditoria.sql` (T5) — HC-3

| Candidate | Verdict |
|---|---|
| `auditoria` (`scripts/001:158-167`) | **CHOSEN.** One obstacle: `CHECK (accion IN ('INSERT','UPDATE','DELETE'))` has no value meaning "observation". Widened by exactly one. |
| `acciones_pendientes` (`lib/admin-actions.ts:16-49`) | **REJECTED.** An approval **queue** surfaced to operators as work items; a discrepancy row becomes a phantom approval task. |
| A new `documento_discrepancias` table | **REJECTED as unnecessary** — and it **would require its own RLS policy under §4.1**. No unilateral swap. |
| `console.warn` | **REJECTED** — a console line is not a record (ADR-0003). |

```sql
-- ROLLBACK: ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_accion_check;
--           ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check
--             CHECK (accion IN ('INSERT','UPDATE','DELETE'));
ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_accion_check;
ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check
  CHECK (accion IN ('INSERT','UPDATE','DELETE','DISCREPANCIA'));
```

**Existence is not assumed** — `scripts/058:8` guards `auditoria` with `IF EXISTS`. **The real constraint name must be read from `pg_constraint` first.**

**Payload:** `tabla:'reservas'` · `registro_id:<reserva.id>` · `accion:'DISCREPANCIA'` · `datos_anteriores:null` · `datos_nuevos:{ source:'CONFIRMACION', reserva_id, cliente_id, suma_detalles, precio_total, delta, moneda, generado_en }` · `usuario:<acting user; 'SISTEMA' if absent>` · `fecha:` DB default.

---

## 5. API / service changes

`app/actions/documentos-actions.ts` — `"use server"`, service-role client, `{ success, error?, data? }`:

- `getPasajerosReservaAction` / `guardarPasajerosReservaAction`
- `getOcupacionesReservaAction` / `guardarOcupacionesReservaAction` — **(HC-4)** rebuilds passenger→room links on the SUCCESS path; contract in §9 HC-4
- `getDatosVoucherReservaAction` / `guardarDatosVoucherReservaAction` — **sets only keys where `value !== undefined`**; never writes trigger-owned columns
- `getFacturaNumeroPorReservaAction` — **read-only**; `{ok:true,numeroFactura}` · `{ok:false,reason:'SIN_COMPROBANTE'}` · `{ok:false,reason:'LOOKUP_FAILED',detail}`. Never allocates.
- `registrarDiscrepanciaTotalesAction` — **(HC-3)** one `auditoria` row per §4.3. Never throws into the caller.

`lib/finance.ts` — additive, pure: `calcularMontoPagado`, `calcularBalanceReserva`, `calcularBalanceGeneralPorMoneda`.

`lib/html-escape.ts` — **(HC-5)** pure, no DOM, no dependency: `escapeHtmlText(value: unknown): string` (five-character replace, `&` first) · `raw(value: string): SafeHtml` (explicit, greppable opt-out) · `html(strings, ...values): SafeHtml` (escapes every value by default; inlines `SafeHtml` and arrays of `SafeHtml` verbatim) · `renderHtml(value: SafeHtml): string`.

**`lib/document-generator.tsx` — exported generators over the sprint (Amended 4):**

| Export | Status |
|---|---|
| `generateConfirmacionHTML(data: ConfirmacionData)` | New at T6, escaped at T6b, consumed from T8 |
| `generateProformaHTML(data: ProformaData)` | Legacy, byte-frozen, dead after T8 — backlog **B-13** |
| **`generateVoucherDocHTML(data: VoucherDocData)`** | New at T14 (Amended 4), escaped, money-free. **PERMANENT NAME (T15, option (a)).** Consumed from `app/facturacion/voucher/page.tsx:305`/`:358`. |
| ~~`generateVoucherHTML(data: VoucherData)`~~ | **RETIRED at T15.** Deleted in the same task that repointed its last two callers — zero remaining references (grep-evidenced: no `generateVoucherHTML`/`VoucherData` outside this plan's own prose and `tests/voucher-html.test.ts`'s retirement-assertion). |
| `generateReciboHTML(data: ReciboData)` | Untouched; unescaped — Risk R12, backlog **B-12** |

**Final-name choice — RECORDED (T15):** option **(a)** — the legacy `generateVoucherHTML(data: VoucherData)` function and the `VoucherData` interface were deleted; `generateVoucherDocHTML(data: VoucherDocData)` is the permanent name. `app/facturacion/voucher/page.tsx` now imports and calls `generateVoucherDocHTML` exclusively; the plan and the code no longer diverge.

---

## 6. UI changes

**`/facturacion/proforma`** — same list-and-select screen, no new entry point. `getClienteData` returns the real `clientes.direccion`. The "Editar" dialog loses its four policy/advertencia inputs (OQ2) and keeps Observación + the passenger list, which now **persists** to `reserva_pasajeros`. Both "Editar" and "Rápida" call `buildConfirmacionData`; on `{ ok: false }` a destructive toast lists the missing fields and **no window opens and no success toast fires**. On a totals discrepancy the document **generates normally with no on-screen and no on-document indication** (HC-3).

**`/facturacion/voucher`** — same screen. `Localizador` becomes a real, persisted input; the prep screen stays usable while it is blank, but **Generar e Imprimir** and **Descargar como PDF** are disabled with a visible reason. `Tipo de Habitación` is replaced by a repeatable occupancy-group editor persisting to `reserva_ocupaciones`. **(HC-4)** After an occupancy save the screen must surface the re-link outcome; a silent `success: true` is not acceptable. `Régimen`, `Adultos`, `Niños` + a new `Infantes` persist to the `reservas` columns. `Noches` becomes read-only/derived.

---

## 7. Edge cases, and the drift pre-mortem

| Case | Where handled |
|---|---|
| **Zero `reserva_detalles` rows** | `buildConfirmacionData` returns `{ ok: false, missing: [...] }`; the synthetic fallback at `app/facturacion/proforma/page.tsx:344-351` is deleted. T5/T8. |
| **Σdetalles ≠ `precio_total`** | **(HC-3)** Generates normally; one `auditoria` row. No block, no warning anywhere. T5. |
| **Free text contains `<`, `>`, `&`, `"`, `'`** | **(HC-5)** Escaped by the `html` tag at the interpolation seam. T6b / T14. |
| **Free text contains accented Spanish (`Categoría`, `ñ`)** | **(HC-5)** Passes through **byte-identical** — the escaper touches five ASCII characters and nothing else. Explicitly asserted. T6b / T14. |
| **A field is added to a generator next year** | **(HC-5)** Escaped automatically — the tag is the default. Opting out requires typing `raw()`, which greps. |
| **Two voucher generators exist during the T14→T15 gap** | **(Amended 4)** The legacy one keeps its existing callers and gains **no new ones**; T15 repoints both call sites and deletes it in the same task. T14 AC-10 and T15 AC-11 enforce this. Risk R14. |
| **Occupancy save: room unchanged at same `orden`** | **(HC-4)** Re-linked to the new row's id. T2b. |
| **Occupancy save: room materially changed, or gone** | **(HC-4)** `ocupacion_id` stays NULL; reported in `enlacesDescartados`. T2b. |
| **Occupancy save: new room at a new `orden`** | **(HC-4)** No-op. T2b. |
| **Occupancy save: re-link UPDATE fails on the SUCCESS path** | **(HC-4)** `{ success: true, data, relinked: false, relinkError, enlacesNoRestablecidos }`. Neither field lies. T2b. |
| **Occupancy save: passenger re-assigned by someone else mid-save** | **(HC-4)** Guarded `.is("ocupacion_id", null)` — not clobbered; reported without an error. T2b. |
| **Empty passenger list** | Renders the section with zero lines. Never the fake `1)`, never "Acompañante". |
| **Missing dates/times** | BLOCK both documents. `noches` computed, never `?: 3`. |
| **Missing `localizador`** | VOUCHER only: prep screen usable, generate/print/download disabled. |
| **No `comprobantes_fiscales` row / lookup failure** | **(HC-2)** BLOCK with the two distinct messages. T7. |
| **`abonado_contabilidad` is NULL** | Treated as `0` **only** in the arithmetic, matching `app/clientes/balance/page.tsx:77`. |
| **Client with reservas in both currencies** | Bucketed on `(moneda \|\| "DOP")`, identical to the balance page. |
| **Discrepancy log write fails** | Document still generates (HC-3). Risk R7. |
| **Concurrent edits** | Last write wins (B-5). **HC-4 widens the window** (Risk R9) but the null-guard means the re-link can only fill a gap. |
| **Popup blocked** | Existing `openDocumentInNewWindow` fallback unchanged. |
| **Success toast on a blocked document** | Must not fire — mistakes/premature-success-signal. |

### Pre-mortem — most drift-prone task

**T15 is now the highest drift risk (Amended 4).** It gained a second file (`lib/document-generator.tsx`) on top of an already-large page rewrite, and the temptation is to "tidy" the generator file while deleting the legacy function — or to leave the deletion for later "because the page works now". Mitigations: T15's generator-file scope is restricted to **exactly one action**, with an **empty diff required on everything else in that file**; and AC-11 makes the retirement a same-task requirement, not a follow-up.

**T6b (HC-5):** applying a tag across a ~600-line template is mechanical work at dozens of sites; the temptation is to also tidy the template, or to extend escaping to the legacy generators. Both forbidden — the former breaks T3's baseline, the latter is unrelated scope. Legacy functions must show an **empty diff**.

**T2b (HC-4):** the obvious way to get the OLD occupancy rows is to make `reemplazarConjuntoConRestauracion` return `filasOriginales` — but that helper is **shared** with `guardarPasajerosReservaAction`. T2b mandates a separate SELECT and leaves the shared helper untouched.

**T5 (HC-3):** the risk is a dev putting the Supabase write **inside `lib/confirmacion-data.ts`**, destroying offline testability.

---

## 8. File size (`.claude/rules/file-size.md`, ≤500 lines)

Already over: `lib/document-generator.tsx` (~1830 after T6; T14 adds a whole generator before T15 removes the legacy one), `app/reservas/crear/page.tsx` (1562), `app/facturacion/proforma/page.tsx` (816), `app/facturacion/voucher/page.tsx` (790). `app/actions/documentos-actions.ts` is at 467 lines and T2b pushes it past 500.

Splits are **not bundled**. Follow-ups:

- **B-1** Split `lib/document-generator.tsx` → `lib/templates/confirmacion.ts`, `voucher.ts`, `recibo.ts`. **Now urgent.** Note T15's legacy retirement claws some of it back.
- **B-2** Extract `app/facturacion/voucher/page.tsx`'s form into `components/voucher/*`.
- **B-3** Extract `app/facturacion/proforma/page.tsx`'s dialog.
- **B-4** `app/facturacion/fiscal/page.tsx:200-203` mints NCFs with `Math.random()` — fiscal, senior + human-gated, own sprint.
- **B-5** Concurrent passenger/occupancy edits: last-write-wins.
- **B-6** `reservas.impuestos` double-count risk at `app/facturacion/proforma/page.tsx:331-333`.
- **B-7** Nothing in the app can *read* the `auditoria` rows this sprint writes.
- **B-8** **(HC-4 durable fix)** Have the occupancy editor resubmit passenger→room links explicitly with every save.
- **B-9** `app/actions/documentos-actions.ts` crosses 500 lines with T2b. Split by concern before T12 grows it further.
- **B-10** **(QA minor)** `relinkPasajerosRestaurados` (`:363-377`) returns on the **first** error rather than attempting the rest.
- **B-11** **(QA minor)** `restoreError` carries only the first message, no per-passenger status.
- **B-12** **(HC-5 residual)** `generateReciboHTML` (`:1597-1804`) interpolates `cliente.nombre`, `pago.referencia`, `pago.metodo` **unescaped**, rendered through the same `openDocumentInNewWindow`. Apply the `html` tag as its own scoped task.
- **B-13** **(HC-5 residual)** `generateProformaHTML` (`:285-917`) becomes **dead code** once T8 repoints the page. Delete it — with `tests/proforma-snapshot.test.ts` and `tests/fixtures/proforma-baseline.html` — once T10 confirms the new document is correct. *(Contrast with the legacy voucher function, which is retired inside the sprint at T15 — see Amended 4.)*
- **B-14** **(fixture-strength sweep, from R10)** Audit the other test suites for the weakness that let three of five mutations survive on T2: single-element fixtures that cannot distinguish "each item uses its own value" from "all use the first", and paths with zero instances of the thing under test.
- **B-15** **(lead-ruled, from T12)** `normalizarTextoLibreONull` is missing a `typeof` guard — a non-string input is not rejected before normalization.
- **B-16** **(lead-ruled, from T13)** Integer guard missing on **both** `pax_*` and `cantidad`. **Fix them together, never `pax_*` alone** — they are the same class of defect (a non-integer numeric accepted where the column is `INTEGER`), and fixing one leaves a matching hole open next door. *(The lead proposed the label B-14 for this; B-14 was already taken by the fixture-strength sweep, so it is recorded here as B-16.)*

---

## 9. Hard calls — all five escalated, all five now RULED

**HC-1 — Elibry has no authentication, so "authenticated-staff-only RLS" cannot mean what it sounds like. → SURFACED, ACKNOWLEDGED, EXPLICITLY OUT OF SCOPE.**
`lib/user-context.tsx:23-38` is a hardcoded two-user array in `localStorage`; no `supabase.auth` usage anywhere; the browser is `anon`; **not one of the ~29 existing tables has RLS**. Resolution for the *new* tables is Approach C, plus the **mandatory counter-probe** so a green anon-probe with a broken app is a FAIL. **This sprint does not fix the standing exposure** — Risk R1, which must be quoted in the sprint summary.

**HC-2 — `comprobantes_fiscales`'s real schema is not in the repo. → DECIDED: "Verify columns at runtime, block if the lookup fails."**
This **overrides my earlier proposal to degrade to an empty field.** `FACTURA #` is **REQUIRED**, and letting a runtime lookup failure silently downgrade it to optional is precisely mistakes/stockin-zero-price. **Any** failure to read BLOCKS with a named-field error, with **distinct messages** for the data-entry case and the engineering case (T7 AC-4/AC-5). Unchanged and non-negotiable: **no allocation, issuance, or renumbering of an NCF**. The silent swallow at `app/facturacion/fiscal/page.tsx:142-143` is **not** in T7's scope; it is Risk R6.

**HC-3 — `BALANCE RESERVA` and `BALANCE GENERAL` are specified over different bases. → DECIDED: "Print, and log the discrepancy silently."**
This **overrides my BLOCK recommendation**; settled. T5 computes both bases and compares (`|Σdetalles − precio_total| > 0.01`), but on mismatch does **not** block and does **not** render a warning. The discrepancy is **logged as a real persisted record** — one `auditoria` row per §4.3. "Logged" explicitly does **not** mean `console.log`; the verifying test asserts on the **persisted row**.
**Accepted consequence:** a client-facing CONFIRMACIÓN can display a `BALANCE RESERVA` that is not a summand of the `BALANCE GENERAL` beside it. Explicit human decision, with the discrepancy captured for cleanup — a path that only becomes real once someone can read those rows (**B-7**).

**HC-4 — a successful occupancy save silently orphans every room-assigned passenger. → DECIDED: "Re-link by `orden` after a successful save."**

*The defect.* Delete-then-insert fires `scripts/061:86`'s `ON DELETE SET NULL (ocupacion_id)`, nulling every referencing passenger; the insert writes fresh serial ids; the code skips re-linking on success (`app/actions/documentos-actions.ts:444-447`). Every successful save — including a `categoria` typo fix — permanently orphaned every room-assigned passenger and returned `{success: true}` with zero signal.

*The identity rule.* Capture, before the delete: occupancy rows as `(id, orden, ocupacion, categoria)` and passengers as `(id, ocupacion_id)` where non-NULL. After a successful insert, match new rows on **`orden` AND `ocupacion` AND `categoria` all equal**. Found → UPDATE. Not found → **leave NULL** and report in `enlacesDescartados`. Comparison is on the exact trimmed, **case-sensitive** strings the action writes (`:437-438`). **`cantidad` is deliberately NOT in the key**: "X 8" → "X 9" does not change which room a passenger is in, and since `orden` is in the key a count edit cannot alias two rooms.

*Why `orden` alone is NOT safe.* `UNIQUE (reserva_id, orden)` makes `orden` unique *at one instant*, but it does not identify a room *across two saves* — it is a render position. Matching on it alone re-links a passenger who was in a DOBLE into a TRIPLE: a **silently wrong** room on a customer-facing voucher. **An honest NULL beats a confident wrong link.**

*Edge cases:* room gone → NULL + reported · reordered/materially different → NULL + reported · new room at a new `orden` → no-op · passenger already NULL → untouched, not captured · no prior occupancy rows → `relinked: true` trivially.

*The success-path contract.* `success: false` would lie (the rooms saved); a bare `success: true` would hide orphans. Every success return carries an explicit discriminator:

```
{ success: true, data, relinked: true,  enlacesDescartados }
{ success: true, data, relinked: false, enlacesDescartados,
  enlacesNoRestablecidos, relinkError? }
```

`relinked === (enlacesNoRestablecidos.length === 0)`. `enlacesDescartados` does **not** flip `relinked`.

*Concurrency.* Does not change B-5's acceptance but **widens the window** (Risk R9). Mandatory mitigation: `.eq("id", …).is("ocupacion_id", null).select("id")` — the re-link can only fill a gap our own delete made. A 0-row result means someone else owns that passenger: reported, not an error.

*Why no migration and no RPC.* The rule needs only reads and updates the action can already issue; a new migration would ship **unverified against a live database** under the static-only ruling.

---

**HC-5 — the sprint deletes HTML escaping and replaces it with nothing. → RULED: escape at the render seam, via a tagged template literal.**

*The finding.* `generateConfirmacionHTML` (`:963`) interpolates every field raw — twelve free-text sites listed in §0. A grep for `escapeHtml|sanitize|DOMPurify` across the whole file returns nothing. The only escaping in the repo is `app/facturacion/proforma/page.tsx:97-103`, used solely by the post-processor **T9 deletes**. QA proved the hole with `nombre = 'Juana <script>alert(1)</script> Perez'`; `openDocumentInNewWindow` (`:1806`) writes the result into a new window as an executable document.

*Correction to the framing — the exposure starts at T8, not T9.* The old escaping only ever protected the **old** pipeline. The moment **T8** repoints the route at `generateConfirmacionHTML`, the live customer-facing page renders unescaped staff input, and T9 has not run yet. **So the fix must land before T8** — T6b **blocks T8**.

*The ruling: a tagged template literal* in `lib/html-escape.ts` (surface in §5).

> **Escaping is a property of the renderer, never of the data.** Data contracts (`ConfirmacionData`, `VoucherDocData`) carry **raw** domain values. Every generator that produces HTML builds its output with the `html` tag, which escapes **every** interpolated value by default. The only way to emit unescaped content is `raw()` — explicit, greppable, and never given a value that originated in the database or from a user.

*Why over the alternatives:* **per-site `esc()`** is correct today and forgettable tomorrow — one missed site is a silent hole with no failing test. **"Only free-text"** demands correct classification forever; `facturaNumero` is a `text` column from a table whose schema we could not verify (F1/HC-2). Escaping a number costs nothing; one misclassification costs an injection. **Builder-boundary escaping** is a category error: it poisons a transport-agnostic contract (wrong for a PDF text layer, CSV, logs, equality assertions), guarantees double-escaping, and note `:1496-1497` already calls `.toUpperCase()` on interpolated values — which would turn `&amp;` into `&AMP;`. **A DOM sanitizer** solves a different problem and adds an unjustified dependency to a path with no DOM.

*Accent safety.* The escaper replaces **five ASCII characters only**, so `Categoría`, `Pérez`, `Añejo`, `ESTADÍA`, `ñ` and `–` pass through **byte-identical** under `<meta charset="UTF-8">`. An "encode everything non-alphanumeric" escaper would mangle the whole Spanish document — asserted against directly.

*Context limits.* `escapeHtmlText` is safe for **element content** and **quoted attribute values**. It is **not** sufficient for unquoted attributes, `javascript:`/URL contexts, or `<script>`/`<style>` bodies. **Interpolating database or user data into those contexts is forbidden in these generators.**

*Legacy functions deliberately excluded.* `generateProformaHTML` is byte-frozen and dead after T8 (**B-13**). The legacy `generateVoucherHTML` is **untouched by T14 and retired by T15** (Amended 4) — during that one-task gap it keeps its existing callers and gains no new ones. `generateReciboHTML` is a pre-existing exposure outside this sprint's scope — **Risk R12**, backlog **B-12**.

*Task shape.* T6b, not a T6 reopen and not a T9 amendment: T9 runs after T8 (too late); T6 is QA-closed and its file scope was `lib/document-generator.tsx` only; and the "fix while free" precedent (T1) applies because nothing consumes `generateConfirmacionHTML` yet.

---

**T14 split (Amended 4) — LEAD-RULED sequencing call. Architect's acknowledgment: the ruling is correct and the defect was mine.**

*The fork.* T14 AC-1 as originally written said *"The old `VoucherData` interface (`:1-33`) **deleted**; `generateVoucherHTML(data: VoucherDocData)`"* — an in-place signature change. The dev proved with `npx tsc --noEmit` that this hard-breaks `app/facturacion/voucher/page.tsx:305` and `:358`, which pass the page's own structurally incompatible object literal. That page is **T15's** scope and MUST NOT TOUCH for T14; `tsconfig` spans the whole project, so `npm run qa`'s typecheck fails at a file T14 is forbidden to edit. Everything else was green: vitest 495/495 including a new 58-test file, eslint 0 errors, all four mandated mutations RED-then-GREEN.

*The ruling.* T14 ships **`generateVoucherDocHTML(data: VoucherDocData)` alongside the untouched legacy `generateVoucherHTML(data: VoucherData)`**, with a provably empty diff on the legacy function and on `page.tsx`. **T15 repoints both call sites and retires the legacy function and type in the same task.** The lead rejected waiving T14's `npm run qa` gate (spending the sprint's evidence discipline to save one task boundary) and rejected stubbing a `VoucherDocData` literal into the live page (a fabricated value in production code, `stockin-zero-price`-shaped, in the exact file T15 is about to rewrite). Both rejections are right, and the second especially — a placeholder in a live page is the precise failure this sprint exists to remove.

*Was AC-1's wording a deliberate VOUCHER-specific rejection of the split? **No.** Asked to say so plainly: this was a defect in my task boundary, not a considered position.* The reasoning that produced the CONFIRMACIÓN split (T3 AC-4) was framed narrowly around the byte-frozen baseline — `generateProformaHTML` could not change because `tests/proforma-snapshot.test.ts` pins it. The voucher has no such baseline, so I concluded no split was *needed* and wrote an in-place rewrite. **That was the wrong test.** The binding constraint is not the snapshot; it is that **`tsc --noEmit` spans the whole project, so a task that changes an exported signature owns every consumer of it** — and T14's consumer belongs to T15. T6 hit exactly this and split; T14 is structurally identical and I failed to apply the precedent symmetrically. Nothing about the voucher argued against the split; I simply did not trace the typecheck surface through my own scope lock. I have promoted the general rule to an invariant in §1 ("a task's file scope must be closed under the gate it must pass") so the next boundary is drawn with it in view.

*Why this is a sequencing call and not an architecture one — agreed.* Nothing about schema, abstraction or contract moves: `VoucherDocData`'s shape, T13's compile-time money-omission guarantee, and HC-5's escaping invariant all land exactly as specified, on the new function. What changes is only which name the new function is exported under during a one-task gap, and the fact that retiring the old one is now an explicit acceptance criterion instead of an implicit consequence. **That last part is an improvement on what I wrote**, because it makes the retirement checkable.

*The one condition I attach.* The gap must not outlive T15. Unlike `generateProformaHTML` — dead code protected by a byte-freeze test, no urgency (**B-13**) — the legacy `generateVoucherHTML` will have **zero callers** the moment T15 repoints the page, and it is both **unescaped** and **money-carrying** (`VoucherData.reserva.total`, `:12`; `fmtMoney`, `:228-230`). A zero-caller, unescaped, money-carrying voucher generator must not survive the sprint as a backlog item someone could later call by accident. Hence T14 AC-10 (no new callers) and T15 AC-11 (retire in the same task), both non-negotiable, and Risk R14.

---

## 10. Test plan

Gate command for every task: **`npm run qa`** (= `npm run typecheck && npm run lint && npm run test`). Real output pasted, per ADR-0003.

Targeted runs: `npx vitest run tests/finance.test.ts` · `tests/confirmacion-data.test.ts` · `tests/documentos-actions.test.ts` · `tests/html-escape.test.ts` · `tests/confirmacion-html.test.ts` · `tests/voucher-data.test.ts` · `tests/proforma-snapshot.test.ts`.

All fixtures are **plain data objects passed into the pure builders/generators — no live Supabase, no network** (patterns/port-and-in-memory-fake). Any test standing in as PASS evidence is **mutation-checked** (patterns/mutation-checked-tests).

**HC-5 — escaping verification. Assertions are on the RENDERED HTML STRING, never on "we call the helper".** The hostile fixture, used for `generateConfirmacionHTML` (T6b) and re-used for `generateVoucherDocHTML` (T14):

```
nombre:        'Juana <script>alert(1)</script> Pérez'
observaciones: 'Cliente "VIP" & socio <b>preferente</b>'
atendidoPor:   "O'Brien & Asociados"
servicio:      'Hotel <Categoría "Deluxe"> — Añejo & Ñandú'
pasajeros:     [{ nombreCompleto: '<img src=x onerror=alert(1)>' }, …]
lineas:        [{ descripcion: 'HABITACIÓN <DOBLE> & "SUITE"' }]
```

1. No `<script`, no `<img`, no `onerror=` in unescaped form — `String.includes` on the raw substrings.
2. `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`, `"`→`&quot;`, `'`→`&#39;`, with **`&` replaced first** — a test proves `&lt;` is not double-encoded to `&amp;lt;`.
3. **Accents NOT mangled** — `Categoría`, `Pérez`, `Añejo`, `Ñandú`, `ESTADÍA`, `–` verbatim. A first-class assertion.
4. Static Spanish boilerplate **byte-identical** to the pre-tag rendering.
5. With a **clean** fixture, output **byte-identical** to the pre-tag approved output.
6. `tests/proforma-snapshot.test.ts` passes **unchanged**.
7. **Mutation-checked**, all RED: **M7** `html` inlines without escaping · **M8** `&` escaped last · **M9** escaper entity-encodes non-ASCII · **M10** a data value wrapped in `raw()`.
8. **Static guard:** `raw(` appears **zero** times inside the new generators.

**B3 money-omission — the limit both T13 QA lenses independently proved (Risk R13).** TypeScript's excess-property check fires **only on fresh object literals**. A variable of wider inferred type assigned into a `VoucherDocData` slot compiles clean. So the B3 guarantee is verified in two parts, and **both are required**:

- **(i) Compile-time:** a `// @ts-expect-error` test proves a **fresh literal** carrying `total` is rejected. This is what `npm run typecheck` gates.
- **(ii) Provenance:** an explicit check — grep plus review — that **every** `VoucherDocData` value reaching a generator comes from `buildVoucherData()` or a fresh literal, never from a wider variable, a spread, or a cast. `lib/voucher-data.ts` satisfies this today; **T14 and T15 must each re-verify it for the code they add**, because the type system will not.

**HC-4 — re-link verification (T2b).** Three required fixtures: a **≥2-link fixture** whose passengers point at **different** rooms; a **success-path fixture carrying real links**; a **NULL-linked passenger alongside linked ones**. Old mutation (iii) is **obsolete**. Replacement set, all RED: **M1** match on `orden` alone · **M2** always write `enlaces[0].ocupacion_id` · **M3** drop the non-null capture filter · **M4** always return `relinked: true` · **M5** drop the `.is("ocupacion_id", null)` guard · **M6** fold `enlacesDescartados` into `relinked: false`. Assertions on **persisted `ocupacion_id` values**, never call counts.

**HC-3 — discrepancy-log verification (T5).** Σdetalles `800.00` vs `precio_total` `750.00`: the document **generates successfully** and **exactly one** `auditoria` row is written (count `1`, not `≥1`), matching §4.3 field for field. Delta `0` writes **zero** rows. **A test passing via a `console.warn` spy is an automatic FAIL.**

**HC-2 — `FACTURA #` block verification (T7).** Two negative fixtures asserted separately plus a positive one; each asserts the exact operator-facing message, and a test asserts the two messages are **not equal**.

Manual/SQL checks: anonymous-access probe (all 8 rejected) · **counter-probe** (the same 8 via the server actions must succeed — a green anon-probe with a broken app is a FAIL) · `pg_tables.rowsecurity` · `pg_policy` roles · `pg_constraint` before/after `063` · `information_schema.columns` for `comprobantes_fiscales` · the `.docx` fidelity walks (T10, T16).

---

## 11. Task list

> **Numbering note:** inserted tasks are **T2b** (between T2 and T3) and **T6b** (between T6 and T8). T1..T16 keep their original numbers and meanings — nothing is renumbered.
> **Definition of done, every task:** real diff pasted · `npm run qa` actually run with output shown · no file outside "Files in scope" changed · RLS not weakened · **no existing safeguard removed without an equivalent already landed** · one-line rollback note.

### PART A — CONFIRMACIÓN DE SERVICIOS

**T1 — Shared passenger + room-occupancy storage: migration & RLS** — **CLOSED**
**Owner:** senior-dev · **Depends on:** none · **Files:** `scripts/061-create-reserva-pasajeros-ocupaciones.sql`

1. Both tables exist with the columns, types, FKs, CHECKs, UNIQUEs and indexes in §4.1 — real dump pasted.
2. `rowsecurity = true` for both; policies `TO authenticated`; **no grant to `anon`**.
3. Anonymous probe: all 8 operations rejected/empty, real responses pasted.
4. **Block-never-default (mistakes/stockin-zero-price):** `nombre_completo` NOT NULL + non-whitespace CHECK; `tipo_pax` NOT NULL + CHECK; rejections demonstrated. No `DEFAULT 0`/`'N/A'`.
5. `ocupacion_id` nullable with `ON DELETE SET NULL`.
6. Idempotent, `-- ROLLBACK:` header present.
7. `npm run qa` green.
8. Trigger untouched; `reservas` not altered.

---

**T2 — Server-action data layer for passengers & occupancies** — **CLOSED**
**Owner:** senior-dev · **Depends on:** T1 · **Files:** `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`

1. `"use server"`, service-role client, `{ success, error?, data? }`. No service key importable from a client component.
2. `getPasajerosReservaAction` ordered by `orden`; `guardarPasajerosReservaAction` replaces the set per reserva.
3. **Block-never-default:** blank `nombre_completo` or missing `tipo_pax` rejected **before** the write.
4. Same for occupancies: `cantidad <= 0`, blank `ocupacion`/`categoria` rejected.
5. **Offline (patterns/port-and-in-memory-fake).**
6. **Mutation-checked** for the blank-name rejection and ordering.
7. Counter-probe: real save+read round-trip succeeds.
8. `npm run qa` green.

---

**T2b — HC-4: rebuild passenger→room links after a successful occupancy save**
**Owner:** senior-dev · **Depends on:** T2 · **Blocks:** T12, T15
**Files in scope:** `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`
**DB/RLS:** **none.** No migration, no RPC, no change to `scripts/061`. If schema work seems required, **stop and escalate**.

*Why a separate task, not a fourth T2 round:* T2's criteria are closed and verified. This is **new behaviour with a changed public contract**, a new identity rule and a replacement mutation set.

1. **The rule exactly as §9 HC-4 specifies.** Key = (`orden`, `ocupacion`, `categoria`), exact trimmed case-sensitive strings. `cantidad` **not** in the key. **Matching on `orden` alone is a FAIL.**
2. Old occupancy rows read by **a dedicated SELECT inside `guardarOcupacionesReservaAction`**. `reemplazarConjuntoConRestauracion` **must show an empty diff**.
3. **The success contract exactly as §9 HC-4 specifies.** **A bare `success: true` after a failed re-link is an automatic FAIL.**
4. **Every edge case in §9 HC-4 implemented and individually tested.** One test per row.
5. **Concurrency guard:** `.eq("id", …).is("ocupacion_id", null).select("id")`. A 0-row result is **not** an error. A test proves a concurrently-assigned passenger is not clobbered.
6. **All links attempted** — no stopping at the first error (B-10 covers the restore-path twin).
7. **Block-never-default:** an unmatched room yields NULL — never a "closest" room, never `enlaces[0]`.
8. **Fixture-strength criteria (not optional):** ≥2-link fixture pointing at **different** rooms; success-path fixture with real links; NULL-linked passenger alongside linked ones. Assertions on **persisted values**, not call counts.
9. **Mutation-checked: M1–M6 all RED**, then GREEN.
10. **Offline:** the in-memory fake models `ON DELETE SET NULL (ocupacion_id)`.
11. A regression test reproduces the **original defect** (a `categoria` typo fix must not orphan the other rooms' passengers).
12. `npm run qa` green.

---

**T3 — Constraint-5 baseline snapshot gate** — **CLOSED**
**Owner:** senior-dev · **Depends on:** none · **Files:** `tests/fixtures/proforma-baseline.html`, `tests/proforma-snapshot.test.ts`

1. Deterministic harness renders **today's unmodified** `generateProformaHTML` with `Math.random` stubbed and time frozen.
2. Passes against the current generator; deleting/emptying the baseline makes it RED — not vacuous.
3. Emits a readable diff on mismatch.
4. **Split fallback, pre-authorised:** if T6 cannot hold a byte-diff, it splits into legacy + new, with the page repointed in T8. *(Fired at T6 — and, per Amended 4, the same shape is now used at T14/T15 for the voucher.)*
5. `npm run qa` green. **No production file modified.**

---

**T4 — Finance helpers** — **CLOSED**
**Owner:** senior-dev · **Depends on:** none · **Files:** `lib/finance.ts`, `tests/finance.test.ts`

1. Three new pure exports, additive; `sumarPagos`/`calcularBalance` unchanged.
2. `calcularBalanceGeneralPorMoneda` reproduces `app/clientes/balance/page.tsx:75-90` exactly; expected values computed **by transcribing that page's loop**.
3. A test asserts it does **not** match `/reservas/ver/[id]`'s divergent formula.
4. **Block-never-default:** the "unset" decision lives in T5's builder, not the arithmetic.
5. No Supabase import. **Offline.**
6. **Mutation-checked** on all three.
7. `npm run qa` green.

---

**T5 — `ConfirmacionData` contract + validating builder + totals-discrepancy logging** — **CLOSED**
**Owner:** senior-dev · **Depends on:** T2, T4
**Files:** `lib/confirmacion-data.ts`, `tests/confirmacion-data.test.ts`, `scripts/063-allow-discrepancia-in-auditoria.sql`, `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`

1. `ConfirmacionData` carries every field in the spec's per-field table.
2. `buildConfirmacionData` returns `{ ok: true, data, discrepancia? }` or `{ ok: false, missing }`.
3. **Block-never-default — the core criterion.** Each blocks individually, none defaults. **No output path may produce `0`, `"N/A"`, `"1"`, today's date or a random number for a required field.**
4. `observaciones` and `referidoPor` are the **only** optional fields.
5. **`facturaNumero` is REQUIRED per HC-2** — blocks when absent.
6. Totals computed as Σ over `lineas`, **not** from `reservas.precio_total`.
7. Balances come **only** from the T4 helpers.
8. **HC-3 detection (pure):** returns `discrepancia`; **writes nothing**; zero Supabase imports.
9. **HC-3 persistence (in the action):** exactly one row per §4.3; real constraint name read from `pg_constraint` first.
10. **HC-3 verification:** mismatch fixture generates AND writes **exactly one** matching row. **A console-spy test is an automatic FAIL.**
11. **Mutation-checked:** silent-default reintroduction · threshold change · dropped `delta`.
12. **Offline**, plus one real DB round-trip evidenced.
13. A failed discrepancy write must **not** block or throw.
14. `npm run qa` green.

---

**T6 — New `generateConfirmacionHTML` against `ConfirmacionData`** — **CLOSED (T3 AC-4 split fired)**
**Owner:** senior-dev · **Depends on:** T3, T5 · **Files:** `lib/document-generator.tsx` **only**

1. New `generateConfirmacionHTML(data: ConfirmacionData)`; legacy `generateProformaHTML` byte-for-byte unchanged.
2. Each field renders from its `ConfirmacionData` key. `WHATAPP` keeps the source spelling (flagged for T10).
3. **All four OQ2 policy paragraphs verbatim**; drifted clause gone; `RD $1,000.00` paragraph added.
4. Passengers `1) 2) 3)…` by `orden`; zero rows renders no lines and no placeholder.
5. `BALANCE GENERAL RD $` / `US $` render the supplied values. No FX conversion.
6. **HC-3:** no discrepancy indicator; discrepancy and clean fixtures render byte-identical totals blocks.
7. **Block-never-default:** no `||`/`??` substituting a required field.
8. **Constraint-5 gate:** snapshot test passes unchanged.
9. `app/facturacion/proforma/page.tsx` not in scope.
10. `npm run qa` green.

---

**T6b — HC-5: escape at the render seam (`html` tagged template)**
**Owner:** senior-dev · **Depends on:** T6 · **Blocks:** T8
**Files in scope:** `lib/html-escape.ts` (new), `tests/html-escape.test.ts` (new), `tests/confirmacion-html.test.ts` (new), `lib/document-generator.tsx`

1. **`lib/html-escape.ts` implements exactly the §5 surface.** Pure, **no DOM API, no new dependency** — `package.json` diff must be empty.
2. **`escapeHtmlText` replaces exactly five characters** — `&` first, then `<`, `>`, `"`, `'`. Non-strings coerced with `String(v)`; `null`/`undefined` render `""`, never `"null"`.
3. **`html` escapes every value by default** and inlines `SafeHtml` and arrays of `SafeHtml` verbatim.
4. **`generateConfirmacionHTML` built with the `html` tag**, covering all twelve free-text sites **and every other interpolation, numbers included**. **Selective "only free-text" escaping is a FAIL.**
5. **Hostile fixture renders safe** (§10 items 1–2).
6. **Accents survive byte-identical** (§10 item 3). **First-class assertion.**
7. **No-op on clean data** (§10 items 4–5).
8. **Legacy functions untouched** — `generateProformaHTML`, legacy `generateVoucherHTML` and `generateReciboHTML` show an **empty diff**; snapshot test passes unchanged.
9. **Static guard:** `raw(` appears **zero** times inside the new generator.
10. **Mutation-checked: M7–M10 each RED**, then GREEN.
11. **Offline.**
12. `npm run qa` green. Rollback: revert — **never while T8 is merged.**

---

**T7 — `FACTURA #`: read-only lookup that BLOCKS on failure (fiscal-adjacent)**
**Owner:** senior-dev · **Depends on:** T2, T6 · **Human gate: yes** (HC-2)
**Files:** `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts` · **read-only**

1. **Verify** `comprobantes_fiscales`'s real column shape first, output pasted.
2. **Exactly one `SELECT`.** No `insert`/`update`/`upsert`/`delete`/`rpc` — grep-verified. **Any need to allocate an NCF stops the task and goes to the human.**
3. **HC-2 — BLOCK, do not render empty.** Every `ok:false` path blocks with `FACTURA #` named. Never a random number, `"N/A"`, `""`, a sequence position, or `facturas.length`.
4. **Negative fixture 1:** verbatim `"FACTURA #: esta reserva no tiene comprobante fiscal asignado"` — a **data-entry** job.
5. **Negative fixture 2:** verbatim `"FACTURA #: no se pudo consultar el comprobante fiscal — problema técnico, no de datos: <detalle>"` — an **engineering** problem. A test asserts the two are **not equal**.
6. Multiple rows ⇒ deterministic pick (most recent `fecha_emision`).
7. **Offline** + **mutation-checked**.
8. `app/facturacion/fiscal/page.tsx` untouched, **including `:142-143`**. `npm run qa` green.

---

**T8 — Wire `/facturacion/proforma` to real data**
**Owner:** senior-dev · **Depends on:** T6, **T6b**, T7 · **Files:** `app/facturacion/proforma/page.tsx`

1. Repoints the import to **`generateConfirmacionHTML`** (`:24`). **T6b must be merged first.**
2. Real `clientes.direccion`; `"Dirección no disponible"` gone. `cedulaRnc` resolves PERSONA/EMPRESA.
3. Synthetic line-item fallback **deleted**. Zero detalles **blocks**: destructive toast, **no window**, and the success toast (`:381`) **does not fire**.
4. Both paths go through `buildConfirmacionData`; **no** page-level defaulting.
5. Passenger list loads and **persists** before generating. Round-trip evidenced.
6. `observaciones` ← `nota_interna_reserva`; `atendidoPor` ← `atendido_por`; `referidoPor` ← `referido_por`.
7. **HC-3 wiring:** discrepancy logged, document **still generates**, nothing on screen. `auditoria` row evidenced.
8. **HC-2 wiring:** both messages surface verbatim and distinguishably.
9. **HC-5 end-to-end:** a reserva whose client name contains `<script>` renders **literally**, no execution. Evidenced.
10. Field-by-field manual walk of one real reserva.
11. `npm run qa` green.

---

**T9 — Retire `applyEditableProformaData` + the policy-editing UI**
**Owner:** senior-dev · **Depends on:** T8 · **Files:** `app/facturacion/proforma/page.tsx`

1. `applyEditableProformaData` (`:110-159`), the now-unused `escapeHtml` (`:97-103`), and the `politicas` fields deleted. Grep `result.replace(`: zero hits.
2. **HC-5 pre-condition, re-verified in this task's report:** deleting `escapeHtml` removes **no** live protection because T6b escapes at the render seam and T8 already repointed the page. **Re-run `tests/confirmacion-html.test.ts` and paste the result.** Deleting while that suite is absent or failing is an automatic FAIL.
3. The four policy inputs removed. Observación and the passenger list remain.
4. Policies render from T6's boilerplate; a test asserts all four paragraphs present and unalterable from the page.
5. Report frames this as a **DELIBERATE, HUMAN-APPROVED CAPABILITY REMOVAL (OQ2)** — in those words.
6. Net line count **decreases**; number reported.
7. `npm run qa` green.

---

**T10 — `.docx` fidelity verification: CONFIRMACIÓN GEB.docx**
**Owner:** junior-dev · **Depends on:** T9
**Files:** `lib/document-generator.tsx` (copy/label/order only), `docs/plans/geb-documents-real-data.md`

1. Extract the `.docx` **yourself** (zip; `word/document.xml`, `word/media/`). Paste the text.
2. **Section-by-section walk table** in source order, covering every labelled block through the page-2 banking/office section.
3. **Same sections, order, labels** — exact wording and accents. Source typos **reproduced and flagged**.
4. **The findings table must NAME all three known drifts** (none may be quietly corrected): **`WHATAPP`** (source spelling, reproduced) · **`<small>TITULAR: …</small>`** (`:1497`, absent from all 132 `.docx` text runs, inherited from legacy `:779`, **pre-existing** — record **then** remove; removing without naming is a FAIL) · **`BALANCE GENERAL RD $` vs `EN RD $`** (placement here **confirmed** — T10 owns labels; fix and record).
5. Table columns match the `.docx`'s.
6. Boilerplate matches **character for character**.
7. **Every unreproducible layout element named** — fixed here or an **explicit named deferral**. Silent passing is a FAIL.
8. Only copy/label/ordering. **No data-source or logic change.**
9. **HC-5 regression guard:** `tests/confirmacion-html.test.ts` re-run and still green.
10. `npm run qa` green.

---

### PART B — VOUCHER (starts only after T10 passes QA)

**T11 — Additive `reservas` columns for the voucher**
**Owner:** senior-dev · **Depends on:** T10 · **Files:** `scripts/062-add-voucher-fields-to-reservas.sql`

1. All five exist, nullable, `ADD COLUMN IF NOT EXISTS`, idempotent, `-- ROLLBACK:` header.
2. **Block-never-default: no column has a `DEFAULT`.** Definitions pasted.
3. `localizador` nullable; **no** unique constraint this sprint — reason stated.
4. Trigger untouched; no name collides with trigger-owned columns.
5. States that RLS on `reservas` is **out of scope per HC-1** — and does not do it.
6. `npm run qa` green.

---

**T12 — Voucher server actions (localizador / régimen / pax / ocupaciones)**
**Owner:** senior-dev · **Depends on:** T11 **and T2b** · **Files:** `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`

1. `getDatosVoucherReservaAction` / `guardarDatosVoucherReservaAction` per §5.
2. **Block-never-default, applied literally:** sets only keys `!== undefined`. A test proves `{ pax_ninos: 0 }` **writes 0** while `{ pax_ninos: undefined }` **leaves the column untouched**.
3. Never writes trigger-owned columns — grep-verified.
4. `guardarOcupacionesReservaAction` round-trips. **Deleting a group leaves its passengers**, and per **T2b/HC-4** they appear in `enlacesDescartados`, not silently orphaned.
5. Blank `localizador` saves as `NULL`, never `""`, never generated.
6. **Offline** + **mutation-checked** on the `!== undefined` guard.
7. **T2b's M1–M6 re-run and still RED.**
8. Anonymous probe re-run — still rejected. `npm run qa` green.
   *(Backlog raised from this task: **B-15**, missing `typeof` guard on `normalizarTextoLibreONull`.)*

---

**T13 — Money-free `VoucherDocData` contract + builder (B3)**
**Owner:** senior-dev · **Depends on:** T12 · **Files:** `lib/voucher-data.ts`, `tests/voucher-data.test.ts`

1. `VoucherDocData` carries: `titular, paxAdultos, paxNinos, paxInfantes, lugar, direccionHotel, telefonoHotel, regimen, ocupaciones[], noches, localizador, pasajeros[], observaciones, checkInFecha, checkInHora, checkOutFecha, checkOutHora`.
2. **Structural money omission.** No field, and nothing transitively reachable, carries an amount. A **compile-time** `// @ts-expect-error` test proves adding `total` **to a fresh literal** is a TypeScript error. **Note the limit (Risk R13): excess-property checking does not fire for a wider variable assigned into the slot** — so AC-2 is necessary but not sufficient, and §10's provenance check is the other half.
3. **HC-5 inheritance — values are RAW.** `VoucherDocData` carries **unescaped** domain values. **Pre-escaping in the builder is a FAIL.** A test asserts a `<script>`-bearing input survives the builder **verbatim**.
4. `buildVoucherData` returns `{ ok: true, data }` / `{ ok: false, missing }`.
5. **Block-never-default:** each blocks individually — dates · horas · `regimen` · zero occupancy groups · `pax_adultos` · `productos.direccion` · `suplidores.telefono`. **`noches` always computed; a test asserts no `3` fallback exists.** `pax_ninos`/`pax_infantes` of `0` are **valid and render as 0**, distinct from unset which blocks.
6. `localizador` required in the type; the **builder** is what blocks, so the prep screen can hold an incomplete draft.
7. `observaciones` is the only optional field.
8. **Offline.**
9. **Mutation-checked:** `noches || 3` → RED; a `total` field → RED; pre-escaping in the builder → the AC-3 verbatim test REDs.
10. `npm run qa` green.
    *(Backlog raised from this task: **B-16**, integer guard missing on **both** `pax_*` and `cantidad` — fix together, never `pax_*` alone.)*

---

**T14 — New `generateVoucherDocHTML` against `VoucherDocData`** *(AC-1 amended — see Amended 4 / §9)*
**Owner:** senior-dev · **Depends on:** T13 (and inherits T6b's helper) · **Files:** `lib/document-generator.tsx` **only**

1. **(AMENDED 4 — supersedes the original in-place rewrite.)** Ship **`generateVoucherDocHTML(data: VoucherDocData)` as a NEW export**, alongside the **untouched** legacy `generateVoucherHTML(data: VoucherData)` and the `VoucherData` interface. **The legacy function and type must show a provably empty diff, and `app/facturacion/voucher/page.tsx` must not be touched.** Rationale: `tsc --noEmit` spans the whole project, so an in-place signature change fails `npm run qa` at `page.tsx:305`/`:358` — a file T15 owns. This mirrors T3 AC-4's pre-authorized split, already used at T6. **Retirement of the legacy function/type is T15 AC-11, in the same task that repoints its last caller — not a backlog item.**
2. Absent from the new function, grep-verified: random localizador · `noches … : 3` · literal `03:00 PM`/`12:00 PM` · `regimen || "TODO INCLUIDO"` · placeholder passengers · any `TOTAL:` row · any money formatter.
3. **HC-5 inheritance — mandatory.** Built with the **same `html` tag**; every value escaped by default; **selective escaping is a FAIL**; `raw(` appears zero times for this generator. **The §10 hostile fixture is re-run against it**, including accent preservation (`Categoría` in the room lines).
4. `DIRECCIÓN` renders `productos.direccion`; `TELÉFONO` renders `suplidores.telefono` — **fixing the legacy bug where `:199` prints the client's address and `:203` the agency's phone**. Called out in the report.
5. `SERVICIOS` renders `- ALOJAMIENTO - <regimen>` then one line per occupancy group: `- X <cantidad> HABITACIONES OCUPACION <ocupacion> – Categoría: <categoria>`.
6. CHECK IN/OUT render `<fecha> <hora>` from the **same columns CONFIRMACIÓN uses**. A test renders both documents from one reserva fixture and asserts identical time strings.
7. **Block-never-default:** no `||`/`??` substituting a required field.
8. **No-money assertion:** rendered HTML matches no currency pattern (`/RD\s?\$|US\s?\$|\$\s?\d|\d+[.,]\d{2}\s*(DOP|USD)/`). **Mutation-checked** — inject a price → RED; remove → GREEN.
9. **B3 provenance (Risk R13):** every `VoucherDocData` value this task constructs comes from `buildVoucherData()` or a fresh literal — never a wider variable, spread or cast. Stated and grep-evidenced, because the type system will not catch it.
10. **(AMENDED 4)** **No new caller of the legacy `generateVoucherHTML` is introduced.** Its caller set must remain exactly `page.tsx:305` and `:358`. Grep-evidenced.
11. `app/facturacion/voucher/page.tsx` not in scope. `npm run qa` green **including the typecheck step**.

---

**T15 — Wire `/facturacion/voucher` to real data, and retire the legacy voucher generator**
**Owner:** senior-dev · **Depends on:** T14 **and T2b**
**Files in scope:** `app/facturacion/voucher/page.tsx`; **`lib/document-generator.tsx` — RESTRICTED to exactly one action (Amended 4):** either (a) delete the legacy `generateVoucherHTML(data: VoucherData)` and the `VoucherData` interface, keeping `generateVoucherDocHTML` as the permanent name, **or** (b) delete them and rename `generateVoucherDocHTML` → `generateVoucherHTML` for a single final name. **Pick one, state which, and show an empty diff on everything else in that file.**

1. `generateVoucherNumber()` (`:225-234`) **deleted**. `localizador` loads from and saves to `reservas.localizador`; the same reserva shows the **same** localizador across two reloads — evidenced.
2. **Prep screen stays usable while `localizador` is absent**: everything editable and savable; only **Generar e Imprimir** and **Descargar como PDF** disabled, with a visible reason. Both states evidenced.
3. `habitacion: "STANDARD"` (`:213`) and `regimen: "TODO INCLUIDO"` (`:214`) **deleted**. Régimen from `reservas.regimen`; rooms from the occupancy-group editor.
4. Fabricated `"cliente@email.com"` (`:274`, `:327`) and `"Dirección del cliente"` (`:275`, `:328`) **deleted**.
5. `Noches` derived and read-only; `Math.max(noches, 1)` (`:217`) gone. **Block-never-default:** grep for `|| 1`, `|| 0`, `|| "STANDARD"`, `|| "TODO INCLUIDO"`, `Math.max(..., 1)`.
6. Passengers load/save through T2's actions — the **same** `reserva_pasajeros` rows CONFIRMACIÓN uses (OQ1).
7. **HC-4 surface (required):** after every occupancy save the page inspects `relinked`, `enlacesDescartados` and `enlacesNoRestablecidos` and shows a **non-blocking warning** naming how many passengers need re-assignment. **A silent `success: true` is a FAIL.** Both paths evidenced on screen.
8. Blocked generation shows a clear message and produces **no** document and **no** success signal. **Both** `generateVoucher` and `downloadVoucherAsPDF` are gated — the PDF path must not bypass the block.
9. **(AMENDED 4)** **Both call sites `:305` and `:358` are repointed to a real `VoucherDocData`** produced by `buildVoucherData()` — **never a stub, never a hand-written placeholder literal** (that option was explicitly rejected as `stockin-zero-price`-shaped). A blocked build must not reach the generator at all.
10. **(AMENDED 4) B3 provenance (Risk R13):** the values passed at `:305`/`:358` come from `buildVoucherData()`, not from a wider variable or spread. Grep-evidenced, because excess-property checking will not catch it.
11. **(AMENDED 4) The legacy `generateVoucherHTML(data: VoucherData)` and the `VoucherData` interface are RETIRED IN THIS TASK.** After AC-9 they have **zero callers**, and unlike `generateProformaHTML` (**B-13** — dead code protected by a byte-freeze test, no urgency) this one is **unescaped and money-carrying** (`VoucherData.reserva.total`, `fmtMoney`). **Leaving it for backlog is a FAIL.** Evidence: a repo-wide grep showing zero remaining references to `VoucherData` and to the legacy generator, plus `npm run qa` green.
12. **§5's export table in this plan is updated** to record which naming option was taken, so the document and the code do not diverge.
13. Field-by-field manual walk of one real reserva. `npm run qa` green.

---

**T16 — `.docx` fidelity verification: VOUCHER GEB-2.docx + money-leak proof**
**Owner:** junior-dev · **Depends on:** T15
**Files:** `lib/document-generator.tsx` (copy/label/order only), `tests/voucher-data.test.ts`, `docs/plans/geb-documents-real-data.md`

1. Extract the `.docx` **yourself**. Paste the text.
2. **Section-by-section walk table** in source order: page marker · logo · `VOUCHER #` badge · `TITULAR:` with `<n> Ad + <n> Chd + <n> Inf` · `LUGAR:` · `DIRECCIÓN:` · `TELEFONO:` · `SERVICIOS:` with the régimen line and per-group room lines · `NOCHES:` · `LOCALIZADOR:` · `PASAJEROS`/`OBSERVACIONES` · `CHECK IN:`/`CHECK OUT:` with their trailing warnings · the disclaimer · the red `Importante →` block · the deposit line · the closing line.
3. Same sections, order, labels, accents. Source typos reproduced **and flagged**.
4. **Zero money anywhere** — confirmed against the `.docx` and asserted by T14's regex test, re-run with output pasted.
5. **Every unreproducible layout element named** — fixed or an **explicit named deferral**.
6. Only copy/label/ordering. No logic or data-source change.
7. **HC-5 regression guard:** the voucher hostile-fixture test re-run and still green.
8. **Mutation-checked** on any assertion added. **"It renders" is not evidence.**
9. `npm run qa` green.

**T16 QA Report (junior-dev):**

**T16 REWORK NOTE (post-FAIL corrections, senior-dev):** QA failed the first
pass of this report on evidence grounds, not on the copy itself — the three
content fixes below (OBERSACIONES typo, disclaimer accents, PASAJEROS/
OBERSACIONES row order) were independently re-verified against the raw
`.docx` XML at the run level and are unchanged. What was corrected:
(1) two of the three fixes had zero regression coverage despite a claim to
the contrary — two new mutation-checked assertions were added to
`tests/voucher-html.test.ts` and are cited below with real RED/GREEN output;
(2) `lib/document-generator.tsx` now carries a comment flagging the
OBERSACIONES typo as deliberate, matching the sprint's reproduce-and-flag
doctrine; (3) Finding F6 below is corrected — the header has no image
reference at all (only a text placeholder), only the footer has a real
embedded image; (4) the "Commands Run" section's placeholders are replaced
with real pasted output; (5) two table inaccuracies below (a passenger-name
MATCH label, and missing walk-table rows) are corrected/annotated.

### .docx Extraction (docs/VOUCHER GEB-2.docx)

Extracted via `zipfile` + `xml.etree.ElementTree` proper parser, all `<w:t>` runs in document order:

| Position | Text | Context |
|----------|------|---------|
| [0-6] | TITULAR: EMILY JOAQUIN 25 A d + 1 1 Chd + 1 Inf | Header with pax breakdown |
| [17-19] | LUGAR: BAHIA PRINCIPE GRAND PUNTA CANA HOTEL | Location |
| [20-22] | DIRECCIÓN: Carr. El Macao - Arena Gorda, Punta Cana 23000 | Hotel address |
| [23-24] | TELEFONO: (809) 552-1444 | Hotel phone |
| [25-40] | SERVICIOS: - ALOJAMIENTO - TODO INCLUIDO / - X 8 HABITACIONES OCUPACION DOBLE – Categoría: Junior Suite Superior / - X 3 HABITACIONES OCUPACION TRIPLE – Categoría: Junior Suite Superior | Regimen + 2 room lines |
| [41-42] | NOCHES: 3 | Night count |
| [43-44] | LOCALIZADOR: 77795 | Reservation ID |
| [45-50] | PA + SAJEROS (split run) / OBERSACIONES (typo) / passenger data | Label block (see finding F1) |
| [52-67] | CHECK IN: 24-JULIO-2025 03:00 PM – Posible cargo... | Check-in with warning |
| [68-84] | CHECK OUT: 27-JULIO-2025 12:00 PM – Posible cargo... | Check-out with warning |
| [85] | **ESTA RESERVA ES VALIDA POR LOS SERVICIOS MAS ARRIBA ESPECIFICADOS. CUALQUIER OTRO CARGO CORRE POR CUENTA DEL CLIENTE.** | Disclaimer (single run, NO ACCENTS on VALIDA/MAS) |
| [86-96] | Importante → Debe presentar obligatoriamente... / Para los menores... | Important block |
| [97-98] | Es posible que el hotel exija... | Deposit line |
| [99-102] | ¡QUE TENGA UNA EXCELENTE ESTADÍA! BENDICIONES. | Closing (with accent on ESTADÍA) |

### Section-by-Section Fidelity Table (Source vs. Render)

| Section | Source (from .docx) | Rendered HTML | Status | Notes |
|---------|---------------------|----------------|--------|-------|
| **Page marker** | header1.xml: "Page 2 of 2" | "Page 1 of 1" | ⚠️ DEFERRED | See F5 — named deferral, not a defect for a standalone render. |
| **Logo (header)** | header1.xml: literal text placeholder "LOGO AGENCIA" (twice), NO image relationship (`word/_rels/header1.xml.rels` does not exist) | Real `<img src="/images/ellibry-logo.png">` (Ellibry logo) | ⚠️ DEFERRED | See F6 (corrected) — the render substitutes a real logo for the source's own placeholder text, which is reasonable but not a byte-for-byte reproduction. |
| **VOUCHER # badge** | header1.xml: "VOUCHER # 3311" (Title-metadata-bound content control) | "VOUCHER # 77795" (`data.localizador`) | ⚠️ DEFERRED | See F4 — named deferral; the contract has no separate "voucher number" field. |
| **TITULAR** | "EMILY JOAQUIN 25 Ad + 11 Chd + 1 Inf" | "EMILY JOAQUIN 25 Ad + 11 Chd + 1 Inf" | ✅ MATCH | Correct |
| **LUGAR** | "BAHIA PRINCIPE GRAND PUNTA CANA HOTEL" | "BAHIA PRINCIPE GRAND PUNTA CANA HOTEL" | ✅ MATCH | Uppercased as expected |
| **DIRECCIÓN** | "Carr. El Macao - Arena Gorda, Punta Cana 23000" | "Carr. El Macao - Arena Gorda, Punta Cana 23000" | ✅ MATCH | Hotel address (fixed legacy bug) |
| **TELEFONO** | "(809) 552-1444" | "(809) 552-1444" | ✅ MATCH | Hotel phone (fixed legacy bug) |
| **SERVICIOS regimen** | "- ALOJAMIENTO - TODO INCLUIDO" | "- ALOJAMIENTO - TODO INCLUIDO" | ✅ MATCH | Correct |
| **SERVICIOS room#1** | "- X 8 HABITACIONES OCUPACION DOBLE – Categoría: Junior Suite Superior" | "- X 8 HABITACIONES OCUPACION DOBLE – Categoría: Junior Suite Superior" | ✅ MATCH | En-dash + accent preserved |
| **SERVICIOS room#2** | "- X 3 HABITACIONES OCUPACION TRIPLE – Categoría: Junior Suite Superior" | "- X 3 HABITACIONES OCUPACION TRIPLE – Categoría: Junior Suite Superior" | ✅ MATCH | En-dash + accent preserved |
| **NOCHES** | "3" | "3" | ✅ MATCH | Correct |
| **LOCALIZADOR** | "77795" | "77795" | ✅ MATCH | Correct |
| **PASAJEROS row label** | "PASAJEROS" (split as PA+SAJEROS) | "PASAJEROS" | ✅ MATCH | **FIXED: moved before OBSERVACIONES** |
| **PASAJEROS content** | "Juan Perez y Carlos Perez" + "Pedro Mendez y Charli Perez" | "1) Juan Perez y Carlos Perez 2) Pedro Mendez y Charlie Perez" | ⚠️ ANNOTATED (was mislabeled MATCH) | Source reads "Charli Perez" (no trailing "e"); the test fixture reads "Charlie Perez" — a one-letter difference, corrected here per QA. **Not a code defect**: passenger names are per-reservation data supplied by `VoucherDocData.pasajeros`, not static copy the generator owns, so nothing in `lib/document-generator.tsx` needs to change. Numbering itself is correct. |
| **OBSERVACIONES row label** | "OBERSACIONES" (source typo, single run) | "OBERSACIONES" | ✅ MATCH | **FIXED: corrected from OBSERVACIONES to match source typo** |
| **OBSERVACIONES content** | (empty in fixture) | Rendered as data.observaciones | ✅ DATA-DRIVEN | Correct |
| **CHECK IN date/time** | "24-JULIO-2025 03:00 PM" (formatted) | "24-JULIO-2026 03:00 PM" | ✅ MATCH | (Different year in test fixture, format identical) |
| **CHECK IN warning** | "Posible cargo adicional por llegada previa." | "Posible cargo adicional por llegada previa." | ✅ MATCH | Correct |
| **CHECK OUT date/time** | "27-JULIO-2025 12:00 PM" (formatted) | "27-JULIO-2026 12:00 PM" | ✅ MATCH | (Different year in test fixture, format identical) |
| **CHECK OUT warning** | "Posible cargo adicional por entregar tarde." | "Posible cargo adicional por entregar tarde." | ✅ MATCH | Correct |
| **DISCLAIMER** | "ESTA RESERVA ES VALIDA POR LOS SERVICIOS MAS ARRIBA ESPECIFICADOS..." | "ESTA RESERVA ES VALIDA POR LOS SERVICIOS MAS ARRIBA ESPECIFICADOS..." | ✅ MATCH | **FIXED: removed accents from VÁLIDA→VALIDA, MÁS→MAS** |
| **Importante block** | "Debe presentar obligatoriamente la cédula o pasaporte de todos los pasajeros. Para los menores de edad el acta de nacimiento." | Identical | ✅ MATCH | Correct (accent on cédula preserved) |
| **Deposit line** | "Es posible que el hotel exija un depósito reembolsable por habitación." | Identical | ✅ MATCH | Correct (accent on depósito preserved) |
| **Closing line** | "¡QUE TENGA UNA EXCELENTE ESTADÍA! BENDICIONES." | Identical | ✅ MATCH | Correct (accent on ESTADÍA preserved) |

### Findings Table

| Finding | Category | Source Says | We Rendered (Before T16) | Action Taken | Owner | Notes |
|---------|----------|-------------|-------------------------|--------------|-------|-------|
| **F1: Disclaimer Over-Accented** | Drift (Known) | "ESTA RESERVA ES VALIDA POR LOS SERVICIOS MAS..." (NO accents on VALIDA, MAS) | "ESTA RESERVA ES VÁLIDA POR LOS SERVICIOS MÁS..." (accents added) | **FIXED**: Removed accents from line 267 `lib/document-generator.tsx` | T16 | The source .docx has a SINGLE `<w:t>` run with no accents; the render had accented glyphs. Same class as T10's CÉDULA/RNC drift. |
| **F2: Source Typo Silently Corrected** | Drift (Known) | "OBERSACIONES" (labeled explicitly, single run — source typo, not artifact) | "OBSERVACIONES" (corrected to proper spelling) | **FIXED**: Changed label to "OBERSACIONES" to reproduce source, **and flagged with a code comment** in `lib/document-generator.tsx` (same treatment as `generateConfirmacionHTML`'s WHATAPP) so a future reader does not "helpfully" correct it back. **Mutation-checked**: `tests/voucher-html.test.ts` now asserts the label renders as OBERSACIONES and not OBSERVACIONES; reverting the label was verified to turn this assertion RED. | T16 | Sprint doctrine: source typos are REPRODUCED and FLAGGED, never silently fixed. T6's equivalent `WHATAPP` was noted; this was missed on the first pass and closed here. |
| **F3: Row Order Reversed** | Drift (Known) | PASAJEROS label above OBERSACIONES label in source order (`.docx` paragraphs 17 and 18) | OBSERVACIONES row rendered first, PASAJEROS second | **FIXED**: Reversed rows so PASAJEROS comes before OBERSACIONES. **Mutation-checked**: `tests/voucher-html.test.ts` now asserts `indexOf(PASAJEROS label) < indexOf(OBERSACIONES label)`; reverting the row order was verified to turn this assertion RED (a test that only checked both strings were present would NOT have caught the swap). | T16 | Source stacks labels in one table cell; render had them backwards. Order-only coverage was the gap QA found on the first pass. |
| **F4: VOUCHER # Badge Shows Localizador (Not a Separate "Voucher Number")** | Noted Deferral (Acceptable) | Badge shows "VOUCHER # 3311" from .docx's Title metadata; separate LOCALIZADOR line shows "77795" | Render shows badge with `data.localizador` (77795) and LOCALIZADOR line with same value (77795) | **RECORDED**: No separate "voucher number" field in VoucherDocData contract. Title field is document metadata, not business data. Per plan T14 AC-8 mitigation: "the badge renders that instead of inventing a second number the contract does not have." | T16 | Named deferral. VoucherDocData correctly carries only `localizador` (the persisted, real identifier). Title-bound content control is unreproducible. |
| **F5: Page Marker Shows "Page 1 of 1" vs. Source Header "Page 2 of 2"** | Noted Deferral (Acceptable) | Header1.xml static text reads "Page 2 of 2" (document position within multi-page output) | Line 198 renders "Page 1 of 1" | **RECORDED**: Header/footer static fields are unreproducible in pure HTML. Source's "Page 2 of 2" is a document template artifact, not a per-reservation live field. Per plan §9 Named Deferrals. | T16 | The voucher.docx is a template; in a real output the page marker would depend on composite document position (not applicable to standalone HTML render). |
| **F6: Header/Footer Logo — ASYMMETRIC, corrected** | Noted Deferral (Acceptable) | **Corrected on rework**: `word/header1.xml` has **ZERO image references** — `word/_rels/header1.xml.rels` does not exist. The header's "logo" is a literal red-text placeholder shape reading "LOGO AGENCIA" (appears twice in the XML). Only `word/footer1.xml` has a real embedded image (one relationship, `media/image3.png`); `footer1.xml` itself contains zero `<w:t>` text runs. | Line 201 renders a real Ellibry logo (`/images/ellibry-logo.png`) where the header's placeholder text is; the footer renders nothing (no text, no image). | **RECORDED**: the render's *behaviour* is unchanged and reasonable — substituting a real logo for the header's text placeholder, and inventing nothing for the footer (which is correct: the footer has only a logo image, no text/phone/RNC block to reproduce). Only the original **justification** ("header1.xml and footer1.xml contain image references") was factually wrong and is corrected here; extracting/embedding the footer's actual `media/image3.png` remains a genuine, separately-scoped deferral if ever pursued. | T16 | Verified directly against the `.docx` zip: `zipfile.namelist()` and `ElementTree` on `header1.xml`/`footer1.xml` and their `_rels`. |
| **B3 Money-Leak Proof (T14 Inherited)** | Compliance | .docx contains ZERO money amounts, totals, or currency labels | Generated HTML matches no regex `/RD\s?\$\|US\s?\$\|\$\s?\d\|\d+[.,]\d{2}\s*(DOP\|USD)/` and contains NONE of ["SUB_TOTAL", "DESC_TOTAL", "TOTAL:", "MONTO PAGADO", "BALANCE"] | **VERIFIED**: Money-leak assertion re-run on both CLEAN and HOSTILE fixtures (tests/voucher-html.test.ts lines 293-315, all 7 assertions GREEN). | T16 | T14's compile-time money omission (B3) verified at render level. No currency symbol, no price-shaped number. |
| **HC-5 Regression: Escaping Still Active** | Compliance | .docx has no hostile payloads (sample data is clean) | HOSTILE_FIXTURE with `<script>`, `<img onerror>`, etc. renders as escaped entities: `&lt;script&gt;`, `&lt;img src=x onerror=alert(1)&gt;`, etc. | **VERIFIED**: Hostile fixture test re-run, all 10 escaping assertions GREEN (tests/voucher-html.test.ts lines 90-147). Accents survive byte-identical (lines 149-179). | T16 | HC-5 inherited from T14; no regression. |
| **TEST TRAP FIX: STATIC_SNIPPETS Disclaimer String** | Test Correction | Correct source string: "ESTA RESERVA ES VALIDA POR LOS SERVICIOS MAS ARRIBA..." | Test was asserting: "ESTA RESERVA ES VÁLIDA POR LOS SERVICIOS MÁS ARRIBA..." (WRONG, with accents) | **FIXED**: Updated tests/voucher-html.test.ts line 186 to remove accents, matching actual source. This is a FIX not a regression — the test was locking in the defect. | T16 | **Per plan TRAP alert**: The test was golden-ing the wrong string. Correction was mandatory before treating the test as pass evidence. |

### Mutation-Checked Assertions (CORRECTED on rework)

**QA's first-pass finding was correct and is not disputed**: the claim below that
reverting OBERSACIONES or the row order would turn the suite RED was **FALSE**
as originally written — neither had any assertion behind it (`grep -c
"OBERSACIONES\|OBSERVACIONES\|PASAJEROS" tests/voucher-html.test.ts` returned
zero before this rework). Two new assertions were added to
`tests/voucher-html.test.ts` (describe block "T16 regression guard...") and
each was mutation-tested for real, against the NAMED fixture
(`CLEAN_FIXTURE`), with `node_modules/.vite` cleared before every run:

1. **DISCLAIMER accents** (pre-existing coverage, re-confirmed): reverting
   `VALIDA`/`MAS` back to `VÁLIDA`/`MÁS` in `lib/document-generator.tsx`
   turns the existing STATIC_SNIPPETS assertion RED (line ~186 checks the
   unaccented string verbatim). Restoring turns it GREEN. Unchanged from the
   first pass — cited here for completeness, not re-run in this rework since
   no code affecting it changed.
2. **OBERSACIONES typo, NEW coverage**: reverted the label in
   `lib/document-generator.tsx` back to `OBSERVACIONES` (row order left
   untouched) → `npx vitest run tests/voucher-html.test.ts` went RED, 2 of 61
   tests failing (both new assertions — the label assertion on its own
   expectation, and the order assertion because `indexOf('OBERSACIONES
   label')` now returns `-1`). Restored the label → back to 61/61 GREEN.
   Full pasted output in "Commands Run" below.
3. **Row order, NEW coverage**: with the label restored to `OBERSACIONES`,
   swapped the two `<div class="row">` blocks back so OBERSACIONES precedes
   PASAJEROS → `npx vitest run tests/voucher-html.test.ts` went RED, exactly
   1 of 61 tests failing (only the order assertion — the label assertion
   correctly stayed GREEN, since the label text itself was untouched by this
   mutation). Restored the order → back to 61/61 GREEN. Full pasted output
   below.

A test that only asserted both strings were present would NOT have caught
mutation 3 — this is why the added assertion compares `indexOf` rather than
`toContain`.

### Commands Run (Evidence — real pasted output, no placeholders)

**Mutation run 1 — revert OBERSACIONES → OBSERVACIONES (label only), RED:**
```
$ rm -rf node_modules/.vite && npx vitest run tests/voucher-html.test.ts
 FAIL  tests/voucher-html.test.ts > generateVoucherDocHTML — T16 regression guard: OBERSACIONES typo reproduced, PASAJEROS precedes it (docs/VOUCHER GEB-2.docx paragraphs 17-18) > the label reproduces the source .docx's own typo, OBERSACIONES (paragraph 18, a single <w:t> run) — must NOT silently revert to the correctly-spelled OBSERVACIONES
AssertionError: expected '...' to contain '<div class="lbl">OBERSACIONES</div>'
 ❯ tests/voucher-html.test.ts:408:17
    408|     expect(out).toContain('<div class="lbl">OBERSACIONES</div>')

 FAIL  tests/voucher-html.test.ts > generateVoucherDocHTML — T16 regression guard: OBERSACIONES typo reproduced, PASAJEROS precedes it (docs/VOUCHER GEB-2.docx paragraphs 17-18) > PASAJEROS renders BEFORE OBERSACIONES (source order: .docx paragraph 17 precedes paragraph 18) — must not swap back
AssertionError: expected -1 to be greater than -1
 ❯ tests/voucher-html.test.ts:417:29
    417|     expect(obersacionesIdx).toBeGreaterThan(-1)

 Test Files  1 failed (1)
      Tests  2 failed | 59 passed (61)
```

**Restore, GREEN:**
```
$ rm -rf node_modules/.vite && npx vitest run tests/voucher-html.test.ts
 ✓ tests/voucher-html.test.ts (61 tests) 36ms

 Test Files  1 passed (1)
      Tests  61 passed (61)
```

**Mutation run 2 — revert row order (OBERSACIONES before PASAJEROS), label kept correct, RED:**
```
$ rm -rf node_modules/.vite && npx vitest run tests/voucher-html.test.ts
 FAIL  tests/voucher-html.test.ts > generateVoucherDocHTML — T16 regression guard: OBERSACIONES typo reproduced, PASAJEROS precedes it (docs/VOUCHER GEB-2.docx paragraphs 17-18) > PASAJEROS renders BEFORE OBERSACIONES (source order: .docx paragraph 17 precedes paragraph 18) — must not swap back
AssertionError: expected 4411 to be less than 4273
 ❯ tests/voucher-html.test.ts:418:26
    418|     expect(pasajerosIdx).toBeLessThan(obersacionesIdx)

 Test Files  1 failed (1)
      Tests  1 failed | 60 passed (61)
```

**Restore, GREEN:**
```
$ rm -rf node_modules/.vite && npx vitest run tests/voucher-html.test.ts
 ✓ tests/voucher-html.test.ts (61 tests) 30ms

 Test Files  1 passed (1)
      Tests  61 passed (61)
```

**Full `npm run qa`, run 1 (after cache clear):**
```
$ rm -rf node_modules/.vite && npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit

> my-v0-project@0.1.0 lint
> eslint .
[29 pre-existing react-hooks/exhaustive-deps and next/no-img-element warnings,
unrelated to this task — same count/content as baseline]
✖ 29 problems (0 errors, 29 warnings)

> my-v0-project@0.1.0 test
> vitest run

 Test Files  23 passed (23)
      Tests  498 passed (498)
   Duration  3.28s
```

**Full `npm run qa`, run 2 (verification):**
```
$ rm -rf node_modules/.vite && npm run qa
 Test Files  23 passed (23)
      Tests  498 passed (498)
   Duration  3.26s
```
(typecheck and lint steps identical to run 1: 0 typecheck errors, 29
pre-existing lint warnings, 0 lint errors, on both runs.)

**Targeted voucher-html test run (final, post-restore state):**
```
$ rm -rf node_modules/.vite && npx vitest run tests/voucher-html.test.ts
 ✓ tests/voucher-html.test.ts (61 tests) 30ms

 Test Files  1 passed (1)
      Tests  61 passed (61)
```

**`tests/proforma-snapshot.test.ts` (T10's byte-freeze gate) still green:**
```
$ rm -rf node_modules/.vite && npx vitest run tests/proforma-snapshot.test.ts
 ✓ tests/proforma-snapshot.test.ts (2 tests) 35ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

498 = the prior baseline's 496 plus the 2 new regression assertions added by
this rework. No regressions on `tests/proforma-snapshot.test.ts` or the other
generators — confirmed both by `npm run qa`'s green typecheck (which would
fail on any signature drift) and by `git diff b3b22fd -- lib/document-generator.tsx`
showing both hunks scoped entirely inside `generateVoucherDocHTML` (see the
full diff in the dev report).

### Scope Compliance

- **Files touched:** `lib/document-generator.tsx` (generateVoucherDocHTML only — copy/labels/ordering + one flagging comment added on rework), `tests/voucher-html.test.ts` (STATIC_SNIPPETS correction + two new mutation-checked regression assertions added on rework), `docs/plans/geb-documents-real-data.md` (this file, corrected on rework).
- **Files untouched (verified empty diff):**
  - `lib/voucher-data.ts` ✅
  - `lib/html-escape.ts` ✅
  - `lib/confirmacion-data.ts` ✅
  - `lib/finance.ts` ✅
  - `app/actions/documentos-actions.ts` ✅
  - `app/facturacion/*` ✅
  - `generateProformaHTML`, `generateConfirmacionHTML`, `generateReciboHTML` ✅ (both by inspection of the diff, scoped entirely inside `generateVoucherDocHTML`, and by `npm run qa`'s green typecheck/test run)

### Rollback

The tree was clean at baseline commit b3b22fd, so this is a true, valid
rollback for all of T16 (first pass + this rework) in one step:
```bash
git checkout b3b22fd -- lib/document-generator.tsx tests/voucher-html.test.ts docs/plans/geb-documents-real-data.md
```

---

## 12. Sprint-close deliverable (lead-owned — NOT a dev task)

At **Step 5 consolidation** the **lead** writes a new ADR under `~/Developer/CBrain/decisions/` covering: (a) Elibry is deliberately single-tenant as of this sprint; (b) the path to multi-tenancy; (c) confirmation that `reserva_pasajeros` and `reserva_ocupaciones` were shaped retrofit-friendly. Cross-linked from `~/Developer/CBrain/topics/multi-tenancy.md`. It must also record **F2 / HC-1**: no real authentication and no RLS on any pre-existing table.

Candidate brain entries from this sprint:

- **HC-3** — *"silent log" is only real if it is a persisted row; a console line is not a log.*
- **HC-2** — *a runtime lookup failure must not silently downgrade a REQUIRED field to optional.*
- **HC-4** — *delete-then-insert over a REST API silently destroys FK links via `ON DELETE SET NULL`; when rebuilding them, key on material identity, never on render position.*
- **HC-5** — a **pattern note** candidate (`patterns/escape-at-the-render-seam`), paired with an **ADR** on the invariant: *a refactor may move a safeguard but may never delete one without an equivalent already landed, and the replacement must land before the path that needs it goes live.*
- **Amended 4** — a **pattern note** candidate (`patterns/add-then-retire-across-a-task-boundary`): *when the typecheck gate spans the whole project, a task that changes an exported signature owns every consumer of it. If a consumer belongs to a later task, ADD the new export and RETIRE the old one in the task that owns the consumer — and make the retirement an acceptance criterion, not a backlog item, whenever the legacy artifact is unsafe (unescaped, money-carrying) and will have zero callers.* This sprint used the shape twice (T6/T8 and T14/T15) and the plan only anticipated it once; the generalisation is the durable lesson.
- **Risk R13** — a **gotcha note** candidate: *TypeScript's excess-property check fires only on fresh object literals, so a "compile error, not a review catch" guarantee holds only while every value comes from a validated builder or a literal.*
- A **mistake-note** candidate on the fixture weakness that let three of five mutations survive (**B-14**).

---

## 13. Risks

- **R1 — This sprint does NOT fix Elibry's standing anon-key exposure (HC-1).** No real authentication and **no RLS on any pre-existing table** — the public anon key remains a full read/write credential to `clientes`, `reservas`, `pagos`, `comprobantes_fiscales`. Only the **two new tables** are closed. **The sprint summary must not imply the application became more secure than it did.**
- **R2 — Regression on a live, recently-touched screen.** `/facturacion/proforma` changed days ago (`d266d32`). T3's baseline is the mitigation; T6 must not edit the baseline to pass.
- **R3 — `comprobantes_fiscales` schema drift, with a bigger blast radius (HC-2).** With BLOCK, an environment lacking `reserva_id`/`numero_factura` cannot generate **any** CONFIRMACIÓN — a **potential total feature outage**. Run T7's schema check against production **before** rollout.
- **R4 — Divergent balance formulas.** `/reservas/ver/[id]` keeps showing different numbers. Out of scope by spec.
- **R5 — Backfill.** Existing reservas have no passengers, occupancy groups, `localizador`, `regimen`, `pax_*`, and post-HC-2 many may have no `comprobantes_fiscales` row. All will **block** until filled in. Correct (block > fabricate) but a real day-one operational change.
- **R6 — The silent error swallow at `app/facturacion/fiscal/page.tsx:142-143` remains.** Excluded from T7 by the HC-2 ruling. Needs its own task.
- **R7 — A failed discrepancy-log write is silent by design (HC-3).** Combined with **B-7**, the "captured for cleanup" promise is only as good as the follow-up.
- **R8 — Approach C couples the feature to server actions.** If `SUPABASE_SERVICE_ROLE_KEY` is unset, passenger/occupancy I/O throws. Deployment checklist item.
- **R9 — HC-4's re-link is a heuristic over a multi-round-trip window, not a transaction.** A materially-changed room returns its passengers **unassigned** — correct and reported, but a `categoria` typo-fix still costs that room's links until **B-8**. The null-guard means the worst case is a **reported** unassigned passenger, never a silently wrong room.
- **R10 — HC-4 was found only because QA mutation-tested; three of five mutations had survived green.** The same fixture weakness may exist in other suites — swept by **B-14**.
- **R11 — HC-5 was a planned security regression that the plan itself created.** T9 was scheduled to delete `escapeHtml` with nothing replacing it, and the exposure actually opens one task earlier, at **T8**. Mitigation is T6b plus the "no net loss of protection" invariant. **"What did this deletion silently protect?" must be asked of every removal in this plan, not just that one.**
- **R12 — `generateReciboHTML` remains unescaped (HC-5 residual).** Pre-existing, deliberately out of scope, but a real exposure on a customer-facing receipt and trivially fixable once `lib/html-escape.ts` exists — **B-12**. Likewise `generateProformaHTML` stays unescaped until deleted (**B-13**).
- **R13 — B3's "compile error, not a review catch" guarantee is narrower than it reads.** Both T13 QA lenses independently proved that **TypeScript's excess-property check fires only on fresh object literals**: a variable of wider inferred type assigned into a `VoucherDocData` slot compiles with **zero errors**, so a money field could ride along untyped. `lib/voucher-data.ts` never does this, so **this is not a defect today** — but the guarantee holds **only while every `VoucherDocData` value originates from `buildVoucherData()` or a fresh literal**. It does not survive someone spreading a wider object, casting, or passing a loosely-typed variable. Recorded here rather than left in QA's task notes, and made an explicit acceptance criterion on **T14 (AC-9)** and **T15 (AC-10)**. The structural guarantee is real but conditional; treat "it compiles" as necessary, not sufficient.
- **R14 — the T14→T15 gap leaves two voucher generators in the tree (Amended 4).** For exactly one task, `lib/document-generator.tsx` exports both the new escaped, money-free `generateVoucherDocHTML` and the legacy unescaped, money-carrying `generateVoucherHTML`. The risk is that the legacy one acquires a new caller, or that its retirement slips to backlog and it lives on as a loaded gun with zero callers. Mitigations are acceptance criteria, not intentions: **T14 AC-10** forbids new callers (grep-evidenced) and **T15 AC-11** makes retirement a same-task requirement with a repo-wide grep as evidence. **If T15 is split or deferred for any reason, this risk must be re-raised before the sprint closes — it must not quietly become a second B-13.**

PLAN_PATH: docs/plans/geb-documents-real-data.md
