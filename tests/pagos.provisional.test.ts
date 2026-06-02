// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Use vi.hoisted to ensure the mock variable is available when the module
//     factory runs (admin-actions.ts calls createClient() at module-load time)
const { mockProvFrom } = vi.hoisted(() => {
  const mockProvFrom = vi.fn()
  return { mockProvFrom }
})

// ─── Mock @/lib/supabase for provisional-system.ts and admin-actions.ts ───
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockProvFrom,
  })),
}))

import { crearRegistroProvisional } from "../lib/provisional-system"
import { crearPagoPendiente } from "../lib/admin-actions"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupProvMocks(
  createdRecord: any,
  maxIdData: any[] = [{ id: 10 }],
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

function setupProvMocksWithInsertError(errorMessage: string) {
  const maxIdBuilder: any = {}
  maxIdBuilder.select = vi.fn(() => maxIdBuilder)
  maxIdBuilder.order = vi.fn(() => maxIdBuilder)
  maxIdBuilder.limit = vi.fn().mockResolvedValue({ data: [{ id: 10 }], error: null })

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
describe("crearRegistroProvisional('pagos', ...) — happy and error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy path — returns success: true with created pago record", async () => {
    const createdRecord = {
      id: 11,
      reserva_id: 4,
      cliente_id: 2,
      monto: 5000,
      metodo_pago: "TRANSFERENCIA",
      estado_registro: "PROVISIONAL",
    }
    setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "pagos",
      {
        reserva_id: 4,
        cliente_id: 2,
        monto: 5000,
        metodo_pago: "TRANSFERENCIA",
        fecha_pago: "2026-06-01",
      },
      "cajero@test.com",
    )

    expect(result.success).toBe(true)
    expect(result.data).toEqual(createdRecord)
  })

  it("happy path — insert payload includes estado_registro PROVISIONAL and usuario_creacion", async () => {
    const createdRecord = { id: 11, monto: 2500, estado_registro: "PROVISIONAL" }
    const { captureInsertArg } = setupProvMocks(createdRecord)

    const result = await crearRegistroProvisional(
      "pagos",
      { monto: 2500, reserva_id: 1, cliente_id: 1, metodo_pago: "EFECTIVO", fecha_pago: "2026-06-01" },
      "cajero@test.com",
    )

    expect(result.success).toBe(true)
    const payload = captureInsertArg()
    expect(payload).not.toBeNull()
    expect(payload[0].estado_registro).toBe("PROVISIONAL")
    expect(payload[0].usuario_creacion).toBe("cajero@test.com")
    expect(payload[0].monto).toBe(2500)
  })

  it("error path — returns success: false when Supabase insert fails", async () => {
    setupProvMocksWithInsertError("Not null constraint violation")

    const result = await crearRegistroProvisional(
      "pagos",
      { monto: 1000, reserva_id: 99 },
      "cajero@test.com",
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe("Not null constraint violation")
  })

  it("error path — returns success: false on unexpected exception", async () => {
    mockProvFrom.mockImplementation(() => {
      throw new Error("Connection lost")
    })

    const result = await crearRegistroProvisional(
      "pagos",
      { monto: 500, reserva_id: 1 },
      "cajero@test.com",
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe("Error inesperado al crear el registro")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// acciones_pendientes: crearPagoPendiente must produce a description
// containing the monto value.
// See lib/admin-actions.ts:
//   descripcion: `Solicitud de registro de pago por $${datosPago.monto}`
// ─────────────────────────────────────────────────────────────────────────────
describe("crearPagoPendiente — acciones_pendientes description contains monto", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Setup a mock for the acciones_pendientes insert.
   * Returns a function that gives back the captured insert arg.
   */
  function setupAccionesMock(returnData: any = { id: 55 }): { captureInsertArg: () => any } {
    let capturedInsertArg: any = null

    const builder: any = {}
    builder.insert = vi.fn((arg: any) => {
      capturedInsertArg = arg
      return builder
    })
    builder.select = vi.fn(() => builder)
    builder.single = vi.fn().mockResolvedValue({ data: returnData, error: null })

    mockProvFrom.mockImplementation(() => builder)

    return { captureInsertArg: () => capturedInsertArg }
  }

  it("happy path — returns success: true with id", async () => {
    setupAccionesMock({ id: 55 })

    const result = await crearPagoPendiente(
      { monto: 3500, reserva_id: 7, metodo_pago: "EFECTIVO" },
      "cajero@test.com",
    )

    expect(result.success).toBe(true)
    expect(result.id).toBe(55)
  })

  it("description in acciones_pendientes contains the monto value", async () => {
    const { captureInsertArg } = setupAccionesMock({ id: 56 })

    await crearPagoPendiente(
      { monto: 7850, reserva_id: 3, metodo_pago: "TRANSFERENCIA" },
      "cajero@test.com",
    )

    const insertedArg = captureInsertArg()
    expect(insertedArg).not.toBeNull()
    const record = insertedArg[0]
    expect(record.descripcion).toContain("7850")
  })

  it("description contains monto for float amounts", async () => {
    const { captureInsertArg } = setupAccionesMock({ id: 57 })

    await crearPagoPendiente(
      { monto: 125.50, reserva_id: 5, metodo_pago: "TARJETA" },
      "cajero@test.com",
    )

    const record = captureInsertArg()[0]
    // The description template is: `Solicitud de registro de pago por $${datosPago.monto}`
    expect(record.descripcion).toContain("125.5")
  })

  it("tabla_objetivo and modulo are 'pagos'", async () => {
    const { captureInsertArg } = setupAccionesMock({ id: 58 })

    await crearPagoPendiente(
      { monto: 1000, reserva_id: 2 },
      "cajero@test.com",
    )

    const record = captureInsertArg()[0]
    expect(record.tabla_objetivo).toBe("pagos")
    expect(record.modulo).toBe("pagos")
    expect(record.tipo_accion).toBe("CREATE")
  })

  it("error path — returns success: false when Supabase returns an error", async () => {
    const builder: any = {}
    builder.insert = vi.fn(() => builder)
    builder.select = vi.fn(() => builder)
    builder.single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "RLS policy violation" },
    })
    mockProvFrom.mockImplementation(() => builder)

    const result = await crearPagoPendiente(
      { monto: 500, reserva_id: 1 },
      "cajero@test.com",
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe("RLS policy violation")
  })
})
