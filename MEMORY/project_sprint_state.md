# Elibry — Project Sprint State
# as of 2026-08-14

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

### 2026-07-28 — VOUCHER TELEFONO hotfix (round 2, lead-approved, uncommitted)

**Trigger:** PRODUCTION OUTAGE. After the human applied `scripts/061`, `062`, `063` to the real
database for the **first time ever**, no voucher could be generated at all.

#### 1. What happened

`app/facturacion/voucher/page.tsx` ran `.from("suplidores").select("id, telefono")`. There is no
`telefono` column on `suplidores` — the real column is `telefono_responsable`
(`scripts/001-create-tables.sql:21`). PostgREST returned HTTP 400 / Postgres `42703` on every page
load; the error was swallowed into a bare `console.error` with no toast; `suplidores` stayed `[]`;
`suplidorReal` was `null` for every reserva; `telefonoHotel` was `null`; `lib/voucher-data.ts`
blocked every voucher with `"TELEFONO (suplidores.telefono)"`.

#### 2. Root cause — the important part

`lib/supabase.ts` contained a hand-written `interface Suplidor` declaring `telefono: string` — a
field that does not exist in the database. The prior `geb-documents-real-data` sprint's plan
verified the column **against that TypeScript interface instead of against the schema**
(`docs/plans/geb-documents-real-data.md:53`, verbatim: *"`suplidores.telefono` exists
(`lib/supabase.ts:136-150`). Confirms the spec's correction: no new columns for hotel
address/phone."*). A type declaration was treated as evidence about the database. TypeScript could
never catch it — PostgREST `.select()` strings are untyped. This shipped through a 16-task,
fully-QA-gated sprint and only surfaced when a real database was finally connected. Recorded as
instance 6 of `~/Developer/CBrain/mistakes/assertion-without-verification.md`.

#### 3. The fix (human chose the source explicitly)

TELEFONO repointed to `productos.telefono_contacto` (`scripts/032:3-4`, `scripts/033:2-4`) — the
hotel property's own front-desk number — and the `suplidores` query **deleted entirely**.
`direccionHotel` already comes from `productos.direccion`; the source doc
`docs/VOUCHER GEB-2.docx` renders TELEFONO directly under the hotel's DIRECCIÓN.
`suplidores.telefono_responsable` is the supplier account manager's phone — a different person,
wrong for a document a guest presents at a hotel front desk. Also: stopped swallowing fatal load
errors (clientes + productos now toast), and corrected the stale `Suplidor.telefono` →
`telefono_responsable` in `lib/supabase.ts`.

**Note (superseded 2026-07-28, same day): this exact fix was itself repointed again in the
"Live DB verification session" entry below — `productos.telefono_contacto` turned out to be a dead
column, NULL on every production row.**

**Files changed** (all uncommitted, tree sits on `2f768c2` "wave 4"):
`app/facturacion/voucher/page.tsx`, `lib/voucher-data.ts`, `lib/supabase.ts`,
`tests/voucher-data.test.ts`, `tests/voucher-html.test.ts`, `tests/voucher-page.test.ts` (new).

#### 4. Evidence

`npm run qa` run twice, 25 files / 530 tests, `tsc` clean, exit 0. Test count 519 → 522 (round 1) →
530 (round 2).

- **Round 1 → RISKY → lead SEND-BACK.** QA finding: the fix was correct but the exact line that
  caused the outage had **zero regression guard**. Three mutations all stayed 522/522 GREEN:
  hardcoding `telefonoHotel` to `null`; swapping the wiring to `productoReal?.direccion` (a
  realistic copy-paste from the line directly above); and — most importantly — dropping
  `telefono_contacto` from the `productos` select string, **structurally the same bug class as the
  outage itself, one layer over.** The dev's stated reason for not testing ("no React Testing
  Library harness") was technically true but misleading: `tests/crm-casos-page.test.ts` is this
  repo's established precedent for testing page-level logic with no RTL — it imports an exported
  pure helper (`buildCierreOptimista`) out of `app/crm/casos/page.tsx` and unit-tests it in the
  node environment.
- **Round 2 → PASS.** Dev extracted `derivarTelefonoHotel` and `PRODUCTOS_SELECT_COLUMNS` as
  exported values, added `tests/voucher-page.test.ts` (8 node-environment tests importing the real
  functions). QA independently re-mutated and confirmed both now go RED at the correct assertions.
  QA verified "no behavior change" across every input class including `productoId = 0` and
  empty-string `telefono_contacto` (neither of which the dev's own suite covers).

#### 5. Additional findings

**A) Schema drift — `scripts/` does not describe the real database.** QA found
`scripts/004-insert-real-data.sql:4` INSERTs into `suplidores` referencing `telefono`,
`contacto_principal`, and `registrado_por` — columns no `CREATE`/`ALTER` statement anywhere in
`scripts/` ever defines. Same shape as the already-known `comprobantes_fiscales` unknown (real
shape exists only in production, created out of band). **Grepping `scripts/` is not sufficient
evidence about production schema in this project.** Both a TypeScript interface and the migrations
folder have now been proven unreliable as schema evidence — the only trustworthy source is
`information_schema` against the live database. New mistake filed:
`~/Developer/CBrain/mistakes/schema-source-of-truth.md`.

**B) Dev's unverified "pre-existing" claim.** Dev reported a `react-hooks/exhaustive-deps` lint
warning as "PRE-EXISTING." QA bisected — `git stash` to base commit `2f768c2`, ran eslint on the
byte-identical base file, got 0 warnings/0 errors. The warning does **not** exist in the
pre-hotfix codebase. Real cause: round-1's own `toast({...})` additions inside `fetchReservas`
made the effect's deps unstable (exhaustive-deps does transitive closure; `fetchReservas`
references `toast` from `useToast()`). Not a gate failure (0 errors, count flat at 30 across both
runs, and the toast change was deliberate and lead-approved) — but it is
assertion-without-verification's exact shape: a claim about system state asserted without running
the baseline that would prove it.

#### 6. Rollback path

`git checkout -- app/facturacion/voucher/page.tsx lib/voucher-data.ts lib/supabase.ts
tests/voucher-data.test.ts tests/voucher-html.test.ts && rm tests/voucher-page.test.ts`. Repo
returns to `2f768c2` "wave 4"; no commit exists for this hotfix, so there is nothing else to
unwind in the repo. **Note:** the `061`/`062`/`063` migrations themselves are already applied to
the human's real database and are **not** reverted by this rollback — that is a separate,
human-controlled DB operation, out of scope here.

#### 7. Backlog carried forward

- `lib/supabase.ts`'s `Suplidor` interface still missing `telefonos?: string[]` — two other files'
  local interfaces declare it and `app/suplidores/editar/page.tsx:100` actively reads
  `data.telefonos`.
- `reservas`-load still silently swallows its error (`page.tsx:244-257`) — inconsistent with the
  clientes/productos fix in the same function.
- `lib/document-generator.tsx:77-80` stale doc comment still names `suplidores.telefono`.
- `productoId = 0` has no test case.
- Call-site wiring gap: nothing verifies `construirVoucherData` actually calls
  `derivarTelefonoHotel`, nor that `.select()` actually uses `PRODUCTOS_SELECT_COLUMNS`. Only
  closure path is exporting/parameterizing `construirVoucherData` — a scoped follow-up needing
  explicit authorization.
- One decorative assertion in `tests/voucher-page.test.ts`.
- **Audit candidate, high value:** every other hand-written interface in `lib/supabase.ts` is
  unverified against the real schema by the same reasoning that caused this outage. Recommend an
  `information_schema`-vs-interfaces reconciliation once DB access is available.

