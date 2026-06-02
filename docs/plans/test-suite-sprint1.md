# Sprint 1 — Establish a Passing Automated Test Suite (All 11 Modules)

Architect plan. No feature/UI changes. The only product-code edits in this sprint
are the four bug fixes explicitly listed in the spec. Everything else is tooling +
tests + a new pure-helper module that the tests target.

---

## 0. Ground truth from the real codebase (verified, not from CLAUDE.md)

I inspected the actual files. Key facts that shape this plan:

- **`package.json`** already contains `"lint": "eslint ."` and
  `"qa": "npm run typecheck && npm run lint && npm run test"` (lines 8, 10) — but
  there is **no `typecheck` script and no `test` script**, and **ESLint / vitest are
  not installed**. So `npm run qa` currently fails immediately. Spec items 1, 2, 3, 4
  are required just to make `qa` runnable.
- **`lib/supabase.ts:25`** — confirmed bug: `new Proxy({} as ReturnType<typeof createBrowserClient>, ...)`
  references `createBrowserClient`, which is **never imported** (only
  `createClient as createSupabaseClient` from `@supabase/supabase-js` is imported,
  line 1). This is a hard `tsc` error.
- **`lib/supabase.ts:7` `getSupabaseClient()`** already returns `null` without throwing
  when env vars are absent (lines 13-21). The acceptance criterion
  "getSupabaseClient() returns null without throwing" is **already satisfied** — the
  test will lock that behavior in (regression guard), not change code.
- **`lib/supabase-server.ts:3-4`** — confirmed bug: `process.env.NEXT_PUBLIC_SUPABASE_URL!`
  and `process.env.SUPABASE_SERVICE_ROLE_KEY!` are read at **module load** and passed
  straight into `createClient(...)` at module scope (line 6). Importing this module
  with env vars absent will throw at import time, which breaks any test that imports a
  file transitively depending on it. Must become lazy.
- **`app/actions/crm-actions.ts:98`** — confirmed bug: `cerrado_por: "Usuario Actual"`
  hardcoded inside `cerrarCasoAction(casoId, comentarioCierre?)`. This is the **only**
  file in `app/actions/`. (Glob of `app/actions/**/*.ts` returns exactly one file.)
- **`cerrarCasoAction` call sites**: exactly one — `app/crm/casos/page.tsx:423`
  (`cerrarCasoAction(casoId, comentarioCierre || undefined)`). The optimistic-UI
  block above it (`app/crm/casos/page.tsx:400`) also hardcodes
  `cerrado_por: "Usuario Actual"`.
- **Important finding for the cerrarCaso fix**: `app/crm/casos/page.tsx` does **NOT**
  import or use `useUser()` from `lib/user-context.tsx`. To pass a real identity we
  must wire `useUser()` into that page. The available identity field is `user.nombre`
  (or `user.email`) from `lib/user-context.tsx` (the `User` interface has
  `id, email, nombre, rol`). This is a small, contained edit but it IS a UI-file edit;
  the spec's "no UI changes" means no visual/layout changes — adding a hook call and
  passing an argument is allowed because it is part of the explicitly-approved
  cerrarCaso fix (spec item 7, Option A).
- **Provisional `suplidor_id "0" -> null`**: lives in `lib/provisional-system.ts`
  `crearRegistroProvisional` (lines 111-119) and `actualizarRegistroProvisional`
  (lines 190-196). These functions call `getSupabase()` (lines 106, 185) which throws
  if the client is null, and then hit the DB. They are testable with a **mocked
  Supabase client** injected via `createClient` mock. Note: the coercion only runs for
  `tabla === "productos"`, and the value lives in `datosLimpios.suplidor_id`. The test
  must assert against the object passed to `.insert([...])` / `.update(...)`.
- **Balance + penalty logic does NOT exist as pure functions.** It is inlined in page
  components (e.g. `app/dashboard/page.tsx:74-81` does the penalty windowing in the
  Supabase query with `hoyStr`/`limite10DiasStr`; balance math is scattered across
  `app/clientes/balance/page.tsx`, `app/pagos/page.tsx`, etc., all UI). There is **no
  extractable pure helper today**. The acceptance criteria
  (`1000 - (300+200) = 500`, `3 days flagged / 11 days not`) therefore require us to
  create small pure helpers in `lib/` and test those. This is a deliberate
  architectural call — see §6.
- **`lib/utils.ts` `formatDateDMY`** exists and matches the spec contract
  (`null -> "N/A"`, `"2026-05-24" -> "24-May-2026"`). Note month array is Spanish
  abbreviations (`"May"` happens to match; `"2026-01-01"` -> `"01-Ene-2026"`). Tests
  must use the real expected Spanish month tokens.
