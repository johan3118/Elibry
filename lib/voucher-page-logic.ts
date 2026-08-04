/**
 * Pure logic lifted out of app/facturacion/voucher/page.tsx.
 *
 * WHY IT LIVES HERE AND NOT IN THE PAGE: Next generates a per-route type in
 * `.next/types` asserting that a page module exports NOTHING but `default` and
 * the framework's own reserved names. A page that also exports a helper makes
 * `tsc --noEmit` fail once a build has run — which collided head-on with this
 * repo's own testing pattern of extracting a pure function out of a page and
 * unit-testing it. The pattern is right; the location was wrong.
 *
 * Nothing below changed behaviourally in the move: same names, same
 * signatures, same bodies, same doc comments.
 */
import type { DetalleReservaParaVoucher } from "@/app/actions/documentos-actions"

/**
 * The minimal shape derivarTelefonoHotel needs from a `productos` row. The
 * page's own richer `Producto` interface satisfies it structurally.
 */
export interface ProductoTelefonos {
  id: number
  telefonos_json?: string[] | null
}

/**
 * The exact column list `fetchReservas` requests from `productos` —
 * pulled into a named, exported constant (mirrors `buildCierreOptimista`'s
 * export pattern in app/crm/casos/page.tsx) so `tests/voucher-page.test.ts`
 * can assert on it directly. HOTFIX (2026-07-28): QA's mutation N2 proved
 * that silently dropping a needed telefono column from this select string
 * reproduces the SAME bug class as the original outage (PostgREST simply
 * returns the row without it — no thrown error, `tsc` stays clean because
 * select strings are untyped) one layer above the bug this hotfix already
 * fixed. This constant is that regression guard's anchor.
 *
 * HOTFIX (2026-07-28, repoint): `telefono_contacto` is GONE from this list.
 * Production-verified: it is NULL on 100% of `productos` rows and nothing in
 * the app ever writes it — a dead column left over from scripts/032/033.
 * `telefonos_json` (populated on all production rows, written by
 * app/productos/registrar/page.tsx:220 / app/productos/editar/page.tsx:237,
 * absent from scripts/) replaces it as the real source.
 */
export const PRODUCTOS_SELECT_COLUMNS = "id, nombre_producto, pais, direccion, suplidor_id, telefonos_json"

/**
 * Derives the VOUCHER's TELEFONO from `productos.telefonos_json` — the
 * hotel PROPERTY's own front-desk number(s) (never `suplidores.telefono`,
 * which never existed, never the supplier account manager's phone, and
 * never the dead `productos.telefono_contacto` column, which is NULL on
 * every production row and unwritten by any app code).
 *
 * `telefonos_json` is a JSON array of strings. Per the human's explicit
 * decision, EVERY entry is printed, joined with ", " — one number prints
 * alone, two print as "A, B", N print as all N. Blank/whitespace-only
 * entries are skipped (so a stray empty slot can't produce a leading,
 * trailing, or doubled separator); if every entry is blank (or the array is
 * empty/absent), this returns `null` so `buildVoucherData`'s `esTextoValido`
 * check BLOCKS the voucher downstream — never a silent "", "N/A", or any
 * other fallback. Duplicate entries are preserved verbatim (this is real
 * production data — the human's data to fix, not ours to silently alter).
 */
export function derivarTelefonoHotel(
  productos: ProductoTelefonos[],
  productoId: number | null | undefined,
): string | null {
  if (productoId === null || productoId === undefined) return null
  const producto = productos.find((p) => p.id === productoId)
  const telefonos = producto?.telefonos_json
  if (!telefonos || telefonos.length === 0) return null
  const telefonosValidos = telefonos
    .map((telefono) => (typeof telefono === "string" ? telefono.trim() : ""))
    .filter((telefono) => telefono.length > 0)
  if (telefonosValidos.length === 0) return null
  return telefonosValidos.join(", ")
}

