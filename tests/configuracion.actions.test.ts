// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Use vi.hoisted to ensure the mock variable is available when the module
//     factory runs (admin-actions.ts calls createClient() at module-load time)
const { mockAdminFrom } = vi.hoisted(() => {
  const mockAdminFrom = vi.fn()
  return { mockAdminFrom }
})

// ─── Mock @/lib/supabase for admin-actions.ts ───
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}))

import { crearAccionPendiente } from "../lib/admin-actions"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupAccionesInsertMock(returnData: any = { id: 1 }): { captureInsertArg: () => any } {
  let capturedInsertArg: any = null

  const builder: any = {}
  builder.insert = vi.fn((arg: any) => {
    capturedInsertArg = arg
    return builder
  })
  builder.select = vi.fn(() => builder)
  builder.single = vi.fn().mockResolvedValue({ data: returnData, error: null })

  mockAdminFrom.mockImplementation(() => builder)

  return { captureInsertArg: () => capturedInsertArg }
}

function setupAccionesInsertErrorMock(errorMessage: string) {
  const builder: any = {}
  builder.insert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.single = vi.fn().mockResolvedValue({
    data: null,
    error: { message: errorMessage },
  })

  mockAdminFrom.mockImplementation(() => builder)
}

// ─────────────────────────────────────────────────────────────────────────────
describe("crearAccionPendiente — admin-actions happy and error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy path — returns success: true with action id", async () => {
    setupAccionesInsertMock({ id: 42 })

    const result = await crearAccionPendiente({
      tipo_accion: "CREATE",
      modulo: "clientes",
      tabla_objetivo: "clientes",
      datos_nuevos: { nombre_completo: "Juan Pérez", identificacion: "12345678" },
      descripcion: "Solicitud de registro de nuevo cliente PERSONA - Juan Pérez",
      usuario_solicitante: "admin@test.com",
    })

    expect(result.success).toBe(true)
    expect(result.id).toBe(42)
  })

  it("happy path — insert payload includes estado PENDIENTE and fecha_solicitud", async () => {
    const { captureInsertArg } = setupAccionesInsertMock({ id: 43 })

    const resultado = await crearAccionPendiente({
      tipo_accion: "UPDATE",
      modulo: "productos",
      tabla_objetivo: "productos",
      registro_id: 5,
      datos_nuevos: { nombre_producto: "Tour Modificado" },
      datos_anteriores: { nombre_producto: "Tour Original" },
      descripcion: "Actualización de tour",
      usuario_solicitante: "admin@test.com",
    })

    expect(resultado.success).toBe(true)
    const payload = captureInsertArg()
    expect(payload).not.toBeNull()
    expect(payload[0].estado).toBe("PENDIENTE")
    expect(payload[0].fecha_solicitud).toBeDefined()
    expect(payload[0].usuario_solicitante).toBe("admin@test.com")
    expect(payload[0].tipo_accion).toBe("UPDATE")
  })

  it("happy path — registro_id is included when provided", async () => {
    const { captureInsertArg } = setupAccionesInsertMock({ id: 44 })

    await crearAccionPendiente({
      tipo_accion: "DELETE",
      modulo: "suplidores",
      tabla_objetivo: "suplidores",
      registro_id: 10,
      datos_anteriores: { razon_social: "Suplidor X" },
      descripcion: "Eliminación de suplidor",
      usuario_solicitante: "admin@test.com",
    })

    const record = captureInsertArg()[0]
    expect(record.registro_id).toBe(10)
    expect(record.tabla_objetivo).toBe("suplidores")
  })

  it("happy path — datos_nuevos and datos_anteriores are preserved", async () => {
    const { captureInsertArg } = setupAccionesInsertMock({ id: 45 })

    const nuevos = { email: "new@test.com" }
    const anteriores = { email: "old@test.com" }

    await crearAccionPendiente({
      tipo_accion: "UPDATE",
      modulo: "clientes",
      tabla_objetivo: "clientes",
      registro_id: 7,
      datos_nuevos: nuevos,
      datos_anteriores: anteriores,
      descripcion: "Actualización de email",
      usuario_solicitante: "admin@test.com",
    })

    const record = captureInsertArg()[0]
    expect(record.datos_nuevos).toEqual(nuevos)
    expect(record.datos_anteriores).toEqual(anteriores)
  })

  it("error path — returns success: false when Supabase returns an error", async () => {
    setupAccionesInsertErrorMock("RLS policy violation")

    const result = await crearAccionPendiente({
      tipo_accion: "CREATE",
      modulo: "clientes",
      tabla_objetivo: "clientes",
      datos_nuevos: { nombre_completo: "Test" },
      descripcion: "Test",
      usuario_solicitante: "admin@test.com",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe("RLS policy violation")
  })

  it("error path — returns success: false on unexpected exception", async () => {
    mockAdminFrom.mockImplementation(() => {
      throw new Error("Database connection timeout")
    })

    const result = await crearAccionPendiente({
      tipo_accion: "CREATE",
      modulo: "clientes",
      tabla_objetivo: "clientes",
      datos_nuevos: { nombre_completo: "Test" },
      descripcion: "Test",
      usuario_solicitante: "admin@test.com",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Error inesperado al crear la acción pendiente")
  })

  it("error path — error message from Supabase is included in response", async () => {
    const errorMsg = "Unique constraint violation on (usuario_solicitante, registro_id)"
    setupAccionesInsertErrorMock(errorMsg)

    const result = await crearAccionPendiente({
      tipo_accion: "CREATE",
      modulo: "reservas",
      tabla_objetivo: "reservas",
      datos_nuevos: { cliente_id: 1 },
      descripcion: "Nueva reserva",
      usuario_solicitante: "admin@test.com",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMsg)
  })
})
