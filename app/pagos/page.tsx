"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreditCard, Search, Plus, Eye, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface Pago {
  id: number
  reserva_id: number
  cliente_id: number
  monto: number
  metodo_pago: string
  referencia?: string
  fecha_pago: string
  concepto: string
  estado: string
  usuario: string
  creado_en: string
}

export default function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    cargarPagos()
  }, [])

  const cargarPagos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("pagos").select("*").order("fecha_pago", { ascending: false })

      if (error) {
        console.error("Error cargando pagos:", error)
        toast({
          title: "Error",
          description: "Error al cargar los pagos",
          variant: "destructive",
        })
        return
      }

      setPagos(data || [])
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar los pagos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const pagosFiltrados = pagos.filter((pago) => {
    const matchesSearch =
      pago.concepto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pago.referencia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pago.id.toString().includes(searchQuery)

    const matchesStatus = statusFilter === "todos" || pago.estado.toLowerCase() === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmado":
        return "bg-green-100 text-green-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "procesado":
        return "bg-blue-100 text-blue-800"
      case "cancelado":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-DO")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando pagos...</p>
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
              <CreditCard className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Gestión de Pagos</h1>
                <p className="text-sm text-gray-500">Administrar todos los pagos del sistema</p>
              </div>
            </div>
          </div>
          <Button onClick={() => router.push("/pagos/registrar")} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Registrar Pago
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
                  <p className="text-sm text-gray-600">Total Pagos</p>
                  <p className="text-2xl font-bold text-blue-600">{pagosFiltrados.length}</p>
                </div>
                <CreditCard className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Monto Total</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(pagosFiltrados.reduce((sum, pago) => sum + pago.monto, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Confirmados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {pagosFiltrados.filter((p) => p.estado === "CONFIRMADO").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {pagosFiltrados.filter((p) => p.estado === "PENDIENTE").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-600">Filtros</CardTitle>
            <CardDescription>Buscar y filtrar pagos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por concepto, referencia o ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="procesado">Procesado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Lista de Pagos ({pagosFiltrados.length})</CardTitle>
            <CardDescription>Todos los pagos registrados en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {pagosFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pagos</h3>
                <p className="text-gray-500">
                  {searchQuery || statusFilter !== "todos"
                    ? "No se encontraron pagos con los filtros aplicados."
                    : "No hay pagos registrados en este momento."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Reserva</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosFiltrados.map((pago) => (
                      <TableRow key={pago.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{pago.id}</TableCell>
                        <TableCell>{pago.reserva_id}</TableCell>
                        <TableCell className="font-medium text-green-600">{formatCurrency(pago.monto)}</TableCell>
                        <TableCell>{pago.metodo_pago}</TableCell>
                        <TableCell>{pago.referencia || "N/A"}</TableCell>
                        <TableCell>{formatDate(pago.fecha_pago)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{pago.concepto}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(pago.estado)}>{pago.estado}</Badge>
                        </TableCell>
                        <TableCell>{pago.usuario}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/pagos/ver/${pago.id}`)}
                              className="border-blue-200 text-blue-600 hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
