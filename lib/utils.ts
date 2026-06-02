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
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "N/A"
    const day = date.getDate().toString().padStart(2, "0")
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  } catch {
    return "N/A"
  }
}
