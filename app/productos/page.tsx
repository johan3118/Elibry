"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, Plus, Search, Eye, Edit, AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { obtenerRegistrosCompletos } from "@/lib/provisional-system"
import { useUser } from "@/lib/user-context"

export default function ProductosPage() {
  const router = useRouter()
  const [productos, setProductos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTipo, setFilterTipo] = useState("ALL")
  const [filterPais, setFilterPais] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterEstadoRegistro, setFilterEstadoRegistro] = useState("ALL")

  const { user, isAdmin } = useUser()

  useEffect(() => {
    loadProductos()
  }, [])

  const loadProductos = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await obtenerRegistrosCompletos("productos")

      if (fetchError) {
        console.error("Error al cargar productos:", fetchError)
        setError("Error al cargar productos: " + fetchError.message)
        return
      }

      setProductos(data || [])
    } catch (err: any) {
      console.error("Error inesperado:", err)
      setError("Error inesperado: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const productosFiltrados = productos.filter((producto) => {
    const matchesSearch =
      !searchTerm ||
      (producto.nombre_producto || producto.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (producto.nombre_original || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (producto.codigo || "").toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTipo = filterTipo === "ALL" || producto.tipo === filterTipo
    const matchesPais = filterPais === "ALL" || producto.pais === filterPais
    const matchesStatus = filterStatus === "ALL" || producto.status === filterStatus
    const matchesEstadoRegistro =
      filterEstadoRegistro === "ALL" || (producto.estado_registro || "PERMANENTE") === filterEstadoRegistro

    return matchesSearch && matchesTipo && matchesPais && matchesStatus && matchesEstadoRegistro
  })

  const formatDate = (dateString: string) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("es-DO")
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
        return <Badge className="bg-gray-100 text-gray-800">Permanente</Badge>
    }
  }

  const tiposUnicos = [...new Set(productos.map((p) => p.tipo).filter(Boolean))]
  const paisesUnicos = [...new Set(productos.map((p) => p.pais).filter(Boolean))]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando productos...</p>
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
              onClick={() => router.push("/dashboard")}
              className="text-gray-600 hover:text-green-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
            <div className="flex items-center space-x-2">
              <Package className="w-6 h-6 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-green-600">Gestión de Productos</h1>
                <p className="text-sm text-gray-500">Administrar productos y servicios</p>
              </div>
            </div>
          </div>
          <Link href="/productos/registrar">
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-6">
        {!isAdmin && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Sistema de Registros Provisionales</p>
                  <p className="text-xs text-blue-700">
                    Puedes crear y usar productos inmediatamente. Los registros provisionales están pendientes de
                    aprobación administrativa.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-600">Filtros de Búsqueda</CardTitle>
            <CardDescription>Buscar y filtrar productos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de Producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los tipos</SelectItem>
                  {tiposUnicos.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPais} onValueChange={setFilterPais}>
                <SelectTrigger>
                  <SelectValue placeholder="País" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los países</SelectItem>
                  {paisesUnicos.map((pais) => (
                    <SelectItem key={pais} value={pais}>
                      {pais}
                    </SelectItem>
                  ))}
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
                  <SelectItem value="DESCONTINUADO">DESCONTINUADO</SelectItem>
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
                  setFilterPais("ALL")
                  setFilterStatus("ALL")
                  setFilterEstadoRegistro("ALL")
                }}
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Lista de Productos ({productosFiltrados.length})</CardTitle>
            <CardDescription>Todos los productos registrados en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-4">
                  <Package className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-lg font-medium">Error al cargar productos</p>
                  <p className="text-sm">{error}</p>
                </div>
                <Button onClick={loadProductos} variant="outline">
                  Reintentar
                </Button>
              </div>
            ) : productos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No hay productos registrados</p>
                <p className="text-sm mb-4">Registra el primer producto para comenzar</p>
                <Link href="/productos/registrar">
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Primer Producto
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Nombre Original</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>País</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Estado Registro</TableHead>
                      <TableHead>Fecha Registro</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosFiltrados.map((producto) => (
                      <TableRow
                        key={producto.id}
                        className={
                          producto.estado_registro && producto.estado_registro !== "PERMANENTE" ? "bg-yellow-50" : ""
                        }
                      >
                        <TableCell>
                          <span className="font-mono text-sm">{producto.id}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold">
                              {producto.nombre_producto || producto.nombre || "Sin nombre"}
                            </p>
                            {producto.codigo && (
                              <p className="text-xs text-gray-400 font-mono">Código: {producto.codigo}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">{producto.nombre_original || "-"}</span>
                        </TableCell>
                        <TableCell>{producto.tipo && <Badge variant="outline">{producto.tipo}</Badge>}</TableCell>
                        <TableCell>{producto.pais || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={producto.status === "ACTIVO" ? "default" : "destructive"}>
                            {producto.status || "ACTIVO"}
                          </Badge>
                        </TableCell>
                        <TableCell>{getEstadoRegistroBadge(producto.estado_registro || "PERMANENTE")}</TableCell>
                        <TableCell>{formatDate(producto.fecha_creado)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/productos/ver?id=${producto.id}`)}
                              className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                              title={`Ver producto ID: ${producto.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/productos/editar?id=${producto.id}`)}
                              className="border-green-200 text-green-600 hover:bg-green-50 bg-transparent"
                              title={`Editar producto ID: ${producto.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {productosFiltrados.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No se encontraron productos que coincidan con los filtros</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
