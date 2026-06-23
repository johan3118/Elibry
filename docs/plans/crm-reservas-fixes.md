# Plan: CRM + Reservas Fixes (6 items)

Architect plan. Feature code authors are the senior-dev / junior-dev owners listed per task.
The architect only writes this file. QA command for every task: `npm run qa`
(`tsc --noEmit && eslint . && vitest run`, per `package.json`).

---

## Technical approach

All six items are bug fixes / small UI enhancements over existing client-rendered pages
that talk to Supabase through the singleton proxy in `lib/supabase.ts` (`supabase` /
`createClient()`). No new tables are needed; org isolation is N/A for new schema because no
schema is added. The codebase has **no RLS policies in any `scripts/*.sql`** (verified via
grep of `scripts/`), so the existing security posture is "RLS off" and we will NOT change
that — items 4/5 are therefore not RLS bugs. The render code for multiple `reserva_detalles`
is already correct on both `ver` and `editar`; items 4/5 are a **persistence / data**
problem, so the senior-dev must reproduce against the live DB before touching code. Items
1, 3, 6 are pure UI. Item 2 is a self-contained component swap using the already-installed
`cmdk` (`components/ui/command.tsx`) + `Popover` (`components/ui/popover.tsx`).

---

## Files involved (verified real paths)

- `app/crm/page.tsx` — CRM dashboard. Stat cards at lines 202-250 are static `<Card>` (not links).
- `app/crm/casos/page.tsx` — `filtroParam` read at line 134; `filtroAntiguedad` effect at lines 234-240; `filtroEstado` default `"ABIERTO"` line 139; estado filter at line 502; antigüedad values `normal/alerta/critico` at lines 717-719.
- `app/reservas/crear/page.tsx` — product `Select` at lines 703-714; detalle insert at lines 430-448 (admin), provisional path lines 480-518 (does NOT insert detalles).
- `app/reservas/editar/[id]/page.tsx` — product `Select` at lines 773-784; detalle load lines 160-202; admin delete+insert lines 519-553; provisional path lines 559-577 (does NOT insert detalles).
- `app/reservas/ver/[id]/page.tsx` — payments table header lines 599-607, rows 610-633; `detalles.map` render lines 668-707 (already loops all rows); `referencia` already in `Pago` interface (line 81) and selected via `select("*")` (line 163).
- `app/reservas/pendientes/page.tsx` — table header "Balance Reserva" line 968; balance cells lines 1020-1027; `balance_general` already computed line 261.
- `lib/supabase.ts` — `supabase` proxy + `createClient()`.
- `lib/provisional-system.ts` — provisional CRUD; `obtenerRegistrosCompletos` used by pendientes.
- `scripts/023-create-reserva-detalles-table-fixed.sql` — `reserva_detalles` DDL + `AFTER INSERT/UPDATE/DELETE FOR EACH ROW` trigger `recalcular_totales_reserva()` (lines 49-113) that overwrites `precio_total/pasajeros/habitaciones/balance_*` on the parent reserva.
- `scripts/050-add-provisional-fields-all-tables.sql` — confirms `reserva_detalles.estado_registro` exists, so the app's insert payloads (`estado_registro: "PERMANENTE"`) are valid columns.
- `components/ui/command.tsx`, `components/ui/popover.tsx` — available for the combobox.

---

## DB changes

**None planned.** No new tables, no new columns, no RLS changes (the repo ships with RLS
disabled and items 4/5 are not RLS-caused — confirmed by the absence of `CREATE POLICY` in
`scripts/`). If, and only if, the senior-dev's investigation in Task 4 proves the root cause
IS a DB-level defect (e.g. the `recalcular_totales_reserva` trigger interfering with batch
inserts, or a missing/incorrect constraint), that finding must be surfaced to the human as a
fork-in-the-road before any DDL is written. Do not silently add a migration.

---

## Root-cause note for Items 4 & 5 (read before coding)

The render code is NOT the bug:
- `ver` page already does `detalles.map(...)` over all loaded rows (lines 668-707).
- `editar` page already maps `detallesData` to `detallesServicios` and renders all (load lines 166-202, render line 906).
Both load with `.eq("reserva_id", reservaId).order("id")` — correct.

