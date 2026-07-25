# GEB Documents — Real Data for CONFIRMACIÓN DE SERVICIOS & VOUCHER

**Slug:** `geb-documents-real-data`
**Author:** architect
**Spec:** frozen (Part 1) + human-decided amendment (Part 2, OQ1/OQ2/OQ3)
**Status:** plan for lead delegation — no code written by architect
**Amended:** HC-2 and HC-3 ruled by the human; T5, T7, §3, §4, §5, §9, §10, §13 updated in place. Task numbering and dependencies unchanged (T1..T16).
**Amended (2):** HC-4 ruled after QA found the occupancy-save orphaning defect. New task **T2b** inserted after T2 (no renumbering); §7, §8, §9, §10, §13 updated; T12/T15 dependencies tightened.
**Amended (3):** HC-5 ruled after QA found that the sprint removes HTML escaping without replacing it. New task **T6b** inserted between T6 and T8 (no renumbering); §0, §1, §3, §7, §8, §9, §10, §13 updated; T9, T10, T13, T14 amended.

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
- **Shipped in T6 (re-read for HC-5) — `lib/document-generator.tsx`:** the file now holds four generators — `generateVoucherHTML` (`:91`, legacy), `generateProformaHTML` (`:285`, legacy, byte-frozen by T3's baseline), **`generateConfirmacionHTML` (`:963`, new)**, and `generateReciboHTML` (`:1597`). T3 AC-4's split fallback fired. **A grep for `escapeHtml|sanitize|DOMPurify` across the whole file returns NOTHING** — no generator there escapes anything. `generateConfirmacionHTML` interpolates free text raw at `:1428` (`nombre`), `:1431` (`cedulaRnc`), `:1434` (`email`), `:1437` (`whatsapp`), `:1444` (`servicio`), `:1465` (`facturaNumero`), `:1478` (`observaciones`), `:1496` (`linea.descripcion`), `:1497` (`nombre` again, inside `<small>TITULAR:`), `:1552` (`p.nombreCompleto`), `:1558` (`atendidoPor`), `:1561` (`referidoPor`). The **only** `escapeHtml` in the repo is `app/facturacion/proforma/page.tsx:97-103`, used solely by `applyEditableProformaData` (`:117, 125, 138, 146, 154`) — the post-processor **T9 deletes**. `openDocumentInNewWindow` (`:1806`) writes the result into a new window as an executable document. This is HC-5.
- Test infra real: `package.json:11-12` → `test: "vitest run"`, `qa: "npm run typecheck && npm run lint && npm run test"`. `vitest.config.ts` → `environment: "node"`, `globals: true`, alias `@` → repo root. 18 test files under `tests/`.

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
  path that needs it goes live, not in the same sprint and not "right after". HC-5 is
  this invariant being enforced: T6b ships the escaping and BLOCKS T8, the task that
  first points a live route at the unescaped generator.
- Trigger safety. scripts/023's recalcular_totales_reserva() owns reservas.precio_total,
  descuento, pasajeros, habitaciones. New tables are siblings, not participants.
- Return values never assert a state that is not true. Three send-backs in this sprint
  came from exactly one root cause: a return value claiming more than the code achieved.
  HC-4's success contract extends the existing three-outcome idiom rather than inventing
  a new one.
- Optimistic UI / realtime: NOT IN PLAY. Grepped — no supabase.channel, no
  postgres_changes anywhere; both document pages are load-then-render. So there is no
  rollback path to copy and none is invented.
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
     App works, but OQ3's criterion becomes unmeetable (anon is NOT rejected) and the
     new table is world-writable with the public key. REJECTED.
  C) [CHOSEN — human-confirmed at HC-1] RLS enabled + a named policy TO authenticated
     (nothing to anon), AND all access routed through "use server" actions on the
     service-role client — the pattern already in app/actions/crm-actions.ts, consumed
     by four existing pages. The only option where OQ3's probe is a REAL gate rather
     than theater, follows an existing convention, and stays retrofit-friendly.

  Secondary fork: extend ProformaData in place vs. a parallel type.
     Chosen: a new pure module lib/confirmacion-data.ts (type + validating builder),
     keeping BLOCK logic offline-testable and giving constraint 5 a clean split point.

  Third fork (HC-3): where the discrepancy log is persisted.
     Chosen: the EXISTING `auditoria` table, accion CHECK widened by one value. §4.3.

  Fourth fork (HC-4): the identity key for re-linking passengers to occupancy rows.
     Chosen: the material tuple (orden, ocupacion, categoria), NOT orden alone. §9.

  Fifth fork (HC-5): where HTML escaping belongs.
     Chosen: a TAGGED TEMPLATE LITERAL (`html` in a new lib/html-escape.ts) that escapes
     every interpolated value BY DEFAULT at the single seam where interpolation happens,
     with an explicit, greppable `raw()` opt-out for pre-built markup.
     Rejected: per-site esc() calls (correct today, forgettable tomorrow — one missed
     site is a silent hole with no failing test); escaping in the data layer (poisons a
     transport-agnostic contract, breaks .toUpperCase(), guarantees double-escaping);
     a DOM sanitizer (no DOM in this path, solves a different problem, unjustified
     dependency). Full reasoning in §9 HC-5.

Seam map (file budget) and its complement (must-not-touch): see §3.

Negative space checked — grep run over ~/Developer/CBrain/decisions and
~/Developer/CBrain/mistakes:
- NO ADR and NO mistake note covers document generation, HTML templating, output
  encoding, or voucher/proforma rendering. New ground; nothing is re-proposed against a
  prior rejection. HC-5 is a strong candidate for the FIRST such note (§12).
- ADR-0006 rls-org-isolation-default: honored — every new table gets a NAMED policy, and
  its "app-layer checks only" rejection is respected (we ship the policy AND remove the
  anon grant, not one instead of the other).
- ADR-0003 hard-gates-anti-theater: acceptance criteria demand real command output. This
  is why HC-3 is asserted on a PERSISTED ROW, HC-4 on persisted ocupacion_id values, and
  HC-5 on the RENDERED HTML string — never on "we call the helper somewhere".
- ADR-0005 ai-proposes-code-disposes / ADR-0010 guard-the-negative-space: HC-1..HC-5 were
  escalated, not decided unilaterally.
- mistakes/stockin-zero-price: named in the acceptance criteria of every task that renders
  or persists a field. It is also why HC-2 blocks rather than renders empty, why HC-4 keys
  on material identity, and why HC-5 escapes EVERY field rather than a curated subset.
- mistakes/fake-green-tests + patterns/mutation-checked-tests: named in every task that
  ships a test. HC-4 exists partly BECAUSE three of five mutations survived green.
- mistakes/unrun-command-claimed-green: named in the DoD.
- mistakes/premature-success-signal: named in T8/T15.

Pre-mortem — most drift-prone task + mitigation: see §7.

Any genuinely hard call flagged for the human: FIVE — HC-1..HC-5. ALL FIVE ARE NOW
RULED. See §9 for each decision and its accepted consequence.
```

---

## 2. Technical approach (one paragraph)

Both documents stop being decorated placeholders and become pure renderings of validated, structured input. A new offline module per document (`lib/confirmacion-data.ts`, `lib/voucher-data.ts`) owns the document's data contract plus a **validating builder** that returns either `{ ok: true, data }` or `{ ok: false, missing: string[] }` — so a required field that is absent **blocks the document instead of defaulting to `0` / `"N/A"` / today** (mistakes/stockin-zero-price). `lib/finance.ts` gains three helpers pinned by test to the exact arithmetic in `app/clientes/balance/page.tsx:75-90`. The generators in `lib/document-generator.tsx` are rewritten to consume those contracts and nothing else — every `Math.random()`, `new Date()` fallback and hardcoded literal listed in §0 is deleted — with `VoucherDocData` structurally carrying **no money field of any kind**, so a price leak into the voucher is a TypeScript compile error. Every value those generators interpolate is escaped by default through a tagged template literal (`lib/html-escape.ts`), so retiring the old regex post-processor removes no protection and a field added a year from now cannot silently become an injection site. Data that has no home today lands in two new RLS-protected tables plus five additive `reservas` columns, reached exclusively through `"use server"` service-role actions, because Elibry's browser client is unauthenticated `anon` (finding F2). Because those replace-style saves are delete-then-insert over PostgREST, passenger→room links are captured and rebuilt after every successful occupancy save (HC-4), matching rooms on material identity so a link is either correct or honestly NULL. Where the two totals bases disagree the document still prints (HC-3) and the discrepancy is written to `auditoria`; where the `FACTURA #` lookup fails the document blocks (HC-2). A byte-diff snapshot gate (T3) stands between the current live output and the first field-wiring commit, and a section-by-section walk of the two `.docx` files gates the end of each part.

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
| **`lib/html-escape.ts`** | **(HC-5)** The `html` tagged-template renderer, `raw()` opt-out, and the escaper. Pure, no DOM, no dependency |
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
| `lib/document-generator.tsx` | New `generateConfirmacionHTML`; rewrite `generateVoucherHTML`; delete `VoucherData`; **(HC-5)** apply the `html` tag to the two NEW generators only |
| `app/facturacion/proforma/page.tsx` | Real cliente data, real builder call, passenger persistence, block UI, discrepancy-log call, repoint to `generateConfirmacionHTML`, delete `applyEditableProformaData` + policy-edit UI |
| `app/facturacion/voucher/page.tsx` | Real builder call, delete `generateVoucherNumber`, localizador/regimen/ocupaciones persistence, block UI, surface the HC-4 re-link outcome |

