// Task 1 (docs/plans/recibo-escape-and-input-guards.md, B-12) — rendered-output
// assertions for `generateReciboHTML(data: ReciboData)`. Mirrors
// tests/voucher-html.test.ts's conventions (HC-5's hostile fixture,
// accent-survival, no-op-on-clean-data, and the supplementary `raw(`-count
// static guard at :226-236 of that file) applied to RECIBO — the only
// customer-facing document that actually generates today
// (app/pagos/buscar/page.tsx:206).
//
// Assertions are on the RENDERED HTML STRING, never on "we call the helper".
// Offline, plain data objects (patterns/port-and-in-memory-fake) — no
// network, no Supabase.

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { generateReciboHTML } from "../lib/document-generator"
import type { ReciboData } from "../lib/document-generator"

// A fully-known ReciboData fixture with NO escapable characters
// (no & < > " '). Used for the no-op / byte-identical regression gate.
const CLEAN_FIXTURE: ReciboData = {
  cliente: {
    nombre: "Emily Joaquin",
    email: "emily@example.com",
    telefono: "809-555-1234",
    direccion: "Calle Principal 12",
  },
  pago: {
    id: "PAY-9001",
    monto: 12345.67,
    metodo: "Transferencia",
    referencia: "REF-000123",
    fecha: "24-Jul-2026",
    moneda: "DOP",
  },
  reserva: {
    numero: "R-5501",
    servicio: "Bahia Principe Grand Punta Cana Hotel",
    total: 98765.43,
  },
  empresa: {
    nombre: "Ellibry Group",
    direccion: "Av. Winston Churchill 100",
    telefono: "809-555-9999",
    email: "info@grupoellibry.com",
  },
}

// The hostile fixture: DISTINCT hostile payloads in three different fields
// (cliente.nombre, pago.referencia, reserva.servicio) so the assertions can
// distinguish "escapes every value" from "escapes only the first value".
// Contains, across the same fixture: a <script> payload, an
// <img src=x onerror=...> payload, single quotes, double quotes,
// ampersands, angle brackets, AND accented Spanish (Pérez, Añejo, Ñandú,
// ESTADÍA, Categoría).
const HOSTILE_FIXTURE: ReciboData = {
  ...CLEAN_FIXTURE,
  cliente: {
    ...CLEAN_FIXTURE.cliente,
    nombre: "Juana <script>alert(1)</script> Pérez",
  },
  pago: {
    ...CLEAN_FIXTURE.pago,
    referencia: `Ref: <img src=x onerror=alert(1)> O'Brien & "Segunda"`,
  },
  reserva: {
    ...CLEAN_FIXTURE.reserva,
    servicio: 'Hotel <Categoría "Deluxe"> — Añejo & Ñandú en ESTADÍA prolongada',
  },
}

describe("generateReciboHTML — HC-5 hostile fixture renders safe", () => {
  const out = generateReciboHTML(HOSTILE_FIXTURE)

  it("contains NO <script in unescaped form", () => {
    expect(out).not.toContain("<script")
  })

  it("the exact raw <img onerror> payload never appears — it can never again be parsed as a live element", () => {
    // NOTE: the template legitimately contains ONE static, non-data <img>
    // (the logo), so the assertion targets the exact hostile payload rather
    // than a blanket "no <img anywhere" (which would false-positive on the
    // logo).
    expect(out).not.toContain("<img src=x onerror=alert(1)>")
  })

  it("escapes the script payload from cliente.nombre exactly", () => {
    expect(out).toContain("Juana &lt;script&gt;alert(1)&lt;/script&gt; Pérez")
  })

  it("escapes the <img onerror>/quote/ampersand payload from pago.referencia exactly", () => {
    expect(out).toContain("Ref: &lt;img src=x onerror=alert(1)&gt; O&#39;Brien &amp; &quot;Segunda&quot;")
  })

  it("escapes the DIFFERENT hostile payload from reserva.servicio exactly (proves every field is escaped, not just the first)", () => {
    expect(out).toContain("Hotel &lt;Categoría &quot;Deluxe&quot;&gt; — Añejo &amp; Ñandú en ESTADÍA prolongada")
  })

  it("& is escaped BEFORE < and > — a literal '<'/'\"'/\"'\" substring in source data is not double-encoded", () => {
    expect(out).not.toContain("&amp;lt;")
    expect(out).not.toContain("&amp;gt;")
    expect(out).not.toContain("&amp;quot;")
    expect(out).not.toContain("&amp;#39;")
  })
})

