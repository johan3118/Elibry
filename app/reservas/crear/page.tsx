"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Save,
  CalendarIcon,
  User,
  MapPin,
  FileText,
  DollarSign,
  Search,
  Plus,
  Trash2,
  Calculator,
  ArrowLeft,
  AlertCircle,
  CreditCard,
  Users,
  Check,
  ChevronsUpDown,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { createClient, uploadImage, type Cliente, type Producto, type Suplidor } from "@/lib/supabase"
import { sanitizeHabitaciones } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { crearReservaProvisional } from "@/lib/provisional-system"
import { useUser } from "@/lib/user-context"
import { crearPagoProvisional } from "@/lib/provisional-system"
import { TimeFormatToggle, formatTimeWithPreference } from "@/components/time-format-toggle"

interface DetalleServicio {
  concepto: string
  descripcion: string
  precio_unitario: number
  descuento: number
  subtotal: number
  total: number
  noches: number
  pasajeros: number
  habitaciones: number | string
}

interface Colaborador {
  id: number
  nombre: string
  tipo: string
  comision: number
  email?: string
  telefono?: string
  status: string
}

export default function CrearReservaPage() {
  const [fechaEntrada, setFechaEntrada] = useState<Date>()
  const [fechaSalida, setFechaSalida] = useState<Date>()
  const [fechaLimitePago, setFechaLimitePago] = useState<Date>()
  const [fechaGastosProveedor, setFechaGastosProveedor] = useState<Date>()
  const [showFechaSalidaPicker, setShowFechaSalidaPicker] = useState(false)
  const [productosOpen, setProductosOpen] = useState(false)
  const [proveedorOpen, setProveedorOpen] = useState(false)
  const [searchCliente, setSearchCliente] = useState("")
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [suplidores, setSuplidores] = useState<Suplidor[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null)
  const [is24HourFormat, setIs24HourFormat] = useState(true)

  const [detallesServicios, setDetallesServicios] = useState<DetalleServicio[]>([
    {
      concepto: "Servicio Principal",
      descripcion: "",
      precio_unitario: 0,
      descuento: 0,
      subtotal: 0,
      total: 0,
      noches: 1,
      pasajeros: 1,
      habitaciones: "N/A",
    },
  ])

  // Archivos
  const [facturaClienteFile, setFacturaClienteFile] = useState<File | null>(null)
  const [facturaProveedorFile, setFacturaProveedorFile] = useState<File | null>(null)
  const [archivosAdicionales, setArchivosAdicionales] = useState<File[]>([])

  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()
  const { user, isAdmin } = useUser()

  const [formData, setFormData] = useState({
    referidoPor: "",
    cedulaCliente: "",
    idLugar: "",
    horaEntrada: "15:00",
    horaSalida: "12:00",
    pasajeros: "",
    habitaciones: "",
    atendidoPor: user?.nombre || "Usuario Sistema",
    metodoPago: "",
    abonadoContabilidad: "",
    proveedor: "",
    proforma: "A LA ESPERA CONF",
    comision: "NO",
    facturaEnviadaCliente: "NO",
    facturaRecibidaProveedor: "NO",
    notaInternaReserva: "",
    asientosBus: "",
    grupo: "NO",
    moneda: "DOP",
    status: "PENDIENTE",
    // Payment fields
    pagoInicial: "",
    referenciaPago: "",
    conceptoPago: "Pago inicial de reserva",
  })

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setDataLoading(true)

        // Cargar clientes
        const { data: clientesData, error: clientesError } = await supabase
          .from("clientes")
          .select("*")
          .eq("status", "ACTIVO")
          .order("fecha_creado", { ascending: false })

        if (!clientesError) {
          setClientes(clientesData || [])
        }

        // Cargar productos
        const { data: productosData, error: productosError } = await supabase
          .from("productos")
          .select("*")
          .eq("status", "ACTIVO")
          .order("nombre_producto", { ascending: true })

        if (!productosError) {
          setProductos(productosData || [])
        }

        // Cargar suplidores
        const { data: suplidoresData, error: suplidoresError } = await supabase
          .from("suplidores")
          .select("*")
          .eq("status", "ACTIVO")
          .order("razon_social", { ascending: true })

        if (!suplidoresError) {
          setSuplidores(suplidoresData || [])
        }

        const { data: colaboradoresData, error: colaboradoresError } = await supabase
          .from("colaboradores")
          .select("*")
          .eq("status", "ACTIVO")
          .order("nombre", { ascending: true })

        if (colaboradoresError) {
          // Usar datos de ejemplo si la tabla no existe
          setColaboradores([
            { id: 1, nombre: "María González", tipo: "VENDEDOR", comision: 5, status: "ACTIVO" },
            { id: 2, nombre: "Carlos Rodríguez", tipo: "AGENTE", comision: 3, status: "ACTIVO" },
            { id: 3, nombre: "Laura Fernández", tipo: "REFERIDOR", comision: 2, status: "ACTIVO" },
          ])
        } else {
          setColaboradores(colaboradoresData || [])
        }
      } catch (error) {
        console.error("Error cargando datos:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos necesarios.",
          variant: "destructive",
        })
      } finally {
        setDataLoading(false)
      }
    }

    loadData()
  }, [supabase, toast])

  // Calcular noches automáticamente
  useEffect(() => {
    if (fechaEntrada && fechaSalida) {
      const noches = Math.ceil((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
      setDetallesServicios((prev) =>
        prev.map((detalle) => ({
          ...detalle,
          noches: Math.max(1, noches),
        })),
      )
    }
  }, [fechaEntrada, fechaSalida])

  const calcularTotalesDetalle = (detalle: DetalleServicio): DetalleServicio => {
    // El subtotal es directamente el precio unitario ingresado (sin multiplicar por noches)
    const subtotal = detalle.precio_unitario
    const total = subtotal - detalle.descuento

    return {
      ...detalle,
      subtotal: Math.max(0, subtotal),
      total: Math.max(0, total),
    }
  }

  const actualizarDetalle = (index: number, campo: keyof DetalleServicio, valor: any) => {
    setDetallesServicios((prev) => {
      const nuevosDetalles = [...prev]
      nuevosDetalles[index] = { ...nuevosDetalles[index], [campo]: valor }
      nuevosDetalles[index] = calcularTotalesDetalle(nuevosDetalles[index])
      return nuevosDetalles
    })
  }

  const agregarDetalle = () => {
    const nuevoDetalle: DetalleServicio = {
      concepto: "",
      descripcion: "",
      precio_unitario: 0,
      descuento: 0,
      subtotal: 0,
      total: 0,
      noches:
        fechaEntrada && fechaSalida
          ? Math.ceil((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24))
          : 1,
      pasajeros: 1,
      habitaciones: "N/A",
    }
    setDetallesServicios((prev) => [...prev, nuevoDetalle])
  }

  const eliminarDetalle = (index: number) => {
    if (detallesServicios.length > 1) {
      setDetallesServicios((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const calcularTotalesGenerales = () => {
    const subtotal = detallesServicios.reduce((sum, detalle) => sum + detalle.subtotal, 0)
    const descuentoTotal = detallesServicios.reduce((sum, detalle) => sum + detalle.descuento, 0)
    const total = detallesServicios.reduce((sum, detalle) => sum + detalle.total, 0)
    const pasajerosTotal = detallesServicios.reduce((sum, detalle) => sum + detalle.pasajeros, 0)
    const habitacionesTotal = detallesServicios.reduce((sum, detalle) => {
      return sum + (typeof detalle.habitaciones === "number" ? detalle.habitaciones : 0)
    }, 0)

    return {
      subtotal,
      descuentoTotal,
      total,
      pasajerosTotal,
      habitacionesTotal,
    }
  }

  const filteredClientes = clientes.filter(
    (cliente) =>
      (cliente.identificacion && cliente.identificacion.toLowerCase().includes(searchCliente.toLowerCase())) ||
      (cliente.nombre_completo && cliente.nombre_completo.toLowerCase().includes(searchCliente.toLowerCase())) ||
      (cliente.razon_social && cliente.razon_social.toLowerCase().includes(searchCliente.toLowerCase())) ||
      (cliente.rnc && cliente.rnc.toLowerCase().includes(searchCliente.toLowerCase())),
  )

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Error",
          description: "Solo se permiten archivos PDF, JPG o PNG",
          variant: "destructive",
        })
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "El archivo no debe superar los 5MB",
          variant: "destructive",
        })
        return
      }

      setFile(file)
    }
  }

  const removeFile = (setFile: React.Dispatch<React.SetStateAction<File | null>>) => {
    setFile(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

  try {
    if (!selectedClienteId || selectedClienteId === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar un cliente",
        variant: "destructive",
      })
      return
    }

      if (!formData.idLugar) {
        toast({
          title: "Error",
          description: "Debe seleccionar un producto",
          variant: "destructive",
        })
        return
      }

      if (!fechaEntrada || !fechaSalida) {
        toast({
          title: "Error",
          description: "Debe seleccionar fechas de entrada y salida",
          variant: "destructive",
        })
        return
      }

      if (!formData.horaEntrada) {
        toast({
          title: "Error",
          description: "Debe ingresar la hora de entrada",
          variant: "destructive",
        })
        return
      }

      if (!formData.horaSalida) {
        toast({
          title: "Error",
          description: "Debe ingresar la hora de salida",
          variant: "destructive",
        })
        return
      }

      const detallesValidos = detallesServicios.filter(
        (detalle) => detalle.concepto.trim() && detalle.precio_unitario > 0,
      )

      if (detallesValidos.length === 0) {
        toast({
          title: "Error",
          description: "Debe agregar al menos un servicio con concepto y precio válidos",
          variant: "destructive",
        })
        return
      }

      const proveedorSeleccionado = suplidores.find((s) => s.id.toString() === formData.proveedor)
      const nombreProveedor = proveedorSeleccionado ? proveedorSeleccionado.razon_social : formData.proveedor

      const totales = calcularTotalesGenerales()
      const pagoInicialMonto = formData.pagoInicial ? Number.parseFloat(formData.pagoInicial) : 0

      // Subir archivos adjuntos (factura cliente, factura proveedor, adicionales)
      // Un archivo individual que falle no debe abortar la creación de la reserva
      let facturaClienteUrl: string | null = null
      let facturaProveedorUrl: string | null = null
      const documentosUrls: string[] = []

      if (facturaClienteFile) {
        try {
          facturaClienteUrl = await uploadImage(facturaClienteFile, "reservas-documentos", facturaClienteFile.name)
        } catch (error) {
          console.error("Error subiendo factura cliente:", error)
          toast({
            title: "Advertencia",
            description: "No se pudo subir la factura del cliente. La reserva continuará sin ese adjunto.",
            variant: "destructive",
          })
        }
      }

      if (facturaProveedorFile) {
        try {
          facturaProveedorUrl = await uploadImage(facturaProveedorFile, "reservas-documentos", facturaProveedorFile.name)
        } catch (error) {
          console.error("Error subiendo factura proveedor:", error)
          toast({
            title: "Advertencia",
            description: "No se pudo subir la factura del proveedor. La reserva continuará sin ese adjunto.",
            variant: "destructive",
          })
        }
      }

      if (archivosAdicionales.length > 0) {
        for (const file of archivosAdicionales) {
          try {
            const url = await uploadImage(file, "reservas-documentos", file.name)
            if (url) documentosUrls.push(url)
          } catch (error) {
            console.error("Error subiendo archivo adicional:", error)
            toast({
              title: "Advertencia",
              description: `No se pudo subir el archivo "${file.name}". La reserva continuará sin ese adjunto.`,
              variant: "destructive",
            })
          }
        }
      }

      // balance_reserva = precio_total (fijo, no cambia)
      // balance_abonado = suma de pagos realizados
      // balance_general = balance_reserva - balance_abonado (saldo restante)
      const reservaData = {
        codigo: `RES-${Date.now()}`,
        cliente_id: selectedClienteId,
        cedula_cliente: formData.cedulaCliente || null,
        producto_id: Number.parseInt(formData.idLugar),
        referido_por: formData.referidoPor || null,
        atendido_por: formData.atendidoPor || "Usuario Sistema",
        fecha_entrada: fechaEntrada ? format(fechaEntrada, "yyyy-MM-dd") : null,
        fecha_salida: fechaSalida ? format(fechaSalida, "yyyy-MM-dd") : null,
        hora_entrada: formData.horaEntrada || null,
        hora_salida: formData.horaSalida || null,
        pasajeros: totales.pasajerosTotal,
        habitaciones: totales.habitacionesTotal,
        precio_unitario: detallesValidos.reduce((sum, d) => sum + d.precio_unitario, 0),
        descuento: totales.descuentoTotal,
        impuestos: 0,
        precio_total: totales.total,
        moneda: (formData.moneda || "DOP").substring(0, 10),
        metodo_pago: formData.metodoPago ? formData.metodoPago.substring(0, 50) : null,
        proforma: formData.proforma ? formData.proforma.substring(0, 100) : null,
        status: formData.status.substring(0, 50),
        comision: formData.comision.substring(0, 2),
        factura_enviada_cliente: formData.facturaEnviadaCliente.substring(0, 2),
        factura_recibida_proveedor: formData.facturaRecibidaProveedor.substring(0, 2),
        grupo: formData.grupo.substring(0, 2),
        fecha_limite_pago: fechaLimitePago ? format(fechaLimitePago, "yyyy-MM-dd") : null,
        fecha_gastos_proveedor: fechaGastosProveedor ? format(fechaGastosProveedor, "yyyy-MM-dd") : null,
        abonado_contabilidad: formData.abonadoContabilidad ? Number.parseFloat(formData.abonadoContabilidad) : 0,
        proveedor: nombreProveedor ? nombreProveedor.substring(0, 200) : null,
        asientos_bus: formData.asientosBus ? formData.asientosBus.substring(0, 10) : null,
        nota_interna_reserva: formData.notaInternaReserva || null,
        factura_cliente_url: facturaClienteUrl || null,
        factura_proveedor_url: facturaProveedorUrl || null,
        documentos_urls: documentosUrls.length > 0 ? documentosUrls : null,
        // Balances corregidos
        balance_reserva: totales.total, // Precio total original (fijo)
        balance_abonado: pagoInicialMonto, // Total pagado
        balance_general: totales.total - pagoInicialMonto, // Saldo restante
        registrado_por: user?.nombre || "Usuario Sistema",
        fecha_creado: new Date().toISOString(),
        fecha_editado: new Date().toISOString(),
      }

      if (isAdmin) {
        // Si es admin, crear la reserva directamente
        const { data: reservaCreada, error: reservaError } = await supabase
          .from("reservas")
          .insert([
            {
              ...reservaData,
              estado_registro: "PERMANENTE",
            },
          ])
          .select()
          .single()

        if (reservaError) {
          throw reservaError
        }

        // Insertar detalles
        const detallesParaInsertar = detallesValidos.map((detalle) => ({
          reserva_id: reservaCreada.id,
          concepto: detalle.concepto.substring(0, 200),
          descripcion: detalle.descripcion || null,
          cantidad: 1,
          precio_unitario: detalle.precio_unitario,
          descuento: detalle.descuento,
          subtotal: detalle.subtotal,
          impuestos: 0,
          total: detalle.total,
          noches: detalle.noches,
          pasajeros: detalle.pasajeros,
          habitaciones: sanitizeHabitaciones(detalle.habitaciones),
          registrado_por: user?.nombre || "Usuario Sistema",
          editado_por: user?.nombre || "Usuario Sistema",
          estado_registro: "PERMANENTE",
        }))

        const { error: detallesError } = await supabase.from("reserva_detalles").insert(detallesParaInsertar)
        if (detallesError) {
          toast({
            title: "Advertencia",
            description: `Reserva creada, pero los detalles del servicio no se guardaron: ${detallesError.message || detallesError.details || "error desconocido"}. Edite la reserva para reingresarlos.`,
            variant: "destructive",
          })
        }

        // Si hay un pago inicial, registrarlo
        if (pagoInicialMonto > 0) {
          const pagoData = {
            reserva_id: reservaCreada.id,
            cliente_id: selectedClienteId,
            monto: pagoInicialMonto,
            metodo_pago: formData.metodoPago,
            referencia: formData.referenciaPago || null,
            fecha_pago: new Date().toISOString().split("T")[0],
            concepto: formData.conceptoPago,
            notas: "Pago inicial registrado al crear la reserva",
            estado: "CONFIRMADO",
            usuario: user?.nombre || "Usuario Sistema",
            creado_en: new Date().toISOString(),
            estado_registro: "PERMANENTE",
          }

          const { error: pagoError } = await supabase.from("pagos").insert([pagoData])
          // removed console.error and console.log for pago
        }

        toast({
          title: "Éxito",
          description: `Reserva ${reservaCreada.codigo} creada exitosamente`,
        })

        setTimeout(() => {
          router.push("/reservas/pendientes")
        }, 2000)
      } else {
        // Si es usuario normal, crear como provisional
        const result = await crearReservaProvisional(reservaData, user?.nombre || "Usuario Sistema")

        if (result.success) {
          // Si hay un pago inicial, registrarlo como provisional también
          if (pagoInicialMonto > 0) {
            const pagoData = {
              reserva_id: result.data.id,
              cliente_id: selectedClienteId,
              monto: pagoInicialMonto,
              metodo_pago: formData.metodoPago,
              referencia: formData.referenciaPago || null,
              fecha_pago: new Date().toISOString().split("T")[0],
              concepto: formData.conceptoPago,
              notas: "Pago inicial registrado al crear la reserva",
              estado: "PENDIENTE",
              usuario: user?.nombre || "Usuario Sistema",
              creado_en: new Date().toISOString(),
            }

            const pagoResult = await crearPagoProvisional(pagoData, user?.nombre || "Usuario Sistema")
          }

          // Insertar detalles como provisionales
          const detallesProvisionalesParaInsertar = detallesValidos.map((detalle) => ({
            reserva_id: result.data.id,
            concepto: detalle.concepto.substring(0, 200),
            descripcion: detalle.descripcion || null,
            cantidad: 1,
            precio_unitario: detalle.precio_unitario,
            descuento: detalle.descuento,
            subtotal: detalle.subtotal,
            impuestos: 0,
            total: detalle.total,
            noches: detalle.noches,
            pasajeros: detalle.pasajeros,
            habitaciones: sanitizeHabitaciones(detalle.habitaciones),
            registrado_por: user?.nombre || "Usuario Sistema",
            editado_por: user?.nombre || "Usuario Sistema",
            estado_registro: "PROVISIONAL",
          }))

          // eslint-disable-next-line
          // @ts-ignore
          const { error: detallesProvisionalesError } = await (supabase!.from("reserva_detalles").insert(detallesProvisionalesParaInsertar))
          if (detallesProvisionalesError) {
            toast({
              title: "Advertencia",
              description: `Solicitud de reserva enviada, pero los detalles del servicio no se guardaron: ${detallesProvisionalesError.message || detallesProvisionalesError.details || "error desconocido"}. Edite la reserva para reingresarlos.`,
              variant: "destructive",
            })
          }

          toast({
            title: "Éxito",
            description: "Solicitud de reserva enviada para aprobación del administrador. Será procesada en breve.",
          })
          setTimeout(() => {
            router.push("/reservas/pendientes")
          }, 2000)
        } else {
          toast({
            title: "Error",
            description: "Error al enviar la solicitud: " + result.error,
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error inesperado al crear la reserva. Por favor intente nuevamente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleClienteSearch = (value: string) => {
    setSearchCliente(value)
    setShowClienteDropdown(value.length > 0)
    if (!value) {
      setSelectedClienteId(null)
      setFormData((prev) => ({ ...prev, cedulaCliente: "" }))
    }
  }

  const selectCliente = (cliente: Cliente) => {
    const displayName = cliente.nombre_completo || cliente.razon_social || ""
    const cedula = cliente.identificacion || cliente.rnc || ""
    setSearchCliente(`${displayName} - ${cedula}`)
    setSelectedClienteId(cliente.id)
    handleInputChange("cedulaCliente", cedula)
    setShowClienteDropdown(false)
  }

  const totalesGenerales = calcularTotalesGenerales()

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900">Cargando datos...</h2>
          <p className="text-gray-500">Conectando con la base de datos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-6 h-6" style={{ color: "#3399cc" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#3399cc" }}>
                Nueva Reservación
              </h1>
              <p className="text-sm text-gray-500">Crear una nueva reserva en el sistema</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <TimeFormatToggle onChange={setIs24HourFormat} />
            <Button variant="outline" onClick={() => router.push("/reservas/pendientes")} className="flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Mensaje informativo para usuarios normales */}
        {!isAdmin && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Sistema de Registros Provisionales</p>
                  <p className="text-xs text-blue-700">
                    Puedes crear reservas inmediatamente. Los registros provisionales están pendientes de aprobación
                    administrativa.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-blue-600">
                <User className="w-5 h-5 mr-2" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <div className="relative">
                    <Input
                      id="cliente"
                      value={searchCliente}
                      onChange={(e) => handleClienteSearch(e.target.value)}
                      onFocus={() => setShowClienteDropdown(searchCliente.length > 0)}
                      placeholder="Buscar cliente..."
                      required
                      className="pr-10"
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>

                  {showClienteDropdown && filteredClientes.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredClientes.map((cliente) => (
                        <div
                          key={cliente.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => selectCliente(cliente)}
                        >
                          <div className="font-medium text-sm">{cliente.nombre_completo || cliente.razon_social}</div>
                          <div className="text-xs text-gray-500">{cliente.identificacion || cliente.rnc}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="referidoPor">
                    <Users className="w-4 h-4 inline mr-1" />
                    Referido Por
                  </Label>
                  <Select
                    value={formData.referidoPor}
                    onValueChange={(value) => handleInputChange("referidoPor", value === "SIN_REFERIDO" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar colaborador..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIN_REFERIDO">Sin referido</SelectItem>
                      {colaboradores.map((colaborador) => (
                        <SelectItem key={colaborador.id} value={colaborador.nombre}>
                          {colaborador.nombre} ({colaborador.tipo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="atendidoPor">Atendido Por *</Label>
                  <Input
                    id="atendidoPor"
                    value={formData.atendidoPor}
                    onChange={(e) => handleInputChange("atendidoPor", e.target.value)}
                    placeholder="Usuario que atiende"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalles de la Reserva */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-blue-600">
                <MapPin className="w-5 h-5 mr-2" />
                Detalles de la Reserva
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label htmlFor="idLugar">Producto/Lugar *</Label>
                  <Popover open={productosOpen} onOpenChange={setProductosOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productosOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {formData.idLugar
                            ? (() => {
                                const p = productos.find((p) => p.id.toString() === formData.idLugar)
                                return p ? `${p.nombre_producto} (${p.tipo})` : "Seleccionar producto"
                              })()
                            : "Seleccionar producto"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar producto..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron productos.</CommandEmpty>
                          <CommandGroup>
                            {productos.map((producto) => (
                              <CommandItem
                                key={producto.id}
                                value={`${producto.nombre_producto} ${producto.tipo}`}
                                onSelect={() => {
                                  handleInputChange("idLugar", producto.id.toString())
                                  setProductosOpen(false)
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    formData.idLugar === producto.id.toString() ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {producto.nombre_producto} ({producto.tipo})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label>Fecha Entrada *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaEntrada ? format(fechaEntrada, "PPP", { locale: es }) : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={fechaEntrada} fixedWeeks onSelect={(date) => {
                        setFechaEntrada(date)
                        if (date) {
                          setTimeout(() => setShowFechaSalidaPicker(true), 200)
                        }
                        if (date && fechaSalida && fechaSalida < date) {
                          setFechaSalida(undefined)
                        }
                        if (date && fechaLimitePago && fechaLimitePago > date) {
                          setFechaLimitePago(undefined)
                        }
                      }} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Fecha Salida *</Label>
                  <Popover open={showFechaSalidaPicker} onOpenChange={setShowFechaSalidaPicker}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaSalida ? format(fechaSalida, "PPP", { locale: es }) : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={fechaSalida}
                        fixedWeeks
                        onSelect={(date) => {
                          setFechaSalida(date)
                          setShowFechaSalidaPicker(false)
                        }}
                        disabled={(date) => fechaEntrada ? date < fechaEntrada : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {fechaEntrada && (
                    <p className="text-xs text-gray-500 mt-1">Debe ser igual o posterior a la fecha de entrada</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="horaEntrada">Hora Entrada *</Label>
                  <Input
                    id="horaEntrada"
                    type="time"
                    value={formData.horaEntrada}
                    onChange={(e) => handleInputChange("horaEntrada", e.target.value)}
                  />
                  {formData.horaEntrada && (
                    <p className="text-xs text-gray-500 mt-1">
                      Formato seleccionado: {formatTimeWithPreference(formData.horaEntrada, is24HourFormat)}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="horaSalida">Hora Salida *</Label>
                  <Input
                    id="horaSalida"
                    type="time"
                    value={formData.horaSalida}
                    onChange={(e) => handleInputChange("horaSalida", e.target.value)}
                  />
                  {formData.horaSalida && (
                    <p className="text-xs text-gray-500 mt-1">
                      Formato seleccionado: {formatTimeWithPreference(formData.horaSalida, is24HourFormat)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalles de Servicios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-green-600">
                <div className="flex items-center">
                  <Calculator className="w-5 h-5 mr-2" />
                  Detalles de Servicios
                </div>
                <Button type="button" onClick={agregarDetalle} size="sm" className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Servicio
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {detallesServicios.map((detalle, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-gray-700">Servicio #{index + 1}</CardTitle>
                        {detallesServicios.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => eliminarDetalle(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label>Concepto *</Label>
                          <Input
                            value={detalle.concepto}
                            onChange={(e) => actualizarDetalle(index, "concepto", e.target.value)}
                            placeholder="Ej: Habitación Doble, Habitación Triple, Niños"
                            required
                          />
                        </div>
                        <div>
                          <Label>Descripción</Label>
                          <Input
                            value={detalle.descripcion}
                            onChange={(e) => actualizarDetalle(index, "descripcion", e.target.value)}
                            placeholder="Descripción detallada del servicio"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <Label>Precio Unitario *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={detalle.precio_unitario}
                            onChange={(e) =>
                              actualizarDetalle(index, "precio_unitario", Number.parseFloat(e.target.value) || 0)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label>Descuento</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={detalle.descuento}
                            onChange={(e) =>
                              actualizarDetalle(index, "descuento", Number.parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div>
                          <Label>Pasajeros</Label>
                          <Input
                            type="number"
                            min="1"
                            value={detalle.pasajeros}
                            onChange={(e) =>
                              actualizarDetalle(index, "pasajeros", Number.parseInt(e.target.value) || 1)
                            }
                          />
                        </div>
                        <div>
                          <Label>Habitaciones</Label>
                          <Input
                            type="number"
                            min="0"
                            value={detalle.habitaciones === "N/A" ? 0 : detalle.habitaciones}
                            onChange={(e) => {
                              const val = Number.parseInt(e.target.value) || 0
                              actualizarDetalle(index, "habitaciones", val === 0 ? "N/A" : val)
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-3 rounded-md">
                        <div>
                          <Label className="text-xs text-gray-600">Noches</Label>
                          <p className="font-medium">{detalle.noches}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Subtotal</Label>
                          <p className="font-medium">${detalle.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Descuento</Label>
                          <p className="font-medium text-red-600">-${detalle.descuento.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Total</Label>
                          <p className="font-bold text-green-600">${detalle.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Resumen de Totales */}
              <Card className="mt-6 bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-700">Resumen de Totales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="text-center">
                      <Label className="text-sm text-gray-600">Precio Unitario</Label>
                      <p className="text-xl font-bold text-gray-900">${detallesServicios.reduce((sum, d) => sum + d.precio_unitario, 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      {detallesServicios.length > 1 && (
                        <p className="text-xs text-gray-500">Suma de {detallesServicios.length} servicios</p>
                      )}
                    </div>
                    <div className="text-center">
                      <Label className="text-sm text-gray-600">Subtotal</Label>
                      <p className="text-xl font-bold text-gray-900">${totalesGenerales.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm text-gray-600">Descuento</Label>
                      <p className="text-xl font-bold text-red-600">-${totalesGenerales.descuentoTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm text-gray-600">Total Pasajeros</Label>
                      <p className="text-xl font-bold text-purple-600">{totalesGenerales.pasajerosTotal}</p>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm text-gray-600">Total Habitaciones</Label>
                      <p className="text-xl font-bold text-blue-600">
                        {totalesGenerales.habitacionesTotal > 0 ? totalesGenerales.habitacionesTotal : "N/A"}
                      </p>
                    </div>
                    <div className="text-center">
                      <Label className="text-sm text-gray-600">TOTAL GENERAL</Label>
                      <p className="text-2xl font-bold text-green-600">${totalesGenerales.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Información de Pago */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-green-600">
                <DollarSign className="w-5 h-5 mr-2" />
                Información de Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label htmlFor="moneda">Moneda</Label>
                  <Select value={formData.moneda} onValueChange={(value) => handleInputChange("moneda", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOP">DOP - Peso Dominicano</SelectItem>
                      <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="metodoPago">Método de Pago</Label>
                  <Select value={formData.metodoPago} onValueChange={(value) => handleInputChange("metodoPago", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                      <SelectItem value="TARJETA">Tarjeta de Credito/Debito</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferencia Bancaria</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="PAYPAL">PayPal</SelectItem>
                      <SelectItem value="GRATIS">Gratis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fecha Limite de Pago</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaLimitePago ? format(fechaLimitePago, "PPP", { locale: es }) : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={fechaLimitePago}
                        fixedWeeks
                        onSelect={setFechaLimitePago}
                        disabled={(date) => fechaEntrada ? date > fechaEntrada : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {fechaEntrada && (
                    <p className="text-xs text-gray-500 mt-1">No puede ser posterior a la fecha de entrada</p>
                  )}
                </div>
              </div>

              {/* Pago Inicial */}
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-700 flex items-center">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pago Inicial (Opcional)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="pagoInicial">Monto del Pago Inicial</Label>
                      <Input
                        id="pagoInicial"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.pagoInicial}
                        onChange={(e) => handleInputChange("pagoInicial", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="referenciaPago">Referencia del Pago</Label>
                      <Input
                        id="referenciaPago"
                        value={formData.referenciaPago}
                        onChange={(e) => handleInputChange("referenciaPago", e.target.value)}
                        placeholder="Número de referencia"
                      />
                    </div>
                    <div>
                      <Label htmlFor="conceptoPago">Concepto</Label>
                      <Input
                        id="conceptoPago"
                        value={formData.conceptoPago}
                        onChange={(e) => handleInputChange("conceptoPago", e.target.value)}
                        placeholder="Concepto del pago"
                      />
                    </div>
                  </div>
                  {formData.pagoInicial && Number.parseFloat(formData.pagoInicial) > 0 && (
                    <div className="mt-3 p-3 bg-white rounded-md border border-green-200">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Total de la reserva:</span>
                        <span className="font-medium">${totalesGenerales.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-green-600">
                        <span>Pago inicial:</span>
                        <span className="font-medium">-${Number.parseFloat(formData.pagoInicial).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold border-t pt-2 mt-2">
                        <span>Balance pendiente:</span>
                        <span className="text-orange-600">
                          ${(totalesGenerales.total - Number.parseFloat(formData.pagoInicial)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Información del Proveedor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-blue-600">
                <FileText className="w-5 h-5 mr-2" />
                Información Adicional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label htmlFor="proveedor">Proveedor</Label>
                  <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={proveedorOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {formData.proveedor
                            ? (() => {
                                const s = suplidores.find((s) => s.id.toString() === formData.proveedor)
                                return s ? s.razon_social : "Seleccionar proveedor"
                              })()
                            : "Seleccionar proveedor"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar proveedor..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                          <CommandGroup>
                            {suplidores.map((suplidor) => (
                              <CommandItem
                                key={suplidor.id}
                                value={suplidor.razon_social}
                                onSelect={() => {
                                  handleInputChange("proveedor", suplidor.id.toString())
                                  setProveedorOpen(false)
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    formData.proveedor === suplidor.id.toString() ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {suplidor.razon_social}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="proforma">Estado Documento</Label>
                  <Select value={formData.proforma} onValueChange={(value) => handleInputChange("proforma", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A LA ESPERA CONF">A la espera Conf</SelectItem>
                      <SelectItem value="PROFORMA">Proforma</SelectItem>
                      <SelectItem value="VOUCHER">Voucher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fecha Gastos Proveedor</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaGastosProveedor
                          ? format(fechaGastosProveedor, "PPP", { locale: es })
                          : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={fechaGastosProveedor}
                        fixedWeeks
                        onSelect={setFechaGastosProveedor}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label htmlFor="comision">Comisión</Label>
                  <Select value={formData.comision} onValueChange={(value) => handleInputChange("comision", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NO">No</SelectItem>
                      <SelectItem value="SI">Sí</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="grupo">Grupo</Label>
                  <Select value={formData.grupo} onValueChange={(value) => handleInputChange("grupo", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NO">No</SelectItem>
                      <SelectItem value="SI">Sí</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="asientosBus">Asientos Bus</Label>
                  <Input
                    id="asientosBus"
                    value={formData.asientosBus}
                    onChange={(e) => handleInputChange("asientosBus", e.target.value)}
                    placeholder="Ej: 1-4"
                  />
                </div>

                <div>
                  <Label htmlFor="abonadoContabilidad">Abonado Contabilidad</Label>
                  <Input
                    id="abonadoContabilidad"
                    type="number"
                    step="0.01"
                    value={formData.abonadoContabilidad}
                    onChange={(e) => handleInputChange("abonadoContabilidad", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Factura Cliente y Factura Proveedor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="facturaEnviadaCliente">Factura Enviada Cliente</Label>
                    <Select
                      value={formData.facturaEnviadaCliente}
                      onValueChange={(value) => handleInputChange("facturaEnviadaCliente", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SI">Sí</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.facturaEnviadaCliente === "SI" && (
                    <div>
                      <Label htmlFor="facturaClienteFile">Adjuntar Factura Cliente</Label>
                      <Input
                        id="facturaClienteFile"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(e, setFacturaClienteFile)}
                        className="mt-1"
                      />
                      {facturaClienteFile && (
                        <div className="flex items-center justify-between mt-2 p-2 bg-green-50 rounded border border-green-200">
                          <span className="text-sm text-green-700 truncate">{facturaClienteFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(setFacturaClienteFile)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="facturaRecibidaProveedor">Factura Recibida Proveedor</Label>
                    <Select
                      value={formData.facturaRecibidaProveedor}
                      onValueChange={(value) => handleInputChange("facturaRecibidaProveedor", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SI">Sí</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.facturaRecibidaProveedor === "SI" && (
                    <div>
                      <Label htmlFor="facturaProveedorFile">Adjuntar Factura Proveedor</Label>
                      <Input
                        id="facturaProveedorFile"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(e, setFacturaProveedorFile)}
                        className="mt-1"
                      />
                      {facturaProveedorFile && (
                        <div className="flex items-center justify-between mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <span className="text-sm text-blue-700 truncate">{facturaProveedorFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(setFacturaProveedorFile)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Archivos Adicionales - Siempre visible, soporta multiples archivos */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Label htmlFor="archivosAdicionales" className="font-semibold text-blue-700">Archivos Adicionales</Label>
                <p className="text-xs text-blue-600 mb-2">Puede adjuntar multiples documentos adicionales (PDF, JPG, PNG)</p>
                <Input
                  id="archivosAdicionales"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const nuevosArchivos = Array.from(e.target.files).filter((f) => {
                        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
                        return allowedTypes.includes(f.type) && f.size <= 5 * 1024 * 1024
                      })
                      setArchivosAdicionales((prev) => [...prev, ...nuevosArchivos])
                    }
                  }}
                  className="mt-1"
                />
                {archivosAdicionales.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {archivosAdicionales.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                        <span className="text-sm text-blue-700 truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setArchivosAdicionales((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-red-500 hover:text-red-700 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="notaInternaReserva">Nota Interna</Label>
                <Textarea
                  id="notaInternaReserva"
                  value={formData.notaInternaReserva}
                  onChange={(e) => handleInputChange("notaInternaReserva", e.target.value)}
                  placeholder="Notas internas sobre la reserva..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/reservas/pendientes")}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Crear Reserva
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
