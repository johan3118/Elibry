"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Calendar,
  Search,
  Eye,
  Edit,
  DollarSign,
  CreditCard,
  ArrowLeft,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { obtenerRegistrosCompletos } from "@/lib/provisional-system"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { SortableTableHeader } from "@/components/sortable-table-header"
import { TimeFormatToggle, formatTimeWithPreference } from "@/components/time-format-toggle"
import { formatDateDMY } from "@/lib/utils"

interface Reserva {
  id: number
  codigo_reserva: string
  codigo: string
  cliente_id: number
  cedula_cliente: string
  cliente?: {
    nombre: string // This will be nombre_completo or razon_social
    apellido: string // Keep for backward compatibility but will be empty
    telefonos?: string
  }
  producto_id: number
  producto?: {
    nombre_producto: string
    tipo: string
  }
  fecha_entrada: string
  fecha_salida: string
  hora_entrada: string | null
  hora_salida: string | null
  pasajeros: number
  habitaciones: number
  precio_unitario: number
  precio_total: number
  descuento: number
  impuestos: number
  balance_reserva: number
  balance_general: number
  balance_abonado: number
  moneda: string
  status: string
  estado?: string
  referido_por: string
  atendido_por: string
  proveedor: string | null
  proforma: string | null
  grupo: string | null
  metodo_pago: string
  fecha_limite_pago: string
  fecha_gastos_proveedor: string | null
  abonado_contabilidad: string
  comision: string
  factura_enviada_cliente: string
  factura_recibida_proveedor: string
  asientos_bus: number | string | null
  observaciones: string
  nota_interna_reserva: string | null
  registrado_por: string
  fecha_creado: string
  fecha_editado: string
}

