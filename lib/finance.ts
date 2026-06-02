/**
 * Pure financial helpers — no Supabase, no side effects.
 */

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
