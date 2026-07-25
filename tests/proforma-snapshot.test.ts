// T3 — Constraint-5 baseline snapshot gate for the LIVE /facturacion/proforma route.
//
// WHY THIS TEST EXISTS
// `generateProformaHTML` (lib/document-generator.tsx) is consumed by the shipped
// /facturacion/proforma route TODAY, and is about to be rewritten by a later task
// (T6) to stop fabricating data. This test pins the generator's CURRENT byte-for-byte
// output for one fixed, fully-known input so a future diff can prove it did not
// silently regress the live route. It does NOT judge whether today's output is
// correct — several of the frozen fields are known fabrications (see
// docs/plans/geb-documents-real-data.md §0) that a later task is expected to fix.
//
// WHAT WAS NEUTRALISED, AND WHY (do not "fix" these — they mirror real, filed defects)
// `generateProformaHTML` is not deterministic on its own:
//   1. `lib/document-generator.tsx:284` — `const currentDate = new Date()` — used for
//      CHECK IN, CHECK OUT (+3 days) and FECHA RESERVA. Neutralised with
//      `vi.useFakeTimers()` + `vi.setSystemTime(FIXED_NOW)`.
//   2. `lib/document-generator.tsx:285-287` — three `Math.floor(Math.random() * 9000)
//      + 1000` calls, for ID CLIENTE, ID RESERVA and FACTURA # (in that call order).
//      Neutralised with `vi.spyOn(Math, "random")` returning three fixed, DISTINCT
//      values via `mockReturnValueOnce` so the three IDs stay visibly distinguishable
//      in the baseline (they are 1900, 5500 and 9100 respectively — see FIXED_RANDOM
//      below).
//   3. `lib/document-generator.tsx:729,732,741` — `currentDate.toLocaleDateString("es-DO")`
//      (and the +3 day variant) render in the PROCESS's local timezone, not a fixed
//      offset. FIXED_NOW is 2026-07-25T19:00:00.000Z; any host/CI timezone at or east of
//      UTC+5 (verified with both Asia/Tokyo and Pacific/Auckland) rolls that instant into
//      2026-07-26 local time, producing a deterministic mismatch against the baseline
//      (which was generated under America/Santo_Domingo, UTC-4) even though nothing about
//      the generator or the fixture changed. Neutralised by pinning
//      `process.env.TZ = "America/Santo_Domingo"` in `beforeEach`, BEFORE
//      `vi.setSystemTime` and before any Date formatting runs, and restoring the
//      original `process.env.TZ` in `afterEach`.
// Everything else in the fixture below (`FIXTURE`) is a plain, fully-known
// `ProformaData` object — no live Supabase, no network (patterns/port-and-in-memory-fake).
//
// FIELDS THAT ARE "INTENTIONALLY FIXED" VS A REAL REGRESSION (read this before touching
// the generator in a later task)
// Because of the two neutralisations above, the following regions of the committed
// baseline are ARTIFACTS OF THIS TEST HARNESS, not of the input data, and are expected
// to keep changing shape once the generator stops reading `Date.now()` / `Math.random()`
// directly and instead reads them off `ConfirmacionData`:
//   - "ID CLIENTE:", "ID RESERVA:", "FACTURA #:" (today: random 4-digit numbers)
//   - "CHECK IN:", "CHECK OUT:", "FECHA RESERVA:" (today: today's date / +3 days,
//     ignoring the reserva's real fecha_entrada/fecha_salida)
// Every OTHER byte in the baseline — the client/reserva labels wired to real fixture
// fields, the items table, the totals block, the policies paragraph text, the
// passenger placeholder, "Atendido por"/"Referido por", the banking/contact footer —
// reflects `generateProformaHTML`'s actual current template. A later task's diff
// against this baseline should show ONLY the two families of lines above changing
// (once the generator switches to reading real dates/ids). Any OTHER line moving is a
// regression on the live route, not an intentional fix.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { generateProformaHTML, type ProformaData } from "@/lib/document-generator"

