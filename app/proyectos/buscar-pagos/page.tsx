"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Download, Eye, CalendarIcon, Filter } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function BuscarPagosProyectosPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [proyectoFilter, setProyectoFilter] = useState("todos")
  const [metodoPagoFilter, setMetodoPagoFilter] = useState("todos")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()

  const pagosProyectos = [
    {
      id: "PAG-PROY-001",
      proyecto: "Proyecto Residencial Norte",
      cliente: "Constructora del Norte",
      fecha: "2025-01-20",
      tipoPago: "Pago Inicial",
      monto: 50000.0,
      metodoPago: "Transferencia",
      referencia: "TRF-789123",
      estado: "Procesado",
      recibo: "REC-PROY-001",
    },
    {
      id: "PAG-PROY-002",
      proyecto: "Complejo Comercial Centro",
      cliente: "Inversiones ABC",
      fecha: "2025-01-22",
      tipoPago: "Pago por Progreso",
      monto: 100000.0,
      metodoPago: "Cheque",
      referencia: "CHQ-456789",
      estado: "Procesado",
      recibo: "REC-PROY-002",
    },
    {
      id: "PAG-PROY-003",
      proyecto: "Torre de Oficinas Este",
      cliente: "Grupo Inmobiliario XYZ",
      fecha: "2025-01-25",
      tipoPago: "Pago Final",
      monto: 20000.0,
      metodoPago: "Transferencia",
      referencia: "TRF-321654",
      estado: "Pendiente",
      recibo: "",
    },
    {
      id: "PAG-PROY-004",
      proyecto: "Proyecto Residencial Norte",
      cliente: "Constructora del Norte",
      fecha: "2025-01-23",
      tipoPago: "Pago por Hito",
      monto: 75000.0,
      metodoPago: "Efectivo",
      referencia: "",
      estado: "Procesado",
      recibo: "REC-PROY-004",
    },
  ]

  const proyectos = ["Proyecto Residencial Norte", "Complejo Comercial Centro", "Torre de Oficinas Este"]

  const filteredPagos = pagosProyectos.filter((pago) => {
    const matchesSearch =
      pago.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pago.proyecto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pago.referencia.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pago.recibo.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "todos" || pago.estado.toLowerCase() === statusFilter.toLowerCase()
    const matchesProyecto = proyectoFilter === "todos" || pago.proyecto === proyectoFilter
    const matchesMetodo =
      metodoPagoFilter === "todos" || pago.metodoPago.toLowerCase() === metodoPagoFilter.toLowerCase()

    let matchesDate = true
    if (dateFrom && dateTo) {
      const pagoDate = new Date(pago.fecha)
      matchesDate = pagoDate >= dateFrom && pagoDate <= dateTo
    }

    return matchesSearch && matchesStatus && matchesProyecto && matchesMetodo && matchesDate
  })

  const getStatusColor = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "procesado":
        return "bg-green-100 text-green-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "anulado":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTipoPagoColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case "pago inicial":
        return "bg-blue-100 text-blue-800"
      case "pago por progreso":
        return "bg-purple-100 text-purple-800"
      case "pago por hito":
        return "bg-orange-100 text-orange-800"
      case "pago final":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-2">
          <Search className="w-6 h-6 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-purple-600">Buscar Pagos de Proyectos</h1>
            <p className="text-sm text-gray-500">Búsqueda avanzada de pagos asociados a proyectos inmobiliarios</p>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Advanced Search Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="w-5 h-5 mr-2" />
              Filtros de Búsqueda Avanzada
            </CardTitle>
            <CardDescription>Utilice múltiples criterios para encontrar pagos específicos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Búsqueda General</label>
                <Input
                  placeholder="Cliente, proyecto, referencia..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Proyecto</label>
                <Select value={proyectoFilter} onValueChange={setProyectoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los proyectos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los proyectos</SelectItem>
                    {proyectos.map((proyecto) => (
                      <SelectItem key={proyecto} value={proyecto}>
                        {proyecto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Estado</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="procesado">Procesado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="anulado">Anulado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Método de Pago</label>
                <Select value={metodoPagoFilter} onValueChange={setMetodoPagoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los métodos</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Fecha Desde</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Fecha Hasta</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">Resultados de la Búsqueda</p>
                <p className="text-sm text-gray-500">{filteredPagos.length} pagos encontrados</p>
                <p className="text-sm text-gray-500">
                  Total: ${filteredPagos.reduce((sum, pago) => sum + pago.monto, 0).toLocaleString()}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros Adicionales
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Resultados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Pago</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo de Pago</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell className="font-medium">{pago.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pago.proyecto}</p>
                        {pago.recibo && <p className="text-xs text-gray-500">Recibo: {pago.recibo}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{pago.cliente}</TableCell>
                    <TableCell>
                      <Badge className={getTipoPagoColor(pago.tipoPago)}>{pago.tipoPago}</Badge>
                    </TableCell>
                    <TableCell>{pago.fecha}</TableCell>
                    <TableCell className="font-semibold text-green-600">${pago.monto.toLocaleString()}</TableCell>
                    <TableCell>{pago.metodoPago}</TableCell>
                    <TableCell className="font-mono text-sm">{pago.referencia || "N/A"}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(pago.estado)}>{pago.estado}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" title="Ver detalles">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Descargar recibo">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
