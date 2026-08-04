/**
 * Resolves the `?reserva_id=` deep-link parameter that /reservas/ver/[id] and
 * /reservas/pendientes use to send an operator straight into PROFORMA or
 * VOUCHER for one reserva.
 *
 * Pure by design — no React, no I/O, no Supabase. The two pages that consume
 * it are 900–1500 lines and have no component-test harness in this repo, so
 * the decision lives here where it can actually be unit-tested (the same
 * extract-for-testability move as `derivarTelefonoHotel` /
 * `resolverOcupacionesParaPrefill`).
 *
 * Param convention (matched to the in-repo precedent at
 * app/reservas/pendientes/page.tsx → app/pagos/registrar/page.tsx): the value
 * is the NUMERIC `reservas.id`, never `codigo` — `codigo` is a display string
 * with no uniqueness constraint anywhere in scripts/.
 */

export type ReservaDeepLink<T> =
  | { estado: "sin-param" }
  | { estado: "encontrada"; reserva: T }
  | { estado: "no-encontrada"; param: string }

/**
 * Block-never-default (mistakes/stockin-zero-price): a param that is not a
 * finite integer id is reported as `no-encontrada` — it is NEVER coerced,
 * rounded, or quietly ignored into "just show the list". The caller owes the
 * operator a destructive toast naming the id, because silently showing an
 * unfiltered list after they clicked "Generar Proforma" on ONE reserva is the
 * exact silent-wrong-state class this project keeps paying for.
 */
export function resolverReservaDeepLink<T extends { id: number }>(
  param: string | null | undefined,
  reservas: T[],
): ReservaDeepLink<T> {
  if (param == null || param.trim() === "") return { estado: "sin-param" }

  const id = Number(param)
  if (!Number.isFinite(id) || !Number.isInteger(id)) {
    return { estado: "no-encontrada", param }
  }

  const reserva = reservas.find((r) => r.id === id)
  if (!reserva) return { estado: "no-encontrada", param }

  return { estado: "encontrada", reserva }
}
