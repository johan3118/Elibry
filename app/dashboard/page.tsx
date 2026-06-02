"use client"

import { AuthGuard } from "@/components/auth-guard"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Users,
  Package,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  BarChart3,
  UserPlus,
  PackagePlus,
  CalendarPlus,
  Search,
  Building2,
  CreditCard,
  ClipboardList,
  Activity,
  Shield,
  UserCog,
  Sliders,
  FolderOpen,
  UserCheck,
  Briefcase,
  Clock,
  HeartHandshake,
  AlertTriangle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { HeaderWithLogout } from "@/components/header-with-logout"

interface Stats {
  totalClientes: number
  totalProductos: number
  reservasPendientes: number
  penalidadProxima: number
  casosCRM: number
}

function DashboardContent() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0,
    totalProductos: 0,
    reservasPendientes: 0,
    penalidadProxima: 0,
    casosCRM: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  const cargarEstadisticas = async () => {
    try {
      setLoading(true)

      // Calcular la fecha límite para penalidades (10 días desde hoy)
      const hoy = new Date()
      const limite10Dias = new Date(hoy)
      limite10Dias.setDate(hoy.getDate() + 10)
      const hoyStr = hoy.toISOString().split("T")[0]
      const limite10DiasStr = limite10Dias.toISOString().split("T")[0]

      const [clientesResult, productosResult, reservasPendientesResult, penalidadResult, casosResult] = await Promise.all([
        supabase.from("clientes").select("*", { count: "exact", head: true }),
        supabase.from("productos").select("*", { count: "exact", head: true }),
        supabase.from("reservas").select("*", { count: "exact", head: true }).eq("status", "PENDIENTE"),
        supabase.from("reservas")
          .select("fecha_limite_pago, balance_reserva, balance_abonado")
          .neq("status", "CANCELADA")
          .gte("fecha_limite_pago", hoyStr)
          .lte("fecha_limite_pago", limite10DiasStr),
        supabase.from("seguimiento_casos").select("*", { count: "exact", head: true }).eq("estado", "ABIERTO"),
      ])

      setStats({
        totalClientes: clientesResult.count || 0,
        totalProductos: productosResult.count || 0,
        reservasPendientes: reservasPendientesResult.count || 0,
        penalidadProxima: penalidadResult.data?.filter(
          (r: any) => parseFloat(r.balance_abonado || 0) < parseFloat(r.balance_reserva || 0)
        ).length || 0,
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
          icon: UserPlus,
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
          icon: PackagePlus,
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
          icon: UserPlus,
          path: "/suplidores/registrar",
          color: "text-green-600",
        },
      ],
    },

    // Gestión de Reservaciones
    {
      title: "Gestión de Reservaciones",
      description: "Administra reservas y seguimiento de casos",
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
          icon: CalendarPlus,
          path: "/reservas/crear",
          color: "text-green-600",
        },
        {
          name: "Seguimiento de Casos",
          description: "Seguimiento y gestión de casos",
          icon: ClipboardList,
          path: "/reservas/seguimiento",
          color: "text-blue-600",
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
          icon: CreditCard,
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
          icon: CreditCard,
          path: "/facturacion/voucher",
          color: "text-purple-600",
        },
        {
          name: "Comprobantes Fiscales",
          description: "Gestión de comprobantes fiscales",
          icon: FileText,
          path: "/facturacion/comprobantes",
          color: "text-orange-600",
        },
      ],
    },

    // Proyectos
    {
      title: "Proyectos",
      description: "Gestión de proyectos y seguimiento",
      icon: Briefcase,
      color: "bg-indigo-500",
      items: [
        {
          name: "Lista de Proyectos",
          description: "Ver todos los proyectos activos",
          icon: Briefcase,
          path: "/proyectos",
          color: "text-indigo-600",
        },
        {
          name: "Facturas de Proyectos",
          description: "Facturas asociadas a proyectos",
          icon: FileText,
          path: "/proyectos/facturas",
          color: "text-green-600",
        },
        {
          name: "Pagos de Proyectos",
          description: "Gestión de pagos por proyecto",
          icon: DollarSign,
          path: "/proyectos/pagos",
          color: "text-blue-600",
        },
        {
          name: "Buscar Pagos",
          description: "Buscar pagos de proyectos",
          icon: Search,
          path: "/proyectos/buscar-pagos",
          color: "text-orange-600",
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

    // Logs del Sistema
    {
      title: "Logs del Sistema",
      description: "Monitoreo y auditoría del sistema",
      icon: Activity,
      color: "bg-gray-500",
      items: [
        {
          name: "Logs Generales",
          description: "Ver logs generales del sistema",
          icon: Activity,
          path: "/logs",
          color: "text-gray-600",
        },
        {
          name: "Auditoría",
          description: "Logs de auditoría y seguridad",
          icon: Shield,
          path: "/logs/auditoria",
          color: "text-red-600",
        },
        {
          name: "Rendimiento",
          description: "Métricas de rendimiento del sistema",
          icon: BarChart3,
          path: "/logs/rendimiento",
          color: "text-blue-600",
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
        {
          name: "Datos Maestros",
          description: "Gestión de datos maestros",
          icon: FolderOpen,
          path: "/configuracion/maestros",
          color: "text-blue-600",
        },
        {
          name: "Usuarios",
          description: "Gestión de usuarios del sistema",
          icon: UserCog,
          path: "/configuracion/usuarios",
          color: "text-green-600",
        },
        {
          name: "Parámetros",
          description: "Configuración de parámetros",
          icon: Sliders,
          path: "/configuracion/parametros",
          color: "text-purple-600",
        },
        {
          name: "Tipos de Productos",
          description: "Configurar tipos de productos",
          icon: Package,
          path: "/configuracion/tipos-productos",
          color: "text-orange-600",
        },
        {
          name: "Colaboradores",
          description: "Gestión de colaboradores",
          icon: UserCheck,
          path: "/configuracion/colaboradores",
          color: "text-teal-600",
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
              <p className="text-sm text-gray-500">Bienvenido al sistema</p>
              <p className="text-lg font-semibold text-blue-600">Grupo Ellibry</p>
            </div>
            <HeaderWithLogout />
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/clientes")}>
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

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/productos")}>
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

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/reservas/pendientes")}>
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

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/reservas/pendientes")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Penalidad Proxima</p>
                  <p className="text-2xl font-bold text-red-600">
                    {loading ? "..." : stats.penalidadProxima.toLocaleString()}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/crm/casos")}>
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
                      onClick={() => router.push(item.path)}
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

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  )
}
