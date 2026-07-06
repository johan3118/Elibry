"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MessageSquare,
  Phone,
  Mail,
  FileText,
  Plus,
  Search,
  Clock,
  User,
  Building,
  CheckCircle,
  ArrowLeft,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { cerrarCasoAction } from "@/app/actions/crm-actions"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/user-context"

interface SeguimientoCaso {
  id: number
  titulo: string
  descripcion: string
  email_distribuidor: string
  nombre_distribuidor: string
  empresa_distribuidor: string
  telefono_distribuidor: string
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "URGENTE"
  estado: "ABIERTO" | "EN_PROCESO" | "CERRADO"
  creado_por: string
  cerrado_por?: string
  fecha_cierre?: string
  comentario_cierre?: string
  created_at: string
  updated_at: string
}

interface SeguimientoComentario {
  id: number
  caso_id: number
  tipo: "COMENTARIO" | "EMAIL_ENVIADO" | "EMAIL_RECIBIDO" | "LLAMADA" | "NOTA_INTERNA"
  comentario: string
  usuario: string
  created_at: string
}

const fallbackCasos: SeguimientoCaso[] = [
  {
    id: 1,
    titulo: "Consulta sobre paquetes turísticos 2025",
    descripcion: "Distribuidor solicita información sobre nuevos paquetes para la temporada 2025",
    email_distribuidor: "ventas@caribetours.com",
    nombre_distribuidor: "María González",
    empresa_distribuidor: "Caribe Tours",
    telefono_distribuidor: "(809) 555-0123",
    prioridad: "ALTA",
    estado: "ABIERTO",
    creado_por: "Juan Pérez",
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 2,
    titulo: "Problema técnico con sistema de reservas",
    descripcion: "Reportan errores al procesar reservaciones en línea",
    email_distribuidor: "soporte@viajesmundo.com",
    nombre_distribuidor: "Carlos Rodríguez",
    empresa_distribuidor: "Viajes Mundo",
    telefono_distribuidor: "(809) 555-0456",
    prioridad: "URGENTE",
    estado: "EN_PROCESO",
    creado_por: "Ana Martínez",
    created_at: "2024-01-14T14:20:00Z",
    updated_at: "2024-01-14T16:45:00Z",
  },
  {
    id: 3,
    titulo: "Solicitud de comisiones especiales",
    descripcion: "Petición de comisiones preferenciales para grupo corporativo",
    email_distribuidor: "admin@turismoplus.com",
    nombre_distribuidor: "Laura Fernández",
    empresa_distribuidor: "Turismo Plus",
    telefono_distribuidor: "(809) 555-0789",
    prioridad: "MEDIA",
    estado: "EN_PROCESO",
    creado_por: "Pedro López",
    created_at: "2024-01-13T09:15:00Z",
    updated_at: "2024-01-13T11:30:00Z",
  },
]

const fallbackComentarios: SeguimientoComentario[] = [
  {
    id: 1,
    caso_id: 1,
    tipo: "COMENTARIO",
    comentario: "Cliente interesado en paquetes todo incluido para familias",
    usuario: "Juan Pérez",
    created_at: "2024-01-15T10:35:00Z",
  },
  {
    id: 2,
    caso_id: 1,
    tipo: "EMAIL_ENVIADO",
    comentario: "Enviado catálogo de paquetes 2025 con precios especiales",
    usuario: "Juan Pérez",
    created_at: "2024-01-15T11:00:00Z",
  },
  {
    id: 3,
    caso_id: 2,
    tipo: "LLAMADA",
    comentario: "Llamada telefónica para diagnosticar el problema técnico",
    usuario: "Ana Martínez",
    created_at: "2024-01-14T15:30:00Z",
  },
]

// Pure helper: builds the optimistic patch applied to a case when it is closed.
// Exported so the omission of comentario_cierre (CR2) can be covered by a unit test
// without needing to render the client component.
export function buildCierreOptimista(cerradoPor: string, fechaCierre: string, comentarioCierre: string) {
  return {
    estado: "CERRADO" as const,
    cerrado_por: cerradoPor,
    fecha_cierre: fechaCierre,
    comentario_cierre: comentarioCierre || undefined,
  }
}

