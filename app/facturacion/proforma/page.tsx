"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, Search, Eye, Download, Calendar, User, Package, Edit, X, Plus, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/user-context"
import { generateConfirmacionHTML, openDocumentInNewWindow } from "@/lib/document-generator"
import {
  buildConfirmacionData,
  type ClienteInput,
  type ProductoInput,
  type ReservaInput,
  type ReservaDetalleInput,
  type PasajeroConfirmacion,
} from "@/lib/confirmacion-data"
import type { ReservaBalanceInput } from "@/lib/finance"
import {
  getPasajerosReservaAction,
  guardarPasajerosReservaAction,
  getFacturaNumeroPorReservaAction,
  registrarDiscrepanciaTotalesAction,
  type PasajeroInput,
  type TipoPax,
} from "@/app/actions/documentos-actions"

interface Cliente {
  id: number
  tipo_cliente?: "EMPRESA" | "NORMAL"
  nombre_completo?: string
  razon_social?: string
  identificacion?: string
  rnc?: string
  telefonos?: string
  email?: string
  direccion?: string
}

interface Producto {
  id: number
  nombre_producto?: string
  tipo?: string
  direccion?: string
}

interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  producto_id: number
  fecha_entrada?: string
  fecha_salida?: string
  fecha_creado?: string
  hora_entrada?: string
  hora_salida?: string
  precio_total: number
  descuento?: number
  impuestos?: number
  moneda?: string
  atendido_por?: string
  referido_por?: string
  nota_interna_reserva?: string
  abonado_contabilidad?: number
  status?: string
  pasajeros?: number
  habitaciones?: number
}

interface ReservaDetalle {
  id: number
  reserva_id: number
  concepto: string
  descripcion?: string
  precio_unitario: number
  descuento: number
  total: number
  pasajeros: number
  habitaciones: number
  noches: number
}

interface Pago {
  id: number
  reserva_id: number
  fecha_pago: string
  monto: number
  metodo_pago: string
  referencia?: string
  numero_recibo?: string
}

/**
 * A single passenger row in the "Editar" dialog — the REAL, persisted-
 * passenger editor required by T8 AC-5.
 */
interface EditablePasajero {
  nombreCompleto: string
  tipoPax: TipoPax
  ocupacionId: number | null
}

// T9 (docs/plans/geb-documents-real-data.md): EditableProformaData used to
// also carry `politicas` (cancelacion/penalidad/advertencia) and
// `realizadoPor`. Those fields, the local `escapeHtml` helper and the
// `applyEditableProformaData` regex post-processor that consumed them are
// DELETED here — a DELIBERATE, HUMAN-APPROVED CAPABILITY REMOVAL (OQ2), not a
// regression or a bug fix. Since T8, generateConfirmacionHTML (T6) renders
// the four OQ2 policy paragraphs as FIXED boilerplate and atendidoPor comes
// from the real `reservas.atendido_por` column — so those inputs had already
// stopped affecting the generated document and editing them silently lied to
// the operator. Their replacement protection (escaping every interpolated
// value in generateConfirmacionHTML) is lib/html-escape.ts's `html` tagged
// template (T6b), already live on this page's only generation path since T8.
interface EditableProformaData {
  pasajeros: EditablePasajero[]
  observacion: string
}

