// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock @supabase/supabase-js so crm-actions.ts never makes real network calls ───
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

import {
  crearSuplidorAction,
  actualizarSuplidorAction,
} from "../app/actions/crm-actions"

// ─────────────────────────────────────────────────────────────────────────────
describe("crearSuplidorAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryBuilder = makeQueryBuilder()
    mockFrom.mockReturnValue(queryBuilder)
  })

  it("happy path — returns success: true with inserted data", async () => {
    const fakeData = [{ id: 42, razon_social: "Proveedor S.A." }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    const result = await crearSuplidorAction({ razon_social: "Proveedor S.A." })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(fakeData)
  })

  it("error path — returns success: false when Supabase returns an error", async () => {
    queryBuilder.select.mockResolvedValue({
      data: null,
      error: { message: "Permission denied" },
    })

    const result = await crearSuplidorAction({ razon_social: "Bad Suplidor" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Permission denied")
  })

  it("error path — returns success: false on unexpected exception", async () => {
    queryBuilder.select.mockRejectedValue(new Error("Connection refused"))

    const result = await crearSuplidorAction({ razon_social: "Crash" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Connection refused")
  })

  it("calls supabase.from('suplidores') and chains insert → select", async () => {
    const payload = { razon_social: "Viajes Globales S.R.L.", pais: "DO" }
    const fakeData = [{ id: 7, ...payload }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await crearSuplidorAction(payload)

    expect(mockFrom).toHaveBeenCalledWith("suplidores")
    expect(queryBuilder.insert).toHaveBeenCalledWith([payload])
    expect(queryBuilder.select).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("actualizarSuplidorAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryBuilder = makeQueryBuilder()
    mockFrom.mockReturnValue(queryBuilder)
  })

  it("happy path — returns success: true with updated data", async () => {
    const fakeData = [{ id: 3, razon_social: "Suplidor Actualizado" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    const result = await actualizarSuplidorAction(3, { razon_social: "Suplidor Actualizado" })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(fakeData)
  })

  it("error path — returns success: false when Supabase returns an error", async () => {
    queryBuilder.select.mockResolvedValue({
      data: null,
      error: { message: "Row not found" },
    })

    const result = await actualizarSuplidorAction(999, { razon_social: "Ghost" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Row not found")
  })

  it("error path — returns success: false on unexpected exception", async () => {
    queryBuilder.select.mockRejectedValue(new Error("Timeout"))

    const result = await actualizarSuplidorAction(3, { razon_social: "Crash" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Timeout")
  })

  it("calls supabase.from('suplidores') and chains update → eq → select", async () => {
    const fakeData = [{ id: 3, razon_social: "Updated" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await actualizarSuplidorAction(3, { razon_social: "Updated" })

    expect(mockFrom).toHaveBeenCalledWith("suplidores")
    expect(queryBuilder.update).toHaveBeenCalledWith({ razon_social: "Updated" })
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", 3)
    expect(queryBuilder.select).toHaveBeenCalled()
  })
})