**MUST NOT TOUCH** (the complement — a diff outside this list fails the task)

- `app/facturacion/fiscal/page.tsx` — the NCF/comprobante **write** path, **including its silent error swallow at `:142-143`** (Risk R6). Its `generateNCF` `Math.random()` defect is backlog B-4.
- `app/facturacion/comprobantes/**`, `app/facturacion/buscar/**`, `app/facturacion/page.tsx`.
- `scripts/023-create-reserva-detalles-table-fixed.sql` and the `recalcular_totales_reserva()` trigger.
- **`scripts/061-create-reserva-pasajeros-ocupaciones.sql` — SHIPPED AND CLOSED.** HC-4 is solved entirely in application code; **no schema change, no RPC**.
- `reservas.precio_total`, `reservas.descuento`, `reservas.pasajeros`, `reservas.habitaciones` — trigger-owned. Read them; never write them.
- `app/clientes/balance/page.tsx`, `app/clientes/balance-reserva/page.tsx` — the reference implementation.
- `app/reservas/ver/[id]/page.tsx` — divergent balance formula, out of scope by spec (Risk R4).
- `app/reservas/crear/page.tsx`, `app/reservas/editar/[id]/page.tsx` — **no new document entry point**, per NON-GOALS.
- `lib/admin-actions.ts` and `acciones_pendientes` — the approval queue is not an audit log (§4.3).
- `app/logs/**` — the audit-viewing UI is out of scope (backlog B-7).
- **`generateProformaHTML` (`lib/document-generator.tsx:285-917`) — LEGACY, byte-frozen by `tests/proforma-snapshot.test.ts`.** **Deliberately excluded from HC-5's escaping**: touching it breaks T3's baseline, and it becomes dead code the moment T8 repoints the page. Deletion is backlog **B-13**.
- **`generateReciboHTML` (`:1597-1804`) and `openDocumentInNewWindow` (`:1806-1830`)** — untouched. The recibo generator is **also unescaped** (pre-existing) — Risk R12, backlog B-12.
- `lib/supabase.ts`, `lib/supabase-server.ts`, `lib/user-context.tsx`, `components/auth-guard.tsx`, `middleware.ts`.
- Any file split / line-count refactor (see §8).

---

## 4. DB changes — every table ships a named policy

### 4.1 `scripts/061-create-reserva-pasajeros-ocupaciones.sql` (T1) — **SHIPPED**

**Deliberate, stated deviation from the spec's grouping:** the spec listed room-occupancy under Part B, but OQ1 supersedes with *"ONE shared table/structure designed once and reused by BOTH documents"*. A passenger's room grouping is an FK into the occupancy table; creating it in Part B would force a dangling nullable int in T1 and its FK constraint eight tasks later.

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
| A new `documento_discrepancias` table | **REJECTED as unnecessary** — and it **would require its own RLS policy under §4.1**. If the human prefers it, that is a T1-style schema task; no unilateral swap. |
| `console.warn` | **REJECTED** — a console line is not a record (ADR-0003). |

```sql
-- ROLLBACK: ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_accion_check;
--           ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check
--             CHECK (accion IN ('INSERT','UPDATE','DELETE'));
ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_accion_check;
ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check
  CHECK (accion IN ('INSERT','UPDATE','DELETE','DISCREPANCIA'));
```

**Existence is not assumed** — `scripts/058:8` guards `auditoria` with `IF EXISTS`. **The real constraint name must be read from `pg_constraint` first**; `scripts/001` declares the CHECK inline, so Postgres auto-named it.

**Payload written by `registrarDiscrepanciaTotalesAction`:** `tabla:'reservas'` · `registro_id:<reserva.id>` · `accion:'DISCREPANCIA'` · `datos_anteriores:null` · `datos_nuevos:{ source:'CONFIRMACION', reserva_id, cliente_id, suma_detalles, precio_total, delta, moneda, generado_en }` · `usuario:<acting user; NOT NULL — 'SISTEMA' if absent>` · `fecha:` DB default.

---

## 5. API / service changes

`app/actions/documentos-actions.ts` — `"use server"`, service-role client, `{ success, error?, data? }`:

- `getPasajerosReservaAction` / `guardarPasajerosReservaAction`
- `getOcupacionesReservaAction` / `guardarOcupacionesReservaAction` — **(HC-4)** captures, matches and rebuilds passenger→room links on the SUCCESS path; extended contract in §9 HC-4
- `getDatosVoucherReservaAction` / `guardarDatosVoucherReservaAction` — **sets only keys where `value !== undefined`**; never writes trigger-owned columns
- `getFacturaNumeroPorReservaAction` — **read-only**; `{ok:true,numeroFactura}` · `{ok:false,reason:'SIN_COMPROBANTE'}` · `{ok:false,reason:'LOOKUP_FAILED',detail}`. Never allocates.
- `registrarDiscrepanciaTotalesAction` — **(HC-3)** one `auditoria` row per §4.3. Never throws into the caller.

`lib/finance.ts` — additive, pure: `calcularMontoPagado`, `calcularBalanceReserva`, `calcularBalanceGeneralPorMoneda`.

**`lib/html-escape.ts` — (HC-5) new, pure, no DOM, no dependency:**

- `escapeHtmlText(value: unknown): string` — the five-character replace, `&` first.
- `raw(value: string): SafeHtml` — the **explicit, greppable** opt-out for pre-built markup.
- `html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml` — escapes every interpolated value **by default**; inlines `SafeHtml` values, and **arrays of `SafeHtml`**, verbatim.
- `renderHtml(value: SafeHtml): string` — unwraps to a plain string at the outermost boundary.

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
| **Free text contains `<`, `>`, `&`, `"`, `'`** | **(HC-5)** Escaped by the `html` tag at the interpolation seam. T6b. |
| **Free text contains accented Spanish (`Categoría`, `ñ`)** | **(HC-5)** Passes through **byte-identical** — the escaper touches five ASCII characters and nothing else. Explicitly asserted, because an over-eager entity-encoder would mangle the whole document. T6b. |
| **A field is added to a generator next year** | **(HC-5)** Escaped automatically — the tag is the default, not a per-site call. Forgetting is impossible; opting out requires typing `raw()`, which greps. T6b. |
| **Pre-built markup fragments (joined `.map()` row lists)** | **(HC-5)** Nested `html` templates return `SafeHtml` and are inlined unescaped; arrays of `SafeHtml` are joined. No `raw()` needed for the normal case. T6b. |
| **Occupancy save: room unchanged at same `orden`** | **(HC-4)** Re-linked to the new row's id. T2b. |
| **Occupancy save: room at `orden` N materially changed, or gone** | **(HC-4)** `ocupacion_id` stays NULL; reported in `enlacesDescartados`. Never re-linked to a room the operator did not choose. T2b. |
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
| **Concurrent edits** | Last write wins (B-5). **HC-4 widens the window** (Risk R9) but the null-guard means the re-link can only fill a gap, never overwrite. |
| **Popup blocked** | Existing `openDocumentInNewWindow` fallback unchanged. |
| **Success toast on a blocked document** | Must not fire — mistakes/premature-success-signal. |

### Pre-mortem — most drift-prone task

**T6b (HC-5) is now the highest drift risk.** Applying a tag across a ~600-line template is mechanical work at dozens of sites, and the temptation is to "also tidy" the template while in there — or to extend escaping to `generateProformaHTML` and `generateReciboHTML` "since we're here". Both are forbidden: the former breaks T3's byte-frozen baseline, the latter is unrelated scope. Mitigations: T6b's criteria name the functions it may touch and require the legacy ones to show an **empty diff**; `tests/proforma-snapshot.test.ts` mechanically catches any change to `generateProformaHTML`.

**T2b (HC-4):** (a) the obvious way to get the OLD occupancy rows is to make `reemplazarConjuntoConRestauracion` return `filasOriginales` — but that helper is **shared** with `guardarPasajerosReservaAction`, dragging a second QA'd action into the diff. T2b mandates a separate SELECT and leaves the shared helper untouched. (b) The re-link invites being "improved" into a general reconciliation; anything more belongs in B-8.

**T5 (HC-3):** the risk is a dev putting the Supabase write **inside `lib/confirmacion-data.ts`**, destroying offline testability and contaminating the builder T6 depends on.

**T14:** sits in an 1830-line file; the reflex is to "just also fix" the page in the same commit. Its file scope is one file.

---

## 8. File size (`.claude/rules/file-size.md`, ≤500 lines)

Already over: `lib/document-generator.tsx` (now **~1830** after T6), `app/reservas/crear/page.tsx` (1562), `app/facturacion/proforma/page.tsx` (816), `app/facturacion/voucher/page.tsx` (790).

T6 grew the generator file from 1150 to ~1830 by adding a whole new generator alongside the frozen legacy one — the price of T3 AC-4's split fallback, and expected. T6b is roughly neutral (tag application). T14 grows it again. `app/actions/documentos-actions.ts` is at 467 lines and T2b pushes it past 500.

Splits are **not bundled**. Follow-ups:

