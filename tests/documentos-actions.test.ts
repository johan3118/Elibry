// @vitest-environment node
//
// Offline tests for app/actions/documentos-actions.ts (patterns/port-and-in-memory-fake).
// @supabase/supabase-js is fully mocked below, so this suite makes no network
// calls and needs no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env
// vars — createSupabaseServerClient()'s `process.env...!` reads are never
// reached because createClient() itself is a vi.fn() stub.
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock @supabase/supabase-js so documentos-actions.ts never makes real network calls ───
//
// Each query builder is "thenable": every chain method (select/eq/order/
// delete/insert) returns the SAME builder object, and the builder itself
// resolves (via `.then`) to whatever { data, error } it was constructed with.
// That lets one mock stand in for chains of different lengths
// (e.g. `.select().eq().order()` vs `.delete().eq()`) without special-casing
// which method is "terminal".
function makeQueryBuilder(result: { data: any; error: any }) {
  const builder: any = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  // (HC-4) .is(...) is the concurrency guard on the success-path re-link
  // UPDATE — `.eq("id", …).is("ocupacion_id", null)`. Chainable like every
  // other method above.
  builder.is = vi.fn(() => builder)
  builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return builder
}

/**
 * Queues one builder per call to supabase.from(...), in call order — giving
 * EACH sequential call (e.g. SELECT-capture, then DELETE, then INSERT, then
 * a restore INSERT) its own canned { data, error }, so a test can express
 * "the SELECT-capture succeeds, the DELETE succeeds, then the INSERT
 * fails, then the RESTORE-insert succeeds/fails" (T2/AC2 send-back) — a
 * sequence a single stateless/canned builder cannot represent, but a QUEUE
 * of them can, since each `.from(...)` call in the delete/insert/restore
 * path gets a fresh builder off the front of the queue.
 */
function queueBuilders(...builders: any[]) {
  const queue = [...builders]
  mockFrom.mockImplementation(() => queue.shift())
}

const mockFrom = vi.fn()

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import {
  getPasajerosReservaAction,
  guardarPasajerosReservaAction,
  getOcupacionesReservaAction,
  guardarOcupacionesReservaAction,
  registrarDiscrepanciaTotalesAction,
  getFacturaNumeroPorReservaAction,
  type PasajeroInput,
  type OcupacionInput,
  type DiscrepanciaTotalesPayload,
} from "../app/actions/documentos-actions"

/** Queues one builder per call to supabase.from(...), in call order. */
function queueFromResults(...results: Array<{ data: any; error: any }>) {
  const builders = results.map(makeQueryBuilder)
  mockFrom.mockImplementation(() => builders.shift())
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
describe("getPasajerosReservaAction", () => {
  it("happy path — returns rows ordered by orden, filtered by reserva_id", async () => {
    const fakeRows = [
      { id: 1, reserva_id: 42, orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO" },
      { id: 2, reserva_id: 42, orden: 2, nombre_completo: "Luis Perez", tipo_pax: "ADULTO" },
    ]
    queueFromResults({ data: fakeRows, error: null })

    const result = await getPasajerosReservaAction(42)

    expect(result.success).toBe(true)
    expect((result as any).data).toEqual(fakeRows)
    expect(mockFrom).toHaveBeenCalledWith("reserva_pasajeros")
  })

  it("ordering guarantee — calls .order('orden', { ascending: true })", async () => {
    const builders = [makeQueryBuilder({ data: [], error: null })]
    mockFrom.mockImplementation(() => builders[0])

    await getPasajerosReservaAction(42)

    expect(builders[0].eq).toHaveBeenCalledWith("reserva_id", 42)
    expect(builders[0].order).toHaveBeenCalledWith("orden", { ascending: true })
  })

  it("error path — returns success: false with the Supabase error message", async () => {
    queueFromResults({ data: null, error: { message: "connection refused" } })

    const result = await getPasajerosReservaAction(42)

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("connection refused")
  })

  it("exception path — returns success: false when an unexpected exception is thrown", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("boom")
    })

    const result = await getPasajerosReservaAction(42)

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("boom")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("guardarPasajerosReservaAction — block-never-default validation", () => {
  it("rejects a blank nombre_completo BEFORE touching the DB", async () => {
    const pasajeros: PasajeroInput[] = [{ orden: 1, nombre_completo: "   ", tipo_pax: "ADULTO" }]

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("nombre_completo")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects an empty-string nombre_completo", async () => {
    const pasajeros: PasajeroInput[] = [{ orden: 1, nombre_completo: "", tipo_pax: "ADULTO" }]

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("nombre_completo")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects a missing tipo_pax — never defaults to ADULTO", async () => {
    const pasajeros = [{ orden: 1, nombre_completo: "Ana Perez" }] as unknown as PasajeroInput[]

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("tipo_pax")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects an invalid tipo_pax value", async () => {
    const pasajeros = [
      { orden: 1, nombre_completo: "Ana Perez", tipo_pax: "SENIOR" },
    ] as unknown as PasajeroInput[]

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("tipo_pax")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects a missing orden — never invents a sequence number", async () => {
    const pasajeros = [
      { nombre_completo: "Ana Perez", tipo_pax: "ADULTO" },
    ] as unknown as PasajeroInput[]

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("orden")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects duplicated orden values", async () => {
    const pasajeros: PasajeroInput[] = [
      { orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO" },
      { orden: 1, nombre_completo: "Luis Perez", tipo_pax: "ADULTO" },
    ]

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("orden")
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe("guardarPasajerosReservaAction — replace-all write path", () => {
  it("replaces the set within one call: SELECT-capture, then delete(reserva_id), then insert the new rows", async () => {
    const pasajeros: PasajeroInput[] = [
      { orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO" },
      { orden: 2, nombre_completo: "Luis Perez", tipo_pax: "NINO" },
    ]

    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: pasajeros.map((p, i) => ({ id: i + 1, reserva_id: 42, ...p })),
      error: null,
    })
    queueBuilders(selectCaptureBuilder, deleteBuilder, insertBuilder)

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(true)
    expect(selectCaptureBuilder.select).toHaveBeenCalledWith("*")
    expect(selectCaptureBuilder.eq).toHaveBeenCalledWith("reserva_id", 42)
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith("reserva_id", 42)
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ reserva_id: 42, orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO" }),
      expect.objectContaining({ reserva_id: 42, orden: 2, nombre_completo: "Luis Perez", tipo_pax: "NINO" }),
    ])
  })

  it("an empty list clears the reserva's passengers without an insert call", async () => {
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    queueBuilders(selectCaptureBuilder, deleteBuilder)

    const result = await guardarPasajerosReservaAction(42, [], "user@test.com")

    expect(result.success).toBe(true)
    expect((result as any).data).toEqual([])
    expect(deleteBuilder.insert).not.toHaveBeenCalled()
  })

  it("surfaces (never swallows) a DB error on the SELECT-capture, before any delete/insert", async () => {
    queueFromResults({ data: null, error: { message: "select failed" } })

    const result = await guardarPasajerosReservaAction(
      42,
      [{ orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO" }],
      "user@test.com",
    )

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("select failed")
    expect((result as any).restored).toBeUndefined()
  })

  it("surfaces (never swallows) a DB error on delete", async () => {
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: { message: "delete failed" } })
    queueBuilders(selectCaptureBuilder, deleteBuilder)

    const result = await guardarPasajerosReservaAction(
      42,
      [{ orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO" }],
      "user@test.com",
    )

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("delete failed")
  })

  it("insert fails but the reserva had NO original rows — nothing to restore, restored:true", async () => {
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "insert failed" } })
    queueBuilders(selectCaptureBuilder, deleteBuilder, insertBuilder)

    const result = await guardarPasajerosReservaAction(
      42,
      [{ orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO" }],
      "user@test.com",
    )

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("insert failed")
    expect((result as any).restored).toBe(true)
  })

  it("delete succeeds, insert fails, restore-insert SUCCEEDS — restored:true, and the restore used the ORIGINALLY-CAPTURED rows (not the new ones)", async () => {
    const filasOriginales = [
      { id: 7, reserva_id: 42, orden: 1, nombre_completo: "Old Passenger", tipo_pax: "ADULTO", ocupacion_id: null },
    ]
    const pasajerosNuevos: PasajeroInput[] = [
      { orden: 1, nombre_completo: "New Passenger", tipo_pax: "ADULTO" },
    ]

    const selectCaptureBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "insert failed" } })
    const restoreInsertBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    queueBuilders(selectCaptureBuilder, deleteBuilder, insertBuilder, restoreInsertBuilder)

    const result = await guardarPasajerosReservaAction(42, pasajerosNuevos, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("insert failed")
    expect((result as any).restored).toBe(true)
    // The restore-insert was called with the ORIGINALLY-CAPTURED rows verbatim
    // (including `id`, so composite-FK references keep pointing at the same
    // occupancy row) — never the new/rejected "New Passenger" row.
    expect(restoreInsertBuilder.insert).toHaveBeenCalledWith(filasOriginales)
    expect(restoreInsertBuilder.insert).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ nombre_completo: "New Passenger" })]),
    )
  })

  it("delete succeeds, insert fails, restore-insert ALSO fails — restored:false, caller can tell data was lost", async () => {
    const filasOriginales = [
      { id: 7, reserva_id: 42, orden: 1, nombre_completo: "Old Passenger", tipo_pax: "ADULTO", ocupacion_id: null },
    ]
    const pasajerosNuevos: PasajeroInput[] = [
      { orden: 1, nombre_completo: "New Passenger", tipo_pax: "ADULTO" },
    ]

    const selectCaptureBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "insert failed" } })
    const restoreInsertBuilder = makeQueryBuilder({ data: null, error: { message: "restore insert failed too" } })
    queueBuilders(selectCaptureBuilder, deleteBuilder, insertBuilder, restoreInsertBuilder)

    const result = await guardarPasajerosReservaAction(42, pasajerosNuevos, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("insert failed")
    // The caller must NOT be able to assume the old data survived: restored
    // is explicitly false, with enough detail (restoreError) to know manual
    // intervention is needed — the reserva now has ZERO passengers.
    expect((result as any).restored).toBe(false)
    expect((result as any).restoreError).toBe("restore insert failed too")
    expect(restoreInsertBuilder.insert).toHaveBeenCalledWith(filasOriginales)
  })
})

