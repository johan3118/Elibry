"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Receipt, Save, ArrowLeft, Calculator, FileText, Calendar, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

export default function RegistrarBloqueComprobantePage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    tipo_comprobante: "",
    serie: "",
    numero_inicial: "",
    numero_final: "",
    fecha_autorizacion: "",
    fecha_vencimiento: "",
    observaciones: "",
  })

  const tiposComprobante = [
    { value: "01", label: "01 - Facturas de Crédito Fiscal" },
    { value: "02", label: "02 - Factura de Consumo" },
    { value: "03", label: "03 - Nota de Débito" },
    { value: "04", label: "04 - Nota de Crédito" },
    { value: "11", label: "11 - Comprobante de Compras" },
    { value: "12", label: "12 - Comprobante de Registro Único de Ingresos" },
    { value: "13", label: "13 - Comprobante para Gastos Menores" },
    { value: "14", label: "14 - Comprobante para Regímenes Especiales" },
    { value: "15", label: "15 - Comprobante Gubernamental" },
    { value: "16", label: "16 - Comprobante para Exportaciones" },
    { value: "17", label: "17 - Comprobantes de Pagos al Exterior" },
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validaciones
      const numeroInicial = Number.parseInt(formData.numero_inicial)
      const numeroFinal = Number.parseInt(formData.numero_final)

      if (numeroInicial >= numeroFinal) {
        alert("El número final debe ser mayor que el número inicial")
        return
      }

      if (new Date(formData.fecha_vencimiento) <= new Date(formData.fecha_autorizacion)) {
        alert("La fecha de vencimiento debe ser posterior a la fecha de autorización")
        return
      }

      const dataToInsert = {
        ...formData,
        numero_inicial: numeroInicial,
        numero_final: numeroFinal,
        numero_actual: numeroInicial, // Empezar desde el número inicial
        estado: "ACTIVO",
        usuario_registro: "admin", // En producción, obtener del usuario autenticado
      }

      if (!supabase) {
        toast({
          title: "Error",
          description: "No se pudo conectar con la base de datos.",
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase.from("comprobantes_disponibles").insert([dataToInsert] as never[])

      if (error) {
        console.error("Error registrando bloque de comprobantes:", error)
        toast({
          title: "Error",
          description: `No se pudo registrar el bloque de comprobantes: ${error.message}`,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Éxito",
        description: "Bloque de comprobantes registrado exitosamente",
      })
      router.push("/facturacion/comprobantes")
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Error inesperado al registrar el bloque de comprobantes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const totalComprobantes =
    formData.numero_inicial && formData.numero_final
      ? Number.parseInt(formData.numero_final) - Number.parseInt(formData.numero_inicial) + 1
      : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/facturacion/comprobantes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Comprobantes
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Receipt className="w-6 h-6" style={{ color: "#3399cc" }} />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                  Registrar Bloque de Comprobantes
                </h1>
                <p className="text-sm text-gray-500">Agregar nuevo bloque de NCF autorizado por DGII</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
          {/* Información del Bloque */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Información del Bloque de Comprobantes
              </CardTitle>
              <CardDescription>Datos del bloque de NCF autorizado por la DGII</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo_comprobante">Tipo de Comprobante *</Label>
                <Select
                  value={formData.tipo_comprobante}
                  onValueChange={(value) => handleInputChange("tipo_comprobante", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposComprobante.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="serie">Serie del Comprobante *</Label>
                <Input
                  id="serie"
                  value={formData.serie}
                  onChange={(e) => handleInputChange("serie", e.target.value.toUpperCase())}
                  placeholder="B010"
                  maxLength={4}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Ejemplo: B010, B020, B030, etc.</p>
              </div>

              <div>
                <Label htmlFor="numero_inicial">Número Inicial *</Label>
                <Input
                  id="numero_inicial"
                  type="number"
                  value={formData.numero_inicial}
                  onChange={(e) => handleInputChange("numero_inicial", e.target.value)}
                  placeholder="1000001"
                  min="1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="numero_final">Número Final *</Label>
                <Input
                  id="numero_final"
                  type="number"
                  value={formData.numero_final}
                  onChange={(e) => handleInputChange("numero_final", e.target.value)}
                  placeholder="1000500"
                  min="1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="fecha_autorizacion">Fecha de Autorización *</Label>
                <Input
                  id="fecha_autorizacion"
                  type="date"
                  value={formData.fecha_autorizacion}
                  onChange={(e) => handleInputChange("fecha_autorizacion", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento *</Label>
                <Input
                  id="fecha_vencimiento"
                  type="date"
                  value={formData.fecha_vencimiento}
                  onChange={(e) => handleInputChange("fecha_vencimiento", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Resumen del Bloque */}
          {totalComprobantes > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="w-5 h-5 mr-2" />
                  Resumen del Bloque
                </CardTitle>
                <CardDescription>Información calculada automáticamente</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600">Total de Comprobantes</p>
                        <p className="text-2xl font-bold text-blue-800">{totalComprobantes.toLocaleString()}</p>
                      </div>
                      <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600">Primer NCF</p>
                        <p className="text-lg font-mono font-bold text-green-800">
                          {formData.serie}
                          {formData.numero_inicial ? formData.numero_inicial.padStart(8, "0") : "00000000"}
                        </p>
                      </div>
                      <Receipt className="w-8 h-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-orange-600">Último NCF</p>
                        <p className="text-lg font-mono font-bold text-orange-800">
                          {formData.serie}
                          {formData.numero_final ? formData.numero_final.padStart(8, "0") : "00000000"}
                        </p>
                      </div>
                      <Calendar className="w-8 h-8 text-orange-600" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle>Observaciones</CardTitle>
              <CardDescription>Información adicional sobre el bloque de comprobantes</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => handleInputChange("observaciones", e.target.value)}
                  placeholder="Información adicional sobre este bloque de comprobantes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Advertencia */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Importante</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Asegúrate de que los datos coincidan exactamente con la autorización de DGII. Una vez registrado, el
                    bloque comenzará a utilizarse secuencialmente desde el número inicial.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4">
            <Link href="/facturacion/comprobantes">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={
                loading ||
                !formData.tipo_comprobante ||
                !formData.serie ||
                !formData.numero_inicial ||
                !formData.numero_final
              }
              style={{ backgroundColor: "#3399cc" }}
              className="hover:opacity-90 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Registrando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Registrar Bloque
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
