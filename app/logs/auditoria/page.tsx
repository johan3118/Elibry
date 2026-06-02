"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Download, Eye, FileText, User, Clock, Shield, ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

export default function AuditoriaPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [actionFilter, setActionFilter] = useState("todas")
  const [userFilter, setUserFilter] = useState("todos")

  // Datos de ejemplo de auditoría
  const auditLogs = [
    {
      id: 1,
      timestamp: "2024-01-15 14:30:25",
      user: "admin@ellibry.com",
      action: "CREAR",
      module: "Clientes",
      record: "Cliente ID: 123",
      oldValue: null,
      newValue: "María González - Teléfono: 809-555-0123",
      ip: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    {
      id: 2,
      timestamp: "2024-01-15 14:28:15",
      user: "operador@ellibry.com",
      action: "ACTUALIZAR",
      module: "Reservas",
      record: "Reserva RES-2024-015",
      oldValue: "Estado: Pendiente",
      newValue: "Estado: Confirmada",
      ip: "192.168.1.105",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    {
      id: 3,
      timestamp: "2024-01-15 14:25:10",
      user: "vendedor@ellibry.com",
      action: "ELIMINAR",
      module: "Productos",
      record: "Producto ID: 456",
      oldValue: "Apartamento 2H - Precio: $150,000",
      newValue: null,
      ip: "192.168.1.110",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    {
      id: 4,
      timestamp: "2024-01-15 14:20:05",
      user: "admin@ellibry.com",
      action: "CREAR",
      module: "Facturación",
      record: "Factura F-2024-001",
      oldValue: null,
      newValue: "Cliente: Juan Pérez - Monto: $2,500.00",
      ip: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    {
      id: 5,
      timestamp: "2024-01-15 14:15:30",
      user: "operador@ellibry.com",
      action: "ACTUALIZAR",
      module: "Pagos",
      record: "Pago P-2024-025",
      oldValue: "Estado: Pendiente - Monto: $1,000.00",
      newValue: "Estado: Procesado - Monto: $1,000.00",
      ip: "192.168.1.105",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  ]

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREAR":
        return (
          <Badge className="bg-green-100 text-green-800">
            <FileText className="w-3 h-3 mr-1" />
            Crear
          </Badge>
        )
      case "ACTUALIZAR":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Eye className="w-3 h-3 mr-1" />
            Actualizar
          </Badge>
        )
      case "ELIMINAR":
        return (
          <Badge className="bg-red-100 text-red-800">
            <FileText className="w-3 h-3 mr-1" />
            Eliminar
          </Badge>
        )
      default:
        return <Badge variant="secondary">{action}</Badge>
    }
  }

  const getModuleBadge = (module: string) => {
    const colors: { [key: string]: string } = {
      Clientes: "bg-indigo-100 text-indigo-800",
      Reservas: "bg-blue-100 text-blue-800",
      Productos: "bg-pink-100 text-pink-800",
      Facturación: "bg-orange-100 text-orange-800",
      Pagos: "bg-green-100 text-green-800",
      Proyectos: "bg-teal-100 text-teal-800",
      Configuración: "bg-gray-100 text-gray-800",
    }

    return <Badge className={colors[module] || "bg-gray-100 text-gray-800"}>{module}</Badge>
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/logs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <Shield className="w-8 h-8 text-red-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Auditoría</h1>
            <p className="text-gray-600">Registro de acciones críticas del sistema</p>
          </div>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar Auditoría
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="usuario" className="text-sm font-medium">
                  Usuario
                </label>
                <Input
                  id="usuario"
                  placeholder="Nombre de usuario"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="accion" className="text-sm font-medium">
                  Acción
                </label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="CREAR">Crear</option>
                  <option value="ACTUALIZAR">Actualizar</option>
                  <option value="ELIMINAR">Eliminar</option>
                  <option value="LOGIN">Iniciar Sesión</option>
                  <option value="LOGOUT">Cerrar Sesión</option>
                </select>
              </div>

              <div>
                <label htmlFor="modulo" className="text-sm font-medium">
                  Tabla/Módulo
                </label>
                <select className="w-full p-2 border rounded-md">
                  <option value="">Todos</option>
                  <option value="reservas">Reservas</option>
                  <option value="clientes">Clientes</option>
                  <option value="productos">Productos</option>
                  <option value="usuarios">Usuarios</option>
                </select>
              </div>

              <div>
                <label htmlFor="fecha-desde" className="text-sm font-medium">
                  Fecha Desde
                </label>
                <Input
                  id="fecha-desde"
                  type="date"
                  value={dateFrom ? format(dateFrom, "yyyy-MM-dd") : ""}
                  onChange={(e) => setDateFrom(new Date(e.target.value))}
                />
              </div>

              <div>
                <label htmlFor="fecha-hasta" className="text-sm font-medium">
                  Fecha Hasta
                </label>
                <Input
                  id="fecha-hasta"
                  type="date"
                  value={dateTo ? format(dateTo, "yyyy-MM-dd") : ""}
                  onChange={(e) => setDateTo(new Date(e.target.value))}
                />
              </div>

              <Button className="w-full">
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Registro de Auditoría</CardTitle>
              <CardDescription>Acciones críticas registradas en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Timestamp</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>Usuario</span>
                        </div>
                      </TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Valor Anterior</TableHead>
                      <TableHead>Valor Nuevo</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">{log.timestamp}</TableCell>
                        <TableCell className="font-medium">{log.user}</TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>{getModuleBadge(log.module)}</TableCell>
                        <TableCell className="font-medium">{log.record}</TableCell>
                        <TableCell className="max-w-xs">
                          {log.oldValue ? (
                            <div className="bg-red-50 p-2 rounded text-sm text-red-800 border border-red-200">
                              {log.oldValue}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {log.newValue ? (
                            <div className="bg-green-50 p-2 rounded text-sm text-green-800 border border-green-200">
                              {log.newValue}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.ip}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No hay registros de auditoría</p>
                  <p className="text-sm">
                    Los registros de auditoría aparecerán aquí cuando se realicen acciones críticas
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
