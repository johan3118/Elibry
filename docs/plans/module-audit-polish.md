# Plan: Module Audit & Polish (Clientes, Suplidores, Productos, Reservas, Pagos, CRM/Casos)

Status: Approved spec, ready for implementation.
Author: Architect
QA command (verbatim from package.json): `npm run qa` (= `tsc --noEmit && eslint . && vitest run`)

---

## Technical approach (1 paragraph)

This is a pure front-end polish sprint: no DB schema, no RLS, no migrations, no
Supabase server-side changes. Three classes of change: (1) normalize list-page
status-filter defaults so each list opens on its "active" workflow value and the
"Limpiar Filtros" button restores that same value (not ALL/todos); (2) route every
date display in the in-scope view/list pages through the existing `formatDateDMY`
helper in `lib/utils.ts` (DD-MMM-YYYY, Spanish abbreviations) instead of ad-hoc
`new Date(...).toLocaleDateString/toLocaleString`; (3) create the missing
`app/pagos/editar/page.tsx` edit form, mirroring the established edit-page pattern
(`app/suplidores/editar/page.tsx`): a `useSearchParams` `?id=` lookup, `formData`
state pre-filled from the row, a direct `supabase.from("pagos").update(...)`, toast
on success/error, and redirect to `/pagos`. All writes that touch persisted data are
direct Supabase `.update()` on an existing table; org isolation is already enforced
by existing RLS on `pagos` (unchanged), so no policy work is required.

---

## File map

### Create
- `app/pagos/editar/page.tsx` — new client component edit form for a `pagos` row
  (read by `?id=`, update via Supabase, toast + redirect to `/pagos`). A
  `loading.tsx` stub already exists at `app/pagos/editar/loading.tsx` and stays as-is.

### Edit — Filter defaults (Task area A + D)
- `app/suplidores/page.tsx`
  - `statusFilter` initial `"activo"` -> `"ACTIVO"`.
  - filter comparison `suplidor.status?.toLowerCase() === statusFilter` ->
    direct uppercase comparison `suplidor.status === statusFilter` (and the
    `<SelectItem value="activo">`/`"inactivo"` values -> `"ACTIVO"`/`"INACTIVO"`,
    keeping `"todos"` for the all option to match the existing empty-state check
    on line 263).
  - No "Limpiar Filtros" button exists here; none to fix.
- `app/productos/page.tsx`
  - `filterStatus` initial `"ALL"` -> `"ACTIVO"`.
  - "Limpiar Filtros" onClick currently sets `setFilterStatus("ALL")` -> `"ACTIVO"`.
- `app/reservas/page.tsx`
  - `filterStatus` initial `"ALL"` -> `"PENDIENTE"` (active workflow value; field is
    `reserva.status`, options already include `PENDIENTE`).
  - "Limpiar Filtros" onClick `setFilterStatus("ALL")` -> `"PENDIENTE"`.
  - (Also gets a date fix in Task area B — see below.)
- `app/pagos/page.tsx`
  - `statusFilter` initial `"todos"` -> `"CONFIRMADO"`.
  - filter comparison `pago.estado.toLowerCase() === statusFilter` -> direct
    uppercase comparison `pago.estado === statusFilter`; `<SelectItem>` values
    `"confirmado"/"pendiente"/"procesado"/"cancelado"` -> uppercase
    `"CONFIRMADO"/"PENDIENTE"/"PROCESADO"/"CANCELADO"`. Keep `"todos"` as the
    all-option value (referenced by the empty-state text on line 249).
  - No "Limpiar Filtros" button exists here; none to fix.
- `app/reservas/seguimiento/page.tsx`
  - `filtroEstado` initial `"TODOS"` -> `"ABIERTO"`.
  - "Limpiar Filtros" onClick `setFiltroEstado("TODOS")` -> `"ABIERTO"`.
  - Remove `PENDIENTE_RESPUESTA` from the `estado` union type (line 41), from the
    `<SelectItem value="PENDIENTE_RESPUESTA">` option (line 731), from the
    `getEstadoColor` switch (lines 422-423), from the fallback record on line 96
    (`fallbackCasos[2].estado` -> change to `"EN_PROCESO"`), and remove the
    "Pendiente Respuesta" stats card (lines 672-687). This aligns it with
    `app/crm/casos/page.tsx`, which already dropped PENDIENTE_RESPUESTA.

### Confirm only — no change expected (Task area A)
- `app/crm/casos/page.tsx` — `filtroEstado` initial is already `"ABIERTO"`
  (line 140); union already `ABIERTO | EN_PROCESO | CERRADO`; no PENDIENTE_RESPUESTA.
  No code change. Confirm in QA.
