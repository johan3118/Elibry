"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Download, Eye, Edit, FileText } from "lucide-react"
import Link from "next/link"

export default function ProyectosFacturasPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [proyectoFilter, setProyectoFilter] = useState("todos")

  const facturas = [
    {
      id: "FP-2025-001",
      numeroFactura: "B0100000010",
      proyecto: "Proyecto Residencial Norte",
      cliente: "Constructora del Norte",
      fecha: "2025-01-20",
      concepto: "Pago Inicial - Fase 1",
      subtotal: 42372.88,
      itbis: 7627.12,
      total: 50000.0,
      estado: "Emitida",
      ncf: "B0100000010",
    },
    {
      id: "FP-2025-002",
      numeroFactura: "B0100000011",
      proyecto: "Complejo Comercial Centro",
      cliente: "Inversiones ABC",
      fecha: "2025-01-22",
      concepto: "Pago por Progreso - 30%",
      subtotal: 84745.76,
      itbis: 15254.24,
      total: 100000.0,
      estado: "Emitida",
      ncf: "B0100000011",
    },
    {
      id: "FP-2025-003",
      numeroFactura: "PRO-PROY-003",
      proyecto: "Torre de Oficinas Este",
      cliente: "Grupo Inmobiliario XYZ",
      fecha: "2025-01-25",
      concepto: "Factura Final - Entrega",
      subtotal: 16949.15,
      itbis: 3050.85,
      total: 20000.0,
      estado: "Pendiente",
      ncf: "",
    },
  ]

  const proyectos = ["Proyecto Residencial Norte", "Complejo Comercial Centro", "Torre de Oficinas Este"]

  const filteredFacturas = facturas.filter((factura) => {
    const matchesSearch =
      factura.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.numeroFactura.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.proyecto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.concepto.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "todos" || factura.estado.toLowerCase() === statusFilter.toLowerCase()
    const matchesProyecto = proyectoFilter === "todos" || factura.proyecto === proyectoFilter

    return matchesSearch && matchesStatus && matchesProyecto
  })

  const getStatusColor = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "emitida":
        return "bg-green-100 text-green-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "pagada":
        return "bg-blue-100 text-blue-800"
      case "anulada":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Facturas de Proyectos</h1>
            <p className="text-gray-600">Gestionar facturas asociadas a proyectos</p>
          </div>
        </div>
        <Link href="/proyectos/facturas/crear">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Factura
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Buscar Facturas</CardTitle>
              <CardDescription>Encuentra facturas por proyecto, cliente o número</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar</Label>
                  <Input
                    id="search"
                    placeholder="Proyecto, cliente, número..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => setSearchQuery(searchQuery)}>
                    <Search className="w-4 h-4 mr-2" />
                    Buscar
                  </Button>
                </div>
              </div>

              {filteredFacturas.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead>ITBIS</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFacturas.map((factura) => (
                      <TableRow key={factura.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{factura.numeroFactura}</p>
                            {factura.ncf && <p className="text-xs text-gray-500">NCF: {factura.ncf}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{factura.proyecto}</p>
                            <p className="text-sm text-gray-500">{factura.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>{factura.cliente}</TableCell>
                        <TableCell>{factura.concepto}</TableCell>
                        <TableCell>{factura.fecha}</TableCell>
                        <TableCell>${factura.subtotal.toFixed(2)}</TableCell>
                        <TableCell>${factura.itbis.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">${factura.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(factura.estado)}>{factura.estado}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" title="Ver factura">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Descargar PDF">
                              <Download className="w-4 h-4" />
                            </Button>
                            {factura.estado !== "Emitida" && (
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
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay facturas de proyectos registradas</p>
                  <p className="text-sm">Las facturas aparecerán aquí cuando se generen</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Facturas Emitidas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {facturas.filter((f) => f.estado === "Emitida").length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Facturas Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {facturas.filter((f) => f.estado === "Pendiente").length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Facturado</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${facturas.reduce((sum, f) => sum + f.total, 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">ITBIS Total</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${facturas.reduce((sum, f) => sum + f.itbis, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
