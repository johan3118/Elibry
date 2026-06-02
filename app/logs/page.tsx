"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  FileText,
  Search,
  Eye,
  Download,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface LogEntry {
  id: number
  timestamp: string
  level: "INFO" | "WARNING" | "ERROR" | "SUCCESS"
  category: string
  message: string
  user_id?: string
  ip_address?: string
  user_agent?: string
  details?: any
}

export default function LogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [dateFilter, setDateFilter] = useState("ALL")

  const supabase = createClient()
  const { toast } = useToast()

  // Mock data for demonstration
  const mockLogs: LogEntry[] = [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      level: "INFO",
      category: "AUTH",
      message: "Usuario inició sesión exitosamente",
      user_id: "user123",
      ip_address: "192.168.1.100",
      user_agent: "Mozilla/5.0...",
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      level: "ERROR",
      category: "DATABASE",
      message: "Error de conexión a la base de datos",
      ip_address: "192.168.1.100",
      details: { error: "Connection timeout" },
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      level: "WARNING",
      category: "SECURITY",
      message: "Intento de acceso no autorizado detectado",
      ip_address: "10.0.0.50",
      user_agent: "Bot/1.0",
    },
    {
      id: 4,
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      level: "SUCCESS",
      category: "PAYMENT",
      message: "Pago procesado correctamente",
      user_id: "user456",
      ip_address: "192.168.1.101",
    },
    {
      id: 5,
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      level: "INFO",
      category: "SYSTEM",
      message: "Backup automático completado",
      details: { size: "2.5GB", duration: "45min" },
    },
  ]

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      setLoading(true)
      // In a real implementation, you would fetch from your logs table
      // const { data, error } = await supabase.from('logs').select('*').order('timestamp', { ascending: false })

      // For now, using mock data
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate loading
      setLogs(mockLogs)
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar los logs. Verifique su conexión.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    const searchTerm = searchQuery.toLowerCase()
    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm) ||
      log.category.toLowerCase().includes(searchTerm) ||
      (log.user_id && log.user_id.toLowerCase().includes(searchTerm)) ||
      (log.ip_address && log.ip_address.includes(searchTerm))

    const matchesLevel = levelFilter === "ALL" || log.level === levelFilter
    const matchesCategory = categoryFilter === "ALL" || log.category === categoryFilter

    // Date filtering logic
    let matchesDate = true
    if (dateFilter !== "ALL") {
      const logDate = new Date(log.timestamp)
      const now = new Date()

      switch (dateFilter) {
        case "TODAY":
          matchesDate = logDate.toDateString() === now.toDateString()
          break
        case "WEEK":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          matchesDate = logDate >= weekAgo
          break
        case "MONTH":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          matchesDate = logDate >= monthAgo
          break
      }
    }

    return matchesSearch && matchesLevel && matchesCategory && matchesDate
  })

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "SUCCESS":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "INFO":
        return <Activity className="w-4 h-4 text-blue-600" />
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      case "ERROR":
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "SUCCESS":
        return "bg-green-100 text-green-800"
      case "INFO":
        return "bg-blue-100 text-blue-800"
      case "WARNING":
        return "bg-yellow-100 text-yellow-800"
      case "ERROR":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-DO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Statistics
  const totalLogs = filteredLogs.length
  const errorLogs = filteredLogs.filter((log) => log.level === "ERROR").length
  const warningLogs = filteredLogs.filter((log) => log.level === "WARNING").length
  const successLogs = filteredLogs.filter((log) => log.level === "SUCCESS").length
  const infoLogs = filteredLogs.filter((log) => log.level === "INFO").length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando logs del sistema...</p>
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
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Logs del Sistema</h1>
                <p className="text-sm text-gray-500">Monitoreo y auditoría de actividades</p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={loadLogs}
              className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            <Link href="/logs/auditoria">
              <Button className="bg-green-600 hover:bg-green-700">
                <Eye className="w-4 h-4 mr-2" />
                Auditoría
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Logs</p>
                  <p className="text-2xl font-bold text-gray-900">{totalLogs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Éxito</p>
                  <p className="text-2xl font-bold text-gray-900">{successLogs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Advertencias</p>
                  <p className="text-2xl font-bold text-gray-900">{warningLogs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <XCircle className="w-8 h-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Errores</p>
                  <p className="text-2xl font-bold text-gray-900">{errorLogs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Activity className="w-8 h-8 text-gray-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Info</p>
                  <p className="text-2xl font-bold text-gray-900">{infoLogs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-600">Filtros de Búsqueda</CardTitle>
            <CardDescription>Buscar y filtrar logs por diferentes criterios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los niveles</SelectItem>
                  <SelectItem value="SUCCESS">Éxito</SelectItem>
                  <SelectItem value="INFO">Información</SelectItem>
                  <SelectItem value="WARNING">Advertencia</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las categorías</SelectItem>
                  <SelectItem value="AUTH">Autenticación</SelectItem>
                  <SelectItem value="DATABASE">Base de Datos</SelectItem>
                  <SelectItem value="SECURITY">Seguridad</SelectItem>
                  <SelectItem value="PAYMENT">Pagos</SelectItem>
                  <SelectItem value="SYSTEM">Sistema</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las fechas</SelectItem>
                  <SelectItem value="TODAY">Hoy</SelectItem>
                  <SelectItem value="WEEK">Última semana</SelectItem>
                  <SelectItem value="MONTH">Último mes</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setLevelFilter("ALL")
                  setCategoryFilter("ALL")
                  setDateFilter("ALL")
                }}
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Registro de Actividades ({filteredLogs.length})</CardTitle>
            <CardDescription>Historial completo de eventos del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Mensaje</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium">No se encontraron logs</p>
                          <p className="text-sm">Intente ajustar los filtros de búsqueda</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="font-mono text-sm">{formatDate(log.timestamp)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getLevelIcon(log.level)}
                            <Badge className={getLevelColor(log.level)}>{log.level}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <p className="text-sm truncate" title={log.message}>
                              {log.message}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {log.user_id ? (
                              <span className="font-mono">{log.user_id}</span>
                            ) : (
                              <span className="text-gray-400">Sistema</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">{log.ip_address || "N/A"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                              onClick={() => {
                                // Show log details
                                toast({
                                  title: "Detalles del Log",
                                  description: `${log.message} - ${log.category}`,
                                })
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {log.details && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-green-200 text-green-600 hover:bg-green-50 bg-transparent"
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(log.details, null, 2))
                                  toast({
                                    title: "Detalles copiados",
                                    description: "Los detalles han sido copiados al portapapeles",
                                  })
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