- **B-1** Split `lib/document-generator.tsx` → `lib/templates/confirmacion.ts`, `voucher.ts`, `recibo.ts`. **Now urgent** at ~1830 lines.
- **B-2** Extract `app/facturacion/voucher/page.tsx`'s form into `components/voucher/*`.
- **B-3** Extract `app/facturacion/proforma/page.tsx`'s dialog.
- **B-4** `app/facturacion/fiscal/page.tsx:200-203` mints NCFs with `Math.random()` — fiscal, senior + human-gated, own sprint.
- **B-5** Concurrent passenger/occupancy edits: last-write-wins.
- **B-6** `reservas.impuestos` double-count risk at `app/facturacion/proforma/page.tsx:331-333`.
- **B-7** Nothing in the app can *read* the `auditoria` rows this sprint writes. Needed to make HC-3's "captured for cleanup" promise real.
- **B-8** **(HC-4 durable fix)** Have the occupancy editor resubmit passenger→room links explicitly with every save — removes the need for any identity heuristic.
- **B-9** `app/actions/documentos-actions.ts` crosses 500 lines with T2b. Split by concern before T12 grows it further.
- **B-10** **(QA minor)** `relinkPasajerosRestaurados` (`:363-377`) returns on the **first** error rather than attempting the rest. Honest but recovery-unfriendly.
- **B-11** **(QA minor)** `restoreError` carries only the first message, no per-passenger status.
- **B-12** **(HC-5 residual)** `generateReciboHTML` (`:1597-1804`) interpolates `cliente.nombre`, `pago.referencia`, `pago.metodo` **unescaped**, rendered through the same `openDocumentInNewWindow`. Apply the `html` tag as its own scoped task — the helper will already exist.
- **B-13** **(HC-5 residual)** `generateProformaHTML` (`:285-917`) becomes **dead code** once T8 repoints the page. It is unescaped and byte-frozen. Delete it — with `tests/proforma-snapshot.test.ts` and `tests/fixtures/proforma-baseline.html`, whose only purpose was to pin it — once T10 confirms the new document is correct.

---

## 9. Hard calls — all five escalated, all five now RULED

**HC-1 — Elibry has no authentication, so "authenticated-staff-only RLS" cannot mean what it sounds like. → SURFACED, ACKNOWLEDGED, EXPLICITLY OUT OF SCOPE.**
`lib/user-context.tsx:23-38` is a hardcoded two-user array in `localStorage`; no `supabase.auth` usage anywhere; the browser is `anon`; **not one of the ~29 existing tables has RLS**. Resolution for the *new* tables is Approach C, plus the **mandatory counter-probe** so a green anon-probe with a broken app is a FAIL. **This sprint does not fix the standing exposure** — Risk R1, which must be quoted in the sprint summary.

**HC-2 — `comprobantes_fiscales`'s real schema is not in the repo. → DECIDED: "Verify columns at runtime, block if the lookup fails."**
This **overrides my earlier proposal to degrade to an empty field.** `FACTURA #` is **REQUIRED**, and letting a runtime lookup failure silently downgrade it to optional is precisely mistakes/stockin-zero-price. **Any** failure to read BLOCKS with a named-field error, with **distinct messages** for the data-entry case and the engineering case (T7 AC-4/AC-5). Unchanged and non-negotiable: **no allocation, issuance, or renumbering of an NCF** — any pressure to add it is a hard stop and a human gate. The silent swallow at `app/facturacion/fiscal/page.tsx:142-143` is **not** in T7's scope; it is Risk R6.

**HC-3 — `BALANCE RESERVA` and `BALANCE GENERAL` are specified over different bases. → DECIDED: "Print, and log the discrepancy silently."**
This **overrides my BLOCK recommendation**; settled, not to be re-litigated. T5 computes both bases and compares (`|Σdetalles − precio_total| > 0.01`), but on mismatch does **not** block and does **not** render a warning. The discrepancy is **logged as a real persisted record** — one `auditoria` row per §4.3. "Logged" explicitly does **not** mean `console.log`; the verifying test asserts on the **persisted row**.
**Accepted consequence:** a client-facing CONFIRMACIÓN can display a `BALANCE RESERVA` that is not a summand of the `BALANCE GENERAL` beside it — two numbers on one page that do not reconcile, shown to a paying customer. Explicit human decision, with the discrepancy captured for cleanup. That cleanup path only becomes real once someone can read those rows — backlog **B-7**.

**HC-4 — a successful occupancy save silently orphans every room-assigned passenger. → DECIDED: "Re-link by `orden` after a successful save."**

*The defect.* Delete-then-insert fires `scripts/061:86`'s `ON DELETE SET NULL (ocupacion_id)`, nulling every referencing passenger; the insert writes fresh serial ids; the code skips re-linking on success (`app/actions/documentos-actions.ts:444-447`). Every successful save — including a `categoria` typo fix — permanently orphaned every room-assigned passenger and returned `{success: true}` with zero signal.

*The identity rule, precisely.* Capture, before the delete: occupancy rows as `(id, orden, ocupacion, categoria)` and passengers as `(id, ocupacion_id)` where non-NULL; join to get each linked passenger's **room material identity** `(orden, ocupacion, categoria)`. After a successful insert, match new rows on **`orden` AND `ocupacion` AND `categoria` all equal**. Found → UPDATE. Not found → **leave NULL** and report in `enlacesDescartados`. Comparison is on the exact trimmed, **case-sensitive** strings the action writes (`:437-438`) — no case- or accent-folding, because a second normalization rule is a second thing to replicate in tests for no safety gain. **`cantidad` is deliberately NOT in the key**: "X 8" → "X 9" does not change which room a passenger is in, and since `orden` is in the key a count edit cannot alias two rooms.

*Why `orden` alone is NOT safe.* `scripts/061:69`'s `UNIQUE (reserva_id, orden)` makes `orden` unique *within one reserva at one instant*, but it does not identify a room *across two saves* — it is a render position. Matching on it alone re-links a passenger who was in a DOBLE into a TRIPLE: a **silently wrong** room on a customer-facing voucher. **An honest NULL beats a confident wrong link**, because NULL is visible and recoverable and a wrong link is neither.

*Edge cases, all decided:* room gone → NULL + reported (the operator deleted it; the passenger row survives) · reordered/materially different → NULL + reported · new room at a new `orden` → no-op · passenger already NULL → untouched, not captured · no prior occupancy rows → `relinked: true` trivially.

*The success-path contract.* `success: false` would lie (the rooms saved); a bare `success: true` would hide orphans. **Every** success return carries an explicit link-state discriminator:

```
{ success: true, data, relinked: true,  enlacesDescartados }
{ success: true, data, relinked: false, enlacesDescartados,
  enlacesNoRestablecidos, relinkError? }
```

`relinked === (enlacesNoRestablecidos.length === 0)`. `enlacesDescartados` does **not** flip `relinked` — deliberate drops are not failures, and the two arrays stay separate so they can never be conflated.

*Concurrency.* Does not change B-5's acceptance but **widens the window** (Risk R9). Mandatory free mitigation: `.eq("id", …).is("ocupacion_id", null).select("id")` — the re-link can only fill a gap our own delete made, never overwrite a concurrent assignment. A 0-row result means someone else owns that passenger: reported, not an error.

*Why no migration and no RPC.* The rule needs only reads and updates the action can already issue. An RPC would close the concurrency window, but the static-only ruling means any new migration ships **unverified against a live database** — a bad trade this late.

---

**HC-5 — the sprint deletes HTML escaping and replaces it with nothing. → RULED: escape at the render seam, via a tagged template literal.**

*The finding, confirmed against shipped code.* `generateConfirmacionHTML` (`lib/document-generator.tsx:963`) interpolates every field raw — `:1428, 1431, 1434, 1437, 1444, 1465, 1478, 1496, 1497, 1552, 1558, 1561` are free text staff type by hand. A grep for `escapeHtml|sanitize|DOMPurify` across the whole file returns nothing. The **only** escaping in the repo is `app/facturacion/proforma/page.tsx:97-103`, used solely by `applyEditableProformaData` (`:117, 125, 138, 146, 154`) — the post-processor **T9 deletes**. QA proved the hole with `nombre = 'Juana <script>alert(1)</script> Perez'`, and `openDocumentInNewWindow` (`:1806`) writes the result into a new window as an executable document.

*Correction to the framing — the exposure starts at T8, not T9.* The old escaping only ever protected the **old** pipeline: `applyEditableProformaData` regex-matches class names in `generateProformaHTML`'s output and substitutes values from `customData`; it never escaped what the generator itself interpolated, and it will not meaningfully fire against the new function's output. The moment **T8** repoints `/facturacion/proforma` at `generateConfirmacionHTML`, the live customer-facing route renders unescaped staff input — and T9 has not run yet. **So the fix must land before T8.** That is why T6b **blocks T8**, and why placing this work in T9 would leave a real window open.

*The ruling: option (d), a tagged template literal* in a new `lib/html-escape.ts`:

```
type SafeHtml = { readonly __safeHtml: string }
escapeHtmlText(v: unknown): string   // & first, then < > " ' — exactly five characters
raw(s: string): SafeHtml             // explicit, greppable opt-out
html(strings, ...values): SafeHtml   // escapes EVERY value by default;
                                     // inlines SafeHtml and arrays of SafeHtml verbatim
renderHtml(v: SafeHtml): string      // unwrap at the outermost boundary
```

**The rule, stated so T13/T14 inherit it without re-litigating:**

> **Escaping is a property of the renderer, never of the data.** Data contracts (`ConfirmacionData`, `VoucherDocData`) carry **raw** domain values. Every generator that produces HTML builds its output with the `html` tag, which escapes **every** interpolated value by default. The only way to emit unescaped content is to wrap it in `raw()` — explicit, greppable, and never given a value that originated in the database or from a user.

*Why (d) over the alternatives:*

