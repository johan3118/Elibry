"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { formatMoneyDisplay, formatMoneyDraft, parseMoneyInput, shouldResyncDraft } from "@/lib/money-format"

interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number
  onValueChange: (value: number) => void
}

/**
 * Controlled money field. Renders a `type="text"` input (never `type="number"`,
 * which silently rejects "," and erases a trailing "." on every keystroke -
 * see the reservas Precio Unitario bug this fixes).
 *
 * The core of the fix: this component keeps its own STRING draft state, so an
 * intermediate value like "29,226." survives re-renders instead of being
 * re-derived (and truncated) from the numeric `value` prop on every keystroke.
 */
export function MoneyInput({ value, onValueChange, onBlur, ...rest }: MoneyInputProps) {
  const [draft, setDraft] = React.useState<string>(() => (value ? formatMoneyDisplay(value) : ""))

  // Re-sync the draft when `value` changes from OUTSIDE this component (e.g. a
  // form reset, or a row re-hydrated from the DB in the editar page). We only
  // do this when the incoming value no longer matches what the current draft
  // itself would parse to - our own onValueChange calls round-trip the same
  // number back through `value`, so this does not fight the user mid-keystroke.
  React.useEffect(() => {
    if (shouldResyncDraft(draft, value ?? 0)) {
      setDraft(value ? formatMoneyDisplay(value) : "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoneyDraft(e.target.value)
    setDraft(formatted)
    onValueChange(parseMoneyInput(formatted) ?? 0)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseMoneyInput(draft)
    setDraft(parsed !== null ? formatMoneyDisplay(parsed) : "")
    onBlur?.(e)
  }

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  )
}
