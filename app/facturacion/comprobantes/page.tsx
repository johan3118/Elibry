"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Receipt, Plus, Search, Download, Eye, Edit, Filter, FileText, DollarSign, Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface ComprobanteDisponible {
  id: number
  tipo_comprobante: string
  tipo_descripcion: string
  serie: string
  numero_inicial: number
  numero_final: number
  numero_actual: number
  fecha_autorizacion: string
  fecha_vencimiento: string
  estado: string
  total_comprobantes: number
  comprobantes_usados: number
  comprobantes_disponibles: number
  porcentaje_usado: number
  proximo_ncf: string
  observaciones?: string
}

export default function ComprobantesDisponiblesPage() {
  const [comprobantes, setComprobantes] = useState<ComprobanteDisponible[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [tipoFilter, setTipoFilter] = useState("todos")
  const [estadoFilter, setEstadoFilter] = useState("todos")

  useEffect(() => {
    fetchComprobantes()
  }, [])

  const fetchComprobantes = async () => {
    try {
      setLoading(true)
      // Simular datos desde la vista v_comprobantes_disponibles
      const mockData: ComprobanteDisponible[] = [
        {
          id: 1,
          tipo_comprobante: "01",
          tipo_descripcion: "Facturas de Crédito Fiscal",
          serie: "B010",
          numero_inicial: 1000001,
          numero_final: 1000500,
          numero_actual: 1000001,
          fecha_autorizacion: "2025-01-01",
          fecha_vencimiento: "2025-12-31",
          estado: "ACTIVO",
          total_comprobantes: 500,
          comprobantes_usados: 0,
          comprobantes_disponibles: 500,
          porcentaje_usado: 0,
          proximo_ncf: "B0101000001",
          observaciones: "Bloque de facturas de crédito fiscal para el año 2025"
        },
        {
          id: 2,
          tipo_comprobante: "02",
          tipo_descripcion: "Factura de Consumo",
          serie: "B020",
          numero_inicial: 2000001,
          numero_final: 2001000,
          numero_actual: 2000001,
          fecha_autorizacion: "2025-01-01",
          fecha_vencimiento: "2025-12-31",
          estado: "ACTIVO",
          total_comprobantes: 1000,
          comprobantes_usados: 0,
          comprobantes_disponibles: 1000,
          porcentaje_usado: 0,
          proximo_ncf: "B0202000001",
          observaciones: "Bloque de facturas de consumo para el año 2025"
        },
        {
          id: 7,
          tipo_comprobante: "01",
          tipo_descripcion: "Facturas de Crédito Fiscal",
          serie: "B011",
          numero_inicial: 1000501,
          numero_final: 1001000,
          numero_actual: 1000525,
          fecha_autorizacion: "2025-01-01",
          fecha_vencimiento: "2025-12-31",
          estado: "ACTIVO",
          total_comprobantes: 500,
          comprobantes_usados: 24,
          comprobantes_disponibles: 476,
          porcentaje_usado: 4.8,
          proximo_ncf: "B0111000525",
          observaciones: "Segundo bloque - parcialmente usado"
        },
        {
          id: 8,
          tipo_comprobante: "02",
          tipo_descripcion: "Factura de Consumo",
          serie: "B021",
          numero_inicial: 2001001,
          numero_final: 2001100,
          numero_actual: 2001100,
          fecha_autorizacion: "2024-01-01",
          fecha_vencimiento: "2024-12-31",
          estado: "AGOTADO",
          total_comprobantes: 100,
          comprobantes_usados: 100,
          comprobantes_disponibles: 0,
          porcentaje_usado: 100,
          proximo_ncf: "B0212001100",
          observaciones: "Bloque anterior completamente utilizado"
        },
        {
          id: 3,
          tipo_comprobante: "03",
          tipo_descripcion: "Nota de Débito",
          serie: "B030",
          numero_inicial: 3000001,
          numero_final: 3000100,
          numero_actual: 3000001,
          fecha_autorizacion: "2025-01-01",
          fecha_vencimiento: "2025-12-31",
          estado: "ACTIVO",
          total_comprobantes: 100,
          comprobantes_usados: 0,
          comprobantes_disponibles: 100,
          porcentaje_usado: 0,
          proximo_ncf: "B0303000001",
          observaciones: "Bloque de notas de débito para el año 2025"
        },
        {
          id: 4,
          tipo_comprobante: "04",
          tipo_descripcion: "Nota de Crédito",
          serie: "B040",
          numero_inicial: 4000001,
          numero_final: 4000100,
          numero_actual: 4000001,
          fecha_autorizacion: "2025-01-01",
          fecha_vencimiento: "2025-12-31",
          estado: "ACTIVO",
          total_comprobantes: 100,
          comprobantes_usados: 0,
          comprobantes_disponibles: 100,
          porcentaje_usado: 0,
          proximo_ncf: "B0404000001",
          observaciones: "Bloque de notas de crédito para el año 2025"
        }
      ]
      
      setComprobantes(mockData)
    } catch (error) {
      console.error('Error fetching comprobantes:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredComprobantes = comprobantes.filter((comp) => {
    const matchesSearch =
      comp.serie.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.tipo_descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.proximo_ncf.includes(searchQuery) ||
      (comp.observaciones && comp.observaciones.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesTipo = tipoFilter === "todos" || comp.tipo_comprobante === tipoFilter
    const matchesEstado = estadoFilter === "todos" || comp.estado.toLowerCase() === estadoFilter.toLowerCase()

    return matchesSearch && matchesTipo && matchesEstado
  })

  const getEstadoColor = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "activo":
        return "bg-green-100 text-green-800"
      case "agotado":
        return "bg-red-100 text-red-800"
      case "vencido":
        return "bg-yellow-100 text-yellow-800"
      case "suspendido":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getEstadoIcon = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "activo":
        return <CheckCircle className="w-4 h-4" />
      case "agotado":
        return <XCircle className="w-4 h-4" />
      case "vencido":
        return <AlertTriangle className="w-4 h-4" />
      case "suspendido":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "01":
        return "bg-blue-100 text-blue-800"
      case "02":
        return "bg-green-100 text-green-800"
      case "03":
        return "bg-orange-100 text-orange-800"
      case "04":
        return "bg-purple-100 text-purple-800"
      case "11":
        return "bg-cyan-100 text-cyan-800"
      case "13":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const totalBloques = comprobantes.length
  const bloquesActivos = comprobantes.filter(c => c.estado === 'ACTIVO').length
  const totalComprobantesDisponibles = comprobantes.reduce((sum, c) => sum + c.comprobantes_disponibles, 0)
  const totalComprobantesUsados = comprobantes.reduce((sum, c) => sum + c.comprobantes_usados, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando comprobantes disponibles...</p>
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
            <Link href="/facturacion">
              <Button variant="ghost" size="sm">
                ← Volver a Facturación
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Receipt className="w-6 h-6" style={{ color: "#3399cc" }} />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                  Comprobantes Fiscales Disponibles
                </h1>
                <p className="text-sm text-gray-500">Gestión de bloques de NCF autorizados por DGII</p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Link href="/facturacion/comprobantes/registrar">
              <Button style={{ backgroundColor: "#3399cc" }} className="hover:opacity-90 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Bloque
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
                  <p className="text-sm text-gray-600">Total Bloques</p>
                  <p className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                    {totalBloques}
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
                  <p className="text-sm text-gray-600">Bloques Activos</p>
                  <p className="text-2xl font-bold" style={{ color: "#006600" }}>
                    {bloquesActivos}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8" style={{ color: "#006600" }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">NCF Disponibles</p>
                  <p className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                    {totalComprobantesDisponibles.toLocaleString()}
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
                  <p className="text-sm text-gray-600">NCF Utilizados</p>
                  <p className="text-2xl font-bold" style={{ color: "#006600" }}>
                    {totalComprobantesUsados.toLocaleString()}
                  </p>
                </div>
                <Calendar className="w-8 h-8" style={{ color: "#006600" }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="w-5 h-5 mr-2" />
              Búsqueda y Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Buscar por serie, tipo, NCF o descripción..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de comprobante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="01">01 - Crédito Fiscal</SelectItem>
                  <SelectItem value="02">02 - Consumo</SelectItem>
                  <SelectItem value="03">03 - Nota de Débito</SelectItem>
                  <SelectItem value="04">04 - Nota de Crédito</SelectItem>
                  <SelectItem value="11">11 - Compras</SelectItem>
                  <SelectItem value="13">13 - Gastos Menores</SelectItem>
                </SelectContent>
              </Select>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="agotado">Agotado</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="suspendido">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Comprobantes Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bloques de Comprobantes Fiscales</CardTitle>
                <CardDescription>{filteredComprobantes.length} bloques encontrados</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Serie</TableHead>
                  <TableHead>Rango</TableHead>
                  <TableHead>Próximo NCF</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Disponibles</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComprobantes.map((comprobante) => (
                  <TableRow key={comprobante.id}>
                    <TableCell>
                      <div>
                        <Badge className={getTipoColor(comprobante.tipo_comprobante)}>
                          {comprobante.tipo_comprobante}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1 max-w-[120px] truncate">
                          {comprobante.tipo_descripcion}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {comprobante.serie}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div>
                        <p>{comprobante.numero_inicial.toLocaleString()} - {comprobante.numero_final.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          Total: {comprobante.total_comprobantes.toLocaleString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-medium text-blue-600">
                      {comprobante.estado === 'AGOTADO' ? 'AGOTADO' : comprobante.proximo_ncf}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={comprobante.porcentaje_usado} className="w-20" />
                        <p className="text-xs text-gray-500">
                          {comprobante.porcentaje_usado.toFixed(1)}% usado
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <p className="font-semibold text-green-600">
                          {comprobante.comprobantes_disponibles.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          de {comprobante.total_comprobantes.toLocaleString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">
                          {format(new Date(comprobante.fecha_vencimiento), "dd/MM/yyyy", { locale: es })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(comprobante.fecha_vencimiento) < new Date() ? 'Vencido' : 
                           new Date(comprobante.fecha_vencimiento).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000 ? 'Por vencer' : 'Vigente'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEstadoIcon(comprobante.estado)}
                        <Badge className={getEstadoColor(comprobante.estado)}>
                          {comprobante.estado}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" title="Ver detalles">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {comprobante.estado === "ACTIVO" && (
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
