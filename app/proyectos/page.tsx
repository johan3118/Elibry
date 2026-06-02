"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FolderOpen, Plus, Calendar, Users, DollarSign, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProyectosPage() {
  const router = useRouter()
  const [proyectos] = useState([
    {
      id: 1,
      nombre: "Proyecto Turístico Punta Cana",
      descripcion: "Desarrollo de complejo turístico en Punta Cana",
      estado: "ACTIVO",
      fechaInicio: "2024-01-15",
      fechaFin: "2024-12-31",
      presupuesto: 2500000,
      responsable: "María González",
      progreso: 65,
    },
    {
      id: 2,
      nombre: "Expansión Hotel Santo Domingo",
      descripcion: "Ampliación de instalaciones hoteleras",
      estado: "PLANIFICACION",
      fechaInicio: "2024-03-01",
      fechaFin: "2024-08-30",
      presupuesto: 1800000,
      responsable: "Carlos Martínez",
      progreso: 25,
    },
  ])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "activo":
        return "bg-green-100 text-green-800"
      case "planificacion":
        return "bg-blue-100 text-blue-800"
      case "completado":
        return "bg-gray-100 text-gray-800"
      case "pausado":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-DO")
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
              <FolderOpen className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Gestión de Proyectos</h1>
                <p className="text-sm text-gray-500">Administrar proyectos y seguimiento</p>
              </div>
            </div>
          </div>
          <Button className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Proyecto
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
                  <p className="text-sm text-gray-600">Total Proyectos</p>
                  <p className="text-2xl font-bold text-blue-600">{proyectos.length}</p>
                </div>
                <FolderOpen className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Activos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {proyectos.filter((p) => p.estado === "ACTIVO").length}
                  </p>
                </div>
                <Users className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">En Planificación</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {proyectos.filter((p) => p.estado === "PLANIFICACION").length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Presupuesto Total</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(proyectos.reduce((sum, p) => sum + p.presupuesto, 0))}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proyectos.map((proyecto) => (
            <Card key={proyecto.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-blue-600">{proyecto.nombre}</CardTitle>
                  <Badge className={getStatusColor(proyecto.estado)}>{proyecto.estado}</Badge>
                </div>
                <CardDescription>{proyecto.descripcion}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Responsable:</span>
                    <span className="text-sm font-medium">{proyecto.responsable}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Presupuesto:</span>
                    <span className="text-sm font-medium text-green-600">{formatCurrency(proyecto.presupuesto)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Inicio:</span>
                    <span className="text-sm">{formatDate(proyecto.fechaInicio)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fin:</span>
                    <span className="text-sm">{formatDate(proyecto.fechaFin)}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Progreso:</span>
                      <span className="text-sm font-medium">{proyecto.progreso}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${proyecto.progreso}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      Ver Detalles
                    </Button>
                    <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                      Editar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-green-600">Acciones Rápidas</CardTitle>
            <CardDescription>Gestión rápida de proyectos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-transparent"
                onClick={() => router.push("/proyectos/facturas")}
              >
                <FolderOpen className="w-6 h-6" />
                <span>Gestionar Facturas</span>
              </Button>

              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-transparent"
                onClick={() => router.push("/proyectos/pagos")}
              >
                <DollarSign className="w-6 h-6" />
                <span>Gestionar Pagos</span>
              </Button>

              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-transparent"
                onClick={() => router.push("/proyectos/buscar-pagos")}
              >
                <Users className="w-6 h-6" />
                <span>Buscar Pagos</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