- **(a) per-site `esc()` calls** — correct on day one, wrong on day ninety. It relies on a human remembering a call at ~30 sites in an 1830-line file that is still growing (T14 adds a whole generator). One missed site is a silent hole with no failing test. The constraint was explicitly *"favour the option that is hard to get wrong later over the one that is smallest today"*; this is its opposite.
- **(a′) escape only "free-text" fields** — rejected outright, for the reason the coordinator named: it requires someone to classify every field correctly **forever**. `facturaNumero` looks numeric but is a `text` column from a table whose schema we could not even verify (F1/HC-2). Escaping a number is a no-op; the cost of escaping everything is zero, and the cost of one misclassification is an injection.
- **(b) escape at the builder boundary** — **rejected; it is a category error.** It poisons a deliberately transport-agnostic contract: `ConfirmacionData.nombre` would be wrong for a PDF text layer, a CSV export, a log line, or an equality assertion — and note `:1496-1497` already calls `.toUpperCase()` on interpolated values, which would turn `&amp;` into `&AMP;`. It also makes double-escaping inevitable the first time a value is rendered twice, and it hands T5's pure offline builder an HTML concern. **The same reasoning binds `VoucherDocData` (T13): it carries raw values too.**
- **(c) a render-time helper** — the right *layer*; (d) is its disciplined form. A bare helper is still opt-in per site; the tag makes safety the default and unsafety the thing you must type.
- **DOMPurify / any sanitizer** — rejected. There is no DOM in this path (plain string templates written into a `window.open` document), a sanitizer solves a different problem (allowing *some* markup), and a new dependency is unjustified for a ~15-line pure function. **No new dependency is added.**

*Accent safety — an explicit, tested requirement.* The escaper replaces **five ASCII characters only** and leaves every other byte untouched, so `Categoría`, `Pérez`, `Añejo`, `ESTADÍA`, `ñ` and `–` pass through **byte-identical** under `<meta charset="UTF-8">`. A naive "encode everything non-alphanumeric" escaper would mangle the entire Spanish document; that failure mode is asserted against directly (T6b AC-6).

*Context limits, stated so nobody over-trusts the tag.* `escapeHtmlText` is safe for **element content** and **quoted attribute values** (it escapes both quote characters). It is **not** sufficient for unquoted attributes, `javascript:`/URL contexts, or `<script>`/`<style>` bodies. **Interpolating database or user data into those contexts is forbidden in these generators**; the current templates do none of it, and any future need is an escalation, not a judgement call.

*Legacy functions deliberately excluded.* `generateProformaHTML` is byte-frozen by `tests/proforma-snapshot.test.ts` and becomes dead code at T8 — escaping it would break the baseline for a function scheduled for deletion (**B-13**). `generateVoucherHTML`'s legacy body is rewritten wholesale by T14, which adopts the tag. `generateReciboHTML` is a genuine pre-existing exposure outside this sprint's scope — **Risk R12**, backlog **B-12**, named rather than silently carried.

*Task shape — a new T6b, not a T6 reopen and not a T9 amendment.* Three reasons, applying the lead's own precedent:
1. **Not T9.** T9 runs *after* T8, and T8 is what first points a live route at the unescaped generator. Fixing it at T9 leaves the window open for a whole task. Sequencing decides this.
2. **Not a T6 reopen.** T6 is QA-closed, and its file scope was `lib/document-generator.tsx` **only** — it could not have contained a new `lib/html-escape.ts` module plus two new test files. Reopening a closed task to smuggle in a new module is the "scope creep dressed as caution" pattern flagged on T3/T2b.
3. **The "fix while free" precedent (T1) applies, and T6b is how it is honoured.** Nothing consumes `generateConfirmacionHTML` yet — `app/facturacion/proforma/page.tsx:24` still imports `generateProformaHTML`. The artifact *is* free, so the right response is to fix it **now, before T8 consumes it**, as a clean task with its own acceptance criteria. That is what "fix while free" means procedurally.

---

## 10. Test plan

Gate command for every task: **`npm run qa`** (= `npm run typecheck && npm run lint && npm run test`). Real output pasted, per ADR-0003.

Targeted runs: `npx vitest run tests/finance.test.ts` · `tests/confirmacion-data.test.ts` · `tests/documentos-actions.test.ts` · `tests/html-escape.test.ts` · `tests/confirmacion-html.test.ts` · `tests/voucher-data.test.ts` · `tests/proforma-snapshot.test.ts`.

All fixtures are **plain data objects passed into the pure builders/generators — no live Supabase, no network** (patterns/port-and-in-memory-fake). Any test standing in as PASS evidence is **mutation-checked** (patterns/mutation-checked-tests).

**HC-5 — escaping verification (T6b). Assertions are on the RENDERED HTML STRING, never on "we call the helper".**

The hostile fixture, used for `generateConfirmacionHTML` and inherited by `generateVoucherHTML` (T14):

```
nombre:        'Juana <script>alert(1)</script> Pérez'
observaciones: 'Cliente "VIP" & socio <b>preferente</b>'
atendidoPor:   "O'Brien & Asociados"
servicio:      'Hotel <Categoría "Deluxe"> — Añejo & Ñandú'
pasajeros:     [{ nombreCompleto: '<img src=x onerror=alert(1)>' }, …]
lineas:        [{ descripcion: 'HABITACIÓN <DOBLE> & "SUITE"' }]
```

1. The output contains **no** `<script`, no `<img`, no `onerror=` in unescaped form — asserted via `String.includes` on the raw substrings.
2. `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`, `"`→`&quot;`, `'`→`&#39;`, with **`&` replaced first** — a test proves `&lt;` is not double-encoded to `&amp;lt;`.
3. **Accents are NOT mangled** — `Categoría`, `Pérez`, `Añejo`, `Ñandú`, `ESTADÍA` and the en-dash `–` appear **verbatim**. A first-class assertion: an over-eager escaper would pass criterion 1 and destroy the document.
4. The document's static Spanish boilerplate (the four OQ2 paragraphs, `MUCHAS GRACIAS POR CONFIAR EN NUESTROS SERVICIOS.`) is **byte-identical** to its pre-T6b rendering — proving the tag did not touch literal template text.
5. With a **clean** fixture, output is **byte-identical** to T6's approved output. The tag is a no-op on safe data.
6. `tests/proforma-snapshot.test.ts` passes **unchanged** — proof `generateProformaHTML` was not touched.
7. **Mutation-checked**, all must turn RED: **M7** `html` inlines values without escaping → the `<script>` assertion REDs · **M8** `&` escaped last → the double-encode assertion REDs · **M9** escaper entity-encodes non-ASCII → the accent assertion REDs · **M10** a data value wrapped in `raw()` → the injection assertion REDs. Each shown RED, then restored GREEN.
8. A **static guard** test asserts `raw(` appears **zero** times inside the two new generators. Updating that count later requires a deliberate comment, never a silent change.

**HC-4 — re-link verification (T2b).** Three required fixtures, because the fixture weakness *is* the bug: a **≥2-link fixture** whose passengers point at **different** rooms (a single-link fixture cannot distinguish "each uses its own value" from "all use the first"); a **success-path fixture carrying real links** (a zero-link success path cannot detect spurious work); a **NULL-linked passenger alongside linked ones**. Old mutation (iii) is **obsolete** — under HC-4 the success-path re-link is correct behaviour. Replacement set, all must turn RED: **M1** match on `orden` alone (reorder fixture) · **M2** always write `enlaces[0].ocupacion_id` · **M3** drop the non-null capture filter · **M4** always return `relinked: true` · **M5** drop the `.is("ocupacion_id", null)` guard · **M6** fold `enlacesDescartados` into `relinked: false`. Assertions on the **persisted `ocupacion_id` values**, never on call counts.

**HC-3 — discrepancy-log verification (T5).** Fixture with Σdetalles `800.00` vs `precio_total` `750.00`: the document **generates successfully**, and **exactly one** `auditoria` row is written (count `1`, not `≥1`) with `tabla='reservas'`, `registro_id`, `accion='DISCREPANCIA'` and `datos_nuevos` matching §4.3 field for field. Delta `0` writes **zero** rows. **A test passing via a `console.warn` spy is an automatic FAIL.** Mutation-check: threshold → `> 100` REDs; dropping `delta` REDs.

**HC-2 — `FACTURA #` block verification (T7).** Two negative fixtures asserted separately plus a positive one; each asserts the exact operator-facing message, and a test asserts the two messages are **not equal**.

Manual/SQL checks:

- **Anonymous-access probe (OQ3).** Anon-key `SELECT`/`INSERT`/`UPDATE`/`DELETE` against both new tables — all eight rejected/empty, real responses pasted.
- **Counter-probe (mandatory).** The same eight via `app/actions/documentos-actions.ts` must **succeed**. A green anon-probe with a broken app is a **FAIL**.
- `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('reserva_pasajeros','reserva_ocupaciones');` → both `true`.
- `SELECT polname, polrelid::regclass, polroles::regrole[] FROM pg_policy WHERE polrelid IN (…);` → the two named policies, `{authenticated}`, no `anon`.
- **(HC-3)** `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='auditoria'::regclass AND contype='c';` before and after `063`.
- **(HC-2)** `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='comprobantes_fiscales';` pasted in T7.
- **.docx fidelity walk** (T10, T16): unzip each `.docx` (`word/document.xml`, `word/media/`), then walk section by section.

---

## 11. Task list

