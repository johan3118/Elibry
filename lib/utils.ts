import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitizes a "habitaciones" (rooms) value before it is sent to Supabase.
 *
 * The reserva_detalles.habitaciones column is `INTEGER` (nullable, DEFAULT 1).
 * The UI represents "no rooms applicable" with the literal string "N/A", which
 * Postgres rejects when inserted into an INTEGER column. Rejecting a single
 * row aborts the entire batch insert of reserva_detalles (Bug 2: only the
 * first service line-item ends up persisted, or none at all).
 *
 * Semantics (documented, keep consistent everywhere this is used):
 * - "N/A", empty string, null, undefined, non-numeric strings -> null
 *   (null is valid: the column already defaults sensibly and null avoids
 *   fabricating a fake "1" room count).
 * - Zero or negative numbers -> null (zero/negative rooms is not meaningful).
 * - Positive integers (number or numeric string) -> the integer value.
 *
 * @param value - Raw habitaciones value as tracked in component state
 * @returns A positive integer, or null when there is no valid room count
 */
export function sanitizeHabitaciones(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "" || trimmed.toUpperCase() === "N/A") return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null
    return parsed
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) return null
    return value
  }
  return null
}

/**
 * Formats a date string to DD-MMM-YYYY format (e.g., "24-May-2026")
 * @param dateString - ISO date string or date value
 * @returns Formatted date string or "N/A" if invalid
 */
export function formatDateDMY(dateString: string | null | undefined): string {
  if (!dateString) return "N/A"
  try {
    const parts = String(dateString).split("-")
    let date: Date
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      date = new Date(Date.UTC(year, month - 1, day))
    } else {
      date = new Date(dateString)
    }
    if (isNaN(date.getTime())) return "N/A"
    const day = date.getUTCDate().toString().padStart(2, "0")
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    const month = months[date.getUTCMonth()]
    const year = date.getUTCFullYear()
    return `${day}-${month}-${year}`
  } catch {
    return "N/A"
  }
}
