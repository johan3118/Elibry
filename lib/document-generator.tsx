import type { ConfirmacionData } from "./confirmacion-data"
import type { VoucherDocData } from "./voucher-data"
import { html, renderHtml } from "./html-escape"

export interface ProformaData {
  cliente: {
    nombre: string
    email: string
    telefono: string
    direccion: string
  }
  items: Array<{
    descripcion: string
    cantidad: number
    precio: number
    total: number
  }>
  subtotal: number
  impuestos: number
  total: number
  moneda: string
  validez: string
  empresa: {
    nombre: string
    direccion: string
    telefono: string
    email: string
  }
}

export interface ReciboData {
  cliente: {
    nombre: string
    email: string
    telefono: string
    direccion: string
    identificacion: string
  }
  pago: {
    id: string
    monto: number
    metodo: string
    referencia: string
    fecha: string
    moneda: string
    concepto: string
    registradoPor: string
  }
  reserva: {
    numero: string
    codigo: string
    servicio: string
    total: number
    totalAbonado: number
    saldoPendiente: number
  }
  empresa: {
    nombre: string
    direccion: string
    telefono: string
    email: string
  }
}

/**
 * T14 (docs/plans/geb-documents-real-data.md) — VOUCHER, rewritten wholesale
 * against `VoucherDocData` (T13, lib/voucher-data.ts). Every fabrication the
 * legacy function carried is gone: no random localizador, no `noches ... : 3`
 * fallback, no hardcoded "03:00 PM"/"12:00 PM", no `"TODO INCLUIDO"` default,
 * no fake "1) {cliente} / 2) Acompañante" passenger placeholder, and — the
 * whole point of `VoucherDocData` — NO MONEY ANYWHERE. `docs/VOUCHER
 * GEB-2.docx` carries no price, total, balance or currency amount, and
 * `VoucherDocData` structurally cannot carry one either (T13, B3); this
 * function renders purely from that contract and invents nothing.
 *
 * HC-5 inheritance (mandatory, not re-litigated): built with the SAME `html`
 * tagged template from `lib/html-escape.ts` used by `generateConfirmacionHTML`
 * (T6b). Every interpolated value is escaped by default; `raw(` is never
 * called in this function. The voucher is hotel/supplier-facing and carries
 * staff-typed passenger names and free-text `observaciones` — the identical
 * injection exposure CONFIRMACIÓN has, so it gets the identical treatment.
 *
 * `DIRECCIÓN`/`TELEFONO` now render `productos.direccion` /
 * `suplidores.telefono` (the HOTEL's, via `VoucherDocData.direccionHotel` /
 * `telefonoHotel`) — fixing the legacy bug where `DIRECCIÓN` printed the
 * CLIENT's address and `TELÉFONO` printed the AGENCY's phone.
 *
 * CHECK IN/OUT are formatted with the exact same `fmtFecha`/`fmtHora` logic
 * `generateConfirmacionHTML` uses, fed from the same underlying
 * `reservas.hora_entrada`/`hora_salida` columns — so both documents render
 * an identical date/time string for the same reserva (T14 AC-6).
 *
 * There is no separate "voucher number" field in `VoucherDocData` — the
 * legacy badge's `VOUCHER # {reserva.numero}` was fed by
 * `generateVoucherNumber()` (a date+`Math.random()` string, never persisted,
 * deleted at T15). The one real, persisted identifier this contract carries
 * is `localizador`, so the badge renders that instead of inventing a second
 * number the contract does not have.
 *
 * LEGACY RETIRED (T15): `generateVoucherHTML(data: VoucherData)` and its
 * `VoucherData` type — the last two callers of which were this file's own
 * export and `app/facturacion/voucher/page.tsx` — have been deleted.
 * `generateVoucherDocHTML` is now the sole voucher generator; the page calls
 * only this export.
 */