> Sequential and dependency-ordered. One task at a time; task N+1 does not start until N passes QA.
> **Numbering note:** inserted tasks are **T2b** (between T2 and T3) and **T6b** (between T6 and T8). T1..T16 keep their original numbers and meanings — nothing is renumbered. Positions are fixed by dependencies, not labels.
> **Definition of done, every task:** real diff pasted · `npm run qa` actually run with output shown (mistakes/unrun-command-claimed-green) · no file outside "Files in scope" changed · RLS not weakened · **no existing safeguard removed without an equivalent already landed** · one-line rollback note.

### PART A — CONFIRMACIÓN DE SERVICIOS

---

**T1 — Shared passenger + room-occupancy storage: migration & RLS** — **CLOSED**
**Owner:** senior-dev · **Depends on:** none
**Files in scope:** `scripts/061-create-reserva-pasajeros-ocupaciones.sql`
**DB/RLS:** both tables per §4.1; RLS enabled; `reserva_pasajeros_staff_all` + `reserva_ocupaciones_staff_all`.

1. Both tables exist with the columns, types, FKs, CHECKs, UNIQUEs and indexes in §4.1 — real dump pasted.
2. `rowsecurity = true` for both; policies `TO authenticated`; **no grant to `anon`** — output pasted.
3. Anonymous probe: all 8 operations rejected/empty, real responses pasted.
4. **Block-never-default (mistakes/stockin-zero-price):** `nombre_completo` NOT NULL + non-whitespace CHECK; `tipo_pax` NOT NULL + CHECK; rejections demonstrated with real error output. No `DEFAULT 0`/`DEFAULT 'N/A'`.
5. `ocupacion_id` nullable with `ON DELETE SET NULL` — deleting a group does not delete passengers.
6. Idempotent, `-- ROLLBACK:` header present.
7. `npm run qa` green.
8. Trigger untouched; `reservas` not altered.

---

**T2 — Server-action data layer for passengers & occupancies** — **CLOSED**
**Owner:** senior-dev · **Depends on:** T1
**Files in scope:** `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`

1. `"use server"`, service-role client, `{ success, error?, data? }` — the `crm-actions.ts` convention. No service key importable from a client component.
2. `getPasajerosReservaAction` ordered by `orden`; `guardarPasajerosReservaAction` replaces the set per reserva.
3. **Block-never-default:** blank `nombre_completo` or missing `tipo_pax` rejected **before** the write — never coerced to `""`, `"Acompañante"`, `ADULTO`.
4. Same for occupancies: `cantidad <= 0`, blank `ocupacion`/`categoria` rejected.
5. **Offline (patterns/port-and-in-memory-fake)** — passes with no network, no env vars.
6. **Mutation-checked** for the blank-name rejection and ordering.
7. Counter-probe: real save+read round-trip succeeds against T1's DB.
8. `npm run qa` green.

---

**T2b — HC-4: rebuild passenger→room links after a successful occupancy save**
**Owner:** senior-dev · **Depends on:** T2 · **Blocks:** T12, T15
**Files in scope:** `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`
**DB/RLS:** **none.** No migration, no RPC, no change to `scripts/061`. If a dev concludes schema work is required, **stop and escalate**.

*Why a separate task, not a fourth T2 round:* T2's eight criteria are closed and verified. This is **new behaviour with a changed public contract**, a new identity rule and a replacement mutation set — not a defect in what T2 was asked to do.

1. **The rule is implemented exactly as §9 HC-4 specifies.** Key = (`orden`, `ocupacion`, `categoria`), exact trimmed case-sensitive strings (`:437-438`). `cantidad` **not** in the key. **Matching on `orden` alone is a FAIL.**
2. Old occupancy rows read by **a dedicated SELECT inside `guardarOcupacionesReservaAction`**. `reemplazarConjuntoConRestauracion` (`:198-245`) — shared with the passengers action — **must show an empty diff**.
3. **The success contract is exactly as §9 HC-4 specifies.** Every `success: true` carries `relinked` and `enlacesDescartados`. `relinked === (enlacesNoRestablecidos.length === 0)`. `enlacesDescartados` never flips `relinked`. **A bare `success: true` after a failed re-link is an automatic FAIL.**
4. **Every edge case in §9 HC-4 implemented and individually tested** — unchanged · gone · materially changed/reordered · new `orden` · already-NULL · no prior rows. One test per row.
5. **Concurrency guard:** `.eq("id", …).is("ocupacion_id", null).select("id")`. A 0-row result is **not** an error — reported in `enlacesNoRestablecidos` without a `relinkError`. A test proves a concurrently-assigned passenger is **not** clobbered.
6. **All links are attempted** — the success-path re-link must not stop at the first error (unlike `:363-377`, left alone as B-10). A two-failure test proves both are attempted and reported.
7. **Block-never-default:** an unmatched room yields NULL — never a "closest" room, never `enlaces[0]`, never the first new row. M1 proves it.
8. **Fixture-strength criteria (not optional — this is what let three mutations survive):** a **≥2-link fixture** pointing at **different** rooms; a **success-path fixture with real links**; a **NULL-linked passenger alongside linked ones**. Assertions on **persisted `ocupacion_id` values**, not call counts (mistakes/fake-green-tests).
9. **Mutation-checked: all six of M1–M6 (§10) turn RED**, each shown, then GREEN. Old mutation (iii) is obsolete and must not be reported as surviving.
10. **Offline:** the in-memory fake models `ON DELETE SET NULL (ocupacion_id)` so the orphaning reproduces without a database.
11. A regression test reproduces the **original defect**: save with only a `categoria` typo fixed, and assert the *other* rooms' passengers keep their links.
12. `npm run qa` green. Rollback: revert and the action returns to T2's orphaning behaviour — do not revert without re-opening HC-4.

---

**T3 — Constraint-5 baseline snapshot gate** — **CLOSED**
**Owner:** senior-dev · **Depends on:** none (must precede T6)
**Files in scope:** `tests/fixtures/proforma-baseline.html`, `tests/proforma-snapshot.test.ts`

1. Deterministic harness renders **today's unmodified** `generateProformaHTML` with `Math.random` stubbed and time frozen. Baseline committed.
2. Passes against the current generator; deleting/emptying the baseline makes it RED (shown) — not vacuous.
3. Emits a readable diff on mismatch.
4. **Split fallback, pre-authorised:** if T6 cannot hold a byte-diff, it splits into legacy `generateProformaHTML` (byte-frozen) + new `generateConfirmacionHTML`, with the page repointed in T8. *(This fallback fired — see T6.)*
5. `npm run qa` green. **No production file modified.**

---

**T4 — Finance helpers: MONTO PAGADO / BALANCE RESERVA / BALANCE GENERAL** — **CLOSED**
**Owner:** senior-dev · **Depends on:** none (must precede T5)
**Files in scope:** `lib/finance.ts`, `tests/finance.test.ts`

1. Three new pure exports, additive; `sumarPagos`/`calcularBalance` unchanged.
2. `calcularBalanceGeneralPorMoneda` reproduces `app/clientes/balance/page.tsx:75-90` exactly, incl. `(moneda || "DOP")` and `Number(x) || 0`; expected values computed **by transcribing that page's loop**.
3. A test asserts it does **not** match `/reservas/ver/[id]`'s divergent formula.
4. **Block-never-default:** helpers take numbers and never invent them; the "unset" decision lives in T5's builder.
5. No Supabase import — `lib/finance.ts` stays pure. **Offline.**
6. **Mutation-checked** on all three helpers.
7. `npm run qa` green.

---

**T5 — `ConfirmacionData` contract + validating builder + totals-discrepancy logging** — **CLOSED**
**Owner:** senior-dev · **Depends on:** T2, T4
**Files in scope:** `lib/confirmacion-data.ts`, `tests/confirmacion-data.test.ts`, `scripts/063-allow-discrepancia-in-auditoria.sql`, `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`
**DB/RLS:** one `ALTER` widening an existing CHECK on `auditoria` (§4.3). **No new table.**

1. `ConfirmacionData` carries every field in the spec's per-field table.
2. `buildConfirmacionData` returns `{ ok: true, data, discrepancia? }` or `{ ok: false, missing }`.
3. **Block-never-default — the core criterion.** Each blocks individually, none defaults: zero detalles · missing/invalid dates · missing horas · missing cliente/producto/atendido_por. **No output path may produce `0`, `"N/A"`, `"1"`, today's date or a random number for a required field.**
4. `observaciones` and `referidoPor` are the **only** optional fields.
5. **`facturaNumero` is REQUIRED per HC-2** — blocks when absent, never `""`/`"N/A"`/a number.
6. Totals computed as Σ over `lineas`, **not** from `reservas.precio_total`.
7. Balances come **only** from the T4 helpers.
8. **HC-3 detection (pure):** returns `discrepancia` alongside `ok: true`; **writes nothing**; zero Supabase imports (grep-verified).
9. **HC-3 persistence (in the action):** `063` widens the CHECK; `registrarDiscrepanciaTotalesAction` writes exactly one row per §4.3. Real constraint name read from `pg_constraint` first; `IF EXISTS` guard.
10. **HC-3 verification:** the mismatch fixture generates successfully AND writes **exactly one** row matching §4.3 field for field. **A console-spy test is an automatic FAIL.** Delta `0` writes zero rows.
11. **Mutation-checked:** silent-default reintroduction · threshold change · dropped `delta`.
12. **Offline**, plus one real DB round-trip evidenced manually.
13. A failed discrepancy write must **not** block or throw.
14. `npm run qa` green. No page or generator file touched.

---

**T6 — New `generateConfirmacionHTML` against `ConfirmacionData`** — **CLOSED (T3 AC-4 split fallback fired)**
**Owner:** senior-dev · **Depends on:** T3, T5
**Files in scope:** `lib/document-generator.tsx` **only**

