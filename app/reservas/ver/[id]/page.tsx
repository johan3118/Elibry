"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ArrowLeft,
  Edit,
  User,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Building,
  Phone,
  CreditCard,
  Clock,
  Printer,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { PaymentReceipt } from "@/components/payment-receipt"
import { TimeFormatToggle, formatTimeWithPreference } from "@/components/time-format-toggle"

interface Cliente {
  id: number
  nombre?: string
  apellido?: string
  nombre_completo?: string
  razon_social?: string
  telefonos?: string
  email?: string
  identificacion?: string
  rnc?: string
  status?: string
}

interface Producto {
  id: number
  nombre_producto?: string
  tipo?: string
  pais?: string
  direccion?: string
  status?: string
}

interface ReservaDetalle {
  id: number
  reserva_id: number
  concepto: string
  descripcion?: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  impuestos: number
  total: number
  noches: number
  pasajeros: number
  habitaciones?: number
  fecha_creado: string
  fecha_editado: string
  registrado_por: string
  editado_por?: string
}

interface Pago {
  id: number
  reserva_id: number
  monto: string
  metodo_pago?: string
  concepto?: string
  referencia?: string
  fecha_pago?: string
  registrado_por?: string
  fecha_creado?: string
  status?: string
}

interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  producto_id: number
  cedula_cliente?: string
  fecha_entrada?: string
  fecha_salida?: string
  hora_entrada?: string
  hora_salida?: string
  pasajeros: number
  habitaciones?: number
  precio_unitario?: number
  precio_total: number
  descuento?: number
  impuestos?: number
  moneda?: string
  metodo_pago?: string
  status: string
  fecha_limite_pago?: string
  balance_reserva?: number
  balance_general?: number
  balance_abonado?: number
  referido_por?: string
  atendido_por?: string
  proveedor?: string
  proforma?: string
  grupo?: string
  asientos_bus?: string
  comision?: string
  factura_enviada_cliente?: string
  factura_recibida_proveedor?: string
  abonado_contabilidad?: number
  fecha_gastos_proveedor?: string
  nota_interna_reserva?: string
  fecha_creado?: string
  fecha_editado?: string
  editado_por?: string
  registrado_por?: string
}