Therefore "only one shows" means **only one row is persisted** for the affected reservas.
Likely causes, in order of probability, to be confirmed by the senior-dev against the DB:
1. **Legacy/backfill data**: `scripts/023` seeded exactly ONE `Servicio Principal` row per
   pre-existing reserva (lines 121-144). Reservas created before multi-detalle support, or
   via the provisional path, have a single row by construction.
2. **Provisional (non-admin) path never inserts detalles at all** — `crear` lines 480-518 and
   `editar` lines 559-577 only write the parent `reservas` row. A non-admin reserva will show
   one synthesized row (ver fallback lines 733-755) or one stale row.
3. **Batch insert silently failing**: in both `crear` (line 448) and `editar` (line 544) the
   `reserva_detalles` insert error is swallowed (no throw; crear has no logging at all). A
   partial failure or the `recalcular_totales_reserva` trigger firing per-row could mask a
   problem. `editar`'s `delete().eq("reserva_id", reservaId)` uses a **string** `reservaId`
   while `crear` uses a numeric id — verify the delete actually matches and clears prior rows.

The senior-dev MUST identify which of these is real with evidence (a SQL `SELECT count(*)
... GROUP BY reserva_id` and a fresh reproduction) **before** changing code, and pick the
minimal fix. This is a genuine investigation task, not a one-line change. Do NOT assume.

---

## Edge cases to cover

- **Item 1**: clicking a stat card with 0 cases still navigates and shows the empty state
  (`casos/page.tsx` lines 746-751). Existing antigüedad params (`?filtro=normal|alerta|critico`)
  must still work — the new estado handling must not hijack them.
- **Item 2**: empty product list (combobox shows "no results"); long lists scroll; selected
  value persists across re-render; on `editar`, the pre-selected product must display its
  name on mount (value is the product id string from `formData.idLugar`).
- **Item 3**: `referencia` null → render `"N/A"` (matches existing `|| "N/A"` convention).
- **Item 4/5**: reserva with zero detalle rows must keep the existing fallback UI (ver lines
  733-755; editar lines 187-202). Do not crash on empty.
- **Item 6**: USD vs DOP reservas — "Balance Pendiente" should use `balance_general`
  regardless of currency; existing per-currency columns (Balance RD$ / Balance US$) stay.

---

## What must NOT be touched

- `lib/supabase.ts` (client/proxy), auth, `lib/user-context`.
- The provisional approval engine in `lib/provisional-system.ts` (except read-only inspection for item 4/5).
- RLS / DB security posture. No new `CREATE POLICY`, no disabling of anything.
- The payment-registration logic (`handleRegistrarPago`) and balance math in `pendientes` — item 6 only adds a display column; the underlying `balance_general` calc (line 261) stays.
- The cliente search dropdown on crear/editar (item 2 is only the **product** field).
- Existing antigüedad filter behavior on `casos`.

---

## Test plan

- Every task: run `npm run qa` and paste full output. Verdict must be PASS.
- Baseline note: the repo froze a TypeScript error baseline (commit `ce50d2a`, 283 errors).
  Each task must not INCREASE the error count; record the count before/after.
- Item-specific manual QA (document steps + result in the QA report):
  - **T1**: load `/crm`, click each of the 4 stat cards, assert URL `?filtro=ABIERTO|EN_PROCESO|CERRADO|TODOS` and that `casos` list pre-filters. Then load `/crm/casos?filtro=critico` and assert antigüedad filter still applies.
  - **T2**: on `/reservas/crear`, type in product field, assert real-time filtering, select one, submit-validate it saved `producto_id`. On `/reservas/editar/[id]`, assert the existing product shows selected on mount.
  - **T3**: on `/reservas/ver/[id]` with payments that have/lack `referencia`, assert column appears between Concepto and Registrado Por; null shows "N/A".
  - **T4 (investigation)**: SQL `SELECT reserva_id, count(*) FROM reserva_detalles GROUP BY reserva_id;` + reproduce. Document root cause with evidence. No code merge in this task.
  - **T5 (fix)**: create a reserva with 3 services as admin, then open ver + editar; assert all 3 render. Confirm count in DB.
  - **T6**: on `/reservas/pendientes`, assert header renamed to "Precio Total" and a new "Balance Pendiente" column shows `balance_general`; Balance RD$/US$ unchanged.

---

## Task list

### Task 1 — CRM stat cards become status-filter links
- **Owner**: junior-dev
- **Files in scope**:
  - `app/crm/page.tsx`
  - `app/crm/casos/page.tsx`
