// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock @/lib/supabase for provisional-system.ts ───
const mockProvFrom = vi.fn()

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockProvFrom,
  })),
}))

import { aprobarCambio, rechazarCambio } from "../lib/provisional-system"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a chainable query builder that resolves with `resolvedValue`
 * when awaited (via .mockResolvedValue on the last chained method).
 */
function makeBuilder(resolvedValue: any) {
  const b: any = {}
  b.select = vi.fn(() => b)
  b.update = vi.fn(() => b)
  b.delete = vi.fn(() => b)
  b.insert = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.single = vi.fn().mockResolvedValue(resolvedValue)
  // Some chains end on .eq() without .single(), so make eq also thenable
  b.then = undefined
  return b
}

/**
 * For aprobarCambio / rechazarCambio the call sequence is:
 *  1. from("cambios_provisionales").select("*").eq("id", cambioId).single()
 *     → returns the cambio record
 *  2. from(cambio.tabla_afectada).update({...}).eq("id", cambio.registro_id)
 *     → resolves with { error: null }  (or delete for CREATE rejection)
 *  3. from("cambios_provisionales").update({...}).eq("id", cambioId)
 *     → resolves with { error: null }
 */
type SetupResult = {
  cambioFetchBuilder: any
  targetTableBuilder: any
  auditUpdateBuilder: any
}

function setupApprovalMocks(
  cambio: any,
  targetTableError: any = null,
  auditUpdateError: any = null,
): SetupResult {
  // Builder for step 1: fetch the cambio
  const cambioFetchBuilder = makeBuilder({ data: cambio, error: null })

  // Builder for step 2: update target table (or delete for CREATE rejection)
  const targetTableBuilder: any = {}
  targetTableBuilder.update = vi.fn(() => targetTableBuilder)
  targetTableBuilder.delete = vi.fn(() => targetTableBuilder)
  targetTableBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: targetTableError })

  // Builder for step 3: update cambios_provisionales status
  const auditUpdateBuilder: any = {}
  auditUpdateBuilder.update = vi.fn(() => auditUpdateBuilder)
  auditUpdateBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: auditUpdateError })

  let cambiosFetchDone = false
  let targetTableDone = false

  mockProvFrom.mockImplementation((table: string) => {
    if (table === "cambios_provisionales") {
      if (!cambiosFetchDone) {
        cambiosFetchDone = true
        return cambioFetchBuilder
      }
      return auditUpdateBuilder
    }
    // Any other table is the target table (e.g. "reservas", "clientes")
    return targetTableBuilder
  })

  return { cambioFetchBuilder, targetTableBuilder, auditUpdateBuilder }
}

/**
 * Setup for "cambio not found" path — single() returns { data: null, error: {...} }
 */
function setupNotFoundMock() {
  const notFoundBuilder = makeBuilder({ data: null, error: { message: "No rows found" } })
  mockProvFrom.mockReturnValue(notFoundBuilder)
}

