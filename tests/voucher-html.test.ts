// T14 (docs/plans/geb-documents-real-data.md) — rendered-output assertions for
// `generateVoucherDocHTML(data: VoucherDocData)`. Mirrors tests/confirmacion-html.test.ts's
// conventions (HC-5's hostile fixture, accent-survival, static-guard) plus the
// VOUCHER-specific requirements this task adds: a MONEY-LEAK assertion (the
// runtime complement to T13's compile-time guarantee), a NOCHES-never-a-
// fallback assertion, a CHECK IN/OUT date+time cross-check against
// generateConfirmacionHTML fed from the same reserva fixture (T14 AC-6), and
// mutation-checked coverage per the standing sprint instruction.
//
// T14 RULING (the T3/T6 split applied to VOUCHER): the new contract shipped
// under the NEW name `generateVoucherDocHTML`, alongside the legacy
// `generateVoucherHTML(data: VoucherData)` and its `VoucherData` interface,
// for the ONE-TASK T14->T15 gap (Amended 4, Risk R14).
//
// T15 UPDATE (this file was NOT in T15's originally declared file scope —
// see the T15 dev report for the justification): T15 retired the legacy
// `generateVoucherHTML`/`VoucherData` in the SAME task that repointed
// `app/facturacion/voucher/page.tsx`'s two call sites (T15 AC-11 — leaving
// an unescaped, money-carrying, zero-caller generator in the tree for
// backlog is an explicit FAIL, unlike `generateProformaHTML`/B-13, which is
// byte-freeze-protected dead code). The "legacy/other generators untouched"
// describe block this file used to carry during the T14/T15 gap is REPLACED
// below with one asserting the retirement, per that same AC's evidence
// requirement ("a repo-wide grep showing zero remaining references").
//
// Assertions are on the RENDERED HTML STRING, never on "we call the helper".
// Offline, plain data objects (patterns/port-and-in-memory-fake) — no
// network, no Supabase.

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { generateVoucherDocHTML, generateConfirmacionHTML } from "../lib/document-generator"
import type { VoucherDocData } from "../lib/voucher-data"
import type { ConfirmacionData } from "../lib/confirmacion-data"

// A fully-known VoucherDocData fixture with NO escapable characters (no
// & < > " '). Modelled on docs/VOUCHER GEB-2.docx's own sample values
// (EMILY JOAQUIN / 25 Ad + 11 Chd + 1 Inf / BAHIA PRINCIPE GRAND PUNTA CANA
// HOTEL / two DIFFERENT room lines / LOCALIZADOR 77795). Used for the no-op
// / byte-identical regression gate and as the base for the hostile fixture.
const CLEAN_FIXTURE: VoucherDocData = {
  titular: "Emily Joaquin",
  paxAdultos: 25,
  paxNinos: 11,
  paxInfantes: 1,
  lugar: "Bahia Principe Grand Punta Cana Hotel",
  direccionHotel: "Carr. El Macao - Arena Gorda, Punta Cana 23000",
  telefonoHotel: "(809) 552-1444",
  regimen: "TODO INCLUIDO",
  ocupaciones: [
    { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: "Junior Suite Superior" },
    { orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: "Junior Suite Superior" },
  ],
  noches: 3,
  localizador: "77795",
  pasajeros: [
    { orden: 1, nombreCompleto: "Juan Perez y Carlos Perez" },
    { orden: 2, nombreCompleto: "Pedro Mendez y Charlie Perez" },
  ],
  observaciones: "Llegada en vuelo nocturno",
  checkInFecha: "2026-07-24",
  checkInHora: "15:00",
  checkOutFecha: "2026-07-27",
  checkOutHora: "12:00",
}