- **DB/RLS**: none
- **Depends on**: none
- **Description**:
  1. In `app/crm/page.tsx`, make the 4 stat cards (Total Casos, Abiertos, En Proceso, Cerrados; lines 202-250) clickable, mirroring the antigüedad cards' pattern (`onClick={() => router.push("/crm/casos?filtro=...")}` + `cursor-pointer hover:` classes). Map: Total → `?filtro=TODOS`, Abiertos → `?filtro=ABIERTO`, En Proceso → `?filtro=EN_PROCESO`, Cerrados → `?filtro=CERRADO`.
  2. In `app/crm/casos/page.tsx`, extend the `filtroParam` effect (lines 234-240) so that when the param is one of `ABIERTO|EN_PROCESO|CERRADO` it sets `filtroEstado` to that value (and leaves `filtroAntiguedad` as TODOS); when it is `normal|alerta|critico` keep the existing behavior (set `filtroAntiguedad`, set `filtroEstado="TODOS"`); when `TODOS`/empty, set `filtroEstado="TODOS"`.
- **Acceptance criteria (PASS/FAIL)**:
  - Clicking each of the 4 stat cards navigates to `/crm/casos` with the correct `?filtro=` value. PASS/FAIL.
  - On `casos`, `?filtro=ABIERTO|EN_PROCESO|CERRADO` pre-sets the Estado filter to that status and the list shows only those cases. PASS/FAIL.
  - `?filtro=normal|alerta|critico` still filters by antigüedad exactly as before (no regression). PASS/FAIL.
  - TS error count not increased vs baseline (283). PASS/FAIL.

### Task 2 — Searchable product combobox on crear + editar
- **Owner**: junior-dev
- **Files in scope**:
  - `app/reservas/crear/page.tsx`
  - `app/reservas/editar/[id]/page.tsx`
- **DB/RLS**: none
- **Depends on**: none
- **Description**: Replace the plain product `Select` (crear lines 703-714, editar lines 773-784) with a searchable combobox built from the existing `Popover` + `Command` (`cmdk`) components. Keep the same state contract: value is `formData.idLugar` (product id as string), updated via `handleInputChange("idLugar", value)`. The trigger must display the selected product's `nombre_producto (tipo)`; the list filters by `nombre_producto`/`tipo` as the user types. On `editar`, the pre-loaded `formData.idLugar` must resolve to the product name on mount. Do not change the cliente search field.
- **Acceptance criteria (PASS/FAIL)**:
  - Typing filters the product list in real time. PASS/FAIL.
  - Selecting a product stores its id in `formData.idLugar`; submitting saves correct `producto_id`. PASS/FAIL.
  - On `editar`, the existing product is shown selected when the page loads. PASS/FAIL.
  - Empty/long lists handled (no crash, scrolls). PASS/FAIL.
  - TS error count not increased vs baseline (283). PASS/FAIL.

### Task 3 — Add "Referencia" column to payments history on ver
- **Owner**: junior-dev
- **Files in scope**:
  - `app/reservas/ver/[id]/page.tsx`
- **DB/RLS**: none (data already selected via `select("*")`; `referencia` in `Pago` interface line 81)
- **Depends on**: none
- **Description**: In the payments table, add a `Referencia` header between "Concepto" (line 604) and "Registrado Por" (line 605), and a matching cell between the Concepto cell (line 620) and Registrado Por cell (line 621) rendering `pago.referencia || "N/A"`.
- **Acceptance criteria (PASS/FAIL)**:
  - "Referencia" header appears between Concepto and Registrado Por. PASS/FAIL.
  - Each row shows `referencia`, or "N/A" when null. PASS/FAIL.
  - No other column shifted incorrectly; table still renders. PASS/FAIL.
  - TS error count not increased vs baseline (283). PASS/FAIL.

### Task 4 — Investigate why only one reserva_detalle persists (root cause, no code merge)
- **Owner**: senior-dev
- **Files in scope** (read-only investigation; output is a written finding, plus at most a throwaway repro):
  - `app/reservas/crear/page.tsx`
  - `app/reservas/editar/[id]/page.tsx`
  - `app/reservas/ver/[id]/page.tsx`
  - `lib/provisional-system.ts`
  - `scripts/023-create-reserva-detalles-table-fixed.sql`
  - `scripts/050-add-provisional-fields-all-tables.sql`