1. New `generateConfirmacionHTML(data: ConfirmacionData)`; legacy `generateProformaHTML` byte-for-byte unchanged. Every §0 fabrication absent from the new function.
2. Each field renders from its `ConfirmacionData` key. `WHATAPP` keeps the source spelling (flagged for T10).
3. **All four OQ2 policy paragraphs verbatim**; the drifted `o se cancela automáticamente` clause gone; the `RD $1,000.00 por habitación` paragraph added.
4. Passengers rendered `1) 2) 3)…` by `orden`; zero rows renders no lines and no placeholder.
5. `BALANCE GENERAL RD $` / `US $` render the two supplied values. No FX conversion anywhere.
6. **HC-3:** no discrepancy indicator; discrepancy and clean fixtures render byte-identical totals blocks.
7. **Block-never-default:** no `||`/`??` substituting a value for a required field.
8. **Constraint-5 gate:** `tests/proforma-snapshot.test.ts` passes unchanged.
9. `app/facturacion/proforma/page.tsx` not in scope.
10. `npm run qa` green.

---

**T6b — HC-5: escape at the render seam (`html` tagged template)**
**Owner:** senior-dev · **Depends on:** T6 · **Blocks:** T8 (the task that first points a live route at the new generator)
**Files in scope:** `lib/html-escape.ts` (new), `tests/html-escape.test.ts` (new), `tests/confirmacion-html.test.ts` (new), `lib/document-generator.tsx`
**DB/RLS:** none

*Security-relevant, customer-facing. Sequenced before T8 because the exposure begins the moment the live route is repointed — §9 HC-5.*

1. **`lib/html-escape.ts` implements exactly the §5 surface:** `escapeHtmlText`, `raw`, `html`, `renderHtml`. Pure, **no DOM API, no new dependency** — the `package.json` diff must be empty.
2. **`escapeHtmlText` replaces exactly five characters** — `&` (first), `<`, `>`, `"`, `'` → `&amp; &lt; &gt; &quot; &#39;` — matching the semantics of the `escapeHtml` at `app/facturacion/proforma/page.tsx:97-103` that T9 removes. **Nothing else is touched.** Non-string inputs are coerced with `String(v)`; `null`/`undefined` render as `""`, never `"null"`.
3. **`html` escapes every interpolated value by default** and inlines `SafeHtml` values — **and arrays of `SafeHtml`** — verbatim, so nested row templates and `.map()` fragments compose without `raw()`.
4. **`generateConfirmacionHTML` is converted to build its output with the `html` tag**, covering all twelve free-text sites (`:1428, 1431, 1434, 1437, 1444, 1465, 1478, 1496, 1497, 1552, 1558, 1561`) **and every other interpolation, numbers included**. **Selective "only free-text" escaping is a FAIL** (§9 HC-5: that classification rots).
5. **The hostile fixture (§10) renders safe:** no `<script`, no `<img`, no `onerror=` in unescaped form; correct entities; `&` escaped first so `&lt;` never becomes `&amp;lt;`. Asserted on the **rendered string**.
6. **Accents survive byte-identical:** `Categoría`, `Pérez`, `Añejo`, `Ñandú`, `ESTADÍA`, `–` appear verbatim. **First-class assertion** — an escaper that entity-encodes non-ASCII would pass AC-5 and destroy the document.
7. **No-op on clean data:** with a fixture containing no escapable characters, output is **byte-identical** to T6's approved output; and the static Spanish boilerplate is byte-identical in **all** fixtures.
8. **Legacy functions untouched.** `generateProformaHTML` and `generateReciboHTML` show an **empty diff**; `tests/proforma-snapshot.test.ts` passes **unchanged**. Escaping them is explicitly **out of scope** (B-12, B-13).
9. **Static guard:** a test asserts `raw(` appears **zero** times inside the two new generators — no data value bypasses the tag. Changing that count later requires a deliberate comment, never a silent edit.
10. **Mutation-checked: M7–M10 (§10) each turn RED**, shown, then restored GREEN. A test that stays green when `html` stops escaping is fake-green and fails this task.
11. **Offline (patterns/port-and-in-memory-fake):** plain data objects into the generator; no network, no env vars.
12. `npm run qa` green. Rollback: revert this commit; `generateConfirmacionHTML` returns to raw interpolation — **do not revert without re-opening HC-5, and never while T8 is merged.**

---

**T7 — `FACTURA #`: read-only lookup that BLOCKS on failure (fiscal-adjacent)**
**Owner:** senior-dev · **Depends on:** T2, T6 · **Human gate: yes** (HC-2)
**Files in scope:** `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`
**DB/RLS:** none — **read-only**

1. Starts by **verifying** `comprobantes_fiscales`'s real column shape (`information_schema.columns`), output pasted.
2. **Exactly one `SELECT`.** No `insert`/`update`/`upsert`/`delete`/`rpc` against `comprobantes_fiscales` or `comprobantes_disponibles` — grep-verified. **Any need to allocate an NCF stops the task and goes to the human.**
3. **HC-2 — BLOCK, do not render empty.** Discriminated result; **every** `ok:false` path blocks with `FACTURA #` named. **Block-never-default:** never a random number, `"N/A"`, `""`, a sequence position, or `facturas.length` (`app/facturacion/fiscal/page.tsx:205-208`).
4. **Negative fixture 1 — no row.** Verbatim: **`"FACTURA #: esta reserva no tiene comprobante fiscal asignado"`** — a **data-entry** job; must not mention a technical fault.
5. **Negative fixture 2 — schema/lookup failure.** Verbatim: **`"FACTURA #: no se pudo consultar el comprobante fiscal — problema técnico, no de datos: <detalle>"`** — an **engineering** problem. A test asserts the two are **not equal**.
6. Multiple rows ⇒ deterministic pick (most recent `fecha_emision`), documented.
7. **Offline** + **mutation-checked**: fabricated number REDs; `ok:true` with `""` REDs; collapsing the two messages REDs.
8. `app/facturacion/fiscal/page.tsx` untouched, **including `:142-143`** (Risk R6). `npm run qa` green.

---

**T8 — Wire `/facturacion/proforma` to real data**
**Owner:** senior-dev · **Depends on:** T6, **T6b**, T7
**Files in scope:** `app/facturacion/proforma/page.tsx`
**DB/RLS:** none

1. Repoints the import from `generateProformaHTML` to **`generateConfirmacionHTML`** (`:24`). **T6b must be merged first** — this is the task that puts the new generator in front of real clients (§9 HC-5).
2. `getClienteData` returns the **real** `clientes.direccion`; `"Dirección no disponible"` (`:254`) gone. `cedulaRnc` resolves `identificacion` (PERSONA) / `rnc` (EMPRESA).
3. The synthetic line-item fallback (`:344-351`) **deleted**. Zero detalles **blocks**: destructive toast, **no window opens**, and the success toast (`:381`) **does not fire** (mistakes/premature-success-signal).
4. Both "Editar" and "Rápida" go through `buildConfirmacionData`; **no** page-level defaulting — grep the diff for `|| "N/A"`, `|| 1`, `|| 0`, `|| new Date()`.
5. Passenger list loads via `getPasajerosReservaAction` and **persists** via `guardarPasajerosReservaAction` before generating. Round-trip evidenced.
6. `observaciones` ← `nota_interna_reserva`; `atendidoPor` ← `atendido_por`; `referidoPor` ← `referido_por`.
7. **HC-3 wiring:** a `discrepancia` triggers `registrarDiscrepanciaTotalesAction` and the document **still generates**; nothing reaches the screen or the document. The `auditoria` row evidenced with a `SELECT`.
8. **HC-2 wiring:** both `FACTURA #` messages surface **verbatim** and distinguishably.
9. **HC-5 end-to-end:** a real reserva whose client name contains `<script>` is generated through the live page, and the opened document shows the text **literally**, with no script execution. Evidenced.
10. Field-by-field manual walk of one real reserva (field · DB value · rendered value).
11. `npm run qa` green.

---

**T9 — Retire `applyEditableProformaData` + the policy-editing UI (deliberate capability removal)**
**Owner:** senior-dev · **Depends on:** T8
**Files in scope:** `app/facturacion/proforma/page.tsx`
**DB/RLS:** none

1. `applyEditableProformaData` (`:110-159`), the now-unused `escapeHtml` (`:97-103`), and the `politicas` fields of `EditableProformaData` are **deleted**. Grep for `result.replace(` in the file: zero hits.
2. **HC-5 pre-condition, explicitly re-verified in this task's report:** deleting `escapeHtml` here removes **no** live protection, because T6b already escapes at the render seam and T8 already repointed the page. **State this with evidence** — re-run `tests/confirmacion-html.test.ts` and paste the result. Deleting `escapeHtml` while that suite is absent or failing is an automatic FAIL.
3. The four policy/advertencia inputs (`:745-790`) removed. Observación and the passenger list remain.
4. Policies render from T6's fixed boilerplate; a test asserts all four OQ2 paragraphs are present and **cannot** be altered from the page.
5. Report frames this as a **DELIBERATE, HUMAN-APPROVED CAPABILITY REMOVAL (OQ2)** — not a regression, not a bug fix. In those words.
6. Net line count **decreases**; number reported.
7. `npm run qa` green. Rollback: revert restores the editable policies.

---

