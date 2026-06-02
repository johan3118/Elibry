// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock @supabase/supabase-js so cerrarCasoAction never makes real network calls ───
function makeQueryBuilder() {
  const builder: any = {}
  builder.update = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)
  return builder
}

let queryBuilder = makeQueryBuilder()
const mockFrom = vi.fn(() => queryBuilder)

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { cerrarCasoAction } from "../app/actions/crm-actions"

// ─────────────────────────────────────────────────────────────────────────────
describe("cerrarCasoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryBuilder = makeQueryBuilder()
    mockFrom.mockReturnValue(queryBuilder)
  })

  it("happy path — returns success: true with data on successful close", async () => {
    const fakeData = [{ id: 7, estado: "CERRADO", cerrado_por: "Maria" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    const result = await cerrarCasoAction(7, "Maria", "comentario de cierre")

    expect(result.success).toBe(true)
    expect(result.data).toEqual(fakeData)
  })

  it("mocked update payload has cerrado_por equal to the cerradoPor argument", async () => {
    const fakeData = [{ id: 10, estado: "CERRADO", cerrado_por: "Maria" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await cerrarCasoAction(10, "Maria", "comentario")

    // The .update() call must include cerrado_por: "Maria"
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ cerrado_por: "Maria" }),
    )
  })

  it("'Usuario Actual' never appears in any Supabase call payload", async () => {
    const fakeData = [{ id: 10, estado: "CERRADO", cerrado_por: "Maria" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await cerrarCasoAction(10, "Maria", "comentario")

    // Collect all arguments passed to .update() calls and check none contain "Usuario Actual"
    const allUpdateArgs = queryBuilder.update.mock.calls.map((call: any[]) => JSON.stringify(call))
    const allUpdateArgsStr = allUpdateArgs.join(" ")
    expect(allUpdateArgsStr).not.toContain("Usuario Actual")
  })

  it("cerrado_por is exactly the string passed — not a hardcoded fallback", async () => {
    const fakeData = [{ id: 11, estado: "CERRADO", cerrado_por: "Juan Perez" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await cerrarCasoAction(11, "Juan Perez")

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ cerrado_por: "Juan Perez" }),
    )
  })

  it("passes optional comentarioCierre as comentario_cierre in update payload", async () => {
    const fakeData = [{ id: 12, estado: "CERRADO" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await cerrarCasoAction(12, "Ana Lopez", "Caso resuelto satisfactoriamente")

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        comentario_cierre: "Caso resuelto satisfactoriamente",
      }),
    )
  })

  it("when comentarioCierre is omitted, comentario_cierre is null", async () => {
    const fakeData = [{ id: 13, estado: "CERRADO" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await cerrarCasoAction(13, "Pedro Martinez")

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        comentario_cierre: null,
      }),
    )
  })

  it("update payload includes estado: 'CERRADO'", async () => {
    const fakeData = [{ id: 14, estado: "CERRADO" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await cerrarCasoAction(14, "Maria", "test")

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "CERRADO" }),
    )
  })

  it("calls supabase.from('seguimiento_casos') and chains update → eq → select", async () => {
    const fakeData = [{ id: 15, estado: "CERRADO" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await cerrarCasoAction(15, "Maria")

    expect(mockFrom).toHaveBeenCalledWith("seguimiento_casos")
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", 15)
    expect(queryBuilder.select).toHaveBeenCalled()
  })

  it("DB error path — returns { success: false, error } when Supabase returns an error", async () => {
    queryBuilder.select.mockResolvedValue({
      data: null,
      error: { message: "Row not found" },
    })

    const result = await cerrarCasoAction(999, "Maria", "comentario")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Row not found")
  })

  it("DB error path — returns success: false on unexpected exception", async () => {
    queryBuilder.select.mockRejectedValue(new Error("Network failure"))

    const result = await cerrarCasoAction(1, "Maria", "test")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Network failure")
  })

  it("accepts casoId as string", async () => {
    const fakeData = [{ id: 999, estado: "CERRADO" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    const result = await cerrarCasoAction(999, "Maria")

    expect(result.success).toBe(true)
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", 999)
  })
})
