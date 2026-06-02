"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { FileText, CalendarIcon, Download, ArrowLeft, AlertCircle, Calculator } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  producto_id: number
  precio_total: number
  descuento?: number
  moneda?: string
  metodo_pago?: string
  fecha_creado: string
  fecha_entrada?: string
  fecha_salida?: string
  atendido_por?: string
  nota_interna_reserva?: string
}

interface Cliente {
  id: number
  nombre_completo?: string
  razon_social?: string
  identificacion?: string
  rnc?: string
  telefonos?: string
  email?: string
  direccion?: string
  tipo_cliente?: string
}

interface Producto {
  id: number
  nombre_producto?: string
  tipo?: string
  descripcion?: string
}

interface FacturaFiscal {
  id?: number
  reserva_id: number
  cliente_id: number
  ncf: string
  tipo_comprobante: string
  fecha_emision: string
  fecha_vencimiento: string
  numero_factura: string
  subtotal: number
  itbis: number
  propina_legal: number
  total: number
  observaciones?: string
  creado_por?: string
  fecha_creado?: string
}

export default function FacturaFiscalPage() {
  const router = useRouter()
  const [date, setDate] = useState<Date>(new Date())
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [facturas, setFacturas] = useState<FacturaFiscal[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createClient()

  // Tax calculation toggles
  const [incluirITBIS, setIncluirITBIS] = useState(true)
  const [incluirPropinaLegal, setIncluirPropinaLegal] = useState(true)

  const [formData, setFormData] = useState({
    reserva_id: "",
    tipoComprobante: "B01",
    condicionPago: "contado",
    observaciones: "",
  })

  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Cargar reservas sin relaciones embebidas
        const { data: reservasData, error: reservasError } = await supabase
          .from("reservas")
          .select("*")
          .order("fecha_creado", { ascending: false })

        if (reservasError) {
          console.error("Error cargando reservas:", reservasError)
          throw reservasError
        }

        // Cargar clientes
        const { data: clientesData, error: clientesError } = await supabase
          .from("clientes")
          .select("*")
          .order("nombre_completo", { ascending: true })

        if (clientesError) {
          console.error("Error cargando clientes:", clientesError)
          throw clientesError
        }

        // Cargar productos
        const { data: productosData, error: productosError } = await supabase
          .from("productos")
          .select("*")
          .order("nombre_producto", { ascending: true })

        if (productosError) {
          console.error("Error cargando productos:", productosError)
          throw productosError
        }

        // Cargar facturas fiscales existentes (opcional)
        const { data: facturasData, error: facturasError } = await supabase
          .from("comprobantes_fiscales")
          .select("*")
          .order("fecha_creado", { ascending: false })

        // No lanzar error si la tabla no existe
        if (facturasError) {
        }

        setReservas(reservasData || [])
        setClientes(clientesData || [])
        setProductos(productosData || [])
        setFacturas(facturasData || [])
      } catch (error) {
        console.error("Error cargando datos:", error)
        toast({
          title: "Error",
          description: "Error al cargar los datos de la base de datos",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleReservaChange = (reservaId: string) => {
    const reserva = reservas.find((r) => r.id.toString() === reservaId)
    const cliente = clientes.find((c) => c.id === reserva?.cliente_id)
    const producto = productos.find((p) => p.id === reserva?.producto_id)

    setSelectedReserva(reserva || null)
    setSelectedCliente(cliente || null)
    setSelectedProducto(producto || null)

    setFormData((prev) => ({
      ...prev,
      reserva_id: reservaId,
    }))
  }

  const calcularSubtotal = () => {
    if (!selectedReserva) return 0
    const precio = selectedReserva.precio_total || 0
    const descuento = selectedReserva.descuento || 0
    return precio - descuento
  }

  const calcularITBIS = () => {
    if (!incluirITBIS) return 0
    return calcularSubtotal() * 0.18
  }

  const calcularPropinaLegal = () => {
    if (!incluirPropinaLegal) return 0
    return calcularSubtotal() * 0.1
  }

  const calcularTotal = () => {
    return calcularSubtotal() + calcularITBIS() + calcularPropinaLegal()
  }

  const generateNCF = (tipoComprobante: string): string => {
    const numeroSecuencial = String(Math.floor(Math.random() * 999999) + 100000).padStart(8, "0")
    return `${tipoComprobante}${numeroSecuencial}`
  }

  const generateNumeroFactura = (): string => {
    const existingFacturas = facturas.length
    return String(existingFacturas + 1).padStart(3, "0")
  }

  const formatClienteName = (cliente: Cliente): string => {
    if (cliente.tipo_cliente === "EMPRESA" && cliente.razon_social) {
      return cliente.razon_social.toUpperCase()
    }
    return (cliente.nombre_completo || cliente.razon_social || "").toUpperCase()
  }

  const formatClienteRNC = (cliente: Cliente): string => {
    if (cliente.rnc) {
      return cliente.rnc
    }
    if (cliente.identificacion) {
      return cliente.identificacion
    }
    return ""
  }

  const formatClienteTelefono = (cliente: Cliente): string => {
    if (cliente.telefonos) {
      const telefonos = cliente.telefonos.split(",")
      return telefonos[0].trim()
    }
    return ""
  }

  const generateFacturaFiscalHTML = (): string => {
    if (!selectedReserva || !selectedCliente || !selectedProducto) return ""

    const subtotal = calcularSubtotal()
    const itbis = calcularITBIS()
    const propinaLegal = calcularPropinaLegal()
    const total = calcularTotal()
    const fechaEmision = format(date, "dd-MMM-yyyy", { locale: es })
    const ncfGenerado = generateNCF(formData.tipoComprobante)
    const numeroFactura = generateNumeroFactura()

    // Formatear información del cliente
    const clienteNombre = formatClienteName(selectedCliente)
    const clienteRNC = formatClienteRNC(selectedCliente)
    const clienteTelefono = formatClienteTelefono(selectedCliente)
    const clienteEmail = selectedCliente.email || "0"
    const clienteDireccion = selectedCliente.direccion || "0"

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura Fiscal - ${selectedReserva.codigo}</title>
    <style>
        @page {
            margin: 20mm;
            size: A4;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: white;
        }
        
        .invoice-container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            border: 2px dotted #000;
            padding: 0;
        }
        
        .header {
            border-bottom: 2px dotted #000;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .company-logo {
            font-size: 24px;
            font-weight: bold;
            color: #3399cc;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .company-info {
            text-align: right;
            font-size: 11px;
            line-height: 1.3;
        }
        
        .company-info .rnc {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        .title {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            color: #3399cc;
            padding: 15px;
            border-bottom: 2px dotted #000;
        }
        
        .info-section {
            display: flex;
            border-bottom: 2px dotted #000;
        }
        
        .invoice-info, .client-info {
            flex: 1;
            padding: 15px;
            border-right: 1px dotted #000;
        }
        
        .client-info {
            border-right: none;
        }
        
        .section-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            text-align: center;
            border-bottom: 1px dotted #000;
            padding-bottom: 5px;
        }
        
        .info-row {
            display: flex;
            margin-bottom: 5px;
        }
        
        .info-label {
            font-weight: bold;
            min-width: 120px;
        }
        
        .info-value {
            flex: 1;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
        }
        
        .items-table th {
            background: #4CAF50;
            color: white;
            padding: 8px;
            text-align: center;
            font-weight: bold;
            font-size: 11px;
            border: 1px solid #000;
        }
        
        .items-table td {
            padding: 8px;
            text-align: center;
            border: 1px solid #000;
            font-size: 11px;
        }
        
        .items-table .concept-cell {
            text-align: left;
            font-weight: bold;
        }
        
        .footer {
            display: flex;
            padding: 20px;
        }
        
        .signature-section {
            flex: 1;
            text-align: center;
        }
        
        .signature-title {
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .signature-name {
            font-weight: bold;
            margin-bottom: 20px;
        }
        
        .company-signature {
            font-size: 18px;
            font-weight: bold;
            color: #3399cc;
        }
        
        .totals-section {
            flex: 1;
            text-align: right;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            padding: 2px 0;
            border-bottom: 1px dotted #000;
        }
        
        .total-label {
            font-weight: bold;
        }
        
        .total-value {
            font-weight: bold;
            min-width: 100px;
            text-align: right;
        }
        
        .final-total {
            font-size: 14px;
            font-weight: bold;
        }
        
        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .print-button:hover {
            background: #45a049;
        }
        
        @media print {
            .print-button {
                display: none !important;
            }
            
            .invoice-container {
                max-width: none;
                margin: 0;
                border: 2px dotted #000;
            }
        }
    </style>
</head>
<body>
    <button class="print-button" onclick="window.print()">🖨️ Imprimir Factura</button>
    
    <div class="invoice-container">
        <div class="header">
            <div class="company-logo">
                GRUPO🔋ELLIBRY
            </div>
            <div class="company-info">
                <div class="rnc">RNC: 132-73962-2</div>
                <div>Calle Juan Alejandro Ibarra # 39, Piso 3, Local 305, Ensanche La Fe, Sto. Dgo.</div>
                <div>R.D. Email: pagos@grupoellibry.com Teléfono: 809-537-4070</div>
            </div>
        </div>
        
        <div class="title">FACTURA DE CONSUMO</div>
        
        <div class="info-section">
            <div class="invoice-info">
                <div class="section-title">Información de factura</div>
                <div class="info-row">
                    <div class="info-label">NCF:</div>
                    <div class="info-value">${ncfGenerado}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">FECHA EMISIÓN:</div>
                    <div class="info-value">${fechaEmision}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">FECHA VENCIMIENTO:</div>
                    <div class="info-value">00-January-1900</div>
                </div>
                <div class="info-row">
                    <div class="info-label">ID RESERVA:</div>
                    <div class="info-value">#${selectedReserva.id}</div>
                </div>
                <div class="info-row">
                    <div class="info-label"># FACTURA:</div>
                    <div class="info-value">${numeroFactura}</div>
                </div>
            </div>
            
            <div class="client-info">
                <div class="section-title">Información de cliente</div>
                <div class="info-row">
                    <div class="info-label">NOMBRE:</div>
                    <div class="info-value">${clienteNombre}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">RNC:</div>
                    <div class="info-value">${clienteRNC}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">ID CLIENTE:</div>
                    <div class="info-value">${String(selectedCliente.id).padStart(3, "0")}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">TELÉFONO:</div>
                    <div class="info-value">${clienteTelefono}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">EMAIL:</div>
                    <div class="info-value">${clienteEmail}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">DIRECCIÓN:</div>
                    <div class="info-value">${clienteDireccion}</div>
                </div>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>CONCEPTO</th>
                    <th>PRECIO</th>
                    <th>DESC</th>
                    <th>SUBTOTAL</th>
                    <th>ITBIS<br>18%</th>
                    <th>PROPINA<br>LEGAL 10%</th>
                    <th>TOTAL</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="concept-cell">${selectedProducto.nombre_producto?.toUpperCase() || "RESERVA HOTEL"}</td>
                    <td>${(selectedReserva.precio_total || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                    <td>${(selectedReserva.descuento || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                    <td>${subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                    <td>${itbis.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                    <td>${propinaLegal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                    <td>${total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>
        
        <div class="footer">
            <div class="signature-section">
                <div class="signature-title">Preparado por:</div>
                <div class="signature-name">${(selectedReserva.atendido_por || "BRYAN MENDEZ").toUpperCase()}</div>
                <div class="company-signature">Grupo🔋Ellibry S.R.L.</div>
            </div>
            
            <div class="totals-section">
                <div class="total-row">
                    <div class="total-label">PRECIO:</div>
                    <div class="total-value">${(selectedReserva.precio_total || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="total-row">
                    <div class="total-label">DESC:</div>
                    <div class="total-value">${(selectedReserva.descuento || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="total-row">
                    <div class="total-label">SUBTOTAL:</div>
                    <div class="total-value">${subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="total-row">
                    <div class="total-label">ITBIS 18%:</div>
                    <div class="total-value">${itbis.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="total-row">
                    <div class="total-label">PROPINA LEGAL 10%:</div>
                    <div class="total-value">${propinaLegal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="total-row final-total">
                    <div class="total-label">TOTAL GENERAL:</div>
                    <div class="total-value">${total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="total-row">
                    <div class="total-label">MONEDA:</div>
                    <div class="total-value">${selectedReserva.moneda || "RD $"}</div>
                </div>
                <div class="total-row">
                    <div class="total-label">MÉTODO DE PAGO:</div>
                    <div class="total-value">${(selectedReserva.metodo_pago || "TRANSFERENCIA").toUpperCase()}</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `
  }

  const saveFacturaFiscal = async (facturaData: Omit<FacturaFiscal, "id" | "fecha_creado">) => {
    try {
      const { data, error } = await supabase.from("comprobantes_fiscales").insert([facturaData]).select().single()

      if (error) {
        console.warn("Error guardando factura fiscal (tabla puede no existir):", error)
        // No lanzar error, solo advertir
        return null
      }

      toast({
        title: "Éxito",
        description: "Factura fiscal guardada correctamente",
      })

      return data
    } catch (error) {
      console.warn("Error guardando factura fiscal:", error)
      // No mostrar error al usuario, solo advertir en consola
      return null
    }
  }

  const handleGenerateFactura = async () => {
    if (!selectedReserva || !selectedCliente) {
      toast({
        title: "Error",
        description: "Debe seleccionar una reserva",
        variant: "destructive",
      })
      return
    }

    const subtotal = calcularSubtotal()
    const itbis = calcularITBIS()
    const propinaLegal = calcularPropinaLegal()
    const total = calcularTotal()
    const ncfGenerado = generateNCF(formData.tipoComprobante)
    const numeroFactura = generateNumeroFactura()

    // Intentar guardar la factura en la base de datos (opcional)
    const facturaData: Omit<FacturaFiscal, "id" | "fecha_creado"> = {
      reserva_id: selectedReserva.id,
      cliente_id: selectedCliente.id,
      ncf: ncfGenerado,
      tipo_comprobante: formData.tipoComprobante,
      fecha_emision: format(date, "yyyy-MM-dd"),
      fecha_vencimiento: "1900-01-01", // Fecha por defecto como en el ejemplo
      numero_factura: numeroFactura,
      subtotal: subtotal,
      itbis: itbis,
      propina_legal: propinaLegal,
      total: total,
      observaciones: formData.observaciones,
      creado_por: selectedReserva.atendido_por || "BRYAN MENDEZ",
    }

    const savedFactura = await saveFacturaFiscal(facturaData)

    if (savedFactura) {
      // Actualizar la lista de facturas
      setFacturas((prev) => [savedFactura, ...prev])
    }

    // Generar y mostrar la factura
    const html = generateFacturaFiscalHTML()
    const newWindow = window.open("", "_blank", "width=900,height=700,scrollbars=yes,resizable=yes")

    if (newWindow) {
      newWindow.document.write(html)
      newWindow.document.close()
      newWindow.document.title = `Factura Fiscal - ${selectedReserva.codigo}`
      newWindow.focus()

      setTimeout(() => {
        newWindow.print()
      }, 1000)
    } else {
      alert("Por favor, permite las ventanas emergentes para generar la factura.")
    }
  }

  const handleDownloadFactura = () => {
    if (!selectedReserva) {
      toast({
        title: "Error",
        description: "Debe seleccionar una reserva",
        variant: "destructive",
      })
      return
    }

    const html = generateFacturaFiscalHTML()
    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Factura-Fiscal-${selectedReserva.codigo}-${format(date, "yyyy-MM-dd")}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos...</p>
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
              onClick={() => router.push("/facturacion")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Facturación
            </Button>
            <div className="flex items-center space-x-2">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Facturación Fiscal</h1>
                <p className="text-sm text-gray-500">Generar facturas fiscales para reservas</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Información sobre impuestos */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Configuración de Impuestos</p>
                <p className="text-xs text-blue-700">
                  Puedes activar o desactivar el cálculo de ITBIS (18%) y Propina Legal (10%) según sea necesario.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Generar Factura Fiscal</CardTitle>
                <CardDescription>Selecciona una reserva para generar su factura fiscal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selección de Reserva */}
                <div>
                  <Label htmlFor="reserva">Seleccionar Reserva *</Label>
                  <Select value={formData.reserva_id} onValueChange={handleReservaChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar reserva" />
                    </SelectTrigger>
                    <SelectContent>
                      {reservas.map((reserva) => {
                        const cliente = clientes.find((c) => c.id === reserva.cliente_id)
                        const producto = productos.find((p) => p.id === reserva.producto_id)
                        const clienteNombre = cliente?.nombre_completo || cliente?.razon_social || "Cliente sin nombre"
                        const productoNombre = producto?.nombre_producto || "Producto sin nombre"

                        return (
                          <SelectItem key={reserva.id} value={reserva.id.toString()}>
                            {reserva.codigo} - {clienteNombre} - {productoNombre}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Configuración de Impuestos */}
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-green-600">
                      <Calculator className="w-5 h-5" />
                      <span>Configuración de Impuestos</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">ITBIS (18%)</Label>
                        <p className="text-sm text-gray-600">
                          Incluir Impuesto sobre Transferencias de Bienes Industrializados y Servicios
                        </p>
                      </div>
                      <Switch checked={incluirITBIS} onCheckedChange={setIncluirITBIS} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Propina Legal (10%)</Label>
                        <p className="text-sm text-gray-600">Incluir propina legal del 10%</p>
                      </div>
                      <Switch checked={incluirPropinaLegal} onCheckedChange={setIncluirPropinaLegal} />
                    </div>
                  </CardContent>
                </Card>

                {/* Tipo de Comprobante */}
                <div>
                  <Label htmlFor="tipoComprobante">Tipo de Comprobante *</Label>
                  <Select
                    value={formData.tipoComprobante}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, tipoComprobante: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de NCF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B01">B01 - Crédito Fiscal</SelectItem>
                      <SelectItem value="B02">B02 - Consumidor Final</SelectItem>
                      <SelectItem value="B14">B14 - Régimen Especial</SelectItem>
                      <SelectItem value="B15">B15 - Gubernamental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Fecha de Emisión */}
                <div>
                  <Label>Fecha de Emisión *</Label>
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

                {/* Observaciones */}
                <div>
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    value={formData.observaciones}
                    onChange={(e) => setFormData((prev) => ({ ...prev, observaciones: e.target.value }))}
                    placeholder="Observaciones adicionales"
                    rows={3}
                  />
                </div>

                {/* Botones de Acción */}
                <div className="flex space-x-4">
                  <Button
                    onClick={handleGenerateFactura}
                    disabled={!selectedReserva}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generar e Imprimir
                  </Button>
                  <Button
                    onClick={handleDownloadFactura}
                    disabled={!selectedReserva}
                    variant="outline"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50 bg-transparent"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar HTML
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            {/* Información de la Reserva Seleccionada */}
            {selectedReserva && selectedCliente && selectedProducto && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-600">Detalles de la Reserva</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Código Reserva</Label>
                    <p className="font-medium">{selectedReserva.codigo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">ID Reserva</Label>
                    <p className="font-medium">#{selectedReserva.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Cliente</Label>
                    <p className="font-medium">{formatClienteName(selectedCliente)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">ID Cliente</Label>
                    <p className="font-medium">{String(selectedCliente.id).padStart(3, "0")}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">RNC/Cédula</Label>
                    <p className="font-medium">{formatClienteRNC(selectedCliente)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Teléfono</Label>
                    <p className="font-medium">{formatClienteTelefono(selectedCliente) || "No disponible"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Email</Label>
                    <p className="font-medium">{selectedCliente.email || "No disponible"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Producto/Servicio</Label>
                    <p className="font-medium">{selectedProducto.nombre_producto}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Precio Original</Label>
                    <p className="font-medium">${(selectedReserva.precio_total || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Descuento</Label>
                    <p className="font-medium">${(selectedReserva.descuento || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Subtotal</Label>
                    <p className="font-medium">${calcularSubtotal().toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">ITBIS (18%)</Label>
                    <div className="flex items-center space-x-2">
                      <p className={`font-medium ${incluirITBIS ? "text-orange-600" : "text-gray-400"}`}>
                        ${calcularITBIS().toFixed(2)}
                      </p>
                      <Badge variant={incluirITBIS ? "default" : "secondary"}>
                        {incluirITBIS ? "Incluido" : "Excluido"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Propina Legal (10%)</Label>
                    <div className="flex items-center space-x-2">
                      <p className={`font-medium ${incluirPropinaLegal ? "text-purple-600" : "text-gray-400"}`}>
                        ${calcularPropinaLegal().toFixed(2)}
                      </p>
                      <Badge variant={incluirPropinaLegal ? "default" : "secondary"}>
                        {incluirPropinaLegal ? "Incluido" : "Excluido"}
                      </Badge>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium text-gray-600">Total a Facturar</Label>
                    <p className="text-2xl font-bold text-green-600">${calcularTotal().toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resumen General */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-green-600">Resumen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Reservas Disponibles</p>
                    <p className="text-2xl font-bold text-blue-600">{reservas.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Facturas Generadas</p>
                    <p className="text-2xl font-bold text-green-600">{facturas.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Clientes Registrados</p>
                    <p className="text-2xl font-bold text-blue-600">{clientes.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Productos/Servicios</p>
                    <p className="text-2xl font-bold text-green-600">{productos.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
