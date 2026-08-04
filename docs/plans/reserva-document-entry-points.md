# Plan — Reserva → document entry points + PROFORMA's own passenger list

**Spec:** frozen, human-approved 2026-07-30.
**Architect pass:** `elibry-architecture-thinking` (binds `~/Developer/CBrain/thinking/architecture-thinking.md`).
**Stack as verified, not as documented:** Next.js **14.2.25** (`package.json:57`) — the repo `CLAUDE.md` still says 15 and is stale. `npm run qa` = `tsc --noEmit && eslint . && vitest run` (`package.json:10-12`); **it does not run `next build`.**

---

## 0. Grounding — what the real code says (every path below was opened, not inferred)

| Claim | Real evidence |
|---|---|
| PROFORMA page + edit dialog | `app/facturacion/proforma/page.tsx` (915 L). `openEditDialog` at **:276-298**; `EditableProformaData` at **:131-134**; passenger prefill read at **:287**; `generarConfirmacion` at **:351-526**; save at **:354**; second read at **:369**. |
| The dead Observación | Textarea at **`proforma/page.tsx:844-853`**, bound to `editableData.observacion`. `generarConfirmacion` builds `observaciones: reserva.nota_interna_reserva ?? null` at **:462** — `editableData.observacion` is read **nowhere** in the generation path. Confirmed by reading the whole function. |
| VOUCHER page | `app/facturacion/voucher/page.tsx` (1526 L). `handleReservaSelect` **:555-653**; passenger read **:578**; passenger save **:816**; `construirVoucherData` re-read **:849**; LOCALIZADOR gate **:1005-1007**; occupancy prefill **:631-652**. |
| Shared server actions | `app/actions/documentos-actions.ts` (1213 L). `getPasajerosReservaAction` **:145-159**; `reemplazarConjuntoConRestauracion` **:200-247**; `guardarPasajerosReservaAction` **:263-322**; `getOcupacionesReservaAction` **:327-341**; `guardarOcupacionesReservaAction` **:666-763**. Service-role client at **:26-31** — the only sanctioned access path to these two tables. |
| Reserva detail page | `app/reservas/ver/[id]/page.tsx` (935 L). Header action bar **:352-362** (`TimeFormatToggle` + "Editar Reserva" `router.push`). Read-only `reserva.proforma` at **:789-790**. No document-generation entry point exists. `useRouter` already imported at **:4**. |
| Table shape | `scripts/061-create-reserva-pasajeros-ocupaciones.sql` — `reserva_pasajeros` at **:73-87**. **RLS at :93-112**: `reserva_pasajeros_staff_all` `FOR ALL TO authenticated USING (true) WITH CHECK (true)`, no `anon` grant. |
| Deep-link precedent | `app/reservas/pendientes/page.tsx:1001` pushes `` `/pagos/registrar?reserva_id=${reserva.id}` ``; `app/pagos/registrar/page.tsx:48-49,77-81` consumes it via `useSearchParams().get("reserva_id")` + a `useEffect`. Five other pages use `useSearchParams` (`pagos/editar`, `pagos/ver`, `clientes/editar`, `clientes/ver`, `clientes/balance-reserva`, `reservas/pendientes`). **None is wrapped in `<Suspense>`** — a known backlog build risk (`docs/plans/feature-audit-sprint.md:108-113`). |
| Test precedent | Page-level logic is tested by **exporting a pure function from the page module and importing it in a `@vitest-environment node` suite** — `tests/voucher-page.test.ts:31-41` imports `derivarTelefonoHotel`, `mapearDetallesAOcupaciones`, `debePrefillarOcupaciones`, `resolverOcupacionesParaPrefill` directly from `app/facturacion/voucher/page`. There is **zero** in-repo use of `@testing-library/react` or `@vitest-environment jsdom` (grepped `tests/`), even though both are installed. |
| Existing suites (verified present) | `tests/documentos-actions.test.ts` (2200+ L), `tests/voucher-page.test.ts`, `tests/voucher-data.test.ts`, `tests/voucher-html.test.ts`, `tests/proforma-snapshot.test.ts`, `tests/confirmacion-html.test.ts`, `tests/confirmacion-data.test.ts`. |
| Empty passenger list is legal | `lib/confirmacion-data.ts:271-275` — `null`/`undefined` blocks, but an explicit `[]` is a permitted, genuinely-empty state. So a reserva with zero passenger rows still generates. |

---

## 1. THREE HARD FINDINGS THE SPEC DID NOT KNOW — read before anything else

These are genuinely hard architectural facts, not implementation details. Two of them make the spec's stated migration ("additive: add a column, one UPDATE") incomplete. **Surface all three to the human before Task 1 runs.**

### FINDING A — the name `documento` is already taken, by a live column with different meaning

Ruling 1 says "`reserva_pasajeros` gains a `documento` discriminator". It cannot: **`reserva_pasajeros.documento` already exists** — `scripts/061:80`, `documento text NULL, -- cédula/pasaporte`. It is the passenger's ID document, it is in the shared input type (`documentos-actions.ts:41`, `PasajeroInput.documento?: string | null`), it is written at `documentos-actions.ts:314`, and it is read into the generated CONFIRMACIÓN at `proforma/page.tsx:383` (`documento: p.documento ?? null`).

Reusing that name would overwrite passengers' cédulas with the string `"VOUCHER"`. **Decision taken: name the discriminator `documento_destino`** ("the document this passenger row belongs to"), values `'VOUCHER' | 'PROFORMA'`.

This is a naming deviation forced by a live collision. It does **not** re-open ruling 1 (separate lists stand, one shared action module stands, one shared service-role access path stands). It needs one word of human confirmation on the name, nothing more.

### FINDING B — the migration is NOT purely additive: a UNIQUE constraint must be swapped

`scripts/061:83` declares `UNIQUE (reserva_id, orden)` on `reserva_pasajeros`. Both editors number their rows `1..N` (`proforma/page.tsx:534-539`, `voucher/page.tsx:809-814`). With two lists per reserva, the second document's first `INSERT` violates that constraint (SQLSTATE 23505) and the whole feature is structurally impossible.

The constraint must become `UNIQUE (reserva_id, documento_destino, orden)`. That is a `DROP CONSTRAINT` + `ADD CONSTRAINT` on a live, production-populated table. **No row is deleted and no data is destroyed** — the spec's real guarantee holds — but "additive: one column, one UPDATE" understates what the human is being asked to run. The exact SQL is in §4, verbatim, for review before it runs.

### FINDING C — the shared write helper deletes by `reserva_id` alone

`reemplazarConjuntoConRestauracion` (`documentos-actions.ts:200-247`) captures and deletes with `.eq("reserva_id", reservaId)` and nothing else (**:207-213**). If PROFORMA saves through it unchanged, **it deletes VOUCHER's passenger rows.** The column and the constraint alone do not give separate lists; the delete/capture scope must be narrowed for `reserva_pasajeros` too. This is the single highest-risk edit in the sprint and is why Task 3 is senior with a dedicated non-regression assertion on the occupancy path (which must keep filtering by `reserva_id` **only**).

---

## Architecture Reasoning (show your work)

**Invariants in play + the existing mechanism each follows**

1. **RLS / org isolation (ADR-0006).** `reserva_pasajeros_staff_all` and `reserva_ocupaciones_staff_all` (`scripts/061:106-112`) — `FOR ALL TO authenticated`, `anon` denied, service-role bypass via `documentos-actions.ts:26-31`. This sprint adds a **column**, not a table, so no new policy is owed; the invariant is "these two policies are byte-identical after migration 064 and `anon` is still denied." Migration 064 contains **no** `CREATE/DROP/ALTER POLICY` and no `GRANT`. Verified by a post-flight `pg_policy` query (§4).
2. **Money/contract separation.** `VoucherDocData` (`lib/voucher-data.ts`) is money-free by compile-time excess-property guarantee; `ConfirmacionData` carries money. Nothing in this sprint touches either builder or either type. `lib/voucher-data.ts`, `lib/confirmacion-data.ts` and `lib/document-generator.tsx` are on the must-not-touch list.
3. **Server/client boundary.** The service-role key never leaves `app/actions/documentos-actions.ts`. Both pages keep calling server actions; neither gains a direct `reserva_pasajeros` query from the browser's `anon` client.
4. **Block-never-default (`stockin-zero-price`).** Two live applications here: (a) the seed count must use `Number.isFinite`/integer tests, never truthiness, and must never fabricate a passenger **name**; (b) an unknown `documento_destino` value arriving at a Server Action (a public HTTP endpoint) is **rejected**, never coerced to `'VOUCHER'`.
5. **Premature-success-signal.** The existing pattern is already correct: `guardarPasajerosReservaAction` is awaited and its `success` checked *before* any success toast (`proforma/page.tsx:353-367`, `voucher/page.tsx:816-834`). This sprint adds no optimistic UI — every mutation stays server-confirmed-then-render, so there is no new rollback surface. The dialog's local `editableData` is a draft, not an optimistic write; the rollback for a failed save is "the dialog stays open, nothing was persisted, the destructive toast names why" — the mechanism already at `proforma/page.tsx:359-366`. Do not introduce optimistic passenger rendering.
6. **Realtime.** Grepped: there is **no** `supabase.channel` / `.on('postgres_changes')` subscriber anywhere in this repo. There are no realtime subscribers to keep payload-compatible. Concurrency is handled by the existing delete-then-insert-with-restore contract only.
7. **`schema-source-of-truth`.** Directly binding: this sprint alters a live, production-populated table. Nothing in the plan may treat `scripts/061` as proof of the *current* live shape — Task 1 begins with a mandatory `information_schema`/`pg_constraint` read-back, and its acceptance is gated on that output, not on the migration file.

