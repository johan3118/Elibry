"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Search, Filter, DollarSign, TrendingUp, TrendingDown, AlertCircle, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase, type Cliente } from "@/lib/supabase"

interface ClienteConBalance extends Cliente {
  balance_total: number
  balance_rdp: number
  balance_usd: number
  reservas_count: number
  ultima_reserva?: string
  marca?: string
  atendido_por?: string
  referido_por_valor?: string
}

export default function ClientesBalancePage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<ClienteConBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTipo, setFilterTipo] = useState("ALL")
  const [filterBalance, setFilterBalance] = useState("ALL")

  // Cargar clientes con sus balances
  const cargarClientesConBalance = async () => {
    try {
      setLoading(true)

      // Primero cargar todos los clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("*")
        .eq("status", "ACTIVO")
        .order("fecha_creado", { ascending: false })

      if (clientesError) {
        console.error("Error cargando clientes:", clientesError)
        setClientes([])
        return
      }

      // Cargar todas las reservas para calcular balances
      const { data: reservasData, error: reservasError } = await supabase
        .from("reservas")
        .select("id, cliente_id, precio_total, abonado_contabilidad, fecha_creado, moneda, atendido_por, referido_por")

      if (reservasError) {
        console.error("Error cargando reservas:", reservasError)
      }

      // Cargar todos los pagos para calcular balances correctos
      const { data: pagosData, error: pagosError } = await supabase.from("pagos").select("reserva_id, monto")

      if (pagosError) {
        console.error("Error cargando pagos:", pagosError)
      }

      // Calcular balances por cliente (split por moneda)
      const clientesConBalance: ClienteConBalance[] = (clientesData || []).map((cliente) => {
        const reservasCliente = (reservasData || []).filter((r) => r.cliente_id === cliente.id)

        let balance_rdp = 0
        let balance_usd = 0
        let atendido_por = ""
        let referido_por_valor = ""

        for (const reserva of reservasCliente) {
          const precio = Number(reserva.precio_total) || 0
          const abonado = Number(reserva.abonado_contabilidad) || 0
          const pagosReserva = (pagosData || []).filter((p: any) => p.reserva_id === reserva.id)
          const totalPagos = pagosReserva.reduce((sum: number, pago: any) => sum + (Number(pago.monto) || 0), 0)
          const balanceReserva = precio - abonado - totalPagos

          if ((reserva.moneda || "DOP") === "USD") {
            balance_usd += balanceReserva
          } else {
            balance_rdp += balanceReserva
          }

          if (!atendido_por && reserva.atendido_por) atendido_por = reserva.atendido_por
          if (!referido_por_valor && reserva.referido_por) referido_por_valor = reserva.referido_por
        }

        const balance_total = balance_rdp + balance_usd
        const reservas_count = reservasCliente.length
        const ultima_reserva =
          reservasCliente.length > 0
            ? reservasCliente.sort((a, b) => new Date(b.fecha_creado).getTime() - new Date(a.fecha_creado).getTime())[0]
                .fecha_creado
            : undefined

        return {
          ...cliente,
          balance_total,
          balance_rdp,
          balance_usd,
          reservas_count,
          ultima_reserva,
          marca: cliente.compania || "",
          atendido_por,
          referido_por_valor,
        }
      })

      setClientes(clientesConBalance)
    } catch (error) {
      console.error("Error crítico cargando clientes con balance:", error)
      setClientes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarClientesConBalance()
  }, [])

  // Filtrar clientes
  const clientesFiltrados = clientes.filter((cliente) => {
    const nombre = cliente.nombre_completo || cliente.razon_social || ""
    const matchSearch =
      nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente.telefonos || "").includes(searchTerm)

    const matchTipo = filterTipo === "ALL" || cliente.tipo_cliente === filterTipo

    let matchBalance = true
    if (filterBalance === "POSITIVO") {
      matchBalance = cliente.balance_total > 0
    } else if (filterBalance === "NEGATIVO") {
      matchBalance = cliente.balance_total < 0
    } else if (filterBalance === "CERO") {
      matchBalance = cliente.balance_total === 0
    }

    return matchSearch && matchTipo && matchBalance
  })

  // Estadísticas
  const clientesConPendiente = clientes.filter((c) => c.balance_total > 0)
  const stats = {
    total: clientesConPendiente.length,
    con_balance_positivo: clientes.filter((c) => c.balance_total > 0).length,
    con_balance_negativo: clientes.filter((c) => c.balance_total < 0).length,
    balance_cero: clientes.filter((c) => c.balance_total === 0).length,
    balance_total_rdp: clientes.reduce((sum, c) => sum + c.balance_rdp, 0),
    balance_total_usd: clientes.reduce((sum, c) => sum + c.balance_usd, 0),
    promedio_balance: clientes.length > 0 ? clientes.reduce((sum, c) => sum + c.balance_total, 0) / clientes.length : 0,
  }

  const formatCurrency = (amount: number, currency = "DOP") => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "DOP",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/clientes")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Clientes
            </Button>
            <div className="flex items-center space-x-2">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Balance de Clientes</h1>
                <p className="text-sm text-gray-500">Gestión de balances y cuentas por cobrar</p>
              </div>
            </div>
          </div>
        </header>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
              <p className="text-gray-500">Cargando balances de clientes...</p>
            </div>
          </div>
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
              onClick={() => router.push("/clientes")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Clientes
            </Button>
            <div className="flex items-center space-x-2">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Balance de Clientes</h1>
                <p className="text-sm text-gray-500">Gestión de balances y cuentas por cobrar</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push("/clientes")}
            variant="outline"
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            Ver Todos los Clientes
          </Button>
        </div>
      </header>

      <div className="p-6">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Clientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.con_balance_positivo}</p>
                <p className="text-sm text-gray-500">Balance Positivo</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.con_balance_negativo}</p>
                <p className="text-sm text-gray-500">Balance Negativo</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">{stats.balance_cero}</p>
                <p className="text-sm text-gray-500">Balance Cero</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-orange-600">{formatCurrency(stats.balance_total_rdp, "DOP")}</p>
                <p className="text-sm text-gray-500">Balance Total RD$</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-purple-600">{formatCurrency(stats.balance_total_usd, "USD")}</p>
                <p className="text-sm text-gray-500">Balance Total US$</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <Filter className="w-5 h-5 mr-2" />
              Filtros y Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nombre, email o teléfono..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Cliente</label>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los tipos</SelectItem>
                    <SelectItem value="NORMAL">NORMAL</SelectItem>
                    <SelectItem value="EMPRESA">EMPRESA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Balance</label>
                <Select value={filterBalance} onValueChange={setFilterBalance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los balances" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los balances</SelectItem>
                    <SelectItem value="POSITIVO">Balance Positivo</SelectItem>
                    <SelectItem value="NEGATIVO">Balance Negativo</SelectItem>
                    <SelectItem value="CERO">Balance Cero</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("")
                    setFilterTipo("ALL")
                    setFilterBalance("ALL")
                  }}
                  className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Clientes con Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Clientes con Balance ({clientesFiltrados.length})</CardTitle>
            <CardDescription>Balance promedio: {formatCurrency(stats.promedio_balance)}</CardDescription>
          </CardHeader>
          <CardContent>
            {clientesFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No se encontraron clientes</p>
                <p className="text-sm text-gray-400">
                  {clientes.length === 0
                    ? "No hay clientes con reservas registradas"
                    : "Intenta ajustar los filtros de búsqueda"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2 whitespace-nowrap">ID</th>
                      <th className="text-left p-2 whitespace-nowrap">Identificacion</th>
                      <th className="text-left p-2 whitespace-nowrap">Nombre Cliente</th>
                      <th className="text-left p-2 whitespace-nowrap">Telefono</th>
                      <th className="text-left p-2 whitespace-nowrap">Marca</th>
                      <th className="text-left p-2 whitespace-nowrap">Referido Por</th>
                      <th className="text-left p-2 whitespace-nowrap">Atendido Por</th>
                      <th className="text-right p-2 whitespace-nowrap">Balance RD$</th>
                      <th className="text-right p-2 whitespace-nowrap">Balance US$</th>
                      <th className="text-center p-2 whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map((cliente) => (
                      <tr key={cliente.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-mono">{cliente.id}</td>
                        <td className="p-2 whitespace-nowrap">{cliente.identificacion || cliente.rnc || "N/A"}</td>
                        <td className="p-2 whitespace-nowrap">
                          <div>
                            <p className="font-medium">{cliente.nombre_completo || cliente.razon_social}</p>
                            {cliente.tipo_cliente === "EMPRESA" && cliente.nombre_comercial && (
                              <p className="text-xs text-gray-500">{cliente.nombre_comercial}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">{cliente.telefonos || "N/A"}</td>
                        <td className="p-2 whitespace-nowrap">{cliente.marca || "N/A"}</td>
                        <td className="p-2 whitespace-nowrap">{cliente.referido_por_valor || "N/A"}</td>
                        <td className="p-2 whitespace-nowrap">{cliente.atendido_por || "N/A"}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <span className={`font-medium ${cliente.balance_rdp > 0 ? "text-red-600" : cliente.balance_rdp < 0 ? "text-green-600" : "text-gray-600"}`}>
                            {formatCurrency(cliente.balance_rdp, "DOP")}
                          </span>
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <span className={`font-medium ${cliente.balance_usd > 0 ? "text-purple-600" : cliente.balance_usd < 0 ? "text-green-600" : "text-gray-600"}`}>
                            {formatCurrency(cliente.balance_usd, "USD")}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex justify-center space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/clientes/balance-reserva?cliente_id=${cliente.id}`)}
                              className="border-green-200 text-green-600 hover:bg-green-50"
                            >
                              Ver Detalle
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
