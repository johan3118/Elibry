"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, Eye, Edit, Filter, FileText } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function BuscarFacturasPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [tipoFilter, setTipoFilter] = useState("todos")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()

  const documentos = [
    {
      id: "F-2025-001",
      tipo: "Factura Fiscal",
      numero: "B0100000001",
      cliente: "Juan Carlos Pérez",
      rnc: "001-1234567-8",
      fecha: "2025-01-20",
      monto: 1416.0,
      itbis: 216.0,
      total: 1632.0,
      estado: "Emitida",
      ncf: "B0100000001",
    },
    {
      id: "P-2025-001",
      tipo: "Proforma",
      numero: "PRO-001",
      cliente: "María Elena García",
      rnc: "001-9876543-2",
      fecha: "2025-01-22",
      monto: 2500.0,
      itbis: 450.0,
      total: 2950.0,
      estado: "Pendiente",
      ncf: "",
    },
    {
      id: "V-2025-001",
      tipo: "Voucher",
      numero: "VOU-001",
      cliente: "Constructora del Norte",
      rnc: "131-12345-6",
      fecha: "2025-01-18",
      monto: 5000.0,
      itbis: 900.0,
      total: 5900.0,
      estado: "Procesado",
      ncf: "",
    },
    {
      id: "F-2025-002",
      tipo: "Factura Fiscal",
      numero: "B0100000002",
      cliente: "Empresa XYZ",
      rnc: "131-98765-4",
      fecha: "2025-01-23",
      monto: 3000.0,
      itbis: 540.0,
      total: 3540.0,
      estado: "Emitida",
      ncf: "B0100000002",
    },
    {
      id: "P-2025-002",
      tipo: "Proforma",
      numero: "PRO-002",
      cliente: "Inversiones ABC",
      rnc: "131-11111-1",
      fecha: "2025-01-24",
      monto: 1800.0,
      itbis: 324.0,
      total: 2124.0,
      estado: "Aprobada",
      ncf: "",
    },
  ]

  const filteredDocuments = documentos.filter((doc) => {
    const matchesSearch =
      doc.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.rnc.includes(searchQuery) ||
      doc.ncf.includes(searchQuery)
    const matchesTipo = tipoFilter === "todos" || doc.tipo.toLowerCase().includes(tipoFilter.toLowerCase())
    const matchesStatus = statusFilter === "todos" || doc.estado.toLowerCase() === statusFilter.toLowerCase()

    let matchesDate = true
    if (dateFrom && dateTo) {
      const docDate = new Date(doc.fecha)
      matchesDate = docDate >= dateFrom && docDate <= dateTo
    }

    return matchesSearch && matchesTipo && matchesStatus && matchesDate
  })

  const getStatusColor = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "emitida":
        return "bg-green-100 text-green-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "procesado":
        return "bg-blue-100 text-blue-800"
      case "aprobada":
        return "bg-purple-100 text-purple-800"
      case "anulada":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTipoColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case "factura fiscal":
        return "bg-purple-100 text-purple-800"
      case "proforma":
        return "bg-blue-100 text-blue-800"
      case "voucher":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Search className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Buscar Facturación</h1>
          <p className="text-gray-600">Buscar y filtrar documentos de facturación</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="tipo">Tipo de Documento</label>
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    <SelectItem value="fiscal">Factura Fiscal</SelectItem>
                    <SelectItem value="proforma">Proforma</SelectItem>
                    <SelectItem value="voucher">Voucher</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="cliente">Cliente</label>
                <Input
                  id="cliente"
                  placeholder="Nombre del cliente"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="fecha-desde">Fecha Desde</label>
                <Input id="fecha-desde" type="date" onChange={(e) => setDateFrom(new Date(e.target.value))} />
              </div>

              <div>
                <label htmlFor="fecha-hasta">Fecha Hasta</label>
                <Input id="fecha-hasta" type="date" onChange={(e) => setDateTo(new Date(e.target.value))} />
              </div>

              <Button className="w-full" onClick={() => {}}>
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Resultados de Búsqueda</CardTitle>
              <CardDescription>Documentos encontrados según los filtros aplicados</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>RNC/Cédula</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead>ITBIS</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((documento) => (
                      <TableRow key={documento.id}>
                        <TableCell>
                          <Badge className={getTipoColor(documento.tipo)}>{documento.tipo}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <p>{documento.numero}</p>
                            {documento.ncf && <p className="text-xs text-gray-500">NCF: {documento.ncf}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{documento.cliente}</TableCell>
                        <TableCell className="font-mono text-sm">{documento.rnc}</TableCell>
                        <TableCell>{format(new Date(documento.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                        <TableCell>${documento.monto.toFixed(2)}</TableCell>
                        <TableCell>${documento.itbis.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">${documento.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(documento.estado)}>{documento.estado}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" title="Ver documento">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Descargar PDF">
                              <Download className="w-4 h-4" />
                            </Button>
                            {documento.estado !== "Emitida" && (
                              <Button variant="ghost" size="sm" title="Editar">
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No hay documentos para mostrar</p>
                  <p className="text-sm">Aplica filtros para buscar documentos de facturación</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
