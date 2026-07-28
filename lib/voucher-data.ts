/**
 * lib/voucher-data.ts
 *
 * `VoucherDocData` contract + validating builder for the hotel/supplier-
 * facing VOUCHER (docs/plans/geb-documents-real-data.md, Task T13, spec B3).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS: THE VOUCHER CARRIES ZERO MONEY.
 * ═══════════════════════════════════════════════════════════════════════════
 * `docs/VOUCHER GEB-2.docx` has NO prices, NO totals, NO balances, NO
 * currency amounts anywhere. It is a document the PASSENGER carries to the
 * HOTEL/SUPPLIER — never the client's money summary (that is
 * `ConfirmacionData` / `lib/confirmacion-data.ts`, which DOES carry money).
 * These two contracts must never cross.
 *
 * B3, verbatim: "the VoucherDocData type must STRUCTURALLY OMIT every money
 * field so a price leak into the hotel-facing document is a COMPILE ERROR,
 * not a review catch." `VoucherDocData` (and every type nested inside it —
 * `OcupacionVoucher`, `PasajeroVoucher`) has NO `total`, `precio`, `monto`,
 * `subtotal`, `moneda`, `tarifa`, or `costo` field, and none can be added to
 * an object literal typed as one of these without TypeScript's excess-
 * property check rejecting it (`tests/voucher-data.test.ts` proves this at
 * BOTH the root level and one level down, inside `ocupaciones[]` and
 * `pasajeros[]` — a money field smuggled onto a room line or a passenger
 * defeats the guarantee exactly as completely as one at the root).
 *
 * PURE, OFFLINE-TESTABLE (patterns/port-and-in-memory-fake): ZERO Supabase
 * imports, ZERO env vars. `buildVoucherData` takes plain data objects and
 * returns either a fully-populated `VoucherDocData` or a list of NAMED
 * missing fields — never a partially-defaulted object (mistakes/stockin-
 * zero-price). All missing fields are collected before returning (never
 * short-circuited on the first one), so an agent learns everything wrong in
 * one pass, exactly like `lib/confirmacion-data.ts` (T5).
 *
 * HC-5 INHERITANCE — VALUES ARE RAW. This module carries UNESCAPED domain
 * values, on purpose. Escaping is a property of the RENDERER
 * (`lib/html-escape.ts`'s `html` tag, applied in T14's `generateVoucherHTML`),
 * never of the data — pre-escaping here would poison a transport-agnostic
 * contract (wrong for a PDF text layer, a CSV export, a log line, or an
 * equality assertion) and guarantee double-escaping the first time a value
 * is rendered. This module must NEVER import `lib/html-escape.ts` and never
 * call `.replace` to encode a value — grep-verifiable.
 *
 * HC-4 INHERITANCE (do not re-litigate) — `paxAdultos`/`paxNinos`/
 * `paxInfantes` are aggregate counts DELIBERATELY INDEPENDENT of the named
 * rows in `pasajeros[]`. The source `.docx` shows 25 Ad + 11 Chd + 1 Inf
 * alongside only four named passengers — legitimately independent in this
 * business. This builder does NOT derive one from the other and does NOT
 * validate that they agree.
 *
 * `noches` is ALWAYS COMPUTED from `checkInFecha`/`checkOutFecha` — never a
 * `?? 3` / `|| 3` fallback, which is one of the fabrications this sprint
 * removes (`lib/document-generator.tsx:117`, legacy). Times come from the
 * same `reservas.hora_entrada` / `hora_salida` columns CONFIRMACIÓN uses —
 * never a hardcoded `"03:00 PM"` / `"12:00 PM"` string.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types — the money-free contract (B3)
// ─────────────────────────────────────────────────────────────────────────────

/** One room-occupancy line: "X <cantidad> HABITACIONES OCUPACION <ocupacion> – Categoria: <categoria>". */
export interface OcupacionVoucher {
  orden: number
  cantidad: number
  ocupacion: string
  categoria: string
}

/** One named passenger line in the VOUCHER's PASAJEROS section. */
export interface PasajeroVoucher {
  orden: number
  nombreCompleto: string
}

