"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { Receipt, ArrowLeft, Printer, Search, Calendar, MapPin, Users, Plane, PlusIcon, X, Download } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { resolverReservaDeepLink } from "@/lib/deep-link-reserva"
import { supabase } from "@/lib/supabase"
import { generateVoucherDocHTML, openDocumentInNewWindow } from "@/lib/document-generator"
import {
  buildVoucherData,
  type BuildVoucherDataInput,
  type OcupacionVoucherInput,
  type PasajeroVoucherInput,
  type VoucherDocData,
} from "@/lib/voucher-data"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/user-context"
import {
  getPasajerosReservaAction,
  guardarPasajerosReservaAction,
  getOcupacionesReservaAction,
  guardarOcupacionesReservaAction,
  getDatosVoucherReservaAction,
  guardarDatosVoucherReservaAction,
  getDetallesReservaParaVoucherAction,
  type PasajeroInput,
  type OcupacionInput,
  type TipoPax,
  type DatosVoucherReserva,
  type DetalleReservaParaVoucher,
} from "@/app/actions/documentos-actions"

/**
 * T15 (docs/plans/geb-documents-real-data.md) — this page now wires the
 * VOUCHER to real, persisted data end to end:
 *   - `localizador`/`regimen`/`pax_adultos`/`pax_ninos`/`pax_infantes` load
 *     from and save to `reservas` (T11's columns) exclusively through T12's
 *     getDatosVoucherReservaAction/guardarDatosVoucherReservaAction.
 *   - Named passengers load/save through T2's getPasajerosReservaAction /
 *     guardarPasajerosReservaAction — the SAME reserva_pasajeros rows
 *     CONFIRMACIÓN uses (OQ1).
 *   - Room-occupancy groups load/save through T2/T2b's
 *     getOcupacionesReservaAction / guardarOcupacionesReservaAction, whose
 *     success path also rebuilds passenger->room links (HC-4) — this page
 *     surfaces that outcome, never swallowing a `relinked: false`.
 *   - `DIRECCIÓN`/`TELÉFONO` come from the HOTEL PROPERTY itself
 *     (`productos.direccion` / `productos.telefonos_json`) — the
 *     front-desk number(s) a guest calls, not the account manager's phone at
 *     `suplidores.telefono_responsable`. HOTFIX (2026-07-27): a prior sprint
 *     wired this to a `suplidores.telefono` column that never existed in the
 *     schema (see scripts/001-create-tables.sql:21's `telefono_responsable`),
 *     which PostgREST rejected with 42703 on every load, silently emptying
 *     `suplidores` and blocking every voucher. `productos.telefono_contacto`
 *     (scripts/033-add-contact-fields-to-productos.sql:2-4) replaced it next,
 *     but that column turned out to be DEAD — NULL on 100% of production
 *     rows, written by nothing in the app. HOTFIX (2026-07-28):
 *     `productos.telefonos_json` (a JSON array of strings, populated by
 *     app/productos/registrar/page.tsx:220 and app/productos/editar/page.tsx:237,
 *     NOT declared in any scripts/*.sql migration — verify against those app
 *     files, not scripts/) is the real, populated source. Every entry is
 *     joined with ", " — one number prints alone, two or more print together,
 *     duplicates are preserved verbatim (production data, not ours to alter).
 *
 * DELETED (fabrications this task removes, per §0/T15 AC-1/AC-3/AC-4/AC-5):
 *   - `generateVoucherNumber()` — a date+`Math.random()` string regenerated
 *     on every click, never persisted. The real, persisted, agent-typed
 *     `localizador` (T11/T12) replaces it.
 *   - hardcoded `habitacion: "STANDARD"` and `regimen: "TODO INCLUIDO"`.
 *   - fabricated `"cliente@email.com"` / `"Dirección del cliente"`.
 *   - `Math.max(noches, 1)` — `noches` is now a read-only value COMPUTED
 *     from the reserva's real check-in/check-out dates, never clamped or
 *     defaulted (mirrors `lib/voucher-data.ts`'s own `calcularNoches`).
 *
 * BLOCK SEMANTICS (T15 AC-2): this prep screen stays fully usable — every
 * field editable and every section independently savable — while
 * `localizador` is absent, because an agent must be able to fill in rooms,
 * passengers and pax counts BEFORE the hotel replies with a confirmation
 * code. Only "Generar e Imprimir" and "Descargar como PDF" are disabled
 * while the PERSISTED localizador is missing, with a visible reason next to
 * the buttons. `construirVoucherData` below is the single, comprehensive
 * gate both buttons share (T15 AC-8) — it re-reads every persisted source
 * fresh and runs `buildVoucherData` (T13), which blocks on ANY missing
 * required field (not just localizador) and names every one of them at
 * once, never just the first.
 *
 * B3 PROVENANCE (Risk R13, T15 AC-10): the ONLY `VoucherDocData` value this
 * file ever touches is `resultado.data` returned directly from
 * `buildVoucherData()` inside `construirVoucherData` — never a hand-written
 * literal, never a wider `reserva`/`producto` row spread into that slot,
 * never a cast. The `BuildVoucherDataInput` object built just above that
 * call is itself a FRESH literal assembled field-by-field from validated
 * action results and this page's own draft state — never a `...reserva`
 * spread — so no wider-typed value can ride along into a `VoucherDocData`
 * slot undetected (TypeScript's excess-property check only fires on fresh
 * literals, so keeping every source literal, not a spread, is what makes
 * that guarantee real here).
 */

interface Cliente {
  id: number
  nombre_completo?: string
  razon_social?: string
  telefonos?: string
  email?: string
}

interface Producto {
  id: number
  nombre_producto: string
  pais?: string
  direccion?: string
  suplidor_id?: number
  /**
   * `productos.telefonos_json` — the hotel property's own front-desk
   * number(s), as a JSON array of strings. Nullable: the write path
   * (app/productos/registrar/page.tsx:220) stores NULL (not `[]`) when the
   * agent leaves the phone list empty.
   */
  telefonos_json?: string[] | null
}

interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  producto_id: number
  fecha_entrada?: string | null
  fecha_salida?: string | null
  hora_entrada?: string | null
  hora_salida?: string | null
  pasajeros: number
  /**
   * VOUCHER-UX task: `reservas.habitaciones` (scripts/001-create-tables.sql:106,
   * scripts/003-update-tables-fixed.sql:86) exists and is already returned by
   * this page's `select("*")` on `reservas`, but — unlike `pasajeros`, which
   * IS forced `NOT NULL` at scripts/003-update-tables-fixed.sql:107-110 —
   * `habitaciones` gets no such NOT NULL enforcement anywhere in scripts/, so
   * it must stay nullable here. It is also a SUM across every
   * `reserva_detalles` line via the `recalcular_totales_reserva` trigger
   * (scripts/023-create-reserva-detalles-table-fixed.sql:69-85), not a
   * per-occupancy-group count.
   */
  habitaciones?: number | null
  precio_total: number
  status: string
  nota_interna_reserva?: string | null
}

