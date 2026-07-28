/**
 * lib/confirmacion-data.ts
 *
 * `ConfirmacionData` contract + validating builder for CONFIRMACIÓN DE
 * SERVICIOS (docs/plans/geb-documents-real-data.md, Task T5).
 *
 * PURE, OFFLINE-TESTABLE (patterns/port-and-in-memory-fake): this module has
 * ZERO Supabase imports (grep-verifiable — see the acceptance criteria in
 * T5). `buildConfirmacionData` takes plain data objects and returns either a
 * fully-populated `ConfirmacionData` or a list of NAMED missing fields. It
 * never fetches anything and never writes anything — data fetching is the
 * caller's job (T7/T8), and the HC-3 discrepancy-log WRITE lives in
 * `registrarDiscrepanciaTotalesAction` (app/actions/documentos-actions.ts),
 * not here. Detection and persistence are deliberately split so this module
 * never needs a live database to be tested.
 *
 * BLOCK-NEVER-DEFAULT (mistakes/stockin-zero-price) is the core discipline
 * of this file: a missing required field returns `{ ok: false, missing }`
 * and — critically — NO `data` object at all. There is no code path that can
 * produce a partially-filled `ConfirmacionData` with a defaulted `0`,
 * `"N/A"`, `"1"`, today's date, or a random number standing in for a real
 * value, because `data` is only ever constructed AFTER every required field
 * has already been proven present. All missing fields are collected before
 * returning (never short-circuited on the first one), so an operator learns
 * everything wrong in a single pass.
 *
 * Field presence is checked with `Number.isFinite` / a non-blank-string test
 * — NEVER a truthy check — so a genuinely-zero `pasajerosCount`,
 * `habitacionesCount`, or `cliente.id` of `0` is treated as PRESENT, not as
 * missing. A truthy/falsy check here would be the exact "falsy-0" variant of
 * mistakes/stockin-zero-price this whole sprint exists to remove.
 *
 * HC-2 REVISED (CONFIRMACIÓN — make FACTURA # OPTIONAL): the original HC-2
 * ruling required `facturaNumero` and blocked when absent. That ruling was
 * correct GIVEN its premise — the premise (a per-reserva client-invoice
 * number exists somewhere and the lookup was merely unverified) turned out
 * to be false: `comprobantes_fiscales` is a supplier-invoice table with no
 * `reserva_id`/`numero_factura`, and no client-invoice table exists anywhere
 * in this database. Blocking forever on a field with no possible source is
 * not a safeguard, so the human explicitly ruled "make factura # optional
 * for now." `facturaNumero` is now OPTIONAL and nullable — absent is
 * REPRESENTED (`null`), never smuggled in as `""` or a placeholder. This
 * does NOT touch how the number is obtained: `getFacturaNumeroPorReservaAction`
 * (T7) still returns two distinct discriminated failure reasons
 * (SIN_COMPROBANTE vs LOOKUP_FAILED) and the caller (T8) still decides what,
 * if anything, to surface to the operator — this builder only knows "was a
 * facturaNumero string supplied or not".
 *
 * HC-3 (ruled): when `|Σ reserva_detalles.total − reservas.precio_total| >
 * 0.01`, this module does NOT block, does NOT emit a warning into the
 * document, and does NOT write anything — it returns `{ ok: true, data,
 * discrepancia }`, where `discrepancia` is a plain detection payload for the
 * CALLER to hand to `registrarDiscrepanciaTotalesAction`.
 */

import {
  calcularMontoPagado,
  calcularBalanceReserva,
  calcularBalanceGeneralPorMoneda,
  type ReservaBalanceInput,
} from "./finance"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TipoPaxConfirmacion = "ADULTO" | "NINO" | "INFANTE"

export interface PasajeroConfirmacion {
  orden: number
  nombreCompleto: string
  tipoPax: TipoPaxConfirmacion
  documento?: string | null
}

/** One rendered DETALLE row: DETALLE | PRECIO | DESC | TOTAL. */
export interface ConfirmacionLinea {
  descripcion: string
  precioUnitario: number
  descuento: number
  total: number
}