**T10 — `.docx` fidelity verification: CONFIRMACIÓN GEB.docx**
**Owner:** junior-dev · **Depends on:** T9
**Files in scope:** `lib/document-generator.tsx` (copy/label/order corrections only), `docs/plans/geb-documents-real-data.md` (append the findings table)
**DB/RLS:** none

"All fields are present somewhere" is **not** a pass.

1. Extract `docs/CONFIRMACION GEB.docx` **yourself** (zip; `word/document.xml`, `word/media/`). Paste the extracted text.
2. **Section-by-section walk table** — `.docx section → rendered HTML section → PASS/FAIL` — in source order: `Page 1 of 2` · the CONFIRMACIÓN badge · logo · `Información de cliente` (`ID CLIENTE`, `NOMBRE`, `CEDULA/RNC`, `EMAIL`, **`WHATAPP`**) · `Información de la reserva` (all ten labels) · `Observaciones:` · the `DETALLE | PRECIO | DESC | TOTAL` table incl. multi-line descriptions · the totals block in order · the four policy paragraphs · `Información de los pasajeros:` · the thank-you line · `Atendido por: / Referido por:` · the page-2 banking/office block.
3. **Same sections, same order, same labels** — exact Spanish wording and accents. Source typos are **reproduced and flagged**, never silently fixed.
4. **The findings table must NAME all three known drifts explicitly** (none may be quietly corrected):
   - **`WHATAPP`** — the source's own spelling; reproduced deliberately.
   - **`<small>TITULAR: …</small>` inside every DETALLE row** (`lib/document-generator.tsx:1497`) — QA extracted the `.docx` and confirmed the string `TITULAR` appears in **none** of its 132 text runs. It is inherited unchanged from the legacy `generateProformaHTML` (`:779`), so it **predates this sprint**. Record it as pre-existing drift, then **remove it** — this is the fidelity task and the `.docx` is the source of truth. **Removing it without naming it in the table is a FAIL.**
   - **`BALANCE GENERAL RD $` / `US $` vs the `.docx`'s `BALANCE GENERAL EN RD $` / `EN US $`** — correctly deferred here by the dev; **placement confirmed**, this is a label-fidelity issue and T10 owns labels. Fix and record.
5. Table columns match the `.docx`'s columns and their order.
6. Boilerplate matches **character for character**, including the four OQ2 paragraphs.
7. **Every layout element the HTML cannot reproduce is named** — logo image, page-2 structure, the `Page 1 of 2` marker, the badge — each **fixed here** or recorded as an **explicit named deferral with a reason**. Silently passing on one is a FAIL.
8. Only copy/label/ordering may change. **No data-source change, no logic change.** A mismatch needing new data becomes a backlog item.
9. **HC-5 regression guard:** `tests/confirmacion-html.test.ts` re-run after the copy edits and still green — copy changes must not reintroduce a raw interpolation. Pasted.
10. `npm run qa` green.

---

### PART B — VOUCHER (starts only after T10 passes QA)

---

**T11 — Additive `reservas` columns for the voucher**
**Owner:** senior-dev · **Depends on:** T10
**Files in scope:** `scripts/062-add-voucher-fields-to-reservas.sql` (new)
**DB/RLS:** §4.2 — five nullable columns.

1. All five exist, nullable, `ADD COLUMN IF NOT EXISTS`, idempotent, `-- ROLLBACK:` header present.
2. **Block-never-default:** **no column has a `DEFAULT`.** `NULL` = "not supplied", `0` = "genuinely zero". Column definitions pasted.
3. `localizador` nullable (supplier-supplied post-creation); **no** unique constraint this sprint — reason stated.
4. Trigger untouched; no name collides with `precio_total`/`descuento`/`pasajeros`/`habitaciones`. Verified against `scripts/023:66-90`.
5. States that enabling RLS on the pre-existing `reservas` is **out of scope per HC-1** — and does not do it.
6. `npm run qa` green.

---

**T12 — Voucher server actions (localizador / régimen / pax / ocupaciones)**
**Owner:** senior-dev · **Depends on:** T11 **and T2b**
**Files in scope:** `app/actions/documentos-actions.ts`, `tests/documentos-actions.test.ts`

1. `getDatosVoucherReservaAction` / `guardarDatosVoucherReservaAction` per §5.
2. **Block-never-default, applied literally:** sets only keys `!== undefined`, never a truthiness check. A test proves `{ pax_ninos: 0 }` **writes 0** while `{ pax_ninos: undefined }` **leaves the column untouched**.
3. Never writes `precio_total`/`descuento`/`pasajeros`/`habitaciones` — grep-verified.
4. `guardarOcupacionesReservaAction` round-trips. **Deleting a group leaves its passengers** (rows survive, `ocupacion_id` NULL) — and per **T2b/HC-4** those passengers appear in `enlacesDescartados`, not silently orphaned. Both asserted.
5. Blank `localizador` saves as `NULL`, never `""`, never generated.
6. **Offline** + **mutation-checked** on the `!== undefined` guard.
7. **T2b's M1–M6 re-run and still RED** — proving this task did not regress HC-4. Pasted.
8. Anonymous probe re-run — still rejected. `npm run qa` green.

---

**T13 — Money-free `VoucherDocData` contract + builder (B3)**
**Owner:** senior-dev · **Depends on:** T12
**Files in scope:** `lib/voucher-data.ts` (new), `tests/voucher-data.test.ts` (new)

1. `VoucherDocData` carries: `titular, paxAdultos, paxNinos, paxInfantes, lugar, direccionHotel, telefonoHotel, regimen, ocupaciones[], noches, localizador, pasajeros[], observaciones, checkInFecha, checkInHora, checkOutFecha, checkOutHora`.
2. **Structural money omission.** No field, and nothing transitively reachable, carries an amount: no `total`, `precio`, `monto`, `subtotal`, `moneda`, `tarifa`, `costo`. A **compile-time** `// @ts-expect-error` test proves adding `total` is a TypeScript error, making `npm run typecheck` the leak gate.
3. **HC-5 inheritance — values are RAW.** `VoucherDocData` carries **unescaped** domain values, exactly like `ConfirmacionData`. **Pre-escaping in the builder is a FAIL** (§9 HC-5: escaping belongs to the renderer; a pre-escaped contract is wrong for PDF/CSV/log/assert use and guarantees double-escaping). A test asserts a `<script>`-bearing input survives the builder **verbatim**.
4. `buildVoucherData` returns `{ ok: true, data }` / `{ ok: false, missing }`.
5. **Block-never-default:** each blocks individually — missing/invalid dates · missing horas · missing `regimen` · zero occupancy groups · missing `pax_adultos` · missing `productos.direccion` · missing `suplidores.telefono`. **`noches` is always computed; a test asserts no `3` fallback exists in the module.** `pax_ninos`/`pax_infantes` of `0` are **valid and render as 0**, distinct from unset which blocks — one test per branch.
6. `localizador` is required in the type but the **builder** is what blocks, so the prep screen can hold an incomplete draft.
7. `observaciones` is the only optional field.
8. **Offline** — plain objects, no Supabase import, no env vars.
9. **Mutation-checked:** reintroduce `noches || 3` → RED; reintroduce a `total` field → RED; pre-escape a value in the builder → the AC-3 verbatim test REDs. Restore → GREEN.
10. `npm run qa` green.

---

