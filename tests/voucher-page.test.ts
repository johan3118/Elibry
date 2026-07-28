// @vitest-environment node
//
// HOTFIX (2026-07-28) regression coverage for app/facturacion/voucher/page.tsx's
// TELEFONO-derivation wiring — the exact line that caused the production
// outage this hotfix fixed. Mirrors tests/crm-casos-page.test.ts's
// established pattern (this repo's precedent for testing page-level logic):
// import the REAL exported function straight out of the page module, in the
// node environment, no React Testing Library / no component mount.
//
// Closes:
//   - M1/N1 (QA): a mutated/copy-pasted wiring line (e.g. reading
//     `direccionHotel` into the TELEFONO slot) is caught by test (a) below.
//   - N2 (QA): silently dropping `telefono_contacto` from the productos
//     select-string is caught by the PRODUCTOS_SELECT_COLUMNS assertion —
//     the exact same bug class as the original outage, one layer over
//     (PostgREST just omits the column; no thrown error; tsc stays clean
//     because select strings are untyped).
import { describe, it, expect } from "vitest"
import { derivarTelefonoHotel, PRODUCTOS_SELECT_COLUMNS } from "../app/facturacion/voucher/page"

// Two NON-IDENTICAL productos so a test can't pass by accident on "the first
// item's value repeated".
const PRODUCTOS_FIXTURE = [
  { id: 501, nombre_producto: "Bahia Principe Grand Punta Cana", direccion: "Carr. El Macao, Punta Cana", telefono_contacto: "(809) 552-1444" },
  { id: 502, nombre_producto: "Hotel Riu Bambu", direccion: "Playa Bavaro, Punta Cana", telefono_contacto: "(809) 221-8080" },
]

describe("derivarTelefonoHotel", () => {
  it("(a) returns telefono_contacto when the producto matches", () => {
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, 501)).toBe("(809) 552-1444")
    // A SECOND, DIFFERENT producto proves the lookup isn't hardcoded to the
    // first fixture element.
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, 502)).toBe("(809) 221-8080")
  })

  it("(b) returns null when the producto is not found", () => {
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, 999)).toBeNull()
  })

  it("(b) also returns null when productoId itself is null/undefined (no reserva.producto_id yet)", () => {
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, null)).toBeNull()
    expect(derivarTelefonoHotel(PRODUCTOS_FIXTURE, undefined)).toBeNull()
  })

  it("(c) returns null when the producto exists but telefono_contacto is missing (undefined) — NO BEHAVIOR CHANGE from the inline `productoReal?.telefono_contacto ?? null` expression this replaces", () => {
    const productosSinTelefono = [
      { id: 601, nombre_producto: "Hotel Sin Telefono", direccion: "Some address" },
    ]
    expect(derivarTelefonoHotel(productosSinTelefono, 601)).toBeNull()
  })

  it("(c) passes a BLANK telefono_contacto string through VERBATIM (not silently normalized to null) — matches the exact pre-extraction behavior; buildVoucherData's esTextoValido is what blocks it downstream, never this function", () => {
    const productosConTelefonoEnBlanco = [
      { id: 602, nombre_producto: "Hotel Telefono En Blanco", direccion: "Some address", telefono_contacto: "   " },
    ]
    expect(derivarTelefonoHotel(productosConTelefonoEnBlanco, 602)).toBe("   ")
  })

  it("never falls back to the producto's own direccion or any other field — proves N1 (a copy-paste of the DIRECCIÓN line into the TELEFONO slot) is caught", () => {
    const result = derivarTelefonoHotel(PRODUCTOS_FIXTURE, 501)
    expect(result).not.toBe("Carr. El Macao, Punta Cana") // the producto's direccion
    expect(result).toBe("(809) 552-1444") // the producto's telefono_contacto
  })
})

describe("PRODUCTOS_SELECT_COLUMNS — the voucher page's productos query column list (HOTFIX N2 guard)", () => {
  it("requests telefono_contacto — dropping it from the select string reproduces the original outage's bug class", () => {
    expect(PRODUCTOS_SELECT_COLUMNS).toContain("telefono_contacto")
  })

  it("still requests every other column the page's TELEFONO/DIRECCIÓN wiring depends on", () => {
    expect(PRODUCTOS_SELECT_COLUMNS).toContain("id")
    expect(PRODUCTOS_SELECT_COLUMNS).toContain("direccion")
    expect(PRODUCTOS_SELECT_COLUMNS).toContain("suplidor_id")
  })
})