/**
 * The exact column list `fetchReservas` requests from `productos` —
 * pulled into a named, exported constant (mirrors `buildCierreOptimista`'s
 * export pattern in app/crm/casos/page.tsx) so `tests/voucher-page.test.ts`
 * can assert on it directly. HOTFIX (2026-07-28): QA's mutation N2 proved
 * that silently dropping a needed telefono column from this select string
 * reproduces the SAME bug class as the original outage (PostgREST simply
 * returns the row without it — no thrown error, `tsc` stays clean because
 * select strings are untyped) one layer above the bug this hotfix already
 * fixed. This constant is that regression guard's anchor.
 *
 * HOTFIX (2026-07-28, repoint): `telefono_contacto` is GONE from this list.
 * Production-verified: it is NULL on 100% of `productos` rows and nothing in
 * the app ever writes it — a dead column left over from scripts/032/033.
 * `telefonos_json` (populated on all production rows, written by
 * app/productos/registrar/page.tsx:220 / app/productos/editar/page.tsx:237,
 * absent from scripts/) replaces it as the real source.
 */
export const PRODUCTOS_SELECT_COLUMNS = "id, nombre_producto, pais, direccion, suplidor_id, telefonos_json"

/**
 * Derives the VOUCHER's TELEFONO from `productos.telefonos_json` — the
 * hotel PROPERTY's own front-desk number(s) (never `suplidores.telefono`,
 * which never existed, never the supplier account manager's phone, and
 * never the dead `productos.telefono_contacto` column, which is NULL on
 * every production row and unwritten by any app code).
 *
 * `telefonos_json` is a JSON array of strings. Per the human's explicit
 * decision, EVERY entry is printed, joined with ", " — one number prints
 * alone, two print as "A, B", N print as all N. Blank/whitespace-only
 * entries are skipped (so a stray empty slot can't produce a leading,
 * trailing, or doubled separator); if every entry is blank (or the array is
 * empty/absent), this returns `null` so `buildVoucherData`'s `esTextoValido`
 * check BLOCKS the voucher downstream — never a silent "", "N/A", or any
 * other fallback. Duplicate entries are preserved verbatim (this is real
 * production data — the human's data to fix, not ours to silently alter).
 */
export function derivarTelefonoHotel(
  productos: Producto[],
  productoId: number | null | undefined,
): string | null {
  if (productoId === null || productoId === undefined) return null
  const producto = productos.find((p) => p.id === productoId)
  const telefonos = producto?.telefonos_json
  if (!telefonos || telefonos.length === 0) return null
  const telefonosValidos = telefonos
    .map((telefono) => (typeof telefono === "string" ? telefono.trim() : ""))
    .filter((telefono) => telefono.length > 0)
  if (telefonosValidos.length === 0) return null
  return telefonosValidos.join(", ")
}

/**
 * VOUCHER UX task ("surface reserva totals + warn on mismatch"): non-blocking
 * pax cross-check. Returns `true` ONLY when every operand is present
 * (`!= null`, never a falsy check — `0` is a legitimate value for
 * `pax_ninos`/`pax_infantes`, scripts/062-add-voucher-fields-to-reservas.sql:69-71
 * declares them nullable with no default, and `reservas.pasajeros` is itself
 * nullable-in-schema even though a trigger normally populates it) AND their
 * sum differs from `reservas.pasajeros`. A still-blank field (agent typed
 * adultos but not yet ninos) must read as "incomplete", not "mismatch", so
 * ANY null operand short-circuits to `false` here.
 */
export function hayDiscrepanciaPax(
  paxAdultos: number | null | undefined,
  paxNinos: number | null | undefined,
  paxInfantes: number | null | undefined,
  pasajerosReserva: number | null | undefined,
): boolean {
  if (paxAdultos == null || paxNinos == null || paxInfantes == null || pasajerosReserva == null) {
    return false
  }
  return paxAdultos + paxNinos + paxInfantes !== pasajerosReserva
}

/**
 * Sums `cantidad` across the occupancy-group editor rows. Two DISTINCT
 * "unknown" cases, deliberately NOT collapsed into one:
 *  - a genuinely EMPTY list (no groups at all) is a known, real value of
 *    `0` — mirrors this task's "`0` is legitimate, never skipped" rule.
 *  - a list where AT LEAST ONE row has `cantidad: null` (the agent started a
 *    group but hasn't finished typing its count yet) is INCOMPLETE, so the
 *    whole sum is unknown (`null`) — mirrors "partial pax entry is quiet",
 *    applied to occupancy groups: one half-typed row must not manufacture a
 *    misleading total that then falsely compares against the reserva.
 */
export function sumarCantidadOcupaciones(
  ocupaciones: Array<{ cantidad: number | null | undefined }>,
): number | null {
  if (ocupaciones.length === 0) return 0
  let total = 0
  for (const ocupacion of ocupaciones) {
    if (ocupacion.cantidad == null) return null
    total += ocupacion.cantidad
  }
  return total
}

/**
 * Non-blocking room-count cross-check, same guard discipline as
 * `hayDiscrepanciaPax`: ANY null operand (an unfinished occupancy sum, or a
 * reserva with `habitaciones` not set) means "not enough information yet",
 * never a mismatch — guarded with `!= null`, never a falsy check, so `0`
 * habitaciones-entered-so-far still gets compared for real.
 */
export function hayDiscrepanciaHabitaciones(
  sumaCantidadOcupaciones: number | null | undefined,
  habitacionesReserva: number | null | undefined,
): boolean {
  if (sumaCantidadOcupaciones == null || habitacionesReserva == null) {
    return false
  }
  return sumaCantidadOcupaciones !== habitacionesReserva
}

/** One row in the repeatable occupancy-group editor — persists to `reserva_ocupaciones` (T2/T2b). */
interface EditableOcupacion {
  cantidad: number | null
  ocupacion: string
  categoria: string
}

/**
 * VOUCHER PREFILL task (rule 1, non-negotiable): decides whether the
 * `mapearDetallesAOcupaciones` prefill is allowed to run for one reserva,
 * given exactly what `getOcupacionesReservaAction` returned. SAVED
 * OCUPACIONES ALWAYS WIN — this is `true` ONLY when that read SUCCEEDED
 * and came back with ZERO saved rows. Any successful read WITH rows, and
 * any failed read (we don't know if rows exist), must never prefill —
 * silently overwriting a user's saved work would be far worse than a
 * blank field. Extracted as its own pure, exported, node-testable function
 * (same pattern as `hayDiscrepanciaPax` etc. above) specifically so AC-3 —
 * "saved rows always win" — has a real unit test, not just a read of
 * `handleReservaSelect`'s control flow.
 */