**Not fixed, explicitly out of scope:** HC-1 (no authentication, no RLS on ~29 pre-existing
tables — ADR 0011) — unchanged by this hotfix. CONFIRMACIÓN's status still depends on R3
(`comprobantes_fiscales` needing `reserva_id`/`numero_factura`) — still unverified **as of this
entry; answered in the entry below.**

---

### 2026-07-28 — Live DB verification session (uncommitted, on top of `4d92173`)

**Trigger:** the human applied `scripts/061`, `062`, `063` to their real Supabase database for the
first time, hit failures, then pasted a full `.env` (POSTGRES_URL, SUPABASE_SERVICE_ROLE_KEY,
SUPABASE_JWT_SECRET, POSTGRES_PASSWORD, anon key) into the chat so the agent could stop guessing.
**First time this project has had live production database access.** The agent flagged the paste
once, clearly, recommended rotation, and continued — it is the human's database and their call. No
credential value is recorded anywhere in this entry or the brain. The agent used the credentials
**read-only**; it wrote nothing to the database. Durable lesson: hand the agent a **file path**
("read .env.local") rather than pasting secrets into a transcript that may be retained — recorded
as a team-wide convention in `~/Developer/CBrain/agents/tool-use.md`.

#### 1. What shipped / was answered

1. **VOUCHER TELEFONO repointed again — to the real column.** The previous entry's hotfix moved
   TELEFONO from the nonexistent `suplidores.telefono` to `productos.telefono_contacto`. A live
   query proved `telefono_contacto` is **NULL on all 8 production rows** and nothing in the app
   ever writes it — a dead column from `scripts/032`+`033`. The real populated column is
   `productos.telefonos_json`, a JSON string array (e.g. `["8492522022","8093222058"]`), written by
   `app/productos/registrar/page.tsx:220` and `app/productos/editar/page.tsx:237`, read by
   `app/productos/ver/page.tsx:145`. **`telefonos_json` and `emails_json` appear in zero migration
   files** — confirmed by grep across all of `scripts/`. Human ruled: print ALL entries joined
   `", "`; duplicates preserved (production has them). Shipped, QA PASS, lead APPROVE.
2. **R3 definitively answered — and it is the bad case.** R3 (does `comprobantes_fiscales` have
   `reserva_id`/`numero_factura`?) has been the top open risk since `geb-documents-real-data`. Live
   query: **both missing (`42703`)**, along with `cliente_id`, `codigo_reserva`, `factura`. The real
   table is a **supplier-invoice** table: `id`, `numero_comprobante`, `tipo_comprobante`, `ncf`,
   `fecha_emision`, `fecha_vencimiento`, `proveedor_nombre`, `proveedor_rnc`, `proveedor_direccion`,
   `proveedor_telefono`, `descripcion`, `subtotal`, `itbis`, `total`, `moneda`, `tasa_cambio`,
   `estado`, `documento_url`, `observaciones`, `usuario_registro`, `fecha_registro`,
   `usuario_modificacion`, `fecha_modificacion`. Its 5 rows are generic demo seed data (e.g.
   "Distribuidora Central S.A.", "Ferretería El Constructor" — construction materials, hardware
   stores, fuel, office supplies), nothing travel-related, untouched since 2025-11-10. No
   client-invoice linkage table exists anywhere — `facturas`, `facturas_clientes`, `comprobantes`,
   `ncf_secuencias`, `secuencias_ncf`, `facturacion` were all probed and are all absent. All 6
   production `reservas` rows: `proforma="PROFORMA"`, `factura_url=null`,
   `factura_cliente_url=null`, `factura_enviada_cliente="NO"` — **no client invoice has ever been
   issued in this system.** `comprobantes_disponibles` IS legitimate: 8 correctly-shaped DGII NCF
   blocks (B010 crédito fiscal, B020 consumo, B030/B040 notas, B110 compras, B130 gastos menores),
   with authorization/expiry dates, one marked AGOTADO — simply never linked to a reserva.
   Investigation only; nothing shipped from this finding directly — it is the evidentiary basis for
   item 3.
3. **HC-2 reversed — a documented fiscal ruling overturned on evidence.** HC-2 (from
   `geb-documents-real-data`) ruled FACTURA # must block CONFIRMACIÓN rather than render
   blank/fabricated — correct given its premise (the number existed and the lookup was merely
   unverified). Finding 2 falsified that premise: there is no possible source, so blocking forever
   is a dead end, not a safeguard. Human ruled: **"make factura # optional for now."** Shipped:
   `facturaNumero` is now `string | null` in `lib/document-generator.tsx`; the required-field check
   removed; absent normalizes to `null` (never `""`/`"N/A"`/placeholder/date); the document keeps
   the "FACTURA #:" label and renders an empty value, matching the existing `Referido por:`
   optional-field precedent (`document-generator.tsx:1575-1579`);
   `app/facturacion/proforma/page.tsx` no longer early-returns. **Design rule enforced:**
   `SIN_COMPROBANTE` (the normal state — no comprobante exists) generates silently, no toast;
   `LOOKUP_FAILED` (a technical failure) generates but fires a non-blocking destructive toast —
   these must never collapse into one silent outcome (that collapse is what caused the prior day's
   outage). Recorded as ADR
   `~/Developer/CBrain/decisions/0012-elibry-confirmacion-without-factura-numero.md`. QA
   independently grep-proved zero writes to `comprobantes_fiscales`/`comprobantes_disponibles` and
   zero NCF allocation; rendered the document itself with `facturaNumero: null` and confirmed a
   truly empty value (no literal "null", no placeholder, no fallback); independently mutated two
   required fields it chose itself (`cedulaRnc`, `horaSalida`) to prove the builder wasn't globally
   loosened. QA PASS, lead APPROVE.
4. **Migrations 061/062 confirmed applied and correct.** `reserva_pasajeros` and
   `reserva_ocupaciones` exist with exactly the designed columns; all 5 new `reservas` columns
   present. First live confirmation ever — verification only, nothing shipped.
5. **Occupancy prefill shipped, on the second try, after the human corrected the agent's own
   inference twice, with real data, and was right both times.** The agent had recommended against
   prefilling the voucher's occupancy editor, on two premises, both wrong: **(a)**
   `reservas.habitaciones` is a trigger-owned SUM, so seeding it breaks multi-group cases —
   dissolved once the correct source, the **per-line** `reserva_detalles.habitaciones`
   (`scripts/023:15`, one occupancy group per service line), was used instead of the aggregate
   column; it was in the agent's own investigation and it had anchored on the wrong column.
   **(b)** `reserva_detalles.concepto` "in practice holds 'Servicio Principal'" — **this was an
   inference from the form's default value, never an observation**, and the agent's own prior
   investigation had explicitly marked `concepto`'s production values UNVERIFIED before the agent
   reasoned from that inference as if it were fact. Live data: `concepto` holds
   `"PRUEBA 1 DOBLE"`, `"PRUEBA 2 SENCILLA"` — later confirmed by a live query
   (`reserva_detalles` id=104 `concepto="PRUEBA 1 DOBLE"` `descripcion="PRUEBA 1"`, id=105
   `concepto="PRUEBA 2 SENCILLA"` `descripcion="PRUEBA 2"`); the reserva form's own placeholder is
   literally *"Ej: Habitación Doble, Habitación Triple, Niños"* — the field was designed for this.
   Shipped: prefill from `reserva_detalles`, one occupancy row per service line, `cantidad ←
   habitaciones` (per line), `ocupacion ← concepto` verbatim, `categoria ← descripcion` verbatim,
   only when nothing is already saved; a null source stays blank. Plus reserva totals surfaced next
   to the inputs and non-blocking mismatch warnings. QA PASS after two send-backs, lead APPROVE.

