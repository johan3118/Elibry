"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, CreditCard, ArrowLeft, DollarSign } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { formatDateDMY } from "@/lib/utils"
import { useUser } from "@/lib/user-context"

interface Pago {
  id: string
  reserva_id: string
  cliente_id: string
  monto: number
  metodo_pago: string
  referencia: string
  fecha_pago: string
  concepto: string
  notas?: string
  estado: string
  usuario: string
  creado_en: string
  editado_en?: string
  editado_por?: string
}

interface FormData {
  monto: string
  metodo_pago: string
  referencia: string
  fecha_pago: string
  concepto: string
  notas: string
  estado: string
}

export default function EditarPagoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pagoId = searchParams.get("id")
  const { toast } = useToast()
  const { user } = useUser()

  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pago, setPago] = useState<Pago | null>(null)
  const [formData, setFormData] = useState<FormData>({
    monto: "",
    metodo_pago: "",
    referencia: "",
    fecha_pago: "",
    concepto: "",
    notas: "",
    estado: "ACTIVO",
  })

  useEffect(() => {
    if (pagoId) {
      cargarPago(pagoId)
    } else {
      setLoadingData(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagoId])

  const cargarPago = async (id: string) => {
    try {
      setLoadingData(true)
      const { data, error } = await supabase
        .from("pagos")
        .select("*")
        .eq("id", id)
        .single<Pago>()

      if (error) {
        console.error("Error cargando pago:", error)
        toast({ title: "Error al cargar pago", description: error.message, variant: "destructive" })
        return
      }

      setPago(data)
      setFormData({
        monto: data.monto?.toString() ?? "",
        metodo_pago: data.metodo_pago ?? "",
        referencia: data.referencia ?? "",
        fecha_pago: data.fecha_pago ? data.fecha_pago.split("T")[0] : "",
        concepto: data.concepto ?? "",
        notas: data.notas ?? "",
        estado: data.estado ?? "ACTIVO",
      })
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error al cargar pago",
        description: error instanceof Error ? error.message : "Error inesperado al cargar el pago",
        variant: "destructive",
      })
    } finally {
      setLoadingData(false)
    }
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!pagoId) return

    setSaving(true)

    try {
      const updatePayload = {
        monto: parseFloat(formData.monto),
        metodo_pago: formData.metodo_pago,
        referencia: formData.referencia || null,
        fecha_pago: formData.fecha_pago,
        concepto: formData.concepto,
        notas: formData.notas || null,
        estado: formData.estado,
        editado_en: new Date().toISOString(),
        editado_por: user?.nombre || "Usuario Sistema",
      }

      const { error } = await (supabase.from("pagos") as ReturnType<typeof supabase.from>).update(updatePayload).eq("id", pagoId)

      if (error) {
        toast({
          title: "Error al guardar",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Pago actualizado",
        description: "El pago fue actualizado exitosamente.",
      })
      router.push("/pagos")
    } catch (error) {
      toast({
        title: "Error inesperado",
        description: error instanceof Error ? error.message : "Error al procesar la solicitud",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) {
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
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => router.push("/pagos")}>
            Volver a Pagos
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/pagos")}
            className="text-gray-600 hover:text-blue-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Pagos
          </Button>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Editar Pago</h1>
              <p className="text-sm text-gray-500">Modificar información del pago</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
          {/* Read-only info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-gray-600">Información de Referencia</CardTitle>
              <CardDescription>Datos de solo lectura del pago</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-500">ID del Pago</p>
                  <p className="font-mono text-gray-800">{pago.id}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">ID de Reserva</p>
                  <p className="font-mono text-gray-800">{pago.reserva_id}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Registrado Por</p>
                  <p className="text-gray-800">{pago.usuario}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Fecha de Creacion</p>
                  <p className="text-gray-800">{formatDateDMY(pago.creado_en)}</p>
                </div>
                {pago.editado_en && (
                  <div>
                    <p className="font-medium text-gray-500">Ultima Modificacion</p>
                    <p className="text-gray-800">{formatDateDMY(pago.editado_en)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Editable fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">Datos del Pago</CardTitle>
              <CardDescription>Campos editables del pago</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="monto">Monto *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="monto"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.monto}
                      onChange={(e) => handleInputChange("monto", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="metodo_pago">Metodo de Pago *</Label>
                  <Select
                    value={formData.metodo_pago}
                    onValueChange={(value) => handleInputChange("metodo_pago", value)}
                  >
                    <SelectTrigger id="metodo_pago">
                      <SelectValue placeholder="Seleccionar metodo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferencia Bancaria</SelectItem>
                      <SelectItem value="TARJETA_CREDITO">Tarjeta de Credito</SelectItem>
                      <SelectItem value="TARJETA_DEBITO">Tarjeta de Debito</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="PAYPAL">PayPal</SelectItem>
                      <SelectItem value="GRATIS">Gratis</SelectItem>
                      <SelectItem value="OTROS">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="referencia">Referencia</Label>
                  <Input
                    id="referencia"
                    placeholder="Numero de referencia o transaccion"
                    value={formData.referencia}
                    onChange={(e) => handleInputChange("referencia", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="fecha_pago">Fecha de Pago *</Label>
                  <Input
                    id="fecha_pago"
                    type="date"
                    value={formData.fecha_pago}
                    onChange={(e) => handleInputChange("fecha_pago", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado *</Label>
                  <Select value={formData.estado} onValueChange={(value) => handleInputChange("estado", value)}>
                    <SelectTrigger id="estado">
                      <SelectValue placeholder="Estado del pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVO">Activo</SelectItem>
                      <SelectItem value="ANULADO">Anulado</SelectItem>
                      {formData.estado && !["ACTIVO", "ANULADO"].includes(formData.estado) && (
                        <SelectItem value={formData.estado}>{formData.estado}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="concepto">Concepto *</Label>
                <Input
                  id="concepto"
                  placeholder="Concepto del pago"
                  value={formData.concepto}
                  onChange={(e) => handleInputChange("concepto", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  placeholder="Notas adicionales sobre el pago"
                  value={formData.notas}
                  onChange={(e) => handleInputChange("notas", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/pagos")}
              disabled={saving}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Guardando..." : "Actualizar Pago"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
