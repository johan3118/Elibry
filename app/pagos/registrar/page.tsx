"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, CreditCard, Search, AlertCircle, DollarSign } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { crearPagoProvisional } from "@/lib/provisional-system"
import { useUser } from "@/lib/user-context"

interface Cliente {
  id: number
  nombre_completo?: string
  razon_social?: string
  tipo_cliente: string
  email: string
  telefonos: string
  identificacion?: string
  rnc?: string
}

interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  precio_total: number
  balance_reserva?: number
  balance_general?: number
  status: string
  moneda?: string
  cliente?: Cliente
  producto?: {
    nombre_producto: string
  }
}

export default function RegistrarPagoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reservaIdParam = searchParams.get("reserva_id")
  const { user, isAdmin } = useUser()

  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [reservaSeleccionada, setReservaSeleccionada] = useState<Reserva | null>(null)
  const [searchCliente, setSearchCliente] = useState("")
  const [searchReserva, setSearchReserva] = useState("")

  const [formData, setFormData] = useState({
    reserva_id: "",
    cliente_id: "",
    monto: "",
    metodo_pago: "",
    referencia: "",
    fecha_pago: new Date().toISOString().split("T")[0],
    concepto: "",
    observaciones: "",
    status: "ACTIVO",
  })

  useEffect(() => {
    cargarClientes()
  }, [])

  // Auto-load reservation if reserva_id is provided in URL
  useEffect(() => {
    if (reservaIdParam) {
      cargarReservaDirecta(Number(reservaIdParam))
    }
  }, [reservaIdParam])

  useEffect(() => {
    if (clienteSeleccionado) {
      cargarReservasCliente(clienteSeleccionado.id)
    }
  }, [clienteSeleccionado])

  const cargarReservaDirecta = async (reservaId: number) => {
    try {
      // Load the reservation directly
      const { data: reservaData, error: reservaError } = await supabase
        .from("reservas")
        .select("*")
        .eq("id", reservaId)
        .single()

      if (reservaError || !reservaData) {
        console.error("Error cargando reserva:", reservaError)
        return
      }

      // Load the client for this reservation
      const { data: clienteData, error: clienteError } = await supabase
        .from("clientes")
        .select("id, nombre_completo, razon_social, tipo_cliente, email, telefonos, identificacion, rnc")
        .eq("id", reservaData.cliente_id)
        .single()

      if (clienteError || !clienteData) {
        console.error("Error cargando cliente:", clienteError)
        return
      }

      // Load producto for display
      let productoNombre = "N/A"
      if (reservaData.producto_id) {
        const { data: productoData } = await supabase
          .from("productos")
          .select("nombre_producto")
          .eq("id", reservaData.producto_id)
          .single()
        if (productoData) {
          productoNombre = productoData.nombre_producto
        }
      }

      // Set the client and reservation
      setClienteSeleccionado(clienteData)
      const reservaConProducto = {
        ...reservaData,
        producto: { nombre_producto: productoNombre },
      }
      setReservas([reservaConProducto])
      setReservaSeleccionada(reservaConProducto)
      setFormData((prev) => ({
        ...prev,
        reserva_id: reservaData.id.toString(),
        cliente_id: reservaData.cliente_id.toString(),
      }))
    } catch (error) {
      console.error("Error cargando reserva directa:", error)
    }
  }

  const cargarClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre_completo, razon_social, tipo_cliente, email, telefonos, identificacion, rnc")
        .eq("status", "ACTIVO")
        .order("nombre_completo", { ascending: true })

      if (error) {
        console.error("Error cargando clientes:", error)
        return
      }

      setClientes(data || [])
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const cargarReservasCliente = async (clienteId: number) => {
    try {
      // First get reservas
      const { data: reservasData, error: reservasError } = await supabase
        .from("reservas")
        .select(`
          id,
          codigo,
          cliente_id,
          precio_total,
          balance_reserva,
          balance_general,
          status,
          producto_id,
          moneda
        `)
        .eq("cliente_id", clienteId)
        .in("status", ["CONFIRMADA", "ACTIVA", "PENDIENTE"])
        .order("fecha_creado", { ascending: false })

      if (reservasError) {
        console.error("Error cargando reservas:", reservasError)
        return
      }

      // Then get productos separately
      const productosIds = reservasData?.map((r) => r.producto_id).filter(Boolean) || []

      let productosData = []
      if (productosIds.length > 0) {
        const { data: productos, error: productosError } = await supabase
          .from("productos")
          .select("id, nombre_producto")
          .in("id", productosIds)

        if (!productosError) {
          productosData = productos || []
        }
      }

      // Combine the data
      const reservasConProductos =
        reservasData?.map((reserva) => ({
          ...reserva,
          producto: productosData.find((p) => p.id === reserva.producto_id),
        })) || []

      setReservas(reservasConProductos)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const clientesFiltrados = clientes.filter((cliente) => {
    if (!searchCliente) return true
    const nombre = cliente.tipo_cliente === "EMPRESA" ? cliente.razon_social : cliente.nombre_completo
    const doc = cliente.identificacion || cliente.rnc || ""
    const term = searchCliente.toLowerCase()
    return (
      nombre?.toLowerCase().includes(term) ||
      cliente.email.toLowerCase().includes(term) ||
      doc.toLowerCase().includes(term)
    )
  })

  const reservasFiltradas = reservas.filter((reserva) => {
    if (!searchReserva) return true
    return reserva.id.toString().includes(searchReserva.toLowerCase())
  })

  const handleClienteSelect = (cliente: Cliente) => {
    setClienteSeleccionado(cliente)
    setFormData((prev) => ({
      ...prev,
      cliente_id: cliente.id.toString(),
    }))
    setSearchCliente("")
    setReservaSeleccionada(null)
    setFormData((prev) => ({
      ...prev,
      reserva_id: "",
    }))
  }

  const handleReservaSelect = (reserva: Reserva) => {
    setReservaSeleccionada(reserva)
    setFormData((prev) => ({
      ...prev,
      reserva_id: reserva.id.toString(),
      monto: (reserva.balance_general || reserva.balance_reserva || reserva.precio_total).toString(),
    }))
    setSearchReserva("")
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateForm = () => {
    if (!formData.cliente_id) {
      alert("Debe seleccionar un cliente")
      return false
    }
    if (!formData.reserva_id) {
      alert("Debe seleccionar una reserva")
      return false
    }
    if (!formData.monto || Number.parseFloat(formData.monto) <= 0) {
      alert("Debe ingresar un monto válido")
      return false
    }
    if (!formData.metodo_pago) {
      alert("Debe seleccionar un método de pago")
      return false
    }
    if (!formData.concepto) {
      alert("Debe ingresar un concepto para el pago")
      return false
    }
    return true
  }

  const formatCurrency = (amount: number, currency = "DOP") => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: currency === "DOP" ? "DOP" : "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const pagoData = {
        reserva_id: Number.parseInt(formData.reserva_id),
        cliente_id: Number.parseInt(formData.cliente_id),
        monto: Number.parseFloat(formData.monto),
        metodo_pago: formData.metodo_pago,
        referencia: formData.referencia || null,
        fecha_pago: formData.fecha_pago,
        concepto: formData.concepto,
        notas: formData.observaciones || null,
        estado: formData.status,
        usuario: user?.nombre || "Usuario Sistema",
        creado_en: new Date().toISOString(),
      }

      if (isAdmin) {
        // Si es admin, crear el pago directamente
        const { data, error } = await supabase
          .from("pagos")
          .insert([
            {
              ...pagoData,
              estado_registro: "PERMANENTE",
            },
          ])
          .select()

        if (error) {
          alert("Error al crear el pago: " + error.message)
          return
        }

        alert("Pago registrado exitosamente")
        router.push("/reservas/pendientes")
      } else {
        // Si es usuario normal, crear como provisional
        const result = await crearPagoProvisional(pagoData, user?.nombre || "Usuario Sistema")

        if (result.success) {
          alert("Solicitud de pago enviada para aprobación del administrador. Será procesada en breve.")
          router.push("/reservas/pendientes")
        } else {
          alert("Error al enviar la solicitud: " + result.error)
        }
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Error inesperado al procesar la solicitud")
    } finally {
      setLoading(false)
    }
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
              onClick={() => router.push("/reservas/pendientes")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Reservas Pendientes
            </Button>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Registrar Pago</h1>
                <p className="text-sm text-gray-500">Registrar nuevo pago de reserva</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Mensaje informativo para usuarios normales */}
        {!isAdmin && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Registro de Pago Pendiente</p>
                  <p className="text-xs text-blue-700">
                    Tu solicitud de pago será enviada para aprobación administrativa antes de ser procesada.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerta de moneda cuando se selecciona una reserva */}
        {reservaSeleccionada && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <DollarSign className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Moneda de la reserva:</strong> {reservaSeleccionada.moneda || "DOP"}. El pago debe realizarse en
              la misma moneda que la reserva.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Selección de Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Seleccionar Cliente</CardTitle>
                <CardDescription>Buscar y seleccionar el cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar cliente por nombre o email..."
                    value={searchCliente}
                    onChange={(e) => setSearchCliente(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {clienteSeleccionado && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-green-800">
                          {clienteSeleccionado.tipo_cliente === "EMPRESA"
                            ? clienteSeleccionado.razon_social
                            : clienteSeleccionado.nombre_completo}
                        </p>
                        <p className="text-sm text-green-600">
                          {clienteSeleccionado.identificacion || clienteSeleccionado.rnc || "Sin ID"} | {clienteSeleccionado.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">Seleccionado</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setClienteSeleccionado(null)
                            setReservaSeleccionada(null)
                            setReservas([])
                            setFormData((prev) => ({ ...prev, cliente_id: "", reserva_id: "" }))
                          }}
                        >
                          X
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {searchCliente && !clienteSeleccionado && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {clientesFiltrados.map((cliente) => {
                      const nombre = cliente.tipo_cliente === "EMPRESA" ? cliente.razon_social : cliente.nombre_completo
                      const doc = cliente.identificacion || cliente.rnc || "Sin ID"
                      return (
                      <div
                        key={cliente.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => handleClienteSelect(cliente)}
                      >
                        <p className="font-semibold">
                          {nombre} <span className="text-blue-600 font-normal">({doc})</span>
                        </p>
                        <p className="text-sm text-gray-500">{cliente.email}</p>
                      </div>
                      )
                    })}
                    {clientesFiltrados.length === 0 && (
                      <p className="p-3 text-gray-500 text-center">No se encontraron clientes</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selección de Reserva */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Seleccionar Reserva</CardTitle>
                <CardDescription>Reservas activas del cliente seleccionado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!clienteSeleccionado ? (
                  <p className="text-gray-500 text-center py-8">Primero selecciona un cliente para ver sus reservas</p>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar reserva por ID..."
                        value={searchReserva}
                        onChange={(e) => setSearchReserva(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {reservaSeleccionada && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-blue-800">Reserva: {reservaSeleccionada.id}</p>
                            <p className="text-sm text-blue-600">
                              Balance: {reservaSeleccionada.moneda || "DOP"}{" "}
                              {formatCurrency(
                                reservaSeleccionada.balance_general ||
                                  reservaSeleccionada.balance_reserva ||
                                  reservaSeleccionada.precio_total,
                                reservaSeleccionada.moneda,
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800">Seleccionada</Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setReservaSeleccionada(null)
                                setFormData((prev) => ({ ...prev, reserva_id: "" }))
                              }}
                            >
                              X
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {(!reservaSeleccionada || searchReserva) && (
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        {reservasFiltradas.map((reserva) => (
                          <div
                            key={reserva.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            onClick={() => handleReservaSelect(reserva)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold">{reserva.id}</p>
                                <p className="text-sm text-gray-500">{reserva.producto?.nombre_producto}</p>
                                <p className="text-xs text-gray-400">Moneda: {reserva.moneda || "DOP"}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(
                                    reserva.balance_general || reserva.balance_reserva || reserva.precio_total,
                                    reserva.moneda,
                                  )}
                                </p>
                                <Badge variant="outline">{reserva.status}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                        {reservasFiltradas.length === 0 && (
                          <p className="p-3 text-gray-500 text-center">No se encontraron reservas activas</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detalles del Pago */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">Detalles del Pago</CardTitle>
              <CardDescription>Información del pago a registrar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="monto">Monto *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="monto"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.monto}
                      onChange={(e) => handleInputChange("monto", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {reservaSeleccionada && (
                    <p className="text-xs text-gray-500 mt-1">
                      Moneda: {reservaSeleccionada.moneda || "DOP"} (heredada de la reserva)
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="metodo_pago">Método de Pago *</Label>
                  <Select
                    value={formData.metodo_pago}
                    onValueChange={(value) => handleInputChange("metodo_pago", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferencia Bancaria</SelectItem>
                      <SelectItem value="TARJETA_CREDITO">Tarjeta de Crédito</SelectItem>
                      <SelectItem value="TARJETA_DEBITO">Tarjeta de Débito</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="PAYPAL">PayPal</SelectItem>
                      <SelectItem value="GRATIS">Gratis</SelectItem>
                      <SelectItem value="OTROS">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="referencia">Referencia</Label>
                  <Input
                    id="referencia"
                    placeholder="Número de referencia o transacción"
                    value={formData.referencia}
                    onChange={(e) => handleInputChange("referencia", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="fecha_pago">Fecha de Pago *</Label>
                  <Input
                    id="fecha_pago"
                    type="date"
                    value={formData.fecha_pago}
                    onChange={(e) => handleInputChange("fecha_pago", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="ANULADO">Anulado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="concepto">Concepto *</Label>
                  <Input
                    id="concepto"
                    placeholder="Concepto del pago"
                    value={formData.concepto}
                    onChange={(e) => handleInputChange("concepto", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    placeholder="Observaciones adicionales sobre el pago"
                    value={formData.observaciones}
                    onChange={(e) => handleInputChange("observaciones", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/reservas/pendientes")}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Procesar Pago
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
