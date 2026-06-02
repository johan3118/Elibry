/**
 * Pure penalty-window helpers — no Supabase, no side effects.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Returns the integer number of whole days from `hoy` to `fechaLimite`.
 * Positive  → fechaLimite is in the future.
 * Zero      → same day.
 * Negative  → fechaLimite is already past.
 *
 * Comparison uses UTC calendar days to avoid DST surprises.
 */
export function diasHastaFecha(fechaLimite: Date, hoy: Date): number {
  const limiteUtc = Date.UTC(
    fechaLimite.getFullYear(),
    fechaLimite.getMonth(),
    fechaLimite.getDate()
  )
  const hoyUtc = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((limiteUtc - hoyUtc) / MS_PER_DAY)
}

/**
 * Returns true when `fechaLimite` falls within `ventanaDias` calendar days
 * from `hoy` (inclusive), including today (0 days) and past-due dates
 * (negative days).
 *
 * Default window is 5 days, matching the dashboard alert threshold.
 */
export function estaEnVentanaPenalidad(
  fechaLimite: Date,
  hoy: Date,
  ventanaDias = 5
): boolean {
  return diasHastaFecha(fechaLimite, hoy) <= ventanaDias
}