/**
 * The full, validated, MONEY-FREE data contract the VOUCHER renders from.
 * Every field here — and every field of `OcupacionVoucher`/`PasajeroVoucher`
 * above — is a domain value with no currency amount reachable from it. See
 * the module doc and `tests/voucher-data.test.ts`'s compile trap.
 */
export interface VoucherDocData {
  titular: string
  paxAdultos: number
  paxNinos: number
  paxInfantes: number
  lugar: string
  direccionHotel: string
  telefonoHotel: string
  regimen: string
  ocupaciones: OcupacionVoucher[]
  noches: number
  localizador: string
  pasajeros: PasajeroVoucher[]
  observaciones: string
  checkInFecha: string
  checkInHora: string
  checkOutFecha: string
  checkOutHora: string
}

export type BuildVoucherDataResult = { ok: true; data: VoucherDocData } | { ok: false; missing: string[] }

// ─────────────────────────────────────────────────────────────────────────────
// Builder inputs — raw, nullable/optional (mirrors what the DB actually
// returns: NULL means "not supplied", 0 means "genuinely zero").
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors one row of `reserva_ocupaciones` (scripts/061) — no money column exists there. */
export interface OcupacionVoucherInput {
  orden?: number | null
  cantidad?: number | null
  ocupacion?: string | null
  categoria?: string | null
}

/** Mirrors one row of `reserva_pasajeros` (scripts/061) — only what the VOUCHER needs. */
export interface PasajeroVoucherInput {
  orden?: number | null
  nombreCompleto?: string | null
}

export interface BuildVoucherDataInput {
  /** The reservation's TITULAR (the client/lead passenger's name). */
  titular?: string | null
  /** LUGAR — the hotel/product name. */
  lugar?: string | null
  /** `productos.direccion` (B2 wiring — reached via `productos.suplidor_id`, not a new column). */
  direccionHotel?: string | null
  /** `suplidores.telefono` (B2 wiring). */
  telefonoHotel?: string | null
  /** `reservas.regimen` (T11). */
  regimen?: string | null
  /** `reservas.localizador` (T11) — required in the TYPE; this BUILDER is what blocks (AC-6), so the prep screen can still hold and save an incomplete draft (T15). */
  localizador?: string | null
  /** `reservas.pax_adultos` (T11). `null`/`undefined` = "not supplied" and BLOCKS; `0` is a valid, genuinely-zero count. */
  paxAdultos?: number | null
  /** `reservas.pax_ninos` (T11). Same not-supplied-vs-zero rule as `paxAdultos`. */
  paxNinos?: number | null
  /** `reservas.pax_infantes` (T11). Same not-supplied-vs-zero rule as `paxAdultos`. */
  paxInfantes?: number | null
  /** `reservas.fecha_entrada`-equivalent check-in date; same source CONFIRMACIÓN uses. */
  checkInFecha?: string | null
  /** `reservas.hora_entrada` — never a hardcoded "03:00 PM". */
  checkInHora?: string | null
  /** `reservas.fecha_salida`-equivalent check-out date; same source CONFIRMACIÓN uses. */
  checkOutFecha?: string | null
  /** `reservas.hora_salida` — never a hardcoded "12:00 PM". */
  checkOutHora?: string | null
  /** The ONLY optional field (AC-7). Absent -> renders as "". */
  observaciones?: string | null
  /**
   * The occupancy-group rows for this reserva (T12's `getOcupacionesReservaAction`).
   * `undefined`/`null` means "never fetched" and BLOCKS; an explicit `[]`
   * means "genuinely zero occupancy groups" — also BLOCKS per AC-5 ("zero
   * occupancy groups" is named explicitly as a blocking case, unlike
   * CONFIRMACIÓN's passenger list).
   */
  ocupaciones?: OcupacionVoucherInput[] | null
  /**
   * The named-passenger rows for this reserva (T2's `getPasajerosReservaAction`).
   * `undefined`/`null` means "never fetched" and BLOCKS; an explicit `[]`
   * means "genuinely zero named passengers" and is permitted — mirrors
   * `lib/confirmacion-data.ts`'s treatment of its own `pasajeros` list.
   */
  pasajeros?: PasajeroVoucherInput[] | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — never truthy checks (block-never-default)
// ─────────────────────────────────────────────────────────────────────────────

function esTextoValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0
}