#### 2. Evidence / send-back log

- **Task 2 (input guards), round 1 — FAKE-GREEN.** Already filed as `fake-green-tests`
  anti-pattern #10 (a mutation that went RED for the wrong reason — a crashed, un-queued mock, not
  the guard actually firing). No new filing this session; restated here for the day's timeline.
- **TELEFONO hotfix, round 1 — zero regression guard on the exact outage line.** Already filed as
  `fake-green-tests` anti-pattern #11 (a refuted "no RTL harness" excuse). No new filing this
  session.
- **Occupancy prefill, round 1 — the dev omitted the test-file diffs from their report "for
  length."** HARD GATE violation ("paste the actual changed lines, no summaries-as-proof"). Lead:
  *"The gate is about what the dev submits, not what QA can reconstruct after the fact."* Sent
  back; diffs supplied in round 2.
- **Occupancy prefill, round 2 — QA found the M4 gap relocated rather than closed**: the extracted
  function is pinned by a test, but nothing forces the real caller to actually use it. Lead
  APPROVED anyway, ruling consistency with two prior same-day acceptances and noting real closure
  needs a component-test harness this repo lacks.
- **FACTURA # optional — dev self-disclosed** that removing the `LOOKUP_FAILED` toast leaves all
  593 tests green, because `proforma/page.tsx` has zero coverage. Disclosed honestly rather than
  papered over. Lead accepted but **ELEVATED it to the next scoped task**, not generic backlog — it
  is the one thing separating a silent technical failure from a normal state on a fiscal-adjacent
  lookup.

#### 3. Orchestration errors this session (recorded honestly)

a) **Two dev agents ran concurrently on one uncommitted working tree.** A known, already-filed risk
   (`~/Developer/CBrain/mistakes/environment-reliability-incidents.md`, "concurrent-agent scratch
   contamination") — recurred, this time on the real working tree rather than just a scratch dir.
   Both agents independently reported seeing the other's files change under them. QA's
   contamination check found no actual corruption (full `git diff` read hunk-by-hunk across all 11
   files, every named function verified), and lead ruled that substantive and sufficient — but the
   risk was taken knowingly-in-hindsight and is logged as a **recurrence**.
b) **The orchestrator omitted the rollback notes from the review packet handed to lead**, causing a
   spurious send-back. Both dev reports HAD them; the orchestrator failed to relay them. Same
   defect class as assertion-without-verification, one layer up: the reviewer was given an
   incomplete evidence packet and ruled on the gap rather than the substance.
c) **The orchestrator inferred production data from a form default and presented it as fact** (the
   "Servicio Principal" claim in finding 5(b) above), when the underlying investigation had
   explicitly marked it UNVERIFIED. The human corrected it with real data.

#### 4. Rollback path

No commit exists for this session's diffs; tree sits on `4d92173`. `git checkout --` the touched
files (the voucher TELEFONO derivation path, `lib/document-generator.tsx`,
`app/facturacion/proforma/page.tsx`, `app/facturacion/voucher/page.tsx`,
`app/actions/documentos-actions.ts`, and their test files) returns the repo to `4d92173` exactly.
No DB write was made by the agent — migrations `061`/`062`/`063` were applied by the human
directly, before this session, and are **not** reverted by any repo-level rollback; that is a
separate, human-controlled DB operation, out of scope here.

#### 5. Backlog carried forward

- **LOOKUP_FAILED toast coverage on `proforma/page.tsx`** — ELEVATED to next scoped task (lead's
  explicit ruling), not generic backlog; the file currently has zero test coverage of any kind.
- **The `information_schema`-vs-`lib/supabase.ts` interface reconciliation** — now strongly
  justified by two more confirmed drift instances (below), still not done.
- **File-size breach, grew this session:** `voucher/page.tsx` 1526 lines, `document-generator.tsx`
  1840 lines, `documentos-actions.ts` ~1213 lines — all past the repo's ≤500-line rule; splits
  remain their own scoped task, never bundled into a feature task.
- **Call-site wiring gaps** — `derivarTelefonoHotel`, `PRODUCTOS_SELECT_COLUMNS`, and (new)
  `resolverOcupacionesParaPrefill` are each pinned by a unit test but nothing verifies the real
  caller actually uses them. Real closure needs a component-test harness this repo lacks.
- **`.docx` independent verification** — QA could not open the binary; still unverified against the
  rendered document.
- **5 demo rows sitting in `comprobantes_fiscales`**, a tax-relevant table — human decision,
  untouched this session.
- **Client invoicing does not exist as a system** — the real project behind the FACTURA # question;
  see ADR `0012-elibry-confirmacion-without-factura-numero`.
- **Credentials pasted into a transcript need rotation** — human action, not yet done.
- `productoId = 0` still untested; `debePrefillarOcupaciones` now uses `Boolean()` (done); the
  `reservas`-load silent swallow (`page.tsx:244-257`) still unfixed; `lib/document-generator.tsx:78`
  stale comment still names `suplidores.telefono`; `Suplidor.telefonos` still missing from the
  shared `lib/supabase.ts` interface.

**Not fixed, explicitly out of scope, must be surfaced again before any future sprint touches auth
or RLS broadly:** HC-1 (no authentication, no RLS on ~29 pre-existing tables — ADR 0011) —
unchanged by this session.

---

### 2026-08-03 — reserva-document-entry-points (T1–T8, uncommitted, on top of `8f00cdc`)

**Plan:** `docs/plans/reserva-document-entry-points.md` · **Slug:** `reserva-document-entry-points`
**Recovered mid-sprint**: the machine shut down after Task 3. T1–T3 were re-verified from the tree
and the live DB rather than trusted; T4–T8 were completed in this session.

#### 1. What shipped (user-facing)

1. **PROFORMA/CONFIRMACIÓN and VOUCHER now keep SEPARATE passenger lists** on the same
   `reserva_pasajeros` table, discriminated by a new `documento_destino` column (`'VOUCHER'` |
   `'PROFORMA'`). Editing one document's passengers can no longer overwrite or delete the other's.
2. **PROFORMA's passenger editor works like VOUCHER's** — it seeds `reservas.pasajeros` blank rows
   when the reserva has no PROFORMA rows yet (min 1; `Number.isFinite`/`isInteger`, never
   truthiness; a NAME is never fabricated), and a failed read now fires a destructive toast instead
   of silently looking like "this reserva has no passengers".
3. **Direct entry points**: "Generar Proforma" / "Generar Voucher" buttons on the
   `/reservas/ver/[id]` header AND in each `/reservas/pendientes` row's action group (human chose
   BOTH locations, 2026-08-03 — the plan had only specified `ver/[id]`). Each is a bare
   `router.push` to `?reserva_id=<reservas.id>`; the destination pages auto-select that reserva
   through their EXISTING handlers, so no generation validation is duplicated or bypassed.
4. **The dead "Observación" textarea is gone** from PROFORMA's dialog — it never reached the
   generated document (`observaciones` has always come from `reservas.nota_interna_reserva`, which
   is unchanged at `proforma/page.tsx:564`).
5. New `lib/deep-link-reserva.ts` (pure, node-tested). Both facturación pages gained the
   `<Suspense>` boundary Next 14.2 requires for `useSearchParams()`.

#### 2. Evidence

