"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Plus, Search, Eye, Edit, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { obtenerRegistrosCompletos } from "@/lib/provisional-system"
import { useUser } from "@/lib/user-context"

export default function ReservasPage() {
  const router = useRouter()
  const [reservas, setReservas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterEstadoRegistro, setFilterEstadoRegistro] = useState("ALL")

  const { user, isAdmin } = useUser()

  useEffect(() => {
    loadReservas()
  }, [])

  const loadReservas = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await obtenerRegistrosCompletos("reservas")

      if (fetchError) {
        console.error("Error fetching reservas:", fetchError)
        setError(fetchError.message)
      } else {
        setReservas(data || [])
      }
    } catch (err: any) {
      console.error("Error:", err)
      setError(err.message || "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  const reservasFiltradas = reservas.filter((reserva) => {
    const matchesSearch =
      !searchTerm ||
      reserva.id.toString().includes(searchTerm) ||
      (reserva.cliente_nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reserva.servicio || "").toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = filterStatus === "ALL" || reserva.status === filterStatus
    const matchesEstadoRegistro =
      filterEstadoRegistro === "ALL" || (reserva.estado_registro || "PERMANENTE") === filterEstadoRegistro

    return matchesSearch && matchesStatus && matchesEstadoRegistro
  })

  const formatDate = (dateString: string) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("es-DO")
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
    }).format(amount)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando reservas...</p>
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
              <Calendar className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Gestión de Reservas</h1>
                <p className="text-sm text-gray-500">Administrar reservas y citas</p>
              </div>
            </div>
          </div>
          <Link href="/reservas/crear">
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Reserva
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
                    Puedes crear y usar reservas inmediatamente. Los registros provisionales están pendientes de
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
            <CardDescription>Buscar y filtrar reservas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar reserva..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  <SelectItem value="PENDIENTE">PENDIENTE</SelectItem>
                  <SelectItem value="CONFIRMADA">CONFIRMADA</SelectItem>
                  <SelectItem value="COMPLETADA">COMPLETADA</SelectItem>
                  <SelectItem value="CANCELADA">CANCELADA</SelectItem>
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

        {/* Lista de Reservas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Lista de Reservas ({reservasFiltradas.length})</CardTitle>
            <CardDescription>Todas las reservas registradas en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-4">
                  <Calendar className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-lg font-medium">Error al cargar reservas</p>
                  <p className="text-sm">{error}</p>
                </div>
                <Button onClick={loadReservas} variant="outline">
                  Reintentar
                </Button>
              </div>
            ) : reservas.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No hay reservas registradas</p>
                <p className="text-sm mb-4">Crea la primera reserva para comenzar</p>
                <Link href="/reservas/crear">
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primera Reserva
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Estado Registro</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservasFiltradas.map((reserva) => (
                      <TableRow
                        key={reserva.id}
                        className={
                          reserva.estado_registro && reserva.estado_registro !== "PERMANENTE" ? "bg-yellow-50" : ""
                        }
                      >
                        <TableCell className="font-mono">{reserva.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{reserva.cliente_nombre || "Cliente no especificado"}</p>
                            {reserva.estado_registro && reserva.estado_registro !== "PERMANENTE" && (
                              <p className="text-xs text-orange-600">Por: {reserva.usuario_creacion || "Usuario"}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{reserva.servicio || "-"}</TableCell>
                        <TableCell>{formatDate(reserva.fecha_entrada || reserva.fecha_creado)}</TableCell>
                        <TableCell>{reserva.monto_total ? formatCurrency(reserva.monto_total) : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={reserva.status === "CONFIRMADA" ? "default" : "destructive"}>
                            {reserva.status || "PENDIENTE"}
                          </Badge>
                        </TableCell>
                        <TableCell>{getEstadoRegistroBadge(reserva.estado_registro || "PERMANENTE")}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Link href={`/reservas/ver/${reserva.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Link href={`/reservas/editar/${reserva.id}`}>
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
                {reservasFiltradas.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No se encontraron reservas que coincidan con los filtros</p>
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