- **`lib/admin-actions.ts`** exists and is pure-ish server data layer over
  `acciones_pendientes` (also testable with mocked client). **`lib/document-generator.tsx`**
  exists but is out of scope (PDF/UI).
- **`tsconfig.json`**: `"strict": true`, `"noEmit": true`, `moduleResolution: "bundler"`,
  path alias `"@/*": ["./*"]`. Vitest config must mirror the `@/` alias.
- **No existing test files, no jest/vitest config, no `.eslintrc`** anywhere.
- `next` is `14.2.25` (CLAUDE.md says 15 — the real file says 14). `react` is `^19`.
  `eslint-config-next` must match Next 14.2.x.

---

## 1. Technical approach (one paragraph)

Make `npm run qa` runnable and green by (a) adding `typecheck` (`tsc --noEmit`) and
`test` (`vitest run`) scripts and installing Vitest + Testing Library + ESLint +
`eslint-config-next@14.2.25`; (b) fixing the four real defects (supabase.ts proxy type,
supabase-server.ts eager env read, crm-actions hardcoded `cerrado_por` via a new
parameter, and its single call site); (c) extracting the genuinely-untested business
math — client/reservation balance and penalty-window flagging — into small pure helpers
in `lib/finance.ts` and `lib/penalties.ts` so the acceptance criteria can be asserted
without rendering pages; and (d) writing one Vitest file per module (>=11 files, >=40
cases) that test pure functions directly and the CRUD server-side paths through a mocked
Supabase client (`vi.mock("@/lib/supabase")` / `vi.mock("@supabase/supabase-js")` returning
a chainable query-builder stub). No DB, RLS, or schema changes; no real network.

---

## 2. File map

### Create

| Path | Purpose |
|---|---|
| `vitest.config.ts` | Vitest config: `environment: "node"` default, `jsdom` per-file for RTL; `@/` alias to project root; `globals: true`. |
| `vitest.setup.ts` | Global test setup: `@testing-library/jest-dom` matchers; clears `process.env` supabase vars per test where needed. |
| `.eslintrc.json` | `{ "extends": "next/core-web-vitals" }` so `eslint .` works with `eslint-config-next`. |
| `.eslintignore` | Ignore `node_modules`, `.next`, `**/*.config.*` noise if needed to keep lint green without source edits. |
| `lib/finance.ts` | **New pure helpers**: `calcularBalance(total, pagos[])`, `sumarPagos(pagos[])`. No Supabase import. |
| `lib/penalties.ts` | **New pure helpers**: `diasHastaFecha(fechaLimite, hoy)`, `estaEnVentanaPenalidad(fechaLimite, hoy, ventanaDias = 5)`. |
| `tests/utils.test.ts` | Unit: `formatDateDMY` (Config/formatting module). |
| `tests/finance.test.ts` | Unit: balance math (Pagos/Reservas/Clientes balance). |
| `tests/penalties.test.ts` | Unit: penalty window (Dashboard/Reservas alerts). |
| `tests/supabase-client.test.ts` | Unit: `getSupabaseClient()` returns null w/o env, returns client w/ env, proxy throws on access w/o env (Infra). |
| `tests/clientes.actions.test.ts` | Integration (mocked): `actualizarClienteAction` + provisional cliente create (Clientes module). |
| `tests/suplidores.actions.test.ts` | Integration (mocked): `crearSuplidorAction`, `actualizarSuplidorAction` (Suplidores). |
| `tests/productos.actions.test.ts` | Integration (mocked): `crearProductoAction`, `actualizarProductoAction`, **suplidor_id "0" -> null** in provisional (Productos). |
| `tests/reservas.provisional.test.ts` | Integration (mocked): `crearReservaProvisional` cliente_id/producto_id "0" -> null (Reservas). |
| `tests/pagos.provisional.test.ts` | Integration (mocked): `crearPagoProvisional` create path (Pagos). |
| `tests/crm.actions.test.ts` | Integration (mocked): `cerrarCasoAction` uses passed-in `cerrado_por`, never `"Usuario Actual"` (CRM). |
| `tests/facturacion.helpers.test.ts` | Unit: any pure helper touched by invoicing (NCF/format) OR a mocked path if a server fn exists; otherwise assert formatting helper used by facturacion (Facturación). |
| `tests/configuracion.actions.test.ts` | Integration (mocked): `crearAccionPendiente` / `admin-actions` path (Configuración). |
| `tests/provisional-system.test.ts` | Integration (mocked): `aprobarCambio` / `rechazarCambio` happy + not-found (Workflows). |
| `tests/audit-logs.test.ts` | Unit/integration (mocked): logging/audit helper if present, else `obtenerRegistrosCompletos` excludes `ELIMINADO` (Logs/Audit + covers Proyectos data path). |