- `npm run qa` (= `tsc --noEmit` → `eslint .` → `vitest run`): **27 files / 618 tests, exit 0**,
  0 lint errors, 30 warnings (flat vs. baseline). Test count 604 → 618 (+9 proforma-page, +5
  deep-link).
- `npx next build`: **Compiled successfully**, no "useSearchParams() should be wrapped in a
  suspense boundary" for `/facturacion/proforma` or `/facturacion/voucher`. Both prerender.
- **Mutations actually run and shown RED, then restored:** `pasajeros || 1` in place of the
  finite/integer test (RED on the `-2` case); "return blanks on failure" in place of `null` (RED on
  the failed-read case).
- **Live-DB isolation proof (T8), run against the real Supabase project on reserva 7 with the REAL
  server actions and NO mocks** — the thing an in-memory mock structurally cannot prove:
  - Baseline: `Johan Contreras`(id 8)/VOUCHER, `Pedro`(id 9)/VOUCHER.
  - After `guardarPasajerosReservaAction(7, [CARLA C, DIEGO D], …, "PROFORMA")`: both VOUCHER rows
    present **with their original ids 8 and 9** — not deleted-and-reinserted, physically untouched.
  - **The UNIQUE swap is confirmed applied**: `orden = 1` exists simultaneously for VOUCHER and
    PROFORMA on one reserva — unreachable under the old `UNIQUE (reserva_id, orden)` (23505).
  - Reverse direction also proven: a VOUCHER re-save left both PROFORMA rows intact.
  - Invalid `documento_destino` (`"FACTURA"`, `""`) rejected on BOTH actions against the live DB,
    with zero row change before/after.
  - Cleanup ran; reserva 7 restored to its exact original content (VOUCHER-only, same names/order).
    Surrogate ids advanced 8/9 → 16/17 **because the test itself re-saved the VOUCHER list** —
    delete-then-insert is the pre-existing `reemplazarConjuntoConRestauracion` contract, unchanged
    by this sprint.
- Route smoke test on `next dev`: `/reservas/pendientes`, `/reservas/ver/7`,
  `/facturacion/proforma?reserva_id=7`, `/facturacion/voucher?reserva_id=7` and a bogus
  `?reserva_id=99999999` all return 200. Both `data-testid="btn-generar-proforma"` and
  `btn-generar-voucher` are present in the shipped client chunks for BOTH reserva pages;
  `"Ingrese observaciones adicionales"` occurs **0** times in the proforma chunk.

#### 3. The honest part

- **The interactive click-through (plan steps M2/M3/M7/M9/M10/M12) was NOT performed** — no browser
  automation was connected in this session. What is proven is: the routes serve 200, the buttons
  and the deep-link param exist in the real client bundles, and the underlying data behaviour is
  verified live. What is NOT independently observed: the dialog visibly opening pre-filled, the
  list visibly filtering to the `codigo`, and the "reserva no encontrada" toast actually appearing.
  Those remain human click-through steps.
- **Deliberate deviation from the plan, one line**: `voucher/page.tsx`'s `loading` state now starts
  `true` instead of `false`. The plan's "run the effect only when `loading === false`" gate is
  wrong on that page as written — `loading` started `false`, so the deep-link effect would have
  observed an empty `reservas` array on first render and reported a perfectly valid id as
  "no encontrada". `fetchReservas` always resolves it in its `finally`.
- **Scope deviation, human-approved**: `app/reservas/pendientes/page.tsx` is a 10th file, outside
  the plan's 9-file seam map. Added because the human explicitly chose BOTH entry-point locations.
- **A pre-existing repo condition was found and verified, not assumed**: after any `next build`,
  `tsc --noEmit` fails on `.next/types` for every page that exports a helper. Bisected by stashing
  the entire sprint and rebuilding — the SAME errors appear at baseline for `app/crm/casos/page.tsx`
  and `app/facturacion/voucher/page.tsx`, files this sprint did not create the exports in. `npm run
  qa` is green on a clean `.next`. This is the repo's extract-a-pure-function-from-a-page test
  pattern colliding with Next's generated page types — pre-existing, now one page worse (proforma
  joins the list). **New backlog item.**
- No RLS statement was executed at any point; migration 064 (applied by the human before this
  session) contains none. Access to `reserva_pasajeros` remains exclusively through the
  service-role `"use server"` module. HC-1 (no auth, no RLS on ~29 pre-existing tables, ADR 0011)
  is **unchanged** — this sprint did not make Elibry more secure.

#### 4. Rollback path (nothing committed; tree sits on `8f00cdc`)

`git checkout -- app/actions/documentos-actions.ts app/facturacion/proforma/page.tsx
app/facturacion/voucher/page.tsx app/reservas/pendientes/page.tsx "app/reservas/ver/[id]/page.tsx"
tests/documentos-actions.test.ts MEMORY/project_sprint_state.md && rm lib/deep-link-reserva.ts
tests/deep-link-reserva.test.ts tests/proforma-page.test.ts`. **The DB migration is NOT reverted by
this** — `documento_destino` and the swapped UNIQUE constraint stay applied; the column's
`DEFAULT 'VOUCHER'` keeps the reverted code working unchanged. The migration's own rollback block
(`scripts/064`) deletes PROFORMA passenger rows and is a separate, human-controlled operation.

#### 5. Backlog carried forward

- **`.next/types` vs. page-exported helpers** (new, above) — decide between a `tsconfig` exclude, a
  `qa` script that cleans `.next` first, or moving page helpers into `lib/`.
- **Interactive click-through of M2/M3/M7/M9/M10/M12** still owed by a human.
- **File-size breach, worse again**: `voucher/page.tsx` ~1592, `proforma/page.tsx` ~1010,
  `documentos-actions.ts` ~1275, `reservas/ver/[id]` ~955, `tests/documentos-actions.test.ts` ~2300
  — all past the ≤500-line rule. Splits remain their own scoped tasks (B-1/B-9), never bundled.
  `lib/deep-link-reserva.ts` and the two exported proforma seeders push logic the other way.
- **No cap on seeded passenger rows** — a pathologically large `reservas.pasajeros` renders that
  many inputs. Accepted, logged; inventing a cap is an unspecified product decision.
- Everything carried forward from the 2026-07-28 entries (LOOKUP_FAILED toast coverage, the
  `information_schema`-vs-`lib/supabase.ts` reconciliation, `.docx` verification, the 5 demo rows
  in `comprobantes_fiscales`, client invoicing as an un-started project, **credential rotation
  still not done**) is **unchanged** by this sprint.

---

### 2026-08-04 — factura-numero-lookup-contract (T0–T4, COMMITTED)

**Plan:** `docs/plans/factura-numero-lookup-contract.md` · **Slug:** `factura-numero-lookup-contract`
**Baseline:** `89cc76e` → **HEAD:** `e3e7906`. **Commits: `a774a9f` (Tasks 1 AND 2 together),
`e3e7906` (Task 3).** This is the first sprint in this file that actually committed. Note the plan's
line 234 claim *"each task ships one commit"* is **false in reality** — Tasks 1 and 2 both live in
`a774a9f` and are not separable (amendment G12).
All five tasks: QA PASS, lead APPROVE. Lead edited no source file.

#### 1. What shipped — ZERO user-visible change

An operator cannot tell this sprint happened. Same toast title, same description, same
`variant: "destructive"`, same position in the flow, same document output (`FACTURA #:` label, empty
value in the normal state). That is the design (AC-8). What was actually bought:

