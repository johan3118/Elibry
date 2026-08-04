/**
 * Pure logic lifted out of app/facturacion/proforma/page.tsx.
 *
 * WHY IT LIVES HERE AND NOT IN THE PAGE: Next generates a per-route type in
 * `.next/types` asserting that a page module exports NOTHING but `default` and
 * the framework's own reserved names. A page that also exports a helper makes
 * `tsc --noEmit` fail once a build has run — which collided head-on with this
 * repo's own testing pattern of extracting a pure function out of a page and
 * unit-testing it. The pattern is right; the location was wrong.
 */
import type { TipoPax } from "@/app/actions/documentos-actions"

/**
 * A single passenger row in the "Editar" dialog — the REAL, persisted-
 * passenger editor required by T8 AC-5.
 */
export interface EditablePasajero {
  nombreCompleto: string
  tipoPax: TipoPax
  ocupacionId: number | null
}

/**
 * How many BLANK passenger rows PROFORMA's editor opens with when this
 * reserva has no PROFORMA passenger rows saved yet (the normal state right
 * after migration 064, since every pre-existing row was tagged 'VOUCHER').
 *
 * Block-never-default (mistakes/stockin-zero-price), applied twice:
 *  - the count is tested with Number.isFinite/Number.isInteger, NEVER
 *    truthiness — `pasajeros || 1` would silently turn 2.5 into 2.5 rows and
 *    NaN into 1 by accident rather than by rule;
 *  - a passenger NAME is never fabricated. Every seeded row is `""`, so the
 *    operator types the real names and buildConfirmacionData still blocks on
 *    a genuinely empty list.
 *
 * `null` / `undefined` / `0` / negative / non-integer / `NaN` → exactly 1 row
 * (the ruled minimum — the editor is never rendered with zero rows).
 */
export function filasBlancasParaPasajeros(pasajerosReserva: number | null | undefined): EditablePasajero[] {
  const cantidad =
    pasajerosReserva != null &&
    Number.isFinite(pasajerosReserva) &&
    Number.isInteger(pasajerosReserva) &&
    pasajerosReserva >= 1
      ? pasajerosReserva
      : 1

  return Array.from({ length: cantidad }, () => ({
    nombreCompleto: "",
    tipoPax: "ADULTO" as TipoPax,
    ocupacionId: null,
  }))
}

/**
 * Decides what PROFORMA's passenger editor shows when the dialog opens.
 *
 *  - persisted PROFORMA rows exist → those rows, verbatim, in `orden` order;
 *  - the fetch succeeded but the list is empty → `reservas.pasajeros` blank
 *    rows (the seeding rule above);
 *  - the fetch FAILED → `null`, meaning "no seeding decision can be made".
 *    The caller must surface a destructive toast and leave the pre-set single
 *    blank row — a failed read is never allowed to look like an empty list.
 */
export function resolverPasajerosParaEditor(
  resultado: { success: boolean; data?: any[] | null },
  pasajerosReserva: number | null | undefined,
): EditablePasajero[] | null {
  if (!resultado.success) return null

  const filas = resultado.data
  if (filas && filas.length > 0) {
    return filas.map((p: any) => ({
      nombreCompleto: p.nombre_completo,
      tipoPax: p.tipo_pax,
      ocupacionId: p.ocupacion_id ?? null,
    }))
  }

  return filasBlancasParaPasajeros(pasajerosReserva)
}
