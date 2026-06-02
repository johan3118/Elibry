import { describe, it, expect } from "vitest"
import { sumarPagos, calcularBalance } from "../lib/finance"

describe("sumarPagos", () => {
  it("returns 0 for an empty array", () => {
    expect(sumarPagos([])).toBe(0)
  })

  it("sums a single payment", () => {
    expect(sumarPagos([500])).toBe(500)
  })

  it("sums multiple payments", () => {
    expect(sumarPagos([300, 200])).toBe(500)
  })

  it("sums payments with decimals", () => {
    expect(sumarPagos([100.5, 50.25])).toBeCloseTo(150.75)
  })
})

describe("calcularBalance", () => {
  it("returns total when no payments have been made", () => {
    expect(calcularBalance(1000, [])).toBe(1000)
  })

  it("returns total minus sum of payments — spec example", () => {
    expect(calcularBalance(1000, [300, 200])).toBe(500)
  })

  it("returns 0 when fully paid", () => {
    expect(calcularBalance(800, [800])).toBe(0)
  })

  it("returns negative when overpaid", () => {
    expect(calcularBalance(500, [600])).toBe(-100)
  })
})
