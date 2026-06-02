"use client"

import type React from "react"
import { toast } from "@/components/ui/use-toast"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Save, ArrowLeft, DollarSign, CalendarIcon, Building } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"

export default function PagosProyectosPage() {
  const [date, setDate] = useState<Date>(new Date())
  const [formData, setFormData] = useState({
    proyecto: "",
    cliente: "",
    tipoPago: "",
    monto: "",
    metodoPago: "",
    referencia: "",
    banco: "",
    concepto: "",
    notas: "",
  })

  const proyectos = [
    {
      id: "PROY-001",
      nombre: "Proyecto Residencial Norte",
      cliente: "Constructora del Norte",
      saldoPendiente: 105000.0,
    },
    {
      id: "PROY-002",
      nombre: "Complejo Comercial Centro",
      cliente: "Inversiones ABC",
      saldoPendiente: 240000.0,
    },
    {
      id: "PROY-003",
      nombre: "Torre de Oficinas Este",
      cliente: "Grupo Inmobiliario XYZ",
      saldoPendiente: 20000.0,
    },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const pagoData = {
      ...formData,
      fecha: format(date, "yyyy-MM-dd"),
      id: `PAG-PROY-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    }
    toast({
      title: "Pago registrado",
      description: `Pago ${pagoData.id} procesado correctamente`,
    })
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleProyectoChange = (proyectoId: string) => {
    const proyecto = proyectos.find((p) => p.id === proyectoId)
    if (proyecto) {
      setFormData((prev) => ({
        ...prev,
        proyecto: proyectoId,
        cliente: proyecto.cliente,
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <Link href="/proyectos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Proyectos
            </Button>
          </Link>
          <div className="flex items-center space-x-2">
            <DollarSign className="w-6 h-6" style={{ color: "#006600" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#006600" }}>
                Registrar Pago de Proyecto
              </h1>
              <p className="text-sm text-gray-500">Procesar pago asociado a proyecto inmobiliario</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información del Proyecto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center" style={{ color: "#3399cc" }}>
                  <Building className="w-5 h-5 mr-2" />
                  Información del Proyecto
                </CardTitle>
                <CardDescription>Seleccionar proyecto y tipo de pago</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="proyecto">Proyecto Inmobiliario *</Label>
                  <Select value={formData.proyecto} onValueChange={handleProyectoChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {proyectos.map((proyecto) => (
                        <SelectItem key={proyecto.id} value={proyecto.id}>
                          {proyecto.nombre} - Saldo: ${proyecto.saldoPendiente.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cliente">Cliente</Label>
                  <Input
                    id="cliente"
                    value={formData.cliente}
                    readOnly
                    className="bg-gray-100"
                    placeholder="Se asigna automáticamente"
                  />
                </div>

                <div>
                  <Label htmlFor="tipoPago">Tipo de Pago *</Label>
                  <Select value={formData.tipoPago} onValueChange={(value) => handleInputChange("tipoPago", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inicial">Pago Inicial</SelectItem>
                      <SelectItem value="progreso">Pago por Progreso</SelectItem>
                      <SelectItem value="hito">Pago por Hito</SelectItem>
                      <SelectItem value="final">Pago Final</SelectItem>
                      <SelectItem value="extraordinario">Pago Extraordinario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="concepto">Concepto del Pago *</Label>
                  <Input
                    id="concepto"
                    value={formData.concepto}
                    onChange={(e) => handleInputChange("concepto", e.target.value)}
                    placeholder="Descripción del concepto"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="monto">Monto del Pago *</Label>
                  <Input
                    id="monto"
                    type="number"
                    step="0.01"
                    value={formData.monto}
                    onChange={(e) => handleInputChange("monto", e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Información del Pago */}
            <Card>
              <CardHeader>
                <CardTitle>Detalles del Pago</CardTitle>
                <CardDescription>Método de pago y referencias</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Fecha del Pago *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(date, "PPP", { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(newDate) => newDate && setDate(newDate)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="metodoPago">Método de Pago *</Label>
                  <Select value={formData.metodoPago} onValueChange={(value) => handleInputChange("metodoPago", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta de Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.metodoPago === "transferencia" || formData.metodoPago === "cheque") && (
                  <>
                    <div>
                      <Label htmlFor="banco">Banco</Label>
                      <Select value={formData.banco} onValueChange={(value) => handleInputChange("banco", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar banco" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="popular">Banco Popular</SelectItem>
                          <SelectItem value="bhd">BHD León</SelectItem>
                          <SelectItem value="banreservas">Banreservas</SelectItem>
                          <SelectItem value="scotiabank">Scotiabank</SelectItem>
                          <SelectItem value="otros">Otros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="referencia">Número de Referencia</Label>
                      <Input
                        id="referencia"
                        value={formData.referencia}
                        onChange={(e) => handleInputChange("referencia", e.target.value)}
                        placeholder="Número de transferencia o cheque"
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="notas">Notas Adicionales</Label>
                  <Textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => handleInputChange("notas", e.target.value)}
                    placeholder="Observaciones sobre el pago del proyecto"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumen del Pago */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Resumen del Pago de Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Proyecto</p>
                  <p className="font-medium">
                    {formData.proyecto ? proyectos.find((p) => p.id === formData.proyecto)?.nombre : "No seleccionado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="font-medium">{formData.cliente || "No asignado"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tipo de Pago</p>
                  <p className="font-medium">{formData.tipoPago || "No seleccionado"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monto</p>
                  <p className="font-medium text-lg text-green-600">${formData.monto || "0.00"}</p>
                </div>
              </div>
              {formData.proyecto && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Saldo Pendiente del Proyecto:</strong> $
                    {proyectos.find((p) => p.id === formData.proyecto)?.saldoPendiente.toLocaleString() || "0"}
                  </p>
                  {formData.monto && (
                    <p className="text-sm text-blue-800">
                      <strong>Nuevo Saldo:</strong> $
                      {(
                        (proyectos.find((p) => p.id === formData.proyecto)?.saldoPendiente || 0) -
                        Number.parseFloat(formData.monto)
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4 mt-6">
            <Link href="/proyectos">
              <Button variant="outline">Cancelar</Button>
            </Link>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              Registrar Pago de Proyecto
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
