"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Package, ArrowLeft, AlertCircle, Building, Mail, Phone, MapPin,
  Calendar, User, FileText, File, ExternalLink, Globe,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { formatDateDMY } from "@/lib/utils"
import { extractContactName } from "../constants"

interface Producto {
  id: number
  codigo?: string
  nombre_producto?: string
  nombre_original?: string
  tipo?: string
  suplidor_id?: number
  pais?: string
  status?: string
  contactos?: string
  telefonos_json?: string[]
  emails_json?: string[]
  direccion?: string
  comentarios?: string
  imagen_url?: string
  documentos_urls?: string[]
  fecha_creado: string
  fecha_editado?: string
  registrado_por?: string
  editado_por?: string
  estado_registro?: string
  estado_provisional?: string
  usuario_creacion?: string
}

interface Suplidor {
  id: number
  razon_social: string
  nombre_comercial: string
}

export default function VerProductoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productoId = searchParams.get("id")
  const [producto, setProducto] = useState<Producto | null>(null)
  const [suplidor, setSuplidor] = useState<Suplidor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (productoId) {
      cargarProducto()
    }
  }, [productoId])

  const cargarProducto = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("productos")
        .select("*")
        .eq("id", Number(productoId))
        .single()

      if (fetchError || !data) {
        setError(fetchError?.message || "Producto no encontrado")
        return
      }

      setProducto(data)

      // Load suplidor if present
      if (data.suplidor_id) {
        const { data: supData } = await supabase
          .from("suplidores")
          .select("id, razon_social, nombre_comercial")
          .eq("id", data.suplidor_id)
          .single()
        setSuplidor(supData)
      }
    } catch (err: any) {
      setError(err.message || "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "No especificado"
    return formatDateDMY(dateString) || "No especificado"
  }

  const getEstadoBadge = (estado?: string) => {
    switch (estado) {
      case "PERMANENTE": return <Badge className="bg-green-100 text-green-800">Permanente</Badge>
      case "PROVISIONAL": return <Badge className="bg-yellow-100 text-yellow-800">Provisional</Badge>
      case "MODIFICADO": return <Badge className="bg-blue-100 text-blue-800">Modificado</Badge>
      case "ELIMINADO": return <Badge className="bg-red-100 text-red-800">Eliminado</Badge>
      default: return <Badge className="bg-gray-100 text-gray-800">Permanente</Badge>
    }
  }

  const getFileName = (url: string) => {
    const parts = url.split("/")
    const raw = parts[parts.length - 1] || "Documento"
    // Strip timestamp prefix (e.g. "1713000000000_filename.pdf")
    return raw.replace(/^\d+_/, "")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error || !producto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || "Producto no encontrado"}</p>
          <Button onClick={() => router.push("/productos")} className="bg-blue-600 hover:bg-blue-700">
            Volver a Productos
          </Button>
        </div>
      </div>
    )
  }

  const estado = producto.estado_registro || producto.estado_provisional
  const esProvisional = estado && estado !== "PERMANENTE"

  // Parse contacts from telefonos_json / emails_json
  const telefonos: string[] = producto.telefonos_json || []
  const emails: string[] = producto.emails_json || []

  // Extract contact name from contactos string ("Nombre - Tel: ...")
  const contactoNombre = extractContactName(producto.contactos)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/productos")}
            className="text-gray-600 hover:text-blue-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Productos
          </Button>
          <div className="flex items-center space-x-2">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Ver Producto</h1>
              <p className="text-sm text-gray-500">{producto.codigo || `#${producto.id}`}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Provisional warning */}
        {esProvisional && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-orange-900">Producto en Estado Provisional</p>
                  <p className="text-xs text-orange-700">
                    Creado/modificado por {producto.usuario_creacion || producto.registrado_por} — pendiente de aprobacion.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logo / Image */}
        {producto.imagen_url && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-blue-600">Logo / Imagen</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={producto.imagen_url}
                alt={`Logo de ${producto.nombre_producto}`}
                className="h-40 w-auto object-contain rounded-lg border border-gray-200 bg-white p-2"
              />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información Principal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">Información Principal</CardTitle>
              <CardDescription>Datos básicos del producto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {producto.codigo && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Código</p>
                  <p className="font-mono">{producto.codigo}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Nombre del Producto</p>
                <p className="text-lg font-semibold">{producto.nombre_producto || "No especificado"}</p>
              </div>
              {producto.nombre_original && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Nombre Original</p>
                  <p>{producto.nombre_original}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Tipo</p>
                {producto.tipo ? (
                  <Badge variant="outline">{producto.tipo}</Badge>
                ) : (
                  <span className="text-gray-400">No especificado</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Estado</p>
                <Badge variant={producto.status === "ACTIVO" ? "default" : "destructive"}>
                  {producto.status || "ACTIVO"}
                </Badge>
              </div>
              {suplidor && (
                <div className="flex items-start space-x-3">
                  <Building className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Suplidor</p>
                    <p>{suplidor.razon_social}</p>
                    {suplidor.nombre_comercial && (
                      <p className="text-sm text-gray-500">{suplidor.nombre_comercial}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacto y Ubicación */}
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Contacto y Ubicación</CardTitle>
              <CardDescription>Datos del contacto principal y dirección</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contactoNombre && (
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nombre del Contacto</p>
                    <p>{contactoNombre}</p>
                  </div>
                </div>
              )}

              {telefonos.length > 0 && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Teléfonos</p>
                    {telefonos.map((tel, i) => (
                      <p key={i}>{tel}</p>
                    ))}
                  </div>
                </div>
              )}

              {emails.length > 0 && (
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Emails</p>
                    {emails.map((email, i) => (
                      <p key={i}>{email}</p>
                    ))}
                  </div>
                </div>
              )}

              {producto.pais && (
                <div className="flex items-center space-x-3">
                  <Globe className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">País</p>
                    <p>{producto.pais}</p>
                  </div>
                </div>
              )}

              {producto.direccion && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Dirección</p>
                    <p>{producto.direccion}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comentarios */}
        {producto.comentarios && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-orange-600">Comentarios</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{producto.comentarios}</p>
            </CardContent>
          </Card>
        )}

        {/* Documentos Adjuntos */}
        {producto.documentos_urls && producto.documentos_urls.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-indigo-600">Documentos Adjuntos</CardTitle>
              <CardDescription>{producto.documentos_urls.length} documento(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {producto.documentos_urls.map((url, i) => {
                  const name = getFileName(url)
                  const isPdf = url.toLowerCase().endsWith(".pdf")
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {isPdf ? (
                          <FileText className="w-5 h-5 text-red-500" />
                        ) : (
                          <File className="w-5 h-5 text-blue-500" />
                        )}
                        <span className="text-sm font-medium text-gray-700 truncate max-w-xs">{name}</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                    </a>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sistema / Auditoría */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-purple-600">Información del Sistema</CardTitle>
            <CardDescription>Auditoría y seguimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Fecha de Creación</p>
                  <p className="text-sm">{formatDate(producto.fecha_creado)}</p>
                </div>
              </div>
              {producto.fecha_editado && (
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Ultima Edición</p>
                    <p className="text-sm">{formatDate(producto.fecha_editado)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Registrado por</p>
                  <p className="text-sm">{producto.usuario_creacion || producto.registrado_por || "Sistema"}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Estado Registro</p>
                {getEstadoBadge(estado)}
              </div>
            </div>
            {producto.editado_por && (
              <div className="mt-4 pt-4 border-t flex items-center space-x-3">
                <User className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Ultima edición por</p>
                  <p className="text-sm">{producto.editado_por}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Boton Editar */}
        <div className="flex justify-end mt-6">
          <Button
            onClick={() => router.push(`/productos/editar?id=${producto.id}`)}
            className="bg-green-600 hover:bg-green-700"
          >
            Editar Producto
          </Button>
        </div>
      </div>
    </div>
  )
}
