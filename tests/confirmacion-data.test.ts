// Offline tests for lib/confirmacion-data.ts (patterns/port-and-in-memory-fake).
// Plain data objects only — no Supabase, no network. See the module doc for
// why this file must stay pure.
import { readFileSync } from "fs"
import { resolve } from "path"
import { describe, it, expect } from "vitest"
import {
  buildConfirmacionData,
  type BuildConfirmacionDataInput,
  type ReservaDetalleInput,
} from "../lib/confirmacion-data"

// ─────────────────────────────────────────────────────────────────────────────
// A fully valid fixture. Individual tests clone it and break exactly ONE
// thing so each block assertion is unambiguous.
// ─────────────────────────────────────────────────────────────────────────────
function validInput(): BuildConfirmacionDataInput {
  return {
    cliente: {
      id: 1,
      nombre: "Ana Perez",
      cedulaRnc: "001-1234567-8",
      email: "ana@test.com",
      whatsapp: "809-555-1234",
    },
    producto: { nombre: "Hotel Test Punta Cana" },
    reserva: {
      id: 42,
      fechaEntrada: "2026-08-01",
      fechaSalida: "2026-08-05",
      horaEntrada: "15:00",
      horaSalida: "12:00",
      fechaReserva: "2026-07-01",
      precioTotal: 800,
      abonadoContabilidad: 100,
      moneda: "DOP",
      pasajerosCount: 2,
      habitacionesCount: 1,
      observaciones: "Ninguna",
      atendidoPor: "Bryan Mendez",
      referidoPor: "Juan Referido",
    },
    facturaNumero: "B0100000123",
    // Two NON-IDENTICAL lines with different values, per the lead's standing
    // instruction — a single-line fixture cannot distinguish "sums each
    // line's own value" from "uses the first line's value twice".
    lineas: [
      { concepto: "Hospedaje", descripcion: "Hospedaje 4 noches", precioUnitario: 700, descuento: 0, total: 700 },
      { concepto: "Transporte", descripcion: null, precioUnitario: 100, descuento: 0, total: 100 },
    ],
    // Two NON-IDENTICAL passengers.
    pasajeros: [
      { orden: 1, nombreCompleto: "Ana Perez", tipoPax: "ADULTO" },
      { orden: 2, nombreCompleto: "Luis Perez", tipoPax: "NINO" },
    ],
    pagosReserva: [300, 100],
    // Two NON-IDENTICAL reservas (different currencies) feeding BALANCE GENERAL.
    reservasParaBalanceGeneral: [
      { precioTotal: 800, abonadoContabilidad: 100, pagos: [300, 100], moneda: "DOP" },
      { precioTotal: 500, abonadoContabilidad: 0, pagos: [200], moneda: "USD" },
    ],
  }
}

/** Deep-ish clone so tests never mutate the shared fixture across cases. */
function clone(input: BuildConfirmacionDataInput): BuildConfirmacionDataInput {
  return JSON.parse(JSON.stringify(input))
}

