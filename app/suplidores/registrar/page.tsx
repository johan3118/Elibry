"use client"

import type React from "react"
import { useUser } from "@/lib/user-context"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Building2, ArrowLeft, MapPin, Globe, User, Trash2, File } from "lucide-react"
import { MultiContactInput } from "@/components/multi-contact-input"
import { uploadImage } from "@/lib/supabase"
import { crearSuplidorAction } from "@/app/actions/crm-actions"

const COUNTRIES = [
  "Afganistán","Albania","Alemania","Andorra","Angola","Antigua y Barbuda","Arabia Saudita","Argelia","Argentina","Armenia","Australia","Austria","Azerbaiyán","Bahamas","Bangladés","Barbados","Baréin","Bélgica","Belice","Benín","Bielorrusia","Birmania","Bolivia","Bosnia y Herzegovina","Botsuana","Brasil","Brunéi","Bulgaria","Burkina Faso","Burundi","Bután","Cabo Verde","Camboya","Camerún","Canadá","Catar","Chad","Chile","China","Chipre","Colombia","Comoras","Corea del Norte","Corea del Sur","Costa de Marfil","Costa Rica","Croacia","Cuba","Dinamarca","Dominica","Ecuador","Egipto","El Salvador","Emiratos Árabes Unidos","Eritrea","Eslovaquia","Eslovenia","España","Estados Unidos","Estonia","Esuatini","Etiopía","Filipinas","Finlandia","Fiyi","Francia","Gabón","Gambia","Georgia","Ghana","Granada","Grecia","Guatemala","Guinea","Guinea Ecuatorial","Guinea-Bisáu","Guyana","Haití","Honduras","Hungría","India","Indonesia","Irak","Irán","Irlanda","Islandia","Islas Marshall","Islas Salomón","Israel","Italia","Jamaica","Japón","Jordania","Kazajistán","Kenia","Kirguistán","Kiribati","Kuwait","Laos","Lesoto","Letonia","Líbano","Liberia","Libia","Liechtenstein","Lituania","Luxemburgo","Madagascar","Malasia","Malaui","Maldivas","Malí","Malta","Marruecos","Mauricio","Mauritania","México","Micronesia","Moldavia","Mónaco","Mongolia","Montenegro","Mozambique","Namibia","Nauru","Nepal","Nicaragua","Níger","Nigeria","Noruega","Nueva Zelanda","Omán","Países Bajos","Pakistán","Palaos","Panamá","Papúa Nueva Guinea","Paraguay","Perú","Polonia","Portugal","Puerto Rico","Reino Unido","República Centroafricana","República Checa","República del Congo","República Democrática del Congo","República Dominicana","Ruanda","Rumanía","Rusia","Samoa","San Cristóbal y Nieves","San Marino","San Vicente y las Granadinas","Santa Lucía","Santo Tomé y Príncipe","Senegal","Serbia","Seychelles","Sierra Leona","Singapur","Siria","Somalia","Sri Lanka","Sudáfrica","Sudán","Sudán del Sur","Suecia","Suiza","Surinam","Tailandia","Tanzania","Tayikistán","Timor Oriental","Togo","Tonga","Trinidad y Tobago","Túnez","Turkmenistán","Turquía","Tuvalu","Ucrania","Uganda","Uruguay","Uzbekistán","Vanuatu","Vaticano","Venezuela","Vietnam","Yemen","Yibuti","Zambia","Zimbabue"
]

