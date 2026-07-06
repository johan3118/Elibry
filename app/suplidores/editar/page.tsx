"use client"

import Link from "next/link"
import { useUser } from "@/lib/user-context"
import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Building2, ArrowLeft, MapPin, User, Globe, Trash2, File } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase, uploadImage } from "@/lib/supabase"
import { MultiContactInput } from "@/components/multi-contact-input"
import { actualizarSuplidorAction } from "@/app/actions/crm-actions"

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
  fecha_creado: string
  fecha_editado: string
}

const COUNTRIES = [
  "Afganistán","Albania","Alemania","Andorra","Angola","Antigua y Barbuda","Arabia Saudita","Argelia","Argentina","Armenia","Australia","Austria","Azerbaiyán","Bahamas","Bangladés","Barbados","Baréin","Bélgica","Belice","Benín","Bielorrusia","Birmania","Bolivia","Bosnia y Herzegovina","Botsuana","Brasil","Brunéi","Bulgaria","Burkina Faso","Burundi","Bután","Cabo Verde","Camboya","Camerún","Canadá","Catar","Chad","Chile","China","Chipre","Colombia","Comoras","Corea del Norte","Corea del Sur","Costa de Marfil","Costa Rica","Croacia","Cuba","Dinamarca","Dominica","Ecuador","Egipto","El Salvador","Emiratos Árabes Unidos","Eritrea","Eslovaquia","Eslovenia","España","Estados Unidos","Estonia","Esuatini","Etiopía","Filipinas","Finlandia","Fiyi","Francia","Gabón","Gambia","Georgia","Ghana","Granada","Grecia","Guatemala","Guinea","Guinea Ecuatorial","Guinea-Bisáu","Guyana","Haití","Honduras","Hungría","India","Indonesia","Irak","Irán","Irlanda","Islandia","Islas Marshall","Islas Salomón","Israel","Italia","Jamaica","Japón","Jordania","Kazajistán","Kenia","Kirguistán","Kiribati","Kuwait","Laos","Lesoto","Letonia","Líbano","Liberia","Libia","Liechtenstein","Lituania","Luxemburgo","Madagascar","Malasia","Malaui","Maldivas","Malí","Malta","Marruecos","Mauricio","Mauritania","México","Micronesia","Moldavia","Mónaco","Mongolia","Montenegro","Mozambique","Namibia","Nauru","Nepal","Nicaragua","Níger","Nigeria","Noruega","Nueva Zelanda","Omán","Países Bajos","Pakistán","Palaos","Panamá","Papúa Nueva Guinea","Paraguay","Perú","Polonia","Portugal","Puerto Rico","Reino Unido","República Centroafricana","República Checa","República del Congo","República Democrática del Congo","República Dominicana","Ruanda","Rumanía","Rusia","Samoa","San Cristóbal y Nieves","San Marino","San Vicente y las Granadinas","Santa Lucía","Santo Tomé y Príncipe","Senegal","Serbia","Seychelles","Sierra Leona","Singapur","Siria","Somalia","Sri Lanka","Sudáfrica","Sudán","Sudán del Sur","Suecia","Suiza","Surinam","Tailandia","Tanzania","Tayikistán","Timor Oriental","Togo","Tonga","Trinidad y Tobago","Túnez","Turkmenistán","Turquía","Tuvalu","Ucrania","Uganda","Uruguay","Uzbekistán","Vanuatu","Venezuela","Vietnam","Yemen","Yibuti","Zambia","Zimbabue",
]

