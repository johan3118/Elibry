"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Plus, Search, Eye, Edit, Building2, User, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { obtenerRegistrosCompletos, type Cliente } from "@/lib/provisional-system"
import { useUser } from "@/lib/user-context"
import { formatDateDMY } from "@/lib/utils"

export default function ClientesPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTipo, setFilterTipo] = useState("ALL")
  const [filterCompania, setFilterCompania] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ACTIVO")
  const [filterEstadoRegistro, setFilterEstadoRegistro] = useState("ALL")

  const { user, isAdmin } = useUser()

  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    try {
      setLoading(true)
      const result = await obtenerRegistrosCompletos("clientes")
      const data = result?.data || result
      setClientes(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error:", error)
      setClientes([])
    } finally {
      setLoading(false)
    }
  }

  const clientesFiltrados = Array.isArray(clientes)
    ? clientes.filter((cliente) => {
        const matchesSearch =
          !searchTerm ||
          (cliente.tipo_cliente === "EMPRESA"
            ? cliente.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              cliente.nombre_comercial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              cliente.rnc?.toLowerCase().includes(searchTerm.toLowerCase())
            : cliente.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              cliente.identificacion?.toLowerCase().includes(searchTerm.toLowerCase())) ||
          cliente.email.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesTipo = filterTipo === "ALL" || cliente.tipo_cliente === filterTipo
        const matchesCompania = filterCompania === "ALL" || cliente.compania === filterCompania
        const matchesStatus = filterStatus === "ALL" || cliente.status === filterStatus
        const matchesEstadoRegistro = filterEstadoRegistro === "ALL" || cliente.estado_registro === filterEstadoRegistro

        return matchesSearch && matchesTipo && matchesCompania && matchesStatus && matchesEstadoRegistro
      })
    : []

  const formatDate = (dateString: string) => {
    return formatDateDMY(dateString)
  }

  const getEstadoRegistroBadge = (estado: string) => {
    switch (estado) {
      case "PERMANENTE":
        return <Badge className="bg-green-100 text-green-800">Permanente</Badge>
      case "PROVISIONAL":
        return <Badge className="bg-yellow-100 text-yellow-800">Provisional</Badge>
      case "MODIFICADO":
        return <Badge className="bg-blue-100 text-blue-800">Modificado</Badge>
      case "ELIMINADO":
        return <Badge className="bg-red-100 text-red-800">Eliminado</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{estado}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando clientes...</p>
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
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Gestión de Clientes</h1>
                <p className="text-sm text-gray-500">Administrar clientes del sistema</p>
              </div>
            </div>
          </div>
          <Link href="/clientes/registrar">
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </Link>
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
                  <p className="text-sm font-medium text-blue-900">Sistema de Registros Provisionales</p>
                  <p className="text-xs text-blue-700">
                    Puedes crear y usar clientes inmediatamente. Los registros provisionales están pendientes de
                    aprobación administrativa.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-600">Filtros de Búsqueda</CardTitle>
            <CardDescription>Buscar y filtrar clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los tipos</SelectItem>
                  <SelectItem value="EMPRESA">EMPRESA</SelectItem>
                  <SelectItem value="NORMAL">NORMAL</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCompania} onValueChange={setFilterCompania}>
                <SelectTrigger>
                  <SelectValue placeholder="Compañía" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las marcas</SelectItem>
                  <SelectItem value="MARCA 1">MARCA 1</SelectItem>
                  <SelectItem value="MARCA 2">MARCA 2</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                  <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEstadoRegistro} onValueChange={setFilterEstadoRegistro}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado Registro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los registros</SelectItem>
                  <SelectItem value="PERMANENTE">Permanentes</SelectItem>
                  <SelectItem value="PROVISIONAL">Provisionales</SelectItem>
                  <SelectItem value="MODIFICADO">Modificados</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setFilterTipo("ALL")
                  setFilterCompania("ALL")
                  setFilterStatus("ACTIVO")
                  setFilterEstadoRegistro("ALL")
                }}
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Lista de Clientes ({clientesFiltrados.length})</CardTitle>
            <CardDescription>Todos los clientes registrados en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Compañía</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Estado Registro</TableHead>
                    <TableHead>Fecha Registro</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFiltrados.map((cliente) => (
                    <TableRow
                      key={cliente.id}
                      className={cliente.estado_registro !== "PERMANENTE" ? "bg-yellow-50" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {cliente.tipo_cliente === "EMPRESA" ? (
                            <Building2 className="w-4 h-4 text-blue-600" />
                          ) : (
                            <User className="w-4 h-4 text-green-600" />
                          )}
                          <Badge variant={cliente.tipo_cliente === "EMPRESA" ? "default" : "secondary"}>
                            {cliente.tipo_cliente}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold">
                            {cliente.tipo_cliente === "EMPRESA" ? cliente.razon_social : cliente.nombre_completo}
                          </p>
                          {cliente.tipo_cliente === "EMPRESA" && (
                            <p className="text-sm text-gray-500">{cliente.nombre_comercial}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-sm">
                          {cliente.tipo_cliente === "EMPRESA" ? cliente.rnc : cliente.identificacion}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{cliente.email}</p>
                          <p className="text-xs text-gray-500">{cliente.telefonos?.split(",")[0] || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{cliente.compania}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cliente.status === "ACTIVO" ? "default" : "destructive"}>
                          {cliente.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{getEstadoRegistroBadge(cliente.estado_registro || "PERMANENTE")}</TableCell>
                      <TableCell>{formatDate(cliente.fecha_creado)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Link href={`/clientes/ver?id=${cliente.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/clientes/editar?id=${cliente.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-200 text-green-600 hover:bg-green-50 bg-transparent"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {clientesFiltrados.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No se encontraron clientes que coincidan con los filtros</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