/** The full, validated data contract CONFIRMACIÓN DE SERVICIOS renders from. */
export interface ConfirmacionData {
  idCliente: number
  nombre: string
  cedulaRnc: string
  email: string
  whatsapp: string
  servicio: string
  checkIn: string
  checkOut: string
  horaEntrada: string
  horaSalida: string
  fechaReserva: string
  idReserva: number
  /**
   * OPTIONAL (HC-2 REVISED, see module doc): `null` means "no client invoice
   * exists for this reserva" — a NORMAL state in this deployment, not an
   * error. Explicitly nullable so "absent" is representable in the contract
   * rather than smuggled in as `""`. Never populated with a placeholder.
   */
  facturaNumero: string | null
  pasajerosCount: number
  habitacionesCount: number
  observaciones: string
  lineas: ConfirmacionLinea[]
  subTotal: number
  descTotal: number
  total: number
  montoPagado: number
  balanceReserva: number
  balanceGeneralDOP: number
  balanceGeneralUSD: number
  pasajeros: PasajeroConfirmacion[]
  atendidoPor: string
  referidoPor: string
}

/**
 * HC-3 pure DETECTION payload. Persistence (the `auditoria` write) happens in
 * `registrarDiscrepanciaTotalesAction` (app/actions/documentos-actions.ts),
 * never here.
 */
export interface DiscrepanciaTotales {
  reservaId: number
  clienteId: number
  sumaDetalles: number
  precioTotal: number
  delta: number
  moneda: string
}

export interface ClienteInput {
  id: number | null | undefined
  nombre?: string | null
  cedulaRnc?: string | null
  email?: string | null
  whatsapp?: string | null
}

export interface ProductoInput {
  nombre?: string | null
}

/** Mirrors reserva_detalles' shape — see scripts/023. */
export interface ReservaDetalleInput {
  concepto?: string | null
  descripcion?: string | null
  precioUnitario?: number | null
  descuento?: number | null
  total?: number | null
}

export interface ReservaInput {
  id: number | null | undefined
  fechaEntrada?: string | null
  fechaSalida?: string | null
  horaEntrada?: string | null
  horaSalida?: string | null
  fechaReserva?: string | null
  /** reservas.precio_total — trigger-owned (scripts/023). Read-only, never written here. */
  precioTotal: number
  /** NULL means "not supplied"; treated as 0 only in arithmetic, per app/clientes/balance/page.tsx:77. */
  abonadoContabilidad?: number | null
  moneda?: string | null
  pasajerosCount?: number | null
  habitacionesCount?: number | null
  observaciones?: string | null
  atendidoPor?: string | null
  referidoPor?: string | null
}

export interface BuildConfirmacionDataInput {
  cliente: ClienteInput | null | undefined
  producto: ProductoInput | null | undefined
  reserva: ReservaInput
  /**
   * From T7's getFacturaNumeroPorReservaAction. OPTIONAL (HC-2 REVISED): no
   * per-reserva client-invoice source exists in this database, so an absent/
   * blank value is a normal, non-blocking state — see the module doc.
   */
  facturaNumero?: string | null
  lineas: ReservaDetalleInput[] | null | undefined
  /**
   * The passenger list for THIS reserva (from T2's getPasajerosReservaAction).
   * `undefined`/`null` means "never fetched" and BLOCKS; an explicit `[]`
   * means "genuinely zero passengers" and is permitted (renders an empty
   * section — see §7 of the plan).
   */
  pasajeros: PasajeroConfirmacion[] | null | undefined
  /** Payments against THIS reserva — feeds MONTO PAGADO / BALANCE RESERVA. */
  pagosReserva: number[]
  /**
   * ALL of this client's reservas (their own precioTotal/abonadoContabilidad/
   * pagos/moneda) — feeds BALANCE GENERAL RD$/US$ via
   * calcularBalanceGeneralPorMoneda, exactly like
   * app/clientes/balance/page.tsx:75-90. Must include THIS reserva if it
   * should count toward the client's balance general.
   */
  reservasParaBalanceGeneral: ReservaBalanceInput[]
}

export type BuildConfirmacionDataResult =
  | { ok: true; data: ConfirmacionData; discrepancia?: DiscrepanciaTotales }
  | { ok: false; missing: string[] }

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — never truthy checks (see module doc: block-never-default)
// ─────────────────────────────────────────────────────────────────────────────

/** `|Σdetalles − precio_total| > 0.01` per §4.3/§9 HC-3, verbatim. */
const DISCREPANCIA_EPSILON = 0.01

function esTextoValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0
}

function esNumeroValido(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor)
}

// ─────────────────────────────────────────────────────────────────────────────
// The validating builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildConfirmacionData(input: BuildConfirmacionDataInput): BuildConfirmacionDataResult {
  const missing: string[] = []
  const { cliente, producto, reserva, lineas, pasajeros } = input

  // ---- Cliente ----
  if (!cliente) {
    missing.push("ID CLIENTE", "NOMBRE", "CEDULA/RNC", "EMAIL", "WHATSAPP")
  } else {
    if (!esNumeroValido(cliente.id)) missing.push("ID CLIENTE")
    if (!esTextoValido(cliente.nombre)) missing.push("NOMBRE")
    if (!esTextoValido(cliente.cedulaRnc)) missing.push("CEDULA/RNC")
    if (!esTextoValido(cliente.email)) missing.push("EMAIL")
    if (!esTextoValido(cliente.whatsapp)) missing.push("WHATSAPP")
  }

  // ---- Producto / servicio ----
  if (!producto || !esTextoValido(producto.nombre)) {
    missing.push("SERVICIO")
  }

  // ---- Reserva header fields ----
  if (!esNumeroValido(reserva.id)) missing.push("ID RESERVA")
  if (!esTextoValido(reserva.fechaEntrada)) missing.push("CHECK IN")
  if (!esTextoValido(reserva.fechaSalida)) missing.push("CHECK OUT")

  if (esTextoValido(reserva.fechaEntrada) && esTextoValido(reserva.fechaSalida)) {
    const entrada = new Date(reserva.fechaEntrada as string).getTime()
    const salida = new Date(reserva.fechaSalida as string).getTime()
    if (!Number.isNaN(entrada) && !Number.isNaN(salida) && salida <= entrada) {
      missing.push("CHECK OUT (la fecha de salida debe ser posterior a la fecha de entrada)")
    }
  }

  if (!esTextoValido(reserva.horaEntrada)) missing.push("HORA ENTRADA")
  if (!esTextoValido(reserva.horaSalida)) missing.push("HORA SALIDA")
  if (!esTextoValido(reserva.fechaReserva)) missing.push("FECHA RESERVA")
  // FACTURA # is OPTIONAL (HC-2 REVISED, see module doc) — deliberately NOT
  // checked here. No `missing.push("FACTURA #")` exists anywhere in this
  // function.
  if (!esNumeroValido(reserva.pasajerosCount)) missing.push("PASAJEROS")
  if (!esNumeroValido(reserva.habitacionesCount)) missing.push("HABITACIONES")
  if (!esTextoValido(reserva.atendidoPor)) missing.push("ATENDIDO POR")

  // ---- Passenger list: "never fetched" (undefined/null) blocks; an
  // explicit empty array is a genuinely-empty, permitted state (§7). ----
  if (pasajeros === null || pasajeros === undefined) {
    missing.push("PASAJEROS (lista de pasajeros)")
  }

  // ---- DETALLE lines (block-never-default: zero rows blocks) ----
  const lineasSeguras = lineas ?? []
  if (lineasSeguras.length === 0) {
    missing.push("DETALLE (la reserva no tiene líneas de servicio)")
  }

  const lineasValidadas: ConfirmacionLinea[] = []
  lineasSeguras.forEach((linea, index) => {
    const etiqueta = `DETALLE (línea ${index + 1})`
    // Per-line descripcion falls back to concepto ONLY — both blank blocks the line.
    const descripcion = esTextoValido(linea.descripcion) ? (linea.descripcion as string) : linea.concepto

    let lineaValida = true
    if (!esTextoValido(descripcion)) {
      missing.push(`${etiqueta}: descripción`)
      lineaValida = false
    }
    if (!esNumeroValido(linea.precioUnitario)) {
      missing.push(`${etiqueta}: precio`)
      lineaValida = false
    }
    if (!esNumeroValido(linea.descuento)) {
      missing.push(`${etiqueta}: descuento`)
      lineaValida = false
    }
    if (!esNumeroValido(linea.total)) {
      missing.push(`${etiqueta}: total`)
      lineaValida = false
    }

    if (lineaValida) {
      lineasValidadas.push({
        descripcion: descripcion as string,
        precioUnitario: linea.precioUnitario as number,
        descuento: linea.descuento as number,
        total: linea.total as number,
      })
    }
  })

  if (missing.length > 0) {
    return { ok: false, missing }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Every required field is present past this point. Build `data` — the
  // ONLY place ConfirmacionData is constructed, so a blocked build can never
  // leak a partially-defaulted object.
  // ─────────────────────────────────────────────────────────────────────────

  // abonado_contabilidad NULL means "not supplied" -> treated as 0 ONLY in
  // the arithmetic (§7 edge case), matching Number(x)||0 on the balance page.
  // This is a decision this builder makes explicitly, not a hidden default:
  // it is never rendered as though it were a supplied value.
  const abonadoContabilidad = esNumeroValido(reserva.abonadoContabilidad)
    ? (reserva.abonadoContabilidad as number)
    : 0
  const pagosReserva = input.pagosReserva ?? []

  const subTotal = lineasValidadas.reduce((acc, l) => acc + l.precioUnitario, 0)
  const descTotal = lineasValidadas.reduce((acc, l) => acc + l.descuento, 0)
  const total = lineasValidadas.reduce((acc, l) => acc + l.total, 0)

  // MONTO PAGADO / BALANCE RESERVA / BALANCE GENERAL come ONLY from
  // lib/finance.ts (T4) — no arithmetic is reimplemented here (grep-verifiable).
  const montoPagado = calcularMontoPagado(abonadoContabilidad, pagosReserva)
  const balanceReserva = calcularBalanceReserva(reserva.precioTotal, abonadoContabilidad, pagosReserva)
  const { DOP: balanceGeneralDOP, USD: balanceGeneralUSD } = calcularBalanceGeneralPorMoneda(
    input.reservasParaBalanceGeneral ?? [],
  )

  const data: ConfirmacionData = {
    idCliente: cliente!.id as number,
    nombre: cliente!.nombre as string,
    cedulaRnc: cliente!.cedulaRnc as string,
    email: cliente!.email as string,
    whatsapp: cliente!.whatsapp as string,
    servicio: producto!.nombre as string,
    checkIn: reserva.fechaEntrada as string,
    checkOut: reserva.fechaSalida as string,
    horaEntrada: reserva.horaEntrada as string,
    horaSalida: reserva.horaSalida as string,
    fechaReserva: reserva.fechaReserva as string,
    idReserva: reserva.id as number,
    // HC-2 REVISED: absent -> `null`, NEVER "N/A"/"-"/PENDIENTE/"" or any
    // other placeholder (block-never-default applies to what IS rendered,
    // not just to whether the build blocks).
    facturaNumero: esTextoValido(input.facturaNumero) ? (input.facturaNumero as string) : null,
    pasajerosCount: reserva.pasajerosCount as number,
    habitacionesCount: reserva.habitacionesCount as number,
    // observaciones and referidoPor are the only OTHER optional fields
    // (AC-4): absent -> "" and the document still builds.
    observaciones: esTextoValido(reserva.observaciones) ? (reserva.observaciones as string) : "",
    lineas: lineasValidadas,
    subTotal,
    descTotal,
    total,
    montoPagado,
    balanceReserva,
    balanceGeneralDOP,
    balanceGeneralUSD,
    pasajeros: pasajeros as PasajeroConfirmacion[],
    atendidoPor: reserva.atendidoPor as string,
    referidoPor: esTextoValido(reserva.referidoPor) ? (reserva.referidoPor as string) : "",
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HC-3: pure DETECTION only. No block, no on-document warning, no write —
  // the caller (T8) is responsible for calling
  // registrarDiscrepanciaTotalesAction when `discrepancia` is present.
  // ─────────────────────────────────────────────────────────────────────────
  const sumaDetalles = total // Σ reserva_detalles.total, verbatim per §4.3
  const precioTotal = reserva.precioTotal
  const delta = sumaDetalles - precioTotal

  if (Math.abs(delta) > DISCREPANCIA_EPSILON) {
    const discrepancia: DiscrepanciaTotales = {
      reservaId: reserva.id as number,
      clienteId: cliente!.id as number,
      sumaDetalles,
      precioTotal,
      delta,
      moneda: esTextoValido(reserva.moneda) ? (reserva.moneda as string) : "DOP",
    }
    return { ok: true, data, discrepancia }
  }

  return { ok: true, data }
}