/**
 * VOUCHER UX task ("surface reserva totals + warn on mismatch"): non-blocking
 * pax cross-check. Returns `true` ONLY when every operand is present
 * (`!= null`, never a falsy check — `0` is a legitimate value for
 * `pax_ninos`/`pax_infantes`, scripts/062-add-voucher-fields-to-reservas.sql:69-71
 * declares them nullable with no default, and `reservas.pasajeros` is itself
 * nullable-in-schema even though a trigger normally populates it) AND their
 * sum differs from `reservas.pasajeros`. A still-blank field (agent typed
 * adultos but not yet ninos) must read as "incomplete", not "mismatch", so
 * ANY null operand short-circuits to `false` here.
 */
export function hayDiscrepanciaPax(
  paxAdultos: number | null | undefined,
  paxNinos: number | null | undefined,
  paxInfantes: number | null | undefined,
  pasajerosReserva: number | null | undefined,
): boolean {
  if (paxAdultos == null || paxNinos == null || paxInfantes == null || pasajerosReserva == null) {
    return false
  }
  return paxAdultos + paxNinos + paxInfantes !== pasajerosReserva
}

/**
 * Sums `cantidad` across the occupancy-group editor rows. Two DISTINCT
 * "unknown" cases, deliberately NOT collapsed into one:
 *  - a genuinely EMPTY list (no groups at all) is a known, real value of
 *    `0` — mirrors this task's "`0` is legitimate, never skipped" rule.
 *  - a list where AT LEAST ONE row has `cantidad: null` (the agent started a
 *    group but hasn't finished typing its count yet) is INCOMPLETE, so the
 *    whole sum is unknown (`null`) — mirrors "partial pax entry is quiet",
 *    applied to occupancy groups: one half-typed row must not manufacture a
 *    misleading total that then falsely compares against the reserva.
 */
export function sumarCantidadOcupaciones(
  ocupaciones: Array<{ cantidad: number | null | undefined }>,
): number | null {
  if (ocupaciones.length === 0) return 0
  let total = 0
  for (const ocupacion of ocupaciones) {
    if (ocupacion.cantidad == null) return null
    total += ocupacion.cantidad
  }
  return total
}

/**
 * Non-blocking room-count cross-check, same guard discipline as
 * `hayDiscrepanciaPax`: ANY null operand (an unfinished occupancy sum, or a
 * reserva with `habitaciones` not set) means "not enough information yet",
 * never a mismatch — guarded with `!= null`, never a falsy check, so `0`
 * habitaciones-entered-so-far still gets compared for real.
 */
export function hayDiscrepanciaHabitaciones(
  sumaCantidadOcupaciones: number | null | undefined,
  habitacionesReserva: number | null | undefined,
): boolean {
  if (sumaCantidadOcupaciones == null || habitacionesReserva == null) {
    return false
  }
  return sumaCantidadOcupaciones !== habitacionesReserva
}

/** One row in the repeatable occupancy-group editor — persists to `reserva_ocupaciones` (T2/T2b). */
export interface EditableOcupacion {
  cantidad: number | null
  ocupacion: string
  categoria: string
}

/**
 * VOUCHER PREFILL task (rule 1, non-negotiable): decides whether the
 * `mapearDetallesAOcupaciones` prefill is allowed to run for one reserva,
 * given exactly what `getOcupacionesReservaAction` returned. SAVED
 * OCUPACIONES ALWAYS WIN — this is `true` ONLY when that read SUCCEEDED
 * and came back with ZERO saved rows. Any successful read WITH rows, and
 * any failed read (we don't know if rows exist), must never prefill —
 * silently overwriting a user's saved work would be far worse than a
 * blank field. Extracted as its own pure, exported, node-testable function
 * (same pattern as `hayDiscrepanciaPax` etc. above) specifically so AC-3 —
 * "saved rows always win" — has a real unit test, not just a read of
 * `handleReservaSelect`'s control flow.
 */
export function debePrefillarOcupaciones(ocupacionesResultado: {
  success: boolean
  data?: unknown[] | null
}): boolean {
  // Boolean(...) — not a bare `&&` chain — so this HONESTS its declared
  // `boolean` return type even for a malformed input shape a real caller
  // never produces (e.g. `{ success: undefined }`), which would otherwise
  // fall through as `undefined` instead of `false`. Unreachable in
  // production (TypeScript's own `success: boolean` on the call site's
  // action-result shape rules it out), fixed anyway on lead review.
  return Boolean(ocupacionesResultado.success && (!ocupacionesResultado.data || ocupacionesResultado.data.length === 0))
}

