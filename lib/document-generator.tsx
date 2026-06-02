export interface VoucherData {
  cliente: {
    nombre: string
    email: string
    telefono: string
    direccion: string
  }
  reserva: {
    numero: string
    fecha: string
    servicio: string
    total: number
    moneda: string
  }
  empresa: {
    nombre: string
    direccion: string
    telefono: string
    email: string
  }
}

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
  }
  pago: {
    id: string
    monto: number
    metodo: string
    referencia: string
    fecha: string
    moneda: string
  }
  reserva: {
    numero: string
    servicio: string
    total: number
  }
  empresa: {
    nombre: string
    direccion: string
    telefono: string
    email: string
  }
}

export function generateVoucherHTML(data: VoucherData): string {
  const localizador = Math.floor(Math.random() * 90000) + 10000

  // Format helpers
  const MONTHS_ES = [
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
  const parseDate = (v: string) => {
    const d = new Date(v)
    return isNaN(+d) ? new Date() : d
  }
  const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}-${MONTHS_ES[d.getMonth()]}-${d.getFullYear()}`
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: data.reserva.moneda || "USD" }).format(n)

  // Dates
  const checkIn = parseDate(data.reserva.fecha)
  const noches = 3 // <-- change if needed
  const checkOut = new Date(checkIn.getTime() + noches * 24 * 60 * 60 * 1000)

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Voucher - ${data.reserva.numero}</title>
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
          <img src="/images/ellibry-logo.png" alt="${data.empresa.nombre}">
        </div>
        <div class="voucher-badge">VOUCHER # ${data.reserva.numero}</div>
      </div>
    </div>

    <div class="titular"><b>TITULAR:</b> ${data.cliente.nombre.toUpperCase()}</div>

    <div class="lugar">
      <div class="cell-left">LUGAR:</div>
      <div class="cell-right">${data.reserva.servicio.toUpperCase()}</div>
    </div>

    <div class="details">
      <div class="row">
        <div class="lbl">DIRECCIÓN:</div>
        <div class="val">${data.cliente.direccion}</div>
      </div>
      <div class="row">
        <div class="lbl">TELÉFONO:</div>
        <div class="val">${data.empresa.telefono}</div>
      </div>
      <div class="row">
        <div class="lbl">SERVICIOS:</div>
        <div class="val">
          - ALOJAMIENTO - TODO INCLUIDO
          <div class="services-list">
            <div>- SERVICIO CONTRATADO: ${data.reserva.servicio}</div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="lbl">NOCHES:</div>
        <div class="val">${noches}</div>
      </div>
      <div class="row">
        <div class="lbl">TOTAL:</div>
        <div class="val">${fmtMoney(data.reserva.total)}</div>
      </div>
    </div>

    <div class="localizador">LOCALIZADOR: ${localizador}</div>

    <div class="details">
      <div class="row">
        <div class="lbl">OBSERVACIONES</div>
        <div class="val"></div>
      </div>
      <div class="row">
        <div class="lbl">PASAJEROS</div>
        <div class="val">
          <div>1) ${data.cliente.nombre}</div>
          <div>2) Acompañante</div>
        </div>
      </div>
    </div>

    <div class="ribbon">
      <div class="ribbon-title">CHECK IN:</div>
      <div>${fmtDate(checkIn)} 03:00 PM – Posible cargo adicional por llegada previa.</div>
    </div>

    <div class="ribbon">
      <div class="ribbon-title">CHECK OUT:</div>
      <div>${fmtDate(checkOut)} 12:00 PM – Posible cargo adicional por entregar tarde.</div>
    </div>

    <div class="disclaimer">
      ESTA RESERVA ES VÁLIDA POR LOS SERVICIOS MÁS ARRIBA ESPECIFICADOS. CUALQUIER OTRO CARGO CORRE POR CUENTA DEL CLIENTE.
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
`
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

export function generateReciboHTML(data: ReciboData): string {
  return `
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
            <span class="info-label">Email:</span>
            <span class="info-value">${data.cliente.email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span class="info-value">${data.cliente.telefono}</span>
          </div>
        </div>

        <div class="info-section">
          <div class="info-title">Detalles de la Reserva</div>
          <div class="info-row">
            <span class="info-label">Número de Reserva:</span>
            <span class="info-value">${data.reserva.numero}</span>
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
  `
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
