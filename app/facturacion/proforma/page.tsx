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
import { generateProformaHTML, openDocumentInNewWindow, type ProformaData } from "@/lib/document-generator"

interface Cliente {
  id: number
  nombre_completo?: string
  razon_social?: string
  identificacion?: string
  rnc?: string
  telefonos?: string
  email?: string
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
  precio_total: number
  descuento?: number
  impuestos?: number
  moneda?: string
  atendido_por?: string
  nota_interna_reserva?: string
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

interface EditableProformaData {
  pasajeros: string[]
  politicas: {
    cancelacion: string
    penalidad: string
    advertencia: string
  }
  realizadoPor: string
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
    pasajeros: [""],
    politicas: {
      cancelacion: "",
      penalidad: "",
      advertencia:
        "No somos responsables de no realizar pagos a tiempo y la reserva sea cancelada antes que entre en penalidad 100%, de entrar en penalidad la agencia debe cubrir el gasto.",
    },
    realizadoPor: "",
    observacion: "",
  })

  const supabase = createClient()
  const { toast } = useToast()

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

  const getClienteData = (clienteId: number) => {
    const cliente = clientes.find((c) => c.id === clienteId)
    return {
      nombre: cliente?.nombre_completo || cliente?.razon_social || "Cliente no encontrado",
      identificacion: cliente?.identificacion || cliente?.rnc || "N/A",
      telefono: cliente?.telefonos || "",
      email: cliente?.email || "",
      direccion: "Dirección no disponible", // Add default address
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

  const openEditDialog = (reserva: Reserva) => {
    const clienteData = getClienteData(reserva.cliente_id)
    const productoData = getProductoData(reserva.producto_id)

    // Configurar datos por defecto
    const fechaEntrada = new Date(reserva.fecha_entrada || new Date())
    const fechaLimite = new Date(fechaEntrada)
    fechaLimite.setDate(fechaLimite.getDate() - 1)

    setSelectedReserva(reserva)
    setEditableData({
      pasajeros: [""],
      politicas: {
        cancelacion: `50% no reembolsable en caso de cancelación antes del ${fechaLimite.toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })}`,
        penalidad: `A partir del ${fechaEntrada.toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })} penalidad 100%`,
        advertencia:
          "No somos responsables de no realizar pagos a tiempo y la reserva sea cancelada antes que entre en penalidad 100%, de entrar en penalidad la agencia debe cubrir el gasto.",
      },
      realizadoPor: reserva.atendido_por || "Usuario Sistema",
      observacion: reserva.nota_interna_reserva || "",
    })
    setEditDialogOpen(true)
  }

  const addPasajero = () => {
    setEditableData((prev) => ({
      ...prev,
      pasajeros: [...prev.pasajeros, ""],
    }))
  }

  const removePasajero = (index: number) => {
    setEditableData((prev) => ({
      ...prev,
      pasajeros: prev.pasajeros.filter((_, i) => i !== index),
    }))
  }

  const updatePasajero = (index: number, value: string) => {
    setEditableData((prev) => ({
      ...prev,
      pasajeros: prev.pasajeros.map((p, i) => (i === index ? value : p)),
    }))
  }

  const regenerarProforma = async (reserva: Reserva, customData?: EditableProformaData) => {
    try {
      const clienteData = getClienteData(reserva.cliente_id)
      const productoData = getProductoData(reserva.producto_id)
      const reservaDetalles = getReservaDetalles(reserva.id)
      const reservaPagos = getReservaPagos(reserva.id)

      // Ensure currency is always a string
      const moneda = String(reserva.moneda || "DOP")

      // Calculate totals
      const subtotal = Number(reserva.precio_total || 0) - Number(reserva.descuento || 0)
      const impuestos = Number(reserva.impuestos || 0)
      const total = subtotal + impuestos

      // Create items array matching ProformaData interface
      const items =
        reservaDetalles.length > 0
          ? reservaDetalles.map((detalle) => ({
              descripcion: String(detalle.concepto || "Servicio"),
              cantidad: Number(detalle.pasajeros || 1),
              precio: Number(detalle.precio_unitario || 0),
              total: Number(detalle.total || 0),
            }))
          : [
              {
                descripcion: `${productoData.nombre_producto} - ${reserva.pasajeros || 1} personas, ${reserva.habitaciones || 1} habitaciones`,
                cantidad: Number(reserva.pasajeros || 1),
                precio: Number(reserva.precio_total || 0),
                total: Number(reserva.precio_total || 0),
              },
            ]

      // Create ProformaData object matching the expected interface
      const proformaData: ProformaData = {
        cliente: {
          nombre: String(clienteData.nombre),
          email: String(clienteData.email),
          telefono: String(clienteData.telefono),
          direccion: String(clienteData.direccion),
        },
        items: items,
        subtotal: subtotal,
        impuestos: impuestos,
        total: total,
        moneda: moneda, // This is now guaranteed to be a string
        validez: "30 días",
        empresa: {
          nombre: "Grupo Ellibry",
          direccion: "Santo Domingo, República Dominicana",
          telefono: "(809) 123-4567",
          email: "info@grupoellibry.com",
        },
      }

      const proformaHTML = generateProformaHTML(proformaData)
      openDocumentInNewWindow(proformaHTML, `Proforma - ${reserva.codigo}`)

      toast({
        title: "Éxito",
        description: "Proforma generada correctamente",
      })
    } catch (error) {
      console.error("Error regenerando proforma:", error)
      toast({
        title: "Error",
        description: `Error al generar la proforma: ${error instanceof Error ? error.message : "Error desconocido"}`,
        variant: "destructive",
      })
    }
  }

  const handleGenerateWithCustomData = () => {
    if (selectedReserva) {
      regenerarProforma(selectedReserva, editableData)
      setEditDialogOpen(false)
    }
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
                                onClick={() => regenerarProforma(reserva)}
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
                      value={pasajero}
                      onChange={(e) => updatePasajero(index, e.target.value)}
                      placeholder="Nombre completo del pasajero..."
                      className="flex-1"
                    />
                    {editableData.pasajeros.length > 1 && (
                      <Button type="button" size="sm" variant="outline" onClick={() => removePasajero(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Políticas de Cancelación */}
            <div>
              <label className="text-sm font-medium mb-3 block">Políticas de cancelación y/o pagos</label>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Política de cancelación</label>
                  <Input
                    value={editableData.politicas.cancelacion}
                    onChange={(e) =>
                      setEditableData((prev) => ({
                        ...prev,
                        politicas: { ...prev.politicas, cancelacion: e.target.value },
                      }))
                    }
                    placeholder="Ej: 50% no reembolsable en caso de cancelación antes del..."
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Política de penalidad</label>
                  <Input
                    value={editableData.politicas.penalidad}
                    onChange={(e) =>
                      setEditableData((prev) => ({
                        ...prev,
                        politicas: { ...prev.politicas, penalidad: e.target.value },
                      }))
                    }
                    placeholder="Ej: A partir del [fecha] penalidad 100%"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Advertencia</label>
                  <Textarea
                    value={editableData.politicas.advertencia}
                    onChange={(e) =>
                      setEditableData((prev) => ({
                        ...prev,
                        politicas: { ...prev.politicas, advertencia: e.target.value },
                      }))
                    }
                    placeholder="Advertencias adicionales..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Realizada por */}
            <div>
              <label className="text-sm font-medium mb-2 block">Realizada por</label>
              <Input
                value={editableData.realizadoPor}
                onChange={(e) => setEditableData((prev) => ({ ...prev, realizadoPor: e.target.value }))}
                placeholder="Nombre de quien realiza la proforma..."
              />
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