> 11 modules are covered by: utils/format(Config), finance(Pagos), penalties(Reservas/Dashboard),
> clientes, suplidores, productos, reservas, pagos, crm, facturacion, configuracion,
> provisional/workflows, audit-logs/proyectos. That is **>=13 test files**, comfortably
> over the 11-file / 40-case bar.

### Edit (product code — ONLY these four fixes + the one call-site wiring)

| Path | Change |
|---|---|
| `package.json` | Add `"typecheck": "tsc --noEmit"` and `"test": "vitest run"` to `scripts`. Add devDeps: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `eslint`, `eslint-config-next@14.2.25`. |
| `lib/supabase.ts` | Line 25: replace `ReturnType<typeof createBrowserClient>` with `ReturnType<typeof createSupabaseClient>` (the actually-imported symbol). No behavior change. |
| `lib/supabase-server.ts` | Convert module-scope eager client into a lazy `getSupabaseServer()` that reads env at call time and returns `null` (or throws a clear error only on use) when vars are absent. Keep a backward-compatible `supabaseServer` export via a lazy Proxy mirroring `lib/supabase.ts` so existing imports don't break. |
| `app/actions/crm-actions.ts` | `cerrarCasoAction(casoId, comentarioCierre?)` -> `cerrarCasoAction(casoId, cerradoPor: string, comentarioCierre?)`. Use `cerrado_por: cerradoPor`. |
| `app/crm/casos/page.tsx` | Add `import { useUser } from "@/lib/user-context"`, call `const { user } = useUser()`, pass `user?.nombre ?? user?.email ?? "Desconocido"` as `cerradoPor` to `cerrarCasoAction(...)` at line 423; replace the optimistic `cerrado_por: "Usuario Actual"` at line 400 with the same identity. No visual change. |

### Must NOT touch

- Any other file in `app/**` (no other call site exists for `cerrarCasoAction`).
- `components/**`, `hooks/**`, `lib/document-generator.tsx`.
- Any Supabase query shape, table name, column name.
- `tsconfig.json` (already correct for `tsc --noEmit`; do not relax `strict`).
- No new dependencies beyond the test/lint stack listed.

---

## 3. DB / RLS changes

**None.** No new tables, columns, policies, or migrations. Org isolation is unchanged.
Tests run entirely against a mocked Supabase client; no real connection is opened.
(If any task appears to require a schema/RLS change, STOP and surface to the human —
that would be out of spec.)

---

## 4. API / service changes

- `cerrarCasoAction` signature change (additive parameter) — see §2. This is the only
  service-contract change. All call sites updated in the same task.
- `lib/supabase-server.ts` export becomes lazy. Public symbol `supabaseServer` is
  preserved (Proxy) so no caller changes are needed.
- New pure modules `lib/finance.ts`, `lib/penalties.ts` are additive; no existing caller
  is forced to adopt them this sprint (extraction-only; rewiring pages is out of scope).

---

## 5. UI changes

- Only `app/crm/casos/page.tsx` gains a `useUser()` hook call and passes a real identity
  string. No layout, copy, or visual change. No other UI changes.

---

## 6. Hard architectural call (flagged for the human)

The spec asks to assert `balance: 1000 - (300+200) = 500` and the penalty
`3-day flagged / 11-day not`. **These rules are not pure functions today** — balance is
computed inline inside multiple page components and the penalty window is expressed as a
Supabase date-range query in `app/dashboard/page.tsx:74-81` (`gte/lte` against
`hoyStr`/`limite10DiasStr`). To test them without browser/E2E we must introduce small
pure helpers (`lib/finance.ts`, `lib/penalties.ts`) and test those. **This sprint only
creates and tests the helpers; it does NOT rewire the pages to use them** (that is a
follow-up refactor with regression risk). Reviewers should know the helpers are the
canonical encoding of the rule, but the live pages still use their inline math until a
later sprint. If the human prefers the live pages be refactored to call the helpers now,
that expands scope and should be its own sprint. Calling this out per the anti-theater
rule rather than pretending the live code is already covered.

---

## 7. Edge cases

- **Empty states**: `sumarPagos([])` must return `0`; `calcularBalance(1000, [])` -> `1000`;
  `formatDateDMY(null|undefined|"")` -> `"N/A"`; `formatDateDMY("not-a-date")` -> `"N/A"`.
- **Penalty boundary**: exactly `5` days out is flagged (window is inclusive per
  dashboard `lte`); `0` days (today) flagged; negative (past due) — decide and lock:
  past-due IS flagged (still needs attention). `11` days NOT flagged; `6` days NOT
  flagged. Tests assert each boundary explicitly.
- **suplidor_id coercion**: `"0"`, `""`, `0` all -> `null`; `"5"` -> `5` (number);
  asserted on the object handed to the mocked `.insert`/`.update`.
