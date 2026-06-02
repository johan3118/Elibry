// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock @supabase/supabase-js so crm-actions.ts never makes real network calls ───
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockSingle = vi.fn()

// Build a chainable query builder mock
function makeQueryBuilder() {
  const builder: any = {}
  builder.update = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)
  // Default resolution — tests override this
  builder.then = undefined
  return builder
}

let queryBuilder = makeQueryBuilder()

const mockFrom = vi.fn(() => queryBuilder)

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// ─── Mock @/lib/supabase for crearRegistroProvisional ───
const mockProvFrom = vi.fn()

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockProvFrom,
  })),
}))

import {
  actualizarClienteAction,
} from "../app/actions/crm-actions"

import {
  crearRegistroProvisional,
} from "../lib/provisional-system"

// ─────────────────────────────────────────────────────────────────────────────
describe("actualizarClienteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryBuilder = makeQueryBuilder()
    mockFrom.mockReturnValue(queryBuilder)
  })

  it("happy path — returns success: true with data on successful update", async () => {
    const fakeData = [{ id: 1, nombre_completo: "Test Client" }]
    // The chain: .from().update().eq().select() returns a promise resolving to { data, error }
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    const result = await actualizarClienteAction(1, { nombre_completo: "Test Client" })

    expect(result.success).toBe(true)
    expect(result.data).toEqual(fakeData)
    expect(result.error).toBeUndefined()
  })

  it("error path — returns success: false with error message on Supabase error", async () => {
    queryBuilder.select.mockResolvedValue({
      data: null,
      error: { message: "Foreign key violation" },
    })

    const result = await actualizarClienteAction(1, { nombre_completo: "Bad Client" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Foreign key violation")
  })

  it("error path — returns success: false when an unexpected exception is thrown", async () => {
    queryBuilder.select.mockRejectedValue(new Error("Network timeout"))

    const result = await actualizarClienteAction(1, { nombre_completo: "Boom" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Network timeout")
  })

  it("calls supabase.from('clientes') and chains update → eq → select", async () => {
    const fakeData = [{ id: 5, nombre_completo: "María García" }]
    queryBuilder.select.mockResolvedValue({ data: fakeData, error: null })

    await actualizarClienteAction(5, { nombre_completo: "María García" })

    expect(mockFrom).toHaveBeenCalledWith("clientes")
    expect(queryBuilder.update).toHaveBeenCalledWith({ nombre_completo: "María García" })
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", 5)
    expect(queryBuilder.select).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("crearRegistroProvisional('clientes', ...)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy path — returns success: true with created record", async () => {
    const createdRecord = {
      id: 10,
      nombre_completo: "Nuevo Cliente",
      estado_registro: "PROVISIONAL",
    }

    // crearRegistroProvisional does:
    //   1. supabase.from(tabla).select("id").order(...).limit(1)  → to get next ID
    //   2. supabase.from(tabla).insert([datosConEstado]).select().single()
    //   3. supabase.from("cambios_provisionales").insert(...).select("id").single()  (audit — won't fail main)

    const maxIdBuilder: any = {}
    maxIdBuilder.select = vi.fn(() => maxIdBuilder)
    maxIdBuilder.order = vi.fn(() => maxIdBuilder)
    maxIdBuilder.limit = vi.fn().mockResolvedValue({ data: [{ id: 9 }], error: null })

    const insertBuilder: any = {}
    insertBuilder.insert = vi.fn(() => insertBuilder)
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
      if (callCount === 1) return maxIdBuilder   // first call: get max id
      return insertBuilder                        // second call: insert record
    })

    const result = await crearRegistroProvisional(
      "clientes",
      { nombre_completo: "Nuevo Cliente", telefonos: "8091234567" },
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect(result.data).toEqual(createdRecord)
  })

  it("error path — returns success: false when insert fails", async () => {
    const maxIdBuilder: any = {}
    maxIdBuilder.select = vi.fn(() => maxIdBuilder)
    maxIdBuilder.order = vi.fn(() => maxIdBuilder)
    maxIdBuilder.limit = vi.fn().mockResolvedValue({ data: [], error: null })

    const insertBuilder: any = {}
    insertBuilder.insert = vi.fn(() => insertBuilder)
    insertBuilder.select = vi.fn(() => insertBuilder)
    insertBuilder.single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Duplicate key value" },
    })

    let callCount = 0
    mockProvFrom.mockImplementation((table: string) => {
      if (table === "cambios_provisionales") return insertBuilder
      callCount++
      if (callCount === 1) return maxIdBuilder
      return insertBuilder
    })

    const result = await crearRegistroProvisional(
      "clientes",
      { nombre_completo: "Dup Cliente" },
      "user@test.com",
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe("Duplicate key value")
  })
})