function esNumeroValido(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor)
}

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Computes NOCHES from two ISO-ish date strings. NEVER a fallback constant —
 * returns `null` (rather than 3, rather than 1) when the inputs cannot
 * produce a genuine, positive night count, so the caller can name the
 * problem instead of rendering a fabricated value.
 */
function calcularNoches(checkInFecha: string, checkOutFecha: string): number | null {
  const entrada = new Date(checkInFecha).getTime()
  const salida = new Date(checkOutFecha).getTime()
  if (Number.isNaN(entrada) || Number.isNaN(salida)) return null
  if (salida <= entrada) return null
  return Math.round((salida - entrada) / MILISEGUNDOS_POR_DIA)
}

// ─────────────────────────────────────────────────────────────────────────────
// The validating builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildVoucherData(input: BuildVoucherDataInput): BuildVoucherDataResult {
  const missing: string[] = []

  // ---- Identity / hotel fields ----
  if (!esTextoValido(input.titular)) missing.push("TITULAR")
  if (!esTextoValido(input.lugar)) missing.push("LUGAR")
  if (!esTextoValido(input.direccionHotel)) missing.push("DIRECCIÓN (productos.direccion)")
  if (!esTextoValido(input.telefonoHotel)) missing.push("TELEFONO (suplidores.telefono)")
  if (!esTextoValido(input.regimen)) missing.push("REGIMEN")
  if (!esTextoValido(input.localizador)) missing.push("LOCALIZADOR")

  // ---- Pax counts: presence checked with Number.isFinite, NEVER truthy —
  // a genuinely-zero paxNinos/paxInfantes/paxAdultos must be treated as
  // PRESENT, not as missing (mistakes/stockin-zero-price, the falsy-0 variant).
  //
  // NEGATIVE pax is a SEPARATE failure from "not supplied" and gets a
  // DISTINCT message (`... (no puede ser negativo)`) so an agent/reviewer
  // reading `missing` is sent to the right fix: "PAX ADULTOS" means the
  // field was never populated; "PAX ADULTOS (no puede ser negativo)" means
  // it WAS populated with an impossible headcount. A fabricated "-5 Ad"
  // must never reach the hotel-facing document.
  //
  // Deliberately NOT the same rule as occupancy's `grupo.cantidad <= 0`
  // (line ~252): a room-count of 0 is meaningless (an occupancy group with
  // zero rooms describes nothing), so cantidad blocks at <= 0. A pax count
  // of 0 is a legitimate, real-world fact ("zero children on this
  // booking"), so pax only blocks on < 0, never on === 0. ----
  if (!esNumeroValido(input.paxAdultos)) {
    missing.push("PAX ADULTOS")
  } else if ((input.paxAdultos as number) < 0) {
    missing.push("PAX ADULTOS (no puede ser negativo)")
  }
  if (!esNumeroValido(input.paxNinos)) {
    missing.push("PAX NINOS")
  } else if ((input.paxNinos as number) < 0) {
    missing.push("PAX NINOS (no puede ser negativo)")
  }
  if (!esNumeroValido(input.paxInfantes)) {
    missing.push("PAX INFANTES")
  } else if ((input.paxInfantes as number) < 0) {
    missing.push("PAX INFANTES (no puede ser negativo)")
  }

  // ---- Dates / horas ----
  if (!esTextoValido(input.checkInFecha)) missing.push("CHECK IN (fecha)")
  if (!esTextoValido(input.checkOutFecha)) missing.push("CHECK OUT (fecha)")
  if (!esTextoValido(input.checkInHora)) missing.push("HORA ENTRADA")
  if (!esTextoValido(input.checkOutHora)) missing.push("HORA SALIDA")

  let noches: number | null = null
  if (esTextoValido(input.checkInFecha) && esTextoValido(input.checkOutFecha)) {
    noches = calcularNoches(input.checkInFecha, input.checkOutFecha)
    if (noches === null) {
      missing.push("CHECK OUT (la fecha de salida debe ser posterior a la fecha de entrada)")
    }
  }

  // ---- Occupancy groups: "never fetched" (undefined/null) blocks; an
  // explicit EMPTY array also blocks — "zero occupancy groups" is named
  // explicitly as a required-to-block case (AC-5), unlike CONFIRMACIÓN's
  // passenger list, which permits a genuine empty array. ----
  const ocupacionesInput = input.ocupaciones
  if (ocupacionesInput === null || ocupacionesInput === undefined) {
    missing.push("OCUPACIONES (grupos de habitación no fueron cargados)")
  } else if (ocupacionesInput.length === 0) {
    missing.push("OCUPACIONES (la reserva no tiene grupos de ocupación)")
  }

  const ocupacionesValidadas: OcupacionVoucher[] = []
  ;(ocupacionesInput ?? []).forEach((grupo, index) => {
    const etiqueta = `OCUPACIONES (grupo ${index + 1})`
    let grupoValido = true
    if (!esNumeroValido(grupo.orden)) {
      missing.push(`${etiqueta}: orden`)
      grupoValido = false
    }
    if (!esNumeroValido(grupo.cantidad) || (grupo.cantidad as number) <= 0) {
      missing.push(`${etiqueta}: cantidad`)
      grupoValido = false
    }
    if (!esTextoValido(grupo.ocupacion)) {
      missing.push(`${etiqueta}: ocupacion`)
      grupoValido = false
    }
    if (!esTextoValido(grupo.categoria)) {
      missing.push(`${etiqueta}: categoria`)
      grupoValido = false
    }
    if (grupoValido) {
      ocupacionesValidadas.push({
        orden: grupo.orden as number,
        cantidad: grupo.cantidad as number,
        ocupacion: grupo.ocupacion as string,
        categoria: grupo.categoria as string,
      })
    }
  })

  // ---- Named passengers: "never fetched" (undefined/null) blocks; an
  // explicit EMPTY array is a genuinely-empty, permitted state — mirrors
  // lib/confirmacion-data.ts's own pasajeros treatment. Independent of the
  // pax_* aggregate counts above (HC-4 ruling: never derive one from the
  // other, never validate they agree). ----
  const pasajerosInput = input.pasajeros
  if (pasajerosInput === null || pasajerosInput === undefined) {
    missing.push("PASAJEROS (lista de pasajeros no fue cargada)")
  }

  const pasajerosValidados: PasajeroVoucher[] = []
  ;(pasajerosInput ?? []).forEach((pasajero, index) => {
    const etiqueta = `PASAJEROS (pasajero ${index + 1})`
    let pasajeroValido = true
    if (!esNumeroValido(pasajero.orden)) {
      missing.push(`${etiqueta}: orden`)
      pasajeroValido = false
    }
    if (!esTextoValido(pasajero.nombreCompleto)) {
      missing.push(`${etiqueta}: nombreCompleto`)
      pasajeroValido = false
    }
    if (pasajeroValido) {
      pasajerosValidados.push({
        orden: pasajero.orden as number,
        // RAW value — never escaped here (HC-5 inheritance). Escaping
        // happens only at T14's render seam via lib/html-escape.ts's `html`
        // tag, never in this builder.
        nombreCompleto: pasajero.nombreCompleto as string,
      })
    }
  })

  if (missing.length > 0) {
    return { ok: false, missing }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Every required field is present past this point. Build `data` — the
  // ONLY place VoucherDocData is constructed, so a blocked build can never
  // leak a partially-defaulted object. No field below is ever escaped —
  // values are carried RAW, exactly as supplied (HC-5 inheritance).
  // ─────────────────────────────────────────────────────────────────────────

  const data: VoucherDocData = {
    titular: input.titular as string,
    paxAdultos: input.paxAdultos as number,
    paxNinos: input.paxNinos as number,
    paxInfantes: input.paxInfantes as number,
    lugar: input.lugar as string,
    direccionHotel: input.direccionHotel as string,
    telefonoHotel: input.telefonoHotel as string,
    regimen: input.regimen as string,
    ocupaciones: ocupacionesValidadas,
    noches: noches as number,
    localizador: input.localizador as string,
    pasajeros: pasajerosValidados,
    // observaciones is the ONLY optional field (AC-7): absent -> "".
    observaciones: esTextoValido(input.observaciones) ? (input.observaciones as string) : "",
    checkInFecha: input.checkInFecha as string,
    checkInHora: input.checkInHora as string,
    checkOutFecha: input.checkOutFecha as string,
    checkOutHora: input.checkOutHora as string,
  }

  return { ok: true, data }
}