- **Concurrent edits / realtime races**: the system uses optimistic-UI + a "saved
  locally but DB failed" toast (see `app/crm/casos/page.tsx:425-438`); there is no
  realtime subscription in the touched paths, so no realtime-race work this sprint.
  The crm test asserts the action returns `{success:false, error}` on a mocked DB error
  (rollback path is the existing toast; we do not change it).
- **Rollback-on-error**: the optimistic close in `casos/page.tsx` currently does NOT
  revert local state on DB failure — it only toasts. We are NOT changing that behavior
  this sprint (out of scope, would be a UI behavior change). Noted as backlog.
- **Mocked client error path**: every integration test includes a case where the mocked
  query returns `{ error: { message } }` and asserts `{ success:false, error }`.
- **Module-load safety**: `tests/supabase-client.test.ts` imports `lib/supabase.ts` and
  `lib/supabase-server.ts` with env vars unset to prove neither throws at import.

---

## 8. Test plan (commands that prove it works)

- `npm run typecheck` — must exit 0 (proves supabase.ts:25 fix and no type regressions).
- `npm run lint` — must exit 0 (proves eslint + eslint-config-next installed/configured).
- `npm run test` — `vitest run`, must exit 0, report >=11 files / >=40 cases.
- `npm run qa` — runs all three; must exit 0. **This is the gate.**
- Specific asserted facts (each a named test case):
  - `formatDateDMY(null) === "N/A"`; `formatDateDMY("2026-05-24") === "24-May-2026"`.
  - `calcularBalance(1000, [300,200]) === 500`; `sumarPagos([]) === 0`.
  - penalty: `estaEnVentanaPenalidad(today+3d) === true`; `(today+11d) === false`;
    boundary `+5d === true`, `+6d === false`.
  - `getSupabaseClient()` returns `null` (no throw) with env unset; returns object with
    env set.
  - provisional productos: `suplidor_id` `"0"` -> insert payload has `suplidor_id: null`.
  - `cerrarCasoAction(7, "Maria")` -> mocked update receives `cerrado_por: "Maria"` and
    the string `"Usuario Actual"` never appears in the payload.

---

## 9. Numbered task list

> Run order is strict: a task does not start until its dependencies PASS QA.

### Task 1 — Tooling: scripts + install test/lint deps
- **Owner**: senior-dev
- **Files in scope**: `package.json`, `vitest.config.ts` (new), `vitest.setup.ts` (new),
  `.eslintrc.json` (new), `.eslintignore` (new, only if needed)
- **DB/RLS**: none
- **Depends on**: none
- **Acceptance (PASS/FAIL)**:
  - `package.json` has `"typecheck": "tsc --noEmit"` and `"test": "vitest run"`. PASS/FAIL
  - `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`,
    `@testing-library/jest-dom`, `jsdom`, `eslint`, `eslint-config-next@14.2.25` present in devDeps. PASS/FAIL
  - `npx vitest run` executes (0 tests OK) without config error. PASS/FAIL
  - `npx eslint .` runs to completion (warnings allowed, must not crash on missing config). PASS/FAIL
  - `@/` alias resolves in `vitest.config.ts` (a throwaway `tests/_smoke.test.ts` importing `@/lib/utils` passes, then delete it). PASS/FAIL

### Task 2 — Fix `lib/supabase.ts` proxy type bug
- **Owner**: junior-dev
- **Files in scope**: `lib/supabase.ts`
- **DB/RLS**: none
- **Depends on**: Task 1
- **Acceptance**:
  - Line 25 no longer references `createBrowserClient`; uses `createSupabaseClient`. PASS/FAIL
  - `npm run typecheck` exits 0. PASS/FAIL
  - No runtime behavior change: `getSupabaseClient()` still returns `null` when env unset. PASS/FAIL
  - Diff touches only `lib/supabase.ts`. PASS/FAIL

### Task 3 — Make `lib/supabase-server.ts` lazy (no throw at import)
- **Owner**: senior-dev
- **Files in scope**: `lib/supabase-server.ts`
- **DB/RLS**: none
- **Depends on**: Task 1
- **Acceptance**:
  - Importing the module with `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` unset
    does NOT throw. PASS/FAIL
  - `supabaseServer` export still exists and is usable when env vars are set (lazy/Proxy). PASS/FAIL
  - `npm run typecheck` exits 0. PASS/FAIL
  - Diff touches only `lib/supabase-server.ts`. PASS/FAIL

