// Offline tests for lib/voucher-data.ts (patterns/port-and-in-memory-fake).
// Plain data objects only — no Supabase, no network. See the module doc for
// why this file must stay pure.
//
// Per the sprint's standing instruction: every fixture with a list uses >=2
// NON-IDENTICAL elements (varied occupancy/categoria, varied passenger
// names/orden), and assertions are on ACTUAL VALUES / SPECIFIC named error
// strings — never on counts or "an error was thrown".

import { readFileSync } from "fs"
import { resolve } from "path"
import { describe, it, expect } from "vitest"
import {
  buildVoucherData,
  type BuildVoucherDataInput,
  type VoucherDocData,
  type OcupacionVoucher,
  type PasajeroVoucher,
} from "../lib/voucher-data"

// ─────────────────────────────────────────────────────────────────────────────
// A fully valid fixture. Individual tests clone it and break exactly ONE
// thing so each block assertion is unambiguous. Two NON-IDENTICAL occupancy
// groups and two NON-IDENTICAL passengers throughout (T7 lesson: a single-
// element fixture cannot distinguish "each item uses its own value" from
// "every item uses the first one").
// ─────────────────────────────────────────────────────────────────────────────
function validInput(): BuildVoucherDataInput {
  return {
    titular: "Ana Perez",
    lugar: "Hotel Riu Bambu",
    direccionHotel: "Playa Bavaro, Punta Cana, Republica Dominicana",
    telefonoHotel: "809-221-8080",
    regimen: "TODO INCLUIDO",
    localizador: "RIU-556372",
    paxAdultos: 25,
    paxNinos: 11,
    paxInfantes: 1,
    checkInFecha: "2026-08-01",
    checkInHora: "15:00",
    checkOutFecha: "2026-08-05",
    checkOutHora: "12:00",
    observaciones: "Llegada tardia, favor confirmar transporte",
    ocupaciones: [
      { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite" },
      { orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Junior Suite Superior" },
    ],
    pasajeros: [
      { orden: 1, nombreCompleto: "Ana Perez" },
      { orden: 2, nombreCompleto: "Luis Gomez" },
    ],
  }
}

/** Deep clone so tests never mutate the shared fixture across cases. */
function clone(input: BuildVoucherDataInput): BuildVoucherDataInput {
  return JSON.parse(JSON.stringify(input))
}

// ─────────────────────────────────────────────────────────────────────────────
describe("buildVoucherData — happy path", () => {
  it("returns ok:true with every field populated verbatim, noches computed, each occupancy/passenger keeping its OWN values", () => {
    const result = buildVoucherData(validInput())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")

    expect(result.data.titular).toBe("Ana Perez")
    expect(result.data.lugar).toBe("Hotel Riu Bambu")
    expect(result.data.direccionHotel).toBe("Playa Bavaro, Punta Cana, Republica Dominicana")
    expect(result.data.telefonoHotel).toBe("809-221-8080")
    expect(result.data.regimen).toBe("TODO INCLUIDO")
    expect(result.data.localizador).toBe("RIU-556372")
    expect(result.data.paxAdultos).toBe(25)
    expect(result.data.paxNinos).toBe(11)
    expect(result.data.paxInfantes).toBe(1)
    expect(result.data.checkInFecha).toBe("2026-08-01")
    expect(result.data.checkInHora).toBe("15:00")
    expect(result.data.checkOutFecha).toBe("2026-08-05")
    expect(result.data.checkOutHora).toBe("12:00")
    expect(result.data.observaciones).toBe("Llegada tardia, favor confirmar transporte")

    // 2026-08-01 -> 2026-08-05 is 4 nights, computed — never a hardcoded 3.
    expect(result.data.noches).toBe(4)

    // Each occupancy group keeps its OWN values — not group 1's values twice.
    expect(result.data.ocupaciones).toEqual([
      { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite" },
      { orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Junior Suite Superior" },
    ] satisfies OcupacionVoucher[])

    // Each passenger keeps its OWN name — not passenger 1's name twice.
    expect(result.data.pasajeros).toEqual([
      { orden: 1, nombreCompleto: "Ana Perez" },
      { orden: 2, nombreCompleto: "Luis Gomez" },
    ] satisfies PasajeroVoucher[])
  })

  it("computes a DIFFERENT noches value for a different date span — proves the value is genuinely computed, not a fixed constant", () => {
    const input = clone(validInput())
    input.checkInFecha = "2026-09-10"
    input.checkOutFecha = "2026-09-17" // 7 nights, deliberately != the 4-night fixture above
    const result = buildVoucherData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.noches).toBe(7)
    expect(result.data.noches).not.toBe(3) // never the legacy ":3" fallback
  })

  it("pax_ninos and pax_infantes of 0 are VALID and render as 0 — distinct from unset, which blocks", () => {
    const input = clone(validInput())
    input.paxNinos = 0
    input.paxInfantes = 0
    const result = buildVoucherData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.paxNinos).toBe(0)
    expect(result.data.paxInfantes).toBe(0)
  })

  it("pax_adultos of 0 is ALSO valid (zero adults is a legitimate, if unusual, real count) — distinct from unset, which blocks", () => {
    const input = clone(validInput())
    input.paxAdultos = 0
    const result = buildVoucherData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.paxAdultos).toBe(0)
  })

  it("observaciones is the only optional field — absent renders as empty string, document still builds", () => {
    const input = clone(validInput())
    delete input.observaciones
    const result = buildVoucherData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.observaciones).toBe("")
  })

  it("carries a <script>-bearing value VERBATIM — pre-escaping in the builder is a FAIL (HC-5 inheritance)", () => {
    const input = clone(validInput())
    const hostile = 'Juana <script>alert(1)</script> Pérez'
    input.titular = hostile
    input.pasajeros = [
      { orden: 1, nombreCompleto: hostile },
      { orden: 2, nombreCompleto: "Luis Gomez" },
    ]
    input.observaciones = 'Cliente "VIP" & socio <b>preferente</b> — Categoría Añejo Ñandú'

    const result = buildVoucherData(input)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")

    // Verbatim: byte-identical to the raw input, not entity-encoded.
    expect(result.data.titular).toBe(hostile)
    expect(result.data.titular).toContain("<script>alert(1)</script>")
    expect(result.data.pasajeros[0].nombreCompleto).toBe(hostile)
    expect(result.data.observaciones).toBe('Cliente "VIP" & socio <b>preferente</b> — Categoría Añejo Ñandú')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("buildVoucherData — block-never-default, one test per branch", () => {
  const cases: Array<{ name: string; break_: (i: BuildVoucherDataInput) => void; expectedMissing: string }> = [
    { name: "titular missing", break_: (i) => { i.titular = undefined }, expectedMissing: "TITULAR" },
    { name: "lugar missing", break_: (i) => { i.lugar = undefined }, expectedMissing: "LUGAR" },
    { name: "direccionHotel missing (productos.direccion)", break_: (i) => { i.direccionHotel = undefined }, expectedMissing: "DIRECCIÓN (productos.direccion)" },
    { name: "telefonoHotel missing (productos.telefono_contacto)", break_: (i) => { i.telefonoHotel = undefined }, expectedMissing: "TELEFONO (productos.telefono_contacto)" },
    { name: "telefonoHotel blank string still blocks — never falls back to \"\", the supplier's phone, or the agency's phone", break_: (i) => { i.telefonoHotel = "   " }, expectedMissing: "TELEFONO (productos.telefono_contacto)" },
    { name: "regimen missing", break_: (i) => { i.regimen = undefined }, expectedMissing: "REGIMEN" },
    { name: "localizador missing — TYPE requires it, but the BUILDER blocks (AC-6)", break_: (i) => { i.localizador = undefined }, expectedMissing: "LOCALIZADOR" },
    { name: "localizador blank string blocks too, never persisted as an empty value", break_: (i) => { i.localizador = "   " }, expectedMissing: "LOCALIZADOR" },
    { name: "pax_adultos missing (null)", break_: (i) => { i.paxAdultos = null }, expectedMissing: "PAX ADULTOS" },
    { name: "pax_adultos missing (undefined)", break_: (i) => { i.paxAdultos = undefined }, expectedMissing: "PAX ADULTOS" },
    { name: "pax_ninos missing — distinct from a genuine 0", break_: (i) => { i.paxNinos = undefined }, expectedMissing: "PAX NINOS" },
    { name: "pax_infantes missing — distinct from a genuine 0", break_: (i) => { i.paxInfantes = null }, expectedMissing: "PAX INFANTES" },
    { name: "pax_adultos negative (-5) — a fabricated headcount, distinct message from 'not supplied'", break_: (i) => { i.paxAdultos = -5 }, expectedMissing: "PAX ADULTOS (no puede ser negativo)" },
    { name: "pax_ninos negative (-3) — a fabricated headcount, distinct message from 'not supplied'", break_: (i) => { i.paxNinos = -3 }, expectedMissing: "PAX NINOS (no puede ser negativo)" },
    { name: "pax_infantes negative (-1) — a fabricated headcount, distinct message from 'not supplied'", break_: (i) => { i.paxInfantes = -1 }, expectedMissing: "PAX INFANTES (no puede ser negativo)" },
    { name: "checkInFecha missing", break_: (i) => { i.checkInFecha = undefined }, expectedMissing: "CHECK IN (fecha)" },
    { name: "checkOutFecha missing", break_: (i) => { i.checkOutFecha = undefined }, expectedMissing: "CHECK OUT (fecha)" },
    { name: "checkInHora missing", break_: (i) => { i.checkInHora = undefined }, expectedMissing: "HORA ENTRADA" },
    { name: "checkOutHora missing", break_: (i) => { i.checkOutHora = undefined }, expectedMissing: "HORA SALIDA" },
    { name: "ocupaciones never fetched (undefined)", break_: (i) => { i.ocupaciones = undefined }, expectedMissing: "OCUPACIONES (grupos de habitación no fueron cargados)" },
    { name: "ocupaciones explicit empty array — zero occupancy groups BLOCKS", break_: (i) => { i.ocupaciones = [] }, expectedMissing: "OCUPACIONES (la reserva no tiene grupos de ocupación)" },
    { name: "pasajeros never fetched (undefined)", break_: (i) => { i.pasajeros = undefined }, expectedMissing: "PASAJEROS (lista de pasajeros no fue cargada)" },
  ]

  for (const { name, break_, expectedMissing } of cases) {
    it(`blocks individually on: ${name}`, () => {
      const input = clone(validInput())
      break_(input)
      const result = buildVoucherData(input)

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error("unreachable")
      expect(result.missing).toContain(expectedMissing)
    })
  }

  it("negative pax gets a DISTINCT message from the not-supplied case — not folded into the same string, for BOTH paxAdultos and paxNinos", () => {
    const negativeAdultos = clone(validInput())
    negativeAdultos.paxAdultos = -5
    const resultAdultos = buildVoucherData(negativeAdultos)
    expect(resultAdultos.ok).toBe(false)
    if (resultAdultos.ok) throw new Error("unreachable")
    expect(resultAdultos.missing).toContain("PAX ADULTOS (no puede ser negativo)")
    expect(resultAdultos.missing).not.toContain("PAX ADULTOS")

    const negativeNinos = clone(validInput())
    negativeNinos.paxNinos = -3
    const resultNinos = buildVoucherData(negativeNinos)
    expect(resultNinos.ok).toBe(false)
    if (resultNinos.ok) throw new Error("unreachable")
    expect(resultNinos.missing).toContain("PAX NINOS (no puede ser negativo)")
    expect(resultNinos.missing).not.toContain("PAX NINOS")

    // The not-supplied case still uses its OWN, shorter message — proves the
    // two failure modes never collapse into one string.
    const unsetAdultos = clone(validInput())
    unsetAdultos.paxAdultos = undefined
    const resultUnset = buildVoucherData(unsetAdultos)
    expect(resultUnset.ok).toBe(false)
    if (resultUnset.ok) throw new Error("unreachable")
    expect(resultUnset.missing).toContain("PAX ADULTOS")
    expect(resultUnset.missing).not.toContain("PAX ADULTOS (no puede ser negativo)")
  })

  it("pasajeros explicit EMPTY array is PERMITTED (genuinely zero named passengers, independent of pax_* counts per HC-4)", () => {
    const input = clone(validInput())
    input.pasajeros = []
    const result = buildVoucherData(input)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.pasajeros).toEqual([])
    // HC-4: pax_adultos/pax_ninos/pax_infantes remain untouched/independent.
    expect(result.data.paxAdultos).toBe(25)
  })

  it("check-out on/before check-in blocks with the specific date-order message, never silently produces a negative/zero noches", () => {
    const input = clone(validInput())
    input.checkInFecha = "2026-08-05"
    input.checkOutFecha = "2026-08-05" // same day, not after
    const result = buildVoucherData(input)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("CHECK OUT (la fecha de salida debe ser posterior a la fecha de entrada)")
  })

  it("collects EVERY missing field in ONE pass — not short-circuited on the first broken field", () => {
    const input = clone(validInput())
    input.titular = undefined
    input.telefonoHotel = undefined
    input.paxNinos = undefined
    input.ocupaciones = []
    const result = buildVoucherData(input)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("TITULAR")
    expect(result.missing).toContain("TELEFONO (productos.telefono_contacto)")
    expect(result.missing).toContain("PAX NINOS")
    expect(result.missing).toContain("OCUPACIONES (la reserva no tiene grupos de ocupación)")
    expect(result.missing.length).toBeGreaterThanOrEqual(4)
  })

  it("an unmatched/invalid occupancy group is named per-index, per-field — not folded into a generic error", () => {
    const input = clone(validInput())
    input.ocupaciones = [
      { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite" },
      { orden: 2, cantidad: 0, ocupacion: "", categoria: "Junior Suite Superior" }, // cantidad<=0 AND blank ocupacion
    ]
    const result = buildVoucherData(input)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("OCUPACIONES (grupo 2): cantidad")
    expect(result.missing).toContain("OCUPACIONES (grupo 2): ocupacion")
    // Group 1 (valid) must NOT be reported as broken.
    expect(result.missing).not.toContain("OCUPACIONES (grupo 1): cantidad")
  })

  it("a passenger with a blank nombreCompleto is named per-index — never coerced to a placeholder", () => {
    const input = clone(validInput())
    input.pasajeros = [
      { orden: 1, nombreCompleto: "Ana Perez" },
      { orden: 2, nombreCompleto: "   " },
    ]
    const result = buildVoucherData(input)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("PASAJEROS (pasajero 2): nombreCompleto")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// HOTFIX (2026-07-27) regression coverage: TELEFONO must be sourced from
// `productos.telefono_contacto` (the hotel PROPERTY's own front-desk number),
// never `suplidores.telefono` (a column that never existed) and never a
// fallback to "", the supplier's, or the agency's phone. End-to-end: a valid
// `telefono_contacto`-shaped value flows verbatim from the builder into the
// RENDERED voucher HTML; a missing one BLOCKS with the new, correctly-named
// label instead of silently defaulting.
// ─────────────────────────────────────────────────────────────────────────────
describe("buildVoucherData — TELEFONO sourced from productos.telefono_contacto (HOTFIX 2026-07-27)", () => {
  it("a valid productos.telefono_contacto-shaped value flows verbatim through buildVoucherData AND into the rendered voucher HTML", async () => {
    const { generateVoucherDocHTML } = await import("../lib/document-generator")

    const input = clone(validInput())
    input.telefonoHotel = "(809) 552-1444" // shape of a real productos.telefono_contacto value

    const result = buildVoucherData(input)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.data.telefonoHotel).toBe("(809) 552-1444")

    const html = generateVoucherDocHTML(result.data)
    expect(html).toContain("TELEFONO:</div>\n        <div class=\"val\">(809) 552-1444</div>")
  })

  it("a missing telefonoHotel BLOCKS with the productos.telefono_contacto label and NEVER reaches the renderer", () => {
    const input = clone(validInput())
    input.telefonoHotel = undefined
    const result = buildVoucherData(input)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.missing).toContain("TELEFONO (productos.telefono_contacto)")
    expect(result.missing).not.toContain("TELEFONO (suplidores.telefono)")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Strips `/** ... *\/` block comments and `// ...` line comments so the
 * STATIC GUARD tests below scan only real CODE, not the module's own prose
 * explaining an invariant (e.g. the module doc mentions "html-escape",
 * "03:00 PM" and "?? 3" BY NAME, in prose, to describe what must NOT appear
 * in code — those mentions must not false-positive these guards).
 */
function codigoSinComentarios(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

describe("buildVoucherData — offline / purity guarantees", () => {
  it("module has ZERO Supabase imports and never imports lib/html-escape (HC-5: escaping belongs to the renderer, not this builder)", () => {
    const source = codigoSinComentarios(readFileSync(resolve(__dirname, "../lib/voucher-data.ts"), "utf-8"))
    expect(source).not.toMatch(/from\s+["']@?\/?lib\/supabase/)
    expect(source).not.toMatch(/createClient|createSupabaseServerClient/)
    expect(source).not.toMatch(/html-escape/)
    expect(source).not.toMatch(/process\.env/)
  })

  it("STATIC GUARD: no `total`/`precio`/`monto`/`subtotal`/`moneda`/`tarifa`/`costo` field name appears anywhere in the module's type/interface declarations", () => {
    const source = codigoSinComentarios(readFileSync(resolve(__dirname, "../lib/voucher-data.ts"), "utf-8"))
    // Restrict the scan to the type/interface block (up to the first blank
    // line after "BuildVoucherDataResult") so a comment mentioning "money"
    // in prose doesn't false-positive; field DECLARATIONS are what matter.
    const typesBlock = source.slice(0, source.indexOf("BuildVoucherDataResult"))
    for (const forbidden of ["total:", "precio:", "monto:", "subtotal:", "moneda:", "tarifa:", "costo:"]) {
      expect(typesBlock).not.toContain(forbidden)
    }
  })

  it("STATIC GUARD: the noches computation has NO hardcoded `3` fallback anywhere in the module's CODE", () => {
    const source = codigoSinComentarios(readFileSync(resolve(__dirname, "../lib/voucher-data.ts"), "utf-8"))
    expect(source).not.toMatch(/\?\?\s*3\b/)
    expect(source).not.toMatch(/\|\|\s*3\b/)
    expect(source).not.toMatch(/:\s*3\s*[,)\n]/) // a ternary/default literal "3"
  })

  it("STATIC GUARD: no hardcoded '03:00 PM' / '12:00 PM' time literals anywhere in the module's CODE", () => {
    const source = codigoSinComentarios(readFileSync(resolve(__dirname, "../lib/voucher-data.ts"), "utf-8"))
    expect(source).not.toContain("03:00 PM")
    expect(source).not.toContain("12:00 PM")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// COMPILE TRAP (B3) — the core of T13. These functions are NEVER CALLED at
// runtime; their only purpose is to be type-checked by `npm run typecheck`,
// which genuinely runs against this file (tsconfig.json's `include` is
// `["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]` with
// `exclude: ["node_modules"]` only — `tests/**/*.ts` matches `**/*.ts` and is
// NOT excluded, so this file is genuinely part of the compiled project; the
// trap is not "theater identical to an unrun test").
//
// Each `@ts-expect-error` below asserts TypeScript's excess-property check
// REJECTS a money field on a fresh object literal typed as VoucherDocData —
// at the ROOT level, and ONE LEVEL DOWN on both `ocupaciones[]` and
// `pasajeros[]` (a money field smuggled onto a room line or a passenger
// defeats the guarantee exactly as completely as one at the root — the
// omission must be TRANSITIVE). If a future edit ever adds a money field to
// one of these types, the `@ts-expect-error` directives below go UNUSED,
// which is ITSELF a TypeScript error (TS2578), so the trap cannot silently
// stop working either.
// ═══════════════════════════════════════════════════════════════════════════

function __compileTrapValidVoucherData(): VoucherDocData {
  return {
    titular: "Ana Perez",
    paxAdultos: 25,
    paxNinos: 11,
    paxInfantes: 1,
    lugar: "Hotel Riu Bambu",
    direccionHotel: "Playa Bavaro",
    telefonoHotel: "809-221-8080",
    regimen: "TODO INCLUIDO",
    ocupaciones: [{ orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite" }],
    noches: 4,
    localizador: "RIU-556372",
    pasajeros: [{ orden: 1, nombreCompleto: "Ana Perez" }],
    observaciones: "",
    checkInFecha: "2026-08-01",
    checkInHora: "15:00",
    checkOutFecha: "2026-08-05",
    checkOutHora: "12:00",
  }
}

function __compileTrap_rootLevelMoneyField(): VoucherDocData {
  const bad: VoucherDocData = {
    ...__compileTrapValidVoucherData(),
    // @ts-expect-error B3: VoucherDocData must structurally OMIT every money field — adding `total` at the root is a compile error, not a review catch.
    total: 100,
  }
  return bad
}

function __compileTrap_ocupacionMoneyField(): VoucherDocData {
  const bad: VoucherDocData = {
    ...__compileTrapValidVoucherData(),
    ocupaciones: [
      {
        orden: 1,
        cantidad: 8,
        ocupacion: "DOBLE",
        categoria: "Junior Suite",
        // @ts-expect-error B3: the omission is TRANSITIVE — a money field smuggled onto a room line, one level down, must ALSO be a compile error.
        precioPorNoche: 4500,
      },
    ],
  }
  return bad
}

function __compileTrap_pasajeroMoneyField(): VoucherDocData {
  const bad: VoucherDocData = {
    ...__compileTrapValidVoucherData(),
    pasajeros: [
      {
        orden: 1,
        nombreCompleto: "Ana Perez",
        // @ts-expect-error B3: the omission is TRANSITIVE — a money field smuggled onto a passenger row, one level down, must ALSO be a compile error.
        montoPagado: 50,
      },
    ],
  }
  return bad
}

describe("compile trap sanity (runtime no-op — the real assertion is `npx tsc --noEmit`)", () => {
  it("the trap functions exist and are never invoked for their money-bearing branches — this test only proves the module still loads", () => {
    // These calls exercise the CLEAN branch only (no money fields reach
    // runtime) — the money-field object literals above are compile-time-only
    // and would be a TypeScript error to actually construct without the
    // ts-expect-error suppressions placed directly above each money field.
    expect(typeof __compileTrapValidVoucherData().titular).toBe("string")
    expect(typeof __compileTrap_rootLevelMoneyField).toBe("function")
    expect(typeof __compileTrap_ocupacionMoneyField).toBe("function")
    expect(typeof __compileTrap_pasajeroMoneyField).toBe("function")
  })
})
