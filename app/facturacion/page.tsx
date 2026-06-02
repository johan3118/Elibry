"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Plus, Search, Download, Eye, Edit, Receipt, CreditCard, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface DocumentoFacturacion {
  id: string
  tipo: string
  numero: string
  cliente: string
  rnc: string
  fecha: string
  monto: number
  itbis: number
  total: number
  estado: string
  ncf: string
  reserva_id?: number
}

export default function FacturacionPage() {
  const router = useRouter()
  const [documentos, setDocumentos] = useState<DocumentoFacturacion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [tipoFilter, setTipoFilter] = useState("todos")
  const [statusFilter, setStatusFilter] = useState("todos")

  useEffect(() => {
    cargarDocumentos()
  }, [])

  const cargarDocumentos = async () => {
    try {
      setLoading(true)

      // Obtener reservas con datos de clientes
      const { data: reservasData, error: reservasError } = await supabase
        .from("reservas")
        .select("*")
        .order("fecha_creado", { ascending: false })

      if (reservasError) {
        console.error("Error cargando reservas:", reservasError)
        return
      }

      if (!reservasData || reservasData.length === 0) {
        setDocumentos([])
        return
      }

      // Obtener IDs únicos de clientes
      const clienteIds = [...new Set(reservasData.map((r) => r.cliente_id).filter(Boolean))]

      // Obtener datos de clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("id, nombre_completo, razon_social, rnc, identificacion, tipo_cliente")
        .in("id", clienteIds)

      if (clientesError) {
        console.error("Error cargando clientes:", clientesError)
      }

      // Crear documentos basados en reservas
      const documentosGenerados: DocumentoFacturacion[] = reservasData.map((reserva, index) => {
        const cliente = clientesData?.find((c) => c.id === reserva.cliente_id)

        const nombreCliente =
          cliente?.tipo_cliente === "EMPRESA"
            ? cliente.razon_social || "Empresa sin nombre"
            : cliente?.nombre_completo || "Cliente sin nombre"

        const documentoCliente =
          cliente?.tipo_cliente === "EMPRESA" ? cliente.rnc || "Sin RNC" : cliente?.identificacion || "Sin cédula"

        // Calcular montos
        const subtotal = Number(reserva.precio_total || 0)
        const descuento = Number(reserva.descuento || 0)
        const montoConDescuento = subtotal - descuento
        const itbis = montoConDescuento * 0.18 // 18% ITBIS
        const total = montoConDescuento + itbis

        // Determinar tipo de documento basado en el estado de la reserva
        let tipoDocumento = "Proforma"
        let estadoDocumento = "Pendiente"

        if (reserva.status === "CONFIRMADA") {
          tipoDocumento = "Factura Fiscal"
          estadoDocumento = "Emitida"
        } else if (reserva.status === "PAGADA") {
          tipoDocumento = "Factura Fiscal"
          estadoDocumento = "Pagada"
        } else if (reserva.factura_url) {
          tipoDocumento = "Voucher"
          estadoDocumento = "Procesado"
        }

        return {
          id: `${tipoDocumento.charAt(0)}-${new Date().getFullYear()}-${String(index + 1).padStart(3, "0")}`,
          tipo: tipoDocumento,
          numero: reserva.codigo || `${tipoDocumento.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
          cliente: nombreCliente,
          rnc: documentoCliente,
          fecha: new Date(reserva.fecha_creado).toLocaleDateString("es-DO"),
          monto: montoConDescuento,
          itbis: itbis,
          total: total,
          estado: estadoDocumento,
          ncf: tipoDocumento === "Factura Fiscal" ? `B01${String(index + 1).padStart(8, "0")}` : "",
          reserva_id: reserva.id,
        }
      })

      setDocumentos(documentosGenerados)
    } catch (error) {
      console.error("Error general cargando documentos:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDocuments = documentos.filter((doc) => {
    const matchesSearch =
      doc.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.rnc.includes(searchQuery)
    const matchesTipo = tipoFilter === "todos" || doc.tipo.toLowerCase().includes(tipoFilter.toLowerCase())
    const matchesStatus = statusFilter === "todos" || doc.estado.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesTipo && matchesStatus
  })

  const getStatusColor = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "emitida":
        return "bg-green-100 text-green-800"
      case "pagada":
        return "bg-blue-100 text-blue-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "procesado":
        return "bg-green-100 text-green-800"
      case "anulada":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTipoColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case "factura fiscal":
        return "bg-blue-100 text-blue-800"
      case "proforma":
        return "bg-green-100 text-green-800"
      case "voucher":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Calcular estadísticas
  const facturasFiscales = documentos.filter((d) => d.tipo === "Factura Fiscal")
  const proformasPendientes = documentos.filter((d) => d.tipo === "Proforma" && d.estado === "Pendiente")
  const montoFacturado = facturasFiscales.reduce((sum, d) => sum + d.total, 0)
  const itbisTotal = documentos.reduce((sum, d) => sum + d.itbis, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando documentos de facturación...</p>
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
              onClick={() => router.push("/dashboard")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
            <div className="flex items-center space-x-2">
              <FileText className="w-6 h-6" style={{ color: "#3399cc" }} />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                  Facturación
                </h1>
                <p className="text-sm text-gray-500">Gestión de facturas fiscales, proformas y vouchers</p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={cargarDocumentos}
              variant="outline"
              className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
            >
              <Search className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            <Link href="/facturacion/fiscal">
              <Button style={{ backgroundColor: "#3399cc" }} className="hover:opacity-90 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Factura
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Facturas del Mes</p>
                  <p className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                    {facturasFiscales.length}
                  </p>
                </div>
                <FileText className="w-8 h-8" style={{ color: "#3399cc" }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Monto Facturado</p>
                  <p className="text-2xl font-bold" style={{ color: "#006600" }}>
                    ${montoFacturado.toFixed(2)}
                  </p>
                </div>
                <CreditCard className="w-8 h-8" style={{ color: "#006600" }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Proformas Pendientes</p>
                  <p className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                    {proformasPendientes.length}
                  </p>
                </div>
                <Receipt className="w-8 h-8" style={{ color: "#3399cc" }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">ITBIS del Mes</p>
                  <p className="text-2xl font-bold" style={{ color: "#006600" }}>
                    ${itbisTotal.toFixed(2)}
                  </p>
                </div>
                <FileText className="w-8 h-8" style={{ color: "#006600" }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Link href="/facturacion/fiscal">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" style={{ color: "#3399cc" }} />
                  <span className="font-medium">Facturas Fiscales</span>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/facturacion/proforma">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-5 h-5" style={{ color: "#006600" }} />
                  <span className="font-medium">Proforma GEB</span>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/facturacion/voucher">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5" style={{ color: "#3399cc" }} />
                  <span className="font-medium">Voucher GEB</span>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/facturacion/comprobantes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-5 h-5" style={{ color: "#006600" }} />
                  <span className="font-medium">Comprobantes Fiscales</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <Search className="w-5 h-5 mr-2" />
              Búsqueda y Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Buscar por cliente, número o RNC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="factura">Factura Fiscal</SelectItem>
                  <SelectItem value="proforma">Proforma</SelectItem>
                  <SelectItem value="voucher">Voucher</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="emitida">Emitida</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="procesado">Procesado</SelectItem>
                  <SelectItem value="pagada">Pagada</SelectItem>
                  <SelectItem value="anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-blue-600">Documentos de Facturación</CardTitle>
                <CardDescription>{filteredDocuments.length} documentos encontrados</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                      <TableCell>{documento.fecha}</TableCell>
                      <TableCell>${documento.monto.toFixed(2)}</TableCell>
                      <TableCell>${documento.itbis.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">${documento.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(documento.estado)}>{documento.estado}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-200 text-gray-600 hover:bg-gray-50 bg-transparent"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {documento.estado !== "Emitida" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-200 text-green-600 hover:bg-green-50 bg-transparent"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredDocuments.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No se encontraron documentos que coincidan con los filtros</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