### Task 4 — Fix `cerrarCasoAction` (Option A: pass `cerrado_por`) + call site
- **Owner**: senior-dev
- **Files in scope**: `app/actions/crm-actions.ts`, `app/crm/casos/page.tsx`
- **DB/RLS**: none
- **Depends on**: Task 1
- **Acceptance**:
  - `cerrarCasoAction(casoId, cerradoPor: string, comentarioCierre?)` — `cerrado_por` set
    from `cerradoPor`, no literal `"Usuario Actual"` remains in `crm-actions.ts`. PASS/FAIL
  - `app/crm/casos/page.tsx` imports `useUser`, passes a real identity to the action and
    to the optimistic object (line ~400); no `"Usuario Actual"` literal remains. PASS/FAIL
  - `npm run typecheck` exits 0. PASS/FAIL
  - No visual/layout change (diff is hook + argument only). PASS/FAIL
  - Diff touches only the two files. PASS/FAIL

### Task 5 — Create pure helpers `lib/finance.ts` and `lib/penalties.ts`
- **Owner**: senior-dev
- **Files in scope**: `lib/finance.ts` (new), `lib/penalties.ts` (new)
- **DB/RLS**: none
- **Depends on**: Task 1
- **Acceptance**:
  - `calcularBalance(1000,[300,200]) === 500`, `sumarPagos([]) === 0`. PASS/FAIL
  - `estaEnVentanaPenalidad(date+3d, today) === true`, `(date+11d) === false`,
    boundary `+5d === true`, `+6d === false`. PASS/FAIL
  - No Supabase import in either file (`grep` shows none). PASS/FAIL
  - `npm run typecheck` exits 0. PASS/FAIL

### Task 6 — Unit tests: utils + finance + penalties + supabase client
- **Owner**: junior-dev
- **Files in scope**: `tests/utils.test.ts`, `tests/finance.test.ts`,
  `tests/penalties.test.ts`, `tests/supabase-client.test.ts` (all new)
- **DB/RLS**: none
- **Depends on**: Tasks 2, 5
- **Acceptance**:
  - All four files pass under `vitest run`. PASS/FAIL
  - `formatDateDMY` null/valid/invalid cases asserted. PASS/FAIL
  - balance + penalty boundary cases asserted (per §8). PASS/FAIL
  - supabase null-without-throw + import-without-throw asserted. PASS/FAIL
  - Combined >= 15 test cases across the four files. PASS/FAIL

### Task 7 — Integration tests (mocked Supabase): clientes, suplidores, productos
- **Owner**: senior-dev
- **Files in scope**: `tests/clientes.actions.test.ts`, `tests/suplidores.actions.test.ts`,
  `tests/productos.actions.test.ts` (all new)
- **DB/RLS**: none
- **Depends on**: Tasks 1, 3
- **Acceptance**:
  - `crearSuplidorAction`/`actualizarSuplidorAction`/`crearProductoAction`/
    `actualizarProductoAction`/`actualizarClienteAction` happy + error paths asserted via
    mocked chainable client. PASS/FAIL
  - productos provisional: `suplidor_id "0" -> null` asserted on insert payload. PASS/FAIL
  - No real network; mock verified (no live Supabase call). PASS/FAIL

### Task 8 — Integration tests (mocked): reservas, pagos, crm, provisional workflows
- **Owner**: senior-dev
- **Files in scope**: `tests/reservas.provisional.test.ts`, `tests/pagos.provisional.test.ts`,
  `tests/crm.actions.test.ts`, `tests/provisional-system.test.ts` (all new)
- **DB/RLS**: none
- **Depends on**: Tasks 4, 7
- **Acceptance**:
  - reservas: `cliente_id`/`producto_id` `"0"` -> `null` asserted. PASS/FAIL
  - pagos: `crearPagoProvisional` create payload asserted. PASS/FAIL
  - crm: `cerrarCasoAction(id, "Maria")` payload has `cerrado_por: "Maria"`, never
    `"Usuario Actual"`; DB-error path returns `{success:false}`. PASS/FAIL
  - provisional: `aprobarCambio`/`rechazarCambio` happy + "Cambio no encontrado" path. PASS/FAIL

### Task 9 — Integration tests (mocked): facturacion, configuracion, audit/proyectos
- **Owner**: junior-dev
- **Files in scope**: `tests/facturacion.helpers.test.ts`, `tests/configuracion.actions.test.ts`,
  `tests/audit-logs.test.ts` (all new)
- **DB/RLS**: none
- **Depends on**: Task 7
- **Acceptance**:
  - `crearAccionPendiente` / `admin-actions` create path asserted (happy + error). PASS/FAIL
  - `obtenerRegistrosCompletos` asserts `.neq("estado_registro","ELIMINADO")` filter used. PASS/FAIL
  - facturacion file asserts at least one pure formatting/helper used by invoicing. PASS/FAIL
  - Total across all test files now >= 40 cases / >= 11 files. PASS/FAIL