const RegistrarSuplidorPage = () => {
  const { user, isAdmin } = useUser()
  const router = useRouter()
  const [formData, setFormData] = useState({
    razon_social: "",
    nombre_comercial: "",
    identificacion: "",
    nombre_responsable: "",
    telefono_responsable: "",
    email: "",
    direccion: "",
    pais: "",
    observacion: "",
    status: "ACTIVO",
  })
  const [telefonos, setTelefonos] = useState<string[]>([""])
  const [emails, setEmails] = useState<string[]>([""])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [documentFiles, setDocumentFiles] = useState<File[]>([])

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

    if (!emails[0]?.trim()) {
      newErrors.emails = "Al menos un email es obligatorio"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emails[0])) {
      newErrors.emails = "El formato del email no es válido"
    }

    if (!formData.direccion.trim()) {
      newErrors.direccion = "La dirección es obligatoria"
    }

    if (!formData.pais.trim()) {
      newErrors.pais = "El país es obligatorio"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const formatRNC = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    const limitedNumbers = numbers.slice(0, 9)

    if (limitedNumbers.length === 0) {
      return ""
    } else if (limitedNumbers.length <= 3) {
      return limitedNumbers
    } else if (limitedNumbers.length <= 8) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 8)}-${limitedNumbers.slice(8)}`
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

  const handleInputChange = (field: string, value: string) => {
    if (field === "telefono_responsable") {
      const formatted = formatTelefono(value)
      setFormData((prev) => ({
        ...prev,
        [field]: formatted,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
    }

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      // Upload image if selected
      let imagenUrl: string | null = null
      if (selectedImage) {
        try {
          imagenUrl = await uploadImage(selectedImage, "suplidores-imagenes", "SUPLIDOR")
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error al subir la imagen")
          setLoading(false)
          return
        }
      }

      // Upload documents
      const documentosUrls: string[] = []
      for (const file of documentFiles) {
        try {
          const url = await uploadImage(file, "suplidores-documentos", file.name)
          if (url) documentosUrls.push(url)
        } catch (err) {
          console.error("Error subiendo documento:", err)
        }
      }

      const suplidorData = {
        razon_social: formData.razon_social,
        nombre_comercial: formData.nombre_comercial,
        identificacion: formData.identificacion,
        nombre_responsable: formData.nombre_responsable,
        telefono_responsable: telefonos[0] || formData.telefono_responsable,
        email: emails[0] || formData.email,
        telefonos: telefonos.filter((t) => t.trim()),
        emails: emails.filter((e) => e.trim()),
        direccion: formData.direccion,
        pais: formData.pais,
        observacion: formData.observacion || null,
        status: formData.status,
        imagen_url: imagenUrl,
        documentos_urls: documentosUrls.length > 0 ? documentosUrls : null,
        fecha_creado: new Date().toISOString(),
        fecha_editado: new Date().toISOString(),
        creado_por: user?.nombre || "Usuario Sistema",
        editado_por: user?.nombre || "Usuario Sistema",
        estado_registro: isAdmin ? "PERMANENTE" : "PROVISIONAL",
      }

      const result = await crearSuplidorAction(suplidorData)

      if (!result.success) {
        alert("Error al registrar el suplidor: " + result.error)
        return
      }

      alert(
        isAdmin
          ? "Suplidor registrado exitosamente"
          : "Suplidor registrado. Los cambios estan pendientes de aprobacion administrativa.",
      )
      router.push("/suplidores")
    } catch (error) {
      alert("Error inesperado al procesar la solicitud")
    } finally {
      setLoading(false)
    }
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
              <h1 className="text-2xl font-bold text-blue-600">Registrar Nuevo Suplidor</h1>
              <p className="text-sm text-gray-500">Agregar suplidor al sistema</p>
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
                <CardTitle className="text-blue-600">Información de la Empresa</CardTitle>
                <CardDescription>Datos principales del suplidor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="razon_social">Razón Social *</Label>
                  <Input
                    id="razon_social"
                    value={formData.razon_social}
                    onChange={(e) => handleInputChange("razon_social", e.target.value)}
                    placeholder="Razón social de la empresa"
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
                  <Select value={formData.pais} onValueChange={(value) => handleInputChange("pais", value)}>
                    <SelectTrigger>
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
                <CardDescription>Datos de contacto del suplidor</CardDescription>
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
                    placeholder="Nombre completo del responsable"
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
                    placeholder="Dirección completa del suplidor"
                    rows={4}
                    required
                  />
                  {errors.direccion && <p className="text-red-500 text-sm">{errors.direccion}</p>}
                </div>

                <div>
                  <Label htmlFor="observacion">Observación</Label>
                  <Textarea
                    id="observacion"
                    value={formData.observacion}
                    onChange={(e) => handleInputChange("observacion", e.target.value)}
                    placeholder="Observaciones adicionales sobre el suplidor"
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
              <CardDescription>Logo del suplidor y documentacion adjunta (opcional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Imagen */}
              <div>
                <Label>Logo o Imagen</Label>
                <p className="text-xs text-gray-500 mb-2">JPG, PNG - Logo representativo del suplidor</p>
                <div className="flex items-start gap-4">
                  {imagePreview && (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="w-32 h-32 object-contain rounded-lg border bg-white p-1" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                        onClick={() => { setSelectedImage(null); setImagePreview(null) }}
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

              {/* Documentos */}
              <div>
                <Label>Documentos Adjuntos</Label>
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
              {loading ? "Guardando..." : "Guardar Suplidor"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegistrarSuplidorPage
