import { describe, it, expect } from "vitest"
import {
  sumarPagos,
  calcularBalance,
  calcularMontoPagado,
  calcularBalanceReserva,
  calcularBalanceGeneralPorMoneda,
  type ReservaBalanceInput,
} from "../lib/finance"

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

// ─────────────────────────────────────────────────────────────────────────────
// T4 — MONTO PAGADO / BALANCE RESERVA / BALANCE GENERAL
//
// MONTO PAGADO = sumarPagos(pagos) + abonado_contabilidad
// BALANCE RESERVA = TOTAL - MONTO PAGADO
// BALANCE GENERAL (DOP/USD) = Σ BALANCE RESERVA across a client's reservas,
// bucketed by each reserva's own moneda — pinned to app/clientes/balance/page.tsx:75-90.
// ─────────────────────────────────────────────────────────────────────────────

describe("calcularMontoPagado", () => {
  it("returns abonado_contabilidad alone when there are no payments", () => {
    expect(calcularMontoPagado(500, [])).toBe(500)
  })

  it("sums payments and abonado_contabilidad", () => {
    expect(calcularMontoPagado(500, [300, 200])).toBe(1000)
  })

  it("treats abonado_contabilidad of 0 as a genuine zero, not a missing value", () => {
    // The "unset means 0" decision belongs to the caller (T5's builder), not
    // here — this test just documents that 0 and "unset" produce the same
    // arithmetic result, since the function only accepts numbers.
    expect(calcularMontoPagado(0, [300, 200])).toBe(500)
  })

  it("rounds to 2 decimals to avoid float drift (0.1 + 0.2 style accumulation)", () => {
    expect(calcularMontoPagado(0.1, [0.2])).toBeCloseTo(0.3, 2)
    expect(calcularMontoPagado(0.1, [0.2])).toBe(0.3)
  })
})

describe("calcularBalanceReserva", () => {
  it("returns TOTAL when nothing has been paid or abonado", () => {
    expect(calcularBalanceReserva(1000, 0, [])).toBe(1000)
  })

  it("subtracts both abonado_contabilidad and the sum of payments from TOTAL", () => {
    expect(calcularBalanceReserva(1000, 200, [300])).toBe(500)
  })

  it("returns 0 when fully paid via abonado_contabilidad alone", () => {
    expect(calcularBalanceReserva(800, 800, [])).toBe(0)
  })

  it("returns negative when overpaid", () => {
    expect(calcularBalanceReserva(500, 0, [600])).toBe(-100)
  })
})

