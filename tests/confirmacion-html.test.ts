// HC-5 (docs/plans/geb-documents-real-data.md §9 HC-5, Task T6b) — rendered-
// output assertions for generateConfirmacionHTML: the hostile fixture, the
// accent-preservation requirement, and the clean-fixture no-op regression
// gate.
//
// Assertions are on the RENDERED HTML STRING, never on "we call the helper"
// (§10 of the plan). Offline, plain data objects
// (patterns/port-and-in-memory-fake) — no network, no Supabase.

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { generateConfirmacionHTML } from "../lib/document-generator"
import type { ConfirmacionData } from "../lib/confirmacion-data"

// A fully-known ConfirmacionData fixture with NO escapable characters (no
// & < > " '). Used for the no-op / byte-identical regression gate (AC-7).
const CLEAN_FIXTURE: ConfirmacionData = {
  idCliente: 501,
  nombre: "Maria Fernandez",
  cedulaRnc: "001-1234567-8",
  email: "maria@example.com",
  whatsapp: "809-555-1234",
  servicio: "Hotel Riu Palace",
  checkIn: "2026-08-10",
  checkOut: "2026-08-15",
  horaEntrada: "15:00",
  horaSalida: "12:00",
  fechaReserva: "2026-07-01",
  idReserva: 9001,
  facturaNumero: "F-000123",
  pasajerosCount: 2,
  habitacionesCount: 1,
  observaciones: "Cliente frecuente, pidio cuarto alto",
  lineas: [
    { descripcion: "Habitacion Doble", precioUnitario: 25000, descuento: 0, total: 25000 },
    { descripcion: "Traslado Aeropuerto", precioUnitario: 2500, descuento: 100, total: 2400 },
  ],
  subTotal: 27500,
  descTotal: 100,
  total: 27400,
  montoPagado: 10000,
  balanceReserva: 17400,
  balanceGeneralDOP: 17400,
  balanceGeneralUSD: 0,
  pasajeros: [
    { orden: 1, nombreCompleto: "Maria Fernandez", tipoPax: "ADULTO" },
    { orden: 2, nombreCompleto: "Juan Fernandez", tipoPax: "ADULTO" },
  ],
  atendidoPor: "Ana Perez",
  referidoPor: "Instagram",
}

// The hostile fixture (§10 of the plan, verbatim), adapted to
// ConfirmacionData's real field names, WIDENED per the standing sprint
// instruction: >=2 non-identical passengers with DIFFERENT hostile payloads
// and >=2 non-identical detalle lines with DIFFERENT hostile payloads — a
// single-element fixture cannot distinguish "escapes every value" from
// "escapes only the first value". Contains, in the SAME fixture: a script
// tag, single quotes, double quotes, ampersands, angle brackets, AND
// accented Spanish text.
const HOSTILE_FIXTURE: ConfirmacionData = {
  ...CLEAN_FIXTURE,
  nombre: "Juana <script>alert(1)</script> Pérez",
  observaciones: 'Cliente "VIP" & socio <b>preferente</b> en ESTADÍA prolongada',
  atendidoPor: "O'Brien & Asociados",
  referidoPor: `Añejo & Ñandú — referido por "socios"`,
  servicio: 'Hotel <Categoría "Deluxe"> — Añejo & Ñandú',
  lineas: [
    { descripcion: 'HABITACIÓN <DOBLE> & "SUITE"', precioUnitario: 1000, descuento: 0, total: 1000 },
    { descripcion: `Traslado <VIP> O'Brien & "Aeropuerto"`, precioUnitario: 500, descuento: 50, total: 450 },
  ],
  pasajeros: [
    { orden: 1, nombreCompleto: "<img src=x onerror=alert(1)>", tipoPax: "ADULTO" },
    { orden: 2, nombreCompleto: `Ñoño O'Brien & "Segunda" <b>Pasajera</b>`, tipoPax: "NINO" },
  ],
}