**T14 — Rewrite `generateVoucherHTML` against `VoucherDocData`**
**Owner:** senior-dev · **Depends on:** T13 (and inherits T6b's helper)
**Files in scope:** `lib/document-generator.tsx` **only**

1. The old `VoucherData` interface (`:1-33`) **deleted**; `generateVoucherHTML(data: VoucherDocData)`. A price leak is now a compile error (`npm run typecheck` output pasted).
2. Deleted, grep-verified: random localizador (`:90`) · `noches … : 3` (`:117`) · literal `03:00 PM` (`:258`) / `12:00 PM` (`:263`) · `data.regimen || "TODO INCLUIDO"` (`:208`) · the `1) …` / `2) Acompañante` placeholders (`:249-250`) · the `TOTAL:` row with `fmtMoney` (`:227-230`) · `fmtMoney` itself if unused.
3. **HC-5 inheritance — mandatory, no re-litigation.** `generateVoucherHTML` is built with the **same `html` tag** from `lib/html-escape.ts`. Every interpolated value escaped by default; **selective escaping is a FAIL**; `raw(` appears zero times for this generator (T6b's static guard is extended to cover it). The voucher is hotel/supplier-facing and carries staff-typed passenger names and `observaciones` — the identical exposure. **The §10 hostile fixture is re-run against this generator**, including the accent-preservation assertion (`Categoría` appears in the room lines).
4. `DIRECCIÓN` renders `productos.direccion` and `TELÉFONO` renders `suplidores.telefono` — **fixing the current bug where `:199` prints the client's address and `:203` the agency's phone**. Called out in the report.
5. `SERVICIOS` renders `- ALOJAMIENTO - <regimen>` then one line per occupancy group: `- X <cantidad> HABITACIONES OCUPACION <ocupacion> – Categoría: <categoria>`.
6. CHECK IN/OUT render `<fecha> <hora>` from the **same columns CONFIRMACIÓN uses**. A test renders both documents from one reserva fixture and asserts the times are identical strings.
7. **Block-never-default:** no `||`/`??` substituting a value for a required field.
8. **No-money assertion:** rendered HTML matches no currency pattern (`/RD\s?\$|US\s?\$|\$\s?\d|\d+[.,]\d{2}\s*(DOP|USD)/`). **Mutation-checked** — inject a price → RED; remove → GREEN.
9. `app/facturacion/voucher/page.tsx` not in scope. `npm run qa` green.

---

**T15 — Wire `/facturacion/voucher` to real data**
**Owner:** senior-dev · **Depends on:** T14 **and T2b**
**Files in scope:** `app/facturacion/voucher/page.tsx`

1. `generateVoucherNumber()` (`:225-234`) **deleted**. `localizador` loads from and saves to `reservas.localizador`; the same reserva shows the **same** localizador across two reloads — evidenced.
2. **Prep screen stays usable while `localizador` is absent**: everything editable and savable; only **Generar e Imprimir** and **Descargar como PDF** disabled, with a visible reason. Both states evidenced.
3. `habitacion: "STANDARD"` (`:213`) and `regimen: "TODO INCLUIDO"` (`:214`) **deleted**. Régimen from `reservas.regimen`; rooms from the occupancy-group editor.
4. Fabricated `"cliente@email.com"` (`:274`, `:327`) and `"Dirección del cliente"` (`:275`, `:328`) **deleted**.
5. `Noches` derived and read-only; `Math.max(noches, 1)` (`:217`) gone. **Block-never-default:** grep for `|| 1`, `|| 0`, `|| "STANDARD"`, `|| "TODO INCLUIDO"`, `Math.max(..., 1)`.
6. Passengers load/save through T2's actions — the **same** `reserva_pasajeros` rows CONFIRMACIÓN uses (OQ1). A passenger entered on the proforma screen appears on the voucher screen.
7. **HC-4 surface (required):** after every occupancy save the page inspects `relinked`, `enlacesDescartados` and `enlacesNoRestablecidos`, and shows a **non-blocking warning** naming how many passengers need re-assignment. **A silent `success: true` is a FAIL.** Both paths evidenced on screen.
8. Blocked generation shows a clear message and produces **no** document and **no** success signal. **Both** `generateVoucher` and `downloadVoucherAsPDF` are gated — the PDF path must not bypass the block.
9. Field-by-field manual walk of one real reserva.
10. `npm run qa` green.

---

**T16 — `.docx` fidelity verification: VOUCHER GEB-2.docx + money-leak proof**
**Owner:** junior-dev · **Depends on:** T15
**Files in scope:** `lib/document-generator.tsx` (copy/label/order corrections only), `tests/voucher-data.test.ts`, `docs/plans/geb-documents-real-data.md` (append findings)

1. Extract `docs/VOUCHER GEB-2.docx` **yourself**. Paste the extracted text.
2. **Section-by-section walk table** in source order: page marker · logo · `VOUCHER #` badge · `TITULAR:` with `<n> Ad + <n> Chd + <n> Inf` · `LUGAR:` · `DIRECCIÓN:` · `TELEFONO:` (reproduce the source's accent usage) · `SERVICIOS:` with the `- ALOJAMIENTO - <regimen>` line and per-group room lines · `NOCHES:` · `LOCALIZADOR:` · `PASAJEROS`/`OBSERVACIONES` · `CHECK IN:`/`CHECK OUT:` with their trailing warnings · the `ESTA RESERVA ES VALIDA…` disclaimer · the red `Importante →` block · the deposit line · the closing line.
3. Same sections, order, labels, accents. Source typos reproduced **and flagged**.
4. **Zero money anywhere** — confirmed against the `.docx` and asserted by T14's regex test, re-run with output pasted.
5. **Every unreproducible layout element named** — logo, green localizador badge, grey `VOUCHER #` badge, page marker — each fixed or recorded as an **explicit named deferral**.
6. Only copy/label/ordering changes. No logic, no data-source change.
7. **HC-5 regression guard:** the voucher hostile-fixture test re-run after the copy edits and still green.
8. **Mutation-checked** on any assertion added here. **"It renders" is not evidence.**
9. `npm run qa` green.

---

## 12. Sprint-close deliverable (lead-owned — NOT a dev task)

At **Step 5 consolidation** the **lead** writes a new ADR under `~/Developer/CBrain/decisions/` covering: (a) Elibry is deliberately single-tenant as of this sprint; (b) the path to multi-tenancy — which tables gain `org_id`/`tenant_id`, how the ~29 policy-less tables get retrofitted, what the isolation predicate becomes; (c) confirmation that `reserva_pasajeros` and `reserva_ocupaciones` were shaped retrofit-friendly. Cross-linked from `~/Developer/CBrain/topics/multi-tenancy.md`. It must also record **F2 / HC-1**: no real authentication and no RLS on any pre-existing table, so the anon key is a full read/write credential to the whole database.

Candidate brain entries from this sprint:

- **HC-3** — *"silent log" is only real if it is a persisted row; a console line is not a log.*
- **HC-2** — *a runtime lookup failure must not silently downgrade a REQUIRED field to optional.*
- **HC-4** — *delete-then-insert over a REST API silently destroys FK links via `ON DELETE SET NULL`; when rebuilding them, key on material identity, never on render position — an honest NULL beats a confident wrong link.*
- **HC-5** — a strong **new pattern note** candidate (`patterns/escape-at-the-render-seam`): *output encoding belongs to the renderer, not the data; make it the default via a tagged template so a new field is safe without anyone remembering, and make the unsafe path (`raw()`) explicit and greppable.* Pair it with an **ADR** on the invariant it enforces: *a refactor may move a safeguard but may never delete one without an equivalent already landed — and the replacement must land before the path that needs it goes live.* HC-5 was caught only because QA re-read the pipeline end-to-end; the plan itself had T9 deleting a protection with nothing scheduled to replace it.
- A **mistake-note** candidate on the fixture weakness that let three of five mutations survive: *a one-element fixture cannot distinguish "each item uses its own value" from "every item uses the first one", and a path with zero instances of the thing under test cannot detect spurious work on that path.* A concrete addition to `mistakes/fake-green-tests`.

All five hard calls are `stockin-zero-price` in new clothing: a plausible-but-unverified value passing as real.

**This is not in the numbered task list and must not be delegated to a dev.**

---

## 13. Risks

- **R1 — This sprint does NOT fix Elibry's standing anon-key exposure (HC-1).** No real authentication (`lib/user-context.tsx:23-38`) and **no RLS on any pre-existing table** — the public anon key remains a full read/write credential to `clientes`, `reservas`, `pagos`, `comprobantes_fiscales`. Only the **two new tables** are closed. **The sprint summary must not imply the application became more secure than it did.**
- **R2 — Regression on a live, recently-touched screen.** `/facturacion/proforma` changed days ago (`d266d32`). T3's baseline is the mitigation; T6 must not edit the baseline to pass.
- **R3 — `comprobantes_fiscales` schema drift, with a bigger blast radius (HC-2).** With BLOCK, an environment lacking `reserva_id`/`numero_factura` cannot generate **any** CONFIRMACIÓN — a **potential total feature outage**. Run T7's schema check against production **before** rollout.
- **R4 — Divergent balance formulas.** `/reservas/ver/[id]` keeps showing different numbers. Out of scope by spec.
- **R5 — Backfill.** Existing reservas have no passengers, occupancy groups, `localizador`, `regimen`, `pax_*`, and post-HC-2 many may have no `comprobantes_fiscales` row. All will **block** until filled in. Correct (block > fabricate) but a real day-one operational change.
- **R6 — The silent error swallow at `app/facturacion/fiscal/page.tsx:142-143` remains.** Excluded from T7 by the HC-2 ruling. Needs its own task.
- **R7 — A failed discrepancy-log write is silent by design (HC-3).** Combined with **B-7** (nothing reads `auditoria`), the "captured for cleanup" promise is only as good as the follow-up.
- **R8 — Approach C couples the feature to server actions.** If `SUPABASE_SERVICE_ROLE_KEY` is unset, passenger/occupancy I/O throws (`lib/supabase-server.ts:30-32`). Deployment checklist item.
- **R9 — HC-4's re-link is a heuristic over a multi-round-trip window, not a transaction.** (a) A materially-changed room returns its passengers **unassigned** — correct and reported, but a `categoria` typo-fix still costs that room's links until **B-8**. (b) B-5's concurrency window now also covers "one staff edits rooms while another edits passengers"; the null-guard means the worst case is a **reported** unassigned passenger, never a silently wrong room.
- **R10 — HC-4 was found only because QA mutation-tested; three of five mutations had survived green.** The same fixture weakness may exist in other suites. T2b AC-8 fixes it locally, but **every task shipping a test should be read with that failure mode in mind**.
- **R11 — HC-5 was a planned security regression that the plan itself created.** T9 was scheduled to delete `escapeHtml` with nothing replacing it, and the exposure actually opens one task earlier, at **T8**. It was caught only because QA read the *pipeline* rather than the file. Mitigation is T6b plus the "no net loss of protection" invariant (§1), and T9 AC-2 now requires re-verifying the replacement before the deletion. **The general risk stands: this plan retires other behaviour too (OQ2 policy editing), and "what did this deletion silently protect?" must be asked of every removal, not just this one.**
- **R12 — `generateReciboHTML` remains unescaped (HC-5 residual).** `lib/document-generator.tsx:1597-1804` interpolates `cliente.nombre`, `pago.referencia`, `pago.metodo` raw and renders through the same `openDocumentInNewWindow`. **Pre-existing, not caused by this sprint, deliberately out of scope** — but a real exposure on a customer-facing receipt, and trivially fixable once `lib/html-escape.ts` exists. Backlog **B-12**; schedule it. Likewise `generateProformaHTML` stays unescaped until deleted (**B-13**).

PLAN_PATH: docs/plans/geb-documents-real-data.md
