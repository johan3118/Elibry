// @vitest-environment node
//
// HOTFIX (2026-07-28) regression coverage for app/facturacion/voucher/page.tsx's
// TELEFONO-derivation wiring. Mirrors tests/crm-casos-page.test.ts's
// established pattern (this repo's precedent for testing page-level logic):
// import the REAL exported function straight out of the page module, in the
// node environment, no React Testing Library / no component mount.
//
// REPOINT (2026-07-28): production-verified that `productos.telefono_contacto`
// is a DEAD column — NULL on 100% of production rows, written by nothing in
// the app — while `productos.telefonos_json` (a JSON array of strings) is
// populated on all 8 production rows and is the column
// app/productos/registrar/page.tsx:220 / app/productos/editar/page.tsx:237
// actually write. `derivarTelefonoHotel` now sources from `telefonos_json`
// exclusively; `telefono_contacto` is removed from the select, the local
// `Producto` interface, and the derivation — NOT kept as a fallback (a
// fallback to a dead column is dead code).
//
// Human decision (verbatim): "both if have 2 or idk all of them. if only 1
// then one" — every entry in telefonos_json is printed, joined with ", ".
//
// Closes:
//   - M1/N1 (QA): a mutated/copy-pasted wiring line, or one that only reads
//     telefonos_json[0] instead of joining every entry, is caught by the
//     "(a)" tests below.
//   - N2 (QA): silently dropping a needed telefono column from the productos
//     select-string is caught by the PRODUCTOS_SELECT_COLUMNS assertion —
//     the exact same bug class as the original outage, one layer over
//     (PostgREST just omits the column; no thrown error; tsc stays clean
//     because select strings are untyped).
import { describe, it, expect } from "vitest"
import {
  derivarTelefonoHotel,
  PRODUCTOS_SELECT_COLUMNS,
  hayDiscrepanciaPax,
  sumarCantidadOcupaciones,
  hayDiscrepanciaHabitaciones,
  mapearDetallesAOcupaciones,
  debePrefillarOcupaciones,
  resolverOcupacionesParaPrefill,
} from "../app/facturacion/voucher/page"

// Two NON-IDENTICAL productos so a test can't pass by accident on "the first
// item's value repeated".
const PRODUCTOS_FIXTURE = [
  { id: 501, nombre_producto: "Bahia Principe Grand Punta Cana", direccion: "Carr. El Macao, Punta Cana", telefonos_json: ["8492522022", "8093222058"] },
  { id: 502, nombre_producto: "Hotel Riu Bambu", direccion: "Playa Bavaro, Punta Cana", telefonos_json: ["8090328482"] },
]