// The hostile fixture (§10 of the plan, verbatim), adapted to
// VoucherDocData's real field names, WIDENED per the standing sprint
// instruction: >=2 non-identical occupancy groups and >=2 non-identical
// passengers with DIFFERENT hostile payloads — a single-element fixture
// cannot distinguish "escapes every value" from "escapes only the first
// value". Contains, in the SAME fixture: a script tag, single quotes, double
// quotes, ampersands, angle brackets, AND accented Spanish text.
const HOSTILE_FIXTURE: VoucherDocData = {
  ...CLEAN_FIXTURE,
  titular: "Juana <script>alert(1)</script> Pérez",
  lugar: 'Hotel <Categoría "Deluxe"> — Añejo & Ñandú',
  observaciones: 'Cliente "VIP" & socio <b>preferente</b> en ESTADÍA prolongada',
  ocupaciones: [
    { orden: 1, cantidad: 8, ocupacion: "DOBLE", categoria: 'Categoría "Deluxe" <VIP> & Ñandú' },
    { orden: 2, cantidad: 3, ocupacion: "TRIPLE", categoria: `Junior Suite O'Brien & "Superior"` },
  ],
  pasajeros: [
    { orden: 1, nombreCompleto: "<img src=x onerror=alert(1)>" },
    { orden: 2, nombreCompleto: `Ñoño O'Brien & "Segunda" <b>Pasajera</b>` },
  ],
}