- **DB/RLS**: investigation may run read-only SQL against the live DB. No DDL in this task.
- **Depends on**: none
- **Description**: Determine, with evidence, why ver/editar show a single service. Run
  `SELECT reserva_id, count(*) FROM reserva_detalles GROUP BY reserva_id ORDER BY 2 DESC;`
  and reproduce by creating a multi-service reserva as admin and as a normal (provisional)
  user. Confirm whether: (a) batch insert at crear line 448 / editar line 544 silently fails,
  (b) the `recalcular_totales_reserva` trigger interferes, (c) editar's `delete().eq("reserva_id", reservaId)` (string id) fails to clear old rows, or (d) it's purely legacy/provisional data with one row. Produce a one-paragraph root-cause statement and the exact minimal fix for Task 5. If the fix requires DDL (e.g. trigger change), STOP and surface to the human.
- **Acceptance criteria (PASS/FAIL)**:
  - A written root-cause statement backed by evidence. PASS/FAIL.
  - A specific, minimal proposed fix scoped to Task 5 (or an explicit human escalation if DDL is required). PASS/FAIL.
  - No source files changed in this task (investigation only). PASS/FAIL.

### Task 5 — Fix multi-service persistence (ver + editar render all rows)
- **Owner**: senior-dev
- **Files in scope** (final scope confirmed by Task 4; default expectation below):
  - `app/reservas/crear/page.tsx`
  - `app/reservas/editar/[id]/page.tsx`
  - (only if Task 4 proves it) `app/reservas/ver/[id]/page.tsx`
- **DB/RLS**: none unless Task 4 escalated a DDL fix (then human sign-off first).
- **Depends on**: Task 4
- **Description**: Implement the minimal fix identified in Task 4. Expected default fix
  (subject to Task 4 findings): surface the swallowed `reserva_detalles` insert error in
  crear (line 448) and editar (line 544) so failures are no longer hidden, and ensure the
  insert/delete actually persists every row. Any write that the app does optimistically must
  roll back / show an error toast on failure. Do NOT change the parent-reserva balance math.
- **Acceptance criteria (PASS/FAIL)**:
  - Creating a reserva with 3 services as admin persists 3 `reserva_detalles` rows. PASS/FAIL.
  - `/reservas/ver/[id]` renders all 3 services. PASS/FAIL.
  - `/reservas/editar/[id]` pre-loads all 3 service rows. PASS/FAIL.
  - A failed detalle insert now produces an error toast (no silent success). PASS/FAIL.
  - No regression to single-service or zero-detalle (fallback UI) reservas. PASS/FAIL.
  - TS error count not increased vs baseline (283). PASS/FAIL.

### Task 6 — Balance columns on pendientes list
- **Owner**: junior-dev
- **Files in scope**:
  - `app/reservas/pendientes/page.tsx`
- **DB/RLS**: none (`balance_general` already computed at line 261)
- **Depends on**: none
- **Description**: Rename the table header "Balance Reserva" (line 968, currently a
  `SortableTableHeader` with `field="balance_reserva"`) to "Precio Total" (keep the same sort
  field). Add a new "Balance Pendiente" column showing `formatCurrency(reserva.balance_general, reserva.moneda)`; place it adjacent to the precio-total column and add the matching `<TableCell>` in the row body (the body maps at line 993; balance cells are lines 1020-1027). Leave "Balance RD$" (line 969/1021) and "Balance US$" (line 970/1024) unchanged. Ensure header/body column counts stay aligned.
- **Acceptance criteria (PASS/FAIL)**:
  - Header reads "Precio Total" (was "Balance Reserva"); sorting on that column still works. PASS/FAIL.
  - New "Balance Pendiente" column renders `balance_general` per row. PASS/FAIL.
  - "Balance RD$" and "Balance US$" columns unchanged. PASS/FAIL.
  - Header and body cell counts match (no shifted columns). PASS/FAIL.
  - TS error count not increased vs baseline (283). PASS/FAIL.

---

## Rollback

Each task is a self-contained diff on 1-2 files; revert that task's commit. Task 5 may also
require reverting a DB change only if the human approved one in Task 4 — that revert script
must be provided with the migration if it ever happens.

## Sequencing

T1, T2, T3, T6 are independent (any order). T4 must precede T5. No task may
start until the prior task it depends on has a QA report with Verdict: PASS, per CLAUDE.md
workflow rules.