describe("derivarTelefonoHotel", () => {
  it("(a) AC-1 — two entries join as \"A, B\"", () => {
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, 501)).toBe("8492522022, 8093222058")
  })

  it("(a) AC-1 — one entry returns just that entry, no separator", () => {
    // A SECOND, DIFFERENT producto proves the lookup isn't hardcoded to the
    // first fixture element.
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, 502)).toBe("8090328482")
  })

  it("(a) AC-1 — three entries join as \"A, B, C\"", () => {
    const productosTresTelefonos = [
      { id: 503, nombre_producto: "Occidental Punta Cana", direccion: "Playa Bavaro", telefonos_json: ["8492522022", "8095374070", "8091112222"] },
    ]
    expect(derivarTelefonoHotel(productosTresTelefonos, 503)).toBe("8492522022, 8095374070, 8091112222")
  })

  it("(b) returns null when the producto is not found", () => {
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, 999)).toBeNull()
  })

  it("(b) also returns null when productoId itself is null/undefined (no reserva.producto_id yet)", () => {
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, null)).toBeNull()
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, undefined)).toBeNull()
  })

  it("(c) AC-2 — returns null (BLOCKS) when telefonos_json is undefined on the producto row", () => {
    const productosSinTelefono = [
      { id: 601, nombre_producto: "Hotel Sin Telefono", direccion: "Some address" },
    ]
    expect(derivarTelefonoHotel(productosSinTelefono, 601)).toBeNull()
  })

  it("(c) AC-2 — returns null (BLOCKS) when telefonos_json is explicitly null", () => {
    const productosConNull = [
      { id: 603, nombre_producto: "Hotel Telefono Null", direccion: "Some address", telefonos_json: null },
    ]
    expect(derivarTelefonoHotel(productosConNull, 603)).toBeNull()
  })

  it("(c) AC-2 — returns null (BLOCKS) when telefonos_json is an empty array", () => {
    const productosConArrayVacio = [
      { id: 604, nombre_producto: "Hotel Sin Numeros", direccion: "Some address", telefonos_json: [] },
    ]
    expect(derivarTelefonoHotel(productosConArrayVacio, 604)).toBeNull()
  })

  it("(c) AC-2 — returns null (BLOCKS) when EVERY entry in telefonos_json is blank/whitespace", () => {
    const productosTodoBlanco = [
      { id: 605, nombre_producto: "Hotel Todo Blanco", direccion: "Some address", telefonos_json: ["   ", "", "\t"] },
    ]
    expect(derivarTelefonoHotel(productosTodoBlanco, 605)).toBeNull()
  })

  it("AC-3 — a blank entry INSIDE a non-empty array is skipped, no leading/trailing/doubled separator", () => {
    const productosConBlancoEnMedio = [
      { id: 606, nombre_producto: "Hotel Con Blanco En Medio", direccion: "Some address", telefonos_json: ["8492522022", "  ", "8093222058"] },
    ]
    expect(derivarTelefonoHotel(productosConBlancoEnMedio, 606)).toBe("8492522022, 8093222058")
  })

  it("AC-4 — duplicate entries are PRESERVED, never de-duplicated (real production data — id=3/4/8 shape)", () => {
    const productosConDuplicado = [
      { id: 607, nombre_producto: "Jarabacoa", direccion: "Jarabacoa", telefonos_json: ["8492522022", "8492522022"] },
    ]
    expect(derivarTelefonoHotel(productosConDuplicado, 607)).toBe("8492522022, 8492522022")
  })

  it("AC-7 — never falls back to \"\", \"N/A\", the producto's own direccion, or any other field when there is no usable phone — proves the block-never-default rule", () => {
    const productosSinTelefono = [
      { id: 608, nombre_producto: "Hotel Bloqueado", direccion: "Carr. El Macao, Punta Cana", telefonos_json: [] },
    ]
    const result = derivarTelefonoHotel(productosSinTelefono, 608)
    expect(result).toBeNull()
    expect(result).not.toBe("")
    expect(result).not.toBe("N/A")
    expect(result).not.toBe("Carr. El Macao, Punta Cana")
  })

  it("never falls back to the producto's own direccion or any other field — proves N1 (a copy-paste of the DIRECCIÓN line into the TELEFONO slot) is caught", () => {
    const result = derivarTelefonoHotel(PRODUCTOS_FIXTURE, 501)
    expect(result).not.toBe("Carr. El Macao, Punta Cana") // the producto's direccion
    expect(result).toBe("8492522022, 8093222058") // the producto's telefonos_json, joined
  })
})

describe("PRODUCTOS_SELECT_COLUMNS — the voucher page's productos query column list (HOTFIX N2 guard)", () => {
  it("AC-5 — requests telefonos_json — dropping it from the select string reproduces the original outage's bug class", () => {
    expect(PRODUCTOS_SELECT_COLUMNS).toContain("telefonos_json")
  })

  it("AC-5 — telefono_contacto is GONE from the select string (dead column, not kept as a fallback)", () => {
    expect(PRODUCTOS_SELECT_COLUMNS).not.toContain("telefono_contacto")
  })

  it("still requests every other column the page's TELEFONO/DIRECCIÓN wiring depends on", () => {
    expect(PRODUCTOS_SELECT_COLUMNS).toContain("id")
    expect(PRODUCTOS_SELECT_COLUMNS).toContain("direccion")
    expect(PRODUCTOS_SELECT_COLUMNS).toContain("suplidor_id")
  })
})

