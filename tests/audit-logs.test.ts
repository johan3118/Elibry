// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Use vi.hoisted to ensure the mock variable is available when the module
//     factory runs (provisional-system.ts calls getSupabase() at call time)
const { mockAuditFrom } = vi.hoisted(() => {
  const mockAuditFrom = vi.fn()
  return { mockAuditFrom }
})

// ─── Mock @/lib/supabase for provisional-system.ts ───
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockAuditFrom,
  })),
}))

import { obtenerRegistrosCompletos } from "../lib/provisional-system"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Setup mock for obtenerRegistrosCompletos happy path.
 * Captures the chain to verify .neq("estado_registro", "ELIMINADO") is called.
 */
function setupAuditQueryMock(mockData: any[] = []): {
  captureNeqCall: () => any
  captureOrderCall: () => any
} {
  let capturedNeqArg: any = null
  let capturedOrderArg: any = null

  const builder: any = {}
  builder.select = vi.fn((arg: string) => builder)
  builder.neq = vi.fn((field: string, value: string) => {
    capturedNeqArg = { field, value }
    return builder
  })
  builder.order = vi.fn((field: string, opts: any) => {
    capturedOrderArg = { field, opts }
    return Promise.resolve({ data: mockData, error: null })
  })

  mockAuditFrom.mockImplementation((table: string) => builder)

  return {
    captureNeqCall: () => capturedNeqArg,
    captureOrderCall: () => capturedOrderArg,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe("obtenerRegistrosCompletos — audit/log records exclude ELIMINADO status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy path — returns data array when no records are eliminated", async () => {
    const mockRecords = [
      {
        id: 1,
        nombre_completo: "Cliente Activo",
        estado_registro: "PERMANENTE",
      },
      {
        id: 2,
        nombre_completo: "Cliente Provisional",
        estado_registro: "PROVISIONAL",
      },
    ]

    setupAuditQueryMock(mockRecords)

    const result = await obtenerRegistrosCompletos("clientes")

    expect(result.data).toEqual(mockRecords)
    expect(result.error).toBeNull()
  })

  it("happy path — returns empty data when all records are eliminated", async () => {
    setupAuditQueryMock([])

    const result = await obtenerRegistrosCompletos("productos")

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it("query chain uses .neq('estado_registro', 'ELIMINADO') filter", async () => {
    const { captureNeqCall } = setupAuditQueryMock([])

    await obtenerRegistrosCompletos("reservas")

    const neqCall = captureNeqCall()
    expect(neqCall).not.toBeNull()
    expect(neqCall.field).toBe("estado_registro")
    expect(neqCall.value).toBe("ELIMINADO")
  })

  it("query chain calls .order('id', { ascending: true })", async () => {
    const { captureOrderCall } = setupAuditQueryMock([])

    await obtenerRegistrosCompletos("pagos")

    const orderCall = captureOrderCall()
    expect(orderCall).not.toBeNull()
    expect(orderCall.field).toBe("id")
    expect(orderCall.opts.ascending).toBe(true)
  })

  it("query starts with .select('*')", async () => {
    const mockSelectSpy = vi.fn().mockReturnValue({
      neq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })

    const mockBuilder: any = {}
    mockBuilder.select = mockSelectSpy

    mockAuditFrom.mockReturnValue(mockBuilder)

    await obtenerRegistrosCompletos("clientes")

    expect(mockSelectSpy).toHaveBeenCalledWith("*")
  })

  it("accepts optional supabaseClient parameter", async () => {
    const mockCustomClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
          }),
        }),
      }),
    }

    const result = await obtenerRegistrosCompletos("clientes", mockCustomClient)

    expect(result.data).toEqual([{ id: 1 }])
    expect(mockCustomClient.from).toHaveBeenCalledWith("clientes")
  })

  it("error path — returns data: [] and error object when query fails", async () => {
    const errorMsg = "Permission denied"
    const builder: any = {}
    builder.select = vi.fn(() => builder)
    builder.neq = vi.fn(() => builder)
    builder.order = vi.fn().mockResolvedValue({ data: null, error: { message: errorMsg } })

    mockAuditFrom.mockReturnValue(builder)

    const result = await obtenerRegistrosCompletos("reservas")

    expect(result.data).toEqual([])
    expect(result.error).not.toBeNull()
  })

  it("error path — handles unexpected exceptions gracefully", async () => {
    mockAuditFrom.mockImplementation(() => {
      throw new Error("Network unreachable")
    })

    const result = await obtenerRegistrosCompletos("pagos")

    expect(result.data).toEqual([])
    expect(result.error).not.toBeNull()
  })

  it("returns logged records with multiple fields intact", async () => {
    const mockRecords = [
      {
        id: 1,
        tabla_afectada: "clientes",
        usuario_cambio: "admin@test.com",
        tipo_cambio: "CREATE",
        estado_cambio: "PENDIENTE",
        fecha_cambio: "2026-06-02T10:30:00Z",
      },
      {
        id: 2,
        tabla_afectada: "clientes",
        usuario_cambio: "manager@test.com",
        tipo_cambio: "UPDATE",
        estado_cambio: "APROBADO",
        fecha_cambio: "2026-06-01T15:00:00Z",
      },
    ]

    setupAuditQueryMock(mockRecords)

    const result = await obtenerRegistrosCompletos("cambios_provisionales")

    expect(result.data).toHaveLength(2)
    expect(result.data[0].usuario_cambio).toBe("admin@test.com")
    expect(result.data[1].estado_cambio).toBe("APROBADO")
  })
})