export function debePrefillarOcupaciones(ocupacionesResultado: {
  success: boolean
  data?: unknown[] | null
}): boolean {
  // Boolean(...) — not a bare `&&` chain — so this HONESTS its declared
  // `boolean` return type even for a malformed input shape a real caller
  // never produces (e.g. `{ success: undefined }`), which would otherwise
  // fall through as `undefined` instead of `false`. Unreachable in
  // production (TypeScript's own `success: boolean` on the call site's
  // action-result shape rules it out), fixed anyway on lead review.
  return Boolean(ocupacionesResultado.success && (!ocupacionesResultado.data || ocupacionesResultado.data.length === 0))
}

/**
 * VOUCHER PREFILL task: one `reserva_detalles` row -> one occupancy-group
 * editor row, VERBATIM, per the human-specified mapping (correcting the
 * prior task's rejected "don't prefill" decision — see the task's WHY
 * block, not re-argued here):
 *   - cantidad  <- habitaciones (PER LINE — never the reserva-level SUM)
 *   - ocupacion <- concepto, UNPARSED (e.g. "PRUEBA 1 DOBLE" stays exactly
 *     that string — no attempt to extract "DOBLE" out of it)
 *   - categoria <- descripcion, UNPARSED
 *
 * A genuinely empty source STAYS empty: a null/blank `descripcion` maps to
 * `""`, never a substituted `concepto`/placeholder/invented string (this is
 * mistakes/stockin-zero-price — copying a real value is fine, inventing one
 * is not), and a null `habitaciones` maps to `null`, never `0` or `1`.
 *
 * Pure, no I/O — same pattern as `derivarTelefonoHotel`/`hayDiscrepanciaPax`
 * above, node-testable without a DOM or a live Supabase client.
 *
 * EMPTY-LIST DECISION: a reserva with zero `reserva_detalles` rows returns
 * ONE blank row (`{ cantidad: null, ocupacion: "", categoria: "" }`), not
 * `[]`. This mirrors the editor's own reset state set at the top of
 * `handleReservaSelect` (`setOcupacionesEditor([{ cantidad: null, ocupacion:
 * "", categoria: "" }])`) and its "at least one row" UI invariant (the
 * remove button only renders past `ocupacionesEditor.length > 1`) — an
 * empty array here would leave the editor with zero rows and no visible way
 * to add one back other than the existing "Agregar Grupo" button, which is
 * inconsistent with every other empty/no-data state on this page.
 */
export function mapearDetallesAOcupaciones(
  detalles: Array<Pick<DetalleReservaParaVoucher, "concepto" | "descripcion" | "habitaciones">>,
): EditableOcupacion[] {
  if (detalles.length === 0) {
    return [{ cantidad: null, ocupacion: "", categoria: "" }]
  }
  return detalles.map((detalle) => ({
    cantidad: detalle.habitaciones ?? null,
    ocupacion: detalle.concepto ?? "",
    categoria: detalle.descripcion ?? "",
  }))
}

/**
 * VOUCHER PREFILL task (lead send-back, fake-green-tests #11): the ENTIRE
 * decision of what to seed the occupancy editor with, given exactly what
 * `getDetallesReservaParaVoucherAction` returned — extracted out of
 * `handleReservaSelect`'s call site for the SAME reason `derivarTelefonoHotel`
 * and `mapearDetallesAOcupaciones` itself were extracted: an untested inline
 * pass-through at the wiring layer (`detallesResultado.data` straight into
 * `mapearDetallesAOcupaciones`) is exactly the shape that let M4 (per-line
 * `habitaciones` silently swapped for the reserva-level SUM) go undetected —
 * 0/140 tests caught it, because every existing test fed
 * `mapearDetallesAOcupaciones` fixtures that were already correct by
 * construction, never exercising the call site itself.
 *
 * Three cases:
 *  - success + data -> `mapearDetallesAOcupaciones(data)` (real prefill rows).
 *  - success + EMPTY data -> delegates to `mapearDetallesAOcupaciones([])`'s
 *    own empty-list decision (one blank row), rather than re-deciding it
 *    here — one empty-list rule, one owner, no risk of the two functions
 *    ever disagreeing on what "no service lines" should render as.
 *  - failure, or a malformed success-without-data shape the action's own
 *    typed return never actually produces -> `null` ("no prefill"). The
 *    caller (still) owns surfacing `detallesResultado.error` in a toast —
 *    that's UI plumbing, not a decision, so it stays inline at the call
 *    site rather than being folded into this pure function's return value.
 */
export function resolverOcupacionesParaPrefill(detallesResultado: {
  success: boolean
  data?: DetalleReservaParaVoucher[] | null
}): EditableOcupacion[] | null {
  if (!detallesResultado.success || !detallesResultado.data) return null
  return mapearDetallesAOcupaciones(detallesResultado.data)
}

/** One row in the named-passenger editor — persists to `reserva_pasajeros` (T2), same table CONFIRMACIÓN uses. */
interface EditablePasajeroVoucher {
  nombreCompleto: string
  tipoPax: TipoPax
  ocupacionId: number | null
}

/**
 * Ephemeral, per-document fields with no dedicated persisted column of
 * their own (mirrors the legacy page's own editable `titular`/`hotel`
 * overrides) plus the T12-backed fields, kept here as the editable draft
 * and synced from `datosVoucherPersistidos` after every load/save.
 */
interface VoucherDraft {
  titular: string
  lugar: string
  localizador: string
  regimen: string
  paxAdultos: number | null
  paxNinos: number | null
  paxInfantes: number | null
  observaciones: string
}

const REGIMEN_OPCIONES = [
  { value: "TODO INCLUIDO", label: "Todo Incluido" },
  { value: "MEDIA PENSION", label: "Media Pensión" },
  { value: "PENSION COMPLETA", label: "Pensión Completa" },
  { value: "SOLO ALOJAMIENTO", label: "Solo Alojamiento" },
  { value: "DESAYUNO", label: "Desayuno" },
]

