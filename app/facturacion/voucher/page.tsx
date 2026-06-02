"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import {
  Receipt,
  ArrowLeft,
  Printer,
  Search,
  Calendar,
  MapPin,
  Users,
  Plane,
  PlusIcon,
  MinusIcon,
  X,
  Download,
} from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { generateVoucherHTML } from "@/lib/document-generator"

interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  producto_id: number
  fecha_entrada?: string
  fecha_salida?: string
  pasajeros: number
  precio_total: number
  status: string
  cliente?: {
    nombre_completo?: string
    razon_social?: string
    telefonos?: string
    email?: string
  }
  producto?: {
    nombre_producto: string
    pais?: string
  }
}

interface VoucherData {
  titular: string
  localizador: string
  fechaViaje: string
  destino: string
  hotel: string
  habitacion: string
  regimen: string
  fechaEntrada: string
  fechaSalida: string
  noches: number
  adultos: number
  ninos: number
  observaciones: string
  pasajeros: string[]
}

export default function VoucherPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [customData, setCustomData] = useState<VoucherData>({
    titular: "",
    localizador: "",
    fechaViaje: "",
    destino: "",
    hotel: "",
    habitacion: "",
    regimen: "TODO INCLUIDO",
    fechaEntrada: "",
    fechaSalida: "",
    noches: 0,
    adultos: 0,
    ninos: 0,
    observaciones: "",
    pasajeros: [""],
  })

  useEffect(() => {
    fetchReservas()
  }, [])

  const fetchReservas = async () => {
    try {
      setLoading(true)

      // First, get reservas
      const { data: reservasData, error: reservasError } = await supabase
        .from("reservas")
        .select("*")
        .order("fecha_creado", { ascending: false })

      if (reservasError) {
        console.error("Error fetching reservas:", reservasError)
        setReservas([])
        return
      }

      if (!reservasData || reservasData.length === 0) {
        setReservas([])
        return
      }

      // Get unique cliente and producto IDs
      const clienteIds = [...new Set(reservasData.map((r) => r.cliente_id).filter(Boolean))]
      const productoIds = [...new Set(reservasData.map((r) => r.producto_id).filter(Boolean))]

      // Fetch clientes
      let clientesData: any[] = []
      if (clienteIds.length > 0) {
        const { data, error } = await supabase
          .from("clientes")
          .select("id, nombre_completo, razon_social, telefonos, email")
          .in("id", clienteIds)

        if (error) {
          console.error("Error fetching clientes:", error)
        } else {
          clientesData = data || []
        }
      }

      // Fetch productos
      let productosData: any[] = []
      if (productoIds.length > 0) {
        const { data, error } = await supabase
          .from("productos")
          .select("id, nombre_producto, pais")
          .in("id", productoIds)

        if (error) {
          console.error("Error fetching productos:", error)
        } else {
          productosData = data || []
        }
      }

      // Combine data
      const reservasWithRelations = reservasData.map((reserva) => {
        const cliente = clientesData.find((c) => c.id === reserva.cliente_id)
        const producto = productosData.find((p) => p.id === reserva.producto_id)

        return {
          ...reserva,
          cliente: cliente || null,
          producto: producto || null,
        }
      })

      setReservas(reservasWithRelations)
    } catch (error) {
      console.error("Error in fetchReservas:", error)
      setReservas([])
    } finally {
      setLoading(false)
    }
  }

  const filteredReservas = reservas.filter((reserva) => {
    const clienteNombre = reserva.cliente?.nombre_completo || reserva.cliente?.razon_social || ""
    const productoNombre = reserva.producto?.nombre_producto || ""

    return (
      reserva.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      productoNombre.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const handleReservaSelect = (reserva: Reserva) => {
    setSelectedReserva(reserva)

    // Auto-llenar datos del voucher
    const clienteNombre = reserva.cliente?.nombre_completo || reserva.cliente?.razon_social || ""
    const fechaEntrada = reserva.fecha_entrada || ""
    const fechaSalida = reserva.fecha_salida || ""

    // Calcular noches
    let noches = 0
    if (fechaEntrada && fechaSalida) {
      const entrada = new Date(fechaEntrada)
      const salida = new Date(fechaSalida)
      noches = Math.ceil((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Initialize passengers array based on reservation
    const initialPassengers = [clienteNombre]
    for (let i = 1; i < (reserva.pasajeros || 1); i++) {
      initialPassengers.push("Acompañante")
    }

    setCustomData({
      titular: clienteNombre,
      localizador: generateVoucherNumber(),
      fechaViaje: fechaEntrada,
      destino: reserva.producto?.pais || "",
      hotel: reserva.producto?.nombre_producto || "",
      habitacion: "STANDARD",
      regimen: "TODO INCLUIDO",
      fechaEntrada: fechaEntrada,
      fechaSalida: fechaSalida,
      noches: Math.max(noches, 1),
      adultos: reserva.pasajeros || 1,
      ninos: 0,
      observaciones: "",
      pasajeros: initialPassengers,
    })
  }

  const generateVoucherNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const random = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0")
    return `${year}${month}${day}${random}`
  }

  const handleInputChange = (field: keyof VoucherData, value: string | number | string[]) => {
    setCustomData((prev) => ({ ...prev, [field]: value }))
  }

  const addPassenger = () => {
    setCustomData((prev) => ({
      ...prev,
      pasajeros: [...prev.pasajeros, ""],
    }))
  }

  const removePassenger = (index: number) => {
    if (customData.pasajeros.length > 1) {
      setCustomData((prev) => ({
        ...prev,
        pasajeros: prev.pasajeros.filter((_, i) => i !== index),
      }))
    }
  }

  const updatePassenger = (index: number, value: string) => {
    setCustomData((prev) => ({
      ...prev,
      pasajeros: prev.pasajeros.map((p, i) => (i === index ? value : p)),
    }))
  }

  const generateVoucher = () => {
    if (!selectedReserva) {
      alert("Por favor selecciona una reserva primero")
      return
    }

    // Prepare voucher data using the interface from document-generator
    const voucherData = {
      cliente: {
        nombre: selectedReserva.cliente?.nombre_completo || selectedReserva.cliente?.razon_social || customData.titular,
        email: selectedReserva.cliente?.email || "cliente@email.com",
        telefono: selectedReserva.cliente?.telefonos || customData.adultos.toString(),
        direccion: customData.destino || "Dirección del cliente",
      },
      reserva: {
        numero: selectedReserva.codigo,
        fecha: customData.fechaViaje,
        servicio: customData.hotel || selectedReserva.producto?.nombre_producto || "Servicio turístico",
        total: selectedReserva.precio_total,
        moneda: "USD",
      },
      empresa: {
        nombre: "GRUPO ELLIBRY SRL",
        direccion: "Calle Juan Alejandro Ibarra #39, Piso 3, Local 305, Ensanche La Fe, Santo Domingo, D.N.",
        telefono: "(809) 992-3548",
        email: "informacion@aventurasturisticasconellibry.com",
      },
      // Pass additional data for passengers and observations
      pasajeros: customData.pasajeros,
      observaciones: customData.observaciones,
    }

    // Generate the voucher HTML using the document generator
    const voucherHTML = generateVoucherHTML(voucherData)

    // Open in new window
    const newWindow = window.open("", "_blank")
    if (newWindow) {
      newWindow.document.write(voucherHTML)
      newWindow.document.close()
      newWindow.focus()
    }
  }

  const downloadVoucherAsPDF = async () => {
    if (!selectedReserva) {
      alert("Por favor selecciona una reserva primero")
      return
    }

    // Prepare voucher data
    const voucherData = {
      cliente: {
        nombre: selectedReserva.cliente?.nombre_completo || selectedReserva.cliente?.razon_social || customData.titular,
        email: selectedReserva.cliente?.email || "cliente@email.com",
        telefono: selectedReserva.cliente?.telefonos || customData.adultos.toString(),
        direccion: customData.destino || "Dirección del cliente",
      },
      reserva: {
        numero: selectedReserva.codigo,
        fecha: customData.fechaViaje,
        servicio: customData.hotel || selectedReserva.producto?.nombre_producto || "Servicio turístico",
        total: selectedReserva.precio_total,
        moneda: "USD",
      },
      empresa: {
        nombre: "GRUPO ELLIBRY SRL",
        direccion: "Calle Juan Alejandro Ibarra #39, Piso 3, Local 305, Ensanche La Fe, Santo Domingo, D.N.",
        telefono: "(809) 992-3548",
        email: "informacion@aventurasturisticasconellibry.com",
      },
      pasajeros: customData.pasajeros,
      observaciones: customData.observaciones,
    }

    // Generate the voucher HTML
    const voucherHTML = generateVoucherHTML(voucherData)

    // Create a temporary div to render the HTML
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = voucherHTML
    tempDiv.style.position = "absolute"
    tempDiv.style.left = "-9999px"
    tempDiv.style.top = "-9999px"
    tempDiv.style.width = "210mm"
    tempDiv.style.height = "297mm"
    document.body.appendChild(tempDiv)

    try {
      // Convert HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
      })

      // Create PDF
      const pdf = new jsPDF("p", "mm", "a4")
      const imgData = canvas.toDataURL("image/png")

      // Add image to PDF
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297)

      // Download the PDF
      pdf.save(`voucher-${selectedReserva.codigo}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Error al generar el PDF. Por favor intenta de nuevo.")
    } finally {
      // Clean up
      document.body.removeChild(tempDiv)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/facturacion">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Facturación
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Receipt className="w-6 h-6" style={{ color: "#3399cc" }} />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                  Voucher GEB
                </h1>
                <p className="text-sm text-gray-500">Generar vouchers de servicios para clientes</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Selección de Reserva */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Seleccionar Reserva
              </CardTitle>
              <CardDescription>Busca y selecciona la reserva para generar el voucher</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="search">Buscar Reserva</Label>
                <Input
                  id="search"
                  placeholder="Buscar por código, cliente o producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Cargando reservas...</p>
                  </div>
                ) : filteredReservas.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No se encontraron reservas</div>
                ) : (
                  filteredReservas.map((reserva) => (
                    <div
                      key={reserva.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedReserva?.id === reserva.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => handleReservaSelect(reserva)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{reserva.codigo}</p>
                          <p className="text-sm text-gray-600">
                            {reserva.cliente?.nombre_completo || reserva.cliente?.razon_social}
                          </p>
                          <p className="text-sm text-gray-500">{reserva.producto?.nombre_producto}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs">
                            {reserva.status}
                          </Badge>
                          <p className="text-sm font-medium mt-1">${reserva.precio_total.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Datos del Voucher */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Receipt className="w-5 h-5 mr-2" />
                Datos del Voucher
              </CardTitle>
              <CardDescription>Personaliza la información del voucher</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Información Básica */}
              <div>
                <Label htmlFor="titular">Titular *</Label>
                <Input
                  id="titular"
                  value={customData.titular}
                  onChange={(e) => handleInputChange("titular", e.target.value)}
                  placeholder="Nombre del titular"
                />
              </div>

              <Separator />

              {/* Información del Viaje */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fechaViaje">Fecha de Viaje</Label>
                  <Input
                    id="fechaViaje"
                    type="date"
                    value={customData.fechaViaje}
                    onChange={(e) => handleInputChange("fechaViaje", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="destino">Destino</Label>
                  <Input
                    id="destino"
                    value={customData.destino}
                    onChange={(e) => handleInputChange("destino", e.target.value)}
                    placeholder="País/Ciudad de destino"
                  />
                </div>
              </div>

              {/* Información del Hotel */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="hotel">Hotel</Label>
                  <Input
                    id="hotel"
                    value={customData.hotel}
                    onChange={(e) => handleInputChange("hotel", e.target.value)}
                    placeholder="Nombre del hotel"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="habitacion">Tipo de Habitación</Label>
                    <Select
                      value={customData.habitacion}
                      onValueChange={(value) => handleInputChange("habitacion", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="SUPERIOR">Superior</SelectItem>
                        <SelectItem value="DELUXE">Deluxe</SelectItem>
                        <SelectItem value="SUITE">Suite</SelectItem>
                        <SelectItem value="JUNIOR_SUITE">Junior Suite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="regimen">Régimen</Label>
                    <Select value={customData.regimen} onValueChange={(value) => handleInputChange("regimen", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODO INCLUIDO">Todo Incluido</SelectItem>
                        <SelectItem value="MEDIA PENSION">Media Pensión</SelectItem>
                        <SelectItem value="PENSION COMPLETA">Pensión Completa</SelectItem>
                        <SelectItem value="SOLO ALOJAMIENTO">Solo Alojamiento</SelectItem>
                        <SelectItem value="DESAYUNO">Desayuno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Fechas de Estadía */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="fechaEntrada">Check-in</Label>
                  <Input
                    id="fechaEntrada"
                    type="date"
                    value={customData.fechaEntrada}
                    onChange={(e) => handleInputChange("fechaEntrada", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="fechaSalida">Check-out</Label>
                  <Input
                    id="fechaSalida"
                    type="date"
                    value={customData.fechaSalida}
                    onChange={(e) => handleInputChange("fechaSalida", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="noches">Noches</Label>
                  <Input
                    id="noches"
                    type="number"
                    min="1"
                    value={customData.noches}
                    onChange={(e) => handleInputChange("noches", Number.parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Ocupación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adultos">Adultos</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange("adultos", Math.max(0, customData.adultos - 1))}
                    >
                      <MinusIcon className="w-4 h-4" />
                    </Button>
                    <Input
                      id="adultos"
                      type="number"
                      min="0"
                      value={customData.adultos}
                      onChange={(e) => handleInputChange("adultos", Number.parseInt(e.target.value) || 0)}
                      className="text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange("adultos", customData.adultos + 1)}
                    >
                      <PlusIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="ninos">Niños</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange("ninos", Math.max(0, customData.ninos - 1))}
                    >
                      <MinusIcon className="w-4 h-4" />
                    </Button>
                    <Input
                      id="ninos"
                      type="number"
                      min="0"
                      value={customData.ninos}
                      onChange={(e) => handleInputChange("ninos", Number.parseInt(e.target.value) || 0)}
                      className="text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange("ninos", customData.ninos + 1)}
                    >
                      <PlusIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista de Pasajeros */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Pasajeros</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPassenger}>
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {customData.pasajeros.map((pasajero, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="text-sm font-medium w-8">{index + 1})</span>
                      <Input
                        value={pasajero}
                        onChange={(e) => updatePassenger(index, e.target.value)}
                        placeholder="Nombre del pasajero"
                        className="flex-1"
                      />
                      {customData.pasajeros.length > 1 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => removePassenger(index)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={customData.observaciones}
                  onChange={(e) => handleInputChange("observaciones", e.target.value)}
                  placeholder="Notas especiales o instrucciones adicionales..."
                  rows={3}
                />
              </div>

              <Separator />

              {/* Botones de Generar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={generateVoucher}
                  disabled={!selectedReserva}
                  className="w-full"
                  style={{ backgroundColor: "#3399cc" }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Generar e Imprimir Voucher
                </Button>
                <Button
                  onClick={downloadVoucherAsPDF}
                  disabled={!selectedReserva}
                  variant="outline"
                  className="w-full bg-transparent"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar como PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Información de la Reserva Seleccionada */}
        {selectedReserva && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Reserva Seleccionada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Código</p>
                    <p className="font-medium">{selectedReserva.codigo}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Cliente</p>
                    <p className="font-medium">
                      {selectedReserva.cliente?.nombre_completo || selectedReserva.cliente?.razon_social}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Producto</p>
                    <p className="font-medium">{selectedReserva.producto?.nombre_producto}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Plane className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Pasajeros</p>
                    <p className="font-medium">{selectedReserva.pasajeros}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
