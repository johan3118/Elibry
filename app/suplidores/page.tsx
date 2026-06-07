"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building, Search, Plus, Eye, Edit, ArrowLeft, Phone, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { obtenerRegistrosCompletos } from "@/lib/provisional-system"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/user-context"

interface Suplidor {
  id: number
  razon_social: string
  nombre_comercial: string
  identificacion: string
  nombre_responsable: string
  telefono_responsable: string
  email: string
  telefonos?: string[]
  emails?: string[]
  direccion: string
  pais: string
  status: string
  estado_registro?: string
  usuario_creacion?: string
  creado_por?: string
  editado_por?: string
  fecha_creado: string
  fecha_editado?: string
}

export default function SuplidoresPage() {
  const [suplidores, setSuplidores] = useState<Suplidor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ACTIVO")
  const [paisFilter, setPaisFilter] = useState("todos")
  const router = useRouter()
  const { toast } = useToast()
  const { user, isAdmin } = useUser()

  useEffect(() => {
    cargarSuplidores()
  }, [])

  const cargarSuplidores = async () => {
    try {
      setLoading(true)

      const suplidoresResult = await obtenerRegistrosCompletos("suplidores", supabase)
      const suplidoresArray = Array.isArray(suplidoresResult.data) ? suplidoresResult.data : []

      setSuplidores(suplidoresArray || [])
    } catch (error) {
      console.error("Error cargando suplidores:", error)
      toast({
        title: "Error",
        description: "Error al cargar los suplidores",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const suplidoresFiltrados = suplidores.filter((suplidor) => {
    const matchesSearch =
      suplidor.razon_social?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      suplidor.nombre_comercial?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      suplidor.identificacion?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      suplidor.nombre_responsable?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      suplidor.email?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "todos" || suplidor.status === statusFilter
    const matchesPais = paisFilter === "todos" || suplidor.pais?.toLowerCase() === paisFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesPais
  })

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "activo":
        return "bg-green-100 text-green-800"
      case "inactivo":
        return "bg-red-100 text-red-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-DO")
  }

  const formatContactos = (primary: string, array?: string[]) => {
    if (array && array.length > 0) {
      return array.filter((c) => c).join(", ")
    }
    return primary || "N/A"
  }

  const paisesUnicos = [...new Set(suplidores.map((s) => s.pais).filter(Boolean))].sort()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando suplidores...</p>
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
              <Building className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Gestión de Suplidores</h1>
                <p className="text-sm text-gray-500">Administrar proveedores y suplidores</p>
              </div>
            </div>
          </div>
          <Button onClick={() => router.push("/suplidores/registrar")} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Registrar Suplidor
          </Button>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Suplidores</p>
                  <p className="text-2xl font-bold text-blue-600">{suplidoresFiltrados.length}</p>
                </div>
                <Building className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Activos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {suplidoresFiltrados.filter((s) => s.status === "ACTIVO").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Países</p>
                  <p className="text-2xl font-bold text-purple-600">{paisesUnicos.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">República Dominicana</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {suplidoresFiltrados.filter((s) => s.pais?.toLowerCase().includes("dominican")).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-600">Filtros</CardTitle>
            <CardDescription>Buscar y filtrar suplidores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por razón social, identificación, responsable..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INACTIVO">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paisFilter} onValueChange={setPaisFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="País" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los países</SelectItem>
                  {paisesUnicos.map((pais) => (
                    <SelectItem key={pais} value={pais}>
                      {pais}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Lista de Suplidores ({suplidoresFiltrados.length})</CardTitle>
            <CardDescription>Todos los suplidores registrados en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {suplidoresFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay suplidores</h3>
                <p className="text-gray-500">
                  {searchQuery || statusFilter !== "todos" || paisFilter !== "todos"
                    ? "No se encontraron suplidores con los filtros aplicados."
                    : "No hay suplidores registrados en este momento."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Razón Social</TableHead>
                      <TableHead>Nombre Comercial</TableHead>
                      <TableHead>Identificación</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>País</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creado Por</TableHead>
                      <TableHead>Editado Por</TableHead>
                      <TableHead>Fecha Creado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suplidoresFiltrados.map((suplidor) => (
                      <TableRow
                        key={suplidor.id}
                        className={`hover:bg-gray-50 ${suplidor.estado_registro !== "PERMANENTE" ? "bg-yellow-50 border-l-4 border-l-yellow-400" : ""}`}
                      >
                        <TableCell className="font-medium">{suplidor.id}</TableCell>
                        <TableCell className="font-medium">{suplidor.razon_social}</TableCell>
                        <TableCell>{suplidor.nombre_comercial}</TableCell>
                        <TableCell className="font-mono text-sm">{suplidor.identificacion}</TableCell>
                        <TableCell>{suplidor.nombre_responsable}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm">
                              <Phone className="w-3 h-3 mr-1" />
                              <span className="truncate max-w-[150px]">
                                {formatContactos(suplidor.telefono_responsable, suplidor.telefonos)}
                              </span>
                            </div>
                            <div className="flex items-center text-sm">
                              <Mail className="w-3 h-3 mr-1" />
                              <span className="truncate max-w-[150px]">
                                {formatContactos(suplidor.email, suplidor.emails)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{suplidor.pais}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(suplidor.status)}>{suplidor.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{suplidor.creado_por || suplidor.usuario_creacion || "N/A"}</TableCell>
                        <TableCell className="text-sm">{suplidor.editado_por || "N/A"}</TableCell>
                        <TableCell>{formatDate(suplidor.fecha_creado)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/suplidores/ver?id=${suplidor.id}`)}
                              className="border-blue-200 text-blue-600 hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/suplidores/editar?id=${suplidor.id}`)}
                              className="border-green-200 text-green-600 hover:bg-green-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