1. **A testable seam where there was none.** ADR-0012's design rule — `SIN_COMPROBANTE` (normal,
   silent) and `LOOKUP_FAILED` (technical failure, destructive toast) **must never collapse** —
   previously lived inline inside `generarConfirmacion`, a closure inside a ~1010-line
   `"use client"` component: not importable, therefore not testable, therefore not pinned. It now
   lives in **`lib/factura-numero-confirmacion.ts` (31 lines)**, imported directly by node tests
   that drive the real production path (not a mirror).
2. **A regression guard that survived three adversarial rounds.** `tests/factura-numero-confirmacion.test.ts`,
   7 `it` blocks. Task 1 was sent back twice on QA mutations that stayed GREEN: **QA-M2** (a *full*
   hardcode of the `ok` return) and **QA-M6** (a *partial* series-prefix hardcode, `"B01" +
   slice(3)`, which survived only because both fixtures shared the `B010000` prefix). The final
   suite kills both.
3. **One emission site.** `"Error técnico al consultar el comprobante fiscal"` now occurs **exactly
   once** in production source (AC-6 grep = 1, in `lib/factura-numero-confirmacion.ts`); it was at
   `app/facturacion/proforma/page.tsx:438` at baseline.
4. **A compile-time omission guard.** `BuildConfirmacionDataInput.facturaNumero` went optional →
   **required** (type-only, `lib/confirmacion-data.ts`). Delete the FACTURA # resolution step from
   the generation path and `tsc --noEmit` — therefore `npm run qa` — fails. The runtime expression
   at `lib/confirmacion-data.ts:364` is **byte-identical**; ADR-0012's "absent → `null`, never
   blocks" tests stay green with intent unmodified.
5. **3 production files, 53 changed lines** (cap 3 files / ≤60): `lib/factura-numero-confirmacion.ts`
   (new), `app/facturacion/proforma/page.tsx` (14 lines, 2 hunks), `lib/confirmacion-data.ts`
   (8 lines, type-only). Plus `tests/factura-numero-confirmacion.test.ts` (new, excluded from cap).
   **No DB, no RLS, no auth, no NCF, no new `.select()`, no `scripts/` change.**

#### 2. Evidence

- **Task 0** — `git rev-parse HEAD` = `89cc76e`, clean tree; `rm -rf .next && npm run qa` → 27 files
  / 618 tests / 0 lint errors / 30 warnings / 0 failures; `npx next build` clean; AC-6 grep → 1 hit
  at `proforma/page.tsx:438`. QA PASS.
- **Task 1** — six plan mutations run RED with the failing assertion named, restored green. Rounds
  1-2 QA **RISKY → lead SEND-BACK** (QA-M2, QA-M6); round 3 QA PASS. Test count 618 → 625.
- **Task 2** — 14 changed lines confined to the import block + `:422-442`; AC-6 grep → exactly 1;
  `rm -rf .next && npm run qa` green; `npx next build` clean. QA PASS round 1.
- **Task 3** — 8 changed lines, type-only; `:364` byte-identical, no `missing.push` added,
  `tests/confirmacion-data.test.ts` / `confirmacion-html.test.ts` untouched and green; the AC-7
  mutation failed typecheck naming `facturaNumero`, restored green. QA's counterfactual proved the
  guard load-bearing. QA PASS round 1.
- **Task 4 (verification only, zero files)** — round 1 QA RISKY → **lead SEND-BACK, BUG-1**: the
  stated Task 1 rollback was **inexecutable** (`git checkout 89cc76e -- lib/factura-numero-confirmacion.ts
  tests/factura-numero-confirmacion.test.ts` → `error: pathspec … did not match any file(s) known to
  git`, exit 1 — the files do not exist at the baseline). Round 2: QA executed the corrected
  four-command sequence **end-to-end in a fresh throwaway clone** (exits 0/0/0/0),
  `git diff 89cc76e HEAD --stat` **empty**, `npx tsc --noEmit` 0 errors, `npx vitest run` 27 files /
  618 tests. AC-11 → 3 production files / 53 lines. AC-10 → `git status --porcelain scripts/` empty
  and the amended (test-excluding) `.select(|insert|update|upsert|delete|ncf` gate returns nothing.
  QA PASS. HEAD unchanged, no file written.

#### 3. Rollback path (whole sprint) — QA-VERIFIED, VERBATIM

```
git revert --no-edit e3e7906
git checkout 89cc76e -- app/facturacion/proforma/page.tsx
git rm -f lib/factura-numero-confirmacion.ts tests/factura-numero-confirmacion.test.ts
git commit -m "Roll back factura-numero-lookup-contract sprint"
```

QA ran all four in a fresh clone: exits 0, 0, 0, 0; `git diff 89cc76e HEAD --stat` **empty**
(byte-identical to the pre-sprint tree); `npx tsc --noEmit` 0 errors; 27 files / 618 tests passed.

- **Ordering constraint — run them in exactly this order.** `git rm` before the page revert leaves
  an intermediate tree that does not compile:
  `app/facturacion/proforma/page.tsx(35,51): error TS2307: Cannot find module '@/lib/factura-numero-confirmacion'`.
  Precise form (lead-adopted from QA): *wrong order leaves a non-compiling intermediate state; the
  final tree is only correct if you do not commit or validate between steps.*
- **Do NOT use `git revert a774a9f` as a per-task rollback.** Reason: **it over-reverts Tasks 1 and
  2 together** (`a774a9f` contains Task 1's new lib+test AND Task 2's page edit). It does **NOT**
  break the build — QA ran it: exit 0, `tsc --noEmit` 0 errors. Round 1's "breaks the build"
  framing was a false claim and has been struck.
- **Partial rollback:** Task 3 alone IS independently revertable — `git revert e3e7906`, exit 0,
  tsc 0 errors, Task 1's unit suite still 7/7 green.
- No DB migration and no destructive operation occurred; nothing to unwind outside the repo.

#### 4. The honest part — residual risk, three parts. Coverage is NOT complete.

- **(a) Verbatim (Task 4 AC-6):** "The unit's notifier contract is pinned by node tests; **nothing
  here proves the toast reaches the operator through the real Radix toaster** — that requires a
  jsdom/RTL mount (spec NON-GOAL) or the still-owed §8.3 human click-through. Coverage is NOT
  complete."
- **(b) MUTANT B — found by QA at Task 2, undetectable by the suite.** The dev disclosed MUTANT A
  (pass a no-op `() => {}` notifier instead of `toast`). QA found a **worse** one: the page
  **discarding the unit's return value**. Unit tests stay green, AC-6 grep still prints 1, nothing
  goes red. The suite pins the unit; it does not pin the page's *use* of the unit.
- **(c) ATTACK C1 — found by QA at Task 3.** A hardcoded `facturaNumero: null` at the
  `buildConfirmacionData` call site satisfies the now-required property and defeats the
  compile-time guard entirely.
- **Claim boundary, carried forward: the type system pins PRESENCE, not PROVENANCE.** It proves the
  property was supplied; it cannot prove the value came from the real lookup.
- **HC-1 / ADR-0011 unchanged** — no authentication, browser still runs as PostgREST `anon`, ~29
  pre-existing tables still have zero RLS. **This sprint did not make Elibry more secure.**
  **ADR-0006 not triggered** (no table created). No NCF allocation, no write to
  `comprobantes_fiscales` / `comprobantes_disponibles`.