function VoucherPageInner() {
  const searchParams = useSearchParams()
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  // Starts TRUE: fetchReservas runs on mount and always resolves it in its
  // `finally`. If it started false, the deep-link effect below would observe
  // `loading === false` with `reservas === []` on the very first render and
  // report a perfectly valid id as "no encontrada".
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [voucherDraft, setVoucherDraft] = useState<VoucherDraft>({
    titular: "",
    lugar: "",
    localizador: "",
    regimen: "",
    paxAdultos: null,
    paxNinos: null,
    paxInfantes: null,
    observaciones: "",
  })

  // The last-known PERSISTED datos-voucher row (T12) — used ONLY to gate the
  // Generar/Descargar buttons (T15 AC-2), never mutated by keystrokes in
  // voucherDraft, so an unsaved edit can never look like a persisted
  // localizador.
  const [datosVoucherPersistidos, setDatosVoucherPersistidos] = useState<DatosVoucherReserva | null>(null)

  const [ocupacionesEditor, setOcupacionesEditor] = useState<EditableOcupacion[]>([
    { cantidad: null, ocupacion: "", categoria: "" },
  ])
  const [pasajerosEditor, setPasajerosEditor] = useState<EditablePasajeroVoucher[]>([
    { nombreCompleto: "", tipoPax: "ADULTO", ocupacionId: null },
  ])

  const { toast } = useToast()
  const { user } = useUser()

  useEffect(() => {
    fetchReservas()
  }, [])

  const fetchReservas = async () => {
    try {
      setLoading(true)

      const { data: reservasData, error: reservasError } = await supabase
        .from("reservas")
        .select("*")
        .order("fecha_creado", { ascending: false })

      if (reservasError) {
        console.error("Error fetching reservas:", reservasError)
        setReservas([])
        return
      }

      setReservas(reservasData || [])

      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("id, nombre_completo, razon_social, telefonos, email")

      if (clientesError) {
        console.error("Error fetching clientes:", clientesError)
        // HOTFIX (2026-07-27): a swallowed load error here used to surface,
        // hours later, as an unexplainable "TITULAR" block on every
        // voucher — never as its real cause. Surface it immediately instead.
        toast({
          title: "No se pudieron cargar los clientes",
          description: clientesError.message,
          variant: "destructive",
        })
      } else {
        setClientes(clientesData || [])
      }

      const { data: productosData, error: productosError } = await supabase
        .from("productos")
        .select(PRODUCTOS_SELECT_COLUMNS)

      if (productosError) {
        console.error("Error fetching productos:", productosError)
        // HOTFIX (2026-07-27): this is the exact bug this hotfix fixes — a
        // swallowed error here (previously on a nonexistent
        // `suplidores.telefono` column) presented as an unexplainable
        // "DIRECCIÓN"/"TELEFONO" block on every voucher instead of naming
        // the real, fixable cause. Never swallow this again.
        toast({
          title: "No se pudieron cargar los productos",
          description: productosError.message,
          variant: "destructive",
        })
      } else {
        setProductos(productosData || [])
      }
    } catch (error) {
      console.error("Error in fetchReservas:", error)
      setReservas([])
    } finally {
      setLoading(false)
    }
  }

  /**
   * DISPLAY-ONLY helpers for the browsable reserva list/search — mirrors
   * app/facturacion/proforma/page.tsx's getClienteData/getProductoData.
   * `construirVoucherData` below looks up the raw rows independently and
   * lets `buildVoucherData` (T13) BLOCK when a field is genuinely absent —
   * these placeholders never feed the generated document.
   */
  const getClienteData = (clienteId: number) => {
    const cliente = clientes.find((c) => c.id === clienteId)
    return {
      nombre: cliente?.nombre_completo || cliente?.razon_social || "Cliente no encontrado",
    }
  }

  const getProductoData = (productoId: number) => {
    const producto = productos.find((p) => p.id === productoId)
    return {
      nombre_producto: producto?.nombre_producto || "Producto no encontrado",
      pais: producto?.pais || "",
    }
  }

  const filteredReservas = reservas.filter((reserva) => {
    const clienteNombre = getClienteData(reserva.cliente_id).nombre
    const productoNombre = getProductoData(reserva.producto_id).nombre_producto

    return (
      reserva.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      productoNombre.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  /** Read-only, derived from the reserva's real check-in/check-out dates — never a `?? 3`/`|| 3` fallback (T15 AC-5). */
  const calcularNochesDisplay = (reserva: Reserva | null): number | null => {
    if (!reserva?.fecha_entrada || !reserva?.fecha_salida) return null
    const entrada = new Date(reserva.fecha_entrada).getTime()
    const salida = new Date(reserva.fecha_salida).getTime()
    if (Number.isNaN(entrada) || Number.isNaN(salida) || salida <= entrada) return null
    return Math.round((salida - entrada) / (1000 * 60 * 60 * 24))
  }

  const handleReservaSelect = async (reserva: Reserva) => {
    setSelectedReserva(reserva)

    const clienteNombre = getClienteData(reserva.cliente_id).nombre
    const productoNombre = getProductoData(reserva.producto_id).nombre_producto

    setVoucherDraft({
      titular: clienteNombre === "Cliente no encontrado" ? "" : clienteNombre,
      lugar: productoNombre === "Producto no encontrado" ? "" : productoNombre,
      localizador: "",
      regimen: "",
      paxAdultos: null,
      paxNinos: null,
      paxInfantes: null,
      observaciones: reserva.nota_interna_reserva || "",
    })
    setDatosVoucherPersistidos(null)
    setOcupacionesEditor([{ cantidad: null, ocupacion: "", categoria: "" }])
    setPasajerosEditor([{ nombreCompleto: "", tipoPax: "ADULTO", ocupacionId: null }])

    const [datosResultado, pasajerosResultado, ocupacionesResultado, detallesResultado] = await Promise.all([
      getDatosVoucherReservaAction(reserva.id),
      getPasajerosReservaAction(reserva.id, "VOUCHER"),
      getOcupacionesReservaAction(reserva.id),
      getDetallesReservaParaVoucherAction(reserva.id),
    ])

    if (datosResultado.success && datosResultado.data) {
      const datos = datosResultado.data
      setDatosVoucherPersistidos(datos)
      setVoucherDraft((prev) => ({
        ...prev,
        localizador: datos.localizador ?? "",
        regimen: datos.regimen ?? "",
        paxAdultos: datos.pax_adultos,
        paxNinos: datos.pax_ninos,
        paxInfantes: datos.pax_infantes,
      }))
    } else if (!datosResultado.success) {
      toast({
        title: "No se pudieron cargar los datos del voucher",
        description: datosResultado.error,
        variant: "destructive",
      })
    }

    if (pasajerosResultado.success && pasajerosResultado.data && pasajerosResultado.data.length > 0) {
      setPasajerosEditor(
        pasajerosResultado.data.map((p: any) => ({
          nombreCompleto: p.nombre_completo,
          tipoPax: p.tipo_pax,
          ocupacionId: p.ocupacion_id ?? null,
        })),
      )
    } else if (!pasajerosResultado.success) {
      toast({
        title: "No se pudo cargar la lista de pasajeros",
        description: pasajerosResultado.error,
        variant: "destructive",
      })
    }

    if (ocupacionesResultado.success && ocupacionesResultado.data && ocupacionesResultado.data.length > 0) {
      setOcupacionesEditor(
        ocupacionesResultado.data.map((o: any) => ({
          cantidad: o.cantidad,
          ocupacion: o.ocupacion,
          categoria: o.categoria,
        })),
      )
    } else if (!ocupacionesResultado.success) {
      toast({
        title: "No se pudieron cargar los grupos de ocupación",
        description: ocupacionesResultado.error,
        variant: "destructive",
      })
    } else if (debePrefillarOcupaciones(ocupacionesResultado)) {
      // VOUCHER PREFILL task: this branch runs ONLY when
      // getOcupacionesReservaAction came back successful with ZERO saved
      // rows for this reserva — i.e. nothing has ever been saved to
      // `reserva_ocupaciones` for it. Saved ocupaciones ALWAYS win; this
      // must never run alongside or after the success-with-data branch
      // above, and never overwrite it (debePrefillarOcupaciones is the
      // single source of truth for that guard). The mapping/empty-list
      // DECISION itself lives entirely inside the tested, exported
      // resolverOcupacionesParaPrefill — nothing untested is left inline
      // here beyond surfacing detallesResultado.error in a toast.
      const ocupacionesPrefill = resolverOcupacionesParaPrefill(detallesResultado)
      if (ocupacionesPrefill) {
        setOcupacionesEditor(ocupacionesPrefill)
      } else if (!detallesResultado.success) {
        toast({
          title: "No se pudieron cargar las líneas de servicio de la reserva",
          description: detallesResultado.error,
          variant: "destructive",
        })
      }
    }
  }

  /**
   * Deep link from /reservas/ver/[id] and /reservas/pendientes:
   * `?reserva_id=<reservas.id>` selects that reserva through the EXISTING
   * handleReservaSelect and filters the list to its `codigo`. No selection,
   * prefill, LOCALIZADOR gating or validation logic is duplicated here.
   *
   * Runs once: the ref latch is set BEFORE the call, and the effect
   * early-returns while `loading`, so `productos`/`clientes` have committed
   * before handleReservaSelect reads them via getProductoData (otherwise
   * `lugar` would silently prefill blank).
   */
  const deepLinkAplicado = useRef(false)

  useEffect(() => {
    if (loading || deepLinkAplicado.current) return

    const resultado = resolverReservaDeepLink(searchParams.get("reserva_id"), reservas)
    if (resultado.estado === "sin-param") return

    deepLinkAplicado.current = true

    if (resultado.estado === "no-encontrada") {
      toast({
        title: "Reserva no encontrada",
        description: `No existe una reserva con id ${resultado.param}. Seleccione una de la lista.`,
        variant: "destructive",
      })
      return
    }

    setSearchQuery(resultado.reserva.codigo)
    handleReservaSelect(resultado.reserva)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reservas, searchParams])

  const handleVoucherDraftChange = <K extends keyof VoucherDraft>(field: K, value: VoucherDraft[K]) => {
    setVoucherDraft((prev) => ({ ...prev, [field]: value }))
  }

  /** Blank input -> `null` ("not supplied"), never `0` (block-never-default at the input layer, T15 AC-5). */
  const handlePaxInputChange = (field: "paxAdultos" | "paxNinos" | "paxInfantes", raw: string) => {
    if (raw.trim() === "") {
      handleVoucherDraftChange(field, null)
      return
    }
    const parsed = Number.parseInt(raw, 10)
    handleVoucherDraftChange(field, Number.isNaN(parsed) ? null : parsed)
  }

  /**
   * Persists `localizador`/`regimen`/`pax_adultos`/`pax_ninos`/`pax_infantes`
   * in one call through T12's guardarDatosVoucherReservaAction, then
   * re-reads the persisted row so `datosVoucherPersistidos` (the
   * Generar/Descargar gate) reflects reality, never an assumed echo of what
   * was sent.
   */
  const guardarDatosVoucher = async () => {
    if (!selectedReserva) return

    const resultado = await guardarDatosVoucherReservaAction(selectedReserva.id, {
      localizador: voucherDraft.localizador,
      regimen: voucherDraft.regimen,
      pax_adultos: voucherDraft.paxAdultos,
      pax_ninos: voucherDraft.paxNinos,
      pax_infantes: voucherDraft.paxInfantes,
    })

    if (!resultado.success) {
      toast({
        title: "No se pudieron guardar los datos del voucher",
        description: resultado.error,
        variant: "destructive",
      })
      return
    }

    const recargado = await getDatosVoucherReservaAction(selectedReserva.id)
    if (recargado.success && recargado.data) {
      const datos = recargado.data
      setDatosVoucherPersistidos(datos)
      setVoucherDraft((prev) => ({
        ...prev,
        localizador: datos.localizador ?? "",
        regimen: datos.regimen ?? "",
        paxAdultos: datos.pax_adultos,
        paxNinos: datos.pax_ninos,
        paxInfantes: datos.pax_infantes,
      }))
    }

    toast({
      title: "Datos del voucher guardados",
      description: "Localizador, régimen y ocupación de pasajeros actualizados.",
    })
  }

  const addOcupacionGrupo = () => {
    setOcupacionesEditor((prev) => [...prev, { cantidad: null, ocupacion: "", categoria: "" }])
  }

  const removeOcupacionGrupo = (index: number) => {
    setOcupacionesEditor((prev) => prev.filter((_, i) => i !== index))
  }

  const updateOcupacionGrupo = (index: number, field: keyof EditableOcupacion, value: string | number | null) => {
    setOcupacionesEditor((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)))
  }

  /**
   * Persists the occupancy-group editor to `reserva_ocupaciones`
   * (T2/T2b). HC-4 surface (T15 AC-7): every `success: true` return also
   * carries `relinked`/`enlacesDescartados`/`enlacesNoRestablecidos` — this
   * ALWAYS inspects them and shows a non-blocking warning naming how many
   * passengers need manual re-assignment. A silent `success: true` here
   * would be exactly the send-back HC-4 exists to prevent.
   */
  const guardarOcupaciones = async () => {
    if (!selectedReserva) return

    const ocupacionesInput: OcupacionInput[] = ocupacionesEditor
      .filter((o) => o.ocupacion.trim().length > 0 || o.categoria.trim().length > 0 || (o.cantidad ?? 0) > 0)
      .map((o, index) => ({
        orden: index + 1,
        cantidad: o.cantidad ?? 0,
        ocupacion: o.ocupacion.trim(),
        categoria: o.categoria.trim(),
      }))

    const resultado = await guardarOcupacionesReservaAction(
      selectedReserva.id,
      ocupacionesInput,
      user?.nombre || "Usuario Sistema",
    )

    if (!resultado.success) {
      toast({
        title: "No se pudieron guardar los grupos de ocupación",
        description: (resultado as any).error,
        variant: "destructive",
      })
      return
    }

    const enlacesDescartados: number[] = (resultado as any).enlacesDescartados ?? []
    const enlacesNoRestablecidos: number[] = (resultado as any).enlacesNoRestablecidos ?? []
    const totalAfectados = enlacesDescartados.length + enlacesNoRestablecidos.length

    if (totalAfectados > 0) {
      toast({
        title: "Ocupaciones guardadas — revisar pasajeros",
        description: `${totalAfectados} pasajero(s) quedaron sin habitación asignada tras este cambio y deben reasignarse manualmente.`,
      })
    } else {
      toast({
        title: "Ocupaciones guardadas",
        description: "Los grupos de ocupación fueron actualizados.",
      })
    }

    const recargado = await getOcupacionesReservaAction(selectedReserva.id)
    if (recargado.success && recargado.data && recargado.data.length > 0) {
      setOcupacionesEditor(
        recargado.data.map((o: any) => ({ cantidad: o.cantidad, ocupacion: o.ocupacion, categoria: o.categoria })),
      )
    }
  }

  const addPasajeroVoucher = () => {
    setPasajerosEditor((prev) => [...prev, { nombreCompleto: "", tipoPax: "ADULTO", ocupacionId: null }])
  }

  const removePasajeroVoucher = (index: number) => {
    setPasajerosEditor((prev) => prev.filter((_, i) => i !== index))
  }

  const updatePasajeroVoucherNombre = (index: number, value: string) => {
    setPasajerosEditor((prev) => prev.map((p, i) => (i === index ? { ...p, nombreCompleto: value } : p)))
  }

  const updatePasajeroVoucherTipo = (index: number, value: TipoPax) => {
    setPasajerosEditor((prev) => prev.map((p, i) => (i === index ? { ...p, tipoPax: value } : p)))
  }

  /** Persists the named-passenger editor to `reserva_pasajeros` (T2) — the SAME table CONFIRMACIÓN uses (OQ1, T15 AC-6). */
  const guardarPasajeros = async () => {
    if (!selectedReserva) return

    const pasajerosInput: PasajeroInput[] = pasajerosEditor
      .filter((p) => p.nombreCompleto.trim().length > 0)
      .map((p, index) => ({
        orden: index + 1,
        nombre_completo: p.nombreCompleto.trim(),
        tipo_pax: p.tipoPax,
        ocupacion_id: p.ocupacionId ?? null,
      }))

    const resultado = await guardarPasajerosReservaAction(
      selectedReserva.id,
      pasajerosInput,
      user?.nombre || "Usuario Sistema",
      "VOUCHER",
    )

    if (!resultado.success) {
      toast({
        title: "No se pudieron guardar los pasajeros",
        description: resultado.error,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Pasajeros guardados",
      description: "La lista de pasajeros del voucher fue actualizada.",
    })
  }

  /**
   * The single, comprehensive gate both "Generar e Imprimir" and "Descargar
   * como PDF" share (T15 AC-8/AC-9/AC-10). Re-reads every persisted source
   * FRESH — never trusts an unsaved keystroke sitting in local draft state
   * as if it were real — builds a FRESH `BuildVoucherDataInput` literal, and
   * passes it straight into `buildVoucherData()`. Returns the resulting
   * `VoucherDocData` on success, or `null` after toasting every missing
   * field on a block (never just the first, never a generic message).
   */
  const construirVoucherData = async (reserva: Reserva): Promise<VoucherDocData | null> => {
    const [datosResultado, pasajerosResultado, ocupacionesResultado] = await Promise.all([
      getDatosVoucherReservaAction(reserva.id),
      getPasajerosReservaAction(reserva.id, "VOUCHER"),
      getOcupacionesReservaAction(reserva.id),
    ])

    if (!datosResultado.success || !datosResultado.data) {
      toast({
        title: "No se pudo generar el voucher",
        description: !datosResultado.success ? datosResultado.error : "No se pudieron leer los datos del voucher",
        variant: "destructive",
      })
      return null
    }
    if (!pasajerosResultado.success || !pasajerosResultado.data) {
      toast({
        title: "No se pudo generar el voucher",
        description: !pasajerosResultado.success ? pasajerosResultado.error : "No se pudo leer la lista de pasajeros",
        variant: "destructive",
      })
      return null
    }
    if (!ocupacionesResultado.success || !ocupacionesResultado.data) {
      toast({
        title: "No se pudo generar el voucher",
        description: !ocupacionesResultado.success
          ? ocupacionesResultado.error
          : "No se pudieron leer los grupos de ocupación",
        variant: "destructive",
      })
      return null
    }

    const productoReal = productos.find((p) => p.id === reserva.producto_id)

    // B3 provenance (Risk R13, T15 AC-10): a FRESH object literal, built
    // field-by-field from validated action results and this page's own
    // draft state — never a `...reserva`/`...productoReal` spread, never a
    // cast. This is the ONLY BuildVoucherDataInput constructed in this file.
    const input: BuildVoucherDataInput = {
      titular: voucherDraft.titular,
      lugar: voucherDraft.lugar,
      direccionHotel: productoReal?.direccion ?? null,
      // HOTFIX (2026-07-27/28): the hotel PROPERTY's own front-desk
      // number(s) (`productos.telefonos_json`, joined), not the supplier
      // account manager's phone. Extracted to the exported, regression-
      // tested `derivarTelefonoHotel` (2026-07-28) — see the module doc
      // above and lib/voucher-data.ts.
      telefonoHotel: derivarTelefonoHotel(productos, reserva.producto_id),
      regimen: datosResultado.data.regimen,
      localizador: datosResultado.data.localizador,
      paxAdultos: datosResultado.data.pax_adultos,
      paxNinos: datosResultado.data.pax_ninos,
      paxInfantes: datosResultado.data.pax_infantes,
      checkInFecha: reserva.fecha_entrada ?? null,
      checkInHora: reserva.hora_entrada ?? null,
      checkOutFecha: reserva.fecha_salida ?? null,
      checkOutHora: reserva.hora_salida ?? null,
      observaciones: voucherDraft.observaciones,
      ocupaciones: ocupacionesResultado.data.map((o: any): OcupacionVoucherInput => ({
        orden: o.orden,
        cantidad: o.cantidad,
        ocupacion: o.ocupacion,
        categoria: o.categoria,
      })),
      pasajeros: pasajerosResultado.data.map((p: any): PasajeroVoucherInput => ({
        orden: p.orden,
        nombreCompleto: p.nombre_completo,
      })),
    }

    // The ONLY place this file constructs a VoucherDocData: straight from
    // buildVoucherData()'s own validated return, never widened.
    const resultado = buildVoucherData(input)

    if (!resultado.ok) {
      toast({
        title: "No se puede generar el voucher",
        description: `Faltan los siguientes campos: ${resultado.missing.join(" · ")}`,
        variant: "destructive",
      })
      return null
    }

    return resultado.data
  }

  const generateVoucher = async () => {
    if (!selectedReserva) {
      toast({
        title: "Selecciona una reserva",
        description: "Por favor selecciona una reserva primero.",
        variant: "destructive",
      })
      return
    }

    const data = await construirVoucherData(selectedReserva)
    if (!data) return

    const voucherHTML = generateVoucherDocHTML(data)
    openDocumentInNewWindow(voucherHTML, `Voucher - ${selectedReserva.codigo}`)
  }

  const downloadVoucherAsPDF = async () => {
    if (!selectedReserva) {
      toast({
        title: "Selecciona una reserva",
        description: "Por favor selecciona una reserva primero.",
        variant: "destructive",
      })
      return
    }

    const data = await construirVoucherData(selectedReserva)
    if (!data) return

    const voucherHTML = generateVoucherDocHTML(data)

    // Create a temporary div to render the HTML
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = voucherHTML
    tempDiv.style.position = "absolute"
    tempDiv.style.left = "-9999px"
    tempDiv.style.top = "-9999px"
    tempDiv.style.width = "210mm"
    tempDiv.style.height = "297mm"
    document.body.appendChild(tempDiv)

    try {
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
      })

      const pdf = new jsPDF("p", "mm", "a4")
      const imgData = canvas.toDataURL("image/png")
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297)
      pdf.save(`voucher-${selectedReserva.codigo}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error al generar el PDF",
        description: "Por favor intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      document.body.removeChild(tempDiv)
    }
  }

  // T15 AC-2: the prep screen stays usable while `localizador` is absent —
  // ONLY these two actions are gated, and ONLY on the PERSISTED localizador
  // (never on an unsaved keystroke in voucherDraft.localizador).
  const localizadorPersistidoAusente =
    !datosVoucherPersistidos?.localizador || datosVoucherPersistidos.localizador.trim().length === 0
  const generarDeshabilitado = !selectedReserva || localizadorPersistidoAusente

  const nochesDisplay = calcularNochesDisplay(selectedReserva)

  // VOUCHER UX task: DISPLAY + non-blocking WARN only — never prefilled into
  // any input, never added to `construirVoucherData`'s missing-fields gate.
  const sumaOcupacionesActual = sumarCantidadOcupaciones(ocupacionesEditor)
  const mostrarDiscrepanciaPax = hayDiscrepanciaPax(
    voucherDraft.paxAdultos,
    voucherDraft.paxNinos,
    voucherDraft.paxInfantes,
    selectedReserva?.pasajeros,
  )
  const mostrarDiscrepanciaHabitaciones = hayDiscrepanciaHabitaciones(
    sumaOcupacionesActual,
    selectedReserva?.habitaciones,
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/facturacion">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Facturación
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Receipt className="w-6 h-6" style={{ color: "#3399cc" }} />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                  Voucher GEB
                </h1>
                <p className="text-sm text-gray-500">Generar vouchers de servicios para clientes</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Selección de Reserva */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Seleccionar Reserva
              </CardTitle>
              <CardDescription>Busca y selecciona la reserva para generar el voucher</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="search">Buscar Reserva</Label>
                <Input
                  id="search"
                  placeholder="Buscar por código, cliente o producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Cargando reservas...</p>
                  </div>
                ) : filteredReservas.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No se encontraron reservas</div>
                ) : (
                  filteredReservas.map((reserva) => {
                    const clienteData = getClienteData(reserva.cliente_id)
                    const productoData = getProductoData(reserva.producto_id)
                    return (
                      <div
                        key={reserva.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedReserva?.id === reserva.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => handleReservaSelect(reserva)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{reserva.codigo}</p>
                            <p className="text-sm text-gray-600">{clienteData.nombre}</p>
                            <p className="text-sm text-gray-500">{productoData.nombre_producto}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs">
                              {reserva.status}
                            </Badge>
                            <p className="text-sm font-medium mt-1">${(reserva.precio_total || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Datos del Voucher */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Receipt className="w-5 h-5 mr-2" />
                Datos del Voucher
              </CardTitle>
              <CardDescription>
                {selectedReserva
                  ? "Completa y guarda cada sección. El voucher solo se genera con datos ya guardados."
                  : "Selecciona una reserva para comenzar"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="titular">Titular</Label>
                  <Input
                    id="titular"
                    value={voucherDraft.titular}
                    onChange={(e) => handleVoucherDraftChange("titular", e.target.value)}
                    placeholder="Nombre del titular"
                    disabled={!selectedReserva}
                  />
                </div>
                <div>
                  <Label htmlFor="lugar">Lugar (hotel)</Label>
                  <Input
                    id="lugar"
                    value={voucherDraft.lugar}
                    onChange={(e) => handleVoucherDraftChange("lugar", e.target.value)}
                    placeholder="Nombre del hotel"
                    disabled={!selectedReserva}
                  />
                </div>
              </div>

              <Separator />

              {/* Localizador / Régimen / Pax — persisted to reservas (T11/T12) */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="localizador">Localizador (código del proveedor) *</Label>
                    <Input
                      id="localizador"
                      value={voucherDraft.localizador}
                      onChange={(e) => handleVoucherDraftChange("localizador", e.target.value)}
                      placeholder="Código que envía el hotel/proveedor"
                      disabled={!selectedReserva}
                    />
                  </div>
                  <div>
                    <Label htmlFor="regimen">Régimen</Label>
                    <Select
                      value={voucherDraft.regimen}
                      onValueChange={(value) => handleVoucherDraftChange("regimen", value)}
                      disabled={!selectedReserva}
                    >
                      <SelectTrigger id="regimen">
                        <SelectValue placeholder="Seleccionar régimen" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIMEN_OPCIONES.map((opcion) => (
                          <SelectItem key={opcion.value} value={opcion.value}>
                            {opcion.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="paxAdultos">Adultos</Label>
                    <Input
                      id="paxAdultos"
                      type="number"
                      min="0"
                      value={voucherDraft.paxAdultos ?? ""}
                      onChange={(e) => handlePaxInputChange("paxAdultos", e.target.value)}
                      disabled={!selectedReserva}
                    />
                  </div>
                  <div>
                    <Label htmlFor="paxNinos">Niños</Label>
                    <Input
                      id="paxNinos"
                      type="number"
                      min="0"
                      value={voucherDraft.paxNinos ?? ""}
                      onChange={(e) => handlePaxInputChange("paxNinos", e.target.value)}
                      disabled={!selectedReserva}
                    />
                  </div>
                  <div>
                    <Label htmlFor="paxInfantes">Infantes</Label>
                    <Input
                      id="paxInfantes"
                      type="number"
                      min="0"
                      value={voucherDraft.paxInfantes ?? ""}
                      onChange={(e) => handlePaxInputChange("paxInfantes", e.target.value)}
                      disabled={!selectedReserva}
                    />
                  </div>
                </div>

                {/* VOUCHER UX task: reference readout of the reserva's own totals, next to
                    the inputs — display + warn only, never prefilled into any input. */}
                <p className="text-xs text-muted-foreground">
                  {selectedReserva?.pasajeros != null
                    ? `Pasajeros en la reserva: ${selectedReserva.pasajeros}`
                    : "No definido en la reserva"}
                </p>
                {mostrarDiscrepanciaPax && selectedReserva && (
                  <p className="text-xs text-amber-600">
                    La suma de adultos + niños + infantes (
                    {(voucherDraft.paxAdultos ?? 0) + (voucherDraft.paxNinos ?? 0) + (voucherDraft.paxInfantes ?? 0)})
                    no coincide con los pasajeros de la reserva ({selectedReserva.pasajeros}).
                  </p>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={guardarDatosVoucher}
                  disabled={!selectedReserva}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Guardar Localizador / Régimen / Pax
                </Button>
              </div>

              <Separator />

              {/* Check-in / Check-out — read-only, same reservas.fecha_entrada/hora_entrada/fecha_salida/hora_salida CONFIRMACIÓN uses */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Check-in</Label>
                  <p className="text-sm mt-2">
                    {selectedReserva?.fecha_entrada
                      ? `${selectedReserva.fecha_entrada}${selectedReserva.hora_entrada ? ` ${selectedReserva.hora_entrada}` : ""}`
                      : "No definido en la reserva"}
                  </p>
                </div>
                <div>
                  <Label>Check-out</Label>
                  <p className="text-sm mt-2">
                    {selectedReserva?.fecha_salida
                      ? `${selectedReserva.fecha_salida}${selectedReserva.hora_salida ? ` ${selectedReserva.hora_salida}` : ""}`
                      : "No definido en la reserva"}
                  </p>
                </div>
                <div>
                  <Label>Noches (calculado)</Label>
                  <p className="text-sm mt-2">{nochesDisplay !== null ? nochesDisplay : "—"}</p>
                </div>
              </div>

              <Separator />

              {/* Grupos de Ocupación (habitaciones) — reserva_ocupaciones (T2/T2b) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label>Grupos de Ocupación (habitaciones)</Label>
                    {/* VOUCHER UX task: reference readout of the reserva's own
                        habitaciones total, next to the editor — display + warn only. */}
                    <p className="text-xs text-muted-foreground">
                      {selectedReserva?.habitaciones != null
                        ? `Habitaciones en la reserva: ${selectedReserva.habitaciones}`
                        : "No definido en la reserva"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOcupacionGrupo}
                    disabled={!selectedReserva}
                  >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Agregar Grupo
                  </Button>
                </div>
                {mostrarDiscrepanciaHabitaciones && selectedReserva && (
                  <p className="text-xs text-amber-600 mb-2">
                    La suma de las cantidades ({sumaOcupacionesActual}) no coincide con las habitaciones de la
                    reserva ({selectedReserva.habitaciones}).
                  </p>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {ocupacionesEditor.map((grupo, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        className="w-20"
                        placeholder="Cant."
                        value={grupo.cantidad ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw.trim() === "") {
                            updateOcupacionGrupo(index, "cantidad", null)
                            return
                          }
                          const parsed = Number.parseInt(raw, 10)
                          updateOcupacionGrupo(index, "cantidad", Number.isNaN(parsed) ? null : parsed)
                        }}
                        disabled={!selectedReserva}
                      />
                      <Input
                        placeholder="Ocupación (ej. DOBLE)"
                        value={grupo.ocupacion}
                        onChange={(e) => updateOcupacionGrupo(index, "ocupacion", e.target.value)}
                        className="flex-1"
                        disabled={!selectedReserva}
                      />
                      <Input
                        placeholder="Categoría (ej. Junior Suite)"
                        value={grupo.categoria}
                        onChange={(e) => updateOcupacionGrupo(index, "categoria", e.target.value)}
                        className="flex-1"
                        disabled={!selectedReserva}
                      />
                      {ocupacionesEditor.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOcupacionGrupo(index)}
                          disabled={!selectedReserva}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={guardarOcupaciones}
                  disabled={!selectedReserva}
                  className="mt-2 bg-blue-600 hover:bg-blue-700"
                >
                  Guardar Ocupaciones
                </Button>
              </div>

              <Separator />

              {/* Lista de Pasajeros — reserva_pasajeros (T2), same table CONFIRMACIÓN uses */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Pasajeros</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPasajeroVoucher}
                    disabled={!selectedReserva}
                  >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pasajerosEditor.map((pasajero, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm font-medium w-8">{index + 1})</span>
                      <Input
                        value={pasajero.nombreCompleto}
                        onChange={(e) => updatePasajeroVoucherNombre(index, e.target.value)}
                        placeholder="Nombre del pasajero"
                        className="flex-1"
                        disabled={!selectedReserva}
                      />
                      <Select
                        value={pasajero.tipoPax}
                        onValueChange={(value) => updatePasajeroVoucherTipo(index, value as TipoPax)}
                        disabled={!selectedReserva}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADULTO">Adulto</SelectItem>
                          <SelectItem value="NINO">Niño</SelectItem>
                          <SelectItem value="INFANTE">Infante</SelectItem>
                        </SelectContent>
                      </Select>
                      {pasajerosEditor.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removePasajeroVoucher(index)}
                          disabled={!selectedReserva}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={guardarPasajeros}
                  disabled={!selectedReserva}
                  className="mt-2 bg-blue-600 hover:bg-blue-700"
                >
                  Guardar Pasajeros
                </Button>
              </div>

              {/* Observaciones — free text for THIS document only, not persisted */}
              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={voucherDraft.observaciones}
                  onChange={(e) => handleVoucherDraftChange("observaciones", e.target.value)}
                  placeholder="Notas especiales o instrucciones adicionales..."
                  rows={3}
                  disabled={!selectedReserva}
                />
              </div>

              <Separator />

              {/* Botones de Generar — bloqueados mientras el LOCALIZADOR persistido esté ausente (T15 AC-2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={generateVoucher}
                  disabled={generarDeshabilitado}
                  className="w-full"
                  style={{ backgroundColor: "#3399cc" }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Generar e Imprimir Voucher
                </Button>
                <Button
                  onClick={downloadVoucherAsPDF}
                  disabled={generarDeshabilitado}
                  variant="outline"
                  className="w-full bg-transparent"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar como PDF
                </Button>
              </div>
              {selectedReserva && localizadorPersistidoAusente && (
                <p className="text-sm text-red-600">
                  Guarda un LOCALIZADOR (código del proveedor) antes de generar o descargar el voucher. El resto de
                  esta pantalla puede completarse y guardarse mientras tanto.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Información de la Reserva Seleccionada */}
        {selectedReserva && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Reserva Seleccionada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Código</p>
                    <p className="font-medium">{selectedReserva.codigo}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Cliente</p>
                    <p className="font-medium">{getClienteData(selectedReserva.cliente_id).nombre}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Producto</p>
                    <p className="font-medium">{getProductoData(selectedReserva.producto_id).nombre_producto}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Plane className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Pasajeros (reserva)</p>
                    <p className="font-medium">{selectedReserva.pasajeros}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

/**
 * Next 14.2 requires any client component calling useSearchParams() to sit
 * under a Suspense boundary, or `next build` fails with "useSearchParams()
 * should be wrapped in a suspense boundary". `npm run qa` never runs
 * `next build`, so only `npx next build` proves this.
 *
 * The fallback reuses this page's own existing spinner markup.
 */
export default function VoucherPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Cargando reservas...</p>
        </div>
      }
    >
      <VoucherPageInner />
    </Suspense>
  )
}
