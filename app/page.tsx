"use client"

import { AuthGuard } from "@/components/auth-guard"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Inbox,
  CheckCircle,
  XCircle,
  Eye,
  Users,
  Package,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Edit,
  Trash2,
  Plus,
  Shield,
  Home,
  BarChart3,
  Settings,
  HeartHandshake,
  ClipboardList,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { aprobarCambio, rechazarCambio } from "@/lib/provisional-system"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/user-context"
import { HeaderWithLogout } from "@/components/header-with-logout" // Import HeaderWithLogout

interface CambioProvisional {
  id: number
  tabla_afectada: string
  registro_id: number
  tipo_cambio: "CREATE" | "UPDATE" | "DELETE"
  datos_anteriores?: any
  datos_nuevos?: any
  usuario_cambio: string
  fecha_cambio: string
  estado_cambio: "PENDIENTE" | "APROBADO" | "RECHAZADO"
  fecha_procesamiento?: string
  procesado_por?: string
  notas_admin?: string
  dependencias?: any[]
  dependientes?: any[]
}

interface Stats {
  totalClientes: number
  totalProductos: number
  reservasPendientes: number
  penalidadProximaCliente: number
  penalidadProximaProveedor: number
  casosCRM: number
}

function AdminPanel() {
  const router = window.location // Use window.location instead of useRouter
  const [cambios, setCambios] = useState<CambioProvisional[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCambio, setSelectedCambio] = useState<CambioProvisional | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [processingAction, setProcessingAction] = useState<number | null>(null)
  const [notasAdmin, setNotasAdmin] = useState("")
  const [tableExists, setTableExists] = useState(false)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("PENDIENTE")
  const [filtroTabla, setFiltroTabla] = useState("todos")
  const [filtroTipo, setFiltroTipo] = useState("todos")
  const [busqueda, setBusqueda] = useState("")

  const supabase = createClient()
  const { toast } = useToast()
  const { user, isAdmin } = useUser()

  useEffect(() => {
    if (isAdmin) {
      verificarTablaYCargarCambios()
    }
  }, [isAdmin, filtroEstado, filtroTabla, filtroTipo])

  const verificarTablaYCargarCambios = async () => {
    try {
      setLoading(true)

      // Intentar hacer una consulta simple a la tabla para verificar si existe
      const { data, error } = await supabase.from("cambios_provisionales").select("id").limit(1)

      if (error) {
        // Si el error indica que la tabla no existe
        if (
          error.message.includes("does not exist") ||
          error.message.includes("relation") ||
          error.message.includes("table") ||
          error.code === "42P01"
        ) {
          setTableExists(false)
          return
        } else {
          // Otro tipo de error
          setTableExists(false)
          return
        }
      }

      // Si llegamos aquí, la tabla existe
      setTableExists(true)
      await cargarCambios()
    } catch (error) {
      console.error("Error verificando tabla:", error)
      setTableExists(false)
    } finally {
      setLoading(false)
    }
  }

  const cargarCambios = async () => {
    try {
      if (!tableExists) return

      let query = supabase.from("cambios_provisionales").select("*").order("fecha_cambio", { ascending: false })

      if (filtroEstado !== "todos") {
        query = query.eq("estado_cambio", filtroEstado)
      }

      if (filtroTabla !== "todos") {
        query = query.eq("tabla_afectada", filtroTabla)
      }

      if (filtroTipo !== "todos") {
        query = query.eq("tipo_cambio", filtroTipo)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error cargando cambios:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los cambios provisionales: " + error.message,
          variant: "destructive",
        })
        return
      }

      setCambios(data || [])
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar los cambios",
        variant: "destructive",
      })
    }
  }

  const procesarCambio = async (cambioId: number, aprobar: boolean, notas?: string) => {
    try {
      setProcessingAction(cambioId)

      const result = aprobar
        ? await aprobarCambio(cambioId, user?.nombre || "admin")
        : await rechazarCambio(cambioId, user?.nombre || "admin", notas)

      if (!result.success) {
        toast({
          title: "Error",
          description: "Error al procesar el cambio: " + result.error,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Éxito",
        description: `Cambio ${aprobar ? "aprobado" : "rechazado"} correctamente`,
      })

      // Recargar cambios
      await cargarCambios()
      setDialogOpen(false)
      setSelectedCambio(null)
      setNotasAdmin("")
    } catch (error) {
      console.error("Error procesando cambio:", error)
      toast({
        title: "Error",
        description: "Error inesperado al procesar el cambio",
        variant: "destructive",
      })
    } finally {
      setProcessingAction(null)
    }
  }

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "CREATE":
        return <Plus className="w-4 h-4 text-green-600" />
      case "UPDATE":
        return <Edit className="w-4 h-4 text-blue-600" />
      case "DELETE":
        return <Trash2 className="w-4 h-4 text-red-600" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />
    }
  }

  const getTablaIcon = (tabla: string) => {
    switch (tabla) {
      case "clientes":
        return <Users className="w-4 h-4" />
      case "productos":
        return <Package className="w-4 h-4" />
      case "suplidores":
        return <Building2 className="w-4 h-4" />
      case "reservas":
        return <Calendar className="w-4 h-4" />
      case "pagos":
        return <DollarSign className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "PENDIENTE":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>
      case "APROBADO":
        return <Badge className="bg-green-100 text-green-800">Aprobado</Badge>
      case "RECHAZADO":
        return <Badge className="bg-red-100 text-red-800">Rechazado</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{estado}</Badge>
    }
  }

  const cambiosFiltrados = cambios.filter(
    (cambio) =>
      busqueda === "" ||
      cambio.usuario_cambio.toLowerCase().includes(busqueda.toLowerCase()) ||
      cambio.tabla_afectada.toLowerCase().includes(busqueda.toLowerCase()),
  )

  const stats = {
    pendientes: cambios.filter((c) => c.estado_cambio === "PENDIENTE").length,
    aprobados: cambios.filter((c) => c.estado_cambio === "APROBADO").length,
    rechazados: cambios.filter((c) => c.estado_cambio === "RECHAZADO").length,
    total: cambios.length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Inbox className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Panel de Administración</h1>
              <p className="text-sm text-gray-500">Gestión de cambios provisionales del sistema</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              {stats.pendientes} Pendientes
            </Badge>
            <Button
              onClick={() => (router.href = "/dashboard")} // Use window.location.href
              variant="outline"
              className="text-blue-600 border-blue-600"
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button
              onClick={verificarTablaYCargarCambios}
              variant="outline"
              disabled={loading}
              className="text-blue-600 border-blue-600 bg-transparent"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Actualizar"}
            </Button>
            <HeaderWithLogout />
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Mensaje si la tabla no existe */}
        {!tableExists && !loading && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-900">Tabla de Cambios Provisionales No Encontrada</p>
                  <p className="text-xs text-red-700">
                    Ejecuta los scripts SQL <code>scripts/047-add-provisional-status-to-tables.sql</code> y{" "}
                    <code>scripts/048-create-cambios-provisionales-table.sql</code> para crear las tablas necesarias.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pendientes}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Aprobados</p>
                  <p className="text-2xl font-bold text-green-600">{stats.aprobados}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Rechazados</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rechazados}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                </div>
                <Inbox className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {tableExists && (
          <>
            {/* Filtros */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Filter className="w-5 h-5 mr-2" />
                  Filtros y Búsqueda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los estados</SelectItem>
                      <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                      <SelectItem value="APROBADO">Aprobados</SelectItem>
                      <SelectItem value="RECHAZADO">Rechazados</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filtroTabla} onValueChange={setFiltroTabla}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tabla" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas las tablas</SelectItem>
                      <SelectItem value="clientes">Clientes</SelectItem>
                      <SelectItem value="productos">Productos</SelectItem>
                      <SelectItem value="suplidores">Suplidores</SelectItem>
                      <SelectItem value="reservas">Reservas</SelectItem>
                      <SelectItem value="pagos">Pagos</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de Cambio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los cambios</SelectItem>
                      <SelectItem value="CREATE">Creaciones</SelectItem>
                      <SelectItem value="UPDATE">Actualizaciones</SelectItem>
                      <SelectItem value="DELETE">Eliminaciones</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={() => {
                      setFiltroEstado("todos")
                      setFiltroTabla("todos")
                      setFiltroTipo("todos")
                      setBusqueda("")
                    }}
                    variant="outline"
                  >
                    Limpiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de Cambios */}
            <Card>
              <CardHeader>
                <CardTitle>Cambios Provisionales</CardTitle>
                <CardDescription>{cambiosFiltrados.length} cambio(s) encontrado(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">Cargando cambios...</p>
                  </div>
                ) : cambiosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Inbox className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No hay cambios para mostrar</p>
                    <p className="text-sm">Intenta ajustar los filtros</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Tabla</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cambiosFiltrados.map((cambio) => (
                        <TableRow key={cambio.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getTipoIcon(cambio.tipo_cambio)}
                              <span className="text-sm font-medium">{cambio.tipo_cambio}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getTablaIcon(cambio.tabla_afectada)}
                              <span className="capitalize">{cambio.tabla_afectada}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{cambio.usuario_cambio}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {new Date(cambio.fecha_cambio).toLocaleString("es-ES", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </TableCell>
                          <TableCell>{getEstadoBadge(cambio.estado_cambio)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedCambio(cambio)
                                  setDialogOpen(true)
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {cambio.estado_cambio === "PENDIENTE" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => procesarCambio(cambio.id, true)}
                                    disabled={processingAction === cambio.id}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    {processingAction === cambio.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <ThumbsUp className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => procesarCambio(cambio.id, false)}
                                    disabled={processingAction === cambio.id}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <ThumbsDown className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Dialog de Detalles */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Cambio Provisional</DialogTitle>
            <DialogDescription>Revisa los detalles antes de aprobar o rechazar</DialogDescription>
          </DialogHeader>

          {selectedCambio && (
            <div className="space-y-6">
              {/* Información General */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Información General</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>ID:</strong> {selectedCambio.id}
                    </p>
                    <p>
                      <strong>Tipo:</strong> {selectedCambio.tipo_cambio}
                    </p>
                    <p>
                      <strong>Tabla:</strong> {selectedCambio.tabla_afectada}
                    </p>
                    <p>
                      <strong>Registro ID:</strong> {selectedCambio.registro_id}
                    </p>
                    <p>
                      <strong>Usuario:</strong> {selectedCambio.usuario_cambio}
                    </p>
                    <p>
                      <strong>Estado:</strong> {getEstadoBadge(selectedCambio.estado_cambio)}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Fechas</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Cambio:</strong> {new Date(selectedCambio.fecha_cambio).toLocaleString()}
                    </p>
                    {selectedCambio.fecha_procesamiento && (
                      <p>
                        <strong>Procesamiento:</strong> {new Date(selectedCambio.fecha_procesamiento).toLocaleString()}
                      </p>
                    )}
                    {selectedCambio.procesado_por && (
                      <p>
                        <strong>Procesado por:</strong> {selectedCambio.procesado_por}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Datos Nuevos */}
              {selectedCambio.datos_nuevos && (
                <div>
                  <h4 className="font-medium mb-2">Datos Nuevos</h4>
                  <pre className="text-sm bg-green-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedCambio.datos_nuevos, null, 2)}
                  </pre>
                </div>
              )}

              {/* Datos Anteriores */}
              {selectedCambio.datos_anteriores && (
                <div>
                  <h4 className="font-medium mb-2">Datos Anteriores</h4>
                  <pre className="text-sm bg-red-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedCambio.datos_anteriores, null, 2)}
                  </pre>
                </div>
              )}

              {/* Dependencias */}
              {selectedCambio.dependencias && selectedCambio.dependencias.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Dependencias</h4>
                  <div className="text-sm bg-blue-50 p-3 rounded">
                    {selectedCambio.dependencias.map((dep: any, index: number) => (
                      <p key={index}>
                        {dep.tabla}: ID {dep.id}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependientes */}
              {selectedCambio.dependientes && selectedCambio.dependientes.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Registros Dependientes</h4>
                  <div className="text-sm bg-orange-50 p-3 rounded">
                    {selectedCambio.dependientes.map((dep: any, index: number) => (
                      <p key={index}>
                        {dep.tabla}: ID {dep.id}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas de Admin */}
              {selectedCambio.estado_cambio === "PENDIENTE" && (
                <div>
                  <h4 className="font-medium mb-2">Notas del Administrador (Opcional)</h4>
                  <Textarea
                    value={notasAdmin}
                    onChange={(e) => setNotasAdmin(e.target.value)}
                    placeholder="Agregar notas sobre la decisión..."
                    rows={3}
                  />
                </div>
              )}

              {/* Notas existentes */}
              {selectedCambio.notas_admin && (
                <div>
                  <h4 className="font-medium mb-2">Notas del Administrador</h4>
                  <p className="text-sm bg-gray-50 p-3 rounded">{selectedCambio.notas_admin}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cerrar
            </Button>
            {selectedCambio?.estado_cambio === "PENDIENTE" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedCambio) {
                      procesarCambio(selectedCambio.id, false, notasAdmin)
                    }
                  }}
                  disabled={processingAction === selectedCambio?.id}
                >
                  {processingAction === selectedCambio?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Rechazar
                </Button>
                <Button
                  onClick={() => {
                    if (selectedCambio) {
                      procesarCambio(selectedCambio.id, true, notasAdmin)
                    }
                  }}
                  disabled={processingAction === selectedCambio?.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processingAction === selectedCambio?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Aprobar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserDashboard() {
  const router = window.location // Use window.location instead of useRouter
  const { user } = useUser()
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0,
    totalProductos: 0,
    reservasPendientes: 0,
    penalidadProximaCliente: 0,
    penalidadProximaProveedor: 0,
    casosCRM: 0,
  })
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  const cargarEstadisticas = async () => {
    try {
      setLoading(true)

      // Cargar estadísticas reales de la base de datos
      const today = new Date()
      const in5Days = new Date(today)
      in5Days.setDate(today.getDate() + 5)
      const todayStr = today.toISOString().split("T")[0]
      const in5DaysStr = in5Days.toISOString().split("T")[0]

      const [clientesResult, productosResult, reservasPendientesResult, penalidadClienteResult, penalidadProveedorResult, casosResult] = await Promise.all([
        supabase.from("clientes").select("*", { count: "exact", head: true }),
        supabase.from("productos").select("*", { count: "exact", head: true }),
        supabase.from("reservas").select("*", { count: "exact", head: true }).eq("status", "PENDIENTE"),
        supabase.from("reservas").select("fecha_limite_pago").gte("fecha_limite_pago", todayStr).lte("fecha_limite_pago", in5DaysStr).eq("status", "PENDIENTE"),
        supabase.from("reservas").select("fecha_gastos_proveedor").gte("fecha_gastos_proveedor", todayStr).lte("fecha_gastos_proveedor", in5DaysStr).eq("status", "PENDIENTE"),
        supabase.from("seguimiento_casos").select("*", { count: "exact", head: true }).eq("estado", "ABIERTO"),
      ])

      setStats({
        totalClientes: clientesResult.count || 0,
        totalProductos: productosResult.count || 0,
        reservasPendientes: reservasPendientesResult.count || 0,
        penalidadProximaCliente: penalidadClienteResult.data?.length || 0,
        penalidadProximaProveedor: penalidadProveedorResult.data?.length || 0,
        casosCRM: casosResult.count || 0,
      })
    } catch (error) {
      console.error("Error cargando estadísticas:", error)
    } finally {
      setLoading(false)
    }
  }

  const modules = [
    // Gestión de Clientes
    {
      title: "Gestión de Clientes",
      description: "Administra la información de tus clientes",
      icon: Users,
      color: "bg-blue-500",
      items: [
        {
          name: "Lista de Clientes",
          description: "Ver todos los clientes registrados",
          icon: Users,
          path: "/clientes",
          color: "text-blue-600",
        },
        {
          name: "Registrar Cliente",
          description: "Agregar nuevo cliente al sistema",
          icon: Plus,
          path: "/clientes/registrar",
          color: "text-green-600",
        },
        {
          name: "Balance General",
          description: "Estado de cuenta de clientes",
          icon: DollarSign,
          path: "/clientes/balance",
          color: "text-purple-600",
        },
        {
          name: "Balance por Reserva",
          description: "Balance detallado por reservación",
          icon: Calendar,
          path: "/clientes/balance-reserva",
          color: "text-orange-600",
        },
      ],
    },

    // CRM - Gestión de la Relación con el Cliente
    {
      title: "CRM",
      description: "Gestión de la Relación con el Cliente",
      icon: HeartHandshake,
      color: "bg-pink-500",
      items: [
        {
          name: "Dashboard CRM",
          description: "Panel de control y métricas de casos",
          icon: BarChart3,
          path: "/crm",
          color: "text-pink-600",
        },
        {
          name: "Seguimiento de Casos",
          description: "Gestión y seguimiento de casos activos",
          icon: ClipboardList,
          path: "/crm/casos",
          color: "text-blue-600",
        },
      ],
    },

    // Gestión de Productos
    {
      title: "Gestión de Productos",
      description: "Administra tu catálogo de productos y servicios",
      icon: Package,
      color: "bg-green-500",
      items: [
        {
          name: "Lista de Productos",
          description: "Ver todos los productos disponibles",
          icon: Package,
          path: "/productos",
          color: "text-green-600",
        },
        {
          name: "Registrar Producto",
          description: "Agregar nuevo producto al catálogo",
          icon: Plus,
          path: "/productos/registrar",
          color: "text-blue-600",
        },
      ],
    },

    // Gestión de Suplidores
    {
      title: "Gestión de Suplidores",
      description: "Administra tus proveedores y suplidores",
      icon: Building2,
      color: "bg-purple-500",
      items: [
        {
          name: "Lista de Suplidores",
          description: "Ver todos los suplidores registrados",
          icon: Building2,
          path: "/suplidores",
          color: "text-purple-600",
        },
        {
          name: "Registrar Suplidor",
          description: "Agregar nuevo suplidor al sistema",
          icon: Plus,
          path: "/suplidores/registrar",
          color: "text-green-600",
        },
      ],
    },

    // Gestión de Reservaciones
    {
      title: "Gestión de Reservaciones",
      description: "Administra reservas",
      icon: Calendar,
      color: "bg-orange-500",
      items: [
        {
          name: "Reservas Pendientes",
          description: "Ver reservas pendientes de confirmación",
          icon: Clock,
          path: "/reservas/pendientes",
          color: "text-orange-600",
        },
        {
          name: "Crear Reserva",
          description: "Registrar nueva reservación",
          icon: Plus,
          path: "/reservas/crear",
          color: "text-green-600",
        },
      ],
    },

    // Gestión de Pagos
    {
      title: "Gestión de Pagos",
      description: "Administra pagos y recibos del sistema",
      icon: DollarSign,
      color: "bg-emerald-500",
      items: [
        {
          name: "Registrar Pago",
          description: "Registrar nuevo pago en el sistema",
          icon: Plus,
          path: "/pagos/registrar",
          color: "text-green-600",
        },
        {
          name: "Buscar Recibos",
          description: "Buscar recibos y pagos de reservaciones",
          icon: Search,
          path: "/pagos/buscar",
          color: "text-blue-600",
        },
        {
          name: "Editar Pago",
          description: "Modificar información de pagos",
          icon: Edit,
          path: "/pagos/editar",
          color: "text-orange-600",
        },
      ],
    },

    // Facturación
    {
      title: "Facturación",
      description: "Gestión de facturas y documentos fiscales",
      icon: FileText,
      color: "bg-red-500",
      items: [
        {
          name: "Panel de Facturación",
          description: "Vista general de facturación",
          icon: FileText,
          path: "/facturacion",
          color: "text-red-600",
        },
        {
          name: "Factura Fiscal",
          description: "Generar facturas con valor fiscal",
          icon: FileText,
          path: "/facturacion/fiscal",
          color: "text-green-600",
        },
        {
          name: "Proforma",
          description: "Crear facturas proforma",
          icon: FileText,
          path: "/facturacion/proforma",
          color: "text-blue-600",
        },
        {
          name: "Voucher",
          description: "Generar vouchers de pago",
          icon: FileText,
          path: "/facturacion/voucher",
          color: "text-purple-600",
        },
      ],
    },

    // Reportes
    {
      title: "Reportes",
      description: "Análisis y reportes del sistema",
      icon: BarChart3,
      color: "bg-teal-500",
      items: [
        {
          name: "Dashboard de Reportes",
          description: "Vista general de reportes y métricas",
          icon: BarChart3,
          path: "/reportes",
          color: "text-teal-600",
        },
      ],
    },

    // Configuración
    {
      title: "Configuración",
      description: "Configuración del sistema y parámetros",
      icon: Settings,
      color: "bg-slate-500",
      items: [
        {
          name: "Panel de Configuración",
          description: "Configuración general del sistema",
          icon: Settings,
          path: "/configuracion",
          color: "text-slate-600",
        },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel de Control</h1>
            <p className="text-gray-600">Sistema de Gestión Empresarial</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Bienvenido</p>
              <p className="text-lg font-semibold text-blue-600">Grupo Ellibry</p>
            </div>
            <HeaderWithLogout />
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Mensaje informativo */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Sistema de Registros Provisionales Activo</p>
                <p className="text-xs text-green-700">
                  Puedes crear, editar y usar todos los registros inmediatamente. Los cambios están pendientes de
                  aprobación administrativa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => (router.href = "/clientes")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Clientes</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {loading ? "..." : stats.totalClientes.toLocaleString()}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => (router.href = "/productos")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Productos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {loading ? "..." : stats.totalProductos.toLocaleString()}
                  </p>
                </div>
                <Package className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => (router.href = "/reservas/pendientes")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Reservas Pendientes</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {loading ? "..." : stats.reservasPendientes.toLocaleString()}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => (router.href = "/reservas/pendientes?filtro=penalidad_cliente")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Penalidad Cliente</p>
                  <p className="text-2xl font-bold text-red-600">
                    {loading ? "..." : stats.penalidadProximaCliente.toLocaleString()}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => (router.href = "/reservas/pendientes?filtro=penalidad_proveedor")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Penalidad Proveedor</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {loading ? "..." : stats.penalidadProximaProveedor.toLocaleString()}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => (router.href = "/crm/casos")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Casos CRM</p>
                  <p className="text-2xl font-bold text-pink-600">
                    {loading ? "..." : stats.casosCRM.toLocaleString()}
                  </p>
                </div>
                <HeartHandshake className="w-8 h-8 text-pink-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${module.color}`}>
                    <module.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription className="text-sm">{module.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {module.items.map((item, itemIndex) => (
                    <Button
                      key={itemIndex}
                      variant="ghost"
                      className="w-full justify-start h-auto p-3 hover:bg-gray-50"
                      onClick={() => (router.href = item.path)} // Use window.location.href
                    >
                      <item.icon className={`w-4 h-4 mr-3 ${item.color}`} />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { isAdmin } = useUser()

  return <AuthGuard>{isAdmin ? <AdminPanel /> : <UserDashboard />}</AuthGuard>
}