// ─────────────────────────────────────────────────────────────────────────────
describe("aprobarCambio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy path — returns { success: true } when all DB calls succeed", async () => {
    const cambio = {
      id: 1,
      tabla_afectada: "reservas",
      registro_id: 42,
      tipo_cambio: "CREATE",
    }
    setupApprovalMocks(cambio)

    const result = await aprobarCambio(1, "admin@test.com")

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it("sets estado_registro PERMANENTE on the target record", async () => {
    const cambio = {
      id: 2,
      tabla_afectada: "clientes",
      registro_id: 10,
      tipo_cambio: "UPDATE",
    }
    const { targetTableBuilder } = setupApprovalMocks(cambio)

    await aprobarCambio(2, "admin@test.com")

    expect(targetTableBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado_registro: "PERMANENTE" }),
    )
  })

  it("sets estado_cambio APROBADO and procesado_por on cambios_provisionales", async () => {
    const cambio = {
      id: 3,
      tabla_afectada: "productos",
      registro_id: 5,
      tipo_cambio: "CREATE",
    }
    const { auditUpdateBuilder } = setupApprovalMocks(cambio)

    await aprobarCambio(3, "admin@test.com")

    expect(auditUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estado_cambio: "APROBADO",
        procesado_por: "admin@test.com",
      }),
    )
  })

  it("'Cambio no encontrado' path — returns { success: false, error } when cambio does not exist", async () => {
    setupNotFoundMock()

    const result = await aprobarCambio(9999, "admin@test.com")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Cambio no encontrado")
  })

  it("error path — returns { success: false, error } when target table update fails", async () => {
    const cambio = {
      id: 4,
      tabla_afectada: "reservas",
      registro_id: 20,
      tipo_cambio: "UPDATE",
    }
    setupApprovalMocks(cambio, { message: "Foreign key constraint" })

    const result = await aprobarCambio(4, "admin@test.com")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Foreign key constraint")
  })

  it("error path — returns { success: false, error } when audit update fails", async () => {
    const cambio = {
      id: 5,
      tabla_afectada: "suplidores",
      registro_id: 15,
      tipo_cambio: "CREATE",
    }
    setupApprovalMocks(cambio, null, { message: "RLS denied" })

    const result = await aprobarCambio(5, "admin@test.com")

    expect(result.success).toBe(false)
    expect(result.error).toBe("RLS denied")
  })

  it("error path — returns { success: false } when getSupabase throws", async () => {
    mockProvFrom.mockImplementation(() => {
      throw new Error("No Supabase client")
    })

    const result = await aprobarCambio(1, "admin@test.com")

    expect(result.success).toBe(false)
    expect(result.error).toContain("Error inesperado")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("rechazarCambio", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy path — returns { success: true } for a CREATE tipo_cambio (deletes the record)", async () => {
    const cambio = {
      id: 10,
      tabla_afectada: "reservas",
      registro_id: 50,
      tipo_cambio: "CREATE",
    }
    setupApprovalMocks(cambio)

    const result = await rechazarCambio(10, "admin@test.com", "No cumple requisitos")

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it("happy path — returns { success: true } for an UPDATE tipo_cambio (restores anterior data)", async () => {
    const cambio = {
      id: 11,
      tabla_afectada: "clientes",
      registro_id: 7,
      tipo_cambio: "UPDATE",
      datos_anteriores: { nombre_completo: "Carlos Viejo" },
    }
    setupApprovalMocks(cambio)

    const result = await rechazarCambio(11, "admin@test.com")

    expect(result.success).toBe(true)
  })

  it("happy path — returns { success: true } for a DELETE tipo_cambio (restores the record)", async () => {
    const cambio = {
      id: 12,
      tabla_afectada: "productos",
      registro_id: 3,
      tipo_cambio: "DELETE",
    }
    setupApprovalMocks(cambio)

    const result = await rechazarCambio(12, "admin@test.com")

    expect(result.success).toBe(true)
  })

  it("sets estado_cambio RECHAZADO and procesado_por on cambios_provisionales", async () => {
    const cambio = {
      id: 13,
      tabla_afectada: "pagos",
      registro_id: 9,
      tipo_cambio: "CREATE",
    }
    const { auditUpdateBuilder } = setupApprovalMocks(cambio)

    await rechazarCambio(13, "admin@test.com", "Datos incorrectos")

    expect(auditUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estado_cambio: "RECHAZADO",
        procesado_por: "admin@test.com",
        notas_admin: "Datos incorrectos",
      }),
    )
  })

  it("'Cambio no encontrado' path — returns { success: false, error } when cambio does not exist", async () => {
    setupNotFoundMock()

    const result = await rechazarCambio(9999, "admin@test.com")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Cambio no encontrado")
  })

  it("error path — returns { success: false, error } when audit update fails", async () => {
    const cambio = {
      id: 14,
      tabla_afectada: "reservas",
      registro_id: 30,
      tipo_cambio: "CREATE",
    }
    setupApprovalMocks(cambio, null, { message: "Write conflict" })

    const result = await rechazarCambio(14, "admin@test.com")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Write conflict")
  })

  it("error path — returns { success: false } on unexpected exception", async () => {
    mockProvFrom.mockImplementation(() => {
      throw new Error("DB crash")
    })

    const result = await rechazarCambio(1, "admin@test.com")

    expect(result.success).toBe(false)
    expect(result.error).toContain("Error inesperado")
  })
})
