import { describe, it, expect } from "vitest"
import { diasHastaFecha, estaEnVentanaPenalidad } from "../lib/penalties"

const today = new Date(2026, 5, 2) // 2026-06-02 (month is 0-indexed)

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

describe("diasHastaFecha", () => {
  it("returns 0 when fechaLimite is today", () => {
    expect(diasHastaFecha(today, today)).toBe(0)
  })

  it("returns positive days for a future date", () => {
    expect(diasHastaFecha(addDays(today, 3), today)).toBe(3)
  })

  it("returns negative days for a past date", () => {
    expect(diasHastaFecha(addDays(today, -2), today)).toBe(-2)
  })

  it("returns 11 days for +11d", () => {
    expect(diasHastaFecha(addDays(today, 11), today)).toBe(11)
  })
})

describe("estaEnVentanaPenalidad", () => {
  it("+3d returns true (within default 5-day window)", () => {
    expect(estaEnVentanaPenalidad(addDays(today, 3), today)).toBe(true)
  })

  it("+11d returns false (outside default 5-day window)", () => {
    expect(estaEnVentanaPenalidad(addDays(today, 11), today)).toBe(false)
  })

  it("+5d boundary — returns true (exactly at window edge)", () => {
    expect(estaEnVentanaPenalidad(addDays(today, 5), today)).toBe(true)
  })

  it("+6d boundary — returns false (one day beyond window)", () => {
    expect(estaEnVentanaPenalidad(addDays(today, 6), today)).toBe(false)
  })

  it("0 days (today) returns true", () => {
    expect(estaEnVentanaPenalidad(today, today)).toBe(true)
  })

  it("negative (past due) returns true", () => {
    expect(estaEnVentanaPenalidad(addDays(today, -10), today)).toBe(true)
  })

  it("respects a custom ventanaDias", () => {
    expect(estaEnVentanaPenalidad(addDays(today, 7), today, 7)).toBe(true)
    expect(estaEnVentanaPenalidad(addDays(today, 8), today, 7)).toBe(false)
  })
})