export default function EditarSuplidorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const suplidorId = searchParams.get("id")
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [suplidor, setSuplidor] = useState<Suplidor | null>(null)
  const [formData, setFormData] = useState({
    razon_social: "",
    nombre_comercial: "",
    identificacion: "",
    nombre_responsable: "",
    telefono_responsable: "",
    pais: "",
    direccion: "",
    email: "",
    observacion: "",
    status: "ACTIVO",
  })
  const [telefonos, setTelefonos] = useState<string[]>([""])
  const [emails, setEmails] = useState<string[]>([""])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [existingDocUrls, setExistingDocUrls] = useState<string[]>([])

  const { user, isAdmin } = useUser()

  useEffect(() => {
    if (suplidorId) {
      cargarSuplidor()
    }
  }, [suplidorId])

  const cargarSuplidor = async () => {
    try {
      setLoadingData(true)
      const { data, error } = await supabase.from("suplidores").select("*").eq("id", suplidorId).single()

      if (error) {
        console.error("Error cargando suplidor:", error)
        return
      }

      setSuplidor(data)
      setFormData({
        razon_social: data.razon_social || "",
        nombre_comercial: data.nombre_comercial || "",
        identificacion: data.identificacion || "",
        nombre_responsable: data.nombre_responsable || "",
        telefono_responsable: data.telefono_responsable || "",
        pais: data.pais || "",
        direccion: data.direccion || "",
        email: data.email || "",
        observacion: data.observacion || "",
        status: data.status || "ACTIVO",
      })
      setTelefonos(data.telefonos && data.telefonos.length > 0 ? data.telefonos : [data.telefono_responsable || ""])
      setEmails(data.emails && data.emails.length > 0 ? data.emails : [data.email || ""])
      setExistingImageUrl(data.imagen_url || null)
      setExistingDocUrls(data.documentos_urls || [])
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoadingData(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.razon_social.trim()) {
      newErrors.razon_social = "La razón social es obligatoria"
    }

    if (!formData.nombre_comercial.trim()) {
      newErrors.nombre_comercial = "El nombre comercial es obligatorio"
    }

    if (!formData.identificacion.trim()) {
      newErrors.identificacion = "La identificación es obligatoria"
    }

    if (!formData.nombre_responsable.trim()) {
      newErrors.nombre_responsable = "El nombre del responsable es obligatorio"
    }

    if (!telefonos[0]?.trim()) {
      newErrors.telefonos = "Al menos un teléfono es obligatorio"
    }

    if (!formData.pais.trim()) {
      newErrors.pais = "El país es obligatorio"
    }

    if (!formData.direccion.trim()) {
      newErrors.direccion = "La dirección es obligatoria"
    }

    if (!emails[0]?.trim()) {
      newErrors.emails = "Al menos un email es obligatorio"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emails[0])) {
      newErrors.emails = "El formato del email no es válido"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      // Upload new image if selected
      let imagenUrl = existingImageUrl
      if (selectedImage) {
        try {
          imagenUrl = await uploadImage(selectedImage, "suplidores-imagenes", "SUPLIDOR")
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error al subir la imagen")
          setLoading(false)
          return
        }
      }

      // Upload new documents and merge with existing
      const nuevosDocUrls: string[] = []
      for (const file of documentFiles) {
        try {
          const url = await uploadImage(file, "suplidores-documentos", file.name)
          if (url) nuevosDocUrls.push(url)
        } catch (err) {
          console.error("Error subiendo documento:", err)
        }
      }
      const documentosUrls = [...existingDocUrls, ...nuevosDocUrls]

      const suplidorData = {
        razon_social: formData.razon_social.trim(),
        nombre_comercial: formData.nombre_comercial.trim(),
        identificacion: formData.identificacion.trim(),
        nombre_responsable: formData.nombre_responsable.trim(),
        telefono_responsable: telefonos[0] || formData.telefono_responsable.trim(),
        telefonos: telefonos.filter((t) => t.trim()),
        emails: emails.filter((e) => e.trim()),
        pais: formData.pais.trim(),
        direccion: formData.direccion.trim(),
        email: emails[0] || formData.email.trim(),
        observacion: formData.observacion.trim() || null,
        status: formData.status,
        imagen_url: imagenUrl,
        documentos_urls: documentosUrls.length > 0 ? documentosUrls : null,
        fecha_editado: new Date().toISOString(),
        editado_por: user?.nombre || "Usuario Sistema",
        estado_registro: isAdmin ? "PERMANENTE" : "MODIFICADO",
      }

      const result = await actualizarSuplidorAction(Number(suplidorId!), suplidorData)

      if (!result.success) {
        alert("Error al actualizar el suplidor: " + result.error)
        return
      }

      alert(
        isAdmin
          ? "Suplidor actualizado exitosamente"
          : "Suplidor actualizado. Los cambios estan pendientes de aprobacion del administrador.",
      )
      router.push("/suplidores")
    } catch (error) {
      alert("Error inesperado al procesar la solicitud")
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }))
    }
  }

  const formatTelefono = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    const limitedNumbers = numbers.slice(0, 10)

    if (limitedNumbers.length === 0) return ""
    if (limitedNumbers.length <= 3) return limitedNumbers
    if (limitedNumbers.length <= 6) return `(${limitedNumbers.slice(0, 3)}) ${limitedNumbers.slice(3)}`
    return `(${limitedNumbers.slice(0, 3)}) ${limitedNumbers.slice(3, 6)}-${limitedNumbers.slice(6)}`
  }

  if (loadingData) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
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
              <h1 className="text-2xl font-bold text-blue-600">Editar Suplidor</h1>
              <p className="text-sm text-gray-500">Modificar información del proveedor</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información Principal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Información del Suplidor</CardTitle>
                <CardDescription>Datos principales del proveedor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="razon_social" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Razón Social *
                  </Label>
                  <Input
                    id="razon_social"
                    value={formData.razon_social}
                    onChange={(e) => handleInputChange("razon_social", e.target.value)}
                    placeholder="Razón social del suplidor"
                    required
                  />
                  {errors.razon_social && <p className="text-red-500 text-sm">{errors.razon_social}</p>}
                </div>

                <div>
                  <Label htmlFor="nombre_comercial">Nombre Comercial *</Label>
                  <Input
                    id="nombre_comercial"
                    value={formData.nombre_comercial}
                    onChange={(e) => handleInputChange("nombre_comercial", e.target.value)}
                    placeholder="Nombre comercial"
                    required
                  />
                  {errors.nombre_comercial && <p className="text-red-500 text-sm">{errors.nombre_comercial}</p>}
                </div>

                <div>
                  <Label htmlFor="identificacion">RNC / Identificacion *</Label>
                  <Input
                    id="identificacion"
                    value={formData.identificacion}
                    onChange={(e) => handleInputChange("identificacion", e.target.value)}
                    placeholder="RNC, Pasaporte, Tax ID, etc."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Acepta RNC, Pasaporte, Tax ID u otro formato internacional</p>
                  {errors.identificacion && <p className="text-red-500 text-sm">{errors.identificacion}</p>}
                </div>

                <div>
                  <Label htmlFor="pais" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    País *
                  </Label>
                  <Select value={formData.pais} onValueChange={(v) => handleInputChange("pais", v)}>
                    <SelectTrigger id="pais">
                      <SelectValue placeholder="Seleccionar país" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.pais && <p className="text-red-500 text-sm">{errors.pais}</p>}
                </div>

                <div>
                  <Label htmlFor="status">Estado *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado del suplidor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                      <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Información de Contacto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Información de Contacto</CardTitle>
                <CardDescription>Datos de contacto del proveedor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="nombre_responsable" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nombre del Responsable *
                  </Label>
                  <Input
                    id="nombre_responsable"
                    value={formData.nombre_responsable}
                    onChange={(e) => handleInputChange("nombre_responsable", e.target.value)}
                    placeholder="Nombre del responsable"
                    required
                  />
                  {errors.nombre_responsable && <p className="text-red-500 text-sm">{errors.nombre_responsable}</p>}
                </div>

                <MultiContactInput
                  type="phone"
                  values={telefonos}
                  onChange={setTelefonos}
                  label="Teléfonos"
                  placeholder="(809) 555-0123"
                  required
                  formatFn={formatTelefono}
                />
                {errors.telefonos && <p className="text-red-500 text-sm">{errors.telefonos}</p>}

                <MultiContactInput
                  type="email"
                  values={emails}
                  onChange={setEmails}
                  label="Correos Electrónicos"
                  placeholder="contacto@suplidor.com"
                  required
                />
                {errors.emails && <p className="text-red-500 text-sm">{errors.emails}</p>}

                <div>
                  <Label htmlFor="direccion" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Dirección *
                  </Label>
                  <Textarea
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => handleInputChange("direccion", e.target.value)}
                    placeholder="Dirección completa"
                    rows={3}
                    required
                  />
                  {errors.direccion && <p className="text-red-500 text-sm">{errors.direccion}</p>}
                </div>

                <div>
                  <Label htmlFor="observacion">Observaciones</Label>
                  <Textarea
                    id="observacion"
                    value={formData.observacion}
                    onChange={(e) => handleInputChange("observacion", e.target.value)}
                    placeholder="Observaciones adicionales (opcional)"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Imagen y Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">Imagen y Documentos</CardTitle>
              <CardDescription>Logo del suplidor y documentacion adjunta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Imagen */}
              <div>
                <Label>Logo o Imagen</Label>
                <p className="text-xs text-gray-500 mb-2">JPG, PNG - Logo representativo del suplidor</p>
                <div className="flex items-start gap-4">
                  {(imagePreview || existingImageUrl) && (
                    <div className="relative">
                      <img
                        src={imagePreview || existingImageUrl!}
                        alt="Preview"
                        className="w-32 h-32 object-contain rounded-lg border bg-white p-1"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                        onClick={() => { setSelectedImage(null); setImagePreview(null); setExistingImageUrl(null) }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      className="cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setSelectedImage(file)
                        if (file) {
                          const reader = new FileReader()
                          reader.onloadend = () => setImagePreview(reader.result as string)
                          reader.readAsDataURL(file)
                        } else {
                          setImagePreview(null)
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Documentos guardados */}
              {existingDocUrls.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Documentos guardados:</p>
                  <div className="space-y-1">
                    {existingDocUrls.map((url, i) => {
                      const name = url.split("/").pop()?.replace(/^\d+_/, "") || `Documento ${i + 1}`
                      return (
                        <div key={i} className="flex items-center justify-between text-sm p-2 bg-blue-50 border border-blue-100 rounded">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:underline flex-1 mr-2">
                            <File className="w-4 h-4 inline mr-1" />
                            {name}
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setExistingDocUrls(existingDocUrls.filter((_, idx) => idx !== i))}
                            className="text-red-500 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Nuevos documentos */}
              <div>
                <Label>Agregar Documentos</Label>
                <p className="text-xs text-gray-500 mb-2">PDF, JPG, PNG - Contratos, certificaciones, etc.</p>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={(e) => { if (e.target.files) setDocumentFiles(Array.from(e.target.files)) }}
                />
                {documentFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {documentFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-1 bg-gray-50 rounded">
                        <span className="flex items-center truncate">
                          <File className="w-4 h-4 mr-2 text-gray-400" />
                          {file.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDocumentFiles(documentFiles.filter((_, idx) => idx !== i))}
                          className="text-red-500 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/suplidores")}
              disabled={loading}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Guardando..." : "Actualizar Suplidor"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
