"use client"

import Link from "next/link"
import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Edit, ArrowLeft, Phone, Mail, MapPin, Calendar, User, FileText, File } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { formatDateDMY } from "@/lib/utils"

interface Suplidor {
  id: number
  razon_social: string
  nombre_comercial: string
  identificacion: string
  nombre_responsable: string
  telefono_responsable: string
  telefonos?: string[]
  emails?: string[]
  pais: string
  direccion: string
  email: string
  observacion?: string
  status: string
  imagen_url?: string
  documentos_urls?: string[]
  creado_por?: string
  editado_por?: string
  fecha_creado: string
  fecha_editado: string
}

export default function VerSuplidorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const suplidorId = searchParams.get("id")
  const [loading, setLoading] = useState(true)
  const [suplidor, setSuplidor] = useState<Suplidor | null>(null)

  useEffect(() => {
    if (suplidorId) {
      cargarSuplidor()
    }
  }, [suplidorId])

  const cargarSuplidor = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("suplidores").select("*").eq("id", suplidorId).single()

      if (error) {
        console.error("Error cargando suplidor:", error)
        return
      }

      setSuplidor(data)
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
          <p className="mt-4 text-gray-600">Cargando suplidor...</p>
        </div>
      </div>
    )
  }

  if (!suplidor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Suplidor no encontrado</p>
          <Link href="/suplidores">
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700">Volver a Suplidores</Button>
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
              onClick={() => router.push("/suplidores")}
              className="text-gray-600 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Suplidores
            </Button>
            <div className="flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Detalles del Suplidor</h1>
                <p className="text-sm text-gray-500">Información completa del proveedor</p>
              </div>
            </div>
          </div>
          <Link href={`/suplidores/editar?id=${suplidor.id}`}>
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
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-green-600">Información del Suplidor</CardTitle>
                </div>
                <div className="flex space-x-2">
                  <Badge variant="default">PROVEEDOR</Badge>
                  <Badge variant={suplidor.status === "ACTIVO" ? "default" : "destructive"}>{suplidor.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Razón Social</Label>
                  <p className="text-lg font-semibold">{suplidor.razon_social}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Nombre Comercial</Label>
                  <p className="text-lg">{suplidor.nombre_comercial}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Identificación</Label>
                  <p className="text-lg font-mono">{suplidor.identificacion}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">País</Label>
                  <p className="text-lg">{suplidor.pais}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información de Contacto */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-600">
                <Phone className="w-5 h-5" />
                <span>Informacion de Contacto</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="flex items-start space-x-3">
                  <User className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Responsable</Label>
                    <p className="text-lg">{suplidor.nombre_responsable}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Telefonos</Label>
                    {suplidor.telefonos && suplidor.telefonos.length > 0 ? (
                      <div className="space-y-1">
                        {suplidor.telefonos.map((tel, i) => (
                          <p key={i} className="text-lg">{tel}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-lg">{suplidor.telefono_responsable || "N/A"}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Emails</Label>
                    {suplidor.emails && suplidor.emails.length > 0 ? (
                      <div className="space-y-1">
                        {suplidor.emails.map((em, i) => (
                          <p key={i} className="text-lg">{em}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-lg">{suplidor.email || "N/A"}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Direccion</Label>
                    <p className="text-lg">{suplidor.direccion}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Imagen y Documentos */}
          {(suplidor.imagen_url || (suplidor.documentos_urls && suplidor.documentos_urls.length > 0)) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-blue-600">
                  <File className="w-5 h-5" />
                  <span>Imagen y Documentos</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {suplidor.imagen_url && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Logo</p>
                    <img
                      src={suplidor.imagen_url}
                      alt="Logo del suplidor"
                      className="w-40 h-40 object-contain rounded-lg border bg-white p-2"
                    />
                  </div>
                )}
                {suplidor.documentos_urls && suplidor.documentos_urls.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Documentos Adjuntos</p>
                    <div className="space-y-2">
                      {suplidor.documentos_urls.map((url, i) => {
                        const name = url.split("/").pop()?.replace(/^\d+_/, "") || `Documento ${i + 1}`
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline p-2 bg-blue-50 rounded border border-blue-100"
                          >
                            <File className="w-4 h-4 shrink-0" />
                            {name}
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Información Adicional y del Sistema */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Observaciones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-blue-600">
                  <FileText className="w-5 h-5" />
                  <span>Observaciones</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {suplidor.observacion ? (
                  <p className="text-lg">{suplidor.observacion}</p>
                ) : (
                  <p className="text-gray-500 italic">No hay observaciones registradas</p>
                )}
              </CardContent>
            </Card>

            {/* Información del Sistema */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-green-600">
                  <Calendar className="w-5 h-5" />
                  <span>Informacion del Sistema</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Creado Por</Label>
                  <p className="text-lg">{suplidor.creado_por || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Fecha de Creacion</Label>
                  <p className="text-lg">{formatDateTime(suplidor.fecha_creado)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Editado Por</Label>
                  <p className="text-lg">{suplidor.editado_por || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Ultima Modificacion</Label>
                  <p className="text-lg">{suplidor.fecha_editado ? formatDateTime(suplidor.fecha_editado) : "N/A"}</p>
                </div>
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