// ---------------------------------------------------------------------------
// VOUCHER UX task (2026-07-28): "surface the reserva's pasajeros/habitaciones
// totals next to the inputs, and warn on mismatch" — non-blocking DISPLAY +
// WARN only, no prefill. Real, exported pure functions imported straight out
// of the page module (same pattern as `derivarTelefonoHotel` above / mirrors
// `buildCierreOptimista` in app/crm/casos/page.tsx) — no mirror/hand-copied
// stubs.
// ---------------------------------------------------------------------------

describe("hayDiscrepanciaPax", () => {
  it("matching values -> no warning", () => {
    expect(hayDiscrepanciaPax(2, 2, 0, 4)).toBe(false)
  })

  it("genuine mismatch -> warning", () => {
    // 2 pax typed vs a reserva whose pasajeros = 8 — exactly the scenario
    // named in the task's rationale.
    expect(hayDiscrepanciaPax(2, 0, 0, 8)).toBe(true)
  })

  it("pax_adultos null -> NO warning (incomplete entry, not a mismatch)", () => {
    expect(hayDiscrepanciaPax(null, 2, 0, 8)).toBe(false)
  })

  it("pax_ninos null -> NO warning", () => {
    expect(hayDiscrepanciaPax(2, null, 0, 8)).toBe(false)
  })

  it("pax_infantes null -> NO warning", () => {
    expect(hayDiscrepanciaPax(2, 2, null, 8)).toBe(false)
  })

  it("reservas.pasajeros null -> NO warning", () => {
    expect(hayDiscrepanciaPax(2, 2, 0, null)).toBe(false)
  })

  it("every operand undefined (not just null) -> NO warning", () => {
    expect(hayDiscrepanciaPax(undefined, undefined, undefined, undefined)).toBe(false)
  })

  it("0 values are compared, NOT skipped: 0+0+0 vs pasajeros=0 is a MATCH, not a mismatch (falsy-vs-nullish trap)", () => {
    expect(hayDiscrepanciaPax(0, 0, 0, 0)).toBe(false)
  })

  it("pax_ninos = 0 with a real, different total is a genuine, legitimate comparison, not skipped", () => {
    // 2 adultos + 0 niños + 0 infantes = 2, reserva says pasajeros = 3.
    expect(hayDiscrepanciaPax(2, 0, 0, 3)).toBe(true)
  })
})

describe("sumarCantidadOcupaciones", () => {
  it("sums cantidad across rows", () => {
    expect(
      sumarCantidadOcupaciones([{ cantidad: 1 }, { cantidad: 2 }, { cantidad: 1 }]),
    ).toBe(4)
  })

  it("empty list -> 0 (a known, real value — no groups entered at all)", () => {
    expect(sumarCantidadOcupaciones([])).toBe(0)
  })

  it("any row with a null cantidad -> null (an in-progress, half-typed group, not a known total)", () => {
    expect(sumarCantidadOcupaciones([{ cantidad: 1 }, { cantidad: null }])).toBeNull()
  })

  it("any row with an undefined cantidad -> null, same as an explicit null", () => {
    expect(sumarCantidadOcupaciones([{ cantidad: 1 }, { cantidad: undefined }])).toBeNull()
  })

  it("a single row with cantidad 0 sums to 0, not treated as missing", () => {
    expect(sumarCantidadOcupaciones([{ cantidad: 0 }])).toBe(0)
  })
})

