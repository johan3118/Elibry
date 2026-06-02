"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Search, Download, Eye, Clock, ArrowLeft } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface Cliente {
  id: number
  nombre_completo?: string
  razon_social?: string
  nombre_comercial?: string
  tipo_cliente: string
  status: string
  telefonos?: string
  email?: string
}

interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  producto_id: number
  precio_total: number
  balance_reserva?: number
  balance_general?: number
  balance_abonado?: number
  status: string
  fecha_creado: string
  fecha_entrada?: string
  fecha_salida?: string
  atendido_por: string
}

interface Producto {
  id: number
  nombre_producto: string
  tipo?: string
}

interface ReservaBalance {
  id: string
  cliente_id: number
  cliente: string
  servicio: string
  fechaReserva: string
  fechaCreacion: string
  montoTotal: number
  pagado: number
  saldoPendiente: number
  estado: string
  diasVencimiento: number
  reservaOriginal: Reserva
  esReal: boolean
  moneda: string
}

export default function BalanceReservaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteIdParam = searchParams.get("cliente_id")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [balanceReservas, setBalanceReservas] = useState<ReservaBalance[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [pagosMap, setPagosMap] = useState<Map<number, number>>(new Map())
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    cargarDatos()
  }, [clienteIdParam])

  const cargarDatos = async () => {
    try {
      setLoading(true)

      // Cargar reservas (filtrar por cliente si hay cliente_id)
      let reservasQuery = supabase
        .from("reservas")
        .select("*")
        .order("fecha_entrada", { ascending: true })
      
      if (clienteIdParam) {
        reservasQuery = reservasQuery.eq("cliente_id", parseInt(clienteIdParam))
      }
      
      const { data: reservasData, error: reservasError } = await reservasQuery

      if (reservasError) {
        console.error("Error cargando reservas:", reservasError)
        throw reservasError
      }

      // Cargar todos los pagos para calcular totales reales (igual que en reservas pendientes)
      const { data: pagosData, error: pagosError } = await supabase.from("pagos").select("reserva_id, monto")

      if (pagosError) {
        console.error("Error cargando pagos:", pagosError)
      }

      // Crear mapa de pagos por reserva (igual que en reservas pendientes)
      const pagosMapTemp = new Map<number, number>()
      pagosData?.forEach((pago: any) => {
        const reservaId = pago.reserva_id
        const monto = Number.parseFloat(pago.monto) || 0
        pagosMapTemp.set(reservaId, (pagosMapTemp.get(reservaId) || 0) + monto)
      })

      setPagosMap(pagosMapTemp)

      // Cargar clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("*")
        .eq("status", "ACTIVO")

      if (clientesError) {
        console.error("Error cargando clientes:", clientesError)
      }

      // Cargar productos
      const { data: productosData, error: productosError } = await supabase
        .from("productos")
        .select("*")
        .eq("status", "ACTIVO")

      if (productosError) {
        console.error("Error cargando productos:", productosError)
      }

      setClientes(clientesData || [])
      setProductos(productosData || [])
      
      // Find selected client if filtering
      if (clienteIdParam && clientesData) {
        const cliente = clientesData.find((c: Cliente) => c.id === parseInt(clienteIdParam))
        setClienteSeleccionado(cliente || null)
      }

      // Aplicar lógica correcta a las reservas (igual que en reservas pendientes)
      const reservasConLogicaCorrecta =
        reservasData?.map((reserva: any) => {
          const precioTotal = Number.parseFloat(reserva.precio_total || 0)
          const totalPagosRealizados = pagosMapTemp.get(reserva.id) || 0
          const saldoRestante = precioTotal - totalPagosRealizados

          return {
            ...reserva,
            balance_reserva: precioTotal,
            balance_general: saldoRestante,
            balance_abonado: totalPagosRealizados,
          }
        }) || []

      // Procesar reservas para balance
      await procesarReservasParaBalance(reservasConLogicaCorrecta, clientesData || [], productosData || [])
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

  const procesarReservasParaBalance = async (reservas: any[], clientesData: Cliente[], productosData: Producto[]) => {
    const balancesReales: ReservaBalance[] = []

    for (const reserva of reservas) {
      const cliente = clientesData.find((c) => c.id === reserva.cliente_id)
      if (!cliente) continue

      let nombreCliente = "Cliente"
      if (cliente.tipo_cliente === "EMPRESA") {
        nombreCliente = cliente.razon_social || cliente.nombre_comercial || "Empresa"
      } else {
        nombreCliente = cliente.nombre_completo || "Cliente"
      }

      // Buscar producto asociado
      const producto = productosData.find((p) => p.id === reserva.producto_id)
      const nombreServicio = producto?.nombre_producto || "Servicio"

      // Usar los valores ya calculados (igual que en reservas pendientes)
      const montoTotal = reserva.balance_reserva || 0
      const montoPagado = reserva.balance_abonado || 0
      const saldoPendiente = reserva.balance_general || 0

      // Calcular días de vencimiento basado en fecha de entrada
      let diasVencimiento = 0
      if (reserva.fecha_entrada) {
        const fechaEntrada = new Date(reserva.fecha_entrada)
        const hoy = new Date()
        diasVencimiento = Math.ceil((fechaEntrada.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Determinar estado - usar el estado de la reserva original (PENDIENTE, COMPLETADA, ANULADA)
      let estado = reserva.status || "Pendiente"
      // Normalize to capitalized form
      if (estado === "PENDIENTE") estado = "Pendiente"
      else if (estado === "COMPLETADA") estado = "Completada"
      else if (estado === "ANULADA") estado = "Anulada"

      balancesReales.push({
        id: reserva.codigo || `R-${reserva.id}`,
        cliente_id: reserva.cliente_id,
        cliente: nombreCliente,
        servicio: nombreServicio,
        fechaReserva: reserva.fecha_entrada || reserva.fecha_creado,
        fechaCreacion: reserva.fecha_creado,
        montoTotal,
        pagado: montoPagado,
        saldoPendiente,
        estado,
        diasVencimiento: Math.max(0, diasVencimiento),
        reservaOriginal: reserva,
        esReal: true,
        moneda: reserva.moneda || "DOP",
      })
    }

    setBalanceReservas(balancesReales)
  }

  const filteredReservas = balanceReservas.filter((reserva) => {
    const matchesSearch =
      reserva.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reserva.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reserva.servicio.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "todos" || reserva.estado.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "completada":
        return "bg-green-100 text-green-800"
      case "anulada":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, "0")
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      const month = months[date.getMonth()]
      const year = date.getFullYear()
      return `${day}-${month}-${year}`
    } catch {
      return "N/A"
    }
  }

  const totalReservas = filteredReservas.reduce((sum, reserva) => sum + reserva.montoTotal, 0)
  const totalPagado = filteredReservas.reduce((sum, reserva) => sum + reserva.pagado, 0)
  const totalPendiente = filteredReservas.reduce((sum, reserva) => sum + reserva.saldoPendiente, 0)
  const reservasPendientes = filteredReservas.filter((reserva) => reserva.saldoPendiente > 0).length

  const hayDatosReales = balanceReservas.length > 0 && balanceReservas[0].esReal

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando balance por reservación...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/clientes")}
            className="text-gray-600 hover:text-blue-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Clientes
          </Button>
          <div className="flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-blue-600">
                Balance por Reservacion
                {clienteSeleccionado && (
                  <span className="text-lg font-normal text-gray-600 ml-2">
                    - {clienteSeleccionado.nombre_completo || clienteSeleccionado.razon_social}
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500">
                {clienteSeleccionado 
                  ? `Reservaciones del cliente: ${clienteSeleccionado.nombre_completo || clienteSeleccionado.razon_social}`
                  : "Estado de pagos y saldos pendientes por reservacion"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reservaciones</p>
                  <p className="text-2xl font-bold text-blue-600">${totalReservas.toLocaleString()}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Pagado</p>
                  <p className="text-2xl font-bold text-green-600">${totalPagado.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold">✓</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-red-600">${totalPendiente.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold">!</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Reservas Pendientes</p>
                  <p className="text-2xl font-bold text-orange-600">{reservasPendientes}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <Search className="w-5 h-5 mr-2" />
              Filtros de Balance por Reservación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Buscar por cliente, ID de reserva o servicio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Balance Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-blue-600">Balance Detallado por Reservación</CardTitle>
                <CardDescription>
                  {filteredReservas.length > 0
                    ? `${filteredReservas.length} reservaciones en el balance - ${clientes.length} clientes activos`
                    : "No hay reservaciones registradas"}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={filteredReservas.length === 0}
                className="border-green-200 text-green-600 hover:bg-green-50 bg-transparent"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Balance
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredReservas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Reserva</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Fecha Reserva</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Pagado</TableHead>
                    <TableHead>Saldo Pendiente</TableHead>
                    <TableHead>Días para Venc.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservas.map((reserva) => (
                    <TableRow key={reserva.id}>
                      <TableCell className="font-medium">{reserva.id}</TableCell>
                      <TableCell>{reserva.cliente}</TableCell>
                      <TableCell>{reserva.servicio}</TableCell>
                      <TableCell>{formatDate(reserva.fechaReserva)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={reserva.moneda === "USD" ? "border-green-500 text-green-600" : "border-blue-500 text-blue-600"}>
                          {reserva.moneda}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{reserva.moneda === "USD" ? "US$" : "RD$"}{reserva.montoTotal.toLocaleString()}</TableCell>
                      <TableCell className="text-green-600 font-semibold">{reserva.moneda === "USD" ? "US$" : "RD$"}{reserva.pagado.toLocaleString()}</TableCell>
                      <TableCell>
                        {reserva.saldoPendiente > 0 ? (
                          <span className="text-red-600 font-semibold">{reserva.moneda === "USD" ? "US$" : "RD$"}{reserva.saldoPendiente.toLocaleString()}</span>
                        ) : (
                          <span className="text-green-600 font-semibold">{reserva.moneda === "USD" ? "US$" : "RD$"}0.00</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {reserva.diasVencimiento > 0 ? (
                          <Badge variant={reserva.diasVencimiento <= 7 ? "destructive" : "secondary"}>
                            {reserva.diasVencimiento} días
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Vencida</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(reserva.estado)}>{reserva.estado}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" title="Ver detalles" className="hover:bg-blue-50">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Estado de cuenta" className="hover:bg-green-50">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay reservaciones</h3>
                <p className="text-gray-500 mb-4">
                  {clientes.length > 0
                    ? "Las reservaciones se mostrarán cuando se registren en el sistema."
                    : "Primero registra algunos clientes para poder crear reservaciones."}
                </p>
                <div className="space-x-2">
                  {clientes.length === 0 && (
                    <Button
                      onClick={() => router.push("/clientes/registrar")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Registrar Cliente
                    </Button>
                  )}
                  <Button onClick={() => router.push("/reservas/crear")} className="bg-green-600 hover:bg-green-700">
                    <Calendar className="w-4 h-4 mr-2" />
                    Crear Reservación
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
