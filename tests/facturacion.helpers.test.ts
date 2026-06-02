// @vitest-environment node
import { describe, it, expect } from "vitest"

import { formatDateDMY } from "../lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// formatDateDMY is used throughout the invoicing module for date display
// ─────────────────────────────────────────────────────────────────────────────

describe("formatDateDMY — invoice date formatting (facturación module)", () => {
  it("happy path — formats ISO date string YYYY-MM-DD to DD-MMM-YYYY", () => {
    const result = formatDateDMY("2026-06-02")
    expect(result).toBe("02-Jun-2026")
  })

  it("happy path — formats ISO date with time to DD-MMM-YYYY", () => {
    const result = formatDateDMY("2026-05-24T14:30:00Z")
    expect(result).toBe("24-May-2026")
  })

  it("happy path — handles date 01-Jan-YYYY", () => {
    const result = formatDateDMY("2026-01-01")
    expect(result).toBe("01-Ene-2026")
  })

  it("happy path — handles date 31-Dec-YYYY", () => {
    const result = formatDateDMY("2026-12-31")
    expect(result).toBe("31-Dic-2026")
  })

  it("happy path — handles leap year date", () => {
    const result = formatDateDMY("2024-02-29")
    expect(result).toBe("29-Feb-2024")
  })

  it("happy path — formats all months correctly in Spanish", () => {
    const months = [
      { input: "2026-01-15", expected: "15-Ene-2026" },
      { input: "2026-02-15", expected: "15-Feb-2026" },
      { input: "2026-03-15", expected: "15-Mar-2026" },
      { input: "2026-04-15", expected: "15-Abr-2026" },
      { input: "2026-05-15", expected: "15-May-2026" },
      { input: "2026-06-15", expected: "15-Jun-2026" },
      { input: "2026-07-15", expected: "15-Jul-2026" },
      { input: "2026-08-15", expected: "15-Ago-2026" },
      { input: "2026-09-15", expected: "15-Sep-2026" },
      { input: "2026-10-15", expected: "15-Oct-2026" },
      { input: "2026-11-15", expected: "15-Nov-2026" },
      { input: "2026-12-15", expected: "15-Dic-2026" },
    ]

    months.forEach(({ input, expected }) => {
      expect(formatDateDMY(input)).toBe(expected)
    })
  })

  it("happy path — handles single-digit day with leading zero", () => {
    const result = formatDateDMY("2026-06-05")
    expect(result).toBe("05-Jun-2026")
  })

  it("happy path — handles various invoice date scenarios", () => {
    // Invoice issued on current date
    const result1 = formatDateDMY("2026-06-02")
    expect(result1).toBe("02-Jun-2026")

    // Invoice issued in previous month
    const result2 = formatDateDMY("2026-05-15")
    expect(result2).toBe("15-May-2026")

    // Invoice issued in future (advance proforma)
    const result3 = formatDateDMY("2026-12-25")
    expect(result3).toBe("25-Dic-2026")
  })

  it("error path — returns 'N/A' for null input", () => {
    const result = formatDateDMY(null)
    expect(result).toBe("N/A")
  })

  it("error path — returns 'N/A' for undefined input", () => {
    const result = formatDateDMY(undefined)
    expect(result).toBe("N/A")
  })

  it("error path — returns 'N/A' for empty string", () => {
    const result = formatDateDMY("")
    expect(result).toBe("N/A")
  })

  it("error path — returns 'N/A' for invalid date string", () => {
    const result = formatDateDMY("not-a-date")
    expect(result).toBe("N/A")
  })

  it("error path — returns 'N/A' for completely invalid date string", () => {
    const result = formatDateDMY("invalid-date-string")
    expect(result).toBe("N/A")
  })

  it("error path — returns 'N/A' for completely non-numeric invalid date", () => {
    const result = formatDateDMY("no-numbers-here")
    expect(result).toBe("N/A")
  })

  it("edge case — handles dates from far past", () => {
    const result = formatDateDMY("1900-01-01")
    expect(result).toBe("01-Ene-1900")
  })

  it("edge case — handles dates in far future", () => {
    const result = formatDateDMY("2099-12-31")
    expect(result).toBe("31-Dic-2099")
  })

  it("edge case — preserves UTC timezone when parsing ISO string", () => {
    // ISO date string without timezone should not be shifted by local timezone
    const result = formatDateDMY("2026-06-02")
    // Should always be "02-Jun-2026" regardless of the test runner's local timezone
    expect(result).toBe("02-Jun-2026")
  })

  it("edge case — handles ISO string with Z suffix consistently", () => {
    const result1 = formatDateDMY("2026-06-02T00:00:00Z")
    const result2 = formatDateDMY("2026-06-02")
    // Both should format to the same date (not shifted by timezone)
    expect(result1).toBe(result2)
  })

  it("invoice use case — multiple invoice dates in sequence", () => {
    const dates = [
      { input: "2026-06-01", expected: "01-Jun-2026" },
      { input: "2026-06-02", expected: "02-Jun-2026" },
      { input: "2026-06-03", expected: "03-Jun-2026" },
    ]

    dates.forEach(({ input, expected }) => {
      const formatted = formatDateDMY(input)
      expect(formatted).toBe(expected)
    })
  })

  it("invoice use case — handles null safely in invoice list rendering", () => {
    // Common scenario: invoice_date column might be NULL in database
    const mockInvoiceDate = null
    const formatted = formatDateDMY(mockInvoiceDate)
    expect(formatted).toBe("N/A")
  })
})
