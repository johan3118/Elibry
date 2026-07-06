"use client"

import Link from "next/link"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Edit, ArrowLeft, Building2, User, Phone, Mail, MapPin, Calendar, FileText, File, ExternalLink } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase, type Cliente } from "@/lib/supabase"
import { formatDateDMY } from "@/lib/utils"

export default function VerClientePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteId = searchParams.get("id")
  const [loading, setLoading] = useState(true)
  const [cliente, setCliente] = useState<Cliente | null>(null)

  useEffect(() => {
    if (clienteId) {
      cargarCliente()
    }
  }, [clienteId])

  const cargarCliente = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("clientes").select("*").eq("id", clienteId).single()

      if (error) {
        console.error("Error cargando cliente:", error)
        return
      }

      setCliente(data)
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando cliente...</p>
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Cliente no encontrado</p>
          <Link href="/clientes">
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700">Volver a Clientes</Button>
          </Link>
        </div>
      </div>
    )
  }

  const formatDateTime = (dateString: string) => {
    return formatDateDMY(dateString)
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
              onClick={() => router.push("/clientes")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Clientes
            </Button>
            <div className="flex items-center space-x-2">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Detalles del Cliente</h1>
                <p className="text-sm text-gray-500">Información completa del cliente</p>
              </div>
            </div>
          </div>
          <Link href={`/clientes/editar?id=${cliente.id}`}>
            <Button className="bg-green-600 hover:bg-green-700">
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Información Principal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Datos Principales */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {cliente.tipo_cliente === "EMPRESA" ? (
                      <Building2 className="w-5 h-5 text-blue-600" />
                    ) : (
                      <User className="w-5 h-5 text-green-600" />
                    )}
                    <CardTitle className="text-green-600">
                      {cliente.tipo_cliente === "EMPRESA" ? "Información de la Empresa" : "Información Personal"}
                    </CardTitle>
                  </div>
                  <div className="flex space-x-2">
                    <Badge variant={cliente.tipo_cliente === "EMPRESA" ? "default" : "secondary"}>
                      {cliente.tipo_cliente}
                    </Badge>
                    <Badge variant={cliente.status === "ACTIVO" ? "default" : "destructive"}>{cliente.status}</Badge>
                    <Badge variant="outline">{cliente.compania}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {cliente.tipo_cliente === "EMPRESA" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">RNC</Label>
                      <p className="text-lg font-semibold">{cliente.rnc}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Razón Social</Label>
                      <p className="text-lg font-semibold">{cliente.razon_social}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Nombre Comercial</Label>
                      <p className="text-lg">{cliente.nombre_comercial}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Responsable</Label>
                      <p className="text-lg">{cliente.responsable}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Identificación</Label>
                      <p className="text-lg font-semibold">{cliente.identificacion}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Nombre Completo</Label>
                      <p className="text-lg font-semibold">{cliente.nombre_completo}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Sexo</Label>
                      <p className="text-lg">{cliente.sexo}</p>
                    </div>
                    {cliente.fecha_nacimiento && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Fecha de Nacimiento</Label>
                        <p className="text-lg">{formatDateDMY(cliente.fecha_nacimiento)}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logo/Imagen - Solo para empresas */}
            {cliente.tipo_cliente === "EMPRESA" && cliente.imagen_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-600">Logo de la Empresa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <img
                      src={cliente.imagen_url || "/placeholder.svg"}
                      alt="Logo de la empresa"
                      className="w-[400px] h-[200px] object-cover border rounded-lg shadow-sm"
                      onError={(e) => {
                        // Fallback si la imagen no carga
                        const target = e.target as HTMLImageElement
                        target.src = "/placeholder.svg?height=200&width=400&text=Logo+de+la+Empresa"
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Información de Contacto */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-600">
                <Phone className="w-5 h-5" />
                <span>Información de Contacto</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Teléfonos</Label>
                    <p className="text-lg">{cliente.telefonos}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email</Label>
                    <p className="text-lg">{cliente.email}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Dirección</Label>
                    <p className="text-lg">{cliente.direccion}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <Label className="text-sm font-medium text-gray-500">País</Label>
                    <p className="text-lg">{(cliente as any).pais || "N/A"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentos Adjuntos */}
          {(cliente as any).documentos_urls && (cliente as any).documentos_urls.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-purple-600">
                  <File className="w-5 h-5" />
                  <span>Documentos Adjuntos</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(cliente as any).documentos_urls.map((url: string, index: number) => {
                    const fileName = url.split("/").pop() || `Documento ${index + 1}`
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
                    return (
                      <div key={index} className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                        {isImage ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={url} alt={fileName} className="w-full h-32 object-cover rounded mb-2" />
                            <p className="text-sm text-blue-600 truncate flex items-center">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              {fileName}
                            </p>
                          </a>
                        ) : (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-3">
                            <File className="w-10 h-10 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-blue-600 truncate">{fileName}</p>
                              <p className="text-xs text-gray-500">Clic para abrir</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Información Adicional */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Referencias y Observaciones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-blue-600">
                  <FileText className="w-5 h-5" />
                  <span>Informacion Adicional</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cliente.referido_por && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Referido Por</Label>
                    <p className="text-lg">{cliente.referido_por}</p>
                  </div>
                )}
                {cliente.observacion && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Observaciones</Label>
                    <p className="text-lg">{cliente.observacion}</p>
                  </div>
                )}
                {!cliente.referido_por && !cliente.observacion && (
                  <p className="text-gray-500 italic">No hay informacion adicional registrada</p>
                )}
              </CardContent>
            </Card>

            {/* Información del Sistema */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-green-600">
                  <Calendar className="w-5 h-5" />
                  <span>Información del Sistema</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Registrado Por</Label>
                  <p className="text-lg">{cliente.registrado_por}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Fecha de Creación</Label>
                  <p className="text-lg">{formatDateTime(cliente.fecha_creado)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Última Modificación</Label>
                  <p className="text-lg">{formatDateTime(cliente.fecha_editado)}</p>
                </div>
                {cliente.editado_por && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Editado Por</Label>
                    <p className="text-lg">{cliente.editado_por}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={className} {...props}>
      {children}
    </label>
  )
}