describe("generateVoucherDocHTML — HC-5 hostile fixture renders safe", () => {
  const out = generateVoucherDocHTML(HOSTILE_FIXTURE)

  it("contains NO <script in unescaped form", () => {
    expect(out).not.toContain("<script")
  })

  it("the exact raw <img onerror> payload never appears — it can never again be parsed as a live element", () => {
    // NOTE: the template legitimately contains ONE static, non-data <img>
    // (the logo box), so the assertion targets the exact hostile payload
    // rather than a blanket "no <img anywhere" (which would false-positive
    // on the logo).
    expect(out).not.toContain("<img src=x onerror=alert(1)>")
  })

  it("contains NO <b>preferente</b> / <b>Pasajera</b> in unescaped form (the hostile observaciones/pasajero payloads)", () => {
    // NOTE: the template legitimately contains ONE static <b>TITULAR:</b>
    // label, so the assertion targets the exact hostile payloads rather than
    // a blanket "no <b> anywhere" (which would false-positive on the label).
    expect(out).not.toContain("<b>preferente</b>")
    expect(out).not.toContain("<b>Pasajera</b>")
  })

  it("escapes the script payload from `titular` exactly", () => {
    expect(out).toContain("JUANA &lt;SCRIPT&gt;ALERT(1)&lt;/SCRIPT&gt; PÉREZ")
  })

  it("escapes the <img onerror> payload from pasajero #1's nombreCompleto", () => {
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  it("escapes pasajero #2's DIFFERENT hostile payload (proves every element is escaped, not just the first)", () => {
    expect(out).toContain("Ñoño O&#39;Brien &amp; &quot;Segunda&quot; &lt;b&gt;Pasajera&lt;/b&gt;")
  })

  it("escapes occupancy group #1's hostile categoria", () => {
    expect(out).toContain("Categoría &quot;Deluxe&quot; &lt;VIP&gt; &amp; Ñandú")
  })

  it("escapes occupancy group #2's DIFFERENT hostile categoria (proves every group is escaped, not just the first)", () => {
    expect(out).toContain("Junior Suite O&#39;Brien &amp; &quot;Superior&quot;")
  })

  it("escapes the double-quote/ampersand/tag payload from observaciones", () => {
    expect(out).toContain("Cliente &quot;VIP&quot; &amp; socio &lt;b&gt;preferente&lt;/b&gt; en ESTADÍA prolongada")
  })

  it("escapes the hostile `lugar` payload", () => {
    expect(out).toContain("HOTEL &lt;CATEGORÍA &quot;DELUXE&quot;&gt; — AÑEJO &amp; ÑANDÚ")
  })

  it("& is escaped BEFORE < and > — a literal '<' substring in source data is not double-encoded", () => {
    expect(out).not.toContain("&amp;lt;")
    expect(out).not.toContain("&amp;gt;")
    expect(out).not.toContain("&amp;quot;")
    expect(out).not.toContain("&amp;#39;")
  })
})

describe("generateVoucherDocHTML — accents survive byte-identical (first-class, not a footnote)", () => {
  const out = generateVoucherDocHTML(HOSTILE_FIXTURE)

  it("Categoría appears verbatim in a room line", () => {
    expect(out).toContain("Categoría")
  })

  it("Pérez appears verbatim (uppercased, per the titular's .toUpperCase())", () => {
    expect(out).toContain("PÉREZ")
  })

  it("Añejo appears verbatim", () => {
    expect(out).toContain("AÑEJO")
  })

  it("Ñandú appears verbatim", () => {
    expect(out).toContain("ÑANDÚ")
  })

  it("ESTADÍA appears verbatim", () => {
    expect(out).toContain("ESTADÍA")
  })

  it("the en-dash (–) appears verbatim in the room lines (source's own dash, per docs/VOUCHER GEB-2.docx)", () => {
    expect(out).toContain("–")
  })

  it("no accented character was entity-encoded — no numeric character reference near the accented words", () => {
    expect(out).not.toMatch(/&#(2|3)\d\d;/) // Latin-1 Supplement / Latin Extended-A entity range
  })
})

describe("generateVoucherDocHTML — static Spanish boilerplate is byte-identical regardless of fixture", () => {
  const cleanOut = generateVoucherDocHTML(CLEAN_FIXTURE)
  const hostileOut = generateVoucherDocHTML(HOSTILE_FIXTURE)

  const STATIC_SNIPPETS = [
    "ESTA RESERVA ES VALIDA POR LOS SERVICIOS MAS ARRIBA ESPECIFICADOS. CUALQUIER OTRO CARGO CORRE POR CUENTA DEL CLIENTE.",
    "Debe presentar obligatoriamente la cédula o pasaporte de todos los pasajeros.",
    "Para los menores de edad el acta de nacimiento.",
    "Es posible que el hotel exija un depósito reembolsable por habitación.",
    "¡QUE TENGA UNA EXCELENTE ESTADÍA! BENDICIONES.",
    "Posible cargo adicional por llegada previa.",
    "Posible cargo adicional por entregar tarde.",
  ]

  for (const snippet of STATIC_SNIPPETS) {
    it(`"${snippet.slice(0, 40)}…" appears verbatim in the CLEAN fixture's output`, () => {
      expect(cleanOut).toContain(snippet)
    })

    it(`"${snippet.slice(0, 40)}…" appears verbatim in the HOSTILE fixture's output (unaffected by escaping elsewhere)`, () => {
      expect(hostileOut).toContain(snippet)
    })
  }
})

describe("generateVoucherDocHTML — no-op on clean data", () => {
  it("renders zero HTML entities for a fixture with no escapable characters", () => {
    const out = generateVoucherDocHTML(CLEAN_FIXTURE)
    expect(out).not.toContain("&amp;")
    expect(out).not.toContain("&lt;")
    expect(out).not.toContain("&gt;")
    expect(out).not.toContain("&quot;")
    expect(out).not.toContain("&#39;")
  })

  it("renders every clean-fixture field verbatim, unescaped", () => {
    const out = generateVoucherDocHTML(CLEAN_FIXTURE)
    expect(out).toContain("Carr. El Macao - Arena Gorda, Punta Cana 23000")
    expect(out).toContain("(809) 552-1444")
    expect(out).toContain("77795")
    expect(out).toContain("Juan Perez y Carlos Perez")
    expect(out).toContain("Pedro Mendez y Charlie Perez")
  })
})

describe("generateVoucherDocHTML — static guard: raw( appears zero times", () => {
  it("the function's source contains NO call to raw( — no data value bypasses the html tag", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "document-generator.tsx"), "utf-8")
    const start = source.indexOf("export function generateVoucherDocHTML")
    expect(start, "generateVoucherDocHTML not found in lib/document-generator.tsx").toBeGreaterThan(-1)
    const nextFnStart = source.indexOf("\nexport function ", start + 1)
    const fnSource = nextFnStart === -1 ? source.slice(start) : source.slice(start, nextFnStart)
    const rawCallCount = (fnSource.match(/\braw\(/g) ?? []).length
    expect(rawCallCount).toBe(0)
  })
})

describe("generateVoucherDocHTML — DIRECCIÓN/TELEFONO render the HOTEL's data, never the client's/agency's (fixing the legacy bug)", () => {
  it("DIRECCIÓN renders direccionHotel (productos.direccion)", () => {
    const out = generateVoucherDocHTML(CLEAN_FIXTURE)
    expect(out).toContain("DIRECCIÓN:</div>\n        <div class=\"val\">Carr. El Macao - Arena Gorda, Punta Cana 23000</div>")
  })

  it("TELEFONO renders telefonoHotel (suplidores.telefono)", () => {
    const out = generateVoucherDocHTML(CLEAN_FIXTURE)
    expect(out).toContain("TELEFONO:</div>\n        <div class=\"val\">(809) 552-1444</div>")
  })
})

describe("generateVoucherDocHTML — SERVICIOS renders regimen + one line per occupancy group, docs/VOUCHER GEB-2.docx's exact shape", () => {
  const out = generateVoucherDocHTML(CLEAN_FIXTURE)

  it("renders '- ALOJAMIENTO - <regimen>'", () => {
    expect(out).toContain("- ALOJAMIENTO - TODO INCLUIDO")
  })

  it("renders occupancy group #1's exact shape with the en-dash and accented Categoría", () => {
    expect(out).toContain("- X 8 HABITACIONES OCUPACION DOBLE – Categoría: Junior Suite Superior")
  })

  it("renders occupancy group #2's DIFFERENT shape (proves each group renders its OWN values, not the first repeated)", () => {
    expect(out).toContain("- X 3 HABITACIONES OCUPACION TRIPLE – Categoría: Junior Suite Superior")
  })
})

describe("generateVoucherDocHTML — TITULAR renders pax counts, distinguishing zero from unset (block-never-default inheritance)", () => {
  it("renders '<titular> <adultos> Ad + <ninos> Chd + <infantes> Inf' for the docs/VOUCHER GEB-2.docx sample counts", () => {
    const out = generateVoucherDocHTML(CLEAN_FIXTURE)
    expect(out).toContain("EMILY JOAQUIN 25 Ad + 11 Chd + 1 Inf")
  })

  it("renders a genuine ZERO paxNinos/paxInfantes as literal '0', never blank or omitted", () => {
    const zeroFixture: VoucherDocData = { ...CLEAN_FIXTURE, paxNinos: 0, paxInfantes: 0 }
    const out = generateVoucherDocHTML(zeroFixture)
    expect(out).toContain("EMILY JOAQUIN 25 Ad + 0 Chd + 0 Inf")
  })
})

describe("generateVoucherDocHTML — NOCHES is always the contract's computed value, NEVER a ':3' fallback", () => {
  it("renders noches=2 verbatim for a fixture whose stay is 2 nights", () => {
    const fixture: VoucherDocData = { ...CLEAN_FIXTURE, noches: 2 }
    const out = generateVoucherDocHTML(fixture)
    expect(out).toContain('<div class="lbl">NOCHES:</div>\n        <div class="val">2</div>')
  })

  it("renders a DIFFERENT noches=9 verbatim for a different fixture (proves the value flows from data, not a fixed literal)", () => {
    const fixture: VoucherDocData = { ...CLEAN_FIXTURE, noches: 9 }
    const out = generateVoucherDocHTML(fixture)
    expect(out).toContain('<div class="lbl">NOCHES:</div>\n        <div class="val">9</div>')
  })
})

describe("generateVoucherDocHTML — money-leak assertion (runtime complement to T13's compile-time guarantee)", () => {
  // Matches CONFIRMACIÓN's money patterns AND its money labels — if any of
  // these ever appear in the voucher's rendered output, real money has
  // leaked into a document the passenger carries to the hotel.
  const MONEY_PATTERN = /RD\s?\$|US\s?\$|\$\s?\d|\d+[.,]\d{2}\s*(DOP|USD)/
  const MONEY_LABELS = ["SUB_TOTAL", "DESC_TOTAL", "TOTAL:", "MONTO PAGADO", "BALANCE"]

  it("the CLEAN fixture's rendered output matches NO currency-shaped pattern", () => {
    const out = generateVoucherDocHTML(CLEAN_FIXTURE)
    expect(out).not.toMatch(MONEY_PATTERN)
  })

  it("the HOSTILE fixture's rendered output matches NO currency-shaped pattern", () => {
    const out = generateVoucherDocHTML(HOSTILE_FIXTURE)
    expect(out).not.toMatch(MONEY_PATTERN)
  })

  for (const label of MONEY_LABELS) {
    it(`the rendered output contains none of CONFIRMACIÓN's money labels: "${label}"`, () => {
      const out = generateVoucherDocHTML(CLEAN_FIXTURE)
      expect(out).not.toContain(label)
    })
  }
})

describe("generateVoucherDocHTML — CHECK IN/OUT render from the SAME columns CONFIRMACIÓN uses (T14 AC-6)", () => {
  // One reserva fixture, fed identically into both contracts' date/hora
  // fields. Both generators implement the identical fmtFecha/fmtHora
  // algorithm, so the same reservas.hora_entrada/hora_salida and
  // fecha_entrada/fecha_salida columns must render IDENTICAL date and time
  // strings on both documents.
  const sharedDates = {
    checkInFecha: "2026-07-24",
    checkInHora: "15:00",
    checkOutFecha: "2026-07-27",
    checkOutHora: "12:00",
  }

  const voucherFixture: VoucherDocData = { ...CLEAN_FIXTURE, ...sharedDates }

  const confirmacionFixture: ConfirmacionData = {
    idCliente: 501,
    nombre: "Emily Joaquin",
    cedulaRnc: "001-1234567-8",
    email: "emily@example.com",
    whatsapp: "809-555-1234",
    servicio: "Bahia Principe Grand Punta Cana Hotel",
    checkIn: sharedDates.checkInFecha,
    checkOut: sharedDates.checkOutFecha,
    horaEntrada: sharedDates.checkInHora,
    horaSalida: sharedDates.checkOutHora,
    fechaReserva: "2026-06-01",
    idReserva: 9001,
    facturaNumero: "F-000123",
    pasajerosCount: 2,
    habitacionesCount: 2,
    observaciones: "Ninguna",
    lineas: [{ descripcion: "Habitacion Doble", precioUnitario: 25000, descuento: 0, total: 25000 }],
    subTotal: 25000,
    descTotal: 0,
    total: 25000,
    montoPagado: 10000,
    balanceReserva: 15000,
    balanceGeneralDOP: 15000,
    balanceGeneralUSD: 0,
    pasajeros: [{ orden: 1, nombreCompleto: "Emily Joaquin", tipoPax: "ADULTO" }],
    atendidoPor: "Ana Perez",
    referidoPor: "Instagram",
  }

  it("both documents render the IDENTICAL check-in date string", () => {
    const voucherOut = generateVoucherDocHTML(voucherFixture)
    const confirmacionOut = generateConfirmacionHTML(confirmacionFixture)
    expect(voucherOut).toContain("24-JULIO-2026")
    expect(confirmacionOut).toContain("24-JULIO-2026")
  })

  it("both documents render the IDENTICAL check-in time string (03:00 PM, from hora_entrada — never a hardcoded literal)", () => {
    const voucherOut = generateVoucherDocHTML(voucherFixture)
    const confirmacionOut = generateConfirmacionHTML(confirmacionFixture)
    expect(voucherOut).toContain("03:00 PM")
    expect(confirmacionOut).toContain("03:00 PM")
  })

  it("both documents render the IDENTICAL check-out date string", () => {
    const voucherOut = generateVoucherDocHTML(voucherFixture)
    const confirmacionOut = generateConfirmacionHTML(confirmacionFixture)
    expect(voucherOut).toContain("27-JULIO-2026")
    expect(confirmacionOut).toContain("27-JULIO-2026")
  })

  it("both documents render the IDENTICAL check-out time string (12:00 PM, from hora_salida — never a hardcoded literal)", () => {
    const voucherOut = generateVoucherDocHTML(voucherFixture)
    const confirmacionOut = generateConfirmacionHTML(confirmacionFixture)
    expect(voucherOut).toContain("12:00 PM")
    expect(confirmacionOut).toContain("12:00 PM")
  })

  it("a DIFFERENT hora_entrada (09:15, non-12h-boundary) renders identically on both documents (proves the formatting is computed, not hardcoded 03:00 PM/12:00 PM)", () => {
    const differentHora = { ...sharedDates, checkInHora: "09:15" }
    const voucherOut = generateVoucherDocHTML({ ...CLEAN_FIXTURE, ...differentHora })
    const confirmacionOut = generateConfirmacionHTML({ ...confirmacionFixture, horaEntrada: "09:15" })
    expect(voucherOut).toContain("09:15 AM")
    expect(confirmacionOut).toContain("09:15 AM")
    expect(voucherOut).not.toContain("03:00 PM – Posible cargo adicional por llegada previa")
  })
})

describe("generateVoucherDocHTML — T16 regression guard: OBERSACIONES typo reproduced, PASAJEROS precedes it (docs/VOUCHER GEB-2.docx paragraphs 17-18)", () => {
  // These two assertions are the missing coverage QA flagged on T16's first
  // pass: the plan claimed reverting either fix would turn the suite RED,
  // but neither was actually asserted. Both are mutation-checked (see the
  // dev report) against this exact rendered string.
  it("the label reproduces the source .docx's own typo, OBERSACIONES (paragraph 18, a single <w:t> run) — must NOT silently revert to the correctly-spelled OBSERVACIONES", () => {
    const out = generateVoucherDocHTML(CLEAN_FIXTURE)
    expect(out).toContain('<div class="lbl">OBERSACIONES</div>')
    expect(out).not.toContain('<div class="lbl">OBSERVACIONES</div>')
  })

  it("PASAJEROS renders BEFORE OBERSACIONES (source order: .docx paragraph 17 precedes paragraph 18) — must not swap back", () => {
    const out = generateVoucherDocHTML(CLEAN_FIXTURE)
    const pasajerosIdx = out.indexOf('<div class="lbl">PASAJEROS</div>')
    const obersacionesIdx = out.indexOf('<div class="lbl">OBERSACIONES</div>')
    expect(pasajerosIdx).toBeGreaterThan(-1)
    expect(obersacionesIdx).toBeGreaterThan(-1)
    expect(pasajerosIdx).toBeLessThan(obersacionesIdx)
  })
})

describe("generateVoucherDocHTML — other generators untouched, legacy voucher generator RETIRED (T15 AC-11)", () => {
  it("lib/document-generator.tsx still exports generateProformaHTML, generateConfirmacionHTML and generateReciboHTML", async () => {
    const mod = await import("../lib/document-generator")
    expect(typeof mod.generateProformaHTML).toBe("function")
    expect(typeof mod.generateConfirmacionHTML).toBe("function")
    expect(typeof mod.generateReciboHTML).toBe("function")
  })

  it("the legacy generateVoucherHTML(data: VoucherData) is GONE — zero callers survived T15's repoint, so it was retired in the same task (T15 AC-11), not left for backlog", async () => {
    const mod = await import("../lib/document-generator")
    expect((mod as Record<string, unknown>).generateVoucherHTML).toBeUndefined()
  })

  it("the legacy VoucherData interface is GONE from the source — grep-evidenced, per T15 AC-11's evidence requirement", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "document-generator.tsx"), "utf-8")
    expect(source).not.toMatch(/export interface VoucherData\b/)
    expect(source).not.toMatch(/function generateVoucherHTML\b/)
  })
})
