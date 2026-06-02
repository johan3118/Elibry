// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock @supabase/supabase-js for crm-actions.ts (direct Supabase calls) ───
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

// ─── Mock @/lib/supabase for provisional-system.ts ───
const mockProvFrom = vi.fn()

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockProvFrom,
  })),
}))

import {
  crearProductoAction,
  actualizarProductoAction,
} from "../app/actions/crm-actions"

import {
  crearRegistroProvisional,
} from "../lib/provisional-system"

// ─────────────────────────────────────────────────────────────────────────────
describe("crearProductoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryBuilder = makeQueryBuilder()
    mockFrom.mockReturnValue(queryBuilder)
  })

  it("happy path — returns success: true with inserted data", async () => {
    const fakeData = [{ id: 10, nombre_producto: "Hotel Caribe", suplidor_id: 5 }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    const result = await crearProductoAction({ nombre_producto: "Hotel Caribe", suplidor_id: 5 })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(fakeData)
  })

  it("error path — returns success: false when Supabase returns an error", async () => {
    queryBuilder.select.mockResolvedValue({
      data: null,
      error: { message: "Not null violation" },
    })

    const result = await crearProductoAction({ nombre_producto: "" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Not null violation")
  })

  it("error path — returns success: false on unexpected exception", async () => {
    queryBuilder.select.mockRejectedValue(new Error("Service unavailable"))

    const result = await crearProductoAction({ nombre_producto: "Crash" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Service unavailable")
  })

  it("calls supabase.from('productos') and chains insert → select", async () => {
    const payload = { nombre_producto: "Tour del Caribe", tipo: "TOUR" }
    const fakeData = [{ id: 11, ...payload }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await crearProductoAction(payload)

    expect(mockFrom).toHaveBeenCalledWith("productos")
    expect(queryBuilder.insert).toHaveBeenCalledWith([payload])
    expect(queryBuilder.select).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("actualizarProductoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryBuilder = makeQueryBuilder()
    mockFrom.mockReturnValue(queryBuilder)
  })

  it("happy path — returns success: true with updated data", async () => {
    const fakeData = [{ id: 10, nombre_producto: "Hotel Actualizado" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    const result = await actualizarProductoAction(10, { nombre_producto: "Hotel Actualizado" })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(fakeData)
  })

  it("error path — returns success: false when Supabase returns an error", async () => {
    queryBuilder.select.mockResolvedValue({
      data: null,
      error: { message: "Record not found" },
    })

    const result = await actualizarProductoAction(999, { nombre_producto: "Ghost" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Record not found")
  })

  it("error path — returns success: false on unexpected exception", async () => {
    queryBuilder.select.mockRejectedValue(new Error("DB timeout"))

    const result = await actualizarProductoAction(10, { nombre_producto: "Boom" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("DB timeout")
  })

  it("calls supabase.from('productos') and chains update → eq → select", async () => {
    const fakeData = [{ id: 10, nombre_producto: "Paquete Caribe" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await actualizarProductoAction(10, { nombre_producto: "Paquete Caribe" })

    expect(mockFrom).toHaveBeenCalledWith("productos")
    expect(queryBuilder.update).toHaveBeenCalledWith({ nombre_producto: "Paquete Caribe" })
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", 10)
    expect(queryBuilder.select).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// suplidor_id coercion: crearRegistroProvisional("productos", {suplidor_id: "0"}, ...)
// must insert null (not "0") into the productos table.
// ─────────────────────────────────────────────────────────────────────────────
describe("crearRegistroProvisional — suplidor_id coercion for productos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Helper that sets up mockProvFrom for crearRegistroProvisional.
   * Returns the captured insert argument so tests can assert on it.
   */
  function setupProvMocks(createdRecord: any): { captureInsertArg: () => any } {
    let capturedInsertArg: any = null

    const maxIdBuilder: any = {}
    maxIdBuilder.select = vi.fn(() => maxIdBuilder)
    maxIdBuilder.order = vi.fn(() => maxIdBuilder)
    maxIdBuilder.limit = vi.fn().mockResolvedValue({ data: [{ id: 5 }], error: null })

    const insertBuilder: any = {}
    insertBuilder.insert = vi.fn((arg: any) => {
      capturedInsertArg = arg
      return insertBuilder
    })
    insertBuilder.select = vi.fn(() => insertBuilder)
    insertBuilder.single = vi.fn().mockResolvedValue({ data: createdRecord, error: null })

    const auditBuilder: any = {}
    auditBuilder.insert = vi.fn(() => auditBuilder)
    auditBuilder.select = vi.fn(() => auditBuilder)
    auditBuilder.single = vi.fn().mockResolvedValue({ data: { id: 100 }, error: null })

    let callCount = 0
    mockProvFrom.mockImplementation((table: string) => {
      if (table === "cambios_provisionales") return auditBuilder
      callCount++
      if (callCount === 1) return maxIdBuilder
      return insertBuilder
    })

    return { captureInsertArg: () => capturedInsertArg }
  }

  it("coerces suplidor_id '0' (string) to null in the insert payload", async () => {
    const { captureInsertArg } = setupProvMocks({
      id: 6,
      nombre_producto: "Hotel X",
      suplidor_id: null,
      estado_registro: "PROVISIONAL",
    })

    const result = await crearRegistroProvisional(
      "productos",
      { nombre_producto: "Hotel X", suplidor_id: "0" },
      "admin@test.com",
    )

    expect(result.success).toBe(true)
    const insertedPayload = captureInsertArg()
    expect(insertedPayload).not.toBeNull()
    // The array passed to .insert([datosConEstado])
    expect(insertedPayload[0].suplidor_id).toBeNull()
  })

  it("coerces suplidor_id 0 (number zero) to null in the insert payload", async () => {
    const { captureInsertArg } = setupProvMocks({
      id: 7,
      nombre_producto: "Hotel Y",
      suplidor_id: null,
      estado_registro: "PROVISIONAL",
    })

    const result = await crearRegistroProvisional(
      "productos",
      { nombre_producto: "Hotel Y", suplidor_id: 0 },
      "admin@test.com",
    )

    expect(result.success).toBe(true)
    const insertedPayload = captureInsertArg()
    expect(insertedPayload[0].suplidor_id).toBeNull()
  })

  it("coerces suplidor_id empty string to null in the insert payload", async () => {
    const { captureInsertArg } = setupProvMocks({
      id: 8,
      nombre_producto: "Hotel Z",
      suplidor_id: null,
      estado_registro: "PROVISIONAL",
    })

    const result = await crearRegistroProvisional(
      "productos",
      { nombre_producto: "Hotel Z", suplidor_id: "" },
      "admin@test.com",
    )

    expect(result.success).toBe(true)
    const insertedPayload = captureInsertArg()
    expect(insertedPayload[0].suplidor_id).toBeNull()
  })

  it("preserves a valid numeric suplidor_id (e.g. '3' → 3)", async () => {
    const { captureInsertArg } = setupProvMocks({
      id: 9,
      nombre_producto: "Hotel W",
      suplidor_id: 3,
      estado_registro: "PROVISIONAL",
    })

    const result = await crearRegistroProvisional(
      "productos",
      { nombre_producto: "Hotel W", suplidor_id: "3" },
      "admin@test.com",
    )

    expect(result.success).toBe(true)
    const insertedPayload = captureInsertArg()
    expect(insertedPayload[0].suplidor_id).toBe(3)
  })

  it("does NOT coerce suplidor_id for non-productos tables", async () => {
    const { captureInsertArg } = setupProvMocks({
      id: 10,
      razon_social: "Test Suplidor",
      suplidor_id: "0",
      estado_registro: "PROVISIONAL",
    })

    const result = await crearRegistroProvisional(
      "suplidores",
      { razon_social: "Test Suplidor", suplidor_id: "0" },
      "admin@test.com",
    )

    expect(result.success).toBe(true)
    const insertedPayload = captureInsertArg()
    // suplidores table should NOT have its suplidor_id coerced
    expect(insertedPayload[0].suplidor_id).toBe("0")
  })
})
