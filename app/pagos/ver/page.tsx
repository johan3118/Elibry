"use client"

import Link from "next/link"
import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Edit, ArrowLeft, User, Calendar, FileText, DollarSign, Receipt, Building2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { formatDateDMY } from "@/lib/utils"

interface Pago {
  id: string
  reserva_id: string
  cliente_id: string
  monto: number
  metodo_pago: string
  referencia: string
  estado: string
  notas?: string
  usuario: string
  creado_en: string
  editado_en?: string
  editado_por?: string
}

interface Reserva {
  id: string
  numero_reserva: string
  moneda: string
  total: number
  producto_id?: string
}

interface Cliente {
  id: string
  nombre_completo?: string
  razon_social?: string
  tipo_cliente: string
  email: string
  telefonos: string
}

interface Producto {
  nombre: string
  descripcion: string
}

export default function VerPagoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pagoId = searchParams.get("id")
  const [loading, setLoading] = useState(true)
  const [pago, setPago] = useState<Pago | null>(null)
  const [reserva, setReserva] = useState<Reserva | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [producto, setProducto] = useState<Producto | null>(null)

  useEffect(() => {
    if (pagoId) {
      cargarPago()
    }
  }, [pagoId])

  const cargarPago = async () => {
    try {
      setLoading(true)

      // First, get the payment data
      const { data: pagoData, error: pagoError } = await supabase.from("pagos").select("*").eq("id", pagoId).single()

      if (pagoError) {
        console.error("Error cargando pago:", pagoError)
        return
      }

      setPago(pagoData)

      // Then get the reservation data
      const { data: reservaData, error: reservaError } = await supabase
        .from("reservas")
        .select("*")
        .eq("id", pagoData.reserva_id)
        .single()

      if (!reservaError) {
        setReserva(reservaData)

        // Get product data if available
        if (reservaData.producto_id) {
          const { data: productoData, error: productoError } = await supabase
            .from("productos")
            .select("nombre, descripcion")
            .eq("id", reservaData.producto_id)
            .single()

          if (!productoError) {
            setProducto(productoData)
          }
        }
      }

      // Get client data
      const { data: clienteData, error: clienteError } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", pagoData.cliente_id)
        .single()

      if (!clienteError) {
        setCliente(clienteData)
      }
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
          <p className="mt-4 text-gray-600">Cargando pago...</p>
        </div>
      </div>
    )
  }

  if (!pago) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Pago no encontrado</p>
          <Link href="/reservas/pendientes">
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700">Volver a Reservas</Button>
          </Link>
        </div>
      </div>
    )
  }

  const formatDateTime = (dateString: string) => {
    return formatDateDMY(dateString)
  }

  const formatCurrency = (amount: number, currency = "DOP") => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "COMPLETADO":
        return <Badge className="bg-green-100 text-green-800">Completado</Badge>
      case "PENDIENTE":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>
      case "CANCELADO":
        return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{estado}</Badge>
    }
  }

  const getMetodoPagoBadge = (metodo: string) => {
    switch (metodo) {
      case "EFECTIVO":
        return (
          <Badge variant="outline" className="border-green-200 text-green-700">
            Efectivo
          </Badge>
        )
      case "TRANSFERENCIA":
        return (
          <Badge variant="outline" className="border-blue-200 text-blue-700">
            Transferencia
          </Badge>
        )
      case "TARJETA":
        return (
          <Badge variant="outline" className="border-purple-200 text-purple-700">
            Tarjeta
          </Badge>
        )
      case "CHEQUE":
        return (
          <Badge variant="outline" className="border-orange-200 text-orange-700">
            Cheque
          </Badge>
        )
      default:
        return <Badge variant="outline">{metodo}</Badge>
    }
  }

  const clienteNombre = cliente?.tipo_cliente === "EMPRESA" ? cliente?.razon_social : cliente?.nombre_completo

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/reservas/pendientes")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Reservas
            </Button>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Detalles del Pago</h1>
                <p className="text-sm text-gray-500">Información completa del pago</p>
              </div>
            </div>
          </div>
          <Link href={`/pagos/editar?id=${pago.id}`}>
            <Button className="bg-green-600 hover:bg-green-700">
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Información Principal del Pago */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Datos del Pago */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <CardTitle className="text-green-600">Información del Pago</CardTitle>
                  </div>
                  <div className="flex space-x-2">
                    {getEstadoBadge(pago.estado)}
                    {getMetodoPagoBadge(pago.metodo_pago)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">ID del Pago</Label>
                    <p className="text-lg font-mono">{pago.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Monto</Label>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(pago.monto, reserva?.moneda)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Método de Pago</Label>
                    <p className="text-lg">{pago.metodo_pago}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Referencia</Label>
                    <p className="text-lg font-mono">{pago.referencia}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Información de la Reserva */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-blue-600">
                  <Receipt className="w-5 h-5" />
                  <span>Reserva Asociada</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Número de Reserva</Label>
                    <p className="text-lg font-semibold">{reserva?.numero_reserva}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Total de la Reserva</Label>
                    <p className="text-lg font-semibold">{formatCurrency(reserva?.total || 0, reserva?.moneda)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Producto/Servicio</Label>
                    <p className="text-lg">{producto?.nombre}</p>
                    {producto?.descripcion && <p className="text-sm text-gray-600">{producto?.descripcion}</p>}
                  </div>
                </div>
                <div className="pt-2">
                  <Link href={`/reservas/ver/${pago.reserva_id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                    >
                      Ver Reserva Completa
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Información del Cliente */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-600">
                {cliente?.tipo_cliente === "EMPRESA" ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                <span>Cliente</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Nombre</Label>
                  <p className="text-lg font-semibold">{clienteNombre}</p>
                  <Badge variant={cliente?.tipo_cliente === "EMPRESA" ? "default" : "secondary"} className="mt-1">
                    {cliente?.tipo_cliente}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Email</Label>
                  <p className="text-lg">{cliente?.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Teléfono</Label>
                  <p className="text-lg">{cliente?.telefonos}</p>
                </div>
              </div>
              <div className="pt-4">
                <Link href={`/clientes/ver?id=${pago.cliente_id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-200 text-green-600 hover:bg-green-50 bg-transparent"
                  >
                    Ver Cliente Completo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Información Adicional */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notas y Observaciones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-blue-600">
                  <FileText className="w-5 h-5" />
                  <span>Notas y Observaciones</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pago.notas ? (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Notas del Pago</Label>
                    <p className="text-lg mt-2 p-3 bg-gray-50 rounded-lg">{pago.notas}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No hay notas registradas para este pago</p>
                )}
              </CardContent>
            </Card>

            {/* Información del Sistema */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-green-600">
                  <Calendar className="w-5 h-5" />
                  <span>Información del Sistema</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Registrado Por</Label>
                  <p className="text-lg">{pago.usuario}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Fecha de Creación</Label>
                  <p className="text-lg">{formatDateTime(pago.creado_en)}</p>
                </div>
                {pago.editado_en && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Última Modificación</Label>
                    <p className="text-lg">{formatDateTime(pago.editado_en)}</p>
                  </div>
                )}
                {pago.editado_por && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Editado Por</Label>
                    <p className="text-lg">{pago.editado_por}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={className} {...props}>
      {children}
    </label>
  )
}