export function generateVoucherDocHTML(data: VoucherDocData): string {
  const MESES_ES = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
  ]

  // "YYYY-MM-DD" (or any Date-parseable) -> "17-ABRIL-2025", identical to
  // generateConfirmacionHTML's fmtFecha (T14 AC-6). checkInFecha/
  // checkOutFecha are REQUIRED and already validated by buildVoucherData —
  // no fallback here.
  const fmtFecha = (iso: string): string => {
    const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`)
    return `${String(d.getDate()).padStart(2, "0")}-${MESES_ES[d.getMonth()]}-${d.getFullYear()}`
  }

  // "HH:MM"[:SS] 24h -> "03:00 PM" 12h, identical to generateConfirmacionHTML's
  // fmtHora (T14 AC-6). checkInHora/checkOutHora are REQUIRED and already
  // validated — never a hardcoded "03:00 PM"/"12:00 PM".
  const fmtHora = (hora: string): string => {
    const [hStr, mStr] = hora.split(":")
    const h24 = Number.parseInt(hStr, 10)
    const suffix = h24 >= 12 ? "PM" : "AM"
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${String(h12).padStart(2, "0")}:${mStr.padStart(2, "0")} ${suffix}`
  }

  // "1) 2) 3)…" by orden — zero rows renders the section with no lines and
  // no invented placeholder (never the legacy fake "1) {titular} / 2)
  // Acompañante").
  const pasajerosOrdenados = [...data.pasajeros].sort((a, b) => a.orden - b.orden)

  // Room lines ordered by `orden`, shape pinned to docs/VOUCHER GEB-2.docx:
  // "- X <cantidad> HABITACIONES OCUPACION <ocupacion> – Categoría: <categoria>"
  // (the en-dash and the accented "Categoría" are the source's own).
  const ocupacionesOrdenadas = [...data.ocupaciones].sort((a, b) => a.orden - b.orden)

  return renderHtml(html`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Voucher - ${data.localizador}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif; background: #fff; color: #000;
      font-size: 12px; line-height: 1.1;
    }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm; display: flex; flex-direction: column; }

    .topbar { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-num { font-size: 12px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo-box { width: 120px; height: 80px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; }
    .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .voucher-badge { background: #bfbfbf; color: #000; padding: 10px 14px; font-weight: bold; border-radius: 3px; }

    .titular { font-size: 18px; margin: 0; }
    .titular b { font-weight: 800; margin-right: 8px; }

    .lugar { display: grid; grid-template-columns: 120px 1fr; background: #e5e7eb; border: 1px solid #c7c7c7; margin: 0; }
    .lugar .cell-left { background: #cfd3d9; font-weight: 800; font-size: 18px; padding: 10px 12px; }
    .lugar .cell-right { font-size: 18px; font-weight: 800; padding: 10px 12px; }

    .details { width: 100%; border-top: 1px solid #e5e7eb; }
    .row { display: grid; grid-template-columns: 120px 1fr; padding: 6px 0; border-bottom: 1px solid #e5e7eb; margin: 0; }
    .lbl { font-weight: 800; padding-right: 10px; }
    .val { }

    .services-list { margin-top: 4px; }
    .services-list div { margin: 2px 0; }

    .localizador { background: #22c55e; color: #fff; font-weight: 800; text-align: left; padding: 8px 12px; border-radius: 2px; margin: 0; }

    .ribbon { background: #e5e7eb; padding: 8px 12px; border: 1px solid #d6d6d6; margin: 0; }
    .ribbon-title { font-weight: 800; margin-bottom: 2px; }

    .disclaimer { text-align: center; font-size: 10px; font-weight: 700; margin: 4px 0 0 0; }
    .important { text-align: center; color: #ef4444; font-weight: 800; font-size: 13px; margin: 8px 0 0 0; }
    .deposit { text-align: center; font-size: 13px; margin: 8px 0 0 0; }
    .closing { text-align: center; font-weight: 800; font-size: 13px; margin: 6px 0 0 0; }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="page-num">Page 1 of 1</div>
      <div class="brand">
        <div class="logo-box">
          <img src="/images/ellibry-logo.png" alt="Ellibry">
        </div>
        <div class="voucher-badge">VOUCHER # ${data.localizador}</div>
      </div>
    </div>

    <div class="titular"><b>TITULAR:</b> ${data.titular.toUpperCase()} ${data.paxAdultos} Ad + ${data.paxNinos} Chd + ${data.paxInfantes} Inf</div>

    <div class="lugar">
      <div class="cell-left">LUGAR:</div>
      <div class="cell-right">${data.lugar.toUpperCase()}</div>
    </div>

    <div class="details">
      <div class="row">
        <div class="lbl">DIRECCIÓN:</div>
        <div class="val">${data.direccionHotel}</div>
      </div>
      <div class="row">
        <div class="lbl">TELEFONO:</div>
        <div class="val">${data.telefonoHotel}</div>
      </div>
      <div class="row">
        <div class="lbl">SERVICIOS:</div>
        <div class="val">
          - ALOJAMIENTO - ${data.regimen}
          <div class="services-list">
            ${ocupacionesOrdenadas.map(
              (grupo) =>
                html`<div>- X ${grupo.cantidad} HABITACIONES OCUPACION ${grupo.ocupacion} – Categoría: ${grupo.categoria}</div>`,
            )}
          </div>
        </div>
      </div>
      <div class="row">
        <div class="lbl">NOCHES:</div>
        <div class="val">${data.noches}</div>
      </div>
    </div>

    <div class="localizador">LOCALIZADOR: ${data.localizador}</div>

    <div class="details">
      <div class="row">
        <div class="lbl">PASAJEROS</div>
        <div class="val">
          ${pasajerosOrdenados.map((p, i) => html`<div>${i + 1}) ${p.nombreCompleto}</div>`)}
        </div>
      </div>
      <!-- OBERSACIONES: reproduces docs/VOUCHER GEB-2.docx's OWN typo (paragraph
           18, a single <w:t> run — verified, not a split-run artifact). Do
           NOT "fix" this back to OBSERVACIONES; per T16, source typos are
           reproduced and flagged (same class as generateConfirmacionHTML's
           WHATAPP). -->
      <div class="row">
        <div class="lbl">OBERSACIONES</div>
        <div class="val">${data.observaciones}</div>
      </div>
    </div>

    <div class="ribbon">
      <div class="ribbon-title">CHECK IN:</div>
      <div>${fmtFecha(data.checkInFecha)} ${fmtHora(data.checkInHora)} – Posible cargo adicional por llegada previa.</div>
    </div>

    <div class="ribbon">
      <div class="ribbon-title">CHECK OUT:</div>
      <div>${fmtFecha(data.checkOutFecha)} ${fmtHora(data.checkOutHora)} – Posible cargo adicional por entregar tarde.</div>
    </div>

    <div class="disclaimer">
      ESTA RESERVA ES VALIDA POR LOS SERVICIOS MAS ARRIBA ESPECIFICADOS. CUALQUIER OTRO CARGO CORRE POR CUENTA DEL CLIENTE.
    </div>

    <div class="important">
      Importante → Debe presentar obligatoriamente la cédula o pasaporte de todos los pasajeros.<br/>
      Para los menores de edad el acta de nacimiento.
    </div>

    <div class="deposit">Es posible que el hotel exija un depósito reembolsable por habitación.</div>
    <div class="closing">¡QUE TENGA UNA EXCELENTE ESTADÍA! BENDICIONES.</div>
  </div>
</body>
</html>
`)
}

