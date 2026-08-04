// @vitest-environment node
import { describe, it, expect } from "vitest"
import { buildCierreOptimista } from "../lib/crm-casos-logic"

// ─────────────────────────────────────────────────────────────────────────────
// CR2 regression test: the optimistic patch applied to a case on close must
// include comentario_cierre so the closing-comment box (which keys off
// casoSeleccionado.comentario_cierre) renders immediately, without a reload.
// ─────────────────────────────────────────────────────────────────────────────
describe("buildCierreOptimista", () => {
  it("includes comentario_cierre when a closing comment was provided", () => {
    const result = buildCierreOptimista("Maria", "2026-07-06T10:00:00.000Z", "Caso resuelto satisfactoriamente")

    expect(result).toEqual({
      estado: "CERRADO",
      cerrado_por: "Maria",
      fecha_cierre: "2026-07-06T10:00:00.000Z",
      comentario_cierre: "Caso resuelto satisfactoriamente",
    })
  })

  it("sets comentario_cierre to undefined (not an empty string) when no comment was provided", () => {
    const result = buildCierreOptimista("Maria", "2026-07-06T10:00:00.000Z", "")

    expect(result.comentario_cierre).toBeUndefined()
  })

  it("always sets estado to 'CERRADO'", () => {
    const result = buildCierreOptimista("Juan", "2026-07-06T10:00:00.000Z", "")
    expect(result.estado).toBe("CERRADO")
  })

  it("preserves cerrado_por and fecha_cierre exactly as passed in", () => {
    const result = buildCierreOptimista("Ana Lopez", "2026-07-05T23:59:59.000Z", "listo")
    expect(result.cerrado_por).toBe("Ana Lopez")
    expect(result.fecha_cierre).toBe("2026-07-05T23:59:59.000Z")
  })
})
