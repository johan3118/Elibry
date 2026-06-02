// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock @/lib/supabase for provisional-system.ts ───
const mockProvFrom = vi.fn()

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockProvFrom,
  })),
}))

import { crearRegistroProvisional } from "../lib/provisional-system"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the three-builder chain used by crearRegistroProvisional:
 *  1. maxId query  → .from(tabla).select("id").order(...).limit(1)
 *  2. insert query → .from(tabla).insert([...]).select().single()
 *  3. audit query  → .from("cambios_provisionales").insert([...]).select("id").single()
 *
 * Returns a `captureInsertArg` function that returns the payload passed to
 * the second builder's .insert() call (the actual record).
 */
function setupProvMocks(
  createdRecord: any,
  maxIdData: any[] = [{ id: 5 }],
): { captureInsertArg: () => any } {
  let capturedInsertArg: any = null

  const maxIdBuilder: any = {}
  maxIdBuilder.select = vi.fn(() => maxIdBuilder)
  maxIdBuilder.order = vi.fn(() => maxIdBuilder)
  maxIdBuilder.limit = vi.fn().mockResolvedValue({ data: maxIdData, error: null })

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
  auditBuilder.single = vi.fn().mockResolvedValue({ data: { id: 99 }, error: null })

  let callCount = 0
  mockProvFrom.mockImplementation((table: string) => {
    if (table === "cambios_provisionales") return auditBuilder
    callCount++
    if (callCount === 1) return maxIdBuilder
    return insertBuilder
  })

  return { captureInsertArg: () => capturedInsertArg }
}

function setupProvMocksWithInsertError(
  errorMessage: string,
  maxIdData: any[] = [{ id: 5 }],
) {
  const maxIdBuilder: any = {}
  maxIdBuilder.select = vi.fn(() => maxIdBuilder)
  maxIdBuilder.order = vi.fn(() => maxIdBuilder)
  maxIdBuilder.limit = vi.fn().mockResolvedValue({ data: maxIdData, error: null })

  const insertBuilder: any = {}
  insertBuilder.insert = vi.fn(() => insertBuilder)
  insertBuilder.select = vi.fn(() => insertBuilder)
  insertBuilder.single = vi.fn().mockResolvedValue({
    data: null,
    error: { message: errorMessage },
  })

  let callCount = 0
  mockProvFrom.mockImplementation((table: string) => {
    if (table === "cambios_provisionales") return insertBuilder
    callCount++
    if (callCount === 1) return maxIdBuilder
    return insertBuilder
  })
}

// ─────────────────────────────────────────────────────────────────────────────
describe("crearRegistroProvisional('reservas', ...) — cliente_id coercion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy path — returns success: true with created record", async () => {
    const createdRecord = {
      id: 6,
      cliente_id: null,
      producto_id: null,
      estado_registro: "PROVISIONAL",
    }
    setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "reservas",
      {
        cliente_id: "0",
        producto_id: "0",
        precio_total: 1500,
        status: "PENDIENTE",
      },
      "agente@test.com",
    )

    expect(result.success).toBe(true)
    expect(result.data).toEqual(createdRecord)
  })

  it("coerces cliente_id '0' (string) to null in the insert payload", async () => {
    const createdRecord = { id: 6, cliente_id: null, estado_registro: "PROVISIONAL" }
    const { captureInsertArg } = setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "reservas",
      { cliente_id: "0", producto_id: "3", precio_total: 1000 },
      "agente@test.com",
    )

    expect(result.success).toBe(true)
    const payload = captureInsertArg()
    expect(payload).not.toBeNull()
    expect(payload[0].cliente_id).toBeNull()
  })

  it("coerces producto_id '0' (string) to null in the insert payload", async () => {
    const createdRecord = { id: 7, producto_id: null, estado_registro: "PROVISIONAL" }
    const { captureInsertArg } = setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "reservas",
      { cliente_id: "5", producto_id: "0", precio_total: 2000 },
      "agente@test.com",
    )

    expect(result.success).toBe(true)
    const payload = captureInsertArg()
    expect(payload).not.toBeNull()
    expect(payload[0].producto_id).toBeNull()
  })

  it("coerces both cliente_id and producto_id '0' to null simultaneously", async () => {
    const createdRecord = { id: 8, cliente_id: null, producto_id: null, estado_registro: "PROVISIONAL" }
    const { captureInsertArg } = setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "reservas",
      { cliente_id: "0", producto_id: "0", precio_total: 500 },
      "agente@test.com",
    )

    expect(result.success).toBe(true)
    const payload = captureInsertArg()
    expect(payload[0].cliente_id).toBeNull()
    expect(payload[0].producto_id).toBeNull()
  })

  it("coerces cliente_id empty string to null", async () => {
    const createdRecord = { id: 9, cliente_id: null, estado_registro: "PROVISIONAL" }
    const { captureInsertArg } = setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "reservas",
      { cliente_id: "", producto_id: "2", precio_total: 750 },
      "agente@test.com",
    )

    expect(result.success).toBe(true)
    const payload = captureInsertArg()
    expect(payload[0].cliente_id).toBeNull()
  })

  it("coerces producto_id empty string to null", async () => {
    const createdRecord = { id: 10, producto_id: null, estado_registro: "PROVISIONAL" }
    const { captureInsertArg } = setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "reservas",
      { cliente_id: "3", producto_id: "", precio_total: 800 },
      "agente@test.com",
    )

    expect(result.success).toBe(true)
    const payload = captureInsertArg()
    expect(payload[0].producto_id).toBeNull()
  })

  it("preserves valid non-zero cliente_id and producto_id values", async () => {
    const createdRecord = { id: 11, cliente_id: 3, producto_id: 7, estado_registro: "PROVISIONAL" }
    const { captureInsertArg } = setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "reservas",
      { cliente_id: 3, producto_id: 7, precio_total: 3000 },
      "agente@test.com",
    )

    expect(result.success).toBe(true)
    const payload = captureInsertArg()
    expect(payload[0].cliente_id).toBe(3)
    expect(payload[0].producto_id).toBe(7)
  })

  it("error path — returns success: false when Supabase insert fails", async () => {
    setupProvMocksWithInsertError("Foreign key violation")

    const result = await crearRegistroProvisional(
      "reservas",
      { cliente_id: "0", producto_id: "0", precio_total: 500 },
      "agente@test.com",
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe("Foreign key violation")
  })

  it("error path — returns success: false when maxId query fails with exception", async () => {
    mockProvFrom.mockImplementation(() => {
      throw new Error("DB unreachable")
    })

    const result = await crearRegistroProvisional(
      "reservas",
      { cliente_id: "0", precio_total: 100 },
      "agente@test.com",
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe("Error inesperado al crear el registro")
  })
})