- `app/clientes/page.tsx` — `filterStatus` initial is already `"ACTIVO"` (line 24);
  "Limpiar Filtros" already resets to `"ACTIVO"` (line 213). No code change.
  Confirm in QA.

### Edit — Date normalization (Task area B)
Each file replaces its local date formatter(s) with `formatDateDMY` from
`@/lib/utils` (add the import where missing). Note `formatDateDMY` takes a single
string and returns DD-MMM-YYYY; it does not render time. For the pages that
currently show a time component via `formatDateTime` (system/audit timestamps), the
spec mandates DD-MMM-YYYY, so those displays drop the time and call `formatDateDMY`.
- `app/clientes/ver/page.tsx` — replace local `formatDate` (toLocaleDateString,
  lines 70-76) and `formatDateTime` (toLocaleString, lines 78-86); add import; both
  call sites (`fecha_nacimiento`, `fecha_creado`, `fecha_editado`) -> `formatDateDMY`.
- `app/suplidores/ver/page.tsx` — replace local `formatDateTime` (toLocaleString,
  lines 90-98); add import; both call sites (`fecha_creado`, `fecha_editado`) ->
  `formatDateDMY`.
- `app/productos/ver/page.tsx` — replace local `formatDate` (toLocaleDateString
  with time, lines 94-103); add import; call sites (`fecha_creado`,
  `fecha_editado`) -> `formatDateDMY`. Keep its `"No especificado"` empty handling
  by guarding before the call if desired, but `formatDateDMY` already returns "N/A"
  for empty input (acceptable).
- `app/pagos/ver/page.tsx` — replace local `formatDate` (lines 145-151) and
  `formatDateTime` (lines 153-161); add import; call sites (`creado_en`,
  `editado_en`) -> `formatDateDMY`.
- `app/reservas/page.tsx` — replace local `formatDate` (lines 66-69, uses
  `toLocaleDateString("es-DO")`); add import; call site (`fecha_entrada` /
  `fecha_creado`) -> `formatDateDMY`. (This file also gets the Task-A filter fix; do
  both in the same task to keep one diff per file.)
- `app/reservas/ver/[id]/page.tsx` — the local `formatDate` (lines 244-256) already
  emits DD-MMM-YYYY with Spanish months but uses local-time `getDate/getMonth`
  rather than the UTC-safe util; replace `formatDate` body to delegate to
  `formatDateDMY` (add import). Replace `formatDateTime` (lines 258-271,
  toLocaleString) to also delegate to `formatDateDMY` (time is dropped per spec).
  Do NOT touch the currency `toLocaleString("en-US", ...)` calls (lines 1010+).
- `app/reservas/editar/[id]/page.tsx` — grep shows only currency
  `toLocaleString("en-US", ...)` usages (lines 1010-1054), no date formatter.
  VERIFY during the task: if there is no date display via toLocale*, this file needs
  NO change and is confirm-only. (Listed in spec as "verify and fix if needed".)

---

## DB changes

None. No new tables, columns, views, or migrations. The `pagos` table is used
as-is. **RLS:** unchanged; no table is created, so no new policy is required, and
no existing policy is weakened. The new edit page performs a standard authenticated
`update` against `pagos`, governed by the table's existing RLS.

---

## API / service changes

None. No server actions added (registrar uses direct `supabase` for admin and a
provisional helper for non-admin; the spec explicitly says the pagos edit form uses
a plain Supabase update with **no** provisional workflow, so it calls
`supabase.from("pagos").update(...)` directly from the client, consistent with how
`app/pagos/ver/page.tsx` and `app/pagos/page.tsx` already query `pagos` client-side).

---

## UI changes

- List pages open pre-filtered to the active workflow state (Suplidores ACTIVO,
  Productos ACTIVO, Reservas PENDIENTE, Pagos CONFIRMADO, Seguimiento ABIERTO).
  "Limpiar Filtros" (where present) resets to that same value, not ALL.
- All in-scope date displays render DD-MMM-YYYY (e.g. `24-May-2026`).
- New `/pagos/editar?id=...` page: a form mirroring the suplidores edit layout
  (header with back button, cards, Cancelar / Guardar buttons), pre-filled from the
  row, success toast + redirect to `/pagos`.
- Seguimiento loses the "Pendiente Respuesta" stat card and filter option.

---

## Edge cases