### Task 10 — Full QA gate + findings report
- **Owner**: senior-dev
- **Files in scope**: none (verification only; report goes in transcript/test output)
- **DB/RLS**: none
- **Depends on**: Tasks 1-9
- **Acceptance**:
  - `npm run qa` exits 0 (paste full output). PASS/FAIL
  - `vitest run` summary shows >= 11 files and >= 40 passing cases. PASS/FAIL
  - Findings report lists each of the 4 fixed defects (supabase.ts:25, supabase-server
    eager env, crm-actions hardcoded user + missing useUser wiring, plus any defect
    surfaced while writing tests) with file:line, symptom, fix, and one-line rollback. PASS/FAIL
  - Confirms no files outside declared scope changed; no DB/RLS/schema change. PASS/FAIL

---

## 10. Rollback notes (per touched product file)

- `package.json`: revert scripts/devDeps block.
- `lib/supabase.ts`: restore `ReturnType<typeof createBrowserClient>` on line 25 (re-introduces the type bug — only if reverting the sprint).
- `lib/supabase-server.ts`: restore eager module-scope `createClient(...)`.
- `app/actions/crm-actions.ts`: restore 2-arg signature + `cerrado_por: "Usuario Actual"`.
- `app/crm/casos/page.tsx`: remove `useUser` import/call, restore `"Usuario Actual"` literal and 2-arg call.
- New files (`lib/finance.ts`, `lib/penalties.ts`, `vitest.config.ts`, `vitest.setup.ts`, `.eslintrc.json`, `tests/**`): delete.

---

## 11. Typecheck resolution decision

> Added after Sprint 1's test/bug-fix tasks completed. `npm run lint` and `npm run test`
> (140 tests) both exit 0; `npm run typecheck` exits 1 with **283 errors**, all in
> `app/**` and `lib/provisional-system.ts`, blocking the `qa` gate.

### Ground truth I re-verified in the real code (do not skip — it changes the answer)

I read the actual files rather than trusting the error-category labels in the request.
Findings that materially change the recommendation:

- **`tsconfig.json` already has `"skipLibCheck": true` AND `"strict": true`** (lines 6-7).
  So Option 4's "add `skipLibCheck`" is a no-op — it is already on and the 283 errors
  exist *with* it. The only lever left in Option 4 is flipping `strict` (or its
  sub-flags like `strictNullChecks`) to `false`.

- **The Supabase proxies are NOT typed as nullable.** `lib/supabase.ts:37`
  (`export const supabase = supabaseProxy`) and `lib/supabase-server.ts:26`
  (`supabaseServer`) are both `new Proxy({} as ReturnType<typeof createSupabaseClient>, ...)`
  — i.e. a **non-null** `SupabaseClient`. Files that do
  `import { supabase } from "@/lib/supabase"` (e.g. `app/pagos/page.tsx:12`,
  `app/crm/casos/page.tsx:27`, `app/facturacion/page.tsx:13`) get a non-null client and
  do **not** produce TS18047. The "possibly null" errors come from the *other* import
  style: `import { createClient } from "@/lib/supabase"` then
  `const supabase = createClient()` (e.g. `app/clientes/balance-reserva/page.tsx:78`,
  `app/page.tsx:48`, `app/pagos/buscar/page.tsx:14`, `app/admin/page.tsx:41`). Because
  `createClient = () => getSupabaseClient()` returns `SupabaseClient | null`
  (`lib/supabase.ts:34`, `:7-22`), every `.from(...)` on that local is TS18047. There
  are ~10 such files (Grep for `createClient()` in `app/`).

- **The `never`/TS2339 errors are NOT caused by a missing `<Database>` generic in the
  normal case.** I read `node_modules/@supabase/supabase-js/dist/module/index.d.ts:13`:
  `createClient`'s default is `Database = any`. With `Database = any`, the schema lookup
  is `any`, so `.from("pagos").select("*")` yields `data: any` — **no `never`**. The
  proxies are typed `ReturnType<typeof createSupabaseClient>` = `SupabaseClient<any,...>`,
  which is also `any`-level. So the dominant error population is the **TS18047 null**
  errors from the `createClient()` call sites, plus a tail of genuine local type
  mismatches (e.g. `useState` widening, payload-shape mismatches in
  `lib/provisional-system.ts`) — NOT a wholesale `never` from the client.

- **Critical correction to Option 2's premise.** `@supabase/postgrest-js/.../types.d.ts:55`
  defines `GenericSchema = { Tables: Record<string, GenericTable>; Views: ...; Functions: ... }`
  and `GenericTable = { Row: ...; Insert: ...; Update: ...; Relationships: [] }`.
  `createClient`'s return type does
  `Omit<Database,...>[Schema] extends GenericSchema ? ... : never`. A stub typed
  `{ [key: string]: any }` (as Option 2 literally proposes) **does NOT satisfy
  `GenericSchema`** (no `Tables`/`Views`/`Functions` keys of the right shape), so the
  conditional collapses to **`never`** — Option 2 as written would *introduce* the very
  `never` errors it claims to fix, and would do so across all 28 files at once. Option 2
  only works if the stub is *correctly shaped*
  (`{ public: { Tables: Record<string, { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any>; Relationships: [] }>; Views: ...; Functions: ... } }`).
  That is implementable but non-trivial and easy to get subtly wrong.

