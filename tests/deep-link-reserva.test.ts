// @vitest-environment node
/**
 * Task 5 — `?reserva_id=` deep-link resolution shared by the PROFORMA and
 * VOUCHER pages.
 */
import { describe, it, expect } from "vitest"
import { resolverReservaDeepLink } from "@/lib/deep-link-reserva"

// Two elements on purpose: a bug that always returns the first reserva cannot
// pass this fixture.
const RESERVAS = [
  { id: 7, codigo: "RES-007" },
  { id: 9, codigo: "RES-009" },
]

describe("resolverReservaDeepLink", () => {
  it("reports sin-param when there is no usable parameter", () => {
    expect(resolverReservaDeepLink(null, RESERVAS)).toEqual({ estado: "sin-param" })
    expect(resolverReservaDeepLink(undefined, RESERVAS)).toEqual({ estado: "sin-param" })
    expect(resolverReservaDeepLink("", RESERVAS)).toEqual({ estado: "sin-param" })
    expect(resolverReservaDeepLink("   ", RESERVAS)).toEqual({ estado: "sin-param" })
  })

  it("finds the reserva whose numeric id matches — not merely the first one", () => {
    expect(resolverReservaDeepLink("7", RESERVAS)).toEqual({ estado: "encontrada", reserva: RESERVAS[0] })
    expect(resolverReservaDeepLink("9", RESERVAS)).toEqual({ estado: "encontrada", reserva: RESERVAS[1] })
  })

  it("reports no-encontrada, naming the param, for an id that does not exist", () => {
    expect(resolverReservaDeepLink("999", RESERVAS)).toEqual({ estado: "no-encontrada", param: "999" })
    expect(resolverReservaDeepLink("7", [])).toEqual({ estado: "no-encontrada", param: "7" })
  })

  it("rejects a non-numeric param instead of coercing it", () => {
    // Mutation guard: `Number(param)` without the isFinite/isInteger test
    // makes "abc" produce NaN, which then silently matches nothing (or worse,
    // a NaN-keyed row). It must be an explicit no-encontrada, so the caller
    // toasts.
    expect(resolverReservaDeepLink("abc", RESERVAS)).toEqual({ estado: "no-encontrada", param: "abc" })
    expect(resolverReservaDeepLink("7.5", RESERVAS)).toEqual({ estado: "no-encontrada", param: "7.5" })
    expect(resolverReservaDeepLink("Infinity", RESERVAS)).toEqual({ estado: "no-encontrada", param: "Infinity" })
    expect(resolverReservaDeepLink("7abc", RESERVAS)).toEqual({ estado: "no-encontrada", param: "7abc" })
  })

  it("returns the caller's own reserva object by reference, not a copy", () => {
    const resultado = resolverReservaDeepLink("9", RESERVAS)
    expect(resultado.estado).toBe("encontrada")
    if (resultado.estado === "encontrada") {
      expect(resultado.reserva).toBe(RESERVAS[1])
    }
  })
})