export default function CRMCasosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filtroParam = searchParams.get("filtro")
  const crearParam = searchParams.get("crear")

  const [casos, setCasos] = useState<SeguimientoCaso[]>([])
  const [comentarios, setComentarios] = useState<SeguimientoComentario[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>("ABIERTO")
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>("TODOS")
  const [filtroAntiguedad, setFiltroAntiguedad] = useState<string>("TODOS")
  const [filtroCreador, setFiltroCreador] = useState<string>("TODOS")
  const [busqueda, setBusqueda] = useState("")
  const [casoSeleccionado, setCasoSeleccionado] = useState<SeguimientoCaso | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingFallbackData, setUsingFallbackData] = useState(false)
  const [showNewCaseDialog, setShowNewCaseDialog] = useState(crearParam === "true")
  const [showCloseConfirmDialog, setShowCloseConfirmDialog] = useState(false)
  const [casoACerrar, setCasoACerrar] = useState<number | null>(null)
  const [comentarioCierre, setComentarioCierre] = useState("")

  const [nuevoCaso, setNuevoCaso] = useState({
    titulo: "",
    descripcion: "",
    email_distribuidor: "",
    nombre_distribuidor: "",
    empresa_distribuidor: "",
    telefono_distribuidor: "",
    prioridad: "MEDIA" as const,
  })

  const [nuevoComentario, setNuevoComentario] = useState({
    tipo: "COMENTARIO" as const,
    comentario: "",
  })

  const { toast } = useToast()
  const { user } = useUser()

  const cargarCasos = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: casosData, error: casosError } = await supabase
        .from("seguimiento_casos")
        .select("*")
        .order("created_at", { ascending: false })

      if (casosError) {
        console.error("Error cargando casos:", casosError)
        throw casosError
      }

      const { data: comentariosData, error: comentariosError } = await supabase
        .from("seguimiento_comentarios")
        .select("*")
        .order("created_at", { ascending: false })

      if (comentariosError) {
        console.error("Error cargando comentarios:", comentariosError)
        throw comentariosError
      }

      setCasos(casosData || [])
      setComentarios(comentariosData || [])
      setUsingFallbackData(false)
    } catch (error: any) {
      console.error("Error cargando casos:", error.message)

      if (
        error.message?.includes("does not exist") ||
        error.message?.includes("relation") ||
        error.message?.includes("column")
      ) {
        setCasos(fallbackCasos)
        setComentarios(fallbackComentarios)
        setUsingFallbackData(true)
        setError(null)
        toast({
          title: "Información",
          description: "Usando datos de ejemplo. Ejecute el script SQL para crear las tablas.",
          variant: "default",
        })
      } else {
        setError(`Error cargando datos: ${error.message}`)
        toast({
          title: "Error",
          description: `Error cargando datos: ${error.message}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    cargarCasos()
  }, [])

  // Update filter when URL param changes
  useEffect(() => {
    if (filtroParam) {
      if (filtroParam === "ABIERTO" || filtroParam === "EN_PROCESO" || filtroParam === "CERRADO") {
        setFiltroEstado(filtroParam)
        setFiltroAntiguedad("TODOS")
      } else if (filtroParam === "TODOS") {
        setFiltroEstado("TODOS")
        setFiltroAntiguedad("TODOS")
      } else {
        setFiltroAntiguedad(filtroParam)
        setFiltroEstado("TODOS")
      }
    }
  }, [filtroParam])

  const getAgeCategory = (createdAt: string): "normal" | "alerta" | "critico" => {
    const now = new Date()
    const created = new Date(createdAt)
    const hoursOld = (now.getTime() - created.getTime()) / (1000 * 60 * 60)

    if (hoursOld > 48) return "critico"
    if (hoursOld > 24) return "alerta"
    return "normal"
  }

  const getAgeBadge = (createdAt: string, estado: string) => {
    if (estado === "CERRADO") return null

    const category = getAgeCategory(createdAt)
    switch (category) {
      case "critico":
        return <Badge className="bg-red-100 text-red-800 border-red-200">+48h Crítico</Badge>
      case "alerta":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">24-48h Alerta</Badge>
      case "normal":
        return <Badge className="bg-green-100 text-green-800 border-green-200">0-24h Normal</Badge>
    }
  }

  const handleCreateCaso = async () => {
    try {
      if (!nuevoCaso.titulo || !nuevoCaso.email_distribuidor || !nuevoCaso.nombre_distribuidor) {
        toast({
          title: "Error",
          description: "Por favor complete los campos requeridos",
          variant: "destructive",
        })
        return
      }

      if (usingFallbackData) {
        const nuevoCasoCompleto: SeguimientoCaso = {
          id: Math.max(...casos.map((c) => c.id), 0) + 1,
          ...nuevoCaso,
          estado: "ABIERTO",
          creado_por: user?.nombre ?? user?.email ?? "Desconocido",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setCasos([nuevoCasoCompleto, ...casos])
        toast({
          title: "Información",
          description: "Caso creado localmente. Ejecute el script SQL para usar la base de datos.",
        })
      } else {
        const { data, error } = await supabase
          .from("seguimiento_casos")
          .insert([
            {
              ...nuevoCaso,
              estado: "ABIERTO",
              creado_por: user?.nombre ?? user?.email ?? "Desconocido",
            },
          ])
          .select()

        if (error) throw error

        if (data && data[0]) {
          setCasos([data[0], ...casos])
        }
        toast({
          title: "Éxito",
          description: "Caso creado exitosamente",
        })
      }

      setNuevoCaso({
        titulo: "",
        descripcion: "",
        email_distribuidor: "",
        nombre_distribuidor: "",
        empresa_distribuidor: "",
        telefono_distribuidor: "",
        prioridad: "MEDIA",
      })
      setShowNewCaseDialog(false)
    } catch (error: any) {
      console.error("Error creando caso:", error)
      toast({
        title: "Error",
        description: `Error creando caso: ${error.message}`,
        variant: "destructive",
      })
    }
  }

  const handleAddComment = async () => {
    try {
      if (!casoSeleccionado || !nuevoComentario.comentario) {
        toast({
          title: "Error",
          description: "Por favor complete el comentario",
          variant: "destructive",
        })
        return
      }

      if (usingFallbackData) {
        const comentarioCompleto: SeguimientoComentario = {
          id: Math.max(...comentarios.map((c) => c.id), 0) + 1,
          caso_id: casoSeleccionado.id,
          ...nuevoComentario,
          usuario: user?.nombre ?? user?.email ?? "Desconocido",
          created_at: new Date().toISOString(),
        }
        setComentarios([comentarioCompleto, ...comentarios])
        toast({
          title: "Información",
          description: "Comentario agregado localmente. Ejecute el script SQL para usar la base de datos.",
        })
      } else {
        const { data, error } = await supabase
          .from("seguimiento_comentarios")
          .insert([
            {
              caso_id: casoSeleccionado.id,
              ...nuevoComentario,
              usuario: user?.nombre ?? user?.email ?? "Desconocido",
            },
          ])
          .select()

        if (error) throw error

        if (data && data[0]) {
          setComentarios([data[0], ...comentarios])
        }
        toast({
          title: "Éxito",
          description: "Comentario agregado exitosamente",
        })
      }

      setNuevoComentario({
        tipo: "COMENTARIO",
        comentario: "",
      })
    } catch (error: any) {
      console.error("Error agregando comentario:", error)
      toast({
        title: "Error",
        description: `Error agregando comentario: ${error.message}`,
        variant: "destructive",
      })
    }
  }

  const handleConfirmCloseCaso = (casoId: number) => {
    setCasoACerrar(casoId)
    setShowCloseConfirmDialog(true)
  }

  const handleCloseCaso = async (casoId: number) => {
    const cerradoPor = user?.nombre ?? user?.email ?? "Desconocido"
    const fechaCierreLocal = new Date().toISOString()
    const casoCerrado = buildCierreOptimista(cerradoPor, fechaCierreLocal, comentarioCierre)

    // Actualizar el array de casos
    setCasos(
      casos.map((caso) =>
        caso.id === casoId
          ? { ...caso, ...casoCerrado }
          : caso,
      ),
    )
    
    // También actualizar el caso seleccionado si es el mismo
    if (casoSeleccionado?.id === casoId) {
      setCasoSeleccionado({ ...casoSeleccionado, ...casoCerrado })
    }
    
    toast({
      title: "Caso Cerrado",
      description: "El caso ha sido cerrado exitosamente",
    })

    // Sincronizar con la base de datos usando Server Action
    try {
      const result = await cerrarCasoAction(casoId, cerradoPor, comentarioCierre || undefined)
      
      if (!result.success) {
        console.error("Error al cerrar caso en DB:", result.error)
        toast({
          title: "Advertencia",
          description: "El caso se cerró localmente pero no se pudo guardar en la base de datos",
          variant: "destructive",
        })
      }
    } catch (dbError) {
      console.error("Excepción al cerrar caso:", dbError)
      toast({
        title: "Advertencia", 
        description: "El caso se cerró localmente pero hubo un error de conexión",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case "URGENTE":
        return "bg-red-100 text-red-800 border-red-200"
      case "ALTA":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "MEDIA":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "BAJA":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getEstadoColor = (estado: string) => {
  switch (estado) {
    case "ABIERTO":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "EN_PROCESO":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "CERRADO":
      return "bg-gray-100 text-gray-800 border-gray-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "EMAIL_ENVIADO":
      case "EMAIL_RECIBIDO":
        return <Mail className="h-4 w-4" />
      case "LLAMADA":
        return <Phone className="h-4 w-4" />
      case "NOTA_INTERNA":
        return <FileText className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  // Obtener lista de creadores únicos para el filtro
  const creadoresUnicos = [...new Set(casos.map((caso) => caso.creado_por).filter(Boolean))]

  const casosFiltrados = casos.filter((caso) => {
    const matchEstado = filtroEstado === "TODOS" || caso.estado === filtroEstado
    const matchPrioridad = filtroPrioridad === "TODOS" || caso.prioridad === filtroPrioridad
    const matchCreador = filtroCreador === "TODOS" || caso.creado_por === filtroCreador
    const matchBusqueda =
      busqueda === "" ||
      caso.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      caso.nombre_distribuidor.toLowerCase().includes(busqueda.toLowerCase()) ||
      caso.empresa_distribuidor?.toLowerCase().includes(busqueda.toLowerCase())

    let matchAntiguedad = true
    if (filtroAntiguedad !== "TODOS" && caso.estado !== "CERRADO") {
      const category = getAgeCategory(caso.created_at)
      matchAntiguedad = category === filtroAntiguedad
    }

    return matchEstado && matchPrioridad && matchCreador && matchBusqueda && matchAntiguedad
  })

  const comentariosCaso = casoSeleccionado ? comentarios.filter((c) => c.caso_id === casoSeleccionado.id) : []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando casos de seguimiento...</p>
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
              onClick={() => router.push("/crm")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al CRM
            </Button>
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Seguimiento de Casos</h1>
                <p className="text-sm text-gray-500">Gestión de casos y comunicación con distribuidores</p>
              </div>
            </div>
          </div>
          <Dialog open={showNewCaseDialog} onOpenChange={setShowNewCaseDialog}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Caso
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-blue-600">Crear Nuevo Caso</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="titulo">Título *</Label>
                  <Input
                    id="titulo"
                    value={nuevoCaso.titulo}
                    onChange={(e) => setNuevoCaso({ ...nuevoCaso, titulo: e.target.value })}
                    placeholder="Título del caso"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={nuevoCaso.descripcion}
                    onChange={(e) => setNuevoCaso({ ...nuevoCaso, descripcion: e.target.value })}
                    placeholder="Descripción detallada del caso"
                  />
                </div>
                <div>
                  <Label htmlFor="nombre">Nombre Distribuidor *</Label>
                  <Input
                    id="nombre"
                    value={nuevoCaso.nombre_distribuidor}
                    onChange={(e) => setNuevoCaso({ ...nuevoCaso, nombre_distribuidor: e.target.value })}
                    placeholder="Nombre del contacto"
                  />
                </div>
                <div>
                  <Label htmlFor="empresa">Empresa / Distribuidor</Label>
                  <Input
                    id="empresa"
                    value={nuevoCaso.empresa_distribuidor}
                    onChange={(e) => setNuevoCaso({ ...nuevoCaso, empresa_distribuidor: e.target.value })}
                    placeholder="Nombre de la empresa"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={nuevoCaso.email_distribuidor}
                    onChange={(e) => setNuevoCaso({ ...nuevoCaso, email_distribuidor: e.target.value })}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={nuevoCaso.telefono_distribuidor}
                    onChange={(e) => setNuevoCaso({ ...nuevoCaso, telefono_distribuidor: e.target.value })}
                    placeholder="(809) 555-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="prioridad">Prioridad</Label>
                  <Select
                    value={nuevoCaso.prioridad}
                    onValueChange={(value: any) => setNuevoCaso({ ...nuevoCaso, prioridad: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAJA">Baja</SelectItem>
                      <SelectItem value="MEDIA">Media</SelectItem>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="URGENTE">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNuevoCaso({
                        titulo: "",
                        descripcion: "",
                        email_distribuidor: "",
                        nombre_distribuidor: "",
                        empresa_distribuidor: "",
                        telefono_distribuidor: "",
                        prioridad: "MEDIA",
                      })
                      setShowNewCaseDialog(false)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleCreateCaso}>
                    Crear Caso
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Casos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar casos..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos los estados</SelectItem>
                      <SelectItem value="ABIERTO">Abierto</SelectItem>
                      <SelectItem value="EN_PROCESO">En Proceso</SelectItem>
                      <SelectItem value="CERRADO">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
                    <SelectTrigger>
                      <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todas las prioridades</SelectItem>
                      <SelectItem value="BAJA">Baja</SelectItem>
                      <SelectItem value="MEDIA">Media</SelectItem>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="URGENTE">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filtroAntiguedad} onValueChange={setFiltroAntiguedad}>
                    <SelectTrigger>
                      <SelectValue placeholder="Antigüedad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todas</SelectItem>
                      <SelectItem value="normal">0-24h (Normal)</SelectItem>
                      <SelectItem value="alerta">24-48h (Alerta)</SelectItem>
                      <SelectItem value="critico">+48h (Crítico)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filtroCreador} onValueChange={setFiltroCreador}>
                    <SelectTrigger>
                      <SelectValue placeholder="Creado por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos los usuarios</SelectItem>
                      {creadoresUnicos.map((creador) => (
                        <SelectItem key={creador} value={creador}>
                          {creador}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista */}
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Casos ({casosFiltrados.length})</CardTitle>
                <CardDescription>Lista de casos de seguimiento</CardDescription>
              </CardHeader>
              <CardContent>
                {casosFiltrados.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay casos</h3>
                    <p className="text-gray-500">No se encontraron casos con los filtros aplicados.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {casosFiltrados.map((caso) => (
                      <div
                        key={caso.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          casoSeleccionado?.id === caso.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                        onClick={() => setCasoSeleccionado(caso)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium text-gray-900">{caso.titulo}</h3>
                              <Badge className={getPrioridadColor(caso.prioridad)}>{caso.prioridad}</Badge>
                              <Badge className={getEstadoColor(caso.estado)}>{caso.estado.replace("_", " ")}</Badge>
                              {getAgeBadge(caso.created_at, caso.estado)}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{caso.descripcion}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {caso.nombre_distribuidor}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {caso.empresa_distribuidor || "Sin empresa"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(caso.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel de Detalle */}
          <div className="space-y-6">
            {casoSeleccionado ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600">Detalle del Caso #{casoSeleccionado.id}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm text-gray-500">Título</Label>
                      <p className="font-medium">{casoSeleccionado.titulo}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Descripción</Label>
                      <p className="text-sm">{casoSeleccionado.descripcion}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-gray-500">Estado</Label>
                        <Badge className={getEstadoColor(casoSeleccionado.estado)}>
                          {casoSeleccionado.estado.replace("_", " ")}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">Prioridad</Label>
                        <Badge className={getPrioridadColor(casoSeleccionado.prioridad)}>
                          {casoSeleccionado.prioridad}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Antigüedad</Label>
                      <div className="mt-1">{getAgeBadge(casoSeleccionado.created_at, casoSeleccionado.estado)}</div>
                    </div>
                    <div className="border-t pt-4">
                      <Label className="text-sm text-gray-500 mb-2 block">Contacto</Label>
                      <div className="space-y-2 text-sm">
                        <p className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {casoSeleccionado.nombre_distribuidor}
                        </p>
                        <p className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          {casoSeleccionado.empresa_distribuidor || "Sin empresa"}
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {casoSeleccionado.email_distribuidor}
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {casoSeleccionado.telefono_distribuidor || "Sin teléfono"}
                        </p>
                      </div>
                    </div>
                    {casoSeleccionado.estado !== "CERRADO" && (
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleConfirmCloseCaso(casoSeleccionado.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Cerrar Caso
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Comentarios */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-600">Historial de Actividad</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="comentarios">
                      <TabsList className="w-full">
                        <TabsTrigger value="comentarios" className="flex-1">
                          Comentarios
                        </TabsTrigger>
                        <TabsTrigger value="agregar" className="flex-1">
                          Agregar
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="comentarios" className="mt-4">
                        {/* Closing comment if case is closed */}
                        {casoSeleccionado.estado === "CERRADO" && casoSeleccionado.comentario_cierre && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-medium text-red-600">CASO CERRADO</span>
                              <span className="text-xs text-gray-400">{formatDate(casoSeleccionado.fecha_cierre || "")}</span>
                            </div>
                            <p className="text-sm text-red-800">{casoSeleccionado.comentario_cierre}</p>
                            <p className="text-xs text-gray-500 mt-1">Por: {casoSeleccionado.cerrado_por}</p>
                          </div>
                        )}
                        {comentariosCaso.length === 0 && !casoSeleccionado.comentario_cierre ? (
                          <p className="text-center text-gray-500 py-4">No hay comentarios</p>
                        ) : (
                          <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {comentariosCaso.map((comentario) => (
                              <div key={comentario.id} className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  {getTipoIcon(comentario.tipo)}
                                  <span className="text-xs font-medium text-gray-600">{comentario.tipo}</span>
                                  <span className="text-xs text-gray-400">{formatDate(comentario.created_at)}</span>
                                </div>
                                <p className="text-sm">{comentario.comentario}</p>
                                <p className="text-xs text-gray-500 mt-1">Por: {comentario.usuario}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="agregar" className="mt-4 space-y-4">
                        <div>
                          <Label>Tipo de Actividad</Label>
                          <Select
                            value={nuevoComentario.tipo}
                            onValueChange={(value: any) => setNuevoComentario({ ...nuevoComentario, tipo: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="COMENTARIO">Comentario</SelectItem>
                              <SelectItem value="EMAIL_ENVIADO">Email Enviado</SelectItem>
                              <SelectItem value="EMAIL_RECIBIDO">Email Recibido</SelectItem>
                              <SelectItem value="LLAMADA">Llamada</SelectItem>
                              <SelectItem value="NOTA_INTERNA">Nota Interna</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Comentario</Label>
                          <Textarea
                            value={nuevoComentario.comentario}
                            onChange={(e) => setNuevoComentario({ ...nuevoComentario, comentario: e.target.value })}
                            placeholder="Escriba su comentario..."
                            rows={3}
                          />
                        </div>
                        <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleAddComment}>
                          <Plus className="w-4 h-4 mr-2" />
                          Agregar Comentario
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Seleccione un caso para ver los detalles</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de Confirmación para Cerrar Caso */}
      <Dialog open={showCloseConfirmDialog} onOpenChange={setShowCloseConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirmar Cierre de Caso</DialogTitle>
            <DialogDescription className="text-gray-600">
              Esta accion marcara el caso como resuelto y no podra reabrirse.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="comentario-cierre">Comentario de Cierre (opcional)</Label>
            <Textarea
              id="comentario-cierre"
              value={comentarioCierre}
              onChange={(e) => setComentarioCierre(e.target.value)}
              placeholder="Describa como se resolvio el caso..."
              rows={3}
              className="mt-2"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowCloseConfirmDialog(false)
                setCasoACerrar(null)
                setComentarioCierre("")
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (casoACerrar) {
                  await handleCloseCaso(casoACerrar)
                  setShowCloseConfirmDialog(false)
                  setCasoACerrar(null)
                  setComentarioCierre("")
                }
              }}
            >
              Si, Cerrar Caso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
