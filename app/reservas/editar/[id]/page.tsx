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
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Clock,
  User,
  MapPin,
  FileText,
  DollarSign,
  Search,
  AlertCircle,
  Upload,
  X,
  Plus,
  Trash2,
  Calculator,
  ArrowLeft,
  Info,
  Check,
  ChevronsUpDown,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  createClient,
  type Cliente,
  type Producto,
  type Suplidor,
  type Reserva,
  type ReservaDetalle,
} from "@/lib/supabase"
import { sanitizeHabitaciones } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useParams } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { actualizarRegistroProvisional } from "@/lib/provisional-system"

interface DetalleServicio {
  id?: number
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

export default function EditarReservaPage() {
  const params = useParams()
  const reservaId = params.id as string

  const [fechaEntrada, setFechaEntrada] = useState<Date>()
  const [fechaSalida, setFechaSalida] = useState<Date>()
  const [fechaLimitePago, setFechaLimitePago] = useState<Date>()
  const [fechaGastosProveedor, setFechaGastosProveedor] = useState<Date>()
  const [showFechaSalidaPicker, setShowFechaSalidaPicker] = useState(false)
  const [productosOpen, setProductosOpen] = useState(false)
  const [searchCliente, setSearchCliente] = useState("")
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [suplidores, setSuplidores] = useState<Suplidor[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null)
  const [reservaOriginal, setReservaOriginal] = useState<Reserva | null>(null)
  const [tienePagos, setTienePagos] = useState(false)
  const [archivosAdicionales, setArchivosAdicionales] = useState<File[]>([])

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
  const [archivoExtraFile, setArchivoExtraFile] = useState<File | null>(null)

  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()
  const { user, isAdmin } = useUser()

  const [formData, setFormData] = useState({
    referidoPor: "",
    cedulaCliente: "",
    idLugar: "",
    horaEntrada: "",
    horaSalida: "",
    pasajeros: "",
    habitaciones: "",
    atendidoPor: "",
    metodoPago: "",
    abonadoContabilidad: "",
    proveedor: "",
    proforma: "",
    comision: "NO",
    facturaEnviadaCliente: "NO",
    facturaRecibidaProveedor: "NO",
    notaInternaReserva: "",
    asientosBus: "",
    grupo: "NO",
    moneda: "DOP",
    status: "PENDIENTE",
  })

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setDataLoading(true)
        // Cargar reserva específica
        const { data: reservaData, error: reservaError } = await supabase
          .from("reservas")
          .select("*")
          .eq("id", reservaId)
          .single()

        if (reservaError) {
          throw reservaError
        }

        if (!reservaData) {
          throw new Error("Reserva no encontrada")
        }

        setReservaOriginal(reservaData)

        // Check if reservation has payments (to lock moneda)
        const { data: pagosData } = await supabase
          .from("pagos")
          .select("id")
          .eq("reserva_id", reservaId)
          .limit(1)
        setTienePagos(!!pagosData && pagosData.length > 0)

        // Cargar detalles de la reserva
        const { data: detallesData, error: detallesError } = await supabase
          .from("reserva_detalles")
          .select("*")
          .eq("reserva_id", reservaId)
          .order("id", { ascending: true })

        if (!detallesError && detallesData && detallesData.length > 0) {
          const detallesFormateados = detallesData.map((detalle: ReservaDetalle) => {
            const precioUnitario = detalle.precio_unitario || 0
            const descuento = detalle.descuento || 0
            // Recalcular subtotal y total al cargar
            const subtotal = precioUnitario
            const total = subtotal - descuento
            return {
              id: detalle.id,
              concepto: detalle.concepto || "",
              descripcion: detalle.descripcion || "",
              precio_unitario: precioUnitario,
              descuento: descuento,
              subtotal: Math.max(0, subtotal),
              total: Math.max(0, total),
              noches: detalle.noches || 1,
              pasajeros: detalle.pasajeros || 1,
              habitaciones: detalle.habitaciones || 1,
            }
          })
          setDetallesServicios(detallesFormateados)
        } else {
          // Si no hay detalles guardados, crear uno con los datos de la reserva
          const precioTotal = reservaData.precio_total || 0
          const descuentoReserva = reservaData.descuento || 0
          setDetallesServicios([{
            concepto: "Servicio Principal",
            descripcion: "",
            precio_unitario: precioTotal + descuentoReserva,
            descuento: descuentoReserva,
            subtotal: precioTotal + descuentoReserva,
            total: precioTotal,
            noches: 1,
            pasajeros: reservaData.pasajeros || 1,
            habitaciones: reservaData.habitaciones || 1,
          }])
        }

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

        // Llenar formulario con datos de la reserva
        const cliente = clientesData?.find((c: Cliente) => c.id === reservaData.cliente_id)
        if (cliente) {
          const displayName = cliente.nombre_completo || cliente.razon_social || ""
          const cedula = cliente.identificacion || cliente.rnc || ""
          setSearchCliente(`${displayName} - ${cedula}`)
          setSelectedClienteId(cliente.id)
        }

        setFormData({
          referidoPor: reservaData.referido_por || "",
          cedulaCliente: reservaData.cedula_cliente || "",
          idLugar: reservaData.producto_id?.toString() || "",
          horaEntrada: reservaData.hora_entrada || "",
          horaSalida: reservaData.hora_salida || "",
          pasajeros: reservaData.pasajeros?.toString() || "",
          habitaciones: reservaData.habitaciones?.toString() || "",
          atendidoPor: reservaData.atendido_por || "",
          metodoPago: reservaData.metodo_pago || "",
          abonadoContabilidad: reservaData.abonado_contabilidad?.toString() || "",
          proveedor: reservaData.proveedor || "",
          proforma: reservaData.proforma || "",
          comision: reservaData.comision || "NO",
          facturaEnviadaCliente: reservaData.factura_enviada_cliente || "NO",
          facturaRecibidaProveedor: reservaData.factura_recibida_proveedor || "NO",
          notaInternaReserva: reservaData.nota_interna_reserva || "",
          asientosBus: reservaData.asientos_bus || "",
          grupo: reservaData.grupo || "NO",
          moneda: reservaData.moneda || "DOP",
          status: reservaData.status || "PENDIENTE",
        })

        // Establecer fechas
        if (reservaData.fecha_entrada) {
          setFechaEntrada(new Date(reservaData.fecha_entrada))
        }
        if (reservaData.fecha_salida) {
          setFechaSalida(new Date(reservaData.fecha_salida))
        }
        if (reservaData.fecha_limite_pago) {
          setFechaLimitePago(new Date(reservaData.fecha_limite_pago))
        }
        if (reservaData.fecha_gastos_proveedor) {
          setFechaGastosProveedor(new Date(reservaData.fecha_gastos_proveedor))
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudo cargar la reserva. Verifique que existe.",
          variant: "destructive",
        })
        router.push("/reservas/pendientes")
      } finally {
        setDataLoading(false)
      }
    }

    if (reservaId) {
      loadData()
    }
  }, [reservaId, supabase, toast, router])

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
      if (!selectedClienteId) {
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

      // Preparar datos de la reserva
      const reservaData = {
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
        balance_reserva: totales.total,
        balance_abonado: reservaOriginal?.balance_abonado || 0,
        balance_general: totales.total - (reservaOriginal?.balance_abonado || 0),
        editado_por: user?.nombre || "Usuario Sistema",
        fecha_editado: new Date().toISOString(),
      }

      if (isAdmin) {
        // Si es admin, actualizar directamente
        const { error: reservaError } = await supabase
          .from("reservas")
          .update({
            ...reservaData,
            estado_registro: "PERMANENTE",
          })
          .eq("id", reservaId)

        if (reservaError) {
          throw reservaError
        }

        // Eliminar detalles existentes
        const { error: deleteError } = await supabase.from("reserva_detalles").delete().eq("reserva_id", reservaId)

        if (deleteError) {
          throw new Error("No se pudieron eliminar los detalles anteriores: " + deleteError.message)
        }

        // Insertar nuevos detalles
        const detallesParaInsertar = detallesValidos.map((detalle) => ({
          reserva_id: Number.parseInt(reservaId),
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
            description: `Reserva actualizada, pero hubo un error al guardar los detalles del servicio: ${detallesError.message || detallesError.details || "error desconocido"}.`,
            variant: "destructive",
          })
        }

        toast({
          title: "Éxito",
          description: `Reserva ${reservaOriginal?.codigo} actualizada exitosamente`,
        })
      } else {
        // Si es usuario regular, usar el sistema provisional
        const resultado = await actualizarRegistroProvisional(
          "reservas",
          Number.parseInt(reservaId),
          reservaData,
          reservaOriginal,
          user?.nombre || user?.id || "",
        )

        if (resultado.success) {
          // Actualizar detalles como provisionales: borrar los anteriores e insertar los nuevos
          const { error: deleteDetallesError } = await supabase!
            .from("reserva_detalles")
            .delete()
            .eq("reserva_id", Number.parseInt(reservaId))

          if (!deleteDetallesError) {
            const detallesProvisionalesParaInsertar = detallesValidos.map((detalle) => ({
              reserva_id: Number.parseInt(reservaId),
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
            const { error: insertDetallesError } = await (supabase!.from("reserva_detalles").insert(detallesProvisionalesParaInsertar))

            if (insertDetallesError) {
              toast({
                title: "Advertencia",
                description: `Cambio provisional creado, pero los detalles del servicio no se guardaron: ${insertDetallesError.message || insertDetallesError.details || "error desconocido"}. Edite la reserva para reingresarlos.`,
                variant: "destructive",
              })
            }
          } else {
            toast({
              title: "Advertencia",
              description:
                "Cambio provisional creado, pero los detalles del servicio no se pudieron actualizar. Edite la reserva para reingresarlos.",
              variant: "destructive",
            })
          }

          toast({
            title: "Cambio provisional creado",
            description: "Los cambios en la reserva requieren aprobación de un administrador.",
          })
        } else {
          throw new Error(resultado.error)
        }
      }

      setTimeout(() => {
        router.push("/reservas/pendientes")
      }, 2000)
    } catch (error) {
      console.error("💥 Error actualizando reserva:", error)
      toast({
        title: "Error",
        description: "Error inesperado al actualizar la reserva. Por favor intente nuevamente.",
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
          <h2 className="text-lg font-semibold text-gray-900">Cargando reserva...</h2>
          <p className="text-gray-500">Conectando con la base de datos</p>
        </div>
      </div>
    )
  }

  if (!reservaOriginal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">Reserva no encontrada</h2>
          <p className="text-gray-500 mb-4">La reserva que busca no existe o fue eliminada.</p>
          <Button onClick={() => router.push("/reservas/pendientes")} className="bg-blue-600 hover:bg-blue-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Reservas Pendientes
          </Button>
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
                Editar Reservación
              </h1>
              <p className="text-sm text-gray-500">
                Modificando reserva: {reservaOriginal.codigo}
                {!isAdmin && " (Cambios provisionales)"}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push("/reservas/pendientes")} className="flex items-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>
      </header>

      <div className="p-6">
        {/* Mensaje informativo para usuarios normales */}
        {!isAdmin && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Sistema de Cambios Provisionales:</strong> Como usuario regular, los cambios que realice serán
              marcados como provisionales y requerirán aprobación de un administrador antes de ser efectivos.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
{/* Información del Cliente */}
  <Card>
  <CardHeader>
  <CardTitle className="flex items-center text-blue-600">
  <User className="w-5 h-5 mr-2" />
  Informacion del Cliente
  </CardTitle>
  </CardHeader>
  <CardContent>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <div>
  <Label htmlFor="idReserva">ID Reserva</Label>
  <Input
    id="idReserva"
    value={reservaOriginal?.codigo || `R-${reservaId}`}
    readOnly
    disabled
    className="bg-gray-100 cursor-not-allowed font-mono"
    title="El ID de reserva es generado por el sistema y no puede ser modificado"
  />
  </div>
  <div className="relative">
  <Label htmlFor="cliente">Cliente (No editable)</Label>
                <div className="relative">
                <Input
                  id="cliente"
                  value={searchCliente}
                  readOnly
                  disabled
                  className="pr-10 bg-gray-100 cursor-not-allowed"
                  title="El cliente no puede ser modificado en una reserva existente"
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
                  <Label htmlFor="referidoPor">Referido Por</Label>
                  <Input
                    id="referidoPor"
                    value={formData.referidoPor}
                    onChange={(e) => handleInputChange("referidoPor", e.target.value)}
                    placeholder="Colaborador/vendedor"
                  />
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
              <div className="grid grid-cols-1 gap-4 mb-4">
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
                  if (date) setTimeout(() => setShowFechaSalidaPicker(true), 200)
                  if (date && fechaSalida && fechaSalida < date) setFechaSalida(undefined)
                  if (date && fechaLimitePago && fechaLimitePago > date) setFechaLimitePago(undefined)
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
                  <Label htmlFor="horaEntrada">Hora Entrada</Label>
                  <Input
                    id="horaEntrada"
                    type="time"
                    value={formData.horaEntrada}
                    onChange={(e) => handleInputChange("horaEntrada", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="horaSalida">Hora Salida</Label>
                  <Input
                    id="horaSalida"
                    type="time"
                    value={formData.horaSalida}
                    onChange={(e) => handleInputChange("horaSalida", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estado de la Reserva */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-purple-600">
                <AlertCircle className="w-5 h-5 mr-2" />
                Estado de la Reserva
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Estado *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="COMPLETADA">Completada</SelectItem>
                  </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Código de Reserva</Label>
                  <p className="text-lg font-bold text-blue-600">{reservaOriginal.codigo}</p>
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
                  <Card key={detalle.id || index} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-gray-700">
                          Servicio #{index + 1} {detalle.id && `(ID: ${detalle.id})`}
                        </CardTitle>
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
                          <Label className="text-xs text-gray-600">Habitaciones</Label>
                          <p className="font-medium">{detalle.habitaciones}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Subtotal</Label>
                          <p className="font-medium">${detalle.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
                      <p className="text-xl font-bold text-blue-600">{totalesGenerales.habitacionesTotal > 0 ? totalesGenerales.habitacionesTotal : "N/A"}</p>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="moneda">Moneda {tienePagos && <span className="text-xs text-orange-600">(bloqueado - tiene pagos)</span>}</Label>
                  <Select value={formData.moneda} onValueChange={(value) => handleInputChange("moneda", value)} disabled={tienePagos}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOP">DOP - Peso Dominicano</SelectItem>
                      <SelectItem value="USD">USD - Dolar Americano</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="metodoPago">Metodo de Pago</Label>
                  <Select value={formData.metodoPago} onValueChange={(value) => handleInputChange("metodoPago", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar metodo" />
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
                  <Label htmlFor="proforma">Proforma</Label>
                  <Select value={formData.proforma} onValueChange={(value) => handleInputChange("proforma", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A LA ESP CONF">A LA ESP CONF</SelectItem>
                      <SelectItem value="PROFORMA">PROFORMA</SelectItem>
                      <SelectItem value="VOUCHER">VOUCHER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del Proveedor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-orange-600">
                <FileText className="w-5 h-5 mr-2" />
                Información del Proveedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="proveedor">Proveedor</Label>
                  <Select value={formData.proveedor} onValueChange={(value) => handleInputChange("proveedor", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suplidores.map((suplidor) => (
                        <SelectItem key={suplidor.id} value={suplidor.id.toString()}>
                          {suplidor.razon_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fecha Limite Pago</Label>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

                <div>
                  <Label htmlFor="comision">Comisión</Label>
                  <Select value={formData.comision} onValueChange={(value) => handleInputChange("comision", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SI">Sí</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div>
                  <Label htmlFor="asientosBus">Asientos Bus</Label>
                  <Input
                    id="asientosBus"
                    value={formData.asientosBus}
                    onChange={(e) => handleInputChange("asientosBus", e.target.value)}
                    placeholder="Ej: 1,2,3"
                  />
                </div>
              </div>

              {/* Archivos adicionales condicionales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {formData.facturaEnviadaCliente === "SI" && (
                  <div>
                    <Label htmlFor="facturaClienteFile">Factura Enviada Cliente</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="facturaClienteFile"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(e, setFacturaClienteFile)}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("facturaClienteFile")?.click()}
                        className="flex-1"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {facturaClienteFile ? facturaClienteFile.name : "Subir factura cliente"}
                      </Button>
                      {facturaClienteFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(setFacturaClienteFile)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {formData.facturaRecibidaProveedor === "SI" && (
                  <div>
                    <Label htmlFor="facturaProveedorFile">Factura Recibida Proveedor</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="facturaProveedorFile"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(e, setFacturaProveedorFile)}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("facturaProveedorFile")?.click()}
                        className="flex-1"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {facturaProveedorFile ? facturaProveedorFile.name : "Subir factura proveedor"}
                      </Button>
                      {facturaProveedorFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(setFacturaProveedorFile)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-span-full">
                  <Label>Archivos Adicionales</Label>
                  <p className="text-xs text-gray-500 mb-2">Puede adjuntar multiples documentos (PDF, JPG, PNG)</p>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const nuevos = Array.from(e.target.files).filter((f) => {
                          const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
                          return allowedTypes.includes(f.type) && f.size <= 5 * 1024 * 1024
                        })
                        setArchivosAdicionales((prev) => [...prev, ...nuevos])
                      }
                    }}
                  />
                  {archivosAdicionales.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {archivosAdicionales.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
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
              </div>
            </CardContent>
          </Card>

          {/* Información Adicional */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-purple-600">
                <Clock className="w-5 h-5 mr-2" />
                Información Adicional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  <p className="text-xs text-gray-500 mt-1">Solo para registro contable, no afecta cálculos</p>
                </div>

                <div>
                  <Label htmlFor="grupo">Es Grupo</Label>
                  <Select value={formData.grupo} onValueChange={(value) => handleInputChange("grupo", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SI">Sí</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                    </SelectContent>
                  </Select>
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
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => router.push("/reservas/pendientes")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isAdmin ? "Actualizando..." : "Creando cambio provisional..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isAdmin ? "Actualizar Reserva" : "Crear Cambio Provisional"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