describe("guardarPasajerosReservaAction — composite FK structural guard", () => {
  it("rejects an ocupacion_id that does not belong to this reserva, WITHOUT deleting/inserting", async () => {
    // reserva 42 only has occupancy groups id 100 and 101 — the input below references 999.
    const ocupacionesBuilder = makeQueryBuilder({ data: [{ id: 100 }, { id: 101 }], error: null })
    mockFrom.mockImplementation(() => ocupacionesBuilder)

    const pasajeros: PasajeroInput[] = [
      { orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO", ocupacion_id: 999 },
    ]

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("ocupacion_id")
    expect((result as any).error).toContain("42")
    // No delete/insert against reserva_pasajeros happened — the guard fired before any write.
    expect(ocupacionesBuilder.delete).not.toHaveBeenCalled()
    expect(ocupacionesBuilder.insert).not.toHaveBeenCalled()
  })

  it("accepts an ocupacion_id that DOES belong to this reserva", async () => {
    const pasajeros: PasajeroInput[] = [
      { orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO", ocupacion_id: 100 },
    ]

    const ocupacionesBuilder = makeQueryBuilder({ data: [{ id: 100 }], error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [{ id: 1, reserva_id: 42, ...pasajeros[0] }],
      error: null,
    })
    queueBuilders(ocupacionesBuilder, selectCaptureBuilder, deleteBuilder, insertBuilder)

    const result = await guardarPasajerosReservaAction(42, pasajeros, "user@test.com")

    expect(result.success).toBe(true)
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ ocupacion_id: 100, reserva_id: 42 }),
    ])
  })

  it("never queries reserva_ocupaciones when no pasajero references one (null ocupacion_id)", async () => {
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: [{ id: 1 }], error: null })
    const calls: any[] = [selectCaptureBuilder, deleteBuilder, insertBuilder]
    mockFrom.mockImplementation((table: string) => {
      expect(table).not.toBe("reserva_ocupaciones")
      return calls.shift()
    })

    const result = await guardarPasajerosReservaAction(
      42,
      [{ orden: 1, nombre_completo: "Ana Perez", tipo_pax: "ADULTO", ocupacion_id: null }],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect(mockFrom).toHaveBeenCalledTimes(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("getOcupacionesReservaAction", () => {
  it("happy path — returns rows ordered by orden, filtered by reserva_id", async () => {
    const fakeRows = [{ id: 1, reserva_id: 42, orden: 1, cantidad: 2, ocupacion: "DOBLE", categoria: "Junior Suite" }]
    const builder = makeQueryBuilder({ data: fakeRows, error: null })
    mockFrom.mockImplementation(() => builder)

    const result = await getOcupacionesReservaAction(42)

    expect(result.success).toBe(true)
    expect((result as any).data).toEqual(fakeRows)
    expect(mockFrom).toHaveBeenCalledWith("reserva_ocupaciones")
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", 42)
    expect(builder.order).toHaveBeenCalledWith("orden", { ascending: true })
  })

  it("error path — returns success: false with the Supabase error message", async () => {
    queueFromResults({ data: null, error: { message: "connection refused" } })

    const result = await getOcupacionesReservaAction(42)

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("connection refused")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("guardarOcupacionesReservaAction — block-never-default validation", () => {
  it("rejects cantidad <= 0", async () => {
    const ocupaciones: OcupacionInput[] = [{ orden: 1, cantidad: 0, ocupacion: "DOBLE", categoria: "Suite" }]

    const result = await guardarOcupacionesReservaAction(42, ocupaciones, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("cantidad")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects a negative cantidad", async () => {
    const ocupaciones: OcupacionInput[] = [{ orden: 1, cantidad: -2, ocupacion: "DOBLE", categoria: "Suite" }]

    const result = await guardarOcupacionesReservaAction(42, ocupaciones, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("cantidad")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects a blank ocupacion", async () => {
    const ocupaciones: OcupacionInput[] = [{ orden: 1, cantidad: 2, ocupacion: "  ", categoria: "Suite" }]

    const result = await guardarOcupacionesReservaAction(42, ocupaciones, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("ocupacion")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects a blank categoria", async () => {
    const ocupaciones: OcupacionInput[] = [{ orden: 1, cantidad: 2, ocupacion: "DOBLE", categoria: "" }]

    const result = await guardarOcupacionesReservaAction(42, ocupaciones, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("categoria")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects a missing orden", async () => {
    const ocupaciones = [{ cantidad: 2, ocupacion: "DOBLE", categoria: "Suite" }] as unknown as OcupacionInput[]

    const result = await guardarOcupacionesReservaAction(42, ocupaciones, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toContain("orden")
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe("guardarOcupacionesReservaAction — replace-all write path", () => {
  // Every call to guardarOcupacionesReservaAction now makes TWO extra
  // supabase.from(...) calls BEFORE the reemplazarConjuntoConRestauracion
  // sequence: (1) reserva_pasajeros — captures passenger->occupancy links so
  // a later `restored: true` outcome (or, per T2b/HC-4, a genuine SUCCESS)
  // can re-link them, and (2) reserva_ocupaciones — captures the OLD rooms'
  // material identity `(orden, ocupacion, categoria)` so the success-path
  // re-link can match old rooms to new ones (see the T2b describe block
  // below). Tests that don't care about either capture queue empty results.
  function pasajerosCaptureBuilderSinEnlaces() {
    return makeQueryBuilder({ data: [], error: null })
  }

  function ocupacionesAnterioresCaptureBuilderVacio() {
    return makeQueryBuilder({ data: [], error: null })
  }

  it("replaces the set within one call: SELECT-capture, then delete(reserva_id), then insert the new rows", async () => {
    const ocupaciones: OcupacionInput[] = [{ orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }]

    const pasajerosCaptureBuilder = pasajerosCaptureBuilderSinEnlaces()
    const ocupacionesAnterioresCaptureBuilder = ocupacionesAnterioresCaptureBuilderVacio()
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [{ id: 1, reserva_id: 42, ...ocupaciones[0] }],
      error: null,
    })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
    )

    const result = await guardarOcupacionesReservaAction(42, ocupaciones, "user@test.com")

    expect(result.success).toBe(true)
    expect(pasajerosCaptureBuilder.select).toHaveBeenCalledWith("id, ocupacion_id")
    expect(pasajerosCaptureBuilder.eq).toHaveBeenCalledWith("reserva_id", 42)
    expect(ocupacionesAnterioresCaptureBuilder.select).toHaveBeenCalledWith("id, orden, ocupacion, categoria")
    expect(ocupacionesAnterioresCaptureBuilder.eq).toHaveBeenCalledWith("reserva_id", 42)
    expect(selectCaptureBuilder.select).toHaveBeenCalledWith("*")
    expect(selectCaptureBuilder.eq).toHaveBeenCalledWith("reserva_id", 42)
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith("reserva_id", 42)
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        reserva_id: 42,
        orden: 1,
        cantidad: 8,
        ocupacion: "DOBLE",
        categoria: "Junior Suite Superior",
      }),
    ])
    // (HC-4) No captured passenger links -> relinked:true trivially, nothing discarded.
    expect((result as any).relinked).toBe(true)
    expect((result as any).enlacesDescartados).toEqual([])
  })

  it("an empty list clears the reserva's occupancy groups without an insert call", async () => {
    const pasajerosCaptureBuilder = pasajerosCaptureBuilderSinEnlaces()
    const ocupacionesAnterioresCaptureBuilder = ocupacionesAnterioresCaptureBuilderVacio()
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    queueBuilders(pasajerosCaptureBuilder, ocupacionesAnterioresCaptureBuilder, selectCaptureBuilder, deleteBuilder)

    const result = await guardarOcupacionesReservaAction(42, [], "user@test.com")

    expect(result.success).toBe(true)
    expect((result as any).data).toEqual([])
    expect(deleteBuilder.insert).not.toHaveBeenCalled()
    expect((result as any).relinked).toBe(true)
    expect((result as any).enlacesDescartados).toEqual([])
  })

  it("surfaces (never swallows) a DB error on the old-occupancy identity capture, before any delete/insert", async () => {
    queueFromResults(
      { data: [], error: null },
      { data: null, error: { message: "identity capture failed" } },
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 2, ocupacion: "DOBLE", categoria: "Suite" }],
      "user@test.com",
    )

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("identity capture failed")
  })

  it("surfaces (never swallows) a DB error on delete", async () => {
    const pasajerosCaptureBuilder = pasajerosCaptureBuilderSinEnlaces()
    const ocupacionesAnterioresCaptureBuilder = ocupacionesAnterioresCaptureBuilderVacio()
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: { message: "delete failed" } })
    queueBuilders(pasajerosCaptureBuilder, ocupacionesAnterioresCaptureBuilder, selectCaptureBuilder, deleteBuilder)

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 2, ocupacion: "DOBLE", categoria: "Suite" }],
      "user@test.com",
    )

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("delete failed")
  })

  it("insert fails but the reserva had NO original rows — nothing to restore, restored:true", async () => {
    const pasajerosCaptureBuilder = pasajerosCaptureBuilderSinEnlaces()
    const ocupacionesAnterioresCaptureBuilder = ocupacionesAnterioresCaptureBuilderVacio()
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "insert failed" } })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 2, ocupacion: "DOBLE", categoria: "Suite" }],
      "user@test.com",
    )

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("insert failed")
    expect((result as any).restored).toBe(true)
  })

  it("delete succeeds, insert fails, restore-insert SUCCEEDS, no passenger referenced the deleted occupancy — restored:true, and the restore used the ORIGINALLY-CAPTURED rows (not the new ones)", async () => {
    const filasOriginales = [
      { id: 55, reserva_id: 42, orden: 1, cantidad: 2, ocupacion: "SENCILLA", categoria: "Old Category" },
    ]
    const ocupacionesNuevas: OcupacionInput[] = [
      { orden: 1, cantidad: 4, ocupacion: "DOBLE", categoria: "New Category" },
    ]

    const pasajerosCaptureBuilder = pasajerosCaptureBuilderSinEnlaces()
    const ocupacionesAnterioresCaptureBuilder = ocupacionesAnterioresCaptureBuilderVacio()
    const selectCaptureBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "insert failed" } })
    const restoreInsertBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      restoreInsertBuilder,
    )

    const result = await guardarOcupacionesReservaAction(42, ocupacionesNuevas, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("insert failed")
    expect((result as any).restored).toBe(true)
    // The restore-insert was called with the ORIGINALLY-CAPTURED rows verbatim
    // (including `id`) — never the new/rejected "New Category" row.
    expect(restoreInsertBuilder.insert).toHaveBeenCalledWith(filasOriginales)
    expect(restoreInsertBuilder.insert).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ categoria: "New Category" })]),
    )
    // No passenger referenced occupancy 55, so no re-link UPDATE happens.
    expect(pasajerosCaptureBuilder.update).not.toHaveBeenCalled()
  })

  it("delete succeeds, insert fails, restore-insert ALSO fails — restored:false, caller can tell data was lost", async () => {
    const filasOriginales = [
      { id: 55, reserva_id: 42, orden: 1, cantidad: 2, ocupacion: "SENCILLA", categoria: "Old Category" },
    ]
    const ocupacionesNuevas: OcupacionInput[] = [
      { orden: 1, cantidad: 4, ocupacion: "DOBLE", categoria: "New Category" },
    ]

    const pasajerosCaptureBuilder = pasajerosCaptureBuilderSinEnlaces()
    const ocupacionesAnterioresCaptureBuilder = ocupacionesAnterioresCaptureBuilderVacio()
    const selectCaptureBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "insert failed" } })
    const restoreInsertBuilder = makeQueryBuilder({ data: null, error: { message: "restore insert failed too" } })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      restoreInsertBuilder,
    )

    const result = await guardarOcupacionesReservaAction(42, ocupacionesNuevas, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("insert failed")
    // The caller must NOT be able to assume the old data survived: restored
    // is explicitly false, with enough detail (restoreError) to know manual
    // intervention is needed — the reserva now has ZERO occupancy groups.
    expect((result as any).restored).toBe(false)
    expect((result as any).restoreError).toBe("restore insert failed too")
    expect(restoreInsertBuilder.insert).toHaveBeenCalledWith(filasOriginales)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 (T2 send-back #2): the occupancy restore is only PARTIAL unless
// passengers whose ocupacion_id was nulled by the DB's
// `ON DELETE SET NULL (ocupacion_id)` cascade (scripts/061) are re-linked to
// the restored occupancy rows. None of the tests above cross the
// reserva_pasajeros boundary at all — that blind spot is exactly how this
// bug survived — so these tests exist specifically to close it.
//
// (T2b/HC-4) These tests exercise the FAILURE/restore path, which this task
// leaves UNCHANGED — every one now also queues the new
// reserva_ocupaciones-identity capture builder (added by T2b) as the SECOND
// call, since that capture happens unconditionally before the
// success/failure branch is known.
describe("guardarOcupacionesReservaAction — re-linking passengers after a restore", () => {
  it("occupancy insert fails, restore-insert succeeds, re-link UPDATE succeeds — honest restored:true, and the UPDATE used the ORIGINALLY-CAPTURED ocupacion_id values", async () => {
    const filasOriginales = [
      { id: 55, reserva_id: 42, orden: 1, cantidad: 2, ocupacion: "SENCILLA", categoria: "Old Category" },
    ]
    const ocupacionesNuevas: OcupacionInput[] = [
      { orden: 1, cantidad: 4, ocupacion: "DOBLE", categoria: "New Category" },
    ]
    // Passenger 10 was linked to occupancy 55 before the call.
    const pasajerosCaptureBuilder = makeQueryBuilder({
      data: [{ id: 10, ocupacion_id: 55 }],
      error: null,
    })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "insert failed" } })
    const restoreInsertBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    const relinkUpdateBuilder = makeQueryBuilder({ data: [{ id: 10, ocupacion_id: 55 }], error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      restoreInsertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(42, ocupacionesNuevas, "user@test.com")

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("insert failed")
    expect((result as any).restored).toBe(true)
    expect((result as any).restoreError).toBeUndefined()
    // The re-link UPDATE ran against reserva_pasajeros with the
    // ORIGINALLY-CAPTURED ocupacion_id (55) — not any newly-assigned id.
    expect(relinkUpdateBuilder.update).toHaveBeenCalledWith({ ocupacion_id: 55 })
    expect(relinkUpdateBuilder.eq).toHaveBeenCalledWith("id", 10)
  })

  it("occupancy insert fails, restore-insert succeeds, re-link UPDATE FAILS — reports restore-failed honestly, NOT restored:true", async () => {
    const filasOriginales = [
      { id: 55, reserva_id: 42, orden: 1, cantidad: 2, ocupacion: "SENCILLA", categoria: "Old Category" },
    ]
    const ocupacionesNuevas: OcupacionInput[] = [
      { orden: 1, cantidad: 4, ocupacion: "DOBLE", categoria: "New Category" },
    ]
    const pasajerosCaptureBuilder = makeQueryBuilder({
      data: [{ id: 10, ocupacion_id: 55 }],
      error: null,
    })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "insert failed" } })
    const restoreInsertBuilder = makeQueryBuilder({ data: filasOriginales, error: null })
    const relinkUpdateBuilder = makeQueryBuilder({
      data: null,
      error: { message: "relink update failed" },
    })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      restoreInsertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(42, ocupacionesNuevas, "user@test.com")

    // The caller must NEVER see restored:true here — the occupancy ROOM rows
    // came back, but the passenger->room LINK did not, and VOUCHER renders
    // passengers grouped by room. This is folded into the SAME three-outcome
    // contract as an occupancy-row restore failure: restored:false with a
    // restoreError, not a fourth silent state.
    expect(result.success).toBe(false)
    expect((result as any).restored).toBe(false)
    expect((result as any).restoreError).toBe("relink update failed")
    // `error` still carries the ORIGINAL insert failure that triggered the
    // restore in the first place — not the relink error.
    expect((result as any).error).toBe("insert failed")
    expect(relinkUpdateBuilder.update).toHaveBeenCalledWith({ ocupacion_id: 55 })
    expect(relinkUpdateBuilder.eq).toHaveBeenCalledWith("id", 10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T2b (HC-4) — rebuild passenger->room links after a SUCCESSFUL occupancy
// save. This is the gap the restore-path tests above never touch: on a
// genuine success (new ids written), the code used to return the bare
// resultado with no re-link at all, silently orphaning every room-assigned
// passenger. Every test below asserts on the PERSISTED ocupacion_id values /
// the returned discriminator fields — never on call counts alone
// (mistakes/fake-green-tests) — per the lead's standing instruction.
describe("guardarOcupacionesReservaAction — HC-4 success-path re-link by material tuple", () => {
  it("EDGE CASE 1 — room unchanged at the same orden: passenger is re-linked to the new row's id", async () => {
    const ocupacionesAntes = [{ id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }]
    const pasajerosCaptureBuilder = makeQueryBuilder({ data: [{ id: 10, ocupacion_id: 55 }], error: null })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [{ id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      error: null,
    })
    const relinkUpdateBuilder = makeQueryBuilder({ data: [{ id: 10 }], error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true)
    expect((result as any).enlacesDescartados).toEqual([])
    expect(relinkUpdateBuilder.update).toHaveBeenCalledWith({ ocupacion_id: 200 })
    expect(relinkUpdateBuilder.eq).toHaveBeenCalledWith("id", 10)
    expect(relinkUpdateBuilder.is).toHaveBeenCalledWith("ocupacion_id", null)
  })

  it("EDGE CASE 2 — room gone after the save (fewer rooms): its passenger's link stays NULL and is reported in enlacesDescartados", async () => {
    const ocupacionesAntes = [
      { id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
      { id: 56, orden: 2, ocupacion: "TRIPLE", categoria: "Standard" },
    ]
    const pasajerosCaptureBuilder = makeQueryBuilder({
      data: [
        { id: 10, ocupacion_id: 55 },
        { id: 11, ocupacion_id: 56 },
      ],
      error: null,
    })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    // Only room A is saved back — room B (orden 2) is genuinely deleted.
    const insertBuilder = makeQueryBuilder({
      data: [{ id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      error: null,
    })
    const relinkUpdateBuilder = makeQueryBuilder({ data: [{ id: 10 }], error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true) // enlacesDescartados never flips relinked
    expect((result as any).enlacesDescartados).toEqual([11])
    // Passenger 10 (surviving room) IS re-linked; passenger 11 (deleted room)
    // gets NO update call at all — never a guessed link.
    expect(relinkUpdateBuilder.update).toHaveBeenCalledWith({ ocupacion_id: 200 })
    expect(relinkUpdateBuilder.eq).toHaveBeenCalledWith("id", 10)
    expect(mockFrom).toHaveBeenCalledTimes(6) // no extra call was made for passenger 11
  })

  it("EDGE CASE 3 (THE CRUX) — rooms reordered / room at the same orden materially changed: NEVER re-link into the wrong room, report it instead", async () => {
    const ocupacionesAntes = [
      { id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
      { id: 56, orden: 2, ocupacion: "TRIPLE", categoria: "Standard" },
    ]
    // Passenger 10 was in the DOBLE (orden 1).
    const pasajerosCaptureBuilder = makeQueryBuilder({ data: [{ id: 10, ocupacion_id: 55 }], error: null })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    // The operator swapped the two rooms: orden 1 is now the TRIPLE, orden 2
    // is now the DOBLE. Matching on `orden` ALONE would re-link passenger 10
    // into the TRIPLE at the new orden-1 row (id 201) — the WRONG room.
    const insertBuilder = makeQueryBuilder({
      data: [
        { id: 201, reserva_id: 42, orden: 1, cantidad: 4, ocupacion: "TRIPLE", categoria: "Standard" },
        { id: 202, reserva_id: 42, orden: 2, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
      ],
      error: null,
    })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [
        { orden: 1, cantidad: 4, ocupacion: "TRIPLE", categoria: "Standard" },
        { orden: 2, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
      ],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true)
    // Passenger 10 is DISCARDED (honest NULL), never silently moved into the
    // TRIPLE at the reused orden — this is the whole of HC-4's crux.
    expect((result as any).enlacesDescartados).toEqual([10])
    // No UPDATE was ever attempted for passenger 10 — no guessed link.
    expect(mockFrom).toHaveBeenCalledTimes(5)
  })

  it("EDGE CASE 4 — a NEW room at an orden that did not exist before is a no-op; the surviving room's passenger still re-links correctly", async () => {
    const ocupacionesAntes = [{ id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }]
    const pasajerosCaptureBuilder = makeQueryBuilder({ data: [{ id: 10, ocupacion_id: 55 }], error: null })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [
        { id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { id: 201, reserva_id: 42, orden: 2, cantidad: 2, ocupacion: "SENCILLA", categoria: "Standard" }, // brand new
      ],
      error: null,
    })
    const relinkUpdateBuilder = makeQueryBuilder({ data: [{ id: 10 }], error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [
        { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { orden: 2, cantidad: 2, ocupacion: "SENCILLA", categoria: "Standard" },
      ],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true)
    expect((result as any).enlacesDescartados).toEqual([])
    expect(relinkUpdateBuilder.update).toHaveBeenCalledWith({ ocupacion_id: 200 })
    // Exactly one relink UPDATE happened — the new room at orden 2 has no
    // captured link referencing it, so nothing was attempted for it.
    expect(mockFrom).toHaveBeenCalledTimes(6)
  })

  it("EDGE CASE 5 — a passenger already NULL before the save is never captured and never touched (also kills a dropped non-null filter)", async () => {
    const ocupacionesAntes = [{ id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }]
    // Passenger 12 was already unassigned (ocupacion_id: null) BEFORE the
    // save, alongside passenger 10 who WAS linked — the fixture the lead's
    // instruction demands (a NULL alongside a linked one).
    const pasajerosCaptureBuilder = makeQueryBuilder({
      data: [
        { id: 10, ocupacion_id: 55 },
        { id: 12, ocupacion_id: null },
      ],
      error: null,
    })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [{ id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      error: null,
    })
    const relinkUpdateBuilder = makeQueryBuilder({ data: [{ id: 10 }], error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true)
    // Passenger 12 was NEVER linked — it must not appear as discarded either.
    expect((result as any).enlacesDescartados).toEqual([])
    expect(relinkUpdateBuilder.update).toHaveBeenCalledWith({ ocupacion_id: 200 })
    expect(relinkUpdateBuilder.eq).toHaveBeenCalledWith("id", 10)
    // Exactly ONE relink UPDATE call happened (for passenger 10 only).
    expect(mockFrom).toHaveBeenCalledTimes(6)
  })

  it("EDGE CASE 6 — the reserva had no occupancy rows before the save: relinked:true trivially", async () => {
    const pasajerosCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: [], error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [{ id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      error: null,
    })
    queueBuilders(pasajerosCaptureBuilder, ocupacionesAnterioresCaptureBuilder, selectCaptureBuilder, deleteBuilder, insertBuilder)

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true)
    expect((result as any).enlacesDescartados).toEqual([])
    // No relink UPDATE call was made at all (nothing captured).
    expect(mockFrom).toHaveBeenCalledTimes(5)
  })

  it("≥2-LINK FIXTURE (kills 'always use enlaces[0]') — each passenger re-links to its OWN room's new id, not a shared first value", async () => {
    const ocupacionesAntes = [
      { id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
      { id: 56, orden: 2, ocupacion: "TRIPLE", categoria: "Standard" },
    ]
    const pasajerosCaptureBuilder = makeQueryBuilder({
      data: [
        { id: 10, ocupacion_id: 55 },
        { id: 11, ocupacion_id: 56 }, // points at a DIFFERENT room than passenger 10
      ],
      error: null,
    })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    // Both rooms unchanged (only cantidad differs — deliberately excluded
    // from the identity key), just fresh ids from the replace.
    const insertBuilder = makeQueryBuilder({
      data: [
        { id: 200, reserva_id: 42, orden: 1, cantidad: 9, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { id: 201, reserva_id: 42, orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Standard" },
      ],
      error: null,
    })
    const relinkUpdateBuilderPasajero10 = makeQueryBuilder({ data: [{ id: 10 }], error: null })
    const relinkUpdateBuilderPasajero11 = makeQueryBuilder({ data: [{ id: 11 }], error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilderPasajero10,
      relinkUpdateBuilderPasajero11,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [
        { orden: 1, cantidad: 9, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Standard" },
      ],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true)
    expect((result as any).enlacesDescartados).toEqual([])
    expect(relinkUpdateBuilderPasajero10.update).toHaveBeenCalledWith({ ocupacion_id: 200 })
    expect(relinkUpdateBuilderPasajero10.eq).toHaveBeenCalledWith("id", 10)
    // Passenger 11 must get its OWN room's id (201) — NOT 200 (enlaces[0]'s value).
    expect(relinkUpdateBuilderPasajero11.update).toHaveBeenCalledWith({ ocupacion_id: 201 })
    expect(relinkUpdateBuilderPasajero11.eq).toHaveBeenCalledWith("id", 11)
  })

  it("REGRESSION (the original defect) — fixing a typo in ONE room's categoria drops only THAT room's links; every other room's passenger keeps its link", async () => {
    const ocupacionesAntes = [
      { id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
      { id: 56, orden: 2, ocupacion: "TRIPLE", categoria: "Standard" },
    ]
    const pasajerosCaptureBuilder = makeQueryBuilder({
      data: [
        { id: 10, ocupacion_id: 55 },
        { id: 11, ocupacion_id: 56 },
      ],
      error: null,
    })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    // Room A (orden 1) is untouched. Room B (orden 2) had its `categoria`
    // typo-fixed from "Standard" to "Standard Room" — a materially DIFFERENT
    // string, per HC-4's exact-string rule.
    const insertBuilder = makeQueryBuilder({
      data: [
        { id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { id: 201, reserva_id: 42, orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Standard Room" },
      ],
      error: null,
    })
    const relinkUpdateBuilder = makeQueryBuilder({ data: [{ id: 10 }], error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [
        { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Standard Room" },
      ],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true) // a deliberate discard never flips relinked
    // Passenger 10 (untouched room) is re-linked; passenger 11 (edited room)
    // is the ONLY one discarded — under the pre-T2b behaviour BOTH would
    // have been silently orphaned with zero signal.
    expect((result as any).enlacesDescartados).toEqual([11])
    expect(relinkUpdateBuilder.update).toHaveBeenCalledWith({ ocupacion_id: 200 })
    expect(relinkUpdateBuilder.eq).toHaveBeenCalledWith("id", 10)
  })

  it("CONCURRENCY GUARD — a passenger re-assigned by someone else between capture and re-link is NOT clobbered; reported in enlacesNoRestablecidos, not an error", async () => {
    const ocupacionesAntes = [{ id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }]
    const pasajerosCaptureBuilder = makeQueryBuilder({ data: [{ id: 10, ocupacion_id: 55 }], error: null })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [{ id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      error: null,
    })
    // The guarded UPDATE (.eq("id",10).is("ocupacion_id", null)) matches ZERO
    // rows — another writer already assigned passenger 10 to a fresh room
    // between our capture and this UPDATE.
    const relinkUpdateBuilder = makeQueryBuilder({ data: [], error: null })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" }],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(false)
    expect((result as any).enlacesDescartados).toEqual([])
    expect((result as any).enlacesNoRestablecidos).toEqual([10])
    // A concurrent reclaim is NOT an error — no relinkError is carried.
    expect((result as any).relinkError).toBeUndefined()
    // The guard itself was actually used — this is what M5 (dropping it)
    // would fail to exercise.
    expect(relinkUpdateBuilder.eq).toHaveBeenCalledWith("id", 10)
    expect(relinkUpdateBuilder.is).toHaveBeenCalledWith("ocupacion_id", null)
  })

  it("ALL-LINKS-ATTEMPTED — two failing re-links are BOTH attempted and BOTH reported, never stopping at the first", async () => {
    const ocupacionesAntes = [
      { id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
      { id: 56, orden: 2, ocupacion: "TRIPLE", categoria: "Standard" },
    ]
    const pasajerosCaptureBuilder = makeQueryBuilder({
      data: [
        { id: 10, ocupacion_id: 55 },
        { id: 11, ocupacion_id: 56 },
      ],
      error: null,
    })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [
        { id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { id: 201, reserva_id: 42, orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Standard" },
      ],
      error: null,
    })
    const relinkUpdateBuilderPasajero10 = makeQueryBuilder({ data: null, error: { message: "update failed 1" } })
    const relinkUpdateBuilderPasajero11 = makeQueryBuilder({ data: null, error: { message: "update failed 2" } })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilderPasajero10,
      relinkUpdateBuilderPasajero11,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [
        { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Standard" },
      ],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(false)
    // BOTH links were attempted (both builders' update() was called) even
    // though the first one errored — not stopping at the first (B-10 is
    // deliberately NOT repeated on this path).
    expect(relinkUpdateBuilderPasajero10.update).toHaveBeenCalledWith({ ocupacion_id: 200 })
    expect(relinkUpdateBuilderPasajero11.update).toHaveBeenCalledWith({ ocupacion_id: 201 })
    expect((result as any).enlacesNoRestablecidos.sort()).toEqual([10, 11])
    expect((result as any).relinkError).toBe("update failed 1")
  })

  it("SEPARATION OF CONCERNS (kills M6) — a deliberate discard and a genuine relink failure in the SAME call are reported in SEPARATE, non-overlapping arrays", async () => {
    const ocupacionesAntes = [
      { id: 55, orden: 1, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
      { id: 56, orden: 2, ocupacion: "TRIPLE", categoria: "Standard" },
    ]
    const pasajerosCaptureBuilder = makeQueryBuilder({
      data: [
        { id: 10, ocupacion_id: 55 }, // room A: survives unchanged, but the re-link will be CONCURRENTLY claimed
        { id: 11, ocupacion_id: 56 }, // room B: materially changed -> deliberately discarded
      ],
      error: null,
    })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const insertBuilder = makeQueryBuilder({
      data: [
        { id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { id: 201, reserva_id: 42, orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Standard Room" }, // categoria changed
      ],
      error: null,
    })
    // Only ONE relink UPDATE call happens (for passenger 10) — passenger 11
    // never reaches the DB at all, it is discarded by the identity rule.
    const relinkUpdateBuilder = makeQueryBuilder({ data: [], error: null }) // concurrently reclaimed
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
      relinkUpdateBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [
        { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
        { orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Standard Room" },
      ],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(false) // driven ONLY by enlacesNoRestablecidos, not by the discard
    // The rule-driven drop (11) and the failed-attempt (10) must NEVER be
    // merged into one list — they demand different operator responses.
    expect((result as any).enlacesDescartados).toEqual([11])
    expect((result as any).enlacesNoRestablecidos).toEqual([10])
    expect((result as any).enlacesDescartados).not.toContain(10)
    expect((result as any).enlacesNoRestablecidos).not.toContain(11)
  })

  // (T2b send-back #1) KEY-COLLISION FIXTURE — pins that claveIdentidadMaterial
  // is INJECTIVE. An unescaped `${orden}::${ocupacion}::${categoria}` join
  // would alias these two MATERIALLY DIFFERENT rooms to the identical string
  // "1::A::B::C": old room (orden:1, ocupacion:"A::B", categoria:"C") and new
  // room (orden:1, ocupacion:"A", categoria:"B::C"). Under the injective
  // JSON.stringify([orden, ocupacion, categoria]) encoding, these two tuples
  // produce DIFFERENT keys (`[1,"A::B","C"]` vs `[1,"A","B::C"]`), so no new
  // room matches the old one and the passenger must be discarded — never
  // silently re-linked to a materially different room.
  it("KEY-COLLISION FIXTURE (T2b send-back #1) — a naive `::`-joined key would alias two DIFFERENT rooms; the injective key must NOT re-link", async () => {
    const ocupacionesAntes = [{ id: 55, orden: 1, ocupacion: "A::B", categoria: "C" }]
    const pasajerosCaptureBuilder = makeQueryBuilder({ data: [{ id: 10, ocupacion_id: 55 }], error: null })
    const ocupacionesAnterioresCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const selectCaptureBuilder = makeQueryBuilder({ data: ocupacionesAntes, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    // The "new" room is materially different (ocupacion:"A", categoria:"B::C")
    // but a naive `${orden}::${ocupacion}::${categoria}` join collides with
    // the old room's key ("1::A::B::C" for both).
    const insertBuilder = makeQueryBuilder({
      data: [{ id: 200, reserva_id: 42, orden: 1, cantidad: 8, ocupacion: "A", categoria: "B::C" }],
      error: null,
    })
    queueBuilders(
      pasajerosCaptureBuilder,
      ocupacionesAnterioresCaptureBuilder,
      selectCaptureBuilder,
      deleteBuilder,
      insertBuilder,
    )

    const result = await guardarOcupacionesReservaAction(
      42,
      [{ orden: 1, cantidad: 8, ocupacion: "A", categoria: "B::C" }],
      "user@test.com",
    )

    expect(result.success).toBe(true)
    expect((result as any).relinked).toBe(true)
    // Passenger 10 must be DISCARDED (honest NULL) — these are materially
    // different rooms despite the string-join collision. No UPDATE attempted.
    expect((result as any).enlacesDescartados).toEqual([10])
    expect(mockFrom).toHaveBeenCalledTimes(5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T5 — HC-3: registrarDiscrepanciaTotalesAction persists exactly ONE
// `auditoria` row. DETECTION is pure (lib/confirmacion-data.ts,
// tests/confirmacion-data.test.ts); this is the IMPURE persistence half,
// asserted here on the PERSISTED insert payload — never on a console spy
// (a console-spy test is an automatic FAIL of this criterion, per §10).
describe("registrarDiscrepanciaTotalesAction — HC-3 discrepancy persistence", () => {
  function makePayload(overrides: Partial<DiscrepanciaTotalesPayload> = {}): DiscrepanciaTotalesPayload {
    return {
      reservaId: 42,
      clienteId: 1,
      sumaDetalles: 800,
      precioTotal: 750,
      delta: 50,
      moneda: "DOP",
      usuario: "operador@test.com",
      ...overrides,
    }
  }

  it("writes EXACTLY ONE auditoria row with the §4.3 payload, field for field", async () => {
    const insertBuilder = makeQueryBuilder({ data: [{ id: 900 }], error: null })
    mockFrom.mockImplementation(() => insertBuilder)

    const result = await registrarDiscrepanciaTotalesAction(makePayload())

    expect(result.success).toBe(true)
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith("auditoria")
    expect(insertBuilder.insert).toHaveBeenCalledTimes(1)

    const insertedRow = insertBuilder.insert.mock.calls[0][0]
    expect(insertedRow.tabla).toBe("reservas")
    expect(insertedRow.registro_id).toBe(42)
    expect(insertedRow.accion).toBe("DISCREPANCIA")
    expect(insertedRow.datos_anteriores).toBeNull()
    expect(insertedRow.usuario).toBe("operador@test.com")
    expect(insertedRow.datos_nuevos).toMatchObject({
      source: "CONFIRMACION",
      reserva_id: 42,
      cliente_id: 1,
      suma_detalles: 800,
      precio_total: 750,
      delta: 50,
      moneda: "DOP",
    })
    expect(typeof insertedRow.datos_nuevos.generado_en).toBe("string")
    // fecha is left to the column DEFAULT NOW() — never passed explicitly.
    expect(insertedRow.fecha).toBeUndefined()
  })

  it("falls back to 'SISTEMA' when usuario is absent — NEVER null, per lib/user-context.tsx's contract", async () => {
    const insertBuilder = makeQueryBuilder({ data: [{ id: 901 }], error: null })
    mockFrom.mockImplementation(() => insertBuilder)

    await registrarDiscrepanciaTotalesAction(makePayload({ usuario: undefined }))

    const insertedRow = insertBuilder.insert.mock.calls[0][0]
    expect(insertedRow.usuario).toBe("SISTEMA")
  })

  it("falls back to 'SISTEMA' when usuario is a blank string — never persists whitespace as an identity", async () => {
    const insertBuilder = makeQueryBuilder({ data: [{ id: 902 }], error: null })
    mockFrom.mockImplementation(() => insertBuilder)

    await registrarDiscrepanciaTotalesAction(makePayload({ usuario: "   " }))

    const insertedRow = insertBuilder.insert.mock.calls[0][0]
    expect(insertedRow.usuario).toBe("SISTEMA")
  })

  it("a DIFFERENT payload (non-identical from the fixture above) persists its OWN values — not a copy-pasted constant", async () => {
    const insertBuilder = makeQueryBuilder({ data: [{ id: 903 }], error: null })
    mockFrom.mockImplementation(() => insertBuilder)

    await registrarDiscrepanciaTotalesAction(
      makePayload({ reservaId: 77, clienteId: 9, sumaDetalles: 250.5, precioTotal: 200, delta: 50.5, moneda: "USD" }),
    )

    const insertedRow = insertBuilder.insert.mock.calls[0][0]
    expect(insertedRow.registro_id).toBe(77)
    expect(insertedRow.datos_nuevos).toMatchObject({
      reserva_id: 77,
      cliente_id: 9,
      suma_detalles: 250.5,
      precio_total: 200,
      delta: 50.5,
      moneda: "USD",
    })
  })

  it("returns { success: false, error } and does NOT throw when the DB insert fails — the caller can tell the log write failed", async () => {
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: "check constraint violated" } })
    mockFrom.mockImplementation(() => insertBuilder)

    const result = await registrarDiscrepanciaTotalesAction(makePayload())

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("check constraint violated")
  })

  it("returns { success: false, error } (never throws) when supabase.from itself throws", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("network down")
    })

    const result = await registrarDiscrepanciaTotalesAction(makePayload())

    expect(result.success).toBe(false)
    expect((result as any).error).toBe("network down")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T7 — HC-2: getFacturaNumeroPorReservaAction, a READ-ONLY `FACTURA #` lookup
// that BLOCKS on any failure instead of rendering an empty/fabricated value
// (mistakes/stockin-zero-price). Every assertion below is on the RETURNED
// discriminated result / verbatim message string — never on a bare "an error
// was thrown" or a call count, per the lead's standing instruction.
//
// The two block messages MUST be distinct (SIN_COMPROBANTE = a data-entry
// job; LOOKUP_FAILED = an engineering job) — asserted with a dedicated
// not-equal test below, not just individually.
// ─────────────────────────────────────────────────────────────────────────────
describe("getFacturaNumeroPorReservaAction — T7/HC-2 read-only lookup that BLOCKS on failure", () => {
  const MENSAJE_SIN_COMPROBANTE = "FACTURA #: esta reserva no tiene comprobante fiscal asignado"

  function mensajeLookupFailedEsperado(detalle: string): string {
    return `FACTURA #: no se pudo consultar el comprobante fiscal — problema técnico, no de datos: ${detalle}`
  }

  // (T7 send-back) PARAMETER-THREADING DISCIPLINE: every test below now uses
  // its OWN distinct, non-42 reservaId (instead of all 14+ invocations
  // sharing the literal 42) AND asserts `builder.eq` was called with THAT
  // exact id — captured from the mock's actual arguments, never inferred
  // from a call count. Before this fix, only ONE test in this block ever
  // checked the value passed to `.eq("reserva_id", …)`, and it happened to
  // use the same literal (42) the (correct) source code also uses — so a
  // regression that silently replaced the threaded `reservaId` parameter
  // with a hardcoded `42` inside getFacturaNumeroPorReservaAction was
  // mathematically unable to turn any assertion in this suite red (Lens 1's
  // Mutation D, reproduced below in the PARAMETER THREADING test and in the
  // Mutation D verification run pasted in the QA report). Distinct ids per
  // test now make THAT SPECIFIC regression fail broadly, not just in one
  // token test.

  it("HAPPY PATH — a real numero_factura returns ok:true with that exact value", async () => {
    const reservaId = 101
    const builder = makeQueryBuilder({
      data: [{ id: 5, reserva_id: reservaId, numero_factura: "B0100001234", fecha_emision: "2026-06-01" }],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(true)
    expect((result as any).numeroFactura).toBe("B0100001234")
    expect(mockFrom).toHaveBeenCalledWith("comprobantes_fiscales")
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
    expect(builder.order).toHaveBeenCalledWith("fecha_emision", { ascending: false })
  })

  it("EXACTLY ONE SELECT — a single supabase.from call, no insert/update/upsert/delete/rpc", async () => {
    const reservaId = 202
    const builder = makeQueryBuilder({
      data: [{ id: 5, reserva_id: reservaId, numero_factura: "B0100001234", fecha_emision: "2026-06-01" }],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    await getFacturaNumeroPorReservaAction(reservaId)

    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(builder.select).toHaveBeenCalledTimes(1)
    expect(builder.select).toHaveBeenCalledWith("*")
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
    expect(builder.insert).not.toHaveBeenCalled()
    expect(builder.update).not.toHaveBeenCalled()
    expect(builder.delete).not.toHaveBeenCalled()
  })

  it("NEGATIVE FIXTURE 1 — no row for the reserva: SIN_COMPROBANTE, verbatim data-entry message", async () => {
    const reservaId = 303
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("SIN_COMPROBANTE")
    expect((result as any).message).toBe(MENSAJE_SIN_COMPROBANTE)
    expect((result as any).message).toBe("FACTURA #: esta reserva no tiene comprobante fiscal asignado")
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("THE QUERY ERRORING — a generic Supabase error: LOOKUP_FAILED, verbatim engineering message with detail", async () => {
    const reservaId = 404
    const builder = makeQueryBuilder({ data: null, error: { message: "connection refused" } })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("LOOKUP_FAILED")
    expect((result as any).detail).toBe("connection refused")
    expect((result as any).message).toBe(mensajeLookupFailedEsperado("connection refused"))
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("COLUMN SHAPE MISSING reserva_id — the .eq(reserva_id) filter itself fails at the DB: LOOKUP_FAILED, never SIN_COMPROBANTE", async () => {
    const reservaId = 505
    const builder = makeQueryBuilder({
      data: null,
      error: { message: "column comprobantes_fiscales.reserva_id does not exist" },
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("LOOKUP_FAILED")
    expect((result as any).detail).toBe("column comprobantes_fiscales.reserva_id does not exist")
    expect((result as any).message).toContain("problema técnico, no de datos")
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("COLUMN SHAPE MISSING numero_factura — the query SUCCEEDS but the returned row has no such key at all: LOOKUP_FAILED, not a blank value", async () => {
    // select("*") never errors just because a column is absent from the live
    // table — it simply omits the key. This is the runtime shape guard's job.
    const reservaId = 606
    const builder = makeQueryBuilder({
      data: [{ id: 5, reserva_id: reservaId, fecha_emision: "2026-06-01" /* no numero_factura key at all */ }],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("LOOKUP_FAILED")
    expect((result as any).detail).toContain("numero_factura")
    expect((result as any).message).toContain("problema técnico, no de datos")
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("a row present whose numero_factura is NULL — BLOCKS as SIN_COMPROBANTE, never renders blank", async () => {
    const reservaId = 707
    const builder = makeQueryBuilder({
      data: [{ id: 5, reserva_id: reservaId, numero_factura: null, fecha_emision: "2026-06-01" }],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("SIN_COMPROBANTE")
    expect((result as any).message).toBe(MENSAJE_SIN_COMPROBANTE)
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("a row present whose numero_factura is an EMPTY STRING — BLOCKS as SIN_COMPROBANTE, never ok:true with ''", async () => {
    const reservaId = 808
    const builder = makeQueryBuilder({
      data: [{ id: 5, reserva_id: reservaId, numero_factura: "", fecha_emision: "2026-06-01" }],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("SIN_COMPROBANTE")
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("a row present whose numero_factura is WHITESPACE-ONLY — BLOCKS as SIN_COMPROBANTE, never renders blank", async () => {
    const reservaId = 909
    const builder = makeQueryBuilder({
      data: [{ id: 5, reserva_id: reservaId, numero_factura: "   ", fecha_emision: "2026-06-01" }],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("SIN_COMPROBANTE")
    expect((result as any).message).toBe(MENSAJE_SIN_COMPROBANTE)
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  // (T7 send-back, "ALSO FOLD IN") Two near-miss cases neither prior suite
  // pinned. Behaviour is UNCHANGED by this task — only the pin is new.
  it('NUMERO_FACTURA AS THE STRING "0" — a real, if odd, invoice number: ok:true (pinned so a future change is deliberate, not accidental)', async () => {
    const reservaId = 1000
    const builder = makeQueryBuilder({
      data: [{ id: 5, reserva_id: reservaId, numero_factura: "0", fecha_emision: "2026-06-01" }],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(true)
    expect((result as any).numeroFactura).toBe("0")
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("NUMERO_FACTURA AS THE NUMBER 0 — fails the typeof === 'string' guard: SIN_COMPROBANTE (not LOOKUP_FAILED) — defensible (still blocks, never fabricates); pinned so a future change is deliberate, not accidental", async () => {
    const reservaId = 1001
    const builder = makeQueryBuilder({
      data: [{ id: 5, reserva_id: reservaId, numero_factura: 0, fecha_emision: "2026-06-01" }],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("SIN_COMPROBANTE")
    expect((result as any).message).toBe(MENSAJE_SIN_COMPROBANTE)
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("MULTIPLE ROWS (AC-6) — deterministic pick of the most-recent fecha_emision (the already-ordered first row), never the last or a random one", async () => {
    // Two NON-IDENTICAL rows for the same reserva — the ORDER BY the code
    // issues is what puts the most recent one first; this fixture asserts
    // the code reads filas[0], not filas[filas.length - 1] or filas[1].
    const reservaId = 1010
    const builder = makeQueryBuilder({
      data: [
        { id: 9, reserva_id: reservaId, numero_factura: "B0100009999", fecha_emision: "2026-06-15" },
        { id: 5, reserva_id: reservaId, numero_factura: "B0100001234", fecha_emision: "2026-01-01" },
      ],
      error: null,
    })
    mockFrom.mockImplementation(() => builder)

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(true)
    expect((result as any).numeroFactura).toBe("B0100009999")
    expect(builder.order).toHaveBeenCalledWith("fecha_emision", { ascending: false })
    expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
  })

  it("EXCEPTION PATH — never throws when supabase.from itself throws; returns LOOKUP_FAILED", async () => {
    const reservaId = 1111
    mockFrom.mockImplementation(() => {
      throw new Error("network down")
    })

    const result = await getFacturaNumeroPorReservaAction(reservaId)

    expect(result.ok).toBe(false)
    expect((result as any).reason).toBe("LOOKUP_FAILED")
    expect((result as any).detail).toBe("network down")
  })

  it("THE TWO MESSAGES ARE NOT EQUAL — collapsing SIN_COMPROBANTE and LOOKUP_FAILED into one generic message is an automatic FAIL", async () => {
    const reservaIdSinComprobante = 1212
    const sinComprobanteBuilder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockImplementation(() => sinComprobanteBuilder)
    const sinComprobante = await getFacturaNumeroPorReservaAction(reservaIdSinComprobante)
    // Captured BEFORE vi.clearAllMocks() below wipes sinComprobanteBuilder's
    // recorded call history — clearAllMocks() clears every vi.fn() in the
    // module, including builders created earlier in this same test.
    expect(sinComprobanteBuilder.eq).toHaveBeenCalledWith("reserva_id", reservaIdSinComprobante)

    vi.clearAllMocks()
    const reservaIdLookupFailed = 1313
    const lookupFailedBuilder = makeQueryBuilder({ data: null, error: { message: "boom" } })
    mockFrom.mockImplementation(() => lookupFailedBuilder)
    const lookupFailed = await getFacturaNumeroPorReservaAction(reservaIdLookupFailed)

    expect(sinComprobante.ok).toBe(false)
    expect(lookupFailed.ok).toBe(false)
    expect((sinComprobante as any).message).not.toBe((lookupFailed as any).message)
    // Each message must independently name the RIGHT kind of problem.
    expect((sinComprobante as any).message).not.toContain("problema técnico")
    expect((lookupFailed as any).message).toContain("problema técnico, no de datos")
    expect(lookupFailedBuilder.eq).toHaveBeenCalledWith("reserva_id", reservaIdLookupFailed)
  })

  it("NEVER allocates/writes — a fiscal-adjacent regression guard: no call ever reaches insert/update/upsert/delete/rpc on this table, across every fixture above", async () => {
    const fixtures = [
      { reservaId: 1414, canned: { data: [{ id: 5, reserva_id: 1414, numero_factura: "B01", fecha_emision: "2026-06-01" }], error: null } },
      { reservaId: 1515, canned: { data: [], error: null } },
      { reservaId: 1616, canned: { data: null, error: { message: "boom" } } },
    ]
    for (const { reservaId, canned } of fixtures) {
      const builder = makeQueryBuilder(canned)
      mockFrom.mockImplementation(() => builder)
      await getFacturaNumeroPorReservaAction(reservaId)
      expect(builder.eq).toHaveBeenCalledWith("reserva_id", reservaId)
      expect(builder.insert).not.toHaveBeenCalled()
      expect(builder.update).not.toHaveBeenCalled()
      expect(builder.delete).not.toHaveBeenCalled()
      expect((builder as any).upsert).toBeUndefined()
      expect((builder as any).rpc).toBeUndefined()
    }
  })

  // (T7 send-back, REQUIRED FIX #2) Dedicated fixture: asserts the value
  // ACTUALLY PASSED to `.eq(...)` equals the reservaId argument the caller
  // supplied, using >=2 non-identical ids, read from the mock's captured
  // call arguments (toHaveBeenNthCalledWith) — never inferred from a call
  // count. Named fixture for the Mutation D re-run: "PARAMETER THREADING".
  it("PARAMETER THREADING — .eq('reserva_id', …) receives the ACTUAL caller-supplied reservaId on each call (kills a hardcoded .eq('reserva_id', 42) filter)", async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockImplementation(() => builder)

    await getFacturaNumeroPorReservaAction(7)
    await getFacturaNumeroPorReservaAction(58493)

    // Two deliberately non-identical, non-42 ids. A hardcoded
    // `.eq("reserva_id", 42)` (or any other fixed literal) satisfies NEITHER
    // of the two calls below — this is the fixture Mutation D must turn red.
    expect(builder.eq).toHaveBeenNthCalledWith(1, "reserva_id", 7)
    expect(builder.eq).toHaveBeenNthCalledWith(2, "reserva_id", 58493)
  })
})
