// @vitest-environment node
import { describe, it, expect } from "vitest"
import { formatDateDMY } from "../lib/utils"

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
})