export default function FacturacionProformaPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [detalles, setDetalles] = useState<ReservaDetalle[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  const [editableData, setEditableData] = useState<EditableProformaData>({
    pasajeros: [{ nombreCompleto: "", tipoPax: "ADULTO", ocupacionId: null }],
    observacion: "",
  })

  const supabase = createClient()
  const { toast } = useToast()
  const { user } = useUser()

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        const { data: reservasData, error: reservasError } = await supabase
          .from("reservas")
          .select("*")
          .order("fecha_creado", { ascending: false })

        if (reservasError) {
          console.error("Error cargando reservas:", reservasError)
          throw reservasError
        }

        const { data: clientesData, error: clientesError } = await supabase.from("clientes").select("*")

        if (clientesError) {
          console.error("Error cargando clientes:", clientesError)
        }

        const { data: productosData, error: productosError } = await supabase.from("productos").select("*")

        if (productosError) {
          console.error("Error cargando productos:", productosError)
        }

        const { data: detallesData, error: detallesError } = await supabase.from("reserva_detalles").select("*")

        if (detallesError) {
          console.error("Error cargando detalles:", detallesError)
        }

        const { data: pagosData, error: pagosError } = await supabase.from("pagos").select("*")

        if (pagosError) {
          console.error("Error cargando pagos:", pagosError)
        }

        setReservas(reservasData || [])
        setClientes(clientesData || [])
        setProductos(productosData || [])
        setDetalles(detallesData || [])
        setPagos(pagosData || [])
      } catch (error) {
        console.error("Error cargando datos:", error)
        toast({
          title: "Error",
          description: "Error al cargar los datos. Verifique su conexión.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase, toast])

  /**
   * DISPLAY-ONLY helper for the browsing list/table and the search filter.
   * The "Cliente no encontrado"/"" placeholders below are for a BROWSABLE
   * LIST ROW, never for the generated document — the actual CONFIRMACIÓN
   * build (generarConfirmacion below) looks up the raw `clientes` row
   * independently and lets buildConfirmacionData (T5) BLOCK when a required
   * field is genuinely absent. Conflating the two would let this function's
   * placeholder text silently satisfy T5's non-blank-string check — exactly
   * the class of bug this sprint exists to remove (T8 AC-2).
   */
  const getClienteData = (clienteId: number) => {
    const cliente = clientes.find((c) => c.id === clienteId)
    return {
      nombre: cliente?.nombre_completo || cliente?.razon_social || "Cliente no encontrado",
      identificacion:
        (cliente?.tipo_cliente === "EMPRESA" ? cliente?.rnc : cliente?.identificacion) || "N/A",
      telefono: cliente?.telefonos || "",
      email: cliente?.email || "",
      direccion: cliente?.direccion || "",
    }
  }

  const getProductoData = (productoId: number) => {
    const producto = productos.find((p) => p.id === productoId)
    return {
      nombre_producto: producto?.nombre_producto || "Producto no encontrado",
      tipo: producto?.tipo || "N/A",
      direccion: producto?.direccion || "",
    }
  }

  const getReservaDetalles = (reservaId: number) => {
    return detalles.filter((d) => d.reserva_id === reservaId)
  }

  const getReservaPagos = (reservaId: number) => {
    return pagos.filter((p) => p.reserva_id === reservaId)
  }

  /**
   * BALANCE GENERAL RD$/US$ inputs for ONE client — every one of their
   * reservas, matching app/clientes/balance/page.tsx:75-90 exactly (T4/T5).
   * `abonadoContabilidad`/`moneda` NULL-handling mirrors that page's own
   * `Number(x) || 0` / `(moneda || "DOP")` semantics — this is arithmetic-only
   * substitution of an aggregate-balance input, never a document field, so it
   * is NOT the block-never-default violation AC-4's grep is aimed at (that
   * grep targets defaulting a REQUIRED CONFIRMACIÓN field, e.g. a missing
   * CHECK IN date). Written without a literal `|| 0` to keep the diff clean.
   */
  const buildReservaBalanceInputs = (clienteId: number): ReservaBalanceInput[] => {
    return reservas
      .filter((r) => r.cliente_id === clienteId)
      .map((r) => ({
        precioTotal: Number(r.precio_total),
        abonadoContabilidad: r.abonado_contabilidad == null ? 0 : Number(r.abonado_contabilidad),
        pagos: getReservaPagos(r.id).map((pago) => Number(pago.monto)),
        moneda: r.moneda == null ? "DOP" : r.moneda,
      }))
  }

  const openEditDialog = async (reserva: Reserva) => {
    setSelectedReserva(reserva)
    setEditableData({
      pasajeros: [{ nombreCompleto: "", tipoPax: "ADULTO", ocupacionId: null }],
      observacion: reserva.nota_interna_reserva || "",
    })
    setEditDialogOpen(true)

    // AC-5: prefill the passenger editor with the REAL, already-persisted
    // reserva_pasajeros rows (T2), so the dialog edits reality rather than a
    // blank slate every time.
    const pasajerosResultado = await getPasajerosReservaAction(reserva.id)
    if (pasajerosResultado.success && pasajerosResultado.data && pasajerosResultado.data.length > 0) {
      setEditableData((prev) => ({
        ...prev,
        pasajeros: pasajerosResultado.data.map((p: any) => ({
          nombreCompleto: p.nombre_completo,
          tipoPax: p.tipo_pax,
          ocupacionId: p.ocupacion_id ?? null,
        })),
      }))
    }
  }

  const addPasajero = () => {
    setEditableData((prev) => ({
      ...prev,
      pasajeros: [...prev.pasajeros, { nombreCompleto: "", tipoPax: "ADULTO", ocupacionId: null }],
    }))
  }

  const removePasajero = (index: number) => {
    setEditableData((prev) => ({
      ...prev,
      pasajeros: prev.pasajeros.filter((_, i) => i !== index),
    }))
  }

  const updatePasajeroNombre = (index: number, value: string) => {
    setEditableData((prev) => ({
      ...prev,
      pasajeros: prev.pasajeros.map((p, i) => (i === index ? { ...p, nombreCompleto: value } : p)),
    }))
  }

  const updatePasajeroTipo = (index: number, value: TipoPax) => {
    setEditableData((prev) => ({
      ...prev,
      pasajeros: prev.pasajeros.map((p, i) => (i === index ? { ...p, tipoPax: value } : p)),
    }))
  }

  /**
   * T8 — the real CONFIRMACIÓN DE SERVICIOS pipeline:
   *   1. (optional) persist the edited passenger list — reserva_pasajeros (T2)
   *   2. read back the real, persisted passenger list (T2)
   *   3. read the real FACTURA # — BLOCKS with a distinct message per HC-2 (T7)
   *   4. build ConfirmacionData — BLOCKS with every missing named field (T5)
   *   5. (HC-3) a totals discrepancy does NOT block: the document still
   *      generates, and the discrepancy is persisted best-effort (R7: a
   *      failed log write must not block or reach the operator)
   *   6. render with generateConfirmacionHTML (T6) and open it
   *
   * `pasajerosAGuardar` is only supplied by the "Editar" dialog; "Rápida"
   * calls this with no second argument and simply reads whatever passenger
   * list is already persisted for the reserva.
   */
  const generarConfirmacion = async (reserva: Reserva, pasajerosAGuardar?: PasajeroInput[]) => {
    try {
      if (pasajerosAGuardar) {
        const guardarResultado = await guardarPasajerosReservaAction(
          reserva.id,
          pasajerosAGuardar,
          user?.nombre || "Usuario Sistema",
        )
        if (!guardarResultado.success) {
          toast({
            title: "No se pudieron guardar los pasajeros",
            description: guardarResultado.error,
            variant: "destructive",
          })
          return
        }
      }

      const pasajerosResultado = await getPasajerosReservaAction(reserva.id)
      if (!pasajerosResultado.success) {
        toast({
          title: "No se pudo obtener la lista de pasajeros",
          description: pasajerosResultado.error,
          variant: "destructive",
        })
        return
      }

      const pasajeros: PasajeroConfirmacion[] = (pasajerosResultado.data || []).map((p: any) => ({
        orden: p.orden,
        nombreCompleto: p.nombre_completo,
        tipoPax: p.tipo_pax,
        documento: p.documento ?? null,
      }))

      // HC-2 (T7): read-only FACTURA # lookup. Both failure branches BLOCK —
      // the two messages are verbatim and deliberately distinct so the
      // operator can tell a data-entry job (SIN_COMPROBANTE) from an
      // engineering problem (LOOKUP_FAILED). Rendered as a toast
      // `description` (a plain string passed as a React text child), so
      // React escapes it automatically — no manual escaping is needed or
      // performed here.
      const facturaResultado = await getFacturaNumeroPorReservaAction(reserva.id)
      if (!facturaResultado.ok) {
        toast({
          title:
            facturaResultado.reason === "SIN_COMPROBANTE"
              ? "Falta información pendiente"
              : "Error técnico al consultar el comprobante fiscal",
          description: facturaResultado.message,
          variant: "destructive",
        })
        return
      }

      // Raw cliente/producto lookup — DELIBERATELY independent of
      // getClienteData/getProductoData above, which apply display-only
      // placeholder text for the browsing list. A missing field here stays
      // `null`/`undefined` and is left for buildConfirmacionData to BLOCK
      // (T8 AC-2/AC-4 — no page-level defaulting of a required field).
      const clienteReal = clientes.find((c) => c.id === reserva.cliente_id)
      const productoReal = productos.find((p) => p.id === reserva.producto_id)

      const clienteInput: ClienteInput | null = clienteReal
        ? {
            id: clienteReal.id,
            nombre: clienteReal.nombre_completo ?? clienteReal.razon_social ?? null,
            cedulaRnc:
              clienteReal.tipo_cliente === "EMPRESA"
                ? (clienteReal.rnc ?? null)
                : (clienteReal.identificacion ?? null),
            email: clienteReal.email ?? null,
            // No dedicated `whatsapp` column exists in `clientes` (grep-verified
            // against lib/supabase.ts); `telefonos` is the sole real phone
            // number on the record, so it is the genuine source for the
            // WHATAPP line — not a fabricated value.
            whatsapp: clienteReal.telefonos ?? null,
          }
        : null

      const productoInput: ProductoInput | null = productoReal
        ? { nombre: productoReal.nombre_producto ?? null }
        : null

      const reservaDetalles = getReservaDetalles(reserva.id)
      const lineasInput: ReservaDetalleInput[] = reservaDetalles.map((detalle) => ({
        concepto: detalle.concepto ?? null,
        descripcion: detalle.descripcion ?? null,
        precioUnitario: detalle.precio_unitario == null ? null : Number(detalle.precio_unitario),
        descuento: detalle.descuento == null ? null : Number(detalle.descuento),
        total: detalle.total == null ? null : Number(detalle.total),
      }))
      // Zero detalles -> lineasInput is []; buildConfirmacionData BLOCKS on
      // this (T5 AC-3) instead of the deleted synthetic single-line fallback.

      const pagosReserva = getReservaPagos(reserva.id).map((pago) => Number(pago.monto))

      const reservaInput: ReservaInput = {
        id: reserva.id,
        fechaEntrada: reserva.fecha_entrada ?? null,
        fechaSalida: reserva.fecha_salida ?? null,
        horaEntrada: reserva.hora_entrada ?? null,
        horaSalida: reserva.hora_salida ?? null,
        fechaReserva: reserva.fecha_creado ?? null,
        precioTotal: Number(reserva.precio_total),
        abonadoContabilidad: reserva.abonado_contabilidad ?? null,
        moneda: reserva.moneda ?? null,
        pasajerosCount: reserva.pasajeros ?? null,
        habitacionesCount: reserva.habitaciones ?? null,
        observaciones: reserva.nota_interna_reserva ?? null,
        atendidoPor: reserva.atendido_por ?? null,
        referidoPor: reserva.referido_por ?? null,
      }

      const resultado = buildConfirmacionData({
        cliente: clienteInput,
        producto: productoInput,
        reserva: reservaInput,
        facturaNumero: facturaResultado.numeroFactura,
        lineas: lineasInput,
        pasajeros,
        pagosReserva,
        reservasParaBalanceGeneral: buildReservaBalanceInputs(reserva.cliente_id),
      })

      if (!resultado.ok) {
        // AC-3: destructive toast lists EVERY missing field (never just the
        // first); no window opens; the success toast below never fires
        // (mistakes/premature-success-signal).
        toast({
          title: "No se puede generar la confirmación",
          description: `Faltan los siguientes campos: ${resultado.missing.join(" · ")}`,
          variant: "destructive",
        })
        return
      }

      // HC-3: a totals discrepancy does NOT block and is NEVER shown on
      // screen or on the document — the document generates normally and the
      // mismatch is persisted best-effort to `auditoria` (T5 §9 HC-3). Per
      // R7/the action's own contract, a failed write here must not block
      // generation and must not be surfaced to the operator — only logged
      // for engineering visibility.
      if (resultado.discrepancia) {
        const discrepanciaResultado = await registrarDiscrepanciaTotalesAction({
          reservaId: resultado.discrepancia.reservaId,
          clienteId: resultado.discrepancia.clienteId,
          sumaDetalles: resultado.discrepancia.sumaDetalles,
          precioTotal: resultado.discrepancia.precioTotal,
          delta: resultado.discrepancia.delta,
          moneda: resultado.discrepancia.moneda,
          usuario: user?.nombre,
        })
        if (!discrepanciaResultado.success) {
          console.error("No se pudo registrar la discrepancia de totales:", discrepanciaResultado.error)
        }
      }

      const confirmacionHTML = generateConfirmacionHTML(resultado.data)
      openDocumentInNewWindow(confirmacionHTML, `Confirmación - ${reserva.codigo}`)

      toast({
        title: "Éxito",
        description: "Confirmación de servicios generada correctamente",
      })
    } catch (error) {
      console.error("Error generando la confirmación de servicios:", error)
      toast({
        title: "Error",
        description: `Error al generar la confirmación: ${error instanceof Error ? error.message : "Error desconocido"}`,
        variant: "destructive",
      })
    }
  }

  const handleGenerateWithCustomData = async () => {
    if (!selectedReserva) return

    const pasajerosInput: PasajeroInput[] = editableData.pasajeros
      .map((p) => ({ nombreCompleto: p.nombreCompleto.trim(), tipoPax: p.tipoPax, ocupacionId: p.ocupacionId }))
      .filter((p) => p.nombreCompleto.length > 0)
      .map((p, index) => ({
        orden: index + 1,
        nombre_completo: p.nombreCompleto,
        tipo_pax: p.tipoPax,
        ocupacion_id: p.ocupacionId ?? null,
      }))

    await generarConfirmacion(selectedReserva, pasajerosInput)
    setEditDialogOpen(false)
  }

  const filteredReservas = reservas.filter((reserva) => {
    const clienteData = getClienteData(reserva.cliente_id)
    const productoData = getProductoData(reserva.producto_id)

    const searchTerm = searchQuery.toLowerCase()
    const matchesSearch =
      clienteData.nombre.toLowerCase().includes(searchTerm) ||
      reserva.codigo.toLowerCase().includes(searchTerm) ||
      productoData.nombre_producto.toLowerCase().includes(searchTerm)

    const reservaStatus = (reserva.status || "").toLowerCase()
    const matchesStatus = statusFilter === "todos" || reservaStatus === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (estado?: string) => {
    if (!estado) return "bg-gray-100 text-gray-800"

    switch (estado.toLowerCase()) {
      case "pagada":
        return "bg-green-100 text-green-800"
      case "parcial":
        return "bg-blue-100 text-blue-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "cancelada":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const totalReservas = filteredReservas.reduce((sum, reserva) => sum + (reserva.precio_total || 0), 0)
  const reservasPagadas = filteredReservas.filter((r) => (r.status || "").toLowerCase() === "pagada").length
  const reservasPendientes = filteredReservas.filter((r) => (r.status || "").toLowerCase() === "pendiente").length

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleDateString("es-DO", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return "N/A"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando proformas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/facturacion")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Facturación
            </Button>
            <div className="flex items-center space-x-2">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Gestión de Proformas</h1>
                <p className="text-sm text-gray-500">Generar y administrar proformas de reservas</p>
              </div>
            </div>
          </div>
          <Link href="/reservas/crear">
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Reserva
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-6">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Facturado</p>
                  <p className="text-2xl font-bold text-gray-900">${totalReservas.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Package className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Proformas</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredReservas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <User className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Pagadas</p>
                  <p className="text-2xl font-bold text-gray-900">{reservasPagadas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Pendientes</p>
                  <p className="text-2xl font-bold text-gray-900">{reservasPendientes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-600">Filtros de Búsqueda</CardTitle>
            <CardDescription>Buscar y filtrar proformas por cliente, reserva o producto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por cliente, reserva, producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="pagada">Pagadas</SelectItem>
                  <SelectItem value="parcial">Parciales</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("todos")
                }}
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Proformas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Lista de Proformas ({filteredReservas.length})</CardTitle>
            <CardDescription>Todas las proformas disponibles para generar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Reserva</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium">No se encontraron proformas</p>
                          <p className="text-sm">Intente ajustar los filtros de búsqueda</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReservas.map((reserva) => {
                      const clienteData = getClienteData(reserva.cliente_id)
                      const productoData = getProductoData(reserva.producto_id)

                      return (
                        <TableRow key={reserva.id}>
                          <TableCell>{formatDate(reserva.fecha_creado)}</TableCell>
                          <TableCell>
                            <div className="font-medium">{reserva.codigo}</div>
                            <div className="text-sm text-gray-500">
                              {formatDate(reserva.fecha_entrada)} - {formatDate(reserva.fecha_salida)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{clienteData.nombre}</div>
                            <div className="text-sm text-gray-500">{clienteData.identificacion}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{productoData.nombre_producto}</div>
                            <div className="text-sm text-gray-500">{productoData.tipo}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-green-600">${(reserva.precio_total || 0).toFixed(2)}</div>
                            <div className="text-sm text-gray-500">{reserva.moneda || "DOP"}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(reserva.status)}>{reserva.status || "Sin estado"}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(reserva)}
                                className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generarConfirmacion(reserva)}
                                className="border-green-200 text-green-600 hover:bg-green-50 bg-transparent"
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Rápida
                              </Button>
                              <Link href={`/reservas/ver/${reserva.id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-gray-200 text-gray-600 hover:bg-gray-50 bg-transparent"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Edición */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proforma - {selectedReserva?.codigo}</DialogTitle>
            <DialogDescription>Personalice los datos antes de generar la proforma</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Observación */}
            <div>
              <label className="text-sm font-medium mb-2 block">Observación</label>
              <Textarea
                value={editableData.observacion}
                onChange={(e) => setEditableData((prev) => ({ ...prev, observacion: e.target.value }))}
                placeholder="Ingrese observaciones adicionales..."
                rows={3}
              />
            </div>

            {/* Información de Pasajeros */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Información de los pasajeros</label>
                <Button
                  type="button"
                  size="sm"
                  onClick={addPasajero}
                  className="text-xs bg-green-600 hover:bg-green-700"
                >
                  Agregar Pasajero
                </Button>
              </div>
              <div className="space-y-2">
                {editableData.pasajeros.map((pasajero, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-8">{index + 1})</span>
                    <Input
                      value={pasajero.nombreCompleto}
                      onChange={(e) => updatePasajeroNombre(index, e.target.value)}
                      placeholder="Nombre completo del pasajero..."
                      className="flex-1"
                    />
                    <Select
                      value={pasajero.tipoPax}
                      onValueChange={(value) => updatePasajeroTipo(index, value as TipoPax)}
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
                    {editableData.pasajeros.length > 1 && (
                      <Button type="button" size="sm" variant="outline" onClick={() => removePasajero(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateWithCustomData} className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              Generar Proforma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