export default function VerReservaPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [reserva, setReserva] = useState<Reserva | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [producto, setProducto] = useState<Producto | null>(null)
  const [detalles, setDetalles] = useState<ReservaDetalle[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null)
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [is24HourFormat, setIs24HourFormat] = useState(true)
  const supabase = createClient()

  const reservaId = params.id as string

  useEffect(() => {
    const loadReservaData = async () => {
      try {
        setLoading(true)

        // Cargar datos de la reserva
        const { data: reservaData, error: reservaError } = await supabase
          .from("reservas")
          .select("*")
          .eq("id", reservaId)
          .single()

        if (reservaError) {
          throw reservaError
        }

        // Cargar pagos de la reserva
        const { data: pagosData, error: pagosError } = await supabase
          .from("pagos")
          .select("*")
          .eq("reserva_id", reservaId)
          .order("fecha_creado", { ascending: false })

        if (pagosError) {
        }

        // Calcular balances correctos basados en pagos reales
        const precioTotal = Number.parseFloat(reservaData.precio_total || 0)
        const totalPagosRealizados = (pagosData || []).reduce((sum, pago) => {
          return sum + Number.parseFloat(pago.monto || 0)
        }, 0)
        const saldoRestante = precioTotal - totalPagosRealizados
        const abonadoContabilidadFijo = Number.parseFloat(reservaData.abonado_contabilidad || 0)

        // Actualizar reserva con lógica correcta
        const reservaActualizada = {
          ...reservaData,
          balance_reserva: precioTotal,
          balance_general: saldoRestante,
          balance_abonado: totalPagosRealizados,
          abonado_contabilidad: abonadoContabilidadFijo,
          status:
            saldoRestante <= 0 && precioTotal > 0
              ? "PAGADA"
              : totalPagosRealizados > 0 && saldoRestante > 0
                ? "PARCIAL"
                : reservaData.status || "PENDIENTE",
        }

        setReserva(reservaActualizada)
        setPagos(pagosData || [])

        // Cargar datos del cliente
        const { data: clienteData, error: clienteError } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", reservaData.cliente_id)
          .single()

        if (!clienteError) {
          setCliente(clienteData)
        }

        // Cargar datos del producto
        const { data: productoData, error: productoError } = await supabase
          .from("productos")
          .select("*")
          .eq("id", reservaData.producto_id)
          .single()

        if (!productoError) {
          setProducto(productoData)
        }

        // Cargar detalles de la reserva
        const { data: detallesData, error: detallesError } = await supabase
          .from("reserva_detalles")
          .select("*")
          .eq("reserva_id", reservaId)
          .order("id", { ascending: true })

        if (!detallesError) {
          setDetalles(detallesData || [])
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Error al cargar los datos de la reserva",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (reservaId) {
      loadReservaData()
    }
  }, [reservaId])

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, "0")
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      const month = months[date.getMonth()]
      const year = date.getFullYear()
      return `${day}-${month}-${year}`
    } catch {
      return "Fecha invalida"
    }
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleString("es-DO", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Fecha inválida"
    }
  }

  const formatCurrency = (amount: number, currency = "DOP") => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: currency === "DOP" ? "DOP" : "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status?: string) => {
    if (!status) return "bg-gray-100 text-gray-800"
    switch (status.toLowerCase()) {
      case "confirmada":
        return "bg-blue-100 text-blue-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "pagada":
        return "bg-green-100 text-green-800"
      case "parcial":
        return "bg-orange-100 text-orange-800"
      case "cancelada":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleShowReceipt = (pago: Pago) => {
    setSelectedPago(pago)
    setShowReceiptDialog(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3399cc] mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando detalles de la reserva...</p>
        </div>
      </div>
    )
  }

  if (!reserva) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Reserva no encontrada</h2>
          <p className="text-gray-600 mb-4">La reserva solicitada no existe o no tienes permisos para verla.</p>
          <Link href="/reservas/pendientes">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Reservas
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const noches =
    reserva.fecha_entrada && reserva.fecha_salida
      ? Math.ceil(
          (new Date(reserva.fecha_salida).getTime() - new Date(reserva.fecha_entrada).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/reservas/pendientes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Reservas
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[#3399cc]">Detalles de Reserva: {reserva.codigo}</h1>
              <p className="text-sm text-gray-500">Información completa de la reservación</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <TimeFormatToggle onChange={setIs24HourFormat} />
            <Button
              onClick={() => router.push(`/reservas/editar/${reserva.id}`)}
              className="bg-[#3399cc] hover:bg-[#2980b9] text-white"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar Reserva
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Resumen Financiero */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Precio Total Original</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(reserva.balance_reserva || 0, reserva.moneda)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Pagado</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(reserva.balance_abonado || 0, reserva.moneda)}
                  </p>
                </div>
                <CreditCard className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Saldo Restante</p>
                  <p className="text-2xl font-bold text-[#3399cc]">
                    {formatCurrency(reserva.balance_general || 0, reserva.moneda)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-[#3399cc]" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  <Badge className={getStatusColor(reserva.status)}>{reserva.status}</Badge>
                </div>
                <FileText className="w-8 h-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#3399cc] flex items-center">
                <User className="w-5 h-5 mr-2" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-600">ID Cliente</Label>
                <p className="font-medium">{reserva.cliente_id}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Nombre Completo</Label>
                <p className="font-medium">
                  {cliente?.nombre_completo || cliente?.razon_social || "Cliente no encontrado"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Identificación</Label>
                <p className="font-mono text-sm">{cliente?.identificacion || cliente?.rnc || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Teléfono</Label>
                <p className="flex items-center">
                  <Phone className="w-4 h-4 mr-1" />
                  {cliente?.telefonos?.split(",")[0] || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Email</Label>
                <p className="text-sm">{cliente?.email || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Referido Por</Label>
                <p>{reserva.referido_por || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Atendido Por</Label>
                <p>{reserva.atendido_por}</p>
              </div>
            </CardContent>
          </Card>

          {/* Información de la Reserva */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#3399cc] flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Detalles de la Reserva
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-600">ID Reserva</Label>
                <p className="font-medium text-[#3399cc]">{reserva.codigo}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Lugar</Label>
                <p className="font-medium">{producto?.nombre_producto || "Producto no encontrado"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">ID Lugar</Label>
                <p>{reserva.producto_id}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Tipo de Lugar</Label>
                <Badge variant="outline">{producto?.tipo || "N/A"}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Pasajeros</Label>
                  <p className="font-medium">{reserva.pasajeros}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Habitaciones</Label>
                  <p className="font-medium">{reserva.habitaciones || 0}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Status</Label>
                <Badge className={getStatusColor(reserva.status)}>{reserva.status}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Fechas y Horarios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#3399cc] flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Fechas y Horarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Fecha Entrada</Label>
                  <p className="font-medium">{formatDate(reserva.fecha_entrada)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Hora Entrada</Label>
                  <p>{formatTimeWithPreference(reserva.hora_entrada, is24HourFormat)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Fecha Salida</Label>
                  <p className="font-medium">{formatDate(reserva.fecha_salida)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Hora Salida</Label>
                  <p>{formatTimeWithPreference(reserva.hora_salida, is24HourFormat)}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Total de Noches</Label>
                <p className="font-medium text-[#006600]">{noches} noches</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Fecha Límite de Pago</Label>
                <p>{formatDate(reserva.fecha_limite_pago)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Fecha Gastos Proveedor</Label>
                <p>{formatDate(reserva.fecha_gastos_proveedor)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Información Financiera */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#006600] flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Información Financiera
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-600">Balance Reserva (Total Original)</Label>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(reserva.balance_reserva || 0, reserva.moneda)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Balance General (Saldo Restante)</Label>
                <p className="text-lg font-bold text-[#3399cc]">
                  {formatCurrency(reserva.balance_general || 0, reserva.moneda)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Total Pagos Realizados</Label>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(reserva.balance_abonado || 0, reserva.moneda)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Abonado Contabilidad (Campo Fijo)</Label>
                <p className="font-medium text-[#006600]">
                  {formatCurrency(Number.parseFloat(reserva.abonado_contabilidad?.toString() || "0"), reserva.moneda)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Método de Pago</Label>
                <p>{reserva.metodo_pago || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Moneda</Label>
                <p className="font-semibold text-blue-600">{reserva.moneda || "DOP"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Historial de Pagos con botón de recibo */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-[#006600] flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Historial de Pagos
              </CardTitle>
              <CardDescription>
                {pagos.length > 0 ? `${pagos.length} pagos registrados` : "No hay pagos registrados"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pagos.length > 0 ? (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Pago</TableHead>
                        <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Registrado Por</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagos.map((pago) => (
                        <TableRow key={pago.id}>
                          <TableCell className="font-medium">{pago.id}</TableCell>
                          <TableCell>{formatDateTime(pago.fecha_pago || pago.fecha_creado)}</TableCell>
                          <TableCell className="font-bold text-green-600">
                            {formatCurrency(Number.parseFloat(pago.monto || "0"), reserva.moneda)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{pago.metodo_pago || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>{pago.concepto || "Pago de reserva"}</TableCell>
                          <TableCell>{pago.registrado_por || "N/A"}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowReceipt(pago)}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Printer className="w-4 h-4 mr-1" />
                              Recibo
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-gray-700">Total Pagado:</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(
                          pagos.reduce((sum, pago) => sum + Number.parseFloat(pago.monto || "0"), 0),
                          reserva.moneda,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pagos registrados</h3>
                  <p className="text-gray-500">Esta reserva aún no tiene pagos asociados.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conceptos/Servicios de la Reserva */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-[#3399cc] flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Conceptos y Servicios de la Reserva
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detalles.length > 0 ? (
                <div className="space-y-4">
                  {detalles.map((detalle, index) => (
                    <div key={detalle.id} className="border rounded-lg p-4 bg-gray-50">
                      <p className="text-sm font-semibold text-[#3399cc] mb-3">Servicio #{index + 1}{detalle.concepto ? ` — ${detalle.concepto}` : ""}</p>
                      {detalle.descripcion && (
                        <p className="text-sm text-gray-500 mb-3 italic">{detalle.descripcion}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Pasajeros</Label>
                          <p className="font-semibold text-purple-700">{detalle.pasajeros ?? 0}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Habitaciones</Label>
                          <p className="font-semibold text-blue-700">{(detalle.habitaciones === 0 || !detalle.habitaciones) ? "N/A" : detalle.habitaciones}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Noches</Label>
                          <p className="font-semibold">{detalle.noches ?? 1}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Precio Unitario</Label>
                          <p className="font-semibold text-[#006600]">{formatCurrency(detalle.precio_unitario || 0, reserva.moneda)}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Descuento</Label>
                          <p className="font-semibold text-orange-600">- {formatCurrency(detalle.descuento || 0, reserva.moneda)}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Subtotal</Label>
                          <p className="font-semibold text-[#006600]">{formatCurrency(detalle.subtotal || 0, reserva.moneda)}</p>
                        </div>
                        <div className="md:col-span-2 border-t pt-2 mt-1">
                          <Label className="text-xs font-medium text-gray-500">Total del Servicio</Label>
                          <p className="text-lg font-bold text-[#006600]">{formatCurrency(detalle.total || 0, reserva.moneda)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-4 mt-4 bg-blue-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Total General</p>
                        <p className="text-xl font-bold text-[#006600]">
                          {formatCurrency(detalles.reduce((sum, d) => sum + (d.total || 0), 0), reserva.moneda)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Total Habitaciones</p>
                        <p className="text-xl font-bold text-blue-700">
                          {detalles.every((d) => !d.habitaciones || d.habitaciones === 0)
                            ? "N/A"
                            : detalles.reduce((sum, d) => sum + (d.habitaciones || 0), 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Total Pasajeros</p>
                        <p className="text-xl font-bold text-purple-700">
                          {detalles.reduce((sum, d) => sum + (d.pasajeros || 0), 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-[#3399cc] mb-3">Servicio #1 — Servicio Principal</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Pasajeros</Label>
                      <p className="font-semibold text-purple-700">{reserva.pasajeros ?? 0}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Habitaciones</Label>
                      <p className="font-semibold text-blue-700">{reserva.habitaciones || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Precio Total</Label>
                      <p className="font-bold text-[#006600]">{formatCurrency(reserva.precio_total || 0, reserva.moneda)}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Descuento</Label>
                      <p className="font-semibold text-orange-600">- {formatCurrency(reserva.descuento || 0, reserva.moneda)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Sin detalles de servicio registrados para esta reserva.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información Administrativa */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#3399cc] flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Información Administrativa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-600">Proveedor</Label>
                <p className="font-medium">{reserva.proveedor || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Proforma</Label>
                <p>{reserva.proforma || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Registro Comisión</Label>
                <Badge variant={reserva.comision === "SI" ? "default" : "secondary"}>{reserva.comision || "NO"}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Factura Enviada al Cliente</Label>
                <Badge variant={reserva.factura_enviada_cliente === "SI" ? "default" : "secondary"}>
                  {reserva.factura_enviada_cliente || "NO"}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Factura Recibida del Proveedor</Label>
                <Badge variant={reserva.factura_recibida_proveedor === "SI" ? "default" : "secondary"}>
                  {reserva.factura_recibida_proveedor || "NO"}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Grupo</Label>
                <p>{reserva.grupo || "N/A"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Asientos (Bus)</Label>
                <p className="font-medium text-[#006600]">{reserva.asientos_bus || 0} asientos</p>
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#3399cc] flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Notas y Observaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm font-medium text-gray-600">Nota Interna</Label>
                <p className="mt-1 p-3 bg-gray-50 rounded-md text-sm">{reserva.nota_interna_reserva || "Sin notas"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog para mostrar recibo */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recibo de Pago</DialogTitle>
          </DialogHeader>
          {selectedPago && reserva && cliente && (
            <PaymentReceipt
              pago={{
                id: selectedPago.id,
                monto: Number.parseFloat(selectedPago.monto || "0"),
                moneda: reserva.moneda || "DOP",
                metodo_pago: selectedPago.metodo_pago || "N/A",
                concepto: selectedPago.concepto,
                referencia: selectedPago.referencia,
                fecha_pago: selectedPago.fecha_pago || selectedPago.fecha_creado || new Date().toISOString(),
                registrado_por: selectedPago.registrado_por,
              }}
              reserva={{
                codigo: reserva.codigo,
                balance_reserva: reserva.balance_reserva || 0,
                balance_abonado: reserva.balance_abonado || 0,
                balance_general: reserva.balance_general || 0,
              }}
              cliente={{
                nombre: cliente.nombre_completo || cliente.razon_social || "N/A",
                identificacion: cliente.identificacion || cliente.rnc,
                telefono: cliente.telefonos?.split(",")[0],
                email: cliente.email,
              }}
              onClose={() => setShowReceiptDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
