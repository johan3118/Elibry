"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Settings, Users, Database, Shield, Plus, Edit, Trash2, Save } from "lucide-react"
import Link from "next/link"

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState("parametros")

  const usuarios = [
    {
      id: "USR-001",
      nombre: "Administrador Principal",
      email: "admin@grupoellibry.com",
      rol: "Administración",
      estado: "Activo",
      ultimoAcceso: "2025-01-25 10:30",
    },
    {
      id: "USR-002",
      nombre: "Operador 1",
      email: "operador1@grupoellibry.com",
      rol: "Operativo",
      estado: "Activo",
      ultimoAcceso: "2025-01-25 09:15",
    },
    {
      id: "USR-003",
      nombre: "Operador 2",
      email: "operador2@grupoellibry.com",
      rol: "Operativo",
      estado: "Inactivo",
      ultimoAcceso: "2025-01-20 16:45",
    },
  ]

  const datosMaestros = [
    { tabla: "Impuestos", registros: 5, ultimaModificacion: "2025-01-15" },
    { tabla: "Tipos de Cambio", registros: 12, ultimaModificacion: "2025-01-25" },
    { tabla: "Formas de Pago", registros: 8, ultimaModificacion: "2025-01-10" },
    { tabla: "Estados de Reserva", registros: 6, ultimaModificacion: "2025-01-05" },
    { tabla: "Categorías de Producto", registros: 15, ultimaModificacion: "2025-01-20" },
    { tabla: "Provincias", registros: 32, ultimaModificacion: "2024-12-01" },
  ]

  const parametros = [
    { nombre: "ITBIS General", valor: "18%", descripcion: "Impuesto general aplicable" },
    { nombre: "Moneda Base", valor: "DOP", descripcion: "Moneda principal del sistema" },
    { nombre: "Días de Crédito Default", valor: "30", descripcion: "Días de crédito por defecto para nuevos clientes" },
    { nombre: "NCF Próximo", valor: "B0100000025", descripcion: "Próximo número de comprobante fiscal" },
    { nombre: "Backup Automático", valor: "Habilitado", descripcion: "Respaldo automático de base de datos" },
    { nombre: "Sesión Timeout", valor: "60 min", descripcion: "Tiempo de expiración de sesión" },
  ]

  const tabs = [
    { id: "parametros", name: "Parámetros", icon: Settings },
    { id: "usuarios", name: "Usuarios", icon: Users },
    { id: "maestros", name: "Datos Maestros", icon: Database },
    { id: "seguridad", name: "Seguridad", icon: Shield },
  ]

  return (
    <div className="container mx-auto min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 mt-6">
        <Settings className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-600">Administra la configuración del sistema</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <Link href="/configuracion/usuarios">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Usuarios
              </CardTitle>
              <CardDescription>Gestionar usuarios del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Crear, editar y administrar usuarios y permisos</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configuracion/maestros">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Datos Maestros
              </CardTitle>
              <CardDescription>Configurar datos base del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Tipos de productos, colaboradores y otros datos maestros</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configuracion/parametros">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Parámetros
              </CardTitle>
              <CardDescription>Configuración general del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Configurar parámetros generales y políticas</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="p-6">
        {/* Parámetros Tab */}
        {activeTab === "parametros" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Parámetros del Sistema</CardTitle>
                <CardDescription>Configuración general y parámetros operativos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {parametros.map((parametro, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{parametro.nombre}</h3>
                        <p className="text-sm text-gray-500">{parametro.descripcion}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Badge variant="outline">{parametro.valor}</Badge>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuración de Empresa</CardTitle>
                <CardDescription>Información básica de la empresa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nombreEmpresa">Nombre de la Empresa</Label>
                    <Input id="nombreEmpresa" defaultValue="Grupo Ellibry" />
                  </div>
                  <div>
                    <Label htmlFor="rncEmpresa">RNC</Label>
                    <Input id="rncEmpresa" defaultValue="131-12345-6" />
                  </div>
                  <div>
                    <Label htmlFor="telefonoEmpresa">Teléfono</Label>
                    <Input id="telefonoEmpresa" defaultValue="(809) 555-0100" />
                  </div>
                  <div>
                    <Label htmlFor="emailEmpresa">Email</Label>
                    <Input id="emailEmpresa" defaultValue="info@grupoellibry.com" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="direccionEmpresa">Dirección</Label>
                  <Input id="direccionEmpresa" defaultValue="Av. Principal #123, Santo Domingo, RD" />
                </div>
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Usuarios Tab */}
        {activeTab === "usuarios" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>Administrar usuarios y roles del sistema</CardDescription>
                  </div>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Último Acceso</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell className="font-medium">{usuario.nombre}</TableCell>
                        <TableCell>{usuario.email}</TableCell>
                        <TableCell>
                          <Badge variant={usuario.rol === "Administración" ? "default" : "secondary"}>
                            {usuario.rol}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={usuario.estado === "Activo" ? "default" : "secondary"}>
                            {usuario.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{usuario.ultimoAcceso}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permisos por Rol</CardTitle>
                <CardDescription>Configurar permisos de acceso por rol de usuario</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3">Rol: Administración</h3>
                      <div className="space-y-2">
                        {[
                          "Gestión de Productos",
                          "Gestión de Clientes",
                          "Gestión de Reservaciones",
                          "Gestión de Pagos",
                          "Facturación Fiscal",
                          "Proyectos Inmobiliarios",
                          "Reportes y Análisis",
                          "Configuración del Sistema",
                        ].map((permiso) => (
                          <div key={permiso} className="flex items-center justify-between">
                            <span className="text-sm">{permiso}</span>
                            <Switch defaultChecked />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">Rol: Operativo</h3>
                      <div className="space-y-2">
                        {[
                          "Gestión de Productos",
                          "Gestión de Clientes",
                          "Gestión de Reservaciones",
                          "Gestión de Pagos",
                          "Facturación Fiscal",
                          "Proyectos Inmobiliarios",
                          "Reportes y Análisis",
                          "Configuración del Sistema",
                        ].map((permiso, index) => (
                          <div key={permiso} className="flex items-center justify-between">
                            <span className="text-sm">{permiso}</span>
                            <Switch defaultChecked={index < 6} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Datos Maestros Tab */}
        {activeTab === "maestros" && (
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Datos Maestros</CardTitle>
              <CardDescription>Administrar tablas maestras del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {datosMaestros.map((tabla, index) => (
                  <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{tabla.tabla}</h3>
                        <Badge variant="outline">{tabla.registros}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">Última modificación: {tabla.ultimaModificacion}</p>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                          <Database className="w-3 h-3 mr-1" />
                          Ver
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                          <Edit className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seguridad Tab */}
        {activeTab === "seguridad" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Seguridad</CardTitle>
                <CardDescription>Políticas de seguridad y auditoría</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Políticas de Contraseña</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Longitud mínima (8 caracteres)</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Requerir mayúsculas</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Requerir números</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Requerir símbolos</span>
                        <Switch />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold">Configuración de Sesión</h3>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="sessionTimeout">Tiempo de expiración (minutos)</Label>
                        <Input id="sessionTimeout" defaultValue="60" type="number" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Cerrar sesión automáticamente</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Recordar dispositivo</span>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registro de Auditoría</CardTitle>
                <CardDescription>Historial de cambios y accesos al sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Habilitar registro de auditoría</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Registrar cambios en datos</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Registrar accesos de usuario</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Retener logs por 90 días</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Respaldo y Recuperación</CardTitle>
                <CardDescription>Configuración de copias de seguridad</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Respaldo automático diario</span>
                    <Switch defaultChecked />
                  </div>
                  <div>
                    <Label htmlFor="backupTime">Hora de respaldo</Label>
                    <Select defaultValue="02:00">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="01:00">1:00 AM</SelectItem>
                        <SelectItem value="02:00">2:00 AM</SelectItem>
                        <SelectItem value="03:00">3:00 AM</SelectItem>
                        <SelectItem value="04:00">4:00 AM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="retentionDays">Días de retención</Label>
                    <Input id="retentionDays" defaultValue="30" type="number" />
                  </div>
                  <Button variant="outline">
                    <Database className="w-4 h-4 mr-2" />
                    Ejecutar Respaldo Manual
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
