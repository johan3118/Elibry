"use client"

import { useState, useEffect } from "react"
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
  type PasajeroInput,
  type OcupacionInput,
  type TipoPax,
  type DatosVoucherReserva,
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
 *     (`productos.direccion` / `productos.telefono_contacto`) — the
 *     front-desk number a guest calls, not the account manager's phone at
 *     `suplidores.telefono_responsable`. HOTFIX (2026-07-27): a prior sprint
 *     wired this to a `suplidores.telefono` column that never existed in the
 *     schema (see scripts/001-create-tables.sql:21's `telefono_responsable`),
 *     which PostgREST rejected with 42703 on every load, silently emptying
 *     `suplidores` and blocking every voucher. `productos.telefono_contacto`
 *     (scripts/033-add-contact-fields-to-productos.sql:2-4) replaces it.
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
  /** `productos.telefono_contacto` (scripts/033-add-contact-fields-to-productos.sql:2-4) — the hotel property's own front-desk number. */
  telefono_contacto?: string
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
  precio_total: number
  status: string
  nota_interna_reserva?: string | null
}

/**
 * The exact column list `fetchReservas` requests from `productos` —
 * pulled into a named, exported constant (mirrors `buildCierreOptimista`'s
 * export pattern in app/crm/casos/page.tsx) so `tests/voucher-page.test.ts`
 * can assert on it directly. HOTFIX (2026-07-28): QA's mutation N2 proved
 * that silently dropping `telefono_contacto` from this select string
 * reproduces the SAME bug class as the original outage (PostgREST simply
 * returns the row without it — no thrown error, `tsc` stays clean because
 * select strings are untyped) one layer above the bug this hotfix already
 * fixed. This constant is that regression guard's anchor.
 */
export const PRODUCTOS_SELECT_COLUMNS = "id, nombre_producto, pais, direccion, suplidor_id, telefono_contacto"

/**
 * Derives the VOUCHER's TELEFONO from `productos.telefono_contacto` — the
 * hotel PROPERTY's own front-desk number (never `suplidores.telefono`,
 * which never existed, and never the supplier account manager's phone).
 * Extracted from `construirVoucherData`'s inline lookup (HOTFIX 2026-07-28,
 * mirrors `buildCierreOptimista`'s export pattern) purely so this line gets
 * a regression guard — NO BEHAVIOR CHANGE from the inline expression it
 * replaces (`productoReal?.telefono_contacto ?? null`): a blank
 * `telefono_contacto` string is passed through VERBATIM here (not
 * normalized to `null`) exactly as it always was — `buildVoucherData`'s
 * `esTextoValido` check downstream is what blocks a blank value; this
 * function only decides WHICH COLUMN the value comes from.
 */
export function derivarTelefonoHotel(
  productos: Producto[],
  productoId: number | null | undefined,
): string | null {
  if (productoId === null || productoId === undefined) return null
  const producto = productos.find((p) => p.id === productoId)
  return producto?.telefono_contacto ?? null
}

/** One row in the repeatable occupancy-group editor — persists to `reserva_ocupaciones` (T2/T2b). */
interface EditableOcupacion {
  cantidad: number | null
  ocupacion: string
  categoria: string
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

export default function VoucherPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  const [loading, setLoading] = useState(false)
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

    const [datosResultado, pasajerosResultado, ocupacionesResultado] = await Promise.all([
      getDatosVoucherReservaAction(reserva.id),
      getPasajerosReservaAction(reserva.id),
      getOcupacionesReservaAction(reserva.id),
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
    }
  }

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
      getPasajerosReservaAction(reserva.id),
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
      // HOTFIX (2026-07-27/28): the hotel PROPERTY's own front-desk number
      // (`productos.telefono_contacto`), not the supplier account manager's
      // phone. Extracted to the exported, regression-tested
      // `derivarTelefonoHotel` (2026-07-28) — see the module doc above and
      // lib/voucher-data.ts.
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
                  <Label>Grupos de Ocupación (habitaciones)</Label>
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