- **Empty states:** Keep the `"todos"`/`"TODOS"` ALL option in every Select so a
  user can still widen the view; do not delete it. The Suplidores and Pagos
  empty-state strings reference `statusFilter !== "todos"`/`!== "todos"` — keep the
  ALL sentinel as the lowercase `"todos"` so those checks stay valid; only the
  active-state value changes to uppercase.
- **No matching rows on mount:** with a default of e.g. PENDIENTE, a list with zero
  pending rows shows the existing "No se encontraron..." empty block — acceptable
  and expected; the user can pick ALL.
- **Pagos `estado` value mismatch (RISK — see Hard calls):** the codebase disagrees
  on `pagos.estado` values; default of `"CONFIRMADO"` is per spec but may show an
  empty list if real rows use a different value. Flagged below; implementer must
  spot-check live data and report.
- **pagos/editar concurrent edits:** last-write-wins on a single `update`; no
  optimistic UI is used here (form submits, awaits, then redirects), so there is no
  optimistic state to roll back. On Supabase error, show a destructive toast and
  stay on the page (do not redirect) so the user can retry — this IS the rollback.
- **pagos/editar missing/invalid `?id=`:** render a "Pago no encontrado" fallback
  with a button back to `/pagos`, mirroring `app/suplidores/editar/page.tsx`.
- **Realtime:** none of these pages use Supabase realtime subscriptions; loads are
  one-shot `useEffect` fetches. No realtime race to handle.
- **Optimistic UI / rollback:** the only data-writing task (C) is non-optimistic by
  design. The existing CRM close-case optimistic flow is NOT in scope and must not
  be touched.

---

## What must NOT be touched

