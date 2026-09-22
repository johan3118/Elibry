// @vitest-environment node
import { describe, it, expect } from "vitest"
import { parseMoneyInput, formatMoneyDisplay, formatMoneyDraft, shouldResyncDraft } from "../lib/money-format"

describe("parseMoneyInput", () => {
  it("parses thousands-grouped input with cents", () => {
    expect(parseMoneyInput("29,226.00")).toBe(29226)
  })

  it("preserves cents ('1,234.56' must not be lost)", () => {
    expect(parseMoneyInput("1,234.56")).toBe(1234.56)
  })

  it("parses a large value with multiple thousands separators", () => {
    expect(parseMoneyInput("1,234,567.89")).toBe(1234567.89)
  })

  it("parses a trailing dot as its integer value", () => {
    expect(parseMoneyInput("29226.")).toBe(29226)
  })

  it("parses zero", () => {
    expect(parseMoneyInput("0")).toBe(0)
    expect(parseMoneyInput("0.00")).toBe(0)
  })

  it("returns null for an empty string", () => {
    expect(parseMoneyInput("")).toBeNull()
  })

  it("returns null for whitespace-only input", () => {
    expect(parseMoneyInput("   ")).toBeNull()
  })

  it("returns null for null/undefined", () => {
    expect(parseMoneyInput(null)).toBeNull()
    expect(parseMoneyInput(undefined)).toBeNull()
  })

  it("returns null for non-numeric text", () => {
    expect(parseMoneyInput("abc")).toBeNull()
  })

  it("returns null for malformed input with multiple dots", () => {
    expect(parseMoneyInput("1.2.3")).toBeNull()
  })

  it("tolerates a leading '$' and surrounding spaces", () => {
    expect(parseMoneyInput("$29,226.00")).toBe(29226)
    expect(parseMoneyInput("$ 100")).toBe(100)
    expect(parseMoneyInput("  100  ")).toBe(100)
  })

  it("does not truncate/round extra decimal precision - that is formatMoneyDraft's job", () => {
    expect(parseMoneyInput("29226.12345")).toBeCloseTo(29226.12345)
  })

  it("rejects negative amounts by returning null", () => {
    expect(parseMoneyInput("-500")).toBeNull()
    expect(parseMoneyInput("-1,234.56")).toBeNull()
  })

  it("still parses zero correctly when rejecting negatives", () => {
    expect(parseMoneyInput("0")).toBe(0)
    expect(parseMoneyInput("0.00")).toBe(0)
  })
})

describe("formatMoneyDisplay", () => {
  it("formats a whole number with 2 decimals and thousands grouping", () => {
    expect(formatMoneyDisplay(29226)).toBe("29,226.00")
  })

  it("formats zero", () => {
    expect(formatMoneyDisplay(0)).toBe("0.00")
  })

  it("formats a large value with multiple grouping separators", () => {
    expect(formatMoneyDisplay(1234567.89)).toBe("1,234,567.89")
  })

  it("formats a value with cents", () => {
    expect(formatMoneyDisplay(1234.56)).toBe("1,234.56")
  })
})

describe("formatMoneyDraft", () => {
  it("returns an empty string for empty input", () => {
    expect(formatMoneyDraft("")).toBe("")
  })

  it("groups a plain integer with thousands separators", () => {
    expect(formatMoneyDraft("29226")).toBe("29,226")
  })

  it("preserves a trailing dot so the user can keep typing a decimal", () => {
    expect(formatMoneyDraft("29226.")).toBe("29,226.")
  })

  it("preserves a partial fraction like '.0'", () => {
    expect(formatMoneyDraft("29226.0")).toBe("29,226.0")
  })

  it("caps the fraction at 2 digits by truncating (not rounding) further keystrokes", () => {
    expect(formatMoneyDraft("29226.005")).toBe("29,226.00")
  })

  it("keeps only the first dot when given multiple dots", () => {
    expect(formatMoneyDraft("1.2.3")).toBe("1.23")
  })

  it("strips leading zeros but keeps a single zero", () => {
    expect(formatMoneyDraft("0")).toBe("0")
    expect(formatMoneyDraft("007")).toBe("7")
    expect(formatMoneyDraft("00")).toBe("0")
  })

  it("groups a large value with multiple thousands separators", () => {
    expect(formatMoneyDraft("1234567.89")).toBe("1,234,567.89")
  })

  it(
    "never loses the trailing '.' while simulating keystroke-by-keystroke typing of 29226.00",
    () => {
      const keys = ["2", "9", "2", "2", "6", ".", "0", "0"]
      let draft = ""
      const snapshots: string[] = []
      for (const key of keys) {
        // Simulate a controlled <input>: the field's raw value is the
        // previously-formatted draft with the newly typed character appended.
        draft = formatMoneyDraft(draft + key)
        snapshots.push(draft)
      }

      // The moment "." is typed (index 5) and onward, the dot must survive.
      for (let i = 5; i < snapshots.length; i++) {
        expect(snapshots[i]).toContain(".")
      }

      expect(draft).toBe("29,226.00")
    },
  )
})

describe("shouldResyncDraft", () => {
  it("mid-typing drafts must NOT resync: trailing dot", () => {
    expect(shouldResyncDraft("29,226.", 29226)).toBe(false)
  })

  it("mid-typing drafts must NOT resync: one decimal place", () => {
    expect(shouldResyncDraft("29,226.0", 29226)).toBe(false)
  })

  it("mid-typing drafts must NOT resync: two decimal places matching the parsed value", () => {
    expect(shouldResyncDraft("29,226.00", 29226)).toBe(false)
  })

  it("a genuine external change MUST resync", () => {
    expect(shouldResyncDraft("100.00", 29226)).toBe(true)
  })

  it("DB hydration from an empty field must resync", () => {
    expect(shouldResyncDraft("", 29226)).toBe(true)
  })

  it("a cleared field stays cleared", () => {
    expect(shouldResyncDraft("", 0)).toBe(false)
  })

  it("zero with explicit decimal formatting stays unchanged", () => {
    expect(shouldResyncDraft("0.00", 0)).toBe(false)
  })
})