export function generateProformaHTML(data: ProformaData): string {
  const currentDate = new Date()
  const clientId = Math.floor(Math.random() * 9000) + 1000
  const reservaId = Math.floor(Math.random() * 9000) + 1000
  const facturaId = Math.floor(Math.random() * 9000) + 1000

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Proforma - Aventuras Turísticas con Ellibry</title>
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

        /* Page 2 - Proforma Content */
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
      <!-- Page 2: Proforma Content -->
      <div class="page proforma-page">
        <div class="page-number">Page 1 of 2</div>
        <div class="confirmation-badge">CONFIRMACIÓN DE SERVICIOS</div>
        <div class="header-logo"></div>

        <div class="content-section">
          <div class="info-row">
            <div class="client-info">
              <div class="section-title">Información de cliente</div>
              <div class="info-line">
                <span class="info-label">ID CLIENTE:</span> ${clientId}
              </div>
              <div class="info-line">
                <span class="info-label">NOMBRE:</span> ${data.cliente.nombre}
              </div>
              <div class="info-line">
                <span class="info-label">CÉDULA/RNC:</span> N/A
              </div>
              <div class="info-line">
                <span class="info-label">EMAIL:</span> ${data.cliente.email}
              </div>
              <div class="info-line">
                <span class="info-label">WHATAPP:</span> ${data.cliente.telefono}
              </div>
            </div>
            
            <div class="reservation-info">
              <div class="section-title">Información de la reserva</div>
              <div class="info-line">
                <span class="info-label">SERVICIO:</span> ${data.items[0]?.descripcion || "Servicio turístico"}
              </div>
              <div class="info-line">
                <span class="info-label">CHECK IN:</span> ${currentDate.toLocaleDateString("es-DO")}
              </div>
              <div class="info-line">
                <span class="info-label">CHECK OUT:</span> ${new Date(currentDate.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("es-DO")}
              </div>
              <div class="info-line">
                <span class="info-label">HORA ENTRADA:</span> 03:00 PM
              </div>
              <div class="info-line">
                <span class="info-label">HORA SALIDA:</span> 12:00 PM
              </div>
              <div class="info-line">
                <span class="info-label">FECHA RESERVA:</span> ${currentDate.toLocaleDateString("es-DO")}
              </div>
              <div class="info-line">
                <span class="info-label">ID RESERVA:</span> ${reservaId}
              </div>
              <div class="info-line">
                <span class="info-label">FACTURA #:</span> ${facturaId}
              </div>
              <div class="info-line">
                <span class="info-label">PASAJEROS:</span> ${data.items[0]?.cantidad || 1}
              </div>
              <div class="info-line">
                <span class="info-label">HABITACIONES:</span> 1
              </div>
            </div>
          </div>

          <div class="observations">
            <div class="observations-title">Observaciones:</div>
            <div class="observations-content">Aquí se coloca cualquier información importante</div>
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
              ${data.items
                .map(
                  (item) => `
                <tr>
                  <td>
                    ${item.descripcion.toUpperCase()}<br>
                    <small>TITULAR: ${data.cliente.nombre.toUpperCase()}</small>
                  </td>
                  <td>${new Intl.NumberFormat("es-DO", {
                    style: "currency",
                    currency: data.moneda,
                  }).format(item.precio)}</td>
                  <td>${new Intl.NumberFormat("es-DO", {
                    style: "currency",
                    currency: data.moneda,
                  }).format(item.precio - item.total)}</td>
                  <td>${new Intl.NumberFormat("es-DO", {
                    style: "currency",
                    currency: data.moneda,
                  }).format(item.total)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          <div class="totals-section">
            <div class="totals-row">
              <span class="totals-label">SUB_TOTAL:</span><span class="totals-value">${new Intl.NumberFormat("es-DO", {
                style: "currency",
                currency: data.moneda,
              }).format(data.subtotal)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">DESC_TOTAL:</span><span class="totals-value">${new Intl.NumberFormat("es-DO", {
                style: "currency",
                currency: data.moneda,
              }).format(data.subtotal - data.total + data.impuestos)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">TOTAL:</span><span class="totals-value">${new Intl.NumberFormat("es-DO", {
                style: "currency",
                currency: data.moneda,
              }).format(data.total)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label balance-paid">MONTO PAGADO:</span><span class="totals-value balance-paid">0.00</span>
            </div>
            <div class="totals-row">
              <span class="totals-label balance-pending">BALANCE RESERVA:</span><span class="totals-value balance-pending">${new Intl.NumberFormat(
                "es-DO",
                {
                  style: "currency",
                  currency: data.moneda,
                },
              ).format(data.total)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label balance-general">BALANCE GENERAL RD $</span><span class="totals-value balance-general">${
                data.moneda === "DOP"
                  ? new Intl.NumberFormat("es-DO", {
                      style: "currency",
                      currency: "DOP",
                    }).format(data.total)
                  : new Intl.NumberFormat("es-DO", {
                      style: "currency",
                      currency: "DOP",
                    }).format(data.total * 58)
              }</span>
            </div>
            <div class="totals-row">
              <span class="totals-label balance-general">BALANCE GENERAL US $</span><span class="totals-value balance-general">${
                data.moneda === "USD"
                  ? new Intl.NumberFormat("es-DO", {
                      style: "currency",
                      currency: "USD",
                    }).format(data.total)
                  : "0.00"
              }</span>
            </div>
          </div>

          <div class="policies-section">
            <div class="policies-title">Políticas de cancelación, pagos, penalidades</div>
            <div class="policy-text">
              <strong>Fecha límite de pago:</strong><br>
              (La fecha que se cancela la reserva automáticamente)
            </div>
            <div class="policy-text">
              De no realizarse el pago en esta fecha al día siguiente entra en gastos 100% o se cancela automáticamente.
            </div>
            <div class="warning-text">
              No somos responsables de no realizar pagos a tiempo y la reserva sea cancelada antes que entre en penalidad 100%, de entrar en penalidad la agencia debe cubrir el gasto.
            </div>
          </div>

          <div class="passengers-section">
            <div class="passengers-title">Información de los pasajeros:</div>
            <div class="passenger-line">1)</div>
          </div>

          <div class="footer-section">
            <div class="thank-you">MUCHAS GRACIAS POR CONFIAR EN NUESTROS SERVICIOS.</div>
            <div class="attended-by">
              <strong>Atendido por:</strong> <span class="attended-name">Bryan Méndez</span>
            </div>
            <div class="attended-by">
              <strong>Referido por:</strong> <span class="attended-name">ATEB</span>
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

        <div class="office-visit">
          <div class="office-title">También puede pasar por nuestra oficina, debe avisar antes de ir:</div>
          <div class="office-address">
            <strong>Dirección:</strong> Calle Juan Alejandro Ibarra #39, Piso 3, Local 305, Ensanche La Fe, Santo Domingo,<br>
            Distrito Nacional, Rep. Dom.
          </div>
        </div>

        <div class="contact-footer">
          <div class="contact-logo"></div>
          <div>
            <strong>Dirección:</strong> Calle Juan Alejandro Ibarra # 39, 3er Piso, Local 305, Ensanche La Fe, D.N. Sto. Dgo.<br>
            <strong>Contactos:</strong> 809•992•3548 • 829•633•3548 • 829•769•6781 / <strong>Email:</strong> informacion@aventurasturisticasconellibry.com<br>
            <strong>RNC:</strong> 132739622 / <strong>Instagram:</strong> @aventurasturisticasconellibry / <strong>Pag. Web:</strong> aventurasturisticasconellibry.com
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * generateConfirmacionHTML — CONFIRMACIÓN DE SERVICIOS, rendered ONLY from the
 * validated `ConfirmacionData` contract (lib/confirmacion-data.ts, Task T5,
 * approved). Task T6, docs/plans/geb-documents-real-data.md.
 *
 * WHY THIS IS A NEW FUNCTION AND generateProformaHTML ABOVE IS UNTOUCHED
 * (T3 AC-4's pre-authorised split fallback — this is the fallback firing):
 * generateProformaHTML is consumed TODAY by the live `/facturacion/proforma`
 * route (shipped in the F1-F5 merge) and is pinned byte-for-byte by
 * `tests/proforma-snapshot.test.ts` (T3) for a fixed `ProformaData` fixture.
 * `ProformaData` and `ConfirmacionData` are structurally incompatible —
 * different field names, different shapes (`items[]` vs `lineas[]`,
 * `cliente.telefono` vs `whatsapp`, no `moneda`, etc.) — so there is no way
 * to repoint `generateProformaHTML` at `ConfirmacionData` and still produce
 * byte-identical output against the committed baseline; the two contracts
 * do not even share an id space (compare the baseline's random
 * `ID CLIENTE: 1900` against a real `ConfirmacionData.idCliente`). Rather
 * than edit the baseline (forbidden by T3 AC-4) or silently regress the live
 * route, `generateProformaHTML` is left byte-for-byte unchanged above, and
 * this new function carries every fix. `app/facturacion/proforma/page.tsx`
 * is repointed at `generateConfirmacionHTML` in T8 (out of this task's file
 * scope: lib/document-generator.tsx only).
 *
 * BLOCK-NEVER-DEFAULT (mistakes/stockin-zero-price): every fabrication listed
 * in docs/plans/geb-documents-real-data.md §0 is deleted here — no
 * `Math.random()`, no `new Date()` standing in for a real date, no hardcoded
 * "N/A"/"1"/name/FX-multiplier. `buildConfirmacionData` (T5) has already
 * proven every REQUIRED field present before this function ever runs, so
 * there is no `||`/`??` fallback anywhere below for a required field —
 * `observaciones` and `referidoPor` are the only optional fields (T5 AC-4)
 * and both already default to `""` inside the builder, never here.
 * `facturaNumero` (HC-2 REVISED) is ALSO optional, but is represented as
 * `string | null`, not `""` — see the FACTURA # decision comment right
 * before this function's `return renderHtml(html\`...` below.
 *
 * MONEY FORMATTING NOTE (flagged for T10's full fidelity walk): the source
 * .docx's DETALLE/SUB_TOTAL/DESC_TOTAL/TOTAL/MONTO PAGADO/BALANCE RESERVA
 * cells are plain thousands-separated numbers with NO currency symbol (e.g.
 * "1,370.00") — the "US $100.00" text visible near the top DETALLE row is
 * part of that line's free-text description ("...POR PERSONA Y POR NOCHE"),
 * not a formatted PRECIO/DESC/TOTAL cell. `ConfirmacionData` also carries no
 * `moneda` field for these rows (BALANCE GENERAL RD $ / US $ are already
 * currency-bucketed by the T4 helpers into separate fields), so a
 * currency-styled `Intl.NumberFormat` would require inventing a currency
 * code — exactly the class of fabrication this task removes. `fmtMonto`
 * below renders plain formatted numbers instead, matching the .docx.
 */
export function generateConfirmacionHTML(data: ConfirmacionData): string {
  const MESES_ES = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
  ]

  // "YYYY-MM-DD" (or any Date-parseable) ConfirmacionData date string ->
  // the source .docx's "17-ABRIL-2025" shape. checkIn/checkOut/fechaReserva
  // are REQUIRED and already validated non-blank by buildConfirmacionData —
  // no fallback here for a malformed value; that would be an upstream defect.
  const fmtFecha = (iso: string): string => {
    const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`)
    return `${String(d.getDate()).padStart(2, "0")}-${MESES_ES[d.getMonth()]}-${d.getFullYear()}`
  }

  // "HH:MM"[:SS] 24h ConfirmacionData time string -> the .docx's "03:00 PM"
  // 12h shape. horaEntrada/horaSalida are REQUIRED and already validated.
  const fmtHora = (hora: string): string => {
    const [hStr, mStr] = hora.split(":")
    const h24 = Number.parseInt(hStr, 10)
    const suffix = h24 >= 12 ? "PM" : "AM"
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${String(h12).padStart(2, "0")}:${mStr.padStart(2, "0")} ${suffix}`
  }

  // Plain thousands-separated 2-decimal number, no currency symbol — see the
  // MONEY FORMATTING NOTE in this function's header comment.
  const fmtMonto = (n: number): string =>
    new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  // "1) 2) 3)…" by orden (T6 AC-4) — zero rows renders the section with no
  // lines and no invented placeholder (no fake "1)", no "Bryan Méndez").
  const pasajerosOrdenados = [...data.pasajeros].sort((a, b) => a.orden - b.orden)

  // HC-2 REVISED (CONFIRMACIÓN — make FACTURA # OPTIONAL, reproduce-and-flag):
  // DECISION — keep the "FACTURA #:" labelled row below; render an EMPTY
  // value when `data.facturaNumero` is `null`, never omit the row and never
  // substitute a placeholder ("N/A"/"-"/"PENDIENTE"/a date). Reasoning:
  //  1. docs/CONFIRMACION GEB.docx shows "FACTURA #: 3598" as a plain inline
  //     "LABEL: value" on the SAME line as every other field in this exact
  //     block — the source document carries no conditional markup to compare
  //     the empty case against (it is a single filled-in sample), so the
  //     structural shape (label always present) is what's reproduced.
  //  2. This mirrors this document's own established precedent for its only
  //     other optional fields, `observaciones`/`referidoPor` (T5): the label
  //     stays, the value renders blank.
  // `${data.facturaNumero}` below is interpolated through the `html` tag,
  // whose `escapeHtmlText` (lib/html-escape.ts) already renders `null` as
  // `""` — no `||`/`??` fallback is added here.
  return renderHtml(html`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmación de Servicios - Reserva ${data.idReserva}</title>
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
                <span class="info-label">ID CLIENTE:</span> ${data.idCliente}
              </div>
              <div class="info-line">
                <span class="info-label">NOMBRE:</span> ${data.nombre}
              </div>
              <div class="info-line">
                <span class="info-label">CEDULA/RNC:</span> ${data.cedulaRnc}
              </div>
              <div class="info-line">
                <span class="info-label">EMAIL:</span> ${data.email}
              </div>
              <div class="info-line">
                <span class="info-label">WHATAPP:</span> ${data.whatsapp}
              </div>
            </div>

            <div class="reservation-info">
              <div class="section-title">Información de la reserva</div>
              <div class="info-line">
                <span class="info-label">SERVICIO:</span> ${data.servicio}
              </div>
              <div class="info-line">
                <span class="info-label">CHECK IN:</span> ${fmtFecha(data.checkIn)}
              </div>
              <div class="info-line">
                <span class="info-label">CHECK OUT:</span> ${fmtFecha(data.checkOut)}
              </div>
              <div class="info-line">
                <span class="info-label">HORA ENTRADA:</span> ${fmtHora(data.horaEntrada)}
              </div>
              <div class="info-line">
                <span class="info-label">HORA SALIDA:</span> ${fmtHora(data.horaSalida)}
              </div>
              <div class="info-line">
                <span class="info-label">FECHA RESERVA:</span> ${fmtFecha(data.fechaReserva)}
              </div>
              <div class="info-line">
                <span class="info-label">ID RESERVA:</span> ${data.idReserva}
              </div>
              <div class="info-line">
                <span class="info-label">FACTURA #:</span> ${data.facturaNumero}
              </div>
              <div class="info-line">
                <span class="info-label">PASAJEROS:</span> ${data.pasajerosCount}
              </div>
              <div class="info-line">
                <span class="info-label">HABITACIONES:</span> ${data.habitacionesCount}
              </div>
            </div>
          </div>

          <div class="observations">
            <div class="observations-title">Observaciones:</div>
            <div class="observations-content">${data.observaciones}</div>
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
              ${data.lineas.map(
                (linea) => html`
                <tr>
                  <td>
                    ${linea.descripcion.toUpperCase()}
                  </td>
                  <td>${fmtMonto(linea.precioUnitario)}</td>
                  <td>${fmtMonto(linea.descuento)}</td>
                  <td>${fmtMonto(linea.total)}</td>
                </tr>
              `,
              )}
            </tbody>
          </table>

          <div class="totals-section">
            <div class="totals-row">
              <span class="totals-label">SUB_TOTAL:</span><span class="totals-value">${fmtMonto(data.subTotal)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">DESC_TOTAL:</span><span class="totals-value">${fmtMonto(data.descTotal)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">TOTAL:</span><span class="totals-value">${fmtMonto(data.total)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label balance-paid">MONTO PAGADO:</span><span class="totals-value balance-paid">${fmtMonto(data.montoPagado)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label balance-pending">BALANCE RESERVA:</span><span class="totals-value balance-pending">${fmtMonto(data.balanceReserva)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label balance-general">BALANCE GENERAL EN RD $</span><span class="totals-value balance-general">${fmtMonto(data.balanceGeneralDOP)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label balance-general">BALANCE GENERAL EN US $</span><span class="totals-value balance-general">${fmtMonto(data.balanceGeneralUSD)}</span>
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
            ${pasajerosOrdenados.map((p, i) => html`<div class="passenger-line">${i + 1}) ${p.nombreCompleto}</div>`)}
          </div>

          <div class="footer-section">
            <div class="thank-you">MUCHAS GRACIAS POR CONFIAR EN NUESTROS SERVICIOS.</div>
            <div class="attended-by">
              <strong>Atendido por:</strong> <span class="attended-name">${data.atendidoPor}</span>
            </div>
            <div class="attended-by">
              <strong>Referido por:</strong> <span class="attended-name">${data.referidoPor}</span>
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
  `)
}

export function generateReciboHTML(data: ReciboData): string {
  return renderHtml(html`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recibo de Pago - ${data.pago.id}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .recibo {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #16a34a;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo {
          width: 120px;
          height: auto;
          margin-bottom: 10px;
        }
        .company-info {
          color: #666;
          font-size: 12px;
        }
        .recibo-title {
          font-size: 24px;
          font-weight: bold;
          color: #16a34a;
          margin: 20px 0;
        }
        .recibo-number {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }
        .info-section {
          margin-bottom: 20px;
        }
        .info-title {
          font-size: 16px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 5px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 5px 0;
        }
        .info-label {
          font-weight: bold;
          color: #374151;
        }
        .info-value {
          color: #6b7280;
        }
        .amount-section {
          background: #f0fdf4;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin: 20px 0;
          border: 2px solid #16a34a;
        }
        .amount-label {
          font-size: 16px;
          color: #374151;
          margin-bottom: 10px;
        }
        .amount-value {
          font-size: 28px;
          font-weight: bold;
          color: #16a34a;
        }
        .payment-method {
          background: #eff6ff;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #2563eb;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
        .print-button {
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin: 20px 0;
        }
        @media print {
          body { background: white; }
          .recibo { box-shadow: none; }
          .print-button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="recibo">
        <div class="header">
          <img src="/images/ellibry-logo.png" alt="Ellibry Logo" class="logo">
          <div class="company-info">
            <div><strong>${data.empresa.nombre}</strong></div>
            <div>${data.empresa.direccion}</div>
            <div>Tel: ${data.empresa.telefono} | Email: ${data.empresa.email}</div>
          </div>
          <div class="recibo-title">RECIBO DE PAGO</div>
          <div class="recibo-number">No. ${data.pago.id}</div>
        </div>

        <div class="info-section">
          <div class="info-title">Información del Cliente</div>
          <div class="info-row">
            <span class="info-label">Nombre:</span>
            <span class="info-value">${data.cliente.nombre}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Identificación:</span>
            <span class="info-value">${data.cliente.identificacion}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${data.cliente.email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span class="info-value">${data.cliente.telefono}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Dirección:</span>
            <span class="info-value">${data.cliente.direccion}</span>
          </div>
        </div>

        <div class="info-section">
          <div class="info-title">Detalles de la Reserva</div>
          <div class="info-row">
            <span class="info-label">Número de Reserva:</span>
            <span class="info-value">${data.reserva.numero}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Código de Reserva:</span>
            <span class="info-value">${data.reserva.codigo}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Servicio:</span>
            <span class="info-value">${data.reserva.servicio}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total de la Reserva:</span>
            <span class="info-value">${new Intl.NumberFormat("es-DO", {
              style: "currency",
              currency: data.pago.moneda,
            }).format(data.reserva.total)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Abonado:</span>
            <span class="info-value">${new Intl.NumberFormat("es-DO", {
              style: "currency",
              currency: data.pago.moneda,
            }).format(data.reserva.totalAbonado)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Saldo Pendiente:</span>
            <span class="info-value">${new Intl.NumberFormat("es-DO", {
              style: "currency",
              currency: data.pago.moneda,
            }).format(data.reserva.saldoPendiente)}</span>
          </div>
        </div>

        <div class="amount-section">
          <div class="amount-label">Monto Pagado</div>
          <div class="amount-value">
            ${new Intl.NumberFormat("es-DO", {
              style: "currency",
              currency: data.pago.moneda,
            }).format(data.pago.monto)}
          </div>
        </div>

        <div class="payment-method">
          <div class="info-row">
            <span class="info-label">Concepto:</span>
            <span class="info-value">${data.pago.concepto}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Método de Pago:</span>
            <span class="info-value">${data.pago.metodo}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Referencia:</span>
            <span class="info-value">${data.pago.referencia}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Fecha de Pago:</span>
            <span class="info-value">${data.pago.fecha}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Atendido por:</span>
            <span class="info-value">${data.pago.registradoPor}</span>
          </div>
        </div>

        <button class="print-button" onclick="window.print()">Imprimir Recibo</button>

        <div class="footer">
          <p><strong>¡Gracias por su pago!</strong></p>
          <p>Este recibo es válido como comprobante de pago.</p>
          <p>Para cualquier consulta, contacte con nosotros.</p>
          <p>Generado el ${new Date().toLocaleDateString("es-DO")}</p>
        </div>
      </div>
    </body>
    </html>
  `)
}

export function openDocumentInNewWindow(htmlContent: string, title = "Documento"): void {
  const newWindow = window.open("", "_blank")
  if (newWindow) {
    newWindow.document.write(htmlContent)
    newWindow.document.close()
    newWindow.document.title = title

    // Focus the new window
    newWindow.focus()

    // Optional: Auto-print after a short delay
    setTimeout(() => {
      newWindow.print()
    }, 500)
  } else {
    // Fallback if popup is blocked
    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${title}.html`
    link.click()
    URL.revokeObjectURL(url)
  }
}