- No Proyectos pages (`app/proyectos/**`).
- No Configuracion pages (`app/configuracion/**`).
- The `formatDateDMY` function in `lib/utils.ts` itself (use it, don't edit it).
- Any DB schema / RLS / Supabase migration / server action.
- `app/clientes/page.tsx` and `app/crm/casos/page.tsx` filter defaults (confirm
  only; expected to already be correct — do not "improve" them).
- Currency `toLocaleString("en-US", ...)` calls in reservas pages (those are money,
  not dates).
- The CRM/Casos optimistic close-case logic and its `cerrarCasoAction` server action.
- `app/pagos/editar/loading.tsx` (leave the stub).

---

## Test plan

There is no component test harness wired for these pages; the gate is the project
QA command plus manual verification. For every task:
1. Run `npm run qa` and paste full output. It MUST pass typecheck + lint + tests.
   (Baseline: repo froze a TypeScript error baseline at 283 errors in commit
   ce50d2a; the implementer must confirm the task introduces ZERO new tsc errors
   versus that baseline, and zero new eslint errors.)
2. Manual smoke (dev server, `npm run dev`):
   - A: open each list page; confirm the status Select shows the active value on
     first paint and the list is filtered to it; click "Limpiar Filtros" (where it
     exists) and confirm it returns to the active value, not ALL.
   - B: open each view page for a record that has dates; confirm every date reads
     `DD-MMM-YYYY` with Spanish month abbreviation and no time component.
   - C: from `/pagos`, navigate to `/pagos/editar?id=<real id>`; confirm fields
     pre-fill, edit a field, save, confirm success toast and redirect to `/pagos`,
     and confirm the change persisted (reopen). Try a bad `?id=`; confirm the
     not-found fallback. Force an error (e.g. temporarily invalid value) and confirm
     a destructive toast and that the page does NOT redirect.
   - D: open `/reservas/seguimiento`; confirm no "Pendiente Respuesta" card or
     filter option remains and the page compiles/renders.
3. Per HARD GATES: paste the real diff, confirm no out-of-scope files changed,
   include a one-line rollback note (`git checkout -- <file>` for the task's files,
   or `rm app/pagos/editar/page.tsx` for Task C).

---

## Numbered task list

Ordering: independent file-scoped tasks; Task 7 (pagos edit page) is the only
[senior] task. Tasks 1-6 are [junior]. No task depends on another except that
Task 5 and Task 2 both touch `app/reservas/page.tsx` — they are MERGED into one
task (Task 2) to keep a single diff per file. Likewise pagos list filter + the
pagos `estado` value question are merged into Task 4.

### Task 1 — Suplidores list: status default + uppercase comparison [junior]
- Owner: junior-dev
- Files in scope: `app/suplidores/page.tsx`
- Depends on: none
- Changes: `statusFilter` initial `"activo"` -> `"ACTIVO"`; change filter compare
  to direct uppercase (`suplidor.status === statusFilter`); change SelectItem values
  `activo`/`inactivo` -> `ACTIVO`/`INACTIVO`; keep `"todos"` ALL option.
- Acceptance criteria (PASS/FAIL):
  - On mount the Estado Select displays "Activo" and the table shows only ACTIVO
    suplidores. PASS if true.
  - Selecting "Inactivo" filters to INACTIVO rows; selecting "Todos los estados"
    shows all. PASS if both true.
  - `npm run qa` passes with zero new tsc/eslint errors vs baseline. PASS if true.

### Task 2 — Reservas list: status default to PENDIENTE + date via formatDateDMY [junior]
- Owner: junior-dev
- Files in scope: `app/reservas/page.tsx`
- Depends on: none
- Changes: `filterStatus` initial `"ALL"` -> `"PENDIENTE"`; "Limpiar Filtros" reset
  `"ALL"` -> `"PENDIENTE"`; add `import { formatDateDMY } from "@/lib/utils"`;
  replace local `formatDate` (toLocaleDateString) body to delegate to
  `formatDateDMY`.
- Acceptance criteria:
  - On mount the Estado Select shows "PENDIENTE" and the list is filtered to it.
  - "Limpiar Filtros" returns Estado to "PENDIENTE" (not "Todos"). PASS if true.
  - The Fecha column renders DD-MMM-YYYY (e.g. `24-May-2026`). PASS if true.
  - `npm run qa` passes, zero new errors. PASS if true.

### Task 3 — Productos list: status default to ACTIVO [junior]
- Owner: junior-dev
- Files in scope: `app/productos/page.tsx`
- Depends on: none
- Changes: `filterStatus` initial `"ALL"` -> `"ACTIVO"`; "Limpiar Filtros" reset
  `"ALL"` -> `"ACTIVO"`. (Date display here already uses `formatDateDMY` — no date
  change needed; confirm.)
- Acceptance criteria:
  - On mount Estado Select shows "ACTIVO" and list filtered to ACTIVO.
  - "Limpiar Filtros" returns Estado to "ACTIVO" (not "Todos los estados").
  - `npm run qa` passes, zero new errors. PASS if true.

### Task 4 — Pagos list: status default + uppercase comparison [junior]
- Owner: junior-dev
- Files in scope: `app/pagos/page.tsx`
- Depends on: none
- Changes: `statusFilter` initial `"todos"` -> `"CONFIRMADO"`; change compare to
  direct uppercase (`pago.estado === statusFilter`); uppercase the SelectItem values
  to `CONFIRMADO/PENDIENTE/PROCESADO/CANCELADO`; keep `"todos"` ALL option.
- Acceptance criteria:
  - On mount Estado Select shows "Confirmado"; comparison is case-exact against
    `pago.estado`. PASS if true.
  - "Todos los estados" shows all pagos. PASS if true.
  - Implementer reports (in QA notes) the DISTINCT real values of `pagos.estado`
    observed in dev data, and whether the CONFIRMADO default yields a non-empty list;
    if real data uses a different active value, STOP and surface to architect before
    overriding the spec. PASS = report included.
  - `npm run qa` passes, zero new errors. PASS if true.

### Task 5 — Seguimiento: default ABIERTO + drop PENDIENTE_RESPUESTA [junior]
- Owner: junior-dev
- Files in scope: `app/reservas/seguimiento/page.tsx`
- Depends on: none
- Changes: `filtroEstado` initial `"TODOS"` -> `"ABIERTO"`; "Limpiar Filtros" reset
  `"TODOS"` -> `"ABIERTO"`; remove `PENDIENTE_RESPUESTA` from the `estado` union
  (line 41), the SelectItem option (line 731), the `getEstadoColor` case (422-423),
  the "Pendiente Respuesta" stats card (672-687); fix `fallbackCasos[2].estado`
  (line 96) `"PENDIENTE_RESPUESTA"` -> `"EN_PROCESO"`.
- Acceptance criteria:
  - On mount Estado Select shows "Abierto" and list filtered to ABIERTO.
  - No "Pendiente Respuesta" card or Select option is present anywhere on the page.
  - "Limpiar Filtros" returns Estado to "Abierto". PASS if true.
  - `npm run qa` passes, zero new errors (the removed union member must not leave a
    dangling reference). PASS if true.

### Task 6 — Date normalization on view pages [junior]
- Owner: junior-dev
- Files in scope: `app/clientes/ver/page.tsx`, `app/suplidores/ver/page.tsx`,
  `app/productos/ver/page.tsx`, `app/pagos/ver/page.tsx`,
  `app/reservas/ver/[id]/page.tsx`, `app/reservas/editar/[id]/page.tsx`
- Depends on: none (separate files from Tasks 1-5; reservas list date is in Task 2)
- Changes: in each file add `import { formatDateDMY } from "@/lib/utils"` (if not
  present) and route all date displays through it, dropping `toLocaleDateString`/
  `toLocaleString` for dates. For `app/reservas/editar/[id]/page.tsx`: VERIFY first —
  if it has no date toLocale* usage (grep shows only currency en-US usages), make NO
  change and note it as confirm-only in QA. Do NOT change currency `toLocaleString`.
- Acceptance criteria:
  - Every date field on clientes/ver, suplidores/ver, productos/ver, pagos/ver,
    reservas/ver renders DD-MMM-YYYY with Spanish month abbreviation and no time.
    PASS if visually confirmed on a record with dates.
  - No currency value formatting changed (amounts still show 2 decimals / en-US).
  - reservas/editar either unchanged (confirm-only, documented) or only its date
    display changed. PASS if true.
  - `npm run qa` passes, zero new errors. PASS if true.

### Task 7 — Create /pagos/editar page [senior]
- Owner: senior-dev
- Files in scope: `app/pagos/editar/page.tsx` (new)
- Depends on: Task 4 (so the list's edit path/value conventions are settled) — soft
  dependency; can be built in parallel but QA after Task 4.
- Reference pattern: `app/suplidores/editar/page.tsx` (structure) and
  `app/pagos/ver/page.tsx` + `app/pagos/registrar/page.tsx` (column names).
- Changes: new client component that:
  - reads `?id=` via `useSearchParams`;
  - fetches `supabase.from("pagos").select("*").eq("id", id).single()`;
  - shows loading and "Pago no encontrado" fallback (mirror suplidores/editar);
  - pre-fills editable fields. Editable column set (confirmed from
    `pagos/registrar` insert + `pagos/ver` interface): `monto`, `metodo_pago`,
    `referencia`, `fecha_pago`, `concepto`, `notas`, `estado`. (The active status
    column is `estado`, NOT `status` — confirmed: list, ver, and registrar all
    write/read `estado`.) Do NOT make `reserva_id`/`cliente_id` editable (show
    read-only).
  - saves via `supabase.from("pagos").update({ ...fields, fecha_editado /
    editado_en?, editado_por }).eq("id", id)` — use `editado_en` + `editado_por`
    only if present on the row/interface (`pagos/ver` interface has `editado_en?`
    and `editado_por?`); set them on update;
  - on success: `useToast` success toast then `router.push("/pagos")`;
  - on error: destructive toast, no redirect (stay for retry).
- Acceptance criteria:
  - Navigating `/pagos/editar?id=<real id>` pre-fills all listed fields from the row.
    PASS if all match the DB row.
  - Editing a field and saving shows a success toast and redirects to `/pagos`; the
    change persists on reopen. PASS if true.
  - The update writes to `estado` (not `status`); verify the saved row's `estado`
    column reflects the chosen value. PASS if true.
  - Bad/missing `?id=` shows the not-found fallback with a back-to-pagos button.
  - A forced Supabase error shows a destructive toast and the page does NOT redirect.
    PASS if true (this is the rollback path).
  - No provisional-workflow call is used (no `crearPagoProvisional` / no
    `cambios_provisionales`). PASS if true.
  - `npm run qa` passes, zero new errors. PASS if true.

---

## Hard architectural calls (surfaced to human)

1. **`pagos.estado` has no single source of truth in the code.** Observed values
   across the codebase: the list page treats `"CONFIRMADO"`/`"PENDIENTE"` as the
   meaningful states (stat cards lines 183/196); `pagos/ver` badge logic handles
   `"COMPLETADO"`/`"PENDIENTE"`/`"CANCELADO"`; `pagos/registrar` inserts
   `estado: "ACTIVO"` (or `"ANULADO"`). The spec instructs defaulting the list
   filter to `"CONFIRMADO"`. This is internally inconsistent and may render an empty
   list against real data. Decision taken: follow the spec (`"CONFIRMADO"`) but
   REQUIRE the implementer (Task 4) to report the actual distinct `estado` values
   from live/dev data; if they don't include `"CONFIRMADO"`, the implementer must
   stop and surface to the architect/human rather than silently changing the spec
   value. A future cleanup (canonicalizing the pagos status vocabulary + the
   registrar insert) is OUT OF SCOPE for this sprint and goes to backlog.

Everything else in this spec is mechanical and low-risk.

---

## One-line rollback (per task)
- Tasks 1-6: `git checkout -- <the task's file(s)>`.
- Task 7: `rm app/pagos/editar/page.tsx`.
