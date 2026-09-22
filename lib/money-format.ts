/**
 * Pure helpers for money input parsing/formatting. No React here so they are
 * trivially unit-testable and reusable outside of <MoneyInput>.
 *
 * Design split:
 * - `formatMoneyDraft` is the live-typing sanitizer. It always produces a
 *   well-formed, single-dot, max-2-decimal draft string, truncating (never
 *   rounding) extra decimal digits so the display never jumps around while
 *   the user is mid-keystroke.
 * - `parseMoneyInput` turns a (presumably already reasonable) string into a
 *   number. It does NOT re-sanitize malformed input like multiple dots; it
 *   is meant to run against `formatMoneyDraft` output, a full paste like
 *   "29,226.00", or a plain numeric string. Given genuinely invalid text
 *   (e.g. "abc", "1.2.3") it returns null rather than guessing.
 * - `formatMoneyDisplay` is the "final" display formatter (on blur, in
 *   read-only summaries, etc.) — always exactly 2 decimals, comma-grouped.
 */

/**
 * Parses a raw money string into a finite non-negative number, or null if empty/invalid.
 * Tolerates a leading "$" and surrounding whitespace, and strips "," used
 * as a thousands separator. Does not truncate/round decimals - the full
 * precision of the input is preserved. Rejects negative amounts.
 *
 * Contract: money amounts are non-negative (previously enforced by min="0" on inputs).
 * A negative result from the parser indicates user input error or data corruption.
 */
export function parseMoneyInput(raw: string | null | undefined): number | null {
  if (raw == null) return null

  let s = String(raw).trim()
  if (s === "") return null

  // Tolerate a leading currency symbol (with optional space after it).
  s = s.replace(/^\$\s*/, "")
  // Strip thousands separators.
  s = s.replace(/,/g, "")
  s = s.trim()

  if (s === "" || s === "." || s === "-") return null

  const n = Number(s)
  // Reject negative amounts.
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Predicate: should the draft string be overwritten with a freshly-formatted value?
 *
 * Returns true if the incoming numeric value is genuinely different from what
 * the current draft would parse to. Used in the <MoneyInput> effect to decide
 * whether to re-sync the draft when the parent passes a new `value` prop
 * (e.g. from a form reset or DB hydration).
 *
 * Crucially, this returns FALSE for intermediate drafts like "29,226." or
 * "29,226.0" even though they parse to the same integer. This preserves the
 * user's in-progress keystroke without the field fighting them — a naive
 * "always resync on prop change" implementation reintroduces the original bug
 * (the trailing "." mid-typing).
 */
export function shouldResyncDraft(draft: string, incomingValue: number): boolean {
  const draftValue = parseMoneyInput(draft) ?? 0
  const nextValue = incomingValue ?? 0
  return draftValue !== nextValue
}

/**
 * Formats a numeric value as "1,234.56" (en-US grouping, exactly 2 decimals).
 * Used for the "settled" display (on blur, totals, summaries).
 */
export function formatMoneyDisplay(value: number): string {
  const n = Number.isFinite(value) ? value : 0
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Inserts "," thousands grouping into a plain digit string. */
function groupThousands(digits: string): string {
  if (digits === "") return ""
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/**
 * Live-typing formatter. Keeps only digits and at most one ".", groups the
 * integer part with ",", and caps the fraction at 2 digits (truncating, not
 * rounding, so a single extra keystroke doesn't reflow earlier digits).
 * Crucially, it PRESERVES a trailing "." (e.g. "29226." -> "29,226.") and a
 * partial fraction like "29226.0" -> "29,226.0" so the user can keep typing
 * a decimal value without the field fighting them.
 */
export function formatMoneyDraft(raw: string | null | undefined): string {
  if (!raw) return ""

  // Keep only digits and dots - strips "$", previously-inserted ",", letters, etc.
  const cleaned = raw.replace(/[^\d.]/g, "")
  if (cleaned === "") return ""

  const dotIndex = cleaned.indexOf(".")

  let intPart: string
  let fracPart: string | null = null

  if (dotIndex === -1) {
    intPart = cleaned
  } else {
    intPart = cleaned.slice(0, dotIndex)
    // Drop any additional dots the user may have typed/pasted, cap fraction at 2 digits.
    fracPart = cleaned.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2)
  }

  // Strip leading zeros, but keep a single "0" (e.g. "007" -> "7", "0" -> "0").
  intPart = intPart.replace(/^0+(?=\d)/, "")

  const groupedInt = groupThousands(intPart)

  if (fracPart !== null) {
    return `${groupedInt}.${fracPart}`
  }

  return groupedInt
}
