"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertCircle,
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
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { formatDateDMY } from "@/lib/utils"

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

export default function SeguimientoPage() {
  const router = useRouter()
  const [casos, setCasos] = useState<SeguimientoCaso[]>([])
  const [comentarios, setComentarios] = useState<SeguimientoComentario[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>("ABIERTO")
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>("TODOS")
  const [busqueda, setBusqueda] = useState("")
  const [casoSeleccionado, setCasoSeleccionado] = useState<SeguimientoCaso | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingFallbackData, setUsingFallbackData] = useState(false)
  const [showNewCaseDialog, setShowNewCaseDialog] = useState(false)

  // Estados para formularios
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

  const cargarCasos = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Cargar casos
      const { data: casosData, error: casosError } = await supabase
        .from("seguimiento_casos")
        .select("*")
        .order("created_at", { ascending: false })

      if (casosError) {
        throw casosError
      }

      // Cargar comentarios
      const { data: comentariosData, error: comentariosError } = await supabase
        .from("seguimiento_comentarios")
        .select("*")
        .order("created_at", { ascending: false })

      if (comentariosError) {
        throw comentariosError
      }

      setCasos(casosData || [])
      setComentarios(comentariosData || [])
      setUsingFallbackData(false)
    } catch (error: any) {
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
        // Modo local
        const nuevoCasoCompleto: SeguimientoCaso = {
          id: Math.max(...casos.map((c) => c.id), 0) + 1,
          ...nuevoCaso,
          estado: "ABIERTO",
          creado_por: "Usuario Actual",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setCasos([nuevoCasoCompleto, ...casos])
        toast({
          title: "Información",
          description: "Caso creado localmente. Ejecute el script SQL para usar la base de datos.",
        })
      } else {
        // Modo base de datos
        const { data, error } = await supabase
          .from("seguimiento_casos")
          .insert([
            {
              ...nuevoCaso,
              estado: "ABIERTO",
              creado_por: "Usuario Actual",
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

      // Limpiar formulario
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
        // Modo local
        const comentarioCompleto: SeguimientoComentario = {
          id: Math.max(...comentarios.map((c) => c.id), 0) + 1,
          caso_id: casoSeleccionado.id,
          ...nuevoComentario,
          usuario: "Usuario Actual",
          created_at: new Date().toISOString(),
        }
        setComentarios([comentarioCompleto, ...comentarios])
        toast({
          title: "Información",
          description: "Comentario agregado localmente. Ejecute el script SQL para usar la base de datos.",
        })
      } else {
        // Modo base de datos
        const { data, error } = await supabase
          .from("seguimiento_comentarios")
          .insert([
            {
              caso_id: casoSeleccionado.id,
              ...nuevoComentario,
              usuario: "Usuario Actual",
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

      // Limpiar formulario
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

  const handleCloseCaso = async (casoId: number) => {
    const fechaCierreLocal = new Date().toISOString()
    const casoCerrado = { estado: "CERRADO" as const, cerrado_por: "Usuario Actual", fecha_cierre: fechaCierreLocal }
    
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

    // Si hay conexión a la base de datos, intentar sincronizar
    if (!usingFallbackData && supabase) {
      try {
        const fechaCierre = fechaCierreLocal.slice(0, 19).replace("T", " ")
        await supabase
          .from("seguimiento_casos")
          .update({
            estado: "CERRADO",
            cerrado_por: "Usuario Actual",
            fecha_cierre: fechaCierre,
          })
          .eq("id", casoId)
      } catch (dbError) {
        console.warn("No se pudo sincronizar con la base de datos:", dbError)
      }
    }
  }

  const formatDate = (dateString: string) => {
    return formatDateDMY(dateString)
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

  const casosFiltrados = casos.filter((caso) => {
    const matchEstado = filtroEstado === "TODOS" || caso.estado === filtroEstado
    const matchPrioridad = filtroPrioridad === "TODOS" || caso.prioridad === filtroPrioridad
    const matchBusqueda =
      busqueda === "" ||
      caso.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      caso.nombre_distribuidor.toLowerCase().includes(busqueda.toLowerCase()) ||
      caso.empresa_distribuidor?.toLowerCase().includes(busqueda.toLowerCase())

    return matchEstado && matchPrioridad && matchBusqueda
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
              onClick={() => router.push("/reservas/pendientes")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Reservas
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
                  <Label htmlFor="empresa">Empresa</Label>
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
                    className="border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateCaso} className="bg-green-600 hover:bg-green-700">
                    Crear Caso
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="p-6">
        {usingFallbackData && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Datos de Ejemplo</p>
                  <p className="text-xs text-blue-700">
                    Mostrando datos de ejemplo. Para usar datos reales, ejecute el script{" "}
                    <code>scripts/036-fix-seguimiento-tables.sql</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-900">Error</p>
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Casos Abiertos</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {casos.filter((c) => c.estado === "ABIERTO").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">En Proceso</p>
                  <p className="text-2xl font-bold text-green-600">
                    {casos.filter((c) => c.estado === "EN_PROCESO").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Casos Cerrados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {casos.filter((c) => c.estado === "CERRADO").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-600">Filtros de Búsqueda</CardTitle>
            <CardDescription>Buscar y filtrar casos de seguimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="MEDIA">Media</SelectItem>
                  <SelectItem value="BAJA">Baja</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setBusqueda("")
                  setFiltroEstado("ABIERTO")
                  setFiltroPrioridad("TODOS")
                }}
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Casos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Lista de Casos ({casosFiltrados.length})</CardTitle>
                <CardDescription>Casos de seguimiento con distribuidores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {casosFiltrados.map((caso) => (
                  <Card
                    key={caso.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      casoSeleccionado?.id === caso.id ? "ring-2 ring-blue-500" : ""
                    }`}
                    onClick={() => setCasoSeleccionado(caso)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{caso.titulo}</h3>
                        <div className="flex space-x-2">
                          <Badge className={getPrioridadColor(caso.prioridad)}>{caso.prioridad}</Badge>
                          <Badge className={getEstadoColor(caso.estado)}>{caso.estado.replace("_", " ")}</Badge>
                        </div>
                      </div>

                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{caso.descripcion}</p>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{caso.nombre_distribuidor}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4 text-gray-400" />
                          <span>{caso.empresa_distribuidor}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>{formatDate(caso.created_at)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {casosFiltrados.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No se encontraron casos que coincidan con los filtros</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detalle del Caso */}
          <div className="space-y-4">
            {casoSeleccionado ? (
              <>
                <div className="flex justify-between items-center">
                  <Card className="flex-1">
                    <CardHeader>
                      <CardTitle className="text-blue-600">Detalle del Caso</CardTitle>
                      <CardDescription>Información completa del caso seleccionado</CardDescription>
                    </CardHeader>
                  </Card>
                  {casoSeleccionado.estado !== "CERRADO" && (
                    <Button
                      variant="outline"
                      onClick={() => handleCloseCaso(casoSeleccionado.id)}
                      className="ml-4 border-green-200 text-green-600 hover:bg-green-50"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Cerrar Caso
                    </Button>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{casoSeleccionado.titulo}</CardTitle>
                      <div className="flex space-x-2">
                        <Badge className={getPrioridadColor(casoSeleccionado.prioridad)}>
                          {casoSeleccionado.prioridad}
                        </Badge>
                        <Badge className={getEstadoColor(casoSeleccionado.estado)}>
                          {casoSeleccionado.estado.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 mb-4">{casoSeleccionado.descripcion}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium">Distribuidor:</p>
                        <p>{casoSeleccionado.nombre_distribuidor}</p>
                      </div>
                      <div>
                        <p className="font-medium">Empresa:</p>
                        <p>{casoSeleccionado.empresa_distribuidor}</p>
                      </div>
                      <div>
                        <p className="font-medium">Email:</p>
                        <p>{casoSeleccionado.email_distribuidor}</p>
                      </div>
                      <div>
                        <p className="font-medium">Teléfono:</p>
                        <p>{casoSeleccionado.telefono_distribuidor}</p>
                      </div>
                      <div>
                        <p className="font-medium">Creado por:</p>
                        <p>{casoSeleccionado.creado_por}</p>
                      </div>
                      <div>
                        <p className="font-medium">Fecha:</p>
                        <p>{formatDate(casoSeleccionado.created_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Comentarios */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-600">Historial de Comunicación</CardTitle>
                    <CardDescription>Registro de todas las interacciones del caso</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="comentarios">
                      <TabsList>
                        <TabsTrigger value="comentarios">Comentarios ({comentariosCaso.length})</TabsTrigger>
                        <TabsTrigger value="nuevo">Agregar</TabsTrigger>
                      </TabsList>

                      <TabsContent value="comentarios" className="space-y-4">
                        {comentariosCaso.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No hay comentarios aún</p>
                        ) : (
                          comentariosCaso.map((comentario) => (
                            <div key={comentario.id} className="border-l-4 border-blue-200 pl-4 py-2">
                              <div className="flex items-center space-x-2 mb-1">
                                {getTipoIcon(comentario.tipo)}
                                <span className="font-medium text-sm">{comentario.tipo.replace("_", " ")}</span>
                                <span className="text-gray-500 text-sm">•</span>
                                <span className="text-gray-500 text-sm">{comentario.usuario}</span>
                                <span className="text-gray-500 text-sm">•</span>
                                <span className="text-gray-500 text-sm">{formatDate(comentario.created_at)}</span>
                              </div>
                              <p className="text-gray-700">{comentario.comentario}</p>
                            </div>
                          ))
                        )}
                      </TabsContent>

                      <TabsContent value="nuevo" className="space-y-4">
                        <div>
                          <Label htmlFor="tipo-comentario">Tipo</Label>
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
                          <Label htmlFor="comentario">Comentario</Label>
                          <Textarea
                            id="comentario"
                            value={nuevoComentario.comentario}
                            onChange={(e) => setNuevoComentario({ ...nuevoComentario, comentario: e.target.value })}
                            placeholder="Escriba su comentario aquí..."
                            rows={4}
                          />
                        </div>

                        <Button onClick={handleAddComment} className="w-full bg-green-600 hover:bg-green-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Comentario
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Seleccione un caso para ver los detalles</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
