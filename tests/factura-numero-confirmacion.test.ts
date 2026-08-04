// @vitest-environment node
/**
 * Task 1 — pins the FACTURA # two-outcome seam (ADR-0012,
 * docs/plans/factura-numero-lookup-contract.md AC-1…AC-5).
 *
 * Imports the REAL unit (never a hand-copied stand-in — fake-green-tests #7)
 * in the node environment, exactly like tests/proforma-page.test.ts. Every
 * test builds its OWN fresh vi.fn() notifier: no shared, mutated-in-place mock
 * (#1). No readFileSync/regex-on-source assertion lives here (#4) — the
 * one-emission-site check is a repo grep owned by Task 2, not a test.
 */
import { describe, it, expect, vi } from "vitest"
import type { FacturaNumeroResult } from "@/app/actions/documentos-actions"
import {
  TITULO_ERROR_TECNICO_COMPROBANTE,
  resolverFacturaNumeroConfirmacion,
} from "@/lib/factura-numero-confirmacion"

// Fixtures shaped exactly like getFacturaNumeroPorReservaAction's real union
// (app/actions/documentos-actions.ts:967-985). The messages are the action's
// own verbatim strings, used here as INPUT data only — this file never
// re-implements how they are built.
const MENSAJE_SIN_COMPROBANTE = "FACTURA #: esta reserva no tiene comprobante fiscal asignado"
const DETALLE_TECNICO = "comprobantes_fiscales no tiene la columna numero_factura"
const MENSAJE_LOOKUP_FAILED = `FACTURA #: no se pudo consultar el comprobante fiscal — problema técnico, no de datos: ${DETALLE_TECNICO}`

const RESULTADO_OK: FacturaNumeroResult = { ok: true, numeroFactura: "B0100000123" }

const RESULTADO_SIN_COMPROBANTE: FacturaNumeroResult = {
  ok: false,
  reason: "SIN_COMPROBANTE",
  message: MENSAJE_SIN_COMPROBANTE,
}

const RESULTADO_LOOKUP_FAILED: FacturaNumeroResult = {
  ok: false,
  reason: "LOOKUP_FAILED",
  detail: DETALLE_TECNICO,
  message: MENSAJE_LOOKUP_FAILED,
}

describe("resolverFacturaNumeroConfirmacion", () => {
  it("AC-1 — SIN_COMPROBANTE (the normal state) notifies NOBODY and yields null", () => {
    const notificar = vi.fn()

    const valor = resolverFacturaNumeroConfirmacion(RESULTADO_SIN_COMPROBANTE, notificar)

    // Order is load-bearing (fake-green-tests #10): the strongest structural
    // claim — "a reserva without a comprobante NEVER alarms the operator" —
    // must be the first thing that can fail.
    expect(notificar).toHaveBeenCalledTimes(0)
    expect(valor).toBeNull()
  })

  it("AC-2 — LOOKUP_FAILED emits exactly one destructive notification and yields null", () => {
    const notificar = vi.fn()

    const valor = resolverFacturaNumeroConfirmacion(RESULTADO_LOOKUP_FAILED, notificar)

    expect(notificar).toHaveBeenCalledTimes(1)
    // Deep-equal on the FULL object: no objectContaining, no substring match.
    // `description` is the action's own message verbatim, technical detail
    // included, so the operator can tell an engineering fault from a
    // data-entry gap without opening the console.
    expect(notificar).toHaveBeenCalledWith({
      title: "Error técnico al consultar el comprobante fiscal",
      description: MENSAJE_LOOKUP_FAILED,
      variant: "destructive",
    })
    expect(valor).toBeNull()
  })

  it("AC-2 — the emitted title is the module's single exported constant", () => {
    const notificar = vi.fn()

    resolverFacturaNumeroConfirmacion(RESULTADO_LOOKUP_FAILED, notificar)

    expect(TITULO_ERROR_TECNICO_COMPROBANTE).toBe("Error técnico al consultar el comprobante fiscal")
    expect(notificar.mock.calls[0]![0]!.title).toBe(TITULO_ERROR_TECNICO_COMPROBANTE)
  })

  it("AC-5 — ok returns the comprobante number CARRIED BY THE RESULT, and notifies nobody", () => {
    const notificar = vi.fn()

    const valor = resolverFacturaNumeroConfirmacion(RESULTADO_OK, notificar)

    expect(notificar).toHaveBeenCalledTimes(0)
    expect(valor).toBe("B0100000123")
  })

  it("AC-5 — ok returns THIS result's number, not a constant: a second fixture in a DIFFERENT NCF series", () => {
    const notificar = vi.fn()

    // The two ok fixtures must differ in the SERIES ("B010" crédito fiscal vs
    // "B020" consumo — both real blocks in comprobantes_disponibles per
    // ADR-0012), not only in the trailing sequence. Two fixtures sharing a
    // prefix let a mutant that pins the series ("B01" + …slice(3)) survive,
    // and the series is the fiscally meaningful part: a series regression
    // prints the WRONG COMPROBANTE TYPE on a DGII-adjacent document. This
    // fixture lives in its OWN `it` so its 0-calls claim stays reachable even
    // when the value assertion fails (fake-green-tests #10).
    const RESULTADO_OK_2: FacturaNumeroResult = { ok: true, numeroFactura: "B0200000999" }

    const valor = resolverFacturaNumeroConfirmacion(RESULTADO_OK_2, notificar)

    expect(notificar).toHaveBeenCalledTimes(0)
    expect(valor).toBe("B0200000999")
  })

  it("AC-5 — both failure shapes yield exactly null, never a placeholder", () => {
    // stockin-zero-price cuts both ways: null is the LEGITIMATE value here
    // (the document renders `FACTURA #:` blank), so "", "N/A" and a fabricated
    // date are all wrong — and so would be blocking generation.
    const notificarSin = vi.fn()
    const notificarFallo = vi.fn()

    const valorSin = resolverFacturaNumeroConfirmacion(RESULTADO_SIN_COMPROBANTE, notificarSin)
    const valorFallo = resolverFacturaNumeroConfirmacion(RESULTADO_LOOKUP_FAILED, notificarFallo)

    expect(valorSin).toBeNull()
    expect(valorFallo).toBeNull()
  })

  it("AC-4 — never throws, for any of the three result shapes", () => {
    const notificarOk = vi.fn()
    const notificarSin = vi.fn()
    const notificarFallo = vi.fn()

    expect(() => resolverFacturaNumeroConfirmacion(RESULTADO_OK, notificarOk)).not.toThrow()
    expect(() => resolverFacturaNumeroConfirmacion(RESULTADO_SIN_COMPROBANTE, notificarSin)).not.toThrow()
    expect(() => resolverFacturaNumeroConfirmacion(RESULTADO_LOOKUP_FAILED, notificarFallo)).not.toThrow()
  })
})