describe("hayDiscrepanciaHabitaciones", () => {
  it("matching values -> no warning", () => {
    expect(hayDiscrepanciaHabitaciones(3, 3)).toBe(false)
  })

  it("genuine mismatch -> warning", () => {
    expect(hayDiscrepanciaHabitaciones(1, 4)).toBe(true)
  })

  it("sumaCantidadOcupaciones null -> NO warning (incomplete entry, not a mismatch)", () => {
    expect(hayDiscrepanciaHabitaciones(null, 4)).toBe(false)
  })

  it("habitacionesReserva null -> NO warning", () => {
    expect(hayDiscrepanciaHabitaciones(2, null)).toBe(false)
  })

  it("both operands undefined -> NO warning", () => {
    expect(hayDiscrepanciaHabitaciones(undefined, undefined)).toBe(false)
  })

  it("0 values are compared, NOT skipped: 0 vs 0 is a MATCH, not a mismatch", () => {
    expect(hayDiscrepanciaHabitaciones(0, 0)).toBe(false)
  })

  it("a sum of 0 against a real, non-zero habitaciones total is a genuine mismatch, not skipped", () => {
    expect(hayDiscrepanciaHabitaciones(0, 4)).toBe(true)
  })

  it("EMPTY ocupaciones list vs a non-null habitaciones total: composed end-to-end, this IS a mismatch — " +
    "sumarCantidadOcupaciones([]) is the known value 0 (no groups entered at all, not an unfinished one), " +
    "so it is compared for real against a reserva that expects rooms, exactly like any other 0-vs-N case above.",
    () => {
      expect(hayDiscrepanciaHabitaciones(sumarCantidadOcupaciones([]), 4)).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// VOUCHER PREFILL task (2026-07-28): mapearDetallesAOcupaciones — this task
// REVERSES the prior "don't prefill" decision on the human's explicit,
// twice-reaffirmed correction (see the task's WHY block). One
// `reserva_detalles` row -> one occupancy-editor row, VERBATIM:
//   cantidad  <- habitaciones (PER LINE, never reservas.habitaciones' SUM)
//   ocupacion <- concepto (unparsed)
//   categoria <- descripcion (unparsed)
// ---------------------------------------------------------------------------
describe("mapearDetallesAOcupaciones", () => {
  it("AC-1/AC-2 — one row per reserva_detalles row, in stable id order, mapped VERBATIM", () => {
    const detalles = [
      { concepto: "PRUEBA 1 DOBLE", descripcion: "Habitación vista mar", habitaciones: 1 },
      { concepto: "PRUEBA 2 SENCILLA", descripcion: "Habitación estándar", habitaciones: 2 },
    ]

    const resultado = mapearDetallesAOcupaciones(detalles)

    expect(resultado).toEqual([
      { cantidad: 1, ocupacion: "PRUEBA 1 DOBLE", categoria: "Habitación vista mar" },
      { cantidad: 2, ocupacion: "PRUEBA 2 SENCILLA", categoria: "Habitación estándar" },
    ])
  })

  it("AC-2 — concepto is copied VERBATIM, never parsed/extracted (e.g. 'DOBLE' is not pulled out of 'PRUEBA 1 DOBLE')", () => {
    const resultado = mapearDetallesAOcupaciones([
      { concepto: "PRUEBA 1 DOBLE", descripcion: "algo", habitaciones: 1 },
    ])
    expect(resultado[0].ocupacion).toBe("PRUEBA 1 DOBLE")
  })

  it("AC-4 — null descripcion -> categoria stays '' (never substituted with concepto or any invented string)", () => {
    const resultado = mapearDetallesAOcupaciones([
      { concepto: "PRUEBA 1 DOBLE", descripcion: null, habitaciones: 1 },
    ])
    expect(resultado[0].categoria).toBe("")
    expect(resultado[0].categoria).not.toBe("PRUEBA 1 DOBLE")
  })

  it("AC-4 — null habitaciones -> cantidad stays null (never invented as 0 or 1)", () => {
    const resultado = mapearDetallesAOcupaciones([
      { concepto: "PRUEBA 1 DOBLE", descripcion: "algo", habitaciones: null },
    ])
    expect(resultado[0].cantidad).toBeNull()
  })

  it("AC-4 — habitaciones: 0 round-trips as 0, not treated as missing/null", () => {
    const resultado = mapearDetallesAOcupaciones([
      { concepto: "PRUEBA 1 DOBLE", descripcion: "algo", habitaciones: 0 },
    ])
    expect(resultado[0].cantidad).toBe(0)
  })

  it("empty detalles list -> ONE blank row (mirrors the editor's own reset state and its 'at least one row' invariant), not []", () => {
    const resultado = mapearDetallesAOcupaciones([])
    expect(resultado).toEqual([{ cantidad: null, ocupacion: "", categoria: "" }])
  })
})

// ---------------------------------------------------------------------------
// AC-3 (non-negotiable, rule 1): "Saved ocupaciones ALWAYS win — prefill
// never fires when saved rows exist, and never overwrites them." This is
// the single most important guard in the whole task — a wrong answer here
// silently destroys a user's saved work.
// ---------------------------------------------------------------------------
describe("debePrefillarOcupaciones", () => {
  it("AC-3 — success with SAVED rows present -> prefill must NOT fire", () => {
    expect(
      debePrefillarOcupaciones({
        success: true,
        data: [{ id: 1, orden: 1, cantidad: 2, ocupacion: "DOBLE", categoria: "Suite" }],
      }),
    ).toBe(false)
  })

  it("success with ZERO saved rows -> prefill fires", () => {
    expect(debePrefillarOcupaciones({ success: true, data: [] })).toBe(true)
  })

  it("success with data: null/undefined (never actually happens per the action's shape, defended anyway) -> prefill fires", () => {
    expect(debePrefillarOcupaciones({ success: true, data: null })).toBe(true)
    expect(debePrefillarOcupaciones({ success: true })).toBe(true)
  })

  it("AC-3 — a FAILED read (we don't know if saved rows exist) -> prefill must NOT fire", () => {
    expect(debePrefillarOcupaciones({ success: false, data: null })).toBe(false)
    expect(debePrefillarOcupaciones({ success: false, data: [] })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// LEAD SEND-BACK (2026-07-28, fake-green-tests #11): resolverOcupacionesParaPrefill
// — extracted from handleReservaSelect's call site because the bare
// pass-through (`detallesResultado.data` straight into
// `mapearDetallesAOcupaciones`) was an untested wiring line, and M4 (per-line
// `habitaciones` swapped for the reserva-level SUM) went undetected — 0/140
// RED — the first time around. This suite exists specifically to make that
// swap detectable: test (a) below uses TWO detalles with DIFFERENT
// `habitaciones` and asserts each mapped row keeps its OWN value, so a
// reserva-level-sum substitution (which would make every row read the same
// total) fails it directly.
// ---------------------------------------------------------------------------
describe("resolverOcupacionesParaPrefill", () => {
  it("(a) success + data -> mapped rows, cantidad from EACH line's OWN habitaciones — not a shared reserva-level sum", () => {
    const detallesResultado = {
      success: true,
      data: [
        { id: 10, concepto: "PRUEBA 1 DOBLE", descripcion: "Habitación vista mar", habitaciones: 1 },
        { id: 11, concepto: "PRUEBA 2 SENCILLA", descripcion: "Habitación estándar", habitaciones: 2 },
      ],
    }

    const resultado = resolverOcupacionesParaPrefill(detallesResultado)

    expect(resultado).toEqual([
      { cantidad: 1, ocupacion: "PRUEBA 1 DOBLE", categoria: "Habitación vista mar" },
      { cantidad: 2, ocupacion: "PRUEBA 2 SENCILLA", categoria: "Habitación estándar" },
    ])
    // The direct M4 catch: if `cantidad` were sourced from a reserva-level
    // SUM (1 + 2 = 3) instead of each line's own `habitaciones`, BOTH rows
    // would read 3 here. They must differ, matching their own source lines.
    expect(resultado![0].cantidad).not.toBe(resultado![1].cantidad)
    expect(resultado![0].cantidad).toBe(1)
    expect(resultado![1].cantidad).toBe(2)
  })

  it("(b) success + EMPTY data -> delegates to mapearDetallesAOcupaciones's own empty-list decision (one blank row), not a re-decided []", () => {
    const resultado = resolverOcupacionesParaPrefill({ success: true, data: [] })
    expect(resultado).toEqual(mapearDetallesAOcupaciones([]))
    expect(resultado).toEqual([{ cantidad: null, ocupacion: "", categoria: "" }])
  })

  it("(c) success but data missing (malformed shape the action's own typed return never actually produces, defended anyway) -> null, no prefill", () => {
    expect(resolverOcupacionesParaPrefill({ success: true, data: null })).toBeNull()
    expect(resolverOcupacionesParaPrefill({ success: true })).toBeNull()
  })

  it("(c) failure -> null, no prefill (caller is responsible for surfacing detallesResultado.error in a toast)", () => {
    expect(resolverOcupacionesParaPrefill({ success: false, data: null })).toBeNull()
    expect(resolverOcupacionesParaPrefill({ success: false, data: [] })).toBeNull()
  })
})
