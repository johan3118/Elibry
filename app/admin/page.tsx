"use client"

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
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface AccionPendiente {
  id: number
  tipo_accion: "CREATE" | "UPDATE" | "DELETE"
  modulo: string
  tabla_objetivo: string
  registro_id?: number
  datos_nuevos?: any
  datos_anteriores?: any
  descripcion: string
  usuario_solicitante: string
  fecha_solicitud: string
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO"
  fecha_procesamiento?: string
  usuario_procesamiento?: string
  notas_procesamiento?: string
  resultado_procesamiento?: any
}

export default function AdminPage() {
  const [acciones, setAcciones] = useState<AccionPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAccion, setSelectedAccion] = useState<AccionPendiente | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [processingAction, setProcessingAction] = useState<number | null>(null)
  const [notasProcesamiento, setNotasProcesamiento] = useState("")

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("PENDIENTE")
  const [filtroModulo, setFiltroModulo] = useState("todos")
  const [filtroTipo, setFiltroTipo] = useState("todos")
  const [busqueda, setBusqueda] = useState("")

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    cargarAcciones()
  }, [filtroEstado, filtroModulo, filtroTipo])

  const cargarAcciones = async () => {
    try {
      setLoading(true)

      let query = supabase.from("acciones_pendientes").select("*").order("fecha_solicitud", { ascending: false })

      if (filtroEstado !== "todos") {
        query = query.eq("estado", filtroEstado)
      }

      if (filtroModulo !== "todos") {
        query = query.eq("modulo", filtroModulo)
      }

      if (filtroTipo !== "todos") {
        query = query.eq("tipo_accion", filtroTipo)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error cargando acciones:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar las acciones pendientes",
          variant: "destructive",
        })
        return
      }

      setAcciones(data || [])
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const procesarAccion = async (accionId: number, aprobar: boolean, notas?: string) => {
    try {
      setProcessingAction(accionId)

      const accion = acciones.find((a) => a.id === accionId)
      if (!accion) return

      let resultado_procesamiento = null

      if (aprobar) {
        // Ejecutar la acción según el tipo
        resultado_procesamiento = await ejecutarAccion(accion)
        if (!resultado_procesamiento.exito) {
          toast({
            title: "Error",
            description: "Error al ejecutar la acción: " + resultado_procesamiento.error,
            variant: "destructive",
          })
          return
        }
      }

      // Actualizar el estado de la acción
      const { error } = await supabase
        .from("acciones_pendientes")
        .update({
          estado: aprobar ? "APROBADO" : "RECHAZADO",
          fecha_procesamiento: new Date().toISOString(),
          usuario_procesamiento: "admin", // En una app real, obtener del contexto de usuario
          notas_procesamiento: notas || null,
          resultado_procesamiento: resultado_procesamiento,
        })
        .eq("id", accionId)

      if (error) {
        console.error("Error actualizando acción:", error)
        toast({
          title: "Error",
          description: "Error al procesar la acción",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Éxito",
        description: `Acción ${aprobar ? "aprobada" : "rechazada"} correctamente`,
      })

      // Recargar acciones
      await cargarAcciones()
      setDialogOpen(false)
      setSelectedAccion(null)
      setNotasProcesamiento("")
    } catch (error) {
      console.error("Error procesando acción:", error)
      toast({
        title: "Error",
        description: "Error inesperado al procesar la acción",
        variant: "destructive",
      })
    } finally {
      setProcessingAction(null)
    }
  }

  const ejecutarAccion = async (accion: AccionPendiente): Promise<{ exito: boolean; error?: string; data?: any }> => {
    try {
      switch (accion.tipo_accion) {
        case "CREATE":
          return await ejecutarCreacion(accion)
        case "UPDATE":
          return await ejecutarActualizacion(accion)
        case "DELETE":
          return await ejecutarEliminacion(accion)
        default:
          return { exito: false, error: "Tipo de acción no reconocido" }
      }
    } catch (error) {
      console.error("Error ejecutando acción:", error)
      return { exito: false, error: error instanceof Error ? error.message : "Error desconocido" }
    }
  }

  const ejecutarCreacion = async (accion: AccionPendiente) => {
    const { data, error } = await supabase.from(accion.tabla_objetivo).insert([accion.datos_nuevos]).select()

    if (error) {
      return { exito: false, error: error.message }
    }

    return { exito: true, data }
  }

  const ejecutarActualizacion = async (accion: AccionPendiente) => {
    if (!accion.registro_id) {
      return { exito: false, error: "ID de registro requerido para actualización" }
    }

    const { data, error } = await supabase
      .from(accion.tabla_objetivo)
      .update(accion.datos_nuevos)
      .eq("id", accion.registro_id)
      .select()

    if (error) {
      return { exito: false, error: error.message }
    }

    return { exito: true, data }
  }

  const ejecutarEliminacion = async (accion: AccionPendiente) => {
    if (!accion.registro_id) {
      return { exito: false, error: "ID de registro requerido para eliminación" }
    }

    const { data, error } = await supabase.from(accion.tabla_objetivo).delete().eq("id", accion.registro_id).select()

    if (error) {
      return { exito: false, error: error.message }
    }

    return { exito: true, data }
  }

  const getAccionIcon = (tipo: string) => {
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

  const getModuloIcon = (modulo: string) => {
    switch (modulo) {
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
      case "facturacion":
        return <FileText className="w-4 h-4" />
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

  const accionesFiltradas = acciones.filter(
    (accion) =>
      busqueda === "" ||
      accion.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
      accion.usuario_solicitante.toLowerCase().includes(busqueda.toLowerCase()),
  )

  const stats = {
    pendientes: acciones.filter((a) => a.estado === "PENDIENTE").length,
    aprobadas: acciones.filter((a) => a.estado === "APROBADO").length,
    rechazadas: acciones.filter((a) => a.estado === "RECHAZADO").length,
    total: acciones.length,
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
              <p className="text-sm text-gray-500">Bandeja de entrada - Todas las acciones del sistema</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              {stats.pendientes} Pendientes
            </Badge>
            <Button
              onClick={cargarAcciones}
              variant="outline"
              disabled={loading}
              className="text-blue-600 border-blue-600 bg-transparent"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Actualizar"}
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
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
                  <p className="text-sm text-gray-600">Aprobadas</p>
                  <p className="text-2xl font-bold text-green-600">{stats.aprobadas}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Rechazadas</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rechazadas}</p>
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

              <Select value={filtroModulo} onValueChange={setFiltroModulo}>
                <SelectTrigger>
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los módulos</SelectItem>
                  <SelectItem value="clientes">Clientes</SelectItem>
                  <SelectItem value="productos">Productos</SelectItem>
                  <SelectItem value="suplidores">Suplidores</SelectItem>
                  <SelectItem value="reservas">Reservas</SelectItem>
                  <SelectItem value="pagos">Pagos</SelectItem>
                  <SelectItem value="facturacion">Facturación</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las acciones</SelectItem>
                  <SelectItem value="CREATE">Creaciones</SelectItem>
                  <SelectItem value="UPDATE">Actualizaciones</SelectItem>
                  <SelectItem value="DELETE">Eliminaciones</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => {
                  setFiltroEstado("todos")
                  setFiltroModulo("todos")
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

        {/* Tabla de Acciones */}
        <Card>
          <CardHeader>
            <CardTitle>Bandeja de Entrada</CardTitle>
            <CardDescription>{accionesFiltradas.length} acción(es) encontrada(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Cargando acciones...</p>
              </div>
            ) : accionesFiltradas.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Inbox className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No hay acciones para mostrar</p>
                <p className="text-sm">Intenta ajustar los filtros</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accionesFiltradas.map((accion) => (
                    <TableRow key={accion.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getAccionIcon(accion.tipo_accion)}
                          <span className="text-sm font-medium">{accion.tipo_accion}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getModuloIcon(accion.modulo)}
                          <span className="capitalize">{accion.modulo}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm font-medium truncate">{accion.descripcion}</p>
                          <p className="text-xs text-gray-500">Tabla: {accion.tabla_objetivo}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{accion.usuario_solicitante}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(accion.fecha_solicitud), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </TableCell>
                      <TableCell>{getEstadoBadge(accion.estado)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAccion(accion)
                              setDialogOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {accion.estado === "PENDIENTE" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => procesarAccion(accion.id, true)}
                                disabled={processingAction === accion.id}
                                className="text-green-600 hover:text-green-700"
                              >
                                {processingAction === accion.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ThumbsUp className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => procesarAccion(accion.id, false)}
                                disabled={processingAction === accion.id}
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
      </div>

      {/* Dialog de Detalles */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de la Acción</DialogTitle>
            <DialogDescription>Revisa los detalles antes de aprobar o rechazar</DialogDescription>
          </DialogHeader>

          {selectedAccion && (
            <div className="space-y-6">
              {/* Información General */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Información General</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>ID:</strong> {selectedAccion.id}
                    </p>
                    <p>
                      <strong>Tipo:</strong> {selectedAccion.tipo_accion}
                    </p>
                    <p>
                      <strong>Módulo:</strong> {selectedAccion.modulo}
                    </p>
                    <p>
                      <strong>Tabla:</strong> {selectedAccion.tabla_objetivo}
                    </p>
                    <p>
                      <strong>Usuario:</strong> {selectedAccion.usuario_solicitante}
                    </p>
                    <p>
                      <strong>Estado:</strong> {getEstadoBadge(selectedAccion.estado)}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Fechas</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Solicitud:</strong> {new Date(selectedAccion.fecha_solicitud).toLocaleString()}
                    </p>
                    {selectedAccion.fecha_procesamiento && (
                      <p>
                        <strong>Procesamiento:</strong> {new Date(selectedAccion.fecha_procesamiento).toLocaleString()}
                      </p>
                    )}
                    {selectedAccion.usuario_procesamiento && (
                      <p>
                        <strong>Procesado por:</strong> {selectedAccion.usuario_procesamiento}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Descripción</h4>
                <p className="text-sm bg-gray-50 p-3 rounded">{selectedAccion.descripcion}</p>
              </div>

              {/* Datos Nuevos */}
              {selectedAccion.datos_nuevos && (
                <div>
                  <h4 className="font-medium mb-2">Datos Nuevos</h4>
                  <pre className="text-sm bg-green-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedAccion.datos_nuevos, null, 2)}
                  </pre>
                </div>
              )}

              {/* Datos Anteriores */}
              {selectedAccion.datos_anteriores && (
                <div>
                  <h4 className="font-medium mb-2">Datos Anteriores</h4>
                  <pre className="text-sm bg-red-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedAccion.datos_anteriores, null, 2)}
                  </pre>
                </div>
              )}

              {/* Notas de Procesamiento */}
              {selectedAccion.estado === "PENDIENTE" && (
                <div>
                  <h4 className="font-medium mb-2">Notas de Procesamiento (Opcional)</h4>
                  <Textarea
                    value={notasProcesamiento}
                    onChange={(e) => setNotasProcesamiento(e.target.value)}
                    placeholder="Agregar notas sobre la decisión..."
                    rows={3}
                  />
                </div>
              )}

              {/* Notas existentes */}
              {selectedAccion.notas_procesamiento && (
                <div>
                  <h4 className="font-medium mb-2">Notas del Administrador</h4>
                  <p className="text-sm bg-gray-50 p-3 rounded">{selectedAccion.notas_procesamiento}</p>
                </div>
              )}

              {/* Resultado */}
              {selectedAccion.resultado_procesamiento && (
                <div>
                  <h4 className="font-medium mb-2">Resultado del Procesamiento</h4>
                  <pre className="text-sm bg-blue-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedAccion.resultado_procesamiento, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cerrar
            </Button>
            {selectedAccion?.estado === "PENDIENTE" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedAccion) {
                      procesarAccion(selectedAccion.id, false, notasProcesamiento)
                    }
                  }}
                  disabled={processingAction === selectedAccion?.id}
                >
                  {processingAction === selectedAccion?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Rechazar
                </Button>
                <Button
                  onClick={() => {
                    if (selectedAccion) {
                      procesarAccion(selectedAccion.id, true, notasProcesamiento)
                    }
                  }}
                  disabled={processingAction === selectedAccion?.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processingAction === selectedAccion?.id ? (
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