describe("generateReciboHTML — accents survive byte-identical", () => {
  const out = generateReciboHTML(HOSTILE_FIXTURE)

  it("Pérez appears verbatim", () => {
    expect(out).toContain("Pérez")
  })

  it("Añejo appears verbatim", () => {
    expect(out).toContain("Añejo")
  })

  it("Ñandú appears verbatim", () => {
    expect(out).toContain("Ñandú")
  })

  it("ESTADÍA appears verbatim", () => {
    expect(out).toContain("ESTADÍA")
  })

  it("Categoría appears verbatim", () => {
    expect(out).toContain("Categoría")
  })

  it("no accented character was entity-encoded — no numeric character reference near the accented words", () => {
    expect(out).not.toMatch(/&#(2|3)\d\d;/) // Latin-1 Supplement / Latin Extended-A entity range
  })
})

describe("generateReciboHTML — no-op on clean data", () => {
  it("renders zero HTML entities for a fixture with no escapable characters", () => {
    const out = generateReciboHTML(CLEAN_FIXTURE)
    expect(out).not.toContain("&amp;")
    expect(out).not.toContain("&lt;")
    expect(out).not.toContain("&gt;")
    expect(out).not.toContain("&quot;")
    expect(out).not.toContain("&#39;")
  })

  it("renders every clean-fixture field verbatim, unescaped", () => {
    const out = generateReciboHTML(CLEAN_FIXTURE)
    expect(out).toContain("Emily Joaquin")
    expect(out).toContain("emily@example.com")
    expect(out).toContain("809-555-1234")
    expect(out).toContain("PAY-9001")
    expect(out).toContain("Transferencia")
    expect(out).toContain("REF-000123")
    expect(out).toContain("24-Jul-2026")
    expect(out).toContain("R-5501")
    expect(out).toContain("Bahia Principe Grand Punta Cana Hotel")
    expect(out).toContain("Ellibry Group")
    expect(out).toContain("Av. Winston Churchill 100")
  })
})

describe("generateReciboHTML — money is preserved exactly", () => {
  // Literal below is RUN-DERIVED from the real generateReciboHTML output for
  // this exact fixture (pago.monto: 12345.67, moneda: "DOP"), never guessed —
  // see the dev report for the observed value. NOT re-derived from
  // `new Intl.NumberFormat(...).format(...)` inside this test file, so it
  // does not silently track a future formatting change
  // (fake-green-tests anti-pattern #6).
  it("renders the exact observed currency string for pago.monto", () => {
    const out = generateReciboHTML(CLEAN_FIXTURE)
    expect(out).toContain("RD$12,345.67")
  })

  it("renders the exact observed currency string for reserva.total", () => {
    const out = generateReciboHTML(CLEAN_FIXTURE)
    expect(out).toContain("RD$98,765.43")
  })
})

describe("generateReciboHTML — supplementary static guard: raw( appears zero times", () => {
  it("the function's source contains NO call to raw( — no data value bypasses the html tag (supplementary only, not sole proof)", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "document-generator.tsx"), "utf-8")
    const start = source.indexOf("export function generateReciboHTML")
    expect(start, "generateReciboHTML not found in lib/document-generator.tsx").toBeGreaterThan(-1)
    const nextFnStart = source.indexOf("\nexport function ", start + 1)
    const fnSource = nextFnStart === -1 ? source.slice(start) : source.slice(start, nextFnStart)
    const rawCallCount = (fnSource.match(/\braw\(/g) ?? []).length
    expect(rawCallCount).toBe(0)
  })
})

describe("generateReciboHTML — sibling generators untouched", () => {
  it("lib/document-generator.tsx still exports generateProformaHTML, generateConfirmacionHTML and generateVoucherDocHTML", async () => {
    const mod = await import("../lib/document-generator")
    expect(typeof mod.generateProformaHTML).toBe("function")
    expect(typeof mod.generateConfirmacionHTML).toBe("function")
    expect(typeof mod.generateVoucherDocHTML).toBe("function")
  })
})