// ─────────────────────────────────────────────────────────────────────────────
describe("buildConfirmacionData — happy path", () => {
  it("returns ok:true with every field populated from the validated input, no discrepancy when totals agree", () => {
    const result = buildConfirmacionData(validInput())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")

    expect(result.data.idCliente).toBe(1)
    expect(result.data.nombre).toBe("Ana Perez")
    expect(result.data.cedulaRnc).toBe("001-1234567-8")
    expect(result.data.email).toBe("ana@test.com")
    expect(result.data.whatsapp).toBe("809-555-1234")
    expect(result.data.servicio).toBe("Hotel Test Punta Cana")
    expect(result.data.checkIn).toBe("2026-08-01")
    expect(result.data.checkOut).toBe("2026-08-05")
    expect(result.data.horaEntrada).toBe("15:00")
    expect(result.data.horaSalida).toBe("12:00")
    expect(result.data.fechaReserva).toBe("2026-07-01")
    expect(result.data.idReserva).toBe(42)
    expect(result.data.facturaNumero).toBe("B0100000123")
    expect(result.data.pasajerosCount).toBe(2)
    expect(result.data.habitacionesCount).toBe(1)
    expect(result.data.observaciones).toBe("Ninguna")
    expect(result.data.atendidoPor).toBe("Bryan Mendez")
    expect(result.data.referidoPor).toBe("Juan Referido")

    // Each line keeps its OWN values — not the first line's values duplicated.
    expect(result.data.lineas).toEqual([
      { descripcion: "Hospedaje 4 noches", precioUnitario: 700, descuento: 0, total: 700 },
      { descripcion: "Transporte", precioUnitario: 100, descuento: 0, total: 100 }, // concepto fallback
    ])
    expect(result.data.subTotal).toBe(800)
    expect(result.data.descTotal).toBe(0)
    expect(result.data.total).toBe(800)

    // MONTO PAGADO / BALANCE RESERVA come from lib/finance.ts:
    // montoPagado = sum(pagos) + abonado = 400 + 100 = 500
    // balanceReserva = precioTotal - montoPagado = 800 - 500 = 300
    expect(result.data.montoPagado).toBe(500)
    expect(result.data.balanceReserva).toBe(300)
    // balanceGeneral: DOP reserva -> 800-100-400=300; USD reserva -> 500-0-200=300
    expect(result.data.balanceGeneralDOP).toBe(300)
    expect(result.data.balanceGeneralUSD).toBe(300)

    expect(result.data.pasajeros).toEqual([
      { orden: 1, nombreCompleto: "Ana Perez", tipoPax: "ADULTO" },
      { orden: 2, nombreCompleto: "Luis Perez", tipoPax: "NINO" },
    ])

    // Totals agree (Σdetalles 800 === precio_total 800) -> no discrepancia.
    expect(result.discrepancia).toBeUndefined()
  })

  it("observaciones and referidoPor are the ONLY optional fields — absent still builds, as empty strings", () => {
    const input = clone(validInput())
    delete (input.reserva as any).observaciones
    delete (input.reserva as any).referidoPor

    const result = buildConfirmacionData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.observaciones).toBe("")
    expect(result.data.referidoPor).toBe("")
  })

  it("a genuinely empty passenger list is PERMITTED (not blocked) — renders zero lines, never a fake placeholder", () => {
    const input = clone(validInput())
    input.pasajeros = []

    const result = buildConfirmacionData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.pasajeros).toEqual([])
  })

  it("a genuinely zero pasajerosCount / habitacionesCount / cliente.id is a VALID value, never treated as missing", () => {
    const input = clone(validInput())
    input.reserva.pasajerosCount = 0
    input.reserva.habitacionesCount = 0
    input.cliente!.id = 0

    const result = buildConfirmacionData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.pasajerosCount).toBe(0)
    expect(result.data.habitacionesCount).toBe(0)
    expect(result.data.idCliente).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("buildConfirmacionData — BLOCK-NEVER-DEFAULT (mistakes/stockin-zero-price)", () => {
  function expectBlocked(input: BuildConfirmacionDataInput, expectedLabel: string) {
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain(expectedLabel)
    // Structural guarantee: a blocked result NEVER carries a `data` object —
    // there is no code path that can leak a partially-defaulted value.
    expect(Object.keys(result).sort()).toEqual(["missing", "ok"])
    expect((result as any).data).toBeUndefined()
  }

  it("blocks when cliente is entirely missing", () => {
    const input = clone(validInput())
    input.cliente = null
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toEqual(
      expect.arrayContaining(["ID CLIENTE", "NOMBRE", "CEDULA/RNC", "EMAIL", "WHATSAPP"]),
    )
  })

  it("blocks when cliente.id is missing (ID CLIENTE)", () => {
    const input = clone(validInput())
    delete (input.cliente as any).id
    expectBlocked(input, "ID CLIENTE")
  })

  it("blocks when cliente.nombre is missing (NOMBRE)", () => {
    const input = clone(validInput())
    delete (input.cliente as any).nombre
    expectBlocked(input, "NOMBRE")
  })

  it("blocks when cliente.cedulaRnc is missing (CEDULA/RNC)", () => {
    const input = clone(validInput())
    delete (input.cliente as any).cedulaRnc
    expectBlocked(input, "CEDULA/RNC")
  })

  it("blocks when cliente.email is missing (EMAIL)", () => {
    const input = clone(validInput())
    delete (input.cliente as any).email
    expectBlocked(input, "EMAIL")
  })

  it("blocks when cliente.whatsapp is missing (WHATSAPP)", () => {
    const input = clone(validInput())
    delete (input.cliente as any).whatsapp
    expectBlocked(input, "WHATSAPP")
  })

  it("blocks when producto is entirely missing (SERVICIO)", () => {
    const input = clone(validInput())
    input.producto = null
    expectBlocked(input, "SERVICIO")
  })

  it("blocks when producto.nombre is missing (SERVICIO)", () => {
    const input = clone(validInput())
    delete (input.producto as any).nombre
    expectBlocked(input, "SERVICIO")
  })

  it("blocks when reserva.id is missing (ID RESERVA)", () => {
    const input = clone(validInput())
    delete (input.reserva as any).id
    expectBlocked(input, "ID RESERVA")
  })

  it("blocks when fecha_entrada is missing (CHECK IN)", () => {
    const input = clone(validInput())
    delete (input.reserva as any).fechaEntrada
    expectBlocked(input, "CHECK IN")
  })

  it("blocks when fecha_salida is missing (CHECK OUT)", () => {
    const input = clone(validInput())
    delete (input.reserva as any).fechaSalida
    expectBlocked(input, "CHECK OUT")
  })

  it("blocks with a DISTINCT message when fecha_salida <= fecha_entrada — never a 0/negative night count", () => {
    const input = clone(validInput())
    input.reserva.fechaEntrada = "2026-08-05"
    input.reserva.fechaSalida = "2026-08-05" // equal, not just reversed
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("CHECK OUT (la fecha de salida debe ser posterior a la fecha de entrada)")
    // The plain "CHECK IN"/"CHECK OUT missing" labels must NOT also fire —
    // both dates ARE present, just invalid.
    expect(result.missing).not.toContain("CHECK IN")
    expect(result.missing).not.toContain("CHECK OUT")
  })

  it("blocks when hora_entrada is missing (HORA ENTRADA)", () => {
    const input = clone(validInput())
    delete (input.reserva as any).horaEntrada
    expectBlocked(input, "HORA ENTRADA")
  })

  it("blocks when hora_salida is missing (HORA SALIDA)", () => {
    const input = clone(validInput())
    delete (input.reserva as any).horaSalida
    expectBlocked(input, "HORA SALIDA")
  })

  it("blocks when fecha_reserva is missing (FECHA RESERVA) — never today's date as a fallback", () => {
    const input = clone(validInput())
    delete (input.reserva as any).fechaReserva
    expectBlocked(input, "FECHA RESERVA")
  })

  it("blocks when pasajerosCount is missing (PASAJEROS) — never defaulted to 0 or 1", () => {
    const input = clone(validInput())
    delete (input.reserva as any).pasajerosCount
    expectBlocked(input, "PASAJEROS")
  })

  it("blocks when habitacionesCount is missing (HABITACIONES) — never defaulted to 1", () => {
    const input = clone(validInput())
    delete (input.reserva as any).habitacionesCount
    expectBlocked(input, "HABITACIONES")
  })

  it("blocks when atendidoPor is missing (ATENDIDO POR)", () => {
    const input = clone(validInput())
    delete (input.reserva as any).atendidoPor
    expectBlocked(input, "ATENDIDO POR")
  })

  it("blocks when pasajeros was never fetched (undefined) — distinct from a genuinely empty list", () => {
    const input = clone(validInput())
    delete (input as any).pasajeros
    expectBlocked(input, "PASAJEROS (lista de pasajeros)")
  })

  it("blocks when pasajeros is explicitly null — same as undefined", () => {
    const input = clone(validInput())
    input.pasajeros = null
    expectBlocked(input, "PASAJEROS (lista de pasajeros)")
  })

  it("blocks when reserva_detalles has ZERO rows — never synthesises a fallback line", () => {
    const input = clone(validInput())
    input.lineas = []
    expectBlocked(input, "DETALLE (la reserva no tiene líneas de servicio)")
  })

  it("blocks when lineas was never fetched (undefined) — same message as zero rows", () => {
    const input = clone(validInput())
    delete (input as any).lineas
    expectBlocked(input, "DETALLE (la reserva no tiene líneas de servicio)")
  })

  it("blocks a single DETALLE line whose descripcion AND concepto are both blank", () => {
    const input = clone(validInput())
    input.lineas![1] = { concepto: "  ", descripcion: "", precioUnitario: 100, descuento: 0, total: 100 }
    expectBlocked(input, "DETALLE (línea 2): descripción")
  })

  it("a per-line descripcion falls back to concepto when descripcion itself is blank", () => {
    const input = clone(validInput())
    input.lineas![0] = { concepto: "Hospedaje Real", descripcion: null, precioUnitario: 700, descuento: 0, total: 700 }
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.lineas[0].descripcion).toBe("Hospedaje Real")
  })

  it("blocks a DETALLE line missing precioUnitario", () => {
    const input = clone(validInput())
    delete (input.lineas![0] as any).precioUnitario
    expectBlocked(input, "DETALLE (línea 1): precio")
  })

  it("blocks a DETALLE line missing descuento", () => {
    const input = clone(validInput())
    delete (input.lineas![0] as any).descuento
    expectBlocked(input, "DETALLE (línea 1): descuento")
  })

  it("blocks a DETALLE line missing total", () => {
    const input = clone(validInput())
    delete (input.lineas![0] as any).total
    expectBlocked(input, "DETALLE (línea 1): total")
  })

  it("COLLECTS ALL missing fields in one pass — never short-circuits at the first (design requirement #2)", () => {
    const input = clone(validInput())
    delete (input.cliente as any).email
    delete (input.reserva as any).habitacionesCount
    delete (input.reserva as any).atendidoPor
    input.lineas = []

    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toEqual(
      expect.arrayContaining([
        "EMAIL",
        "HABITACIONES",
        "ATENDIDO POR",
        "DETALLE (la reserva no tiene líneas de servicio)",
      ]),
    )
    expect(result.missing.length).toBeGreaterThanOrEqual(4)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// HC-2 REVISED (CONFIRMACIÓN — make FACTURA # OPTIONAL): `facturaNumero` was
// previously REQUIRED (the old HC-2 ruling). That premise — a per-reserva
// client-invoice number exists somewhere — turned out to be false: no
// client-invoice table/column exists in this database. The human explicitly
// ruled "make factura # optional for now." These tests are the regression
// guard for THAT reversal, and — per AC-6 — prove every OTHER required field
// is completely untouched.
describe("buildConfirmacionData — HC-2 REVISED: FACTURA # is now OPTIONAL (AC-1/AC-2/AC-5/AC-6)", () => {
  it("AC-1: builds ok:true with NO facturaNumero supplied at all (undefined) — document generates", () => {
    const input = clone(validInput())
    delete (input as any).facturaNumero

    const result = buildConfirmacionData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    // Structural guarantee: an `ok: true` result never carries `missing` at
    // all (this is a type-level fact, not just a value check).
    expect(Object.keys(result)).not.toContain("missing")
  })

  it("AC-1/AC-2: absent facturaNumero (undefined) is represented as `null` on `data` — never blocks, never fabricated", () => {
    const input = clone(validInput())
    delete (input as any).facturaNumero

    const result = buildConfirmacionData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    // Block-never-default (mistakes/stockin-zero-price): `null` is the ONLY
    // acceptable representation of "absent" — never "", "N/A", "-",
    // "PENDIENTE", today's date, or any other placeholder.
    expect(result.data.facturaNumero).toBeNull()
  })

  it("AC-2: an explicit `null` facturaNumero also builds ok, also renders as `null` (never coerced to a placeholder)", () => {
    const input = clone(validInput())
    input.facturaNumero = null

    const result = buildConfirmacionData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.facturaNumero).toBeNull()
  })

  it("AC-2: a blank/whitespace-only facturaNumero also builds ok and is normalised to `null`, not smuggled through as \"\"", () => {
    const input = clone(validInput())
    input.facturaNumero = "   "

    const result = buildConfirmacionData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.facturaNumero).toBeNull()
  })

  it("AC-5 (positive control): a facturaNumero that DOES exist still renders exactly as before — proves a requirement was removed, not the feature", () => {
    const result = buildConfirmacionData(validInput())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.facturaNumero).toBe("B0100000123")
  })

  it('"FACTURA #" never appears in `missing` under ANY input, including when literally everything else is also absent', () => {
    const input = clone(validInput())
    delete (input as any).facturaNumero
    input.cliente = null
    input.producto = null
    input.lineas = []
    delete (input as any).pasajeros

    const result = buildConfirmacionData(input)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).not.toContain("FACTURA #")
  })

  it("AC-6 regression guard: EVERY OTHER required field still blocks — cliente.email (a contact field)", () => {
    const input = clone(validInput())
    delete (input as any).facturaNumero // FACTURA # absent too — must not mask the real block
    delete (input.cliente as any).email
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("EMAIL")
  })

  it("AC-6 regression guard: EVERY OTHER required field still blocks — fecha_reserva (a date field)", () => {
    const input = clone(validInput())
    delete (input as any).facturaNumero
    delete (input.reserva as any).fechaReserva
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("FECHA RESERVA")
  })

  it("AC-6 regression guard: EVERY OTHER required field still blocks — DETALLE lines", () => {
    const input = clone(validInput())
    delete (input as any).facturaNumero
    input.lineas = []
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("DETALLE (la reserva no tiene líneas de servicio)")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("buildConfirmacionData — HC-3 pure discrepancy DETECTION (no block, no write)", () => {
  function mismatchInput(): BuildConfirmacionDataInput {
    const input = clone(validInput())
    // Exact numbers from the plan's §10 test spec: Σdetalles 800.00 vs
    // precio_total 750.00 (delta 50.00).
    input.reserva.precioTotal = 750.0
    input.lineas = [
      { concepto: "Hospedaje", descripcion: "Hospedaje 4 noches", precioUnitario: 700, descuento: 0, total: 700 },
      { concepto: "Transporte", descripcion: "Transporte aeropuerto", precioUnitario: 100, descuento: 0, total: 100 },
    ] as ReservaDetalleInput[]
    return input
  }

  it("generates successfully AND returns a discrepancia payload matching §4.3 field for field", () => {
    const result = buildConfirmacionData(mismatchInput())

    expect(result.ok).toBe(true) // HC-3: print, never block
    if (!result.ok) throw new Error("unreachable")
    expect(result.discrepancia).toEqual({
      reservaId: 42,
      clienteId: 1,
      sumaDetalles: 800,
      precioTotal: 750,
      delta: 50,
      moneda: "DOP",
    })
  })

  it("the matching case (delta 0) returns NO discrepancia payload", () => {
    const result = buildConfirmacionData(validInput())
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.discrepancia).toBeUndefined()
  })

  it("a delta within the 0.01 epsilon does NOT count as a discrepancy", () => {
    const input = clone(validInput())
    input.reserva.precioTotal = 800.005
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.discrepancia).toBeUndefined()
  })

  it("a negative delta (precio_total GREATER than Σdetalles) is also detected", () => {
    const input = clone(validInput())
    input.reserva.precioTotal = 900 // Σdetalles is 800 -> delta = -100
    const result = buildConfirmacionData(input)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.discrepancia?.delta).toBe(-100)
  })

  it("does NOT render a warning into the document — no discrepancy-related key exists on ConfirmacionData itself", () => {
    const result = buildConfirmacionData(mismatchInput())
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    // discrepancia lives ALONGSIDE data on the result, never INSIDE data —
    // so a template that only ever reads `data` structurally cannot render it.
    expect(Object.keys(result.data)).not.toContain("discrepancia")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("buildConfirmacionData — purity (patterns/port-and-in-memory-fake)", () => {
  it("lib/confirmacion-data.ts has ZERO Supabase imports (grep-verified automatically)", () => {
    const source = readFileSync(resolve(__dirname, "../lib/confirmacion-data.ts"), "utf-8")
    // Grep only the `import ...` lines — the module doc's PROSE legitimately
    // says "no Supabase imports" in plain English; what must be absent is an
    // actual import statement pulling in a Supabase client.
    const importLines = source
      .split("\n")
      .filter((line) => /^\s*import /.test(line))
      .join("\n")
      .toLowerCase()
    expect(importLines).not.toContain("supabase")
    expect(source).not.toContain("createClient(")
  })

  it("MONTO PAGADO / BALANCE RESERVA / BALANCE GENERAL are computed ONLY via lib/finance.ts's exports (grep-verified)", () => {
    const source = readFileSync(resolve(__dirname, "../lib/confirmacion-data.ts"), "utf-8")
    expect(source).toContain('from "./finance"')
    expect(source).toContain("calcularMontoPagado(")
    expect(source).toContain("calcularBalanceReserva(")
    expect(source).toContain("calcularBalanceGeneralPorMoneda(")
  })
})
