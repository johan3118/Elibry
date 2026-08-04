// @vitest-environment node
/**
 * Task 4 — PROFORMA's own passenger list: seeding + fetch-failure handling.
 *
 * Follows this repo's established page-logic test precedent
 * (tests/voucher-page.test.ts, tests/crm-casos-page.test.ts): the decision is
 * extracted as a pure exported function from the page module and imported
 * directly in the node environment. There is no jsdom/RTL harness in this
 * repo and introducing one is out of this sprint's scope.
 */
import { describe, it, expect } from "vitest"
import { filasBlancasParaPasajeros, resolverPasajerosParaEditor } from "@/app/facturacion/proforma/page"

describe("filasBlancasParaPasajeros — how many blank rows PROFORMA opens with", () => {
  it("seeds exactly reservas.pasajeros rows when it is a finite integer >= 1", () => {
    expect(filasBlancasParaPasajeros(3)).toHaveLength(3)
    expect(filasBlancasParaPasajeros(1)).toHaveLength(1)
    expect(filasBlancasParaPasajeros(7)).toHaveLength(7)
  })

  it("falls back to exactly 1 row for every non-usable count", () => {
    // Mutation guard: swapping the Number.isFinite/Number.isInteger test for
    // `pasajerosReserva || 1` makes 2.5 and NaN produce the wrong shape.
    expect(filasBlancasParaPasajeros(0)).toHaveLength(1)
    expect(filasBlancasParaPasajeros(null)).toHaveLength(1)
    expect(filasBlancasParaPasajeros(undefined)).toHaveLength(1)
    expect(filasBlancasParaPasajeros(-2)).toHaveLength(1)
    expect(filasBlancasParaPasajeros(2.5)).toHaveLength(1)
    expect(filasBlancasParaPasajeros(Number.NaN)).toHaveLength(1)
    expect(filasBlancasParaPasajeros(Number.POSITIVE_INFINITY)).toHaveLength(1)
  })

  it("never fabricates a passenger name — every seeded row is blank ADULTO/unlinked", () => {
    const filas = filasBlancasParaPasajeros(4)
    expect(filas).toHaveLength(4)
    for (const fila of filas) {
      expect(fila.nombreCompleto).toBe("")
      expect(fila.tipoPax).toBe("ADULTO")
      expect(fila.ocupacionId).toBeNull()
    }
  })

  it("returns independent row objects, so editing one row cannot mutate another", () => {
    const filas = filasBlancasParaPasajeros(2)
    filas[0].nombreCompleto = "ANA A"
    expect(filas[1].nombreCompleto).toBe("")
  })
})

describe("resolverPasajerosParaEditor — what the dialog shows on open", () => {
  it("maps the persisted PROFORMA rows verbatim, in the order received", () => {
    // Two DIFFERENT names, so a bug that repeats one row cannot pass.
    const resultado = {
      success: true,
      data: [
        { nombre_completo: "ANA A", tipo_pax: "ADULTO", ocupacion_id: 11 },
        { nombre_completo: "LUIS B", tipo_pax: "NINO", ocupacion_id: null },
      ],
    }

    expect(resolverPasajerosParaEditor(resultado, 5)).toEqual([
      { nombreCompleto: "ANA A", tipoPax: "ADULTO", ocupacionId: 11 },
      { nombreCompleto: "LUIS B", tipoPax: "NINO", ocupacionId: null },
    ])
  })

  it("normalizes a missing ocupacion_id to null rather than undefined", () => {
    const resultado = { success: true, data: [{ nombre_completo: "ANA A", tipo_pax: "ADULTO" }] }
    expect(resolverPasajerosParaEditor(resultado, 1)![0]!.ocupacionId).toBeNull()
  })

  it("seeds blank rows when the read succeeded but PROFORMA has no rows yet", () => {
    expect(resolverPasajerosParaEditor({ success: true, data: [] }, 3)).toEqual(filasBlancasParaPasajeros(3))
    expect(resolverPasajerosParaEditor({ success: true, data: [] }, 3)).toHaveLength(3)
    expect(resolverPasajerosParaEditor({ success: true, data: null }, 2)).toHaveLength(2)
    expect(resolverPasajerosParaEditor({ success: true }, null)).toHaveLength(1)
  })

  it("returns null — NOT blank rows — when the read FAILED", () => {
    // Mutation guard: returning blanks on failure makes a technical failure
    // indistinguishable from "this reserva has no passengers", which is the
    // exact silent-failure class this sprint exists to remove. The caller
    // relies on null to fire its destructive toast.
    expect(resolverPasajerosParaEditor({ success: false }, 3)).toBeNull()
    expect(resolverPasajerosParaEditor({ success: false, data: [] }, 3)).toBeNull()
    // Even a failure carrying rows must not be trusted.
    expect(
      resolverPasajerosParaEditor({ success: false, data: [{ nombre_completo: "ANA A", tipo_pax: "ADULTO" }] }, 3),
    ).toBeNull()
  })

  it("does not fabricate names when seeding from an empty successful read", () => {
    const filas = resolverPasajerosParaEditor({ success: true, data: [] }, 2)!
    expect(filas.map((f) => f.nombreCompleto)).toEqual(["", ""])
  })
})