export default function ReservasPendientesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filtroParam = searchParams.get("filtro")
  const { toast } = useToast()

  const [mounted, setMounted] = useState(false)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO")
  const [processing, setProcessing] = useState(false)

  const [sortField, setSortField] = useState<string | null>("fecha_entrada")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const [is24HourFormat, setIs24HourFormat] = useState(true)

  // Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [filterEstado, setFilterEstado] = useState("PENDIENTE")
  const [filterMoneda, setFilterMoneda] = useState("ALL")
  const [filterClienteId, setFilterClienteId] = useState("")
  const [filterProductoId, setFilterProductoId] = useState("")
  const [filterTipoLugar, setFilterTipoLugar] = useState("ALL")
  const [filterMarca, setFilterMarca] = useState("ALL")
  const [filterReferidoPor, setFilterReferidoPor] = useState("")
  const [filterAtendidoPor, setFilterAtendidoPor] = useState("")
  const [filterProveedor, setFilterProveedor] = useState("")
  const [filterGrupo, setFilterGrupo] = useState("")
  const [filterMetodoPago, setFilterMetodoPago] = useState("ALL")
  const [filterComision, setFilterComision] = useState("ALL")
  const [filterFacturaEnviada, setFilterFacturaEnviada] = useState("ALL")
  const [filterFacturaRecibida, setFilterFacturaRecibida] = useState("ALL")
  const [filterFechaEntradaDesde, setFilterFechaEntradaDesde] = useState("")
  const [filterFechaEntradaHasta, setFilterFechaEntradaHasta] = useState("")
  const [filterFechaSalidaDesde, setFilterFechaSalidaDesde] = useState("")
  const [filterFechaSalidaHasta, setFilterFechaSalidaHasta] = useState("")
  const [filterBalanceMin, setFilterBalanceMin] = useState("")
  const [filterBalanceMax, setFilterBalanceMax] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterPenalidadCliente, setFilterPenalidadCliente] = useState(false)
  const [filterPenalidadProveedor, setFilterPenalidadProveedor] = useState(false)

  // Apply URL filter parameter on mount
  useEffect(() => {
    if (filtroParam === "penalidad_cliente") {
      setFilterPenalidadCliente(true)
      setFilterEstado("PENDIENTE")
    } else if (filtroParam === "penalidad_proveedor") {
      setFilterPenalidadProveedor(true)
      setFilterEstado("PENDIENTE")
    }
  }, [filtroParam])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortReservations = (reservations: Reserva[]) => {
    if (!sortField) return reservations

    return [...reservations].sort((a, b) => {
      let aValue: any = a[sortField as keyof Reserva]
      let bValue: any = b[sortField as keyof Reserva]

      // Handle nested fields
      if (sortField === "cliente_nombre") {
        aValue = a.cliente?.nombre || ""
        bValue = b.cliente?.nombre || ""
      } else if (sortField === "producto_nombre") {
        aValue = a.producto?.nombre_producto || ""
        bValue = b.producto?.nombre_producto || ""
      }

      // Handle dates
      if (sortField.includes("fecha")) {
        aValue = aValue ? new Date(aValue).getTime() : 0
        bValue = bValue ? new Date(bValue).getTime() : 0
      }

      // Handle numbers
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }

      // Handle strings
      aValue = String(aValue || "").toLowerCase()
      bValue = String(bValue || "").toLowerCase()

      if (sortDirection === "asc") {
        return aValue.localeCompare(bValue)
      } else {
        return bValue.localeCompare(aValue)
      }
    })
  }

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (mounted) {
      cargarReservas()
    }
  }, [mounted])

  const cargarReservas = async () => {
    try {
      setLoading(true)

      const result = await obtenerRegistrosCompletos("reservas")
      const reservasData = Array.isArray(result?.data) ? result.data : []

      // Fetch all payments to calculate real balances
      const { data: pagosData, error: pagosError } = await supabase.from("pagos").select("reserva_id, monto, estado")

      if (pagosError) {
        console.error("Error cargando pagos:", pagosError)
      }

      // Create map of payments by reservation (only count non-cancelled payments)
      const pagosMap = new Map<number, number>()
      pagosData?.forEach((pago: any) => {
        // Skip cancelled payments
        if (pago.estado === "ANULADO") return
        const reservaId = pago.reserva_id
        const monto = Number.parseFloat(pago.monto) || 0
        pagosMap.set(reservaId, (pagosMap.get(reservaId) || 0) + monto)
      })

      const reservasConClientes = await Promise.all(
        reservasData.map(async (reserva: any) => {
          // Fetch client data - use nombre_completo for clientes and razon_social for empresas
          const { data: cliente, error: clienteError } = await supabase
            .from("clientes")
            .select("tipo_cliente, nombre_completo, razon_social, telefonos")
            .eq("id", reserva.cliente_id)
            .single()

          // Fetch product data
          const { data: producto, error: productoError } = await supabase
            .from("productos")
            .select("nombre_producto, tipo")
            .eq("id", reserva.producto_id)
            .single()

          // Build enriched client object using correct field based on client type
          let clienteEnriquecido = null
          if (cliente) {
            // Use razon_social for EMPRESA, nombre_completo for others
            const nombreDisplay =
              cliente.tipo_cliente === "EMPRESA" ? cliente.razon_social || "" : cliente.nombre_completo || ""

            clienteEnriquecido = {
              nombre: nombreDisplay,
              apellido: "", // Keep empty for backward compatibility
              telefonos: cliente.telefonos,
            }
          }

          // Calculate real balances from payments
          const precioTotal = Number.parseFloat(reserva.precio_total || 0)
          const totalPagosRealizados = pagosMap.get(reserva.id) || 0
          const saldoRestante = precioTotal - totalPagosRealizados

          return {
            ...reserva,
            cliente: clienteEnriquecido,
            producto,
            // Override balance fields with calculated values
            balance_reserva: precioTotal,
            balance_general: saldoRestante,
            balance_abonado: totalPagosRealizados,
          }
        }),
      )

      setReservas(reservasConClientes)
    } catch (error: any) {
      console.error("Error al cargar reservas:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las reservas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Count active filters
  const countActiveFilters = () => {
    let count = 0
    if (filterEstado !== "ALL" && filterEstado !== "PENDIENTE") count++
    if (filterMoneda !== "ALL") count++
    if (filterClienteId) count++
    if (filterProductoId) count++
    if (filterTipoLugar !== "ALL") count++
    if (filterMarca !== "ALL") count++
    if (filterReferidoPor) count++
    if (filterAtendidoPor) count++
    if (filterProveedor) count++
    if (filterGrupo) count++
    if (filterMetodoPago !== "ALL") count++
    if (filterComision !== "ALL") count++
    if (filterFacturaEnviada !== "ALL") count++
    if (filterFacturaRecibida !== "ALL") count++
    if (filterFechaEntradaDesde) count++
    if (filterFechaEntradaHasta) count++
    if (filterFechaSalidaDesde) count++
    if (filterFechaSalidaHasta) count++
    if (filterBalanceMin) count++
    if (filterBalanceMax) count++
    return count
  }

  const clearAllFilters = () => {
    setSearchTerm("")
    setFilterEstado("PENDIENTE")
    setFilterMoneda("ALL")
    setFilterClienteId("")
    setFilterProductoId("")
    setFilterTipoLugar("ALL")
    setFilterMarca("ALL")
    setFilterReferidoPor("")
    setFilterAtendidoPor("")
    setFilterProveedor("")
    setFilterGrupo("")
    setFilterMetodoPago("ALL")
    setFilterComision("ALL")
    setFilterFacturaEnviada("ALL")
    setFilterFacturaRecibida("ALL")
    setFilterFechaEntradaDesde("")
    setFilterFechaEntradaHasta("")
    setFilterFechaSalidaDesde("")
    setFilterFechaSalidaHasta("")
    setFilterBalanceMin("")
    setFilterBalanceMax("")
    setFilterPenalidadCliente(false)
    setFilterPenalidadProveedor(false)
    setShowAdvancedFilters(false)
  }

  const reservasFiltradas = reservas.filter((reserva) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      reserva.codigo_reserva?.toLowerCase().includes(searchLower) ||
      reserva.codigo?.toLowerCase().includes(searchLower) ||
      reserva.cedula_cliente?.toLowerCase().includes(searchLower) ||
      reserva.cliente?.nombre?.toLowerCase().includes(searchLower) ||
      reserva.producto?.nombre_producto?.toLowerCase().includes(searchLower) ||
      reserva.atendido_por?.toLowerCase().includes(searchLower) ||
      reserva.proveedor?.toLowerCase().includes(searchLower) ||
      reserva.grupo?.toLowerCase().includes(searchLower) ||
      reserva.referido_por?.toLowerCase().includes(searchLower)

    const matchesEstado = filterEstado === "ALL" || reserva.estado === filterEstado || reserva.status === filterEstado
    const matchesMoneda = filterMoneda === "ALL" || reserva.moneda === filterMoneda
    const matchesClienteId = !filterClienteId || reserva.cliente_id.toString() === filterClienteId
    const matchesProductoId = !filterProductoId || reserva.producto_id.toString() === filterProductoId
    const matchesTipoLugar = filterTipoLugar === "ALL" // Always true since column doesn't exist
    const matchesMarca = filterMarca === "ALL" // Always true since column doesn't exist
    const matchesReferidoPor =
      !filterReferidoPor || reserva.referido_por?.toLowerCase().includes(filterReferidoPor.toLowerCase())
    const matchesAtendidoPor =
      !filterAtendidoPor || reserva.atendido_por?.toLowerCase().includes(filterAtendidoPor.toLowerCase())
    const matchesProveedor =
      !filterProveedor || reserva.proveedor?.toLowerCase().includes(filterProveedor.toLowerCase())
    const matchesGrupo = !filterGrupo || reserva.grupo?.toLowerCase().includes(filterGrupo.toLowerCase())
    const matchesMetodoPago = filterMetodoPago === "ALL" || reserva.metodo_pago === filterMetodoPago
    const matchesComision = filterComision === "ALL" || reserva.comision === filterComision
    const matchesFacturaEnviada =
      filterFacturaEnviada === "ALL" || reserva.factura_enviada_cliente === filterFacturaEnviada
    const matchesFacturaRecibida =
      filterFacturaRecibida === "ALL" || reserva.factura_recibida_proveedor === filterFacturaRecibida

    const matchesFechaEntradaDesde =
      !filterFechaEntradaDesde || new Date(reserva.fecha_entrada) >= new Date(filterFechaEntradaDesde)
    const matchesFechaEntradaHasta =
      !filterFechaEntradaHasta || new Date(reserva.fecha_entrada) <= new Date(filterFechaEntradaHasta)
    const matchesFechaSalidaDesde =
      !filterFechaSalidaDesde || new Date(reserva.fecha_salida) >= new Date(filterFechaSalidaDesde)
    const matchesFechaSalidaHasta =
      !filterFechaSalidaHasta || new Date(reserva.fecha_salida) <= new Date(filterFechaSalidaHasta)

    const balance = reserva.balance_general || reserva.balance_reserva || 0
    const matchesBalanceMin = !filterBalanceMin || balance >= Number.parseFloat(filterBalanceMin)
    const matchesBalanceMax = !filterBalanceMax || balance <= Number.parseFloat(filterBalanceMax)

    // Penalidad filters - show reservas within 5 days of penalidad date
    const today = new Date()
    const in5Days = new Date(today)
    in5Days.setDate(today.getDate() + 5)
    const todayStr = today.toISOString().split("T")[0]
    const in5DaysStr = in5Days.toISOString().split("T")[0]

    let matchesPenalidadCliente = true
    if (filterPenalidadCliente) {
      const fechaLimite = reserva.fecha_limite_pago
      matchesPenalidadCliente = !!(fechaLimite && fechaLimite >= todayStr && fechaLimite <= in5DaysStr)
    }

    let matchesPenalidadProveedor = true
    if (filterPenalidadProveedor) {
      const fechaGastos = reserva.fecha_gastos_proveedor
      matchesPenalidadProveedor = !!(fechaGastos && fechaGastos >= todayStr && fechaGastos <= in5DaysStr)
    }

    // Keep original "updates" behavior: effectively only search + moneda for filtering result set
    return (
      matchesSearch &&
      matchesMoneda &&
      matchesEstado &&
      matchesClienteId &&
      matchesProductoId &&
      matchesTipoLugar &&
      matchesMarca &&
      matchesReferidoPor &&
      matchesAtendidoPor &&
      matchesProveedor &&
      matchesGrupo &&
      matchesMetodoPago &&
      matchesComision &&
      matchesFacturaEnviada &&
      matchesFacturaRecibida &&
      matchesFechaEntradaDesde &&
      matchesFechaEntradaHasta &&
      matchesFechaSalidaDesde &&
      matchesFechaSalidaHasta &&
      matchesBalanceMin &&
      matchesBalanceMax &&
      matchesPenalidadCliente &&
      matchesPenalidadProveedor
    )
  })

  const reservasOrdenadas = sortReservations(reservasFiltradas)

  const handleRegistrarPago = async () => {
    if (!selectedReserva || !paymentAmount) {
      toast({
        title: "Error",
        description: "Debe ingresar un monto válido",
        variant: "destructive",
      })
      return
    }

    const monto = Number.parseFloat(paymentAmount)
    const balancePendiente = selectedReserva.balance_general || selectedReserva.balance_reserva || 0

    if (monto <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    if (monto > balancePendiente) {
      toast({
        title: "Error",
        description: "El monto no puede ser mayor al balance pendiente",
        variant: "destructive",
      })
      return
    }

    try {
      setProcessing(true)

      const { error } = await supabase.from("pagos").insert({
        reserva_id: selectedReserva.id,
        cliente_id: selectedReserva.cliente_id,
        monto: monto,
        moneda: selectedReserva.moneda,
        metodo_pago: paymentMethod,
        fecha_pago: new Date().toISOString(),
        estado: "COMPLETADO",
      })

      if (error) throw error

      const nuevoBalance = balancePendiente - monto
      const nuevoBalanceAbonado = (selectedReserva.balance_abonado || 0) + monto

      await supabase
        .from("reservas")
        .update({
          balance_general: nuevoBalance,
          balance_abonado: nuevoBalanceAbonado,
        })
        .eq("id", selectedReserva.id)

      toast({
        title: "Éxito",
        description: "Pago registrado correctamente",
      })

      setShowPaymentDialog(false)
      setPaymentAmount("")
      setPaymentMethod("EFECTIVO")
      cargarReservas()
    } catch (error: any) {
      console.error("Error al registrar pago:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar el pago",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const formatCurrency = (amount: number | null | undefined, currency: string) => {
    if (amount === null || amount === undefined) return "N/A"
    const formatted = amount.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return currency === "USD" ? `$${formatted} USD` : `RD$${formatted}`
  }

  const formatTime = (timeString: string | null | undefined) => {
    return formatTimeWithPreference(timeString, is24HourFormat)
  }

  const calcularNoches = (entrada: string, salida: string) => {
    if (!entrada || !salida) return 0
    const fechaEntrada = new Date(entrada)
    const fechaSalida = new Date(salida)
    const diffTime = fechaSalida.getTime() - fechaEntrada.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  const calcularDiasParaFecha = (fechaLimite: string | null) => {
    if (!fechaLimite) return null
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fecha = new Date(fechaLimite)
    fecha.setHours(0, 0, 0, 0)
    const diffTime = fecha.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getEstadoBadge = (estado: string | undefined) => {
    const estados: Record<string, { label: string; className: string }> = {
      PENDIENTE: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800" },
      CONFIRMADA: { label: "Confirmada", className: "bg-blue-100 text-blue-800" },
      COMPLETADA: { label: "Completada", className: "bg-green-100 text-green-800" },
      CANCELADA: { label: "Cancelada", className: "bg-red-100 text-red-800" },
    }
    const config = estados[estado || ""] || { label: estado || "Desconocido", className: "bg-gray-100 text-gray-800" }
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const getYesNoBadge = (value: string | null | undefined) => {
    if (!value) return <Badge variant="secondary">N/A</Badge>
    return value === "SI" ? (
      <Badge className="bg-green-100 text-green-800">Sí</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800">No</Badge>
    )
  }

  const activeFiltersCount = countActiveFilters()

  if (!mounted) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando reservas...</p>
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
              onClick={() => router.push("/")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
            <div className="flex items-center space-x-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Reservas Pendientes</h1>
                <p className="text-sm text-gray-500">Gestionar pagos de reservas</p>
              </div>
            </div>
          </div>
          <TimeFormatToggle onChange={setIs24HourFormat} />
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reservas</p>
                  <p className="text-2xl font-bold text-blue-600">{reservasOrdenadas.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600">Balance Pendiente RD$</p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency(
                    reservasOrdenadas
                      .filter((r) => r.moneda === "DOP")
                      .reduce((sum, r) => sum + (r.balance_general || 0), 0),
                    "DOP",
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-gray-600">Balance Pendiente US$</p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency(
                    reservasOrdenadas
                      .filter((r) => r.moneda === "USD")
                      .reduce((sum, r) => sum + (r.balance_general || 0), 0),
                    "USD",
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pendientes</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {reservas.filter((r) => r.status === "PENDIENTE").length}
                  </p>
                </div>
                <CreditCard className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-green-600">Filtros</CardTitle>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {activeFiltersCount} activo{activeFiltersCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {activeFiltersCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="border-red-200 text-red-600 bg-transparent"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Limpiar filtros
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filtros avanzados
                  {showAdvancedFilters ? (
                    <ChevronUp className="w-4 h-4 ml-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-1" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Always visible: General search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por código, cliente, producto, atendido por, proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Advanced filters - collapsible */}
            {showAdvancedFilters && (
              <div className="space-y-4">
                {/* Status & Currency */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Estado y Moneda</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select value={filterEstado} onValueChange={setFilterEstado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos los estados</SelectItem>
                        <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                        <SelectItem value="COMPLETADA">Completada</SelectItem>
                        <SelectItem value="ANULADA">Anulada</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterMoneda} onValueChange={setFilterMoneda}>
                      <SelectTrigger>
                        <SelectValue placeholder="Moneda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas las monedas</SelectItem>
                        <SelectItem value="DOP">DOP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dates */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Fechas</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Entrada desde</Label>
                      <Input
                        type="date"
                        value={filterFechaEntradaDesde}
                        onChange={(e) => setFilterFechaEntradaDesde(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Entrada hasta</Label>
                      <Input
                        type="date"
                        value={filterFechaEntradaHasta}
                        onChange={(e) => setFilterFechaEntradaHasta(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Salida desde</Label>
                      <Input
                        type="date"
                        value={filterFechaSalidaDesde}
                        onChange={(e) => setFilterFechaSalidaDesde(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Salida hasta</Label>
                      <Input
                        type="date"
                        value={filterFechaSalidaHasta}
                        onChange={(e) => setFilterFechaSalidaHasta(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Client & Product */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Cliente y Producto</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Input
                      placeholder="ID Cliente"
                      value={filterClienteId}
                      onChange={(e) => setFilterClienteId(e.target.value)}
                    />
                    <Input
                      placeholder="ID Producto"
                      value={filterProductoId}
                      onChange={(e) => setFilterProductoId(e.target.value)}
                    />
                    <Select value={filterTipoLugar} onValueChange={setFilterTipoLugar}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo de Lugar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos los tipos</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterMarca} onValueChange={setFilterMarca}>
                      <SelectTrigger>
                        <SelectValue placeholder="Marca/Compañía" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas las marcas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Personnel & Provider */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Personal y Proveedor</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Input
                      placeholder="Referido por"
                      value={filterReferidoPor}
                      onChange={(e) => setFilterReferidoPor(e.target.value)}
                    />
                    <Input
                      placeholder="Atendido por"
                      value={filterAtendidoPor}
                      onChange={(e) => setFilterAtendidoPor(e.target.value)}
                    />
                    <Input
                      placeholder="Proveedor"
                      value={filterProveedor}
                      onChange={(e) => setFilterProveedor(e.target.value)}
                    />
                    <Input placeholder="Grupo" value={filterGrupo} onChange={(e) => setFilterGrupo(e.target.value)} />
                  </div>
                </div>

                {/* Balance Range */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Rango de Balance Pendiente</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Balance mínimo</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={filterBalanceMin}
                        onChange={(e) => setFilterBalanceMin(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Balance máximo</Label>
                      <Input
                        type="number"
                        placeholder="999999.00"
                        value={filterBalanceMax}
                        onChange={(e) => setFilterBalanceMax(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Filters */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Filtros Adicionales</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Select value={filterMetodoPago} onValueChange={setFilterMetodoPago}>
                      <SelectTrigger>
                        <SelectValue placeholder="Método de Pago" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos los métodos</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterComision} onValueChange={setFilterComision}>
                      <SelectTrigger>
                        <SelectValue placeholder="Comisión" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas</SelectItem>
                        <SelectItem value="SI">Con comisión</SelectItem>
                        <SelectItem value="NO">Sin comisión</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterFacturaEnviada} onValueChange={setFilterFacturaEnviada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Factura Enviada" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas</SelectItem>
                        <SelectItem value="SI">Enviada</SelectItem>
                        <SelectItem value="NO">No enviada</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterFacturaRecibida} onValueChange={setFilterFacturaRecibida}>
                      <SelectTrigger>
                        <SelectValue placeholder="Factura Recibida" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas</SelectItem>
                        <SelectItem value="SI">Recibida</SelectItem>
                        <SelectItem value="NO">No recibida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">
              Reservas Completas ({reservasOrdenadas.length}
              {reservasOrdenadas.length !== reservas.length && ` de ${reservas.length}`})
            </CardTitle>
            <CardDescription>Haga clic en los encabezados para ordenar</CardDescription>
          </CardHeader>
          <CardContent>
            {reservasOrdenadas.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron reservas</h3>
                <p className="text-gray-500">Intenta ajustar los filtros para ver más resultados.</p>
                {activeFiltersCount > 0 && (
                  <Button onClick={clearAllFilters} variant="outline" className="mt-4 bg-transparent">
                    Limpiar todos los filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap sticky left-0 bg-white z-10 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.1)]">Acciones</TableHead>
                      <SortableTableHeader label="ID Reserva" field="id" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <TableHead className="whitespace-nowrap">ID Recibo</TableHead>
                      <SortableTableHeader label="Status" field="status" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHeader label="Precio Total" field="balance_reserva" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <TableHead className="whitespace-nowrap">Balance Pendiente</TableHead>
                      <TableHead className="whitespace-nowrap">Balance RD$</TableHead>
                      <TableHead className="whitespace-nowrap">Balance US$</TableHead>
                      <SortableTableHeader label="Total Abonado" field="balance_abonado" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <TableHead className="whitespace-nowrap">Abonado Contab.</TableHead>
                      <TableHead className="whitespace-nowrap">Identificacion</TableHead>
                      <SortableTableHeader label="Nombre Cliente" field="cliente_nombre" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <TableHead className="whitespace-nowrap">Telefono</TableHead>
                      <TableHead className="whitespace-nowrap">Servicio</TableHead>
                      <SortableTableHeader label="Fecha Entrada" field="fecha_entrada" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHeader label="Fecha Salida" field="fecha_salida" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <TableHead className="whitespace-nowrap">Noches</TableHead>
                      <TableHead className="whitespace-nowrap">Tipo Producto</TableHead>
                      <SortableTableHeader label="Pasajeros" field="pasajeros" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHeader label="Habitaciones" field="habitaciones" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <TableHead className="whitespace-nowrap">Suplidor</TableHead>
                      <TableHead className="whitespace-nowrap">Proforma</TableHead>
                      <TableHead className="whitespace-nowrap">Referido Por</TableHead>
                      <TableHead className="whitespace-nowrap">Dias Gastos Cte</TableHead>
                      <SortableTableHeader label="Fecha Limite Pago" field="fecha_limite_pago" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                      <TableHead className="whitespace-nowrap">Dias Gastos Prov</TableHead>
                      <SortableTableHeader label="Fecha Gastos Prov" field="fecha_gastos_proveedor" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservasOrdenadas.map((reserva) => {
                      const balancePendiente = (reserva.balance_reserva || 0) - (reserva.balance_abonado || 0)
                      const noches = calcularNoches(reserva.fecha_entrada, reserva.fecha_salida)
                      const diasGastosCte = calcularDiasParaFecha(reserva.fecha_limite_pago)
                      const diasGastosProv = calcularDiasParaFecha(reserva.fecha_gastos_proveedor)

                      return (
                        <TableRow key={reserva.id} className="hover:bg-gray-50">
                          {/* Acciones - sticky left */}
                          <TableCell className="whitespace-nowrap sticky left-0 bg-white z-10 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.1)]">
                            <div className="flex space-x-1">
                              <Button variant="outline" size="sm" onClick={() => router.push(`/reservas/ver/${reserva.id}`)} className="border-blue-200 text-blue-600 hover:bg-blue-50">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => router.push(`/reservas/editar/${reserva.id}`)} className="border-yellow-200 text-yellow-600 hover:bg-yellow-50">
                                <Edit className="w-4 h-4" />
                              </Button>
                              {balancePendiente > 0 && (
                                <Button variant="outline" size="sm" onClick={() => router.push(`/pagos/registrar?reserva_id=${reserva.id}`)} className="border-green-200 text-green-600 hover:bg-green-50">
                                  <DollarSign className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{reserva.id}</TableCell>
                          <TableCell className="font-mono">{reserva.codigo_reserva || reserva.codigo || "N/A"}</TableCell>
                          <TableCell>{getEstadoBadge(reserva.status)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-semibold">{formatCurrency(reserva.balance_reserva, reserva.moneda)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right text-blue-600 font-semibold">{formatCurrency(reserva.balance_general, reserva.moneda)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right text-orange-600 font-semibold">
                            {reserva.moneda === "DOP" ? formatCurrency(reserva.balance_general, "DOP") : "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right text-purple-600 font-semibold">
                            {reserva.moneda === "USD" ? formatCurrency(reserva.balance_general, "USD") : "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right text-green-600">{formatCurrency(reserva.balance_abonado, reserva.moneda)}</TableCell>
                          <TableCell className="text-center">{reserva.abonado_contabilidad || "N/A"}</TableCell>
                          <TableCell className="whitespace-nowrap">{reserva.cedula_cliente || "N/A"}</TableCell>
                          <TableCell className="whitespace-nowrap">{reserva.cliente?.nombre || "N/A"}</TableCell>
                          <TableCell className="whitespace-nowrap">{reserva.cliente?.telefonos?.split(",")[0]?.trim() || "N/A"}</TableCell>
                          <TableCell className="whitespace-nowrap">{reserva.producto?.nombre_producto || "N/A"}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateDMY(reserva.fecha_entrada)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateDMY(reserva.fecha_salida)}</TableCell>
                          <TableCell className="text-center">{noches}</TableCell>
                          <TableCell className="whitespace-nowrap">{reserva.producto?.tipo || "N/A"}</TableCell>
                          <TableCell className="text-center">{reserva.pasajeros || "N/A"}</TableCell>
                          <TableCell className="text-center">{reserva.habitaciones || "N/A"}</TableCell>
                          <TableCell className="whitespace-nowrap">{reserva.proveedor || "N/A"}</TableCell>
                          <TableCell className="whitespace-nowrap">{reserva.proforma || "N/A"}</TableCell>
                          <TableCell className="whitespace-nowrap">{reserva.referido_por || "N/A"}</TableCell>
                          <TableCell className={`text-center ${diasGastosCte !== null && diasGastosCte < 0 ? "text-red-600 font-bold" : diasGastosCte !== null && diasGastosCte <= 3 ? "text-orange-600 font-semibold" : ""}`}>
                            {diasGastosCte !== null ? diasGastosCte : "N/A"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateDMY(reserva.fecha_limite_pago)}</TableCell>
                          <TableCell className={`text-center ${diasGastosProv !== null && diasGastosProv < 0 ? "text-red-600 font-bold" : diasGastosProv !== null && diasGastosProv <= 3 ? "text-orange-600 font-semibold" : ""}`}>
                            {diasGastosProv !== null ? diasGastosProv : "N/A"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateDMY(reserva.fecha_gastos_proveedor)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Balance pendiente:{" "}
              {selectedReserva &&
                formatCurrency(
                  (selectedReserva.balance_reserva || 0) - (selectedReserva.balance_abonado || 0),
                  selectedReserva.moneda,
                )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Monto a pagar</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
              {paymentAmount && selectedReserva && (
                <p className="text-sm text-gray-500 mt-1">
                  Balance restante después del pago:{" "}
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(
                      Math.max(
                        0,
                        (selectedReserva.balance_reserva || 0) -
                          (selectedReserva.balance_abonado || 0) -
                          Number.parseFloat(paymentAmount || "0"),
                      ),
                      selectedReserva.moneda,
                    )}
                  </span>
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="method">Método de pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TARJETA">Tarjeta</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRegistrarPago} disabled={processing} className="bg-green-600 hover:bg-green-700">
                {processing ? "Procesando..." : "Registrar Pago"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
