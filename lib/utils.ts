import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
