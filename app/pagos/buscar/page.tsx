"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DollarSign, Search, Eye, Download, ArrowLeft, CreditCard, Plus, Receipt, Info, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { generateReciboHTML, openDocumentInNewWindow } from "@/lib/document-generator"
import { useUser } from "@/lib/user-context"

interface Cliente {
  id: number
  tipo_cliente: string
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
}

interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  producto_id: number
  precio_total: number
  moneda?: string
}

interface Pago {
  id: number
  reserva_id: number
  cliente_id: number
  monto: number
  metodo_pago: string
  fecha_pago: string
  referencia?: string
  concepto?: string
  numero_recibo?: string
  estado?: string
}

export default function BuscarPagosPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [pagos, setPagos] = useState<Pago[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const { toast } = useToast()
  const { user } = useUser()

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        const { data: pagosData, error: pagosError } = await supabase
          .from("pagos")
          .select("*")
          .order("fecha_pago", { ascending: false })

        if (pagosError) throw pagosError

        const { data: reservasData, error: reservasError } = await supabase.from("reservas").select("*")

        if (reservasError) throw reservasError

        const { data: clientesData, error: clientesError } = await supabase.from("clientes").select("*")

        if (clientesError) throw clientesError

        const { data: productosData, error: productosError } = await supabase.from("productos").select("*")

        if (productosError) throw productosError

        setPagos(pagosData || [])
        setReservas(reservasData || [])
        setClientes(clientesData || [])
        setProductos(productosData || [])
      } catch (error) {
        console.error("Error cargando datos:", error)
        toast({
          title: "Error",
          description: "Error al cargar los datos",
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
    if (!cliente) {
      return {
        nombre: "Cliente no encontrado",
        identificacion: "N/A",
        telefono: "",
        email: "",
        direccion: "Dirección no disponible",
      }
    }

    // Usar razon_social para EMPRESA, nombre_completo para otros
    const nombre =
      cliente.tipo_cliente === "EMPRESA" ? cliente.razon_social || "Empresa" : cliente.nombre_completo || "Cliente"

    return {
      nombre: nombre,
      identificacion: cliente.identificacion || cliente.rnc || "N/A",
      telefono: cliente.telefonos || "",
      email: cliente.email || "",
      direccion: "Dirección no disponible",
    }
  }

  const getProductoData = (productoId: number) => {
    const producto = productos.find((p) => p.id === productoId)
    return {
      nombre: producto?.nombre_producto || "Producto no encontrado",
      tipo: producto?.tipo || "N/A",
    }
  }

  const getReservaData = (reservaId: number) => {
    return reservas.find((r) => r.id === reservaId)
  }

  const regenerarRecibo = async (pago: Pago) => {
    try {
      const reservaData = getReservaData(pago.reserva_id)
      if (!reservaData) {
        toast({
          title: "Error",
          description: "Reserva no encontrada",
          variant: "destructive",
        })
        return
      }

      const clienteData = getClienteData(reservaData.cliente_id)
      const productoData = getProductoData(reservaData.producto_id)

      const reciboData = {
        cliente: {
          nombre: clienteData.nombre,
          email: clienteData.email,
          telefono: clienteData.telefono,
          direccion: clienteData.direccion,
        },
        pago: {
          id: pago.numero_recibo || `REC-${pago.id}`,
          monto: Number.parseFloat(pago.monto?.toString() || "0") || 0,
                  metodo: pago.metodo_pago || "N/A",
                  referencia: pago.referencia || "N/A",
                  fecha: (() => {
                    try {
                      const date = new Date(pago.fecha_pago)
                      const day = date.getDate().toString().padStart(2, "0")
                      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
                      const month = months[date.getMonth()]
                      const year = date.getFullYear()
                      return `${day}-${month}-${year}`
                    } catch {
                      return "N/A"
                    }
                  })(),
                  moneda: reservaData.moneda || "DOP",
        },
        reserva: {
          numero: reservaData.id.toString(),
          servicio: productoData.nombre,
          total: reservaData.precio_total || 0,
        },
        empresa: {
          nombre: "Grupo Ellibry",
          direccion: "Santo Domingo, República Dominicana",
          telefono: "(809) 123-4567",
          email: "info@grupoellibry.com",
        },
      }

      const reciboHTML = generateReciboHTML(reciboData)
      openDocumentInNewWindow(reciboHTML, `Recibo - ${reciboData.pago.id}`)

      toast({
        title: "Éxito",
        description: "Recibo generado correctamente",
      })
    } catch (error) {
      console.error("Error regenerando recibo:", error)
      toast({
        title: "Error",
        description: "Error al generar el recibo",
        variant: "destructive",
      })
    }
  }

  const filteredPagos = pagos.filter((pago) => {
    const reservaData = getReservaData(pago.reserva_id)
    if (!reservaData) return false

    const clienteData = getClienteData(reservaData.cliente_id)
    const productoData = getProductoData(reservaData.producto_id)

    const searchTerm = searchQuery.toLowerCase()
    const matchesSearch =
      clienteData.nombre.toLowerCase().includes(searchTerm) ||
      reservaData.id.toString().includes(searchTerm) ||
      productoData.nombre.toLowerCase().includes(searchTerm) ||
      (pago.metodo_pago && pago.metodo_pago.toLowerCase().includes(searchTerm)) ||
      (pago.referencia && pago.referencia.toLowerCase().includes(searchTerm))

    const pagoEstado = (pago.estado || "").toLowerCase()
    const matchesStatus = statusFilter === "todos" || pagoEstado === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (estado?: string) => {
    if (!estado) return "bg-gray-100 text-gray-800"

    switch (estado.toLowerCase()) {
      case "activo":
        return "bg-green-100 text-green-800"
      case "anulado":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const totalPagos = filteredPagos.reduce(
    (sum, pago) => sum + (Number.parseFloat(pago.monto?.toString() || "0") || 0),
    0,
  )
  const pagosActivos = filteredPagos.filter((pago) => (pago.estado || "").toLowerCase() === "activo").length
  const pagosAnulados = filteredPagos.filter((pago) => (pago.estado || "").toLowerCase() === "anulado").length

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
      return "N/A"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">Cargando historial de pagos...</h2>
          <p className="text-gray-500">Conectando con la base de datos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              Volver a Reservas
            </Button>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Buscar Recibos de Pagos</h1>
                <p className="text-sm text-gray-500">Historial completo de pagos y generación de recibos</p>
              </div>
            </div>
          </div>
          <Link href="/pagos/registrar">
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Pago
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-6">
        {user?.rol !== "ADMIN" && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Sistema de Cambios Provisionales:</strong> Como usuario regular, los cambios que realice serán
              marcados como provisionales y requerirán aprobación de un administrador antes de ser efectivos.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Pagos</p>
                  <p className="text-2xl font-bold text-blue-600">${totalPagos.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Receipt className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Recibos</p>
                  <p className="text-2xl font-bold text-green-600">{filteredPagos.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CreditCard className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Activos</p>
                  <p className="text-2xl font-bold text-blue-600">{pagosActivos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CreditCard className="w-8 h-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Anulados</p>
                  <p className="text-2xl font-bold text-green-600">{pagosAnulados}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-600">Filtros de Búsqueda</CardTitle>
            <CardDescription>Busque pagos por cliente, reserva, producto o método de pago</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="anulado">Anulados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Historial de Pagos y Recibos</CardTitle>
            <CardDescription>
              {filteredPagos.length} pago(s) encontrado(s) de {pagos.length} total(es)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Recibo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Reserva</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPagos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="text-gray-500">
                          <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium">No se encontraron pagos</p>
                          <p className="text-sm">Intente ajustar los filtros de búsqueda</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPagos.map((pago) => {
                      const reservaData = getReservaData(pago.reserva_id)
                      const clienteData = reservaData ? getClienteData(reservaData.cliente_id) : null
                      const productoData = reservaData ? getProductoData(reservaData.producto_id) : null

                      return (
                        <TableRow key={pago.id}>
                          <TableCell>{formatDate(pago.fecha_pago)}</TableCell>
                          <TableCell className="font-mono">{pago.numero_recibo || `REC-${pago.id}`}</TableCell>
                          <TableCell>{clienteData?.nombre || "N/A"}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">#{reservaData?.id || "N/A"}</p>
                              <p className="text-xs text-gray-500">{productoData?.nombre || "N/A"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ${Number.parseFloat(pago.monto?.toString() || "0").toFixed(2)}
                          </TableCell>
                          <TableCell>{pago.metodo_pago || "N/A"}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(pago.estado)}>{pago.estado || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => regenerarRecibo(pago)}
                                className="border-green-200 text-green-600 hover:bg-green-50"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Link href={`/pagos/ver?id=${pago.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
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
    </div>
  )
}
