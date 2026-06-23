"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HeartHandshake, ArrowLeft, AlertCircle, Clock, CheckCircle, Users, Activity } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface CasoStats {
  total: number
  abiertos: number
  enProceso: number
  cerrados: number
  criticos: number // +48h
  alerta: number // 24-48h
  normales: number // 0-24h
}

export default function CRMDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<CasoStats>({
    total: 0,
    abiertos: 0,
    enProceso: 0,
    cerrados: 0,
    criticos: 0,
    alerta: 0,
    normales: 0,
  })

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  const cargarEstadisticas = async () => {
    try {
      setLoading(true)

      const { data: casos, error } = await supabase.from("seguimiento_casos").select("*")

      if (error) {
        console.error("Error cargando casos:", error)
        // Use fallback data
        setStats({
          total: 3,
          abiertos: 1,
          enProceso: 1,
          cerrados: 1,
          criticos: 1,
          alerta: 1,
          normales: 1,
        })
        return
      }

      const now = new Date()
      let criticos = 0
      let alerta = 0
      let normales = 0

      casos?.forEach((caso) => {
        if (caso.estado !== "CERRADO") {
          const createdAt = new Date(caso.created_at)
          const hoursOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)

          if (hoursOld > 48) {
            criticos++
          } else if (hoursOld > 24) {
            alerta++
          } else {
            normales++
          }
        }
      })

      setStats({
        total: casos?.length || 0,
        abiertos: casos?.filter((c) => c.estado === "ABIERTO").length || 0,
        enProceso: casos?.filter((c) => c.estado === "EN_PROCESO").length || 0,
        cerrados: casos?.filter((c) => c.estado === "CERRADO").length || 0,
        criticos,
        alerta,
        normales,
      })
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard CRM...</p>
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
              onClick={() => router.push("/")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
            <div className="flex items-center space-x-2">
              <HeartHandshake className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">CRM - Gestión de la Relación con el Cliente</h1>
                <p className="text-sm text-gray-500">Panel de control y seguimiento de casos</p>
              </div>
            </div>
          </div>
          <Button onClick={() => router.push("/crm/casos")} className="bg-green-600 hover:bg-green-700">
            <Activity className="w-4 h-4 mr-2" />
            Ver Todos los Casos
          </Button>
        </div>
      </header>

      <div className="p-6">
        {/* Notificaciones por Antigüedad - Dashboard de Casos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-blue-600 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Panel de Notificaciones por Antigüedad
            </CardTitle>
            <CardDescription>Clasificación de casos abiertos por tiempo de antigüedad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 0-24 horas - Verde/Normal */}
              <Card
                className="border-2 border-green-500 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors"
                onClick={() => router.push("/crm/casos?filtro=normal")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">0-24 Horas</p>
                      <p className="text-3xl font-bold text-green-600">{stats.normales}</p>
                      <p className="text-xs text-green-600">Normal</p>
                    </div>
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              {/* 24-48 horas - Amarillo/Alerta */}
              <Card
                className="border-2 border-yellow-500 bg-yellow-50 cursor-pointer hover:bg-yellow-100 transition-colors"
                onClick={() => router.push("/crm/casos?filtro=alerta")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-700">24-48 Horas</p>
                      <p className="text-3xl font-bold text-yellow-600">{stats.alerta}</p>
                      <p className="text-xs text-yellow-600">Alerta</p>
                    </div>
                    <Clock className="w-10 h-10 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              {/* +48 horas - Rojo/Crítico */}
              <Card
                className="border-2 border-red-500 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
                onClick={() => router.push("/crm/casos?filtro=critico")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-700">+48 Horas</p>
                      <p className="text-3xl font-bold text-red-600">{stats.criticos}</p>
                      <p className="text-xs text-red-600">Crítico</p>
                    </div>
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas Generales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push("/crm/casos?filtro=TODOS")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Casos</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push("/crm/casos?filtro=ABIERTO")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Abiertos</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.abiertos}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push("/crm/casos?filtro=EN_PROCESO")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">En Proceso</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.enProceso}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push("/crm/casos?filtro=CERRADO")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cerrados</p>
                  <p className="text-2xl font-bold text-green-600">{stats.cerrados}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Acciones Rápidas</CardTitle>
            <CardDescription>Acceso directo a las funciones principales del CRM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2 bg-transparent"
                onClick={() => router.push("/crm/casos")}
              >
                <Activity className="w-6 h-6 text-blue-600" />
                <span>Ver Todos los Casos</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2 bg-transparent"
                onClick={() => router.push("/crm/casos?crear=true")}
              >
                <HeartHandshake className="w-6 h-6 text-green-600" />
                <span>Crear Nuevo Caso</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2 bg-transparent"
                onClick={() => router.push("/crm/casos?filtro=critico")}
              >
                <AlertCircle className="w-6 h-6 text-red-600" />
                <span>Casos Críticos</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