// The four OQ2 policy paragraphs + the closing line — literal template text
// with no interpolation. Must appear byte-identical regardless of fixture.
const STATIC_BOILERPLATE_SNIPPETS = [
  "Políticas de cancelación, pagos, penalidades",
  "Fecha límite de pago:",
  "(La fecha que se cancela la reserva automáticamente)",
  "De no realizarse el pago en esta fecha al día siguiente entra en gastos 100%.",
  "se va penalizar con RD $1,000.00 por habitación",
  "No somos responsables de no realizar pagos a tiempo",
  "MUCHAS GRACIAS POR CONFIAR EN NUESTROS SERVICIOS.",
]

describe("generateConfirmacionHTML — HC-5 hostile fixture renders safe", () => {
  const out = generateConfirmacionHTML(HOSTILE_FIXTURE)

  it("contains NO <script in unescaped form", () => {
    expect(out).not.toContain("<script")
  })

  it("contains NO <img in unescaped form", () => {
    expect(out).not.toContain("<img")
  })

  it("contains NO onerror= inside a live (unescaped) tag — the exact hostile <img> payload never appears raw", () => {
    // NOTE: the literal WORD "onerror=" legitimately survives as inert text
    // once its surrounding "<img" / ">" are escaped — that is the whole
    // point of escaping (neutralise the tag, not delete the word). The real
    // security property is that the payload can never again be parsed as a
    // live element, i.e. the exact raw markup string must not appear.
    expect(out).not.toContain("<img src=x onerror=alert(1)>")
  })

  it("contains NO <b> in unescaped form (observaciones and pasajero payloads)", () => {
    expect(out).not.toContain("<b>")
    expect(out).not.toContain("</b>")
  })

  it("escapes the script payload from `nombre` exactly", () => {
    expect(out).toContain("Juana &lt;script&gt;alert(1)&lt;/script&gt; Pérez")
  })

  it("escapes the <img onerror> payload from pasajero #1's nombreCompleto", () => {
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  it("escapes pasajero #2's DIFFERENT hostile payload (proves every element is escaped, not just the first)", () => {
    expect(out).toContain("Ñoño O&#39;Brien &amp; &quot;Segunda&quot; &lt;b&gt;Pasajera&lt;/b&gt;")
  })

  it("escapes detalle line #1's hostile descripcion (uppercased, per the template)", () => {
    expect(out).toContain("HABITACIÓN &lt;DOBLE&gt; &amp; &quot;SUITE&quot;")
  })

  it("escapes detalle line #2's DIFFERENT hostile descripcion (proves every line is escaped, not just the first)", () => {
    // .descripcion is rendered through .toUpperCase() by the template BEFORE
    // escaping (raw value uppercased, then escaped at render) — so the
    // apostrophe survives uppercasing and is escaped as &#39;.
    expect(out).toContain("TRASLADO &lt;VIP&gt; O&#39;BRIEN &amp; &quot;AEROPUERTO&quot;")
  })

  it("escapes the single-quote/ampersand payload from atendidoPor", () => {
    expect(out).toContain("O&#39;Brien &amp; Asociados")
  })

  it("escapes the double-quote/ampersand/tag payload from observaciones", () => {
    expect(out).toContain("Cliente &quot;VIP&quot; &amp; socio &lt;b&gt;preferente&lt;/b&gt; en ESTADÍA prolongada")
  })

  it("& is escaped BEFORE < and > — a literal '&lt;' substring in source data is not double-encoded", () => {
    // servicio contains a literal `<Categoría "Deluxe">` — after escaping,
    // '&lt;' must appear exactly once per bracket, never '&amp;lt;'.
    expect(out).not.toContain("&amp;lt;")
    expect(out).not.toContain("&amp;gt;")
    expect(out).not.toContain("&amp;quot;")
    expect(out).not.toContain("&amp;#39;")
  })
})

describe("generateConfirmacionHTML — accents survive byte-identical (first-class, not a footnote)", () => {
  const out = generateConfirmacionHTML(HOSTILE_FIXTURE)

  it("Categoría appears verbatim", () => {
    expect(out).toContain("Categoría")
  })

  it("Pérez appears verbatim", () => {
    expect(out).toContain("Pérez")
  })

  it("Añejo appears verbatim (twice: servicio and referidoPor)", () => {
    expect(out.split("Añejo").length - 1).toBeGreaterThanOrEqual(2)
  })

  it("Ñandú appears verbatim", () => {
    expect(out).toContain("Ñandú")
  })

  it("ESTADÍA appears verbatim", () => {
    expect(out).toContain("ESTADÍA")
  })

  it("the en-dash (—) appears verbatim", () => {
    expect(out).toContain("—")
  })

  it("no accented character was entity-encoded — no numeric character reference near the accented words", () => {
    expect(out).not.toMatch(/&#(2|3)\d\d;/) // Latin-1 Supplement / Latin Extended-A entity range
  })
})

describe("generateConfirmacionHTML — static Spanish boilerplate is byte-identical regardless of fixture", () => {
  const cleanOut = generateConfirmacionHTML(CLEAN_FIXTURE)
  const hostileOut = generateConfirmacionHTML(HOSTILE_FIXTURE)

  for (const snippet of STATIC_BOILERPLATE_SNIPPETS) {
    it(`"${snippet.slice(0, 40)}…" appears verbatim in the CLEAN fixture's output`, () => {
      expect(cleanOut).toContain(snippet)
    })

    it(`"${snippet.slice(0, 40)}…" appears verbatim in the HOSTILE fixture's output (unaffected by escaping elsewhere)`, () => {
      expect(hostileOut).toContain(snippet)
    })
  }
})

describe("generateConfirmacionHTML — no-op on clean data (AC-7)", () => {
  it("renders zero HTML entities for a fixture with no escapable characters", () => {
    const out = generateConfirmacionHTML(CLEAN_FIXTURE)
    expect(out).not.toContain("&amp;")
    expect(out).not.toContain("&lt;")
    expect(out).not.toContain("&gt;")
    expect(out).not.toContain("&quot;")
    expect(out).not.toContain("&#39;")
  })

  it("renders every clean-fixture field verbatim, unescaped", () => {
    const out = generateConfirmacionHTML(CLEAN_FIXTURE)
    expect(out).toContain("NOMBRE:</span> Maria Fernandez")
    expect(out).toContain("SERVICIO:</span> Hotel Riu Palace")
    expect(out).toContain("Cliente frecuente, pidio cuarto alto")
    expect(out).toContain("Ana Perez")
    expect(out).toContain("Instagram")
  })

  it("byte-for-byte matches T6\'s approved output for this fixture — proves the tag is a no-op on safe data", () => {
    // This inline snapshot is vitest-managed (written automatically on the
    // first `vitest -u` run against generateConfirmacionHTML(CLEAN_FIXTURE),
    // which has no escapable characters). It was independently cross-checked
    // against generateConfirmacionHTML's PRE-T6b output (plain, unescaped
    // template-literal interpolation) for the identical fixture and found
    // byte-identical before being committed here — see the T6b task report
    // for that before/after diff evidence.
    const out = generateConfirmacionHTML(CLEAN_FIXTURE)
    expect(out).toMatchInlineSnapshot(`
      "
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmación de Servicios - Reserva 9001</title>
            <style>
              @page {
                size: A4;
                margin: 0;
              }

              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background: white;
                font-size: 12px;
                line-height: 1.4;
              }

              .page {
                width: 210mm;
                min-height: 297mm;
                padding: 0;
                margin: 0 auto;
                background: white;
                page-break-after: always;
                position: relative;
              }

              .page:last-child {
                page-break-after: avoid;
              }

              /* Page 2 - Confirmación Content */
              .proforma-page {
                padding: 20px;
                position: relative;
              }

              .header-logo {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 100px;
                height: 60px;
                background: url('/public/images/ellibry-logo.png') no-repeat center;
                background-size: contain;
              }

              .confirmation-badge {
                position: absolute;
                top: 20px;
                right: 140px;
                background: #666;
                color: white;
                padding: 8px 15px;
                font-size: 10px;
                font-weight: bold;
              }

              .page-number {
                position: absolute;
                top: 20px;
                left: 20px;
                font-size: 10px;
                color: #666;
              }

              .content-section {
                margin-top: 80px;
              }

              .info-row {
                display: flex;
                margin-bottom: 30px;
              }

              .client-info, .reservation-info {
                flex: 1;
                padding: 0 20px;
              }

              .section-title {
                font-size: 14px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 15px;
                border-bottom: 1px solid #333;
                padding-bottom: 5px;
              }

              .info-line {
                margin-bottom: 1px;
                font-size: 11px;
                line-height: 1.2;
              }

              .info-label {
                font-weight: bold;
                display: inline-block;
                width: 80px;
              }

              .observations {
                margin: 20px 0;
                text-align: center;
              }

              .observations-title {
                font-weight: bold;
                margin-bottom: 10px;
              }

              .observations-content {
                font-style: italic;
                color: #666;
              }

              .details-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }

              .details-table th,
              .details-table td {
                border: 1px solid #333;
                padding: 8px;
                text-align: center;
                font-size: 11px;
              }

              .details-table th {
                background: #d1d5db;
                font-weight: bold;
                color: #374151;
              }

              .details-table td:first-child {
                text-align: center;
              }

              .totals-section {
                margin: 20px 0;
                text-align: right;
              }

              .totals-table {
                width: 100%;
                margin-bottom: 10px;
              }

              .totals-row {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 0;
                font-size: 11px;
                align-items: center;
              }

              .totals-label {
                font-weight: bold;
                margin-right: 0;
                min-width: 200px;
                text-align: right;
              }

              .totals-value {
                text-align: right;
                min-width: 100px;
                margin-left: 0;
              }

              .balance-paid {
                background: #22c55e;
                color: white;
                padding: 2px 6px;
                margin: 0;
              }

              .balance-pending {
                background: #ef4444;
                color: white;
                padding: 2px 6px;
                margin: 0;
              }

              .balance-general {
                background: #fef3c7;
                color: #000;
                padding: 2px 6px;
                font-size: 10px;
                margin: 0;
              }

              .policies-section {
                border: 1px solid #333;
                padding: 15px;
                margin: 20px 0;
              }

              .policies-title {
                font-weight: bold;
                text-align: center;
                margin-bottom: 10px;
              }

              .policy-text {
                font-size: 10px;
                margin-bottom: 8px;
                text-align: center;
              }

              .warning-text {
                color: #f44336;
                font-weight: bold;
                font-size: 10px;
                text-align: center;
                margin-top: 10px;
              }

              .passengers-section {
                border: 1px solid #333;
                padding: 15px;
                margin: 20px 0;
                min-height: 60px;
              }

              .passengers-title {
                font-weight: bold;
                text-align: center;
                margin-bottom: 10px;
              }

              .passenger-line {
                margin-bottom: 5px;
                font-size: 11px;
              }

              .footer-section {
                text-align: center;
                margin-top: 30px;
              }

              .thank-you {
                font-weight: bold;
                font-size: 12px;
                margin-bottom: 20px;
              }

              .attended-by {
                font-size: 11px;
                margin-bottom: 5px;
              }

              .attended-name {
                font-weight: bold;
              }

              /* Page 3 - Banking Information with Background Image */
              .banking-page-2 {
                background: url('/banking-card-background.png') no-repeat center center;
                background-size: cover;
                position: relative;
              }

              .banking-title {
                font-size: 24px;
                font-weight: bold;
                color: #333;
                margin-bottom: 30px;
              }

              .bank-section {
                margin-bottom: 25px;
              }

              .bank-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
              }

              .bank-info {
                flex: 1;
                text-align: center;
              }

              .bank-logo {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 5px;
              }

              .bhd-logo {
                color: #4CAF50;
              }

              .popular-logo {
                color: #1976D2;
              }

              .banreservas-logo {
                color: #2196F3;
              }

              .account-type {
                font-size: 16px;
                font-weight: bold;
                color: #4CAF50;
                margin-bottom: 3px;
              }

              .account-number {
                font-size: 18px;
                font-weight: bold;
                color: #333;
              }

              .company-info {
                margin-top: 30px;
                border-top: 2px solid #333;
                padding-top: 20px;
              }

              .company-name {
                font-size: 16px;
                font-weight: bold;
                color: #333;
                margin-bottom: 5px;
              }

              .company-details {
                font-size: 14px;
                color: #666;
                margin-bottom: 3px;
              }

              .ellibry-logo {
                position: absolute;
                top: 30px;
                right: 30px;
                width: 120px;
                height: 80px;
                background: url('/images/ellibry-logo.png') no-repeat center;
                background-size: contain;
              }

              .banking-card-2 {
                background: transparent;
                border-radius: 20px;
                padding: 40px;
                margin: 40px auto;
                text-align: center;
                max-width: 500px;
                margin-top: 100px;
              }

              .office-visit {
                text-align: center;
                margin-top: 50px;
                padding: 0 40px;
              }

              .office-title {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 15px;
              }

              .office-address {
                font-size: 12px;
                color: #333;
                line-height: 1.6;
              }

              .contact-footer {
                position: absolute;
                bottom: 30px;
                left: 0;
                right: 0;
                text-align: center;
                font-size: 10px;
                color: #333;
              }

              .contact-logo {
                width: 40px;
                height: 40px;
                background: url('/images/ellibry-logo.png') no-repeat center;
                background-size: contain;
                display: inline-block;
                vertical-align: middle;
                margin-right: 10px;
              }

              @media print {
                body { background: white !important; }
                .page { box-shadow: none !important; }
              }
            </style>
          </head>
          <body>
            <!-- Page 2: Confirmación Content -->
            <div class="page proforma-page">
              <div class="page-number">Page 1 of 2</div>
              <div class="confirmation-badge">CONFIRMACION DE SERVICIOS</div>
              <div class="header-logo"></div>

              <div class="content-section">
                <div class="info-row">
                  <div class="client-info">
                    <div class="section-title">Información de cliente</div>
                    <div class="info-line">
                      <span class="info-label">ID CLIENTE:</span> 501
                    </div>
                    <div class="info-line">
                      <span class="info-label">NOMBRE:</span> Maria Fernandez
                    </div>
                    <div class="info-line">
                      <span class="info-label">CEDULA/RNC:</span> 001-1234567-8
                    </div>
                    <div class="info-line">
                      <span class="info-label">EMAIL:</span> maria@example.com
                    </div>
                    <div class="info-line">
                      <span class="info-label">WHATAPP:</span> 809-555-1234
                    </div>
                  </div>

                  <div class="reservation-info">
                    <div class="section-title">Información de la reserva</div>
                    <div class="info-line">
                      <span class="info-label">SERVICIO:</span> Hotel Riu Palace
                    </div>
                    <div class="info-line">
                      <span class="info-label">CHECK IN:</span> 10-AGOSTO-2026
                    </div>
                    <div class="info-line">
                      <span class="info-label">CHECK OUT:</span> 15-AGOSTO-2026
                    </div>
                    <div class="info-line">
                      <span class="info-label">HORA ENTRADA:</span> 03:00 PM
                    </div>
                    <div class="info-line">
                      <span class="info-label">HORA SALIDA:</span> 12:00 PM
                    </div>
                    <div class="info-line">
                      <span class="info-label">FECHA RESERVA:</span> 01-JULIO-2026
                    </div>
                    <div class="info-line">
                      <span class="info-label">ID RESERVA:</span> 9001
                    </div>
                    <div class="info-line">
                      <span class="info-label">FACTURA #:</span> F-000123
                    </div>
                    <div class="info-line">
                      <span class="info-label">PASAJEROS:</span> 2
                    </div>
                    <div class="info-line">
                      <span class="info-label">HABITACIONES:</span> 1
                    </div>
                  </div>
                </div>

                <div class="observations">
                  <div class="observations-title">Observaciones:</div>
                  <div class="observations-content">Cliente frecuente, pidio cuarto alto</div>
                </div>

                <table class="details-table">
                  <thead>
                    <tr>
                      <th>DETALLE</th>
                      <th>PRECIO</th>
                      <th>DESC</th>
                      <th>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    
                      <tr>
                        <td>
                          HABITACION DOBLE
                        </td>
                        <td>25,000.00</td>
                        <td>0.00</td>
                        <td>25,000.00</td>
                      </tr>
                    
                      <tr>
                        <td>
                          TRASLADO AEROPUERTO
                        </td>
                        <td>2,500.00</td>
                        <td>100.00</td>
                        <td>2,400.00</td>
                      </tr>
                    
                  </tbody>
                </table>

                <div class="totals-section">
                  <div class="totals-row">
                    <span class="totals-label">SUB_TOTAL:</span><span class="totals-value">27,500.00</span>
                  </div>
                  <div class="totals-row">
                    <span class="totals-label">DESC_TOTAL:</span><span class="totals-value">100.00</span>
                  </div>
                  <div class="totals-row">
                    <span class="totals-label">TOTAL:</span><span class="totals-value">27,400.00</span>
                  </div>
                  <div class="totals-row">
                    <span class="totals-label balance-paid">MONTO PAGADO:</span><span class="totals-value balance-paid">10,000.00</span>
                  </div>
                  <div class="totals-row">
                    <span class="totals-label balance-pending">BALANCE RESERVA:</span><span class="totals-value balance-pending">17,400.00</span>
                  </div>
                  <div class="totals-row">
                    <span class="totals-label balance-general">BALANCE GENERAL EN RD $</span><span class="totals-value balance-general">17,400.00</span>
                  </div>
                  <div class="totals-row">
                    <span class="totals-label balance-general">BALANCE GENERAL EN US $</span><span class="totals-value balance-general">0.00</span>
                  </div>
                </div>

                <div class="policies-section">
                  <div class="policies-title">Políticas de cancelación, pagos, penalidades</div>
                  <div class="policy-text">
                    <strong>Fecha límite de pago:</strong><br>
                    (La fecha que se cancela la reserva automáticamente)
                  </div>
                  <div class="policy-text">
                    De no realizarse el pago en esta fecha al día siguiente entra en gastos 100%.
                  </div>
                  <div class="policy-text">
                    Toda reserva que se hayan hecho abonos y se cancelen, se va penalizar con RD $1,000.00 por habitación siempre y cuando la reserva no esté en gastos con el proveedor. Si la reserva entra en gastos es responsabilidad del agente pagar el monto correspondiente.
                  </div>
                  <div class="warning-text">
                    No somos responsables de no realizar pagos a tiempo y la reserva sea cancelada antes que entre en penalidad 100%, de entrar en penalidad la agencia debe cubrir el gasto.
                  </div>
                </div>

                <div class="passengers-section">
                  <div class="passengers-title">Información de los pasajeros:</div>
                  <div class="passenger-line">1) Maria Fernandez</div><div class="passenger-line">2) Juan Fernandez</div>
                </div>

                <div class="footer-section">
                  <div class="thank-you">MUCHAS GRACIAS POR CONFIAR EN NUESTROS SERVICIOS.</div>
                  <div class="attended-by">
                    <strong>Atendido por:</strong> <span class="attended-name">Ana Perez</span>
                  </div>
                  <div class="attended-by">
                    <strong>Referido por:</strong> <span class="attended-name">Instagram</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Page 3: Banking Information with Background Image -->
            <div class="page banking-page-2">
              <div class="page-number">Page 2 of 2</div>

              <div class="banking-card-2">
                <!-- Content is now overlaid on the background image -->
              </div>

              <div class="contact-footer">
                <div class="contact-logo"></div>
                <div>
                  <strong>Dirección:</strong> Avenida Jacobo Majluta, Plaza Toledo, Piso 1, Local 106, Arroyo Hondo, Distrito Nacional, Sto. Dgo.<br>
                  <strong>Contactos:</strong> 809•537•4070 • 849•252•2022 / 809•882•5675 / <strong>Email:</strong> servicio@grupoellibry.com<br>
                  <strong>RNC:</strong> 132739622 / <strong>Instagram:</strong> @grupoellibry / <strong>Pag. Web:</strong> grupoellibry.com
                </div>
              </div>
            </div>
          </body>
          </html>
        "
    `)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// HC-2 REVISED (CONFIRMACIÓN — make FACTURA # OPTIONAL): `facturaNumero` is
// now `string | null`. These tests are the rendered-HTML-level acceptance
// criteria (AC-1/AC-2/AC-5) for that reversal — assertions are on the
// RENDERED HTML STRING, matching this file's own stated convention (see the
// file header).
describe("generateConfirmacionHTML — HC-2 REVISED: FACTURA # optional (AC-1/AC-2/AC-5)", () => {
  const NO_FACTURA_FIXTURE: ConfirmacionData = { ...CLEAN_FIXTURE, facturaNumero: null }

  it("AC-1: renders successfully with facturaNumero: null — no throw, a non-empty document comes back", () => {
    const out = generateConfirmacionHTML(NO_FACTURA_FIXTURE)
    expect(typeof out).toBe("string")
    expect(out.length).toBeGreaterThan(0)
  })

  it('keeps the "FACTURA #:" labelled row present, rendered with an EMPTY value (reproduce-and-flag decision)', () => {
    const out = generateConfirmacionHTML(NO_FACTURA_FIXTURE)
    expect(out).toContain('<span class="info-label">FACTURA #:</span>')
    // Immediately after the label (allowing only the template's own
    // whitespace/newline before the next tag), NOTHING is rendered — no
    // fabricated value stands in for the absent number.
    expect(out).toMatch(/<span class="info-label">FACTURA #:<\/span>\s*\n\s*<\/div>/)
  })

  it("AC-2: no fabricated placeholder (\"N/A\"/\"-\"/\"PENDIENTE\"/a date) appears anywhere the FACTURA # would have rendered", () => {
    const out = generateConfirmacionHTML(NO_FACTURA_FIXTURE)
    const facturaLineMatch = out.match(/<span class="info-label">FACTURA #:<\/span>([^\n]*)\n/)
    expect(facturaLineMatch, "FACTURA # line not found in rendered output").not.toBeNull()
    const renderedValue = (facturaLineMatch as RegExpMatchArray)[1].trim()
    expect(renderedValue).toBe("")
    expect(renderedValue).not.toBe("N/A")
    expect(renderedValue).not.toBe("-")
    expect(renderedValue).not.toBe("PENDIENTE")
    expect(renderedValue).not.toBe("SIN FACTURA")
    expect(renderedValue).not.toMatch(/\d{4}-\d{2}-\d{2}/) // no date fabricated in its place
  })

  it("does NOT literally render the string \"null\" where the number would go", () => {
    const out = generateConfirmacionHTML(NO_FACTURA_FIXTURE)
    expect(out).not.toContain("FACTURA #:</span> null")
  })

  it("AC-5 (positive control): a facturaNumero that DOES exist still renders exactly as before", () => {
    const out = generateConfirmacionHTML(CLEAN_FIXTURE)
    expect(out).toContain('<span class="info-label">FACTURA #:</span> F-000123')
  })

  it("every OTHER info-line field still renders normally when facturaNumero is null — nothing else regresses", () => {
    const out = generateConfirmacionHTML(NO_FACTURA_FIXTURE)
    expect(out).toContain("NOMBRE:</span> Maria Fernandez")
    expect(out).toContain("ID RESERVA:</span> 9001")
    expect(out).toContain("PASAJEROS:</span> 2")
  })
})

describe("generateConfirmacionHTML — static guard: raw( appears zero times", () => {
  it("the function's source contains NO call to raw( — no data value bypasses the html tag", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "document-generator.tsx"), "utf-8")
    const start = source.indexOf("export function generateConfirmacionHTML")
    expect(start, "generateConfirmacionHTML not found in lib/document-generator.tsx").toBeGreaterThan(-1)
    const nextFnStart = source.indexOf("\nexport function ", start + 1)
    const fnSource = nextFnStart === -1 ? source.slice(start) : source.slice(start, nextFnStart)
    const rawCallCount = (fnSource.match(/\braw\(/g) ?? []).length
    expect(rawCallCount).toBe(0)
  })
})

describe("generateConfirmacionHTML — legacy generators untouched (HC-5 out of scope)", () => {
  it("lib/document-generator.tsx still exports generateProformaHTML and generateReciboHTML unchanged in shape", async () => {
    const mod = await import("../lib/document-generator")
    expect(typeof mod.generateProformaHTML).toBe("function")
    expect(typeof mod.generateReciboHTML).toBe("function")
  })
})

describe("generateConfirmacionHTML — T10 Grupo Ellibry identity pinned by narrow assertions", () => {
  const out = generateConfirmacionHTML(CLEAN_FIXTURE)

  // Positive assertions: corrected Grupo Ellibry identity MUST be present
  it("contains the corrected address: Avenida Jacobo Majluta, Plaza Toledo, Piso 1, Local 106, Arroyo Hondo, Distrito Nacional, Sto. Dgo.", () => {
    expect(out).toContain("Avenida Jacobo Majluta, Plaza Toledo, Piso 1, Local 106, Arroyo Hondo, Distrito Nacional, Sto. Dgo.")
  })

  it("contains the corrected phone numbers: 809•537•4070 • 849•252•2022 / 809•882•5675 (with U+2022 bullets)", () => {
    expect(out).toContain("809•537•4070 • 849•252•2022 / 809•882•5675")
  })

  it("contains the corrected email: servicio@grupoellibry.com", () => {
    expect(out).toContain("servicio@grupoellibry.com")
  })

  it("contains the corrected RNC: 132739622", () => {
    expect(out).toContain("132739622")
  })

  it("contains the corrected Instagram handle: @grupoellibry", () => {
    expect(out).toContain("@grupoellibry")
  })

  it("contains the corrected website: grupoellibry.com", () => {
    expect(out).toContain("grupoellibry.com")
  })

  // Negative assertions: old aventurasturisticasconellibry identity MUST NOT appear
  it("does NOT contain the old Instagram handle: aventurasturisticasconellibry", () => {
    expect(out).not.toContain("aventurasturisticasconellibry")
  })

  it("does NOT contain the old address: Calle Juan Alejandro Ibarra", () => {
    expect(out).not.toContain("Calle Juan Alejandro Ibarra")
  })

  it("does NOT contain the old phone number: 809•992•3548", () => {
    expect(out).not.toContain("809•992•3548")
  })

  it("does NOT contain the old office-visit text: Tambien puede pasar por nuestra oficina", () => {
    // The source text has "También" with accent; match the exact string from the code
    expect(out).not.toContain("Tambien puede pasar por nuestra oficina")
    expect(out).not.toContain("También puede pasar por nuestra oficina")
  })

  // Structural assertion: Dirección label appears exactly once
  it("contains the Dirección label exactly once in the rendered output", () => {
    const matches = out.split("<strong>Dirección:</strong>")
    expect(matches.length - 1).toBe(1)
  })
})
