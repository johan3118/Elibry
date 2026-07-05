// @vitest-environment node
import { describe, it, expect } from "vitest"
import { formatDateDMY, sanitizeHabitaciones } from "../lib/utils"

describe("formatDateDMY", () => {
  it("returns 'N/A' for null", () => {
    expect(formatDateDMY(null)).toBe("N/A")
  })

  it("returns 'N/A' for undefined", () => {
    expect(formatDateDMY(undefined)).toBe("N/A")
  })

  it("returns 'N/A' for empty string", () => {
    expect(formatDateDMY("")).toBe("N/A")
  })

  it("formats ISO date string to DD-MMM-YYYY with Spanish month abbreviations", () => {
    expect(formatDateDMY("2026-05-24")).toBe("24-May-2026")
  })

  it("returns 'N/A' for invalid date string", () => {
    expect(formatDateDMY("not-a-date")).toBe("N/A")
  })

  it("returns a date in DD-MMM-YYYY format with January", () => {
    expect(formatDateDMY("2026-01-15")).toBe("15-Ene-2026")
  })

  it("returns a date in DD-MMM-YYYY format with December", () => {
    expect(formatDateDMY("2026-12-31")).toBe("31-Dic-2026")
  })

  it("pads single-digit days with leading zero", () => {
    expect(formatDateDMY("2026-02-05")).toBe("05-Feb-2026")
  })

  it("handles February with Spanish abbreviation", () => {
    expect(formatDateDMY("2026-02-14")).toBe("14-Feb-2026")
  })

  it("uses Spanish month abbreviations not English", () => {
    // Test with August which is different (Spanish: Ago, English: Aug)
    expect(formatDateDMY("2026-08-15")).toBe("15-Ago-2026")

    // Test with April which is different (Spanish: Abr, English: Apr)
    expect(formatDateDMY("2026-04-10")).toBe("10-Abr-2026")
  })

  it("handles ISO datetime string (with time component) and returns date-only output", () => {
    expect(formatDateDMY("2026-05-24T14:30:00Z")).toBe("24-May-2026")
  })

  it("handles ISO datetime with timezone offset, UTC-safe", () => {
    expect(formatDateDMY("2026-06-02T23:45:30Z")).toBe("02-Jun-2026")
  })

  it("regression (Bug 5): check-in/out dates are not shifted a day back in UTC-4", () => {
    // Client entered check-in 25-Aug / check-out 28-Aug; must render exactly, not 24/27
    expect(formatDateDMY("2026-08-25")).toBe("25-Ago-2026")
    expect(formatDateDMY("2026-08-28")).toBe("28-Ago-2026")
  })
})

describe("sanitizeHabitaciones (regression: Bug 2 - only first service persists)", () => {
  it("returns null for the string 'N/A'", () => {
    expect(sanitizeHabitaciones("N/A")).toBeNull()
  })

  it("returns null for a lowercase 'n/a'", () => {
    expect(sanitizeHabitaciones("n/a")).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(sanitizeHabitaciones("")).toBeNull()
  })

  it("returns null for a whitespace-only string", () => {
    expect(sanitizeHabitaciones("   ")).toBeNull()
  })

  it("returns null for null", () => {
    expect(sanitizeHabitaciones(null)).toBeNull()
  })

  it("returns null for undefined", () => {
    expect(sanitizeHabitaciones(undefined)).toBeNull()
  })

  it("parses a positive numeric string to a number", () => {
    expect(sanitizeHabitaciones("3")).toBe(3)
  })

  it("passes through a positive number unchanged", () => {
    expect(sanitizeHabitaciones(3)).toBe(3)
  })

  it("returns null for 0 (zero rooms is not a meaningful count)", () => {
    expect(sanitizeHabitaciones(0)).toBeNull()
    expect(sanitizeHabitaciones("0")).toBeNull()
  })

  it("returns null for a non-numeric string", () => {
    expect(sanitizeHabitaciones("abc")).toBeNull()
  })

  it("returns null for a negative number", () => {
    expect(sanitizeHabitaciones(-1)).toBeNull()
  })

  it("returns null for a negative numeric string", () => {
    expect(sanitizeHabitaciones("-5")).toBeNull()
  })

  it("returns null for a non-integer number", () => {
    expect(sanitizeHabitaciones(2.5)).toBeNull()
  })

  it("returns null for a non-integer numeric string", () => {
    expect(sanitizeHabitaciones("2.5")).toBeNull()
  })
})