- **The human gate is the merge gate.** Fiscal-adjacent per `CLAUDE.md`. The packet was never
  written to disk (Task 4's file scope is NONE, correctly) — it exists only in the session
  transcript. Whoever hands it to the human **must paste the rollback block verbatim**; a
  paraphrased rollback sequence is exactly what produced BUG-1. That is why the four commands above
  are recorded here in full.

#### 5. Deferred / backlog carried forward

- **B-18 — the branded-type follow-up**: the only known closure for ATTACK C1 (a nominal/branded
  type so a hardcoded `null` cannot satisfy the guard). Its own scoped task; not actioned.
- **jsdom/RTL component-mount harness** — explicit spec NON-GOAL, still absent, still the only
  in-repo closure for MUTANT A/B.
- **`docs/plans/factura-numero-lookup-contract.md:146` is FALSE and was struck in the packet, not in
  the file.** It claims AC-7's required property "is the only way the whole step vanished fails a
  gate." QA refuted it: after `git revert a774a9f` (the whole FACTURA # step gone from the page)
  `npx tsc --noEmit` returned **0 errors** — the guard did not fire. Anyone re-reading that plan
  must know line 146 was struck. Same for line 234 (G12, one-commit-per-task).
- **`.git/objects` chown/permission issue** hit during the sprint — flagged, **not root-caused**.
  Same family as `~/Developer/CBrain/mistakes/environment-reliability-incidents.md`.
- **§8.3 human click-through from the PRIOR sprint (`reserva-document-entry-points`, 2026-08-03,
  commits `29255f2` + `89cc76e`) is STILL OWED and still un-click-tested by a human.** No browser
  automation is connected. This sprint did not close it and is partly *blocked* by it.
- **Fourth instance of a now-named recurring pattern**: `derivarTelefonoHotel` →
  `PRODUCTOS_SELECT_COLUMNS` → `resolverOcupacionesParaPrefill` → now
  `resolverFacturaNumeroConfirmacion` — *a helper is extracted and unit-pinned, and nothing forces
  the real caller to use it.* MUTANT B is the cleanest proof yet. Filed as a new mistake in the
  shared brain at sprint close.
- **File-size:** `proforma/page.tsx` is ~1006 lines (this sprint *reduced* it by ~4). Still past the
  ≤500 rule; split remains B-1/B-9, never bundled. `lib/factura-numero-confirmacion.ts` (31) and
  `lib/confirmacion-data.ts` (~420) are in range.
- Everything carried forward from the prior entries (the `information_schema`-vs-`lib/supabase.ts`
  reconciliation, `.next/types` vs. page-exported helpers, `.docx` verification, the 5 demo rows in
  `comprobantes_fiscales`, client invoicing as an un-started project, **credential rotation still
  not done**) is **unchanged** by this sprint.

---

### 2026-08-14 — live-balance-recibo-form-fixes (T1–T9, COMMITTED, UNPUSHED)

**Plan:** `docs/plans/live-balance-recibo-form-fixes.md` · **Slug:** `live-balance-recibo-form-fixes`
**Baseline:** `85eb397` → **HEAD:** `63f468c`. **Commits (11, strict order):** `c6b5955` (T1) →
`f976537` (T2) → `daa95ad` (T2 fix, round 2) → `ad2b3b1` (T3) → `1f99680` (T4) → `0700432` (T5) →
`28614e0` (T6) → `9573a56` (T7) → `b411d49` (T8) → `f1ee46f` (T8b) → `63f468c` (T9).
All nine tasks: QA PASS, lead decision A (T2 approved round 3 after two send-backs; T4 approved
round 2 after one evidence-only send-back; T6 escalated to human on a process violation, content
approved; T8 escalated to human on a genuine bug the plan's own AC manufactured, fixed in T8b and
approved). Lead edited no source file. **Branch is UNPUSHED** —
`git@github.com: Permission denied (publickey)`, exit 128; human action required. This local repo
is the sprint's only copy.

#### 1. What shipped — five items, user-facing

1. **`/pagos/registrar` now shows the CURRENT (live) balance**, not a stale snapshot column, across
   all three surfaces (selected-reserva "Balance:", search-result row amount, Monto prefill) and
   both load paths (client search, and the `?reserva_id=` deep link, which prefilled nothing
   before). A `0` balance now displays as `RD$0.00`, not the full price. An unknown/failed balance
   read shows "No disponible" with a blank Monto — never a fabricated number. **Wiring is verified
   in code and by unit tests; the live browser round-trip is UNVERIFIED (see §3).**
2. **Reserva creation now redirects to the PROFORMA document**
   (`/facturacion/proforma?reserva_id=<id>`) instead of its previous destination, for both the
   admin and provisional (non-admin) creation paths, with a safe fallback (stays on
   `/reservas/pendientes` + toast) if no id is returned. **Landing behaviour is UNVERIFIED (see
   §3)** — the underlying deep-link contract is unchanged and was independently reasoned/verified
   to resolve PROVISIONAL and PERMANENTE reservas identically.
3. **"GEB" removed from 3 user-visible labels** — `/facturacion` cards now read "Proforma" /
   "Voucher"; the `/facturacion/voucher` page heading reads "Voucher". All `.docx` source-of-truth
   filenames and in-code references to them are untouched.
4. **Hora Entrada / Hora Salida on reserva creation are now required, defaulted to 3:00 PM /
   12:00 PM.** A blank field blocks submit with a named-field toast. Existing reservas (edit flow)
   are unaffected — the default only applies to a fresh form.
5. **Both RECIBO renderers — the printable HTML and the in-app `PaymentReceipt` dialog — now show a
   company header, the client's dirección, the reserva código, concepto, the real registering user
   (from `pagos.usuario`, since `pagos.registrado_por` has no writer anywhere in the repo), and
   Total Abonado / Saldo Pendiente computed from the same `lib/finance.ts` module as everything
   else** (no more inline arithmetic that could disagree). A same-sprint human-ruled fix (T8b)
   closed a ~12%-of-two-installment-splits divergence between the displayed PARCIAL/PAGADA badge
   and the Saldo Pendiente figure that the original acceptance criterion (AC4.5) had itself
   introduced; QA re-verified 0 divergences across ~5.3M brute-force test splits after the fix.
   Company data is a documented **PLACEHOLDER** (`lib/empresa-info.ts`), not real company data — a
   companion doc (`docs/plans/empresa-info-settings-backlog.md`) records the migration path to a
   real settings-driven source and flags a conflict with different company data already hardcoded
   in the VOUCHER/CONFIRMACIÓN footer.

#### 2. Evidence (gate: `npm run qa` = `tsc --noEmit` && `eslint .` && `vitest run`)

- **T1** — `lib/finance.ts` + `montosDePagosDeReserva`, 8 new tests. QA ran 5 self-invented
  mutations (2 genuinely pinned: HARD CALL #1's no-`estado`-filter and no-`|| 0`-coercion both went
  RED as required). One narrow gap (Number vs. String coercion) filed as B-25 rather than expanded
  in-task. PASS round 1. Commit `c6b5955`.
- **T2** — `/pagos/registrar` live balance, all 3 surfaces + both load paths. Round 1 SEND-BACK:
  stale-balance bug on deselect→reselect→failed-refetch, lint at 31 vs. the 30 ceiling with a
  missed in-repo `eslint-disable` precedent, missing relocated-coverage-gap disclosure. Round 2
  SEND-BACK: the lead-mandated invalidation fix from round 1 introduced a narrower regression (a
  redundant chained-fetch failure could wipe a correctly-populated entry — an AC1.4 divergence).
  Round 3 PASS (generation-guard fix; residual `gen` field ruled dead-code/naming debt, not a
  defect, via a behaviour-identical mutation — see B-26). Commits `f976537`, `daa95ad`. This task
  also triggered the lead's ruling that commits happen per-task going forward, and QA proved the
  plan's stated baseline was stale (real: 28 files / 625 tests) — corrected in the plan file.
- **T3** — GEB removed from 3 labels. QA diffed the repo-wide GEB grep across commit objects,
  proving exactly 3 lines changed and every `.docx` source-of-truth reference survived. PASS round
  1. Commit `ad2b3b1`.
- **T4** — Hora Entrada/Salida required + defaulted. Round 1 SEND-BACK on evidence discipline only
  (paraphrased rollback output instead of pasted output — no code change was needed). Round 2 PASS
  after the dev pasted real output. QA independently executed `formatTimeWithPreference`, mapped
  all five insert call sites, and confirmed `"00:00"` is truthy (no `stockin-zero-price` trap).
  Commit `1f99680`.
- **T5** — redirect to PROFORMA deep link. QA verified live that `/facturacion/proforma`'s list is
  an unfiltered `select("*")` (PROVISIONAL and PERMANENTE resolve identically) and that
  `crearRegistroProvisional` guarantees `id >= 1` (no falsy-valid-id trap). PASS round 1. Commit
  `0700432`.
- **T6** — new `lib/empresa-info.ts` placeholder company module. Code correct on every AC
  (byte-compared values, all cited line numbers verified, runtime import test). Lead
  **ESCALATED TO HUMAN**: the dev ran `git reset --hard` in the real (non-throwaway-clone) repo.
  QA confirmed via reflog that nothing was lost, but the branch was 7 commits ahead of origin,
  never pushed, on a repo with a known `.git/objects` root-ownership defect. **Human ruled: push to
  origin. The push FAILED** (`Permission denied (publickey)`, exit 128) — unresolved, human action
  required. Content approved; the no-`git reset --hard`-in-the-real-repo rule made binding for all
  later tasks. Commit `28614e0`.
- **T7** — `generateReciboHTML` + caller fortified. QA invented 10 hostile payloads beyond the
  dev's five, including a hostile string injected into a `number`-typed field to bypass TypeScript;
  a live mutation proved the escaping tests discriminate. Dev self-flagged its transitive-
  `EMPRESA_PLACEHOLDER` design choice, which QA and lead ruled the better design and made binding
  on T8. PASS round 1. Commit `9573a56`. Tests 633 → 646.
- **T8** — `PaymentReceipt` company header + real attribution. Every AC PASS, but QA constructed
  and reproduced against the real `lib/finance.ts` a genuine new divergence: routing display
  through the rounded helper while AC4.5 mandated the `status:` ternary stay byte-identical
  (unrounded) could show badge PARCIAL beside "Saldo Pendiente: RD$0.00" in ~527,576 of ~4.5M
  two-installment cent splits (~12%). Lead **ESCALATED TO HUMAN** — AC4.5 itself manufactured the
  bug; the dev complied correctly. **Human ruled: fix it now** (and separately declined the
  `pagos.registrado_por` dead-field fix in the same view → B-31). Commit `b411d49`.
- **T8b** — the fix (human-authorized override of AC4.5). QA re-ran its ~4.5M-split brute force
  against the new ternary: 0 divergences. Plus 800,000 N-way split trials (3/5/10/50-way): 0. Plus
  an opposite-direction over-correction probe; confirmed from `scripts/*.sql` that
  `precio_total`/`pagos.monto` are `DECIMAL(10,2)`, so a genuine sub-cent debt cannot exist in real
  data — the two values can now never disagree by construction. PASS. Commit `f1ee46f`.
- **T9** — `docs/plans/empresa-info-settings-backlog.md`. QA verified every line number and quote
  against live source character-by-character; the dev silently corrected a stale line reference
  (plan says `document-generator.tsx:1596-1599`, real location after T7 is `1599-1604`) by reading
  the real file — credited as correct behaviour. QA ran an exhaustive repo-wide
  `EMPRESA_PLACEHOLDER` sweep proving the doc's consumer list complete. PASS round 1. Commit
  `63f468c`.

Final: **646 tests green**, 28 files, 0 lint errors, 30 warnings (flat).

#### 3. Deferred / descoped — the honest UNVERIFIED list (verbatim)

**This sandbox has NO network path to the Supabase project** (`getaddrinfo ENOTFOUND` on the real
host, hit independently by multiple devs AND by QA) **and NO browser automation.** Therefore:
- Every acceptance criterion requiring an observed live number or a browser round-trip is
  **UNVERIFIED**, not passed: T2's AC1.1/AC1.3/AC1.5 and both failure-branch directions; T4's
  AC5.3 DB-level "reserva count unchanged"; T5's AC2.1/AC2.2 browser landing; T7/T8's
  rendered-output-in-a-real-browser claims.
- What IS proven: code paths shown in diffs, pure-function math verified against the real
  `lib/finance.ts`, greps run against real files, mutations actually executed, and 646 tests green.
- **No test in the repo covers `/pagos/registrar`, `/reservas/ver/[id]`, `/reservas/crear`, or
  `PaymentReceipt`.** QA proved this repeatedly with mutations that stayed green — including one
  that silently undid T2's entire fix and one that resurrected the exact pre-fix bug. This is
  `relocated-coverage-gap`, now on its 5th+ demonstrated instance, and B-23 (the jsdom/RTL harness,
  whose dependencies are ALREADY INSTALLED) is the standing closure.
- **Elibry's security posture is UNCHANGED.** Zero DDL this sprint, no new table, no RLS statement,
  no auth change. HC-1 / ADR-0011 stands. **No line of this summary may claim Elibry became more
  secure.**
- **The branch is UNPUSHED** (SSH auth failure, human action required). This local repo is the only
  copy.

Not deferred as tasks (all nine planned tasks shipped), but explicitly out of scope this sprint per
the frozen spec: B-19 (ANULADO exclusion ruling), B-20 (`calcularBalance` vs.
`calcularBalanceReserva` reconciliation), B-21 (point-in-time recibo), B-22 (`max(id)+1` sequence
collision risk, now user-visible in a URL), B-24 (wiring `lib/empresa-info.ts` to a real settings
source).

#### 4. Rollback path (whole sprint)

Per lead ruling: `git revert <sha> --no-edit` in **strict reverse-commit order**, followed by
`npx tsc --noEmit` after each step — QA proved `git revert` exits 0 while leaving a broken tree if
the order is wrong.

```
git revert 63f468c --no-edit && npx tsc --noEmit   # T9
git revert f1ee46f --no-edit && npx tsc --noEmit   # T8b
git revert b411d49 --no-edit && npx tsc --noEmit   # T8
git revert 9573a56 --no-edit && npx tsc --noEmit   # T7
git revert 28614e0 --no-edit && npx tsc --noEmit   # T6
git revert 0700432 --no-edit && npx tsc --noEmit   # T5
git revert 1f99680 --no-edit && npx tsc --noEmit   # T4
git revert ad2b3b1 --no-edit && npx tsc --noEmit   # T3
git revert daa95ad --no-edit && npx tsc --noEmit   # T2 fix
git revert f976537 --no-edit && npx tsc --noEmit   # T2
git revert c6b5955 --no-edit && npx tsc --noEmit   # T1
```

Ends at pre-sprint baseline `85eb397`. No DB migration and no destructive DB operation occurred
this sprint (zero DDL); nothing to unwind outside the repo. **The branch itself is unpushed** —
reverting locally does not affect any remote, since none has this history yet.

#### 5. Backlog produced this sprint (full text, filed at sprint close)

- **B-19** — Product ruling: should `pagos.estado = 'ANULADO'` be excluded from paid totals? Also:
  normalise the `estado` value space (`ACTIVO`/`ANULADO`/`CONFIRMADO`/`PENDIENTE`/`completado` all
  exist in live writers).
- **B-20** — Reconcile `calcularBalance` vs. `calcularBalanceReserva` semantics across
  `/reservas/ver`, `/pagos/*`, `/clientes/balance*`, `/reservas/pendientes`, dashboard — one
  definition of "saldo pendiente."
- **B-21** — Point-in-time recibo: store/derive the balance as of the payment, instead of today's.
- **B-22** — `crearRegistroProvisional`'s `max(id)+1` does not advance the `SERIAL` sequence →
  future collision risk, now user-visible in a URL.
- **B-23** — Build the jsdom/RTL component-mount harness (deps already installed). Closes
  `relocated-coverage-gap` instead of relocating it a fifth (now sixth+) time.
- **B-24** — Wire `lib/empresa-info.ts` to a real settings source (see
  `docs/plans/empresa-info-settings-backlog.md`). Requires live `information_schema` verification
  first. The real company data already exists hardcoded in the VOUCHER/CONFIRMACIÓN footer at
  `lib/document-generator.tsx:1599-1604` — the two are inconsistent, and a human must choose the
  canonical values.
- **B-25** — Untested edge of `montosDePagosDeReserva`'s coercion contract (found by QA's T1
  Mutation C). The suite does not distinguish the shipped `Number(p.reserva_id) === reservaId`
  matcher from a hypothetical `String()`-based one: a future refactor to
  `String(p.reserva_id) === String(reservaId)` would stay GREEN while silently diverging on
  leading-zero string ids (`"07"` vs `7`) and on `null` ids (`null` vs `0`). The current
  implementation is CORRECT (uses `Number()`, matching the AC's literal spec) — this is an untested
  edge, not a bug. Deliberately not folded into T1 to avoid mid-task scope expansion.
- **B-26** — T2's `gen` field. **Corrected framing:** the `pagosDirectLoadRef` REF is live and
  load-bearing; only the **`gen` PROPERTY on it** is dead (written, never read — proven by a
  behaviour-identical mutation that stripped `gen`/`pagosFetchGenRef` entirely). The mechanism is a
  one-shot id token, not a true generation guard, despite the name. Recorded precisely so a future
  reader isn't misled the way T9's QA nearly was.
- **B-27** — T7: numeric/formatted fields in the HTML generators are protected against
  `raw()`-wrap regressions ONLY by the static `raw(`-count guard, never by hostile fixtures
  (`Intl.NumberFormat` output cannot contain HTML metacharacters). Keep the static guard required
  for future generator work.
- **B-28** — T5: comment the unreachable provisional-redirect fallback so a future
  `provisional-system.ts` refactor doesn't delete it as dead code.
- **B-29** — `lib/provisional-system.ts` returns `data?: any`, which TS collapses to `any` — every
  caller's `?.` guard gets ZERO compile-time narrowing. Tighten to a discriminated union.
- **B-30** — **CLOSED by T8b.** The saldo/badge divergence AC4.5 introduced at T8 is resolved: the
  human ruled "fix it now," and QA's zero-divergence brute-force re-verification (§2, T8b) confirms
  closure. Recorded as resolved, not as an open item.
- **B-31** — `pagos.registrado_por` dead field still rendering "N/A" in the pagos table at
  `app/reservas/ver/[id]/page.tsx:684`. Human was offered this fix and **explicitly declined it
  this sprint.**
- **B-32** — T8b: delete the now-fully-dead `saldoRestante`/`totalPagosRealizados` declarations at
  `app/reservas/ver/[id]/page.tsx:192`/`:195`.
- **B-33** — T8b: extract the `status:` ternary into an exported pure helper in `lib/` (per the
  `crm-casos-page.test.ts` no-jsdom precedent) + a node-env regression test on the PARCIAL/PAGADA
  boundary. Distinct from B-23.
- **B-1 / B-9 (carried, worse):** file splits — `lib/document-generator.tsx` ~1880 lines,
  `app/reservas/ver/[id]/page.tsx` 991 lines. Each split remains its own scoped task, never bundled.
- **Stale plan line reference (recorded, not actioned in the plan file):** the plan's §9/§10
  references to `lib/document-generator.tsx:1596-1599` are STALE — the real location after T7 is
  `1599-1604`. The brain has a prior Elibry incident (`factura-numero-lookup-contract`, this file
  above) where a false plan line was struck only in a session packet and not in the file, misleading
  later readers; the same discipline applies here — recorded in the state file so it is not lost.
- **T9 doc nits (recorded, not actioned):** an ADR-0012 gloss and a `parametros_sistema`
  verification-asymmetry note in `docs/plans/empresa-info-settings-backlog.md`.
- **Schema findings (this sprint's most reusable output):**
  - **`pagos.registrado_por` has NO writer anywhere in the repo.** The column the app actually
    populates is `pagos.usuario`.
  - **`pagos.estado` receives FOUR different live values**: `ACTIVO`/`ANULADO` from
    `/pagos/registrar`, `CONFIRMADO` and `PENDIENTE` from `/reservas/crear`, plus a DDL default
    `'completado'` (`scripts/024`). `scripts/030`'s `status = 'COMPLETADO'` filter matches **no
    live column at all**.

**Not fixed, explicitly out of scope, must be surfaced again before any future sprint touches auth
or RLS broadly:** HC-1 (no authentication, no RLS on ~29 pre-existing tables — ADR 0011) —
unchanged by this sprint. Everything carried forward from prior entries (the
`information_schema`-vs-`lib/supabase.ts` reconciliation, `.next/types` vs. page-exported helpers,
`.docx` verification, the 5 demo rows in `comprobantes_fiscales`, client invoicing as an un-started
project, credential rotation still not done, and — new this sprint — **the branch push failure,
human action required**) is unchanged or worsened by this sprint.

---

## Remaining backlog (highest priority first)

_(see docs/plans/: feature-audit-sprint, module-audit-polish, crm-reservas-fixes,
test-suite-sprint1. Fiscal / NCF / e-CF work is high-stakes → senior + human-gated.
Also see the geb-documents-real-data sprint entry above for B-1, B-9, B-13, B-14, B-17,
the unresolved HC-1 / R1 authentication-and-RLS exposure, and the
recibo-escape-and-input-guards entry above for the current uncommitted-diff status,
the two hard-blocked fiscal documents pending scripts/061+062, and the
assertion-ordering fragility backlog item at tests/documentos-actions.test.ts:473-481.
See the 2026-07-28 VOUCHER TELEFONO hotfix entry above for the schema-drift finding
(scripts/ is not the schema) and the lib/supabase.ts interface-vs-schema audit candidate.
See the 2026-07-28 Live DB verification session entry above for R3's final resolution
(no client-invoice linkage exists anywhere in the database; client invoicing is a real,
un-started project), ADR 0012 (FACTURA # optional on CONFIRMACIÓN), schema-drift
instances 3 & 4 (`productos.telefonos_json`/`emails_json` in zero migrations; the
definitive `comprobantes_fiscales` shape), the concurrent-agents-on-one-tree
recurrence, and the LOOKUP_FAILED toast task explicitly elevated ahead of generic
backlog. See the 2026-08-14 live-balance-recibo-form-fixes entry above for B-19..B-33
(the full sprint backlog set, including B-30 CLOSED and B-31 human-declined), the
unpushed-branch state requiring human SSH-key action, and the two newest schema
findings (`pagos.registrado_por` has no writer; `pagos.estado`'s four live values vs.
`scripts/030`'s dead filter).)_