const BASELINE_PATH = path.join(__dirname, "fixtures", "proforma-baseline.html")

// Frozen "now" for `new Date()` inside the generator (see note above).
const FIXED_NOW = new Date("2026-07-25T15:00:00.000-04:00")

// Frozen Math.random() sequence, consumed in call order by the generator:
// clientId, reservaId, facturaId.
const FIXED_RANDOM_SEQUENCE = [0.1, 0.5, 0.9] // -> 1900, 5500, 9100

// A fully-known, plain ProformaData fixture — no Supabase, no network.
const FIXTURE: ProformaData = {
  cliente: {
    nombre: "Maria Fernandez Rodriguez",
    email: "maria.fernandez@example.com",
    telefono: "809-555-1234",
    direccion: "Calle Primera #12, Piantini, Santo Domingo",
  },
  items: [
    {
      descripcion: "Paquete Punta Cana Todo Incluido",
      cantidad: 2,
      precio: 25000,
      total: 47500,
    },
    {
      descripcion: "Traslado Aeropuerto - Hotel",
      cantidad: 2,
      precio: 2500,
      total: 5000,
    },
  ],
  subtotal: 52500,
  impuestos: 0,
  total: 52500,
  moneda: "DOP",
  validez: "30 días",
  empresa: {
    nombre: "Grupo Ellibry",
    direccion: "Santo Domingo, República Dominicana",
    telefono: "(809) 123-4567",
    email: "info@grupoellibry.com",
  },
}

describe("generateProformaHTML — constraint-5 baseline snapshot (T3)", () => {
  // Original process timezone, restored after every test so this file has no lasting
  // effect on the rest of the suite (see neutralisation #3 in the header above).
  const ORIGINAL_TZ = process.env.TZ

  beforeEach(() => {
    // Pin the process timezone to the one the committed baseline was generated under,
    // BEFORE vi.setSystemTime and before any Date formatting runs — otherwise
    // `toLocaleDateString("es-DO")` renders in the host/CI's local timezone instead.
    process.env.TZ = "America/Santo_Domingo"

    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)

    let call = 0
    vi.spyOn(Math, "random").mockImplementation(() => {
      const value = FIXED_RANDOM_SEQUENCE[call] ?? FIXED_RANDOM_SEQUENCE[FIXED_RANDOM_SEQUENCE.length - 1]
      call += 1
      return value
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    process.env.TZ = ORIGINAL_TZ
  })

  it("matches the committed baseline byte-for-byte for the fixed fixture", () => {
    const actual = generateProformaHTML(FIXTURE)

    // Fails loudly (not "file not found" silently swallowed) if the baseline is
    // missing or emptied — this is what keeps this test from passing vacuously.
    expect(fs.existsSync(BASELINE_PATH), `Baseline fixture is missing: ${BASELINE_PATH}`).toBe(true)
    const expected = fs.readFileSync(BASELINE_PATH, "utf-8")
    expect(expected.length, "Baseline fixture is empty").toBeGreaterThan(0)

    // Line-by-line comparison (not a single giant string equality) so a mismatch
    // produces a readable, localized diff instead of "snapshot differs".
    const actualLines = actual.split("\n")
    const expectedLines = expected.split("\n")
    expect(actualLines).toEqual(expectedLines)
  })

  it("renders the three frozen non-deterministic fields at their expected fixed values", () => {
    // Pins exactly which fields this harness neutralised, so a future reader does not
    // have to reverse-engineer FIXED_RANDOM_SEQUENCE / FIXED_NOW from the baseline HTML.
    const actual = generateProformaHTML(FIXTURE)
    expect(actual).toContain("ID CLIENTE:</span> 1900")
    expect(actual).toContain("ID RESERVA:</span> 5500")
    expect(actual).toContain("FACTURA #:</span> 9100")
  })
})