/**
 * VOUCHER PREFILL task: one `reserva_detalles` row -> one occupancy-group
 * editor row, VERBATIM, per the human-specified mapping (correcting the
 * prior task's rejected "don't prefill" decision — see the task's WHY
 * block, not re-argued here):
 *   - cantidad  <- habitaciones (PER LINE — never the reserva-level SUM)
 *   - ocupacion <- concepto, UNPARSED (e.g. "PRUEBA 1 DOBLE" stays exactly
 *     that string — no attempt to extract "DOBLE" out of it)
 *   - categoria <- descripcion, UNPARSED
 *
 * A genuinely empty source STAYS empty: a null/blank `descripcion` maps to
 * `""`, never a substituted `concepto`/placeholder/invented string (this is
 * mistakes/stockin-zero-price — copying a real value is fine, inventing one
 * is not), and a null `habitaciones` maps to `null`, never `0` or `1`.
 *
 * Pure, no I/O — same pattern as `derivarTelefonoHotel`/`hayDiscrepanciaPax`
 * above, node-testable without a DOM or a live Supabase client.
 *
 * EMPTY-LIST DECISION: a reserva with zero `reserva_detalles` rows returns
 * ONE blank row (`{ cantidad: null, ocupacion: "", categoria: "" }`), not
 * `[]`. This mirrors the editor's own reset state set at the top of
 * `handleReservaSelect` (`setOcupacionesEditor([{ cantidad: null, ocupacion:
 * "", categoria: "" }])`) and its "at least one row" UI invariant (the
 * remove button only renders past `ocupacionesEditor.length > 1`) — an
 * empty array here would leave the editor with zero rows and no visible way
 * to add one back other than the existing "Agregar Grupo" button, which is
 * inconsistent with every other empty/no-data state on this page.
 */
export function mapearDetallesAOcupaciones(
  detalles: Array<Pick<DetalleReservaParaVoucher, "concepto" | "descripcion" | "habitaciones">>,
): EditableOcupacion[] {
  if (detalles.length === 0) {
    return [{ cantidad: null, ocupacion: "", categoria: "" }]
  }
  return detalles.map((detalle) => ({
    cantidad: detalle.habitaciones ?? null,
    ocupacion: detalle.concepto ?? "",
    categoria: detalle.descripcion ?? "",
  }))
}

/**
 * VOUCHER PREFILL task (lead send-back, fake-green-tests #11): the ENTIRE
 * decision of what to seed the occupancy editor with, given exactly what
 * `getDetallesReservaParaVoucherAction` returned — extracted out of
 * `handleReservaSelect`'s call site for the SAME reason `derivarTelefonoHotel`
 * and `mapearDetallesAOcupaciones` itself were extracted: an untested inline
 * pass-through at the wiring layer (`detallesResultado.data` straight into
 * `mapearDetallesAOcupaciones`) is exactly the shape that let M4 (per-line
 * `habitaciones` silently swapped for the reserva-level SUM) go undetected —
 * 0/140 tests caught it, because every existing test fed
 * `mapearDetallesAOcupaciones` fixtures that were already correct by
 * construction, never exercising the call site itself.
 *
 * Three cases:
 *  - success + data -> `mapearDetallesAOcupaciones(data)` (real prefill rows).
 *  - success + EMPTY data -> delegates to `mapearDetallesAOcupaciones([])`'s
 *    own empty-list decision (one blank row), rather than re-deciding it
 *    here — one empty-list rule, one owner, no risk of the two functions
 *    ever disagreeing on what "no service lines" should render as.
 *  - failure, or a malformed success-without-data shape the action's own
 *    typed return never actually produces -> `null` ("no prefill"). The
 *    caller (still) owns surfacing `detallesResultado.error` in a toast —
 *    that's UI plumbing, not a decision, so it stays inline at the call
 *    site rather than being folded into this pure function's return value.
 */
export function resolverOcupacionesParaPrefill(detallesResultado: {
  success: boolean
  data?: DetalleReservaParaVoucher[] | null
}): EditableOcupacion[] | null {
  if (!detallesResultado.success || !detallesResultado.data) return null
  return mapearDetallesAOcupaciones(detallesResultado.data)
}