### Evaluation of the four options

#### Option 1 — Split the `qa` script (drop typecheck from the gate)
a) Changes `package.json` `qa` to `lint && test`; adds `qa:check` that includes
   `typecheck`. One-file, zero source edits.
b) **Does not resolve any of the 283 errors** — it hides them. `qa` goes green while
   `tsc` still fails.
c) Runtime risk: **zero** (no source touched). But it *weakens the gate*: the HARD GATES
   in CLAUDE.md require "the project's real test/lint/typecheck commands were RUN, with
   output shown". Removing typecheck from `qa` violates the spirit of that gate and lets
   real type bugs (including the genuine ones in `provisional-system.ts`) ship unseen.
d) **Reject as the sprint's primary fix.** It is anti-theater: making the gate pass by
   removing the failing check. Acceptable only as a *temporary, explicitly-approved*
   stopgap with a tracked follow-up — and that is a product/human decision, not an
   architect's unilateral call.

#### Option 2 — Stub `Database` type + wire the generic
a) Create `lib/database.types.ts` and pass it as `createSupabaseClient<Database>(...)`
   in both `lib/supabase.ts` and `lib/supabase-server.ts`.
b) **Does not resolve the TS18047 null errors at all** (those are about the *local*
   being `Client | null`, independent of the schema generic). And, as written with
   `[key: string]: any`, it **adds** `never` errors. Even with a correctly-shaped stub it
   only changes `any` -> `Record<string, any>` rows, which the current `any` already
   provides — so it buys almost nothing against the actual error population while adding
   surface area and risk.
c) Runtime risk: low-to-moderate. Type-only file, but touching both client modules (the
   most load-bearing files in the app, just fixed in Tasks 2-3) risks regressing them. A
   mis-shaped generic silently turns every query into `never`, which would cascade.
d) **Reject for this sprint.** High effort, high blast radius, does not address the
   majority (null) errors, and the literal proposal makes things worse. Schema-accurate
   generated types are the right *long-term* answer (see §11 fifth option), but not a
   single-task, no-schema-access fix.

#### Option 3 — Per-site `as any` / `@ts-ignore` across 28 files
a) Add a cast or ignore at each of the 283 sites.
b) **Fully resolves typecheck** (mechanically).
c) Runtime risk: zero at runtime, but it **destroys type safety at exactly the data-access
   layer** and would bury the *genuine* type bugs in `lib/provisional-system.ts` that
   typecheck is legitimately catching. 283 scattered edits across 28 files is also a huge,
   un-reviewable diff and a maintenance tarpit.
d) **Reject.** This is the textbook anti-theater move CLAUDE.md forbids ("Never write ...
   without evidence"; "RLS/type safety not weakened"). Blanket suppression hides real
   defects.

#### Option 4 — Relax strict mode
a) `skipLibCheck` is already true (no-op). The only real lever is `strict: false` or
   disabling `strictNullChecks`.
b) Turning off `strictNullChecks` would clear the TS18047 majority and likely most of the
   283; `strict:false` would clear essentially all of them.
c) Runtime risk: zero at runtime, but **masks real null/undefined bugs across the entire
   codebase**, including the new test-supporting code just written and the genuine
   `provisional-system.ts` issues. It is a global safety downgrade to fix a localized
   problem.
d) **Reject.** Disproportionate. We do not weaken a global compiler guarantee to fix a
   handful of call-site patterns.

### 1. Recommended option

**None of the four as stated. The correct fix is a fifth option (below): make the small
set of source patterns type-correct, the same way the codebase already fixed
`lib/supabase.ts` and `lib/supabase-server.ts` in Tasks 2-3.** The errors are dominated
by two mechanical, *legitimate* patterns plus a genuine-bug tail; the right response is to
satisfy the compiler honestly, not to disable, suppress, or stub it.

### 2. Fifth option I found in the code (RECOMMENDED)

**Option 5 — Targeted, honest source fixes following the conventions already in the repo.**
Concretely, three sub-patterns:

- **5a — Null-guard the `createClient()` call sites (the TS18047 majority).** The repo
  *already established the convention* for this: `lib/provisional-system.ts:27-31` wraps
  `createClient()` in `getSupabase()` that throws a clear Spanish error if null and
  returns a non-null client. Apply the same one-liner at each `app/**` call site:
  replace `const supabase = createClient()` with a guarded local
  (`const supabase = createClient(); if (!supabase) { /* toast + return */ }` or a shared
  `getSupabaseClient()` helper that throws). This mirrors existing code, preserves the
  null-safe runtime behavior, and is the minimal honest fix. ~10 files.
  *Even simpler and more consistent*: have those files use the non-null `supabase` proxy
  export (`import { supabase } from "@/lib/supabase"`) instead of
  `createClient()` — which is the pattern the *majority* of files already use
  (`app/pagos/page.tsx`, `app/crm/page.tsx`, etc.). That removes the null entirely with a
  one-line import change per file and zero behavior change (the proxy already throws the
  same error lazily). This is my preferred 5a variant: it makes the divergent files match
  the dominant existing convention.

