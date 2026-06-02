"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Database, Plus, Edit, Trash2, ArrowLeft, Search, Settings } from "lucide-react"
import Link from "next/link"

export default function DatosMaestrosPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTable, setSelectedTable] = useState<string | null>(null)

  const tablasMaestras = [
    {
      id: "impuestos",
      nombre: "Impuestos",
      registros: 5,
      ultimaModificacion: "2025-01-15",
      descripcion: "Configuración de impuestos y tasas",
    },
    {
      id: "tipos-cambio",
      nombre: "Tipos de Cambio",
      registros: 12,
      ultimaModificacion: "2025-01-25",
      descripcion: "Tasas de cambio de monedas",
    },
    {
      id: "formas-pago",
      nombre: "Formas de Pago",
      registros: 8,
      ultimaModificacion: "2025-01-10",
      descripcion: "Métodos de pago disponibles",
    },
    {
      id: "estados-reserva",
      nombre: "Estados de Reserva",
      registros: 6,
      ultimaModificacion: "2025-01-05",
      descripcion: "Estados del ciclo de vida de reservas",
    },
    {
      id: "categorias-producto",
      nombre: "Categorías de Producto",
      registros: 15,
      ultimaModificacion: "2025-01-20",
      descripcion: "Clasificación de productos y servicios",
    },
    {
      id: "provincias",
      nombre: "Provincias",
      registros: 32,
      ultimaModificacion: "2024-12-01",
      descripcion: "División territorial de República Dominicana",
    },
  ]

  // Datos de ejemplo para la tabla seleccionada
  const datosEjemplo = {
    impuestos: [
      { id: 1, codigo: "ITBIS", nombre: "ITBIS General", tasa: "18%", activo: true },
      { id: 2, codigo: "ISC", nombre: "Impuesto Selectivo", tasa: "10%", activo: true },
      { id: 3, codigo: "PROP", nombre: "Propina Legal", tasa: "10%", activo: false },
    ],
    "formas-pago": [
      { id: 1, codigo: "EFE", nombre: "Efectivo", activo: true },
      { id: 2, codigo: "TRF", nombre: "Transferencia", activo: true },
      { id: 3, codigo: "CHQ", nombre: "Cheque", activo: true },
      { id: 4, codigo: "TJT", nombre: "Tarjeta", activo: true },
    ],
    "estados-reserva": [
      { id: 1, codigo: "PEN", nombre: "Pendiente", color: "#FCD34D", activo: true },
      { id: 2, codigo: "CON", nombre: "Confirmada", color: "#60A5FA", activo: true },
      { id: 3, codigo: "COM", nombre: "Completada", color: "#34D399", activo: true },
      { id: 4, codigo: "CAN", nombre: "Cancelada", color: "#F87171", activo: true },
    ],
  }

  const filteredTables = tablasMaestras.filter((tabla) =>
    tabla.nombre.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <Link href="/configuracion">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Configuración
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-orange-600">Gestión de Datos Maestros</h1>
            <p className="text-sm text-gray-500">Administrar tablas maestras del sistema</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Database className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Datos Maestros</h1>
            <p className="text-gray-600">Configurar datos base del sistema</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/configuracion/tipos-productos">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Tipos de Productos
                  <Settings className="w-5 h-5" />
                </CardTitle>
                <CardDescription>Gestionar categorías de productos</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Configurar tipos y categorías de productos disponibles</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/configuracion/colaboradores">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Colaboradores
                  <Settings className="w-5 h-5" />
                </CardTitle>
                <CardDescription>Gestionar colaboradores y vendedores</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Administrar lista de colaboradores y comisiones</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Destinos
                <Settings className="w-5 h-5" />
              </CardTitle>
              <CardDescription>Gestionar destinos turísticos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Próximamente disponible</p>
            </CardContent>
          </Card>

          {/* Tables List */}
          <Card className="col-span-1 md:col-span-2 lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Tablas Maestras
                </CardTitle>
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Tabla
                </Button>
              </div>
              <CardDescription>Seleccione una tabla para ver y editar sus datos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar tabla..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredTables.map((tabla) => (
                  <Card
                    key={tabla.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTable === tabla.id ? "ring-2 ring-orange-500 bg-orange-50" : ""
                    }`}
                    onClick={() => setSelectedTable(tabla.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{tabla.nombre}</h3>
                        <Badge variant="outline">{tabla.registros} registros</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{tabla.descripcion}</p>
                      <p className="text-xs text-gray-500">Última modificación: {tabla.ultimaModificacion}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Table Data */}
          <Card className="col-span-1 md:col-span-2 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {selectedTable ? tablasMaestras.find((t) => t.id === selectedTable)?.nombre : "Datos de la Tabla"}
                </CardTitle>
                {selectedTable && (
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Registro
                  </Button>
                )}
              </div>
              <CardDescription>
                {selectedTable
                  ? "Gestionar registros de la tabla seleccionada"
                  : "Seleccione una tabla para ver sus datos"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTable ? (
                <div>
                  {/* Mostrar datos según la tabla seleccionada */}
                  {selectedTable === "impuestos" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tasa</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {datosEjemplo.impuestos.map((impuesto) => (
                          <TableRow key={impuesto.id}>
                            <TableCell className="font-medium">{impuesto.codigo}</TableCell>
                            <TableCell>{impuesto.nombre}</TableCell>
                            <TableCell>{impuesto.tasa}</TableCell>
                            <TableCell>
                              <Badge variant={impuesto.activo ? "default" : "secondary"}>
                                {impuesto.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
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
                  )}

                  {selectedTable === "formas-pago" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {datosEjemplo["formas-pago"].map((forma) => (
                          <TableRow key={forma.id}>
                            <TableCell className="font-medium">{forma.codigo}</TableCell>
                            <TableCell>{forma.nombre}</TableCell>
                            <TableCell>
                              <Badge variant={forma.activo ? "default" : "secondary"}>
                                {forma.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
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
                  )}

                  {selectedTable === "estados-reserva" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {datosEjemplo["estados-reserva"].map((estado) => (
                          <TableRow key={estado.id}>
                            <TableCell className="font-medium">{estado.codigo}</TableCell>
                            <TableCell>{estado.nombre}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: estado.color }}></div>
                                <span className="text-sm">{estado.color}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={estado.activo ? "default" : "secondary"}>
                                {estado.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
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
                  )}

                  {/* Para otras tablas, mostrar mensaje genérico */}
                  {!["impuestos", "formas-pago", "estados-reserva"].includes(selectedTable) && (
                    <div className="text-center py-8 text-gray-500">
                      <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Datos de la tabla "{tablasMaestras.find((t) => t.id === selectedTable)?.nombre}"</p>
                      <p className="text-sm">
                        {tablasMaestras.find((t) => t.id === selectedTable)?.registros} registros disponibles
                      </p>
                      <Button className="mt-4 bg-transparent" variant="outline">
                        <Edit className="w-4 h-4 mr-2" />
                        Editar Datos
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Seleccione una tabla de la lista para ver y editar sus datos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