**Approaches considered + trade-offs + choice**

*Discriminator placement (given ruling 1 is settled: separate lists, same module).*
- **A1 — column on `reserva_pasajeros` + scoped reads/writes.** Chosen. Smallest change surface: one column, one constraint swap, one filter argument threaded through two functions and one helper. Trade-off: touches the shared write path used by the live VOUCHER flow — mitigated by making the parameter *required* (see below) and by an explicit occupancy-path non-regression test.
- **A2 — a second table `reserva_pasajeros_proforma`.** Rejected: duplicates the composite FK, the `ON DELETE SET NULL (ocupacion_id)` semantics, the `orden` uniqueness rule and the entire restore helper; two tables would drift. Also requires a *new* table → a new RLS policy → more surface for zero benefit.
- **A3 — keep one list (rejected by ruling 1)** and **A4 — "always seed fresh, no discriminator" (rejected by ruling 1)**: off the table, not re-argued.
- **A5 — duplicate every existing row into both documents at backfill.** Rejected by ruling 2. Not re-argued.

*Server-action signature (the question the orchestrator asked explicitly).*
- **B1 — `documentoDestino` as a REQUIRED parameter, no default.** **Chosen.** There are exactly **six** app call sites (grepped: `voucher/page.tsx:578, 816, 849`; `proforma/page.tsx:287, 354, 369`). A required parameter makes `tsc --noEmit` fail on every un-updated one — the regression this sprint most fears (a PROFORMA path silently reading/writing VOUCHER's rows) becomes a **compile error**, not a runtime surprise. This is a real forcing function and it is mutation-checkable: delete the argument at `voucher/page.tsx:578` and `npm run typecheck` must go red.
- **B2 — optional with `= "VOUCHER"` default.** **Rejected.** A forgotten call site would silently operate on the VOUCHER list — reproducing the exact bug class this sprint exists to remove, with no static signal. This is the `stockin-zero-price` "never substitute a default for a missing required input" rule applied to a function parameter.
- **B3 — separate wrappers (`getPasajerosVoucherAction` / `getPasajerosProformaAction`).** Rejected: four more exported Server Action endpoints, the scoping logic still has to change inside the shared helper anyway, and nothing forces an existing call site to move to a wrapper — so it buys no compile-time guarantee.

*Deep-link mechanism (the second question asked explicitly).*
- **C1 — `useSearchParams()` + `?reserva_id=<reservas.id>` + a `<Suspense>` wrapper.** **Chosen.** Exact in-repo precedent, param name and value included: `reservas/pendientes/page.tsx:1001` → `pagos/registrar/page.tsx:48-49,77-81`. **Value = the numeric `reservas.id`, not `codigo`**, because both target pages key their selection off `id` (`proforma/page.tsx:798 openEditDialog(reserva)` → every downstream action takes `reserva.id`; `voucher/page.tsx:1088 selectedReserva?.id === reserva.id`), while `codigo` is a display string with no uniqueness constraint anywhere in `scripts/` and would need a lookup plus a collision policy nobody has specified.
  **Next 14 caveat, load-bearing:** in 14.2.25 a client component calling `useSearchParams()` must be under a `<Suspense>` boundary or `next build` fails with *"useSearchParams() should be wrapped in a suspense boundary"*. **`npm run qa` cannot catch this** (it never runs `next build` — `package.json:12`). Both pages therefore get the standard wrapper (default export becomes `<Suspense fallback={…}><InnerPage/></Suspense>`), and `npx next build` is a required, pasted-output gate on Tasks 5 and 6. We fix the two routes we touch and **do not** fix the other ten (backlog, `feature-audit-sprint.md:275`).
- **C2 — new route segments `/facturacion/proforma/[reservaId]`.** Rejected: creates two new routes duplicating two 900–1500-line list-first pages, for zero behavioural gain.
- **C3 — read `window.location.search` in a `useEffect`** (dodges the Suspense rule entirely). Rejected: deviates from the convention six existing pages already follow, for a one-time build-config convenience.
- The pure "which reserva does this param mean" decision is extracted to **`lib/deep-link-reserva.ts`** so it is node-testable — the same extract-for-testability move `derivarTelefonoHotel`/`resolverOcupacionesParaPrefill` already established. One ~35-line pure function used by exactly two pages is **not** the "generic deep-link framework" the non-goals forbid; it also avoids adding untestable branching into two files that already breach the 500-line rule.

**Seam map (the total file budget — no task may name a file outside this list)**

*New:*
- `scripts/064-add-documento-destino-to-reserva-pasajeros.sql`
- `lib/deep-link-reserva.ts`
- `tests/deep-link-reserva.test.ts`
- `tests/proforma-page.test.ts`

*Edited:*
- `app/actions/documentos-actions.ts` (discriminator threaded through 2 actions + the shared helper)
- `app/facturacion/proforma/page.tsx` (dead textarea out; own passenger list; seeding; failure toast; deep link; Suspense)
- `app/facturacion/voucher/page.tsx` (**three literal arguments** + deep link + Suspense — nothing else)
- `app/reservas/ver/[id]/page.tsx` (two buttons in the existing action bar)
- `tests/documentos-actions.test.ts` (existing call sites gain the new argument; new isolation/scoping guards)

*Complement — MUST NOT be touched by any task in this sprint:*
`lib/document-generator.tsx` · `lib/confirmacion-data.ts` · `lib/voucher-data.ts` · `lib/supabase.ts` · `lib/finance.ts` · `lib/html-escape.ts` · `app/facturacion/fiscal/page.tsx` · any `comprobantes_*` table or `getFacturaNumeroPorReservaAction` · `scripts/061`/`062`/`063` (already applied — never edit an applied migration) · `reserva_ocupaciones` (schema and behaviour) · `guardarOcupacionesReservaAction`'s relink logic · `relinkPasajerosPorIdentidadMaterial` / `relinkPasajerosRestaurados` / `claveIdentidadMaterial` · `tests/voucher-data.test.ts` · `tests/voucher-html.test.ts` · `tests/voucher-page.test.ts` · `tests/confirmacion-html.test.ts` · `tests/confirmacion-data.test.ts` · `tests/proforma-snapshot.test.ts` · every other page that calls `useSearchParams` without a Suspense boundary · `CLAUDE.md` · `.claude/**` · `next.config.mjs` · `package.json`.

**Negative space checked** — grepped `~/Developer/CBrain/decisions` + `~/Developer/CBrain/mistakes` for `pasajero|proforma|voucher|deep.?link|searchParams|discriminator`, and read `0006`, `0011`, `0012`, `schema-source-of-truth`, `stockin-zero-price`, `fake-green-tests`, `premature-success-signal`, `assertion-without-verification`, `environment-reliability-incidents`.
- **ADR-0012** — untouched by design. `getFacturaNumeroPorReservaAction` and its two-outcome contract (`SIN_COMPROBANTE` silent / `LOOKUP_FAILED` non-blocking destructive toast) are on the must-not-touch list. No task may add a toast, a block, or a placeholder to that path; `facturaNumero` stays `string | null`. Client invoicing / FACTURA # work is out of scope. Nothing here re-proposes `reserva_id` on `comprobantes_fiscales`.
- **ADR-0011 / HC-1** — no auth or RLS model change. The `TO authenticated` + `anon`-denied posture on `reserva_pasajeros` is preserved verbatim, and access stays exclusively through the service-role action module.
- **ADR-0006** — no new table, so no new policy is owed; the existing policy is asserted unchanged post-migration rather than assumed.
- **`schema-source-of-truth`** — no claim in this plan about the *live* shape of `reserva_pasajeros` is treated as proven. `scripts/061` is cited as the *designed* shape and Finding B is derived from it, but Task 1 is gated on a live `information_schema` + `pg_constraint` read-back **before** the DDL, precisely because the auto-generated constraint name could differ and a silent no-op `DROP … IF EXISTS` would produce a 23505 on PROFORMA's first save.
- **`fake-green-tests`** — no source-text/regex-on-file assertions; no mount-time-only assertions; no CSS-class or icon selectors (buttons get `data-testid`); every guard test in §8 carries a named mutation that must turn it red.
- Nothing here re-proposes an ADR-rejected option: rulings 1–3 and ADR-0012's rejected alternatives are all treated as settled, and the two *new* deviations (Findings A and B) are surfaced as forced-by-evidence, not as re-litigation.

**Pre-mortem — most drift-prone task + mitigation**

**Task 3** (the server-action layer) is the one that will try to grow. Three specific temptations, each pre-empted:
1. *"While I'm in `reemplazarConjuntoConRestauracion`, let me clean it up / return `filasOriginales` / fix B-10."* → Acceptance criterion forbids any behavioural change on the occupancy path, with a test asserting the occupancy `DELETE` builder received **exactly one** `.eq`, `("reserva_id", id)`. `guardarOcupacionesReservaAction`'s body is explicitly out of scope.
2. *"The proforma page needs more than an argument here."* → Task 3's scope in `proforma/page.tsx` and `voucher/page.tsx` is **literally the six call sites gaining one argument**; the QA diff must show nothing else in those two files. All PROFORMA behaviour change is Task 4.
3. *"These files are over 500 lines, let me split them."* → Splits are B-1/B-9 backlog, their own scoped task, **never** bundled. See §9.

Second-most drift-prone: **Task 6** (VOUCHER Suspense wrapper), where "wrap the component" can slide into re-indenting or reordering 1500 lines. Mitigation: the acceptance criterion requires the diff to be a **wrapper added around an unchanged renamed component plus one `useEffect`** — a diff touching the interior of `handleReservaSelect`, `construirVoucherData`, or the LOCALIZADOR gate is an automatic FAIL.

**Genuinely hard calls flagged for the human** — Findings A, B and C in §1, plus:
- **The "Rápida byte-identical" acceptance criterion needs one qualification.** After this sprint the Rápida path reads `documento_destino = 'PROFORMA'` rows. For a reserva whose passenger names exist *only* because a VOUCHER was generated, Rápida's output **will and must change** (those names disappear) — that is the fix, not a regression. So "byte-identical" is provable only against a **fixed test reserva with zero `reserva_pasajeros` rows** (an empty passenger array is a legal, permitted state — `lib/confirmacion-data.ts:271-275`). Task 8 pins that reserva explicitly.
- **`npm run qa` cannot prove the Suspense fix.** `npx next build` must be run and its output pasted. This is a gate the repo's standard QA command does not cover.

---

## 2. Technical approach (one paragraph)

Add a `documento_destino text NOT NULL DEFAULT 'VOUCHER' CHECK (IN ('VOUCHER','PROFORMA'))` column to `reserva_pasajeros`, backfill every existing row to `'VOUCHER'`, and swap the `UNIQUE (reserva_id, orden)` constraint for `UNIQUE (reserva_id, documento_destino, orden)` so two independent lists can coexist per reserva; thread that value as a **required** parameter through `getPasajerosReservaAction` and `guardarPasajerosReservaAction`, and give the shared `reemplazarConjuntoConRestauracion` helper an **optional** extra equality filter that only the passenger path passes — leaving the occupancy path's SQL byte-identical. PROFORMA then reads/writes only its own rows and, when it has none, seeds exactly `reservas.pasajeros` blank rows (min 1, via a `Number.isFinite` integer test, never a fabricated name) through a pure exported `resolverPasajerosParaEditor`, surfacing a destructive toast on fetch failure while still opening with the single default blank row; its dead "Observación" textarea and the `observacion` field are deleted. Finally, `/reservas/ver/[id]` gains two `router.push` buttons to `` `/facturacion/proforma?reserva_id=${id}` `` and `` `/facturacion/voucher?reserva_id=${id}` ``, which both pages consume via `useSearchParams` + a pure `resolverReservaDeepLink` in `lib/deep-link-reserva.ts` and a run-once effect that calls the pages' **existing** selection entry points (`openEditDialog` / `handleReservaSelect`) — so all generation validation stays exactly where it is, duplicated nowhere, and each page gains the `<Suspense>` boundary Next 14.2 requires.

---

## 3. File map

| File | Action | What changes |
|---|---|---|
| `scripts/064-add-documento-destino-to-reserva-pasajeros.sql` | **new** | Column + backfill + CHECK + the uniqueness swap. Human-gated. No RLS statements. |
| `app/actions/documentos-actions.ts` | edit | `DocumentoDestino` type + `DOCUMENTOS_DESTINO_VALIDOS`; required 2nd/4th param on the two passenger actions; runtime validation; `documento_destino` in the inserted rows; **optional** `filtroAdicional` on `reemplazarConjuntoConRestauracion`, applied to the capture-SELECT and the DELETE, passed only by the passenger path. |
| `app/facturacion/proforma/page.tsx` | edit | (T2) delete the Observación textarea, the `observacion` field and the now-unused `Textarea` import. (T3) 3 call sites gain `"PROFORMA"`. (T4) exported `filasBlancasParaPasajeros` + `resolverPasajerosParaEditor`; `openEditDialog` uses them + destructive toast on failure. (T5) `useSearchParams` + run-once auto-open effect + `<Suspense>` wrapper. |
| `app/facturacion/voucher/page.tsx` | edit | (T3) 3 call sites gain `"VOUCHER"` — **nothing else**. (T6) `useSearchParams` + run-once auto-select effect + `<Suspense>` wrapper. |
| `app/reservas/ver/[id]/page.tsx` | edit | (T7) two buttons in the existing header action bar at `:352-362`, with `data-testid`s. No validation logic. |
| `lib/deep-link-reserva.ts` | **new** | Pure `resolverReservaDeepLink(param, reservas)` → discriminated result. ~35 lines. |
| `tests/deep-link-reserva.test.ts` | **new** | Node suite for the above. |
| `tests/proforma-page.test.ts` | **new** | Node suite for `filasBlancasParaPasajeros` / `resolverPasajerosParaEditor`, importing straight from the page module (the `tests/voucher-page.test.ts` pattern). |
| `tests/documentos-actions.test.ts` | edit | ~30 existing passenger call sites gain the new argument; new scoping/isolation/validation guards; occupancy non-regression guard. |

---

## 4. DB changes — migration 064 (HUMAN-GATED; exact SQL, verbatim)

**File:** `scripts/064-add-documento-destino-to-reserva-pasajeros.sql`
**Numbering:** the repo's highest is `063-allow-discrepancia-in-auditoria.sql`; convention is `NNN-kebab-description.sql`. → **064**.
**Enum vs CHECK:** a `CHECK … IN (…)` constraint, matching this exact table's own precedent (`scripts/061:79`, `tipo_pax text NOT NULL CHECK (tipo_pax IN ('ADULTO','NINO','INFANTE'))`). No new Postgres `ENUM` type is created — that would be a new convention for no benefit.
**RLS:** none. This is a column on an existing table; ADR-0006's "every new table ships a policy" was already satisfied for this table by `scripts/061:106-108`. The migration contains no `CREATE/DROP/ALTER POLICY`, no `GRANT`, no `ALTER TABLE … ENABLE/DISABLE ROW LEVEL SECURITY`. The post-flight query below proves the policy and the `anon` denial survived.

### 4.1 PRE-FLIGHT — read-only, MANDATORY, output must be pasted before the DDL runs
`mistakes/schema-source-of-truth`: `scripts/061` describes the *designed* table, not necessarily the live one. Nothing below may be assumed.

```sql
-- (1) current columns — confirms `documento` exists (cédula) and `documento_destino` does not
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reserva_pasajeros'
ORDER BY ordinal_position;

-- (2) THE CRITICAL ONE — the real name of the (reserva_id, orden) unique constraint
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public' AND rel.relname = 'reserva_pasajeros'
ORDER BY con.conname;

-- (3) RLS baseline, to be re-run identically after the migration
SELECT pol.polname,
       pol.polroles::regrole[] AS roles,
       pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
FROM pg_policy pol
WHERE pol.polrelid = 'public.reserva_pasajeros'::regclass;

-- (4) row census, so the backfill count is verifiable
SELECT count(*) AS total_rows FROM reserva_pasajeros;
```

**If query (2) returns a name other than `reserva_pasajeros_reserva_id_orden_key`, STOP and edit line 5 of the migration to that exact name before running it.** A silently-no-op `DROP … IF EXISTS` leaves the old constraint in place and PROFORMA's first save fails with a 23505 that looks nothing like its cause.

### 4.2 THE MIGRATION

```sql
-- 064 — PROFORMA gets its own passenger list, independent of VOUCHER's.
-- (reserva-document-entry-points sprint, Task 1 — docs/plans/reserva-document-entry-points.md §4)
--
-- HUMAN RULING 1 (settled): PROFORMA and VOUCHER keep SEPARATE passenger lists in
-- reserva_pasajeros, discriminated by a new column, still reached through the SAME
-- service-role server-action module. HUMAN RULING 2 (settled): every EXISTING row is
-- tagged 'VOUCHER' — VOUCHER sees exactly the rows it sees today, bit for bit, and
-- PROFORMA therefore starts empty on every current reserva.
--
-- WHY THE COLUMN IS NOT CALLED `documento`: reserva_pasajeros.documento ALREADY EXISTS
-- (scripts/061:80) and holds the PASSENGER'S cédula/pasaporte — it is written by
-- app/actions/documentos-actions.ts:314 and read into the CONFIRMACIÓN at
-- app/facturacion/proforma/page.tsx:383. Reusing that name would overwrite real ID
-- numbers with the literal string 'VOUCHER'. `documento_destino` = "the document this
-- passenger row belongs to". The two are unrelated and must never be conflated.
--
-- NOT PURELY ADDITIVE — READ THIS: scripts/061:83 declares UNIQUE (reserva_id, orden).
-- Both editors number their rows 1..N, so with two lists per reserva the SECOND
-- document's first INSERT violates it (SQLSTATE 23505) and the feature is structurally
-- impossible. The constraint is therefore DROPPED and RE-CREATED including the
-- discriminator. NO ROW IS DELETED and NO DATA IS DESTROYED by this migration — but it
-- does more than add a column, and that is why it is human-gated.
--
-- DEFAULT 'VOUCHER' is a DEPLOY-WINDOW SAFETY DEVICE, not an application default: it
-- keeps the live VOUCHER write path working unchanged between this migration and Task 3
-- landing. It is NOT a licence for app code to omit the value — Task 3 makes
-- documentoDestino a REQUIRED parameter with no TypeScript default, so after Task 3 no
-- INSERT from this app can ever rely on it (mistakes/stockin-zero-price: the DB default
-- covers pre-existing rows, whose value is genuinely known to be 'VOUCHER'; it never
-- stands in for an unknown one).
--
-- RLS: untouched. This is a COLUMN on an existing table, so ADR-0006's "every new table
-- ships a named policy" was already satisfied by scripts/061:106-108
-- (reserva_pasajeros_staff_all, FOR ALL TO authenticated, anon denied). There is no
-- CREATE/DROP/ALTER POLICY, no GRANT, and no ENABLE/DISABLE ROW LEVEL SECURITY below.
--
-- BEGIN/COMMIT wrap: deliberate, same reasoning as scripts/061 — this file's steps are
-- interdependent (a half-apply that adds the column but leaves the OLD unique constraint
-- in place is worse than no apply at all, because it looks done and fails only on
-- PROFORMA's first save).
--
-- ROLLBACK (verbatim, in this order):
--   BEGIN;
--   ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_reserva_id_documento_destino_orden_key;
--   ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_documento_destino_check;
--   DELETE FROM reserva_pasajeros WHERE documento_destino = 'PROFORMA';  -- required: the old
--     -- UNIQUE (reserva_id, orden) cannot be restored while two lists share an `orden`.
--     -- THIS DELETES PROFORMA PASSENGER DATA. Export it first if it matters.
--   ALTER TABLE reserva_pasajeros DROP COLUMN IF EXISTS documento_destino;
--   ALTER TABLE reserva_pasajeros ADD CONSTRAINT reserva_pasajeros_reserva_id_orden_key UNIQUE (reserva_id, orden);
--   COMMIT;

BEGIN;

-- 1. Additive column, nullable for one statement so the backfill below is real and reviewable.
ALTER TABLE reserva_pasajeros ADD COLUMN IF NOT EXISTS documento_destino text;

-- 2. HUMAN RULING 2 — THE BACKFILL. Every row that exists today belongs to VOUCHER.
UPDATE reserva_pasajeros SET documento_destino = 'VOUCHER' WHERE documento_destino IS NULL;

-- 3. Lock it down.
ALTER TABLE reserva_pasajeros ALTER COLUMN documento_destino SET DEFAULT 'VOUCHER';
ALTER TABLE reserva_pasajeros ALTER COLUMN documento_destino SET NOT NULL;

-- 4. CHECK constraint (same style as scripts/061:79's tipo_pax). DROP-then-ADD because
--    Postgres has no ADD CONSTRAINT IF NOT EXISTS; this keeps the file re-runnable.
ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_documento_destino_check;
ALTER TABLE reserva_pasajeros ADD CONSTRAINT reserva_pasajeros_documento_destino_check
  CHECK (documento_destino IN ('VOUCHER','PROFORMA'));

-- 5. THE UNIQUENESS SWAP. If the name on the next line does not match pre-flight query (2),
--    FIX IT BEFORE RUNNING — a no-op DROP here ships a latent 23505.
ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_reserva_id_orden_key;
ALTER TABLE reserva_pasajeros DROP CONSTRAINT IF EXISTS reserva_pasajeros_reserva_id_documento_destino_orden_key;
ALTER TABLE reserva_pasajeros ADD CONSTRAINT reserva_pasajeros_reserva_id_documento_destino_orden_key
  UNIQUE (reserva_id, documento_destino, orden);

COMMIT;
```

### 4.3 POST-FLIGHT — output must be pasted as Task 1's evidence

```sql
-- (a) column present, NOT NULL, defaulted
SELECT column_name, is_nullable, column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='reserva_pasajeros' AND column_name='documento_destino';
-- EXPECT exactly one row: documento_destino | NO | 'VOUCHER'::text

-- (b) THE OLD CONSTRAINT IS GONE and the new one exists
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid
JOIN pg_namespace ns ON ns.oid=rel.relnamespace
WHERE ns.nspname='public' AND rel.relname='reserva_pasajeros' AND con.contype IN ('u','c')
ORDER BY con.conname;
-- EXPECT: reserva_pasajeros_reserva_id_documento_destino_orden_key UNIQUE (reserva_id, documento_destino, orden)
-- EXPECT: reserva_pasajeros_documento_destino_check CHECK (...)
-- EXPECT: NO constraint whose definition is UNIQUE (reserva_id, orden)

-- (c) backfill complete, no row left behind, nothing tagged PROFORMA yet
SELECT documento_destino, count(*) FROM reserva_pasajeros GROUP BY 1;
-- EXPECT: exactly one group, 'VOUCHER', with the same total as pre-flight query (4)

-- (d) RLS UNCHANGED — must be byte-identical to pre-flight query (3)
SELECT pol.polname, pol.polroles::regrole[],
       pg_get_expr(pol.polqual, pol.polrelid), pg_get_expr(pol.polwithcheck, pol.polrelid)
FROM pg_policy pol WHERE pol.polrelid='public.reserva_pasajeros'::regclass;

-- (e) anon still denied (no policy grants it, RLS still on)
SELECT relrowsecurity FROM pg_class WHERE oid='public.reserva_pasajeros'::regclass;  -- EXPECT true
```

**Does the DEFAULT or any existing constraint break the live VOUCHER write path? Explicitly, no:**
- The composite FK `(ocupacion_id, reserva_id) → reserva_ocupaciones(id, reserva_id)` (`scripts/061:84-86`) does not reference `documento_destino` and is untouched. `ON DELETE SET NULL (ocupacion_id)` keeps nulling `ocupacion_id` across **both** lists when an occupancy row is deleted — correct, since rooms belong to the reserva, not to a document. Do not scope it.
- `reserva_ocupaciones`' own `UNIQUE (reserva_id, orden)` and `UNIQUE (id, reserva_id)` are untouched.
- Between migration 064 and Task 3, VOUCHER's `INSERT` omits `documento_destino` and the `DEFAULT 'VOUCHER'` supplies it — the write path keeps working with **zero** code changes. That is the whole reason the default exists.
- After Task 3, the old `UNIQUE (reserva_id, orden)` is gone, so VOUCHER's `1..N` numbering can no longer collide with PROFORMA's. Uniqueness *within* the VOUCHER list is preserved exactly by the new 3-column constraint.

---

## 5. API / service changes (`app/actions/documentos-actions.ts`)

```ts
export type DocumentoDestino = "VOUCHER" | "PROFORMA"
const DOCUMENTOS_DESTINO_VALIDOS: DocumentoDestino[] = ["VOUCHER", "PROFORMA"]

export async function getPasajerosReservaAction(
  reservaId: number,
  documentoDestino: DocumentoDestino,          // REQUIRED — no default
)

export async function guardarPasajerosReservaAction(
  reservaId: number,
  pasajeros: PasajeroInput[],
  registradoPor: string,
  documentoDestino: DocumentoDestino,          // REQUIRED — no default
)
```

- **Runtime validation, before any `.from()`**: `if (!DOCUMENTOS_DESTINO_VALIDOS.includes(documentoDestino)) return { success:false, error: "documento_destino: debe ser VOUCHER o PROFORMA (no se asume un valor por defecto)" }`. A Server Action is a public HTTP endpoint; TypeScript is not a runtime guard. Never coerce an unknown value to `'VOUCHER'` (`stockin-zero-price`).
- **`getPasajerosReservaAction`** adds `.eq("documento_destino", documentoDestino)` alongside the existing `.eq("reserva_id", …)` and keeps `.order("orden", { ascending: true })` exactly as-is.
- **`guardarPasajerosReservaAction`** adds `documento_destino: documentoDestino` to each row in the `filas` map (`:308-316`). The composite-FK ocupacion guard (`:274-306`) stays **reserva-scoped, unchanged** — an occupancy group belongs to the reserva, not to a document.
- **`reemplazarConjuntoConRestauracion`** gains an optional 5th parameter:
  ```ts
  filtroAdicional?: { columna: string; valor: string }
  ```
  applied to the capture-`SELECT` (`:206-209`) **and** the `DELETE` (`:213`), via a small local helper so the chain is built once. When `undefined` — the occupancy call site — the emitted chain is **identical to today's**. This is the single change that makes the lists genuinely independent (Finding C).
- **What happens at every existing call site** (all six, grepped, exhaustive):

| Call site | Today | After Task 3 |
|---|---|---|
| `voucher/page.tsx:578` (`handleReservaSelect`) | `getPasajerosReservaAction(reserva.id)` | `getPasajerosReservaAction(reserva.id, "VOUCHER")` |
| `voucher/page.tsx:816` (`guardarPasajeros`) | `guardarPasajerosReservaAction(id, input, user)` | `…(id, input, user, "VOUCHER")` |
| `voucher/page.tsx:849` (`construirVoucherData`) | `getPasajerosReservaAction(reserva.id)` | `getPasajerosReservaAction(reserva.id, "VOUCHER")` |
| `proforma/page.tsx:287` (`openEditDialog`) | `getPasajerosReservaAction(reserva.id)` | `getPasajerosReservaAction(reserva.id, "PROFORMA")` |
| `proforma/page.tsx:354` (`generarConfirmacion` save) | `guardarPasajerosReservaAction(id, input, user)` | `…(id, input, user, "PROFORMA")` |
| `proforma/page.tsx:369` (`generarConfirmacion` read-back) | `getPasajerosReservaAction(reserva.id)` | `getPasajerosReservaAction(reserva.id, "PROFORMA")` |

  Every one is a **literal-argument addition only**. Any other line changing in those two files during Task 3 is a scope violation. `tsc --noEmit` fails until all six are updated — that is the regression guard, not a code review.
- **Not changed:** `getOcupacionesReservaAction`, `guardarOcupacionesReservaAction`, the relink functions, `getFacturaNumeroPorReservaAction`, `registrarDiscrepanciaTotalesAction`, `getDatosVoucherReservaAction`, `guardarDatosVoucherReservaAction`, `getDetallesReservaParaVoucherAction`, `PasajeroInput` (its `documento` field stays the **cédula**).

---

## 6. UI changes

**`app/reservas/ver/[id]/page.tsx`** — two buttons inside the existing action bar (`:352-362`), beside "Editar Reserva". Always rendered (ruling 3). Each is a bare `router.push` — **no validation, no data fetch, no state**:
```tsx
<Button data-testid="btn-generar-proforma"
        onClick={() => router.push(`/facturacion/proforma?reserva_id=${reserva.id}`)} …>
<Button data-testid="btn-generar-voucher"
        onClick={() => router.push(`/facturacion/voucher?reserva_id=${reserva.id}`)} …>
```
`data-testid` because `fake-green-tests` bans CSS-class/icon selectors for interactive triggers.

**`app/facturacion/proforma/page.tsx`**
- Dialog contains **only** "Información de los pasajeros". The Observación label + `Textarea` (`:844-853`), `EditableProformaData.observacion`, both initialisers (`:150`, `:280`) and the `Textarea` import (`:10`) are deleted. Dialog title/description unchanged.
- `openEditDialog` seeds from `resolverPasajerosParaEditor`; on `success:false` it fires a destructive toast **and** leaves the pre-set single blank row.
- `?reserva_id=` auto-opens the edit dialog for that reserva and sets `searchQuery` to its `codigo` (so the list behind the dialog is filtered — the observable proof of "not an unfiltered list"). Unknown id → destructive toast, no dialog.
- Default export becomes `<Suspense fallback={…}><FacturacionProformaPageInner/></Suspense>`; the fallback reuses the existing spinner markup at `:596-603` so there is no new visual language.

**`app/facturacion/voucher/page.tsx`**
- `?reserva_id=` calls the **existing** `handleReservaSelect(reserva)` and sets `searchQuery` to the reserva's `codigo`. Master-detail layout, LOCALIZADOR gating, occupancy prefill, pax/habitaciones warnings: **untouched**.
- Same `<Suspense>` wrapper treatment; fallback reuses the existing spinner at `:1075`.

**Empty/loading states:** the deep-link effect runs only once `loading === false`, so it never races the initial fetch. In `voucher/page.tsx` this also guarantees `productos`/`clientes` state has committed before `handleReservaSelect` reads it via `getProductoData` — `setProductos` and `setLoading(false)` are batched in the same continuation of `fetchReservas` (`:486-510`), so an effect observing `loading === false` observes both.

---

## 7. Edge cases

| Case | Handling |
|---|---|
| PROFORMA has no rows yet (every reserva, post-backfill) | `filasBlancasParaPasajeros(reserva.pasajeros)` → N blank rows. `null`/`undefined`/`0`/negative/non-integer/`NaN` → **1** row, via `Number.isFinite` + `Number.isInteger` + `>= 1`, never truthiness. Names are always `""` — a name is **never** fabricated (`stockin-zero-price`). |
| `reservas.pasajeros` is pathologically large | Renders that many inputs. **No cap** — inventing one is an unspecified product decision. Logged as a known, accepted edge; raise to the human only if real data shows it. |
| Passenger fetch fails on dialog open | Destructive toast (verbatim pattern from `voucher/page.tsx:609-615`) **and** the dialog still opens with the single default blank row. Never a silent blank. |
| Reserva id in the URL doesn't exist / isn't numeric | Destructive toast naming the id; the page stays on its normal list. Never a silent unfiltered list, never a crash. |
| Deep-link effect re-firing | `useRef` latch set **before** the async call; the effect also early-returns while `loading`. Re-opening the dialog after the user closes it is not a behaviour we ship. |
| Reserva missing required fields (e.g. zero `reserva_detalles`) | Unchanged. `buildConfirmacionData` (`proforma/page.tsx:467-488`) / `buildVoucherData` (`voucher/page.tsx:920-929`) still block and still list **every** missing field. The entry points route into these same handlers; no validation is duplicated on the reserva page. |
| Concurrent edits: two staff save PROFORMA for the same reserva | Same delete-then-insert-with-restore contract as today, now scoped to `documento_destino='PROFORMA'`. Last writer wins within that list; the three-outcome result (`success` / `restored:true` / `restored:false + restoreError`) is unchanged and still surfaced. |
| Concurrent edits: PROFORMA save vs VOUCHER save | **Now genuinely independent** — the scoped `DELETE` cannot touch the other document's rows. This is the whole point of Finding C, and it is the isolation assertion in Task 8. |
| Occupancy save while both lists exist | `guardarOcupacionesReservaAction` captures/relinks passenger links across **both** lists, by `reserva_id`. Intentionally unchanged: rooms are reserva-level. A dev must not scope it. |
| Rollback for a failed mutation | No optimistic UI is introduced. The dialog's draft state is not a write; a failed save leaves the dialog open, nothing persisted, destructive toast shown. Server-side rollback remains `reemplazarConjuntoConRestauracion`'s best-effort restore. |
| Realtime races | None possible — this repo has no realtime subscribers (grepped: no `supabase.channel` / `postgres_changes` anywhere). |
| Deploy window (migration applied, Task 3 not yet) | VOUCHER keeps working via `DEFAULT 'VOUCHER'`; PROFORMA keeps its current (buggy) shared-list behaviour. No broken intermediate state. |

---

## 8. Test plan

**Commands (every task):** `npm run qa` — full output pasted, no "would pass".
**Extra command (Tasks 5, 6, 8):** `npx next build` — required, because `npm run qa` never runs it and the Suspense rule is only enforced there.
**Human-gated live-DB commands (Tasks 1 and 8):** the SQL in §4.1/§4.3 and §8.3.

### 8.1 Existing suites — expected impact
| Suite | Impact |
|---|---|
| `tests/documentos-actions.test.ts` | **Edited** — ~30 passenger call sites gain the argument; new guards added. |
| `tests/voucher-page.test.ts` | **Must need ZERO edits.** It imports pure functions unaffected by this sprint. Needing an edit is a regression signal. |
| `tests/voucher-data.test.ts`, `tests/voucher-html.test.ts` | **Must need ZERO edits** and stay green — proves the money-free VOUCHER contract is untouched. |
| `tests/confirmacion-data.test.ts`, `tests/confirmacion-html.test.ts` | **Must need ZERO edits** — proves the generated document's field set is unchanged. |
| `tests/proforma-snapshot.test.ts` | **Must need ZERO edits** — it pins the legacy `generateProformaHTML`, which this sprint does not touch. |

### 8.2 New tests
`tests/documentos-actions.test.ts` (added):
1. `getPasajerosReservaAction(42,"PROFORMA")` calls `.eq("reserva_id",42)` **and** `.eq("documento_destino","PROFORMA")`. *Mutation: drop the second `.eq` → red.*
2. `getPasajerosReservaAction(42,"VOUCHER")` likewise. *Mutation: hardcode `"PROFORMA"` → red.*
3. `guardarPasajerosReservaAction(42,[…],"u","PROFORMA")` — every inserted row carries `documento_destino:"PROFORMA"`. *Mutation: omit the field → red.*
4. **Isolation:** the passenger `DELETE` builder received `.eq("reserva_id",42)` **and** `.eq("documento_destino","PROFORMA")`. *Mutation: remove `filtroAdicional` from the delete → red.* (Honest limitation: an in-memory mock cannot prove VOUCHER's rows physically survive — §8.3 does that.)
5. **Occupancy non-regression:** in `guardarOcupacionesReservaAction`, the `reserva_ocupaciones` capture-SELECT and DELETE builders each received **exactly one** `.eq`, `("reserva_id", id)`. *Mutation: pass any `filtroAdicional` on the occupancy path → red.*
6. Invalid `documentoDestino` (`"FACTURA"`, `""`, `undefined` via a cast) is rejected and `mockFrom` was **never called**. *Mutation: coerce to `"VOUCHER"` instead of rejecting → red.*
7. Existing restore-path tests re-run with the argument, proving the 3-outcome contract is unchanged.

`tests/proforma-page.test.ts` (new, `@vitest-environment node`, importing from `app/facturacion/proforma/page`):
8. `filasBlancasParaPasajeros`: `3 → 3` rows; `1 → 1`; `0 → 1`; `null → 1`; `undefined → 1`; `-2 → 1`; `2.5 → 1`; `NaN → 1`. Every returned row has `nombreCompleto === ""` and `tipoPax === "ADULTO"`, `ocupacionId === null`. *Mutation: swap the finite/integer test for `pasajeros || 1` → the `2.5` and `NaN` cases go red.*
9. `resolverPasajerosParaEditor`: success+rows → mapped rows (name-for-name, using a fixture with **two different names** so it can't pass on repetition); success+`[]` → `filasBlancasParaPasajeros(n)`; `success:false` → `null`. *Mutation: return blanks on failure instead of `null` → red.*

`tests/deep-link-reserva.test.ts` (new):
10. `resolverReservaDeepLink(null, …) → {estado:"sin-param"}`; `("7", [{id:7},{id:9}]) → {estado:"encontrada", reserva:{id:7}}` (two-element fixture so it can't pass on "first item"); `("9", …) → {id:9}`; `("999", …) → {estado:"no-encontrada"}`; `("abc", …) → "no-encontrada"`; `("", …) → "sin-param"`. *Mutation: `Number(param)` without the `Number.isFinite` guard → the `"abc"` case goes red.*

### 8.3 Manual / live-DB verification (the parts unit tests structurally cannot prove)
Run on a **scratch reserva** the human nominates. Each step's actual output is pasted.

| # | Step | PASS |
|---|---|---|
| M1 | VOUCHER page → select reserva → passengers `["ANA A","LUIS B"]` → Guardar Pasajeros | toast fires **after** the write resolves; `SELECT nombre_completo, documento_destino FROM reserva_pasajeros WHERE reserva_id=<id>` returns exactly those two, both `VOUCHER` |
| M2 | `/reservas/ver/<id>` → "Generar Proforma" | lands on `/facturacion/proforma?reserva_id=<id>`, edit dialog open for that reserva, list behind it filtered to its `codigo` |
| M3 | Inspect the open dialog | **"ANA A"/"LUIS B" are NOT shown** (name-for-name comparison); exactly `reservas.pasajeros` blank rows, or 1 if that is null/0 |
| M4 | Same dialog | **no "Observación" textarea anywhere in it** |
| M5 | Type `["CARLA C"]` → Generar Proforma | document opens; `SELECT nombre_completo, documento_destino …` returns **`ANA A`/VOUCHER, `LUIS B`/VOUCHER, `CARLA C`/PROFORMA** — the isolation proof for ruling 1 |
| M6 | Re-open VOUCHER for the same reserva | passenger editor shows exactly `ANA A`, `LUIS B` — unchanged; occupancy prefill and the LOCALIZADOR-gated buttons behave exactly as before |
| M7 | `/reservas/ver/<id>` → "Generar Voucher" | lands on `/facturacion/voucher?reserva_id=<id>` with that reserva selected, list filtered; not an unfiltered list |
| M8 | Deep-link into a reserva with **zero `reserva_detalles`** → generate | the existing destructive toast still fires listing **every** missing field; no document opens. Generation neither succeeds where it previously blocked, nor blocks silently |
| M9 | Force the passenger fetch to fail (temporarily throw in the action), open the dialog | destructive toast fires **and** the dialog opens with one blank row. Revert the forced failure afterwards |
| M10 | Deep-link with `?reserva_id=99999999` | destructive toast; no dialog; page usable |
| M11 | **Rápida regression** on a reserva with **zero** `reserva_pasajeros` rows: generate before the sprint (from `git stash`/baseline) and after; diff the HTML | byte-identical. (Qualification per §1: for a reserva whose only rows were VOUCHER's, the output *must* change — that is the fix) |
| M12 | `npx next build` | completes with **no** "useSearchParams() should be wrapped in a suspense boundary" for `/facturacion/proforma` or `/facturacion/voucher` |

---

## 9. Risks

1. **Two already-oversized files grow further.** `voucher/page.tsx` 1526 → ~1560; `documentos-actions.ts` 1213 → ~1275; `proforma/page.tsx` 915 → ~965 (net of the ~12 lines Task 2 removes); `reservas/ver/[id]/page.tsx` 935 → ~955. All four already breach `.claude/rules/file-size.md`. **Splits are B-1/B-9 backlog and each is its own scoped task — no task in this sprint may split anything.** Named here per the rule's "flag it, don't do it silently" requirement. Two of the four new/edited units (`lib/deep-link-reserva.ts`, the exported pure seeders) are extractions that push logic *out* of the big files rather than into them — the only mitigation available without a split.
2. **A wrong constraint name in pre-flight (2)** ships a latent 23505 that only appears on PROFORMA's first save. Mitigated by the mandatory pre-flight + post-flight assertion (b).
3. **The Suspense wrapper is invisible to `npm run qa`.** Mitigated by making `npx next build` a hard, pasted-output gate on Tasks 5, 6 and 8.
4. **No component-mount test harness exists in this repo** (zero jsdom/RTL suites). Introducing one is a new capability and out of scope; per the in-repo precedent (`tests/voucher-page.test.ts`), decisions are extracted into pure exported functions and unit-tested, and the residual wiring is covered by the mutation-checked manual steps M1–M12. QA should not treat this as a coverage gap — it is the repo's established pattern, applied.
5. **Sequential execution assumed.** No task may assume another is in flight (`environment-reliability-incidents`: never concurrent write-capable agents on one tree).

---

## 10. Task list

> Every task: real diff pasted · `npm run qa` actually run with output shown · no file touched outside its list · RLS not weakened · a one-line rollback note. A task is FAILED if a command "would" pass but wasn't run.

---

### Task 1 — Migration 064: `documento_destino` + backfill + uniqueness swap
- **Owner:** `senior-dev` — **HUMAN-GATED.** The human runs the SQL against the real database; the dev writes the file and the verification queries and does not execute anything against production.
- **Dependencies:** none. **Blocked on** human confirmation of Findings A + B (§1).
- **Files in scope:** `scripts/064-add-documento-destino-to-reserva-pasajeros.sql` (new — this file only).
- **DB/RLS:** adds `reserva_pasajeros.documento_destino text NOT NULL DEFAULT 'VOUCHER'` + `CHECK IN ('VOUCHER','PROFORMA')`; backfills all existing rows to `'VOUCHER'`; **drops** `UNIQUE (reserva_id, orden)` and **adds** `UNIQUE (reserva_id, documento_destino, orden)`. **No RLS statement of any kind.** Existing policy `reserva_pasajeros_staff_all` (`FOR ALL TO authenticated`, `anon` denied) must be provably unchanged.
- **Acceptance (PASS/FAIL):**
  1. The file's content is **verbatim §4.2**, including the header comment block.
  2. Pre-flight queries §4.1 (1)–(4) were run **before** the DDL and their output is pasted. **`mistakes/schema-source-of-truth` prevention rule applies here by name: no claim about this live table may rest on `scripts/061`, on `lib/supabase.ts`, or on a TypeScript interface — only on this pasted `information_schema`/`pg_constraint` output.**
  3. If pre-flight (2) returned a constraint name other than `reserva_pasajeros_reserva_id_orden_key`, line 5 of the migration was edited to the real name **before** running. Stated explicitly either way.
  4. Post-flight (a): `documento_destino | NO | 'VOUCHER'::text`.
  5. Post-flight (b): the new 3-column UNIQUE exists **and no constraint whose definition is `UNIQUE (reserva_id, orden)` remains**.
  6. Post-flight (c): exactly one group, `'VOUCHER'`, with the same count as pre-flight (4). Zero `'PROFORMA'` rows.
  7. Post-flight (d) is **byte-identical** to pre-flight (3), and (e) returns `true`.
  8. `grep -inE "policy|grant|row level security" scripts/064-*.sql` returns only comment lines.
  9. `npm run qa` green (unchanged — no TS touched).
- **Rollback:** the verbatim block in the migration header. **Note it deletes `'PROFORMA'` rows** — unavoidable, since the old 2-column UNIQUE cannot be restored while two lists share an `orden`.

---

### Task 2 — Remove the dead "Observación" from PROFORMA's edit dialog
- **Owner:** `junior-dev` (pure UI/dead-code removal).
- **Dependencies:** none.
- **Files in scope:** `app/facturacion/proforma/page.tsx` **only**.
- **DB/RLS:** none.
- **Acceptance:**
  1. The label + `Textarea` block at `:844-853` is deleted; the dialog's only remaining section is "Información de los pasajeros".
  2. `observacion` is gone from `EditableProformaData` (`:131-134`), from the initial state (`:148-151`) and from `openEditDialog`'s reset (`:278-281`).
  3. `grep -n "observacion" app/facturacion/proforma/page.tsx` returns **nothing**.
  4. `grep -n "Textarea" app/facturacion/proforma/page.tsx` returns **nothing** (the import at `:10` is removed too).
  5. `reserva.nota_interna_reserva` still feeds `observaciones` at `:462` — **unchanged**; `grep -n "nota_interna_reserva" app/facturacion/proforma/page.tsx` still shows that line.
  6. `tests/confirmacion-html.test.ts` and `tests/confirmacion-data.test.ts` pass **without edits** — the document's field set is untouched.
  7. `npm run qa` green.
- **Rollback:** revert this commit.

---

### Task 3 — `documento_destino` through the server-action layer (the shared path)
- **Owner:** `senior-dev` — shared read/write path, direct VOUCHER-regression risk.
- **Dependencies:** Task 1 (the column and the new UNIQUE must exist first), Task 2 (same file, sequential cleanliness).
- **Files in scope:** `app/actions/documentos-actions.ts` · `app/facturacion/proforma/page.tsx` · `app/facturacion/voucher/page.tsx` · `tests/documentos-actions.test.ts`.
- **DB/RLS:** none (Task 1 owns the schema). Access stays exclusively through the service-role action module — no browser/`anon` query to `reserva_pasajeros` is added.
- **Acceptance:**
  1. `DocumentoDestino` is exported; both passenger actions take it as a **required** parameter with **no** TypeScript default and **no** optional marker. *Mutation check: delete the argument at `voucher/page.tsx:578` → `npm run typecheck` goes red; restore.*
  2. An invalid value is rejected **before** any `.from()` call, with an error naming `documento_destino`. **`mistakes/stockin-zero-price` prevention rule ("block, never default") applies by name: an unknown discriminator is never coerced to `'VOUCHER'`.**
  3. `getPasajerosReservaAction` filters on **both** `reserva_id` and `documento_destino`, and still orders by `orden` ascending.
  4. Every row written by `guardarPasajerosReservaAction` carries `documento_destino`.
  5. `reemplazarConjuntoConRestauracion`'s new `filtroAdicional` is **optional**, applied to the capture-SELECT and the DELETE, and passed **only** by the passenger call site.
  6. **Occupancy path byte-identical:** test #5 (§8.2) proves the `reserva_ocupaciones` capture-SELECT and DELETE builders each got exactly one `.eq`, `("reserva_id", id)`. *Mutation: pass a filter on the occupancy path → red.*
  7. The diff in `proforma/page.tsx` and `voucher/page.tsx` consists of **exactly six changed lines**, each adding one string literal argument (the §5 table). Any seventh changed line in those two files = FAIL.
  8. `guardarOcupacionesReservaAction`, the relink functions and `claveIdentidadMaterial` are **unchanged** — `git diff` shows no line inside them.
  9. New tests #1–#7 (§8.2) added; each carries a stated mutation that was actually run and shown to go red, then restored. **`mistakes/fake-green-tests` applies by name: no assertion may read source text or a CSS class; every guard is mutation-checked.**
  10. `tests/voucher-data.test.ts`, `tests/voucher-html.test.ts`, `tests/voucher-page.test.ts` pass with **zero edits**.
  11. `npm run qa` green.
- **Rollback:** revert this commit; the DB column and default keep the live VOUCHER path working (§4.2's deploy-window note).

---

### Task 4 — PROFORMA's own passenger list: seeding + fetch-failure toast
- **Owner:** `senior-dev` — block-never-default arithmetic on a user-visible list, and it is the fix for the reported bug.
- **Dependencies:** Task 3.
- **Files in scope:** `app/facturacion/proforma/page.tsx` · `tests/proforma-page.test.ts` (new).
- **DB/RLS:** none.
- **Acceptance:**
  1. Two pure functions are **exported** from the page module (the `tests/voucher-page.test.ts` precedent): `filasBlancasParaPasajeros(pasajerosReserva: number | null | undefined): EditablePasajero[]` and `resolverPasajerosParaEditor(resultado, pasajerosReserva): EditablePasajero[] | null`.
  2. Seeding rule: exactly `reservas.pasajeros` blank rows when that is a finite integer `>= 1`; **1** row for `null`/`undefined`/`0`/negative/non-integer/`NaN`. Implemented with `Number.isFinite` + `Number.isInteger`, **never truthiness**. **`mistakes/stockin-zero-price` prevention rule applies by name: cuts both ways — a legitimate `0` is not silently treated as truthy-false garbage, it maps to the ruled minimum of 1, and no passenger NAME is ever fabricated (every seeded row has `nombreCompleto: ""`).**
  3. `openEditDialog` uses `resolverPasajerosParaEditor`; on `success:false` it fires a **destructive** toast (same shape as `voucher/page.tsx:609-615`) **and** the dialog still opens with the single default blank row.
  4. `grep -n "getPasajerosReservaAction\|guardarPasajerosReservaAction" app/facturacion/proforma/page.tsx` shows `"PROFORMA"` on **all three** call sites.
  5. Tests #8–#9 (§8.2) added, using a two-distinct-name fixture; each mutation run and shown red, then restored.
  6. Manual M3 + M9 (§8.3) executed with output pasted.
  7. No success toast can fire before a write resolves — the existing await-then-check order at `:353-367` is unchanged. **`mistakes/premature-success-signal` applies by name.**
  8. `npm run qa` green.
- **Rollback:** revert this commit; PROFORMA returns to reading its (now empty) PROFORMA list with a single blank row — degraded, not broken.

---

### Task 5 — PROFORMA deep link `?reserva_id=` + Suspense boundary
- **Owner:** `senior-dev` — structural change (default-export wrapper) to a 900-line file, plus a build-only failure mode.
- **Dependencies:** Task 4.
- **Files in scope:** `lib/deep-link-reserva.ts` (new) · `tests/deep-link-reserva.test.ts` (new) · `app/facturacion/proforma/page.tsx`.
- **DB/RLS:** none.
- **Acceptance:**
  1. `lib/deep-link-reserva.ts` exports one pure function returning a discriminated result `{estado:"sin-param"} | {estado:"encontrada", reserva} | {estado:"no-encontrada", param}`. No React, no I/O, no Supabase import.
  2. Param name is exactly `reserva_id` and the value is the numeric `reservas.id` — matching `app/reservas/pendientes/page.tsx:1001` / `app/pagos/registrar/page.tsx:49`.
  3. A run-once `useEffect` (a `useRef` latch set **before** the async call, early-return while `loading`) calls the **existing** `openEditDialog(reserva)` and sets `searchQuery` to `reserva.codigo`. `openEditDialog`'s own body is unchanged by this task.
  4. `no-encontrada` → destructive toast naming the id, no dialog, page still usable. `sin-param` → today's behaviour, bit for bit.
  5. Default export is a `<Suspense>` wrapper around the renamed inner component; the fallback reuses the existing spinner markup (`:596-603`). The inner component's body is otherwise **unchanged** — a diff touching `generarConfirmacion`, `buildConfirmacionData`'s call, or the totals/discrepancy path is a FAIL.
  6. **`npx next build` run, output pasted, with no "useSearchParams() should be wrapped in a suspense boundary" for `/facturacion/proforma`.** `npm run qa` alone does not satisfy this criterion.
  7. Test #10 (§8.2) added with its mutation run and shown red.
  8. Manual M2 + M10 executed, output pasted.
  9. No other page's missing Suspense boundary is fixed (backlog).
  10. `npm run qa` green.
- **Rollback:** revert this commit; `/facturacion/proforma` returns to a plain default export with no param handling.

---

### Task 6 — VOUCHER deep link `?reserva_id=` + Suspense boundary
- **Owner:** `senior-dev` — the live VOUCHER page; highest regression sensitivity in the sprint.
- **Dependencies:** Task 5 (`lib/deep-link-reserva.ts` must exist).
- **Files in scope:** `app/facturacion/voucher/page.tsx` **only**.
- **DB/RLS:** none.
- **Acceptance:**
  1. Same param name/value and the same run-once latch pattern as Task 5, calling the **existing** `handleReservaSelect(reserva)` and setting `searchQuery` to `reserva.codigo`.
  2. The effect runs only when `loading === false`, so `productos`/`clientes` state has committed before `handleReservaSelect` reads it (otherwise `lugar` silently prefills blank).
  3. `handleReservaSelect` (`:555-653`), `construirVoucherData` (`:846-932`), `guardarPasajeros`, `guardarOcupaciones`, `guardarDatosVoucher`, `derivarTelefonoHotel`, `debePrefillarOcupaciones`, `resolverOcupacionesParaPrefill`, `mapearDetallesAOcupaciones`, the LOCALIZADOR gate (`:1005-1007`) and the pax/habitaciones warnings are **unchanged** — `git diff` shows no line inside any of them.
  4. Default export is a `<Suspense>` wrapper around the renamed inner component; fallback reuses the existing spinner (`:1073-1077`). The diff is a wrapper + one effect + one import — nothing re-indented, nothing reordered.
  5. **`npx next build` run, output pasted, no Suspense error for `/facturacion/voucher`.**
  6. `tests/voucher-page.test.ts`, `tests/voucher-data.test.ts`, `tests/voucher-html.test.ts` pass with **zero edits** (the page module's exported pure functions keep their names and signatures).
  7. Manual M6 + M7 executed, output pasted.
  8. `npm run qa` green.
- **Rollback:** revert this commit; `/facturacion/voucher` returns to plain manual selection.

---

### Task 7 — "Generar Proforma" / "Generar Voucher" buttons on `/reservas/ver/[id]`
- **Owner:** `junior-dev` (pure UI/navigation; zero data or validation logic).
- **Dependencies:** Tasks 5 and 6 (never ship an entry point before its destination handles the param).
- **Files in scope:** `app/reservas/ver/[id]/page.tsx` **only**.
- **DB/RLS:** none.
- **Acceptance:**
  1. Both buttons render in the existing header action bar (`:352-362`) beside "Editar Reserva", **always** (ruling 3) — no `disabled`, no conditional render, no status check.
  2. Each `onClick` is exactly one `router.push` to `` `/facturacion/proforma?reserva_id=${reserva.id}` `` / `` `/facturacion/voucher?reserva_id=${reserva.id}` ``.
  3. Each carries `data-testid="btn-generar-proforma"` / `"btn-generar-voucher"`. **`mistakes/fake-green-tests` prevention rule applies by name: interactive triggers get stable `data-testid`s, never CSS-class or icon-library selectors.**
  4. **No validation logic is added to this page.** `grep -inE "buildConfirmacionData|buildVoucherData|missing|toast\(" app/reservas/ver/\[id\]/page.tsx` returns only the pre-existing load-error toast at `:236-240`.
  5. No new data fetch, no new state, no new server-action import in this file.
  6. Manual M2, M7, M8 executed, output pasted. **M8 is the acceptance criterion for "arriving via either entry point does not bypass existing generation validation."**
  7. `npm run qa` green.
- **Rollback:** revert this commit; the two buttons disappear, both target pages keep working via manual selection.

---

### Task 8 — VOUCHER non-regression + isolation evidence pass (HUMAN-GATED)
- **Owner:** `senior-dev`. **No source file may be edited in this task** (except a temporary, reverted throw for M9 if not already done in Task 4). Its deliverable is evidence pasted into the transcript.
- **Dependencies:** Tasks 1–7.
- **Files in scope:** none (read-only + live-DB queries). If any source edit turns out to be needed, that is a **new** task, not this one.
- **DB/RLS:** read-only verification only; plus the controlled scratch-reserva writes in M1/M5.
- **Acceptance:**
  1. **M1–M12 (§8.3) all executed on the human's nominated scratch reserva, with actual output pasted — not summarised.** **`mistakes/assertion-without-verification` prevention rule applies by name: no state claim without the exact check run at claim time, output shown.**
  2. **M5 is the isolation proof for ruling 1:** after a PROFORMA save, `SELECT nombre_completo, documento_destino FROM reserva_pasajeros WHERE reserva_id=<id> ORDER BY documento_destino, orden` shows VOUCHER's original rows **unchanged** alongside the new PROFORMA row.
  3. **M6 is the "VOUCHER behaves bit-for-bit as before" proof:** editor contents, occupancy prefill and the LOCALIZADOR-gated button state all match the pre-sprint behaviour, demonstrated rather than asserted.
  4. **M11 is the Rápida regression proof**, run against a reserva with **zero** `reserva_pasajeros` rows, with the qualification from §1 stated in the report.
  5. Post-flight RLS queries §4.3 (d)/(e) re-run at the end of the sprint and still byte-identical to the pre-migration baseline — **RLS was not weakened at any point.**
  6. `npm run qa` and `npx next build` both run on the final tree, full output pasted.
  7. `git diff --stat` against the sprint's base commit shows **only** the nine files in §3's seam map.
- **Rollback:** n/a (no code change). If a failure is found, it opens a new scoped task; do not fix it inside this one.

---

PLAN_PATH: docs/plans/reserva-document-entry-points.md