- **5b — Fix the genuine type errors in `lib/provisional-system.ts`** that typecheck is
  correctly flagging (payload/`useState`/return-shape mismatches). These are real and
  must be fixed, not suppressed — they are exactly what the gate exists to catch.

- **5c — For any residual handful** that are true `any`-interop edges (e.g. `data` from a
  dynamic select), use a *narrow, commented* local type or a single localized cast at that
  one expression — never a file-wide `@ts-ignore`.

This is "Option 3 done honestly and minimally": instead of 283 blanket suppressions across
28 files, it is ~10 import/guard changes + a small number of real fixes, following the
repo's own `getSupabase()` precedent. It keeps `strict` on, keeps the `qa` gate intact,
and does not touch the DB, RLS, or runtime behavior.

If, after 5a, the remaining count is still large and concentrated in untyped-`.from()`
data access, the proper escalation is **generated** Supabase types
(`supabase gen types typescript`) committed to `lib/database.types.ts` and wired as the
`<Database>` generic — i.e. Option 2 done *correctly with real schema*. That requires
schema access and is therefore a **separate, later task**, explicitly out of this sprint's
no-schema-access constraint. Flagging it as the long-term direction.

### 3. Can Option 5 be done by a senior dev in a single task without schema access?

**Mostly yes, with one caveat that must be surfaced.**

- 5a (null guards / import-convention alignment) is purely mechanical, follows an existing
  in-repo pattern, needs no schema, and is verifiable by re-running `npm run typecheck`.
  Safely a single senior task.
- 5b/5c require reading the actual error list. The request asserts the 283 split as
  "all TS18047 + all TS2339-never", but my code reading shows the `never` story does not
  hold under `Database = any`; the real tail is a mix that **cannot be fully sized without
  running `tsc` and reading every error**. So the honest answer is:

> **This is a partially-unknown-size task and must not be promised as a clean one-pass
> fix.** A senior dev can confidently land 5a (the null majority) in one task. Whether the
> *remaining* errors after 5a fit in the same task depends on how many are genuine bugs vs.
> untyped-`.from()` interop. If a meaningful subset turns out to need real schema types to
> resolve correctly, the correct move is to STOP and surface to the human (per the
> workflow rule on forks in the road), proposing the generated-types follow-up — **not** to
> reach for Option 1/3/4 to force the gate green.

**Recommended task breakdown to add to the sprint** (do not collapse into one optimistic task):

- **Task 11 [senior]** — Run `tsc --noEmit`, capture the full 283-error list, and bucket
  every error by (file, rule, root-cause: null-guard / real-bug / untyped-interop).
  *Acceptance*: a committed bucket table; counts per bucket; explicit list of any error
  that needs schema types. PASS/FAIL. Depends on: Sprint-1 Tasks complete. No source edits.
- **Task 12 [senior]** — Apply 5a to the ~10 `createClient()` files (align to the non-null
  `supabase` proxy import or add the `getSupabase()`-style guard). *Acceptance*: those
  files' TS18047 errors gone; `npm run typecheck` error count drops by the 5a bucket size;
  diff limited to those files; no runtime/behavior change (proxy throws identically).
  PASS/FAIL. Depends on: Task 11.
- **Task 13 [senior]** — Fix the genuine `lib/provisional-system.ts` (and any other)
  real type bugs from the bug bucket. *Acceptance*: those errors resolved with real fixes
  (no `as any`/`@ts-ignore`); diff scoped to flagged files. PASS/FAIL. Depends on: Task 11.
- **Task 14 [senior]** — Resolve the residual interop tail with narrow local types; if any
  error genuinely requires generated schema types, STOP and surface to the human with the
  Option-2-with-real-schema proposal instead of suppressing. *Acceptance*: `npm run qa`
  (full, including typecheck) exits 0 **OR** a written escalation listing the exact errors
  that need schema access. PASS/FAIL. Depends on: Tasks 12, 13.

**Net recommendation:** Do **not** modify the `qa` gate (Option 1), blanket-suppress
(Option 3), stub the generic as-written (Option 2), or relax `strict` (Option 4). Fix the
source honestly (Option 5), starting with a bucketing pass so the human sees the true
shape of the 283 before any code changes, and escalate the genuine-schema subset rather
than forcing the gate green.