describe("calcularBalanceGeneralPorMoneda — pinned to app/clientes/balance/page.tsx:75-90", () => {
  /**
   * Verbatim transcription of the loop at app/clientes/balance/page.tsx:75-90,
   * operating on the same plain-object shape, so this test proves numeric
   * agreement rather than assuming it:
   *
   *   for (const reserva of reservasCliente) {
   *     const precio = Number(reserva.precio_total) || 0
   *     const abonado = Number(reserva.abonado_contabilidad) || 0
   *     const totalPagos = pagosReserva.reduce((sum, p) => sum + (Number(p.monto) || 0), 0)
   *     const balanceReserva = precio - abonado - totalPagos
   *     if ((reserva.moneda || "DOP") === "USD") balance_usd += balanceReserva
   *     else balance_rdp += balanceReserva
   *   }
   */
  function balancePageFormula(reservas: ReservaBalanceInput[]): { balance_rdp: number; balance_usd: number } {
    let balance_rdp = 0
    let balance_usd = 0
    for (const reserva of reservas) {
      const precio = Number(reserva.precioTotal) || 0
      const abonado = Number(reserva.abonadoContabilidad) || 0
      const totalPagos = reserva.pagos.reduce((sum, monto) => sum + (Number(monto) || 0), 0)
      const balanceReserva = precio - abonado - totalPagos
      if ((reserva.moneda || "DOP") === "USD") {
        balance_usd += balanceReserva
      } else {
        balance_rdp += balanceReserva
      }
    }
    return { balance_rdp, balance_usd }
  }

  it("agrees with /clientes/balance's formula for a multi-reserva, multi-currency, multi-payment client", () => {
    const reservas: ReservaBalanceInput[] = [
      { precioTotal: 1000, abonadoContabilidad: 200, pagos: [300, 100], moneda: "DOP" }, // balance 400
      { precioTotal: 500, abonadoContabilidad: 0, pagos: [], moneda: "DOP" }, // balance 500
      { precioTotal: 800, abonadoContabilidad: 100, pagos: [200], moneda: "USD" }, // balance 500
      { precioTotal: 300, abonadoContabilidad: 50, pagos: [50, 50], moneda: "USD" }, // balance 150
    ]

    const expected = balancePageFormula(reservas)
    const actual = calcularBalanceGeneralPorMoneda(reservas)

    expect(actual.DOP).toBeCloseTo(expected.balance_rdp, 2)
    expect(actual.USD).toBeCloseTo(expected.balance_usd, 2)
    expect(actual).toEqual({ DOP: 900, USD: 650 })
  })

  it("defaults moneda to DOP when absent, matching (reserva.moneda || \"DOP\")", () => {
    const reservas: ReservaBalanceInput[] = [{ precioTotal: 1000, abonadoContabilidad: 0, pagos: [400] }]

    expect(calcularBalanceGeneralPorMoneda(reservas)).toEqual({ DOP: 600, USD: 0 })
  })

  it("never mixes a DOP reserva's balance into the USD bucket or vice versa", () => {
    const reservas: ReservaBalanceInput[] = [
      { precioTotal: 100, abonadoContabilidad: 0, pagos: [], moneda: "DOP" },
      { precioTotal: 50, abonadoContabilidad: 0, pagos: [], moneda: "USD" },
    ]

    const result = calcularBalanceGeneralPorMoneda(reservas)
    expect(result.DOP).toBe(100)
    expect(result.USD).toBe(50)
  })

  it("returns 0.00 for a currency bucket with no reservas in it (computed, not defaulted)", () => {
    const reservas: ReservaBalanceInput[] = [{ precioTotal: 100, abonadoContabilidad: 0, pagos: [], moneda: "DOP" }]
    expect(calcularBalanceGeneralPorMoneda(reservas)).toEqual({ DOP: 100, USD: 0 })
  })

  it("empty reservas list returns { DOP: 0, USD: 0 }", () => {
    expect(calcularBalanceGeneralPorMoneda([])).toEqual({ DOP: 0, USD: 0 })
  })
})

describe("calcularBalanceReserva does NOT match /reservas/ver/[id]'s divergent formula", () => {
  /**
   * app/reservas/ver/[id]/page.tsx:177-191 computes:
   *   balance_general = precioTotal - totalPagosRealizados   (IGNORES abonado_contabilidad)
   * while /clientes/balance (and this helper) compute:
   *   balance = precioTotal - abonadoContabilidad - totalPagos
   * These agree only when abonado_contabilidad is 0. This test picks a case
   * where abonado_contabilidad is non-zero, so the two formulas disagree,
   * and pins that calcularBalanceReserva follows /clientes/balance — the
   * spec's explicit, human-decided choice (HC-3) — not /reservas/ver.
   */
  function reservasVerFormula(precioTotal: number, pagos: number[]): number {
    const totalPagosRealizados = pagos.reduce((sum, monto) => sum + (Number(monto) || 0), 0)
    return precioTotal - totalPagosRealizados
  }

  it("diverges from /reservas/ver/[id] when abonado_contabilidad is non-zero, and follows /clientes/balance", () => {
    const precioTotal = 1000
    const abonadoContabilidad = 200
    const pagos = [300]

    const ours = calcularBalanceReserva(precioTotal, abonadoContabilidad, pagos)
    const reservasVer = reservasVerFormula(precioTotal, pagos)

    expect(ours).toBe(500) // 1000 - 200 - 300, matching /clientes/balance
    expect(reservasVer).toBe(700) // 1000 - 300, ignoring abonado — the divergent formula
    expect(ours).not.toBe(reservasVer)
  })
})
