// @vitest-environment node
import { describe, it, expect } from "vitest"
import {
  COUNTRIES,
  TIPOS_PRODUCTO,
  normalizeTipo,
  normalizePais,
  extractContactName,
} from "./constants"

// ─────────────────────────────────────────────────────────────────────────────
// Pr1 — `tipo` option set must be identical between registrar and editar.
// ─────────────────────────────────────────────────────────────────────────────
describe("TIPOS_PRODUCTO (canonical list shared by registrar/editar)", () => {
  it("contains the canonical values used by both forms", () => {
    const values = TIPOS_PRODUCTO.map((t) => t.value)
    expect(values).toEqual(["HOTEL", "EXCURSION", "TRANSPORTE", "RESTAURANTE", "PAQUETE", "OTRO"])
  })

  it("has no duplicate values", () => {
    const values = TIPOS_PRODUCTO.map((t) => t.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe("normalizeTipo", () => {
  it("maps the legacy 'OTROS' value (previously offered by editar) to canonical 'OTRO'", () => {
    expect(normalizeTipo("OTROS")).toBe("OTRO")
  })

  it("leaves already-canonical values untouched", () => {
    for (const t of TIPOS_PRODUCTO) {
      expect(normalizeTipo(t.value)).toBe(t.value)
    }
  })

  it("returns an empty string for null/undefined/empty input", () => {
    expect(normalizeTipo(null)).toBe("")
    expect(normalizeTipo(undefined)).toBe("")
    expect(normalizeTipo("")).toBe("")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Pr2 — `pais` list must be identical between registrar and editar, and no
// previously-savable value should render blank.
// ─────────────────────────────────────────────────────────────────────────────
describe("COUNTRIES (canonical list shared by registrar/editar)", () => {
  it("includes República Dominicana (the primary market)", () => {
    expect(COUNTRIES).toContain("República Dominicana")
  })

  it("includes Puerto Rico so old editar rows keep rendering (was only in editar's list)", () => {
    expect(COUNTRIES).toContain("Puerto Rico")
  })

  it("uses 'Países Bajos' (not the old editar-only alias 'Holanda')", () => {
    expect(COUNTRIES).toContain("Países Bajos")
    expect(COUNTRIES).not.toContain("Holanda")
  })

  it("has no duplicate entries", () => {
    expect(new Set(COUNTRIES).size).toBe(COUNTRIES.length)
  })
})

describe("normalizePais", () => {
  it("maps the legacy 'Holanda' label (previously offered by editar) to 'Países Bajos'", () => {
    expect(normalizePais("Holanda")).toBe("Países Bajos")
  })

  it("leaves other country values untouched", () => {
    expect(normalizePais("República Dominicana")).toBe("República Dominicana")
    expect(normalizePais("Puerto Rico")).toBe("Puerto Rico")
  })

  it("returns an empty string for null/undefined/empty input", () => {
    expect(normalizePais(null)).toBe("")
    expect(normalizePais(undefined)).toBe("")
    expect(normalizePais("")).toBe("")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Pr8 — contact name extraction must survive hyphenated names.
// ─────────────────────────────────────────────────────────────────────────────
describe("extractContactName", () => {
  it("extracts a simple contact name", () => {
    expect(extractContactName("Juan Perez - Tel: 809-555-1234")).toBe("Juan Perez")
  })

  it("does NOT truncate a hyphenated contact name at the hyphen", () => {
    expect(extractContactName("Jean-Pierre - Tel: 809-555-1234")).toBe("Jean-Pierre")
  })

  it("extracts the name correctly when telefonos/emails follow", () => {
    const contactos =
      "Jean-Pierre - Tel: 809-555-1234, 809-555-0000 - Email: jean@example.com, jp2@example.com"
    expect(extractContactName(contactos)).toBe("Jean-Pierre")
  })

  it("returns an empty string for null/undefined/empty input", () => {
    expect(extractContactName(null)).toBe("")
    expect(extractContactName(undefined)).toBe("")
    expect(extractContactName("")).toBe("")
  })

  it("falls back to the trimmed full string if the '- Tel:' delimiter is missing", () => {
    expect(extractContactName("Solo Nombre Sin Formato")).toBe("Solo Nombre Sin Formato")
  })
})
