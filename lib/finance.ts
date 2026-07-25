/**
 * Pure financial helpers — no Supabase, no side effects.
 *
 * This module is the SINGLE SOURCE OF TRUTH for MONTO PAGADO / BALANCE RESERVA /
 * BALANCE GENERAL. These values must never be recomputed or inlined into a
 * document template — templates consume the output of these functions only.
 *
 * Rounding / comparison approach (decided here, applies to every helper below):
 * money is always rounded to 2 decimals (cents) via `redondearMoneda` at the
 * point each value is produced — both per-reserva balances and running
 * per-currency totals. This prevents IEEE-754 drift (e.g. 0.1 + 0.2) from
 * silently accumulating across a client's payments/reservas. Callers/tests
 * comparing these outputs should still use an epsilon-tolerant comparison
 * (e.g. `toBeCloseTo(expected, 2)`) rather than strict floating-point
 * equality, since bit-for-bit equality is never guaranteed for floats.
 */

const CURRENCY_DECIMALS = 2

/**
 * Rounds a monetary value to 2 decimal places (cents), half-up.
 */
function redondearMoneda(valor: number): number {
  const factor = 10 ** CURRENCY_DECIMALS
  return Math.round((valor + Number.EPSILON) * factor) / factor
}

/**
 * Returns the sum of all payment amounts. Returns 0 for an empty array.
 */
export function sumarPagos(pagos: number[]): number {
  return pagos.reduce((acc, p) => acc + p, 0)
}

/**
 * Returns the outstanding balance: total minus the sum of all payments.
 */
export function calcularBalance(total: number, pagos: number[]): number {
  return total - sumarPagos(pagos)
}

/**
 * MONTO PAGADO for a single reserva = sum of its pagos + reservas.abonado_contabilidad.
 *
 * `abonadoContabilidad` is a required number: whether "unset" means 0 is a
 * decision for the caller (matching `Number(reserva.abonado_contabilidad) || 0`
 * in app/clientes/balance/page.tsx:77) — this function never invents a default.
 */
export function calcularMontoPagado(abonadoContabilidad: number, pagos: number[]): number {
  return redondearMoneda(sumarPagos(pagos) + abonadoContabilidad)
}

/**
 * BALANCE RESERVA for a single reserva = TOTAL - MONTO PAGADO.
 */
export function calcularBalanceReserva(total: number, abonadoContabilidad: number, pagos: number[]): number {
  return redondearMoneda(total - calcularMontoPagado(abonadoContabilidad, pagos))
}

/** A single reserva's inputs for BALANCE GENERAL aggregation. */
export interface ReservaBalanceInput {
  precioTotal: number
  abonadoContabilidad: number
  pagos: number[]
  moneda?: string
}

/**
 * BALANCE GENERAL, split DOP vs USD: sums BALANCE RESERVA across ALL of a
 * client's reservas, bucketed by each reserva's own moneda — matching
 * app/clientes/balance/page.tsx:75-90 exactly, including the
 * `(moneda || "DOP") === "USD"` bucketing rule. A reserva's balance is added
 * only to its own currency bucket, never mixed into the other.
 */
export function calcularBalanceGeneralPorMoneda(reservas: ReservaBalanceInput[]): { DOP: number; USD: number } {
  let DOP = 0
  let USD = 0

  for (const reserva of reservas) {
    const balanceReserva = calcularBalanceReserva(reserva.precioTotal, reserva.abonadoContabilidad, reserva.pagos)

    if ((reserva.moneda || "DOP") === "USD") {
      USD = redondearMoneda(USD + balanceReserva)
    } else {
      DOP = redondearMoneda(DOP + balanceReserva)
    }
  }

  return { DOP, USD }
}
