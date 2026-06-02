"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Package, AlertCircle, Trash2, File } from "lucide-react"
import { actualizarProductoProvisional } from "@/lib/provisional-system"
import { useUser } from "@/lib/user-context"
import { supabase, uploadImage } from "@/lib/supabase"

interface Suplidor {
  id: number
  razon_social: string
  nombre_comercial: string
}

interface Producto {
  id: number
  codigo?: string
  nombre_producto: string
  nombre_original: string
  tipo: string
  suplidor_id?: number
  contactos: string
  pais: string
  direccion: string
  comentarios?: string
  status: string
  registrado_por: string
  fecha_creado: string
  fecha_editado: string
  editado_por?: string
  estado_provisional?: string
  usuario_creacion?: string
}

export default function EditarProductoPage() {
  const router = useRouter()
  const { user, isAdmin } = useUser()
  const [producto, setProducto] = useState<Producto | null>(null)
  const [suplidores, setSuplidores] = useState<Suplidor[]>([])
  const [formData, setFormData] = useState({
    codigo: "",
    nombre_producto: "",
    nombre_original: "",
    tipo: "",
    suplidor_id: "",
    contacto_nombre: "",
    contacto_telefono1: "",
    contacto_telefono2: "",
    contacto_email1: "",
    contacto_email2: "",
    pais: "",
    direccion: "",
    comentarios: "",
    status: "ACTIVO",
  })
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [existingDocUrls, setExistingDocUrls] = useState<string[]>([])

  const paises = [
    "República Dominicana",
    "Estados Unidos",
    "España",
    "Francia",
    "Italia",
    "México",
    "Colombia",
    "Argentina",
    "Brasil",
    "Chile",
    "Perú",
    "Ecuador",
    "Venezuela",
    "Panamá",
    "Costa Rica",
    "Guatemala",
    "Honduras",
    "Nicaragua",
    "El Salvador",
    "Cuba",
    "Jamaica",
    "Haití",
    "Puerto Rico",
    "Canadá",
    "Reino Unido",
    "Alemania",
    "Portugal",
    "Holanda",
    "Bélgica",
    "Suiza",
    "Austria",
    "Grecia",
    "Turquía",
    "Japón",
    "China",
    "India",
    "Australia",
    "Nueva Zelanda",
    "Sudáfrica",
    "Egipto",
    "Marruecos",
    "Túnez",
    "Otros",
  ]

  const tiposProducto = ["HOTEL", "EXCURSION", "TRANSPORTE", "PAQUETE", "OTROS"]

  // Get product ID from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const id = urlParams.get("id")
    if (id) {
      loadProducto(Number.parseInt(id))
    } else {
      router.push("/productos")
    }
  }, [])

  // Load suplidores
  useEffect(() => {
    loadSuplidores()
  }, [])

  const loadProducto = async (id: number) => {
    try {
      const { data, error } = await supabase.from("productos").select("*").eq("id", id).single()

      if (error) {
        console.error("Error loading producto:", error)
        alert("Error al cargar el producto")
        router.push("/productos")
        return
      }

      setProducto(data)
      
      // Parsear contactos existentes si existen en formato JSON
      const telefonos = data.telefonos_json || []
      const emails = data.emails_json || []
      
      // Extraer nombre del contacto del campo contactos (formato: "Nombre - Tel: xxx")
      let contactoNombre = ""
      if (data.contactos) {
        const match = data.contactos.match(/^([^-]+)/)
        if (match) {
          contactoNombre = match[1].trim()
        }
      }
      
      setFormData({
        codigo: data.codigo || "",
        nombre_producto: data.nombre_producto || "",
        nombre_original: data.nombre_original || "",
        tipo: data.tipo || "",
        suplidor_id: data.suplidor_id?.toString() || "",
        contacto_nombre: contactoNombre,
        contacto_telefono1: telefonos[0] || "",
        contacto_telefono2: telefonos[1] || "",
        contacto_email1: emails[0] || "",
        contacto_email2: emails[1] || "",
        pais: data.pais || "",
        direccion: data.direccion || "",
        comentarios: data.comentarios || "",
        status: data.status || "ACTIVO",
      })

      // Load existing image and documents
      setExistingImageUrl(data.imagen_url || null)
      setExistingDocUrls(data.documentos_urls || [])
    } catch (error) {
      console.error("Error:", error)
      alert("Error inesperado al cargar el producto")
      router.push("/productos")
    } finally {
      setInitialLoading(false)
    }
  }

  const loadSuplidores = async () => {
    try {
      const { data, error } = await supabase
        .from("suplidores")
        .select("id, razon_social, nombre_comercial")
        .eq("status", "ACTIVO")
        .order("razon_social")

      if (error) {
        console.error("Error loading suplidores:", error)
        return
      }

      setSuplidores(data || [])
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.nombre_producto.trim()) {
      newErrors.nombre_producto = "El nombre del producto es requerido"
    }
    if (!formData.nombre_original.trim()) {
      newErrors.nombre_original = "El nombre original es requerido"
    }
    if (!formData.tipo.trim()) {
      newErrors.tipo = "El tipo es requerido"
    }
    if (!formData.contacto_nombre.trim()) {
      newErrors.contacto_nombre = "El nombre del contacto es requerido"
    }
    if (!formData.contacto_telefono1.trim()) {
      newErrors.contacto_telefono1 = "Al menos un teléfono es requerido"
    }
    if (!formData.pais.trim()) {
      newErrors.pais = "El país es requerido"
    }
    if (!formData.direccion.trim()) {
      newErrors.direccion = "La dirección es requerida"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !producto) {
      return
    }

    setLoading(true)

    try {
      // Upload new image if selected
      let imagenUrl = existingImageUrl
      if (selectedImage) {
        try {
          imagenUrl = await uploadImage(selectedImage, "productos-imagenes", "PRODUCTO")
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error al subir la imagen")
          setLoading(false)
          return
        }
      }

      // Upload new documents and merge with existing
      let nuevosDocUrls: string[] = []
      for (const file of documentFiles) {
        try {
          const url = await uploadImage(file, "productos-documentos", file.name)
          if (url) nuevosDocUrls.push(url)
        } catch (err) {
          console.error("Error subiendo documento:", err)
        }
      }
      const documentosUrls = [...existingDocUrls, ...nuevosDocUrls]

      // Construir el campo contactos combinando nombre y datos
      const contactosTexto = `${formData.contacto_nombre.trim()} - Tel: ${formData.contacto_telefono1.trim()}${formData.contacto_telefono2 ? `, ${formData.contacto_telefono2.trim()}` : ""}${formData.contacto_email1 ? ` - Email: ${formData.contacto_email1.trim()}` : ""}${formData.contacto_email2 ? `, ${formData.contacto_email2.trim()}` : ""}`

      // Construir JSONs para telefonos y emails
      const telefonosJson = [formData.contacto_telefono1.trim(), formData.contacto_telefono2?.trim()].filter(Boolean)
      const emailsJson = [formData.contacto_email1?.trim(), formData.contacto_email2?.trim()].filter(Boolean)

      const productoData = {
        codigo: formData.codigo || null,
        nombre_producto: formData.nombre_producto,
        nombre_original: formData.nombre_original,
        tipo: formData.tipo,
        suplidor_id: formData.suplidor_id ? Number.parseInt(formData.suplidor_id) : null,
        contactos: contactosTexto,
        telefonos_json: telefonosJson.length > 0 ? telefonosJson : null,
        emails_json: emailsJson.length > 0 ? emailsJson : null,
        pais: formData.pais,
        direccion: formData.direccion,
        comentarios: formData.comentarios || null,
        status: formData.status,
        editado_por: user?.nombre || "Usuario Sistema",
        fecha_editado: new Date().toISOString(),
        imagen_url: imagenUrl,
        documentos_urls: documentosUrls.length > 0 ? documentosUrls : null,
      }

      if (isAdmin) {
        // Si es admin, actualizar el producto directamente
        const { data, error } = await supabase
          .from("productos")
          .update({
            ...productoData,
            estado_provisional: "PERMANENTE",
          })
          .eq("id", producto.id)
          .select()

        if (error) {
          console.error("Error actualizando producto:", error)
          alert("Error al actualizar el producto: " + error.message)
          return
        }

        alert("Producto actualizado exitosamente")
        router.push("/productos")
      } else {
        // Si es usuario normal, crear como provisional
        const result = await actualizarProductoProvisional(
          producto.id,
          productoData,
          producto,
          user?.nombre || "Usuario Sistema",
        )

        if (result.success) {
          alert("Solicitud de actualización enviada para aprobación del administrador. Será procesada en breve.")
          router.push("/productos")
        } else {
          alert("Error al enviar la solicitud: " + result.error)
        }
      }
    } catch (error) {
      console.error("Error:", error)
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

    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }))
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando producto...</p>
        </div>
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Producto no encontrado</p>
          <Button onClick={() => router.push("/productos")} className="mt-4 bg-blue-600 hover:bg-blue-700">
            Volver a Productos
          </Button>
        </div>
      </div>
    )
  }

  const esProvisional = producto.estado_provisional !== "PERMANENTE"

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
              <h1 className="text-2xl font-bold text-blue-600">Editar Producto</h1>
              <p className="text-sm text-gray-500">Modificar información del producto</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Indicador de estado provisional */}
        {esProvisional && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-orange-900">Producto en Estado Provisional</p>
                  <p className="text-xs text-orange-700">
                    Este producto fue creado/modificado por {producto.usuario_creacion || producto.registrado_por} y
                    está pendiente de aprobación administrativa.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información Principal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Información Principal</CardTitle>
                <CardDescription>Datos básicos del producto</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="codigo">Código</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => handleInputChange("codigo", e.target.value)}
                    placeholder="Código del producto (opcional)"
                  />
                </div>

                <div>
                  <Label htmlFor="nombre_producto">Nombre del Producto *</Label>
                  <Input
                    id="nombre_producto"
                    value={formData.nombre_producto}
                    onChange={(e) => handleInputChange("nombre_producto", e.target.value)}
                    placeholder="Nombre del producto"
                    required
                  />
                  {errors.nombre_producto && <p className="text-red-500 text-sm">{errors.nombre_producto}</p>}
                </div>

                <div>
                  <Label htmlFor="nombre_original">Nombre Original *</Label>
                  <Input
                    id="nombre_original"
                    value={formData.nombre_original}
                    onChange={(e) => handleInputChange("nombre_original", e.target.value)}
                    placeholder="Nombre original del producto"
                    required
                  />
                  {errors.nombre_original && <p className="text-red-500 text-sm">{errors.nombre_original}</p>}
                </div>

                <div>
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={formData.tipo} onValueChange={(value) => handleInputChange("tipo", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposProducto.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tipo && <p className="text-red-500 text-sm">{errors.tipo}</p>}
                </div>

                <div>
                  <Label htmlFor="suplidor_id">Suplidor</Label>
                  <Select
                    value={formData.suplidor_id}
                    onValueChange={(value) => handleInputChange("suplidor_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar suplidor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sin suplidor</SelectItem>
                      {suplidores.map((suplidor) => (
                        <SelectItem key={suplidor.id} value={suplidor.id.toString()}>
                          {suplidor.razon_social} - {suplidor.nombre_comercial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="pais">País *</Label>
                  <Select value={formData.pais} onValueChange={(value) => handleInputChange("pais", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar país" />
                    </SelectTrigger>
                    <SelectContent>
                      {paises.map((pais) => (
                        <SelectItem key={pais} value={pais}>
                          {pais}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.pais && <p className="text-red-500 text-sm">{errors.pais}</p>}
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                      <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Información de Contacto y Ubicación */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Contacto y Ubicación</CardTitle>
                <CardDescription>Información del contacto principal y dirección</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="contacto_nombre">Nombre del Contacto *</Label>
                  <Input
                    id="contacto_nombre"
                    value={formData.contacto_nombre}
                    onChange={(e) => handleInputChange("contacto_nombre", e.target.value)}
                    placeholder="Nombre completo del contacto"
                    required
                  />
                  {errors.contacto_nombre && <p className="text-red-500 text-sm">{errors.contacto_nombre}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contacto_telefono1">Teléfono 1 *</Label>
                    <Input
                      id="contacto_telefono1"
                      value={formData.contacto_telefono1}
                      onChange={(e) => handleInputChange("contacto_telefono1", e.target.value)}
                      placeholder="Teléfono principal"
                      required
                    />
                    {errors.contacto_telefono1 && <p className="text-red-500 text-sm">{errors.contacto_telefono1}</p>}
                  </div>
                  <div>
                    <Label htmlFor="contacto_telefono2">Teléfono 2 (Opcional)</Label>
                    <Input
                      id="contacto_telefono2"
                      value={formData.contacto_telefono2}
                      onChange={(e) => handleInputChange("contacto_telefono2", e.target.value)}
                      placeholder="Teléfono secundario"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contacto_email1">Email 1 (Opcional)</Label>
                    <Input
                      id="contacto_email1"
                      type="email"
                      value={formData.contacto_email1}
                      onChange={(e) => handleInputChange("contacto_email1", e.target.value)}
                      placeholder="Email principal"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contacto_email2">Email 2 (Opcional)</Label>
                    <Input
                      id="contacto_email2"
                      type="email"
                      value={formData.contacto_email2}
                      onChange={(e) => handleInputChange("contacto_email2", e.target.value)}
                      placeholder="Email secundario"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="direccion">Dirección *</Label>
                  <Textarea
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => handleInputChange("direccion", e.target.value)}
                    placeholder="Dirección completa del producto"
                    rows={4}
                    required
                  />
                  {errors.direccion && <p className="text-red-500 text-sm">{errors.direccion}</p>}
                </div>

                <div>
                  <Label htmlFor="comentarios">Comentarios</Label>
                  <Textarea
                    id="comentarios"
                    value={formData.comentarios}
                    onChange={(e) => handleInputChange("comentarios", e.target.value)}
                    placeholder="Comentarios adicionales sobre el producto"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Imagen y Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-indigo-600">Imagen y Documentos</CardTitle>
              <CardDescription>Logo o imagen del producto y documentacion adjunta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Imagen */}
              <div>
                <Label>Imagen o Logo</Label>
                <p className="text-xs text-gray-500 mb-2">JPG, PNG - Imagen representativa del producto</p>
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
                        onClick={() => {
                          setSelectedImage(null)
                          setImagePreview(null)
                          setExistingImageUrl(null)
                        }}
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
                <p className="text-xs text-gray-500 mb-2">PDF, JPG, PNG - Contratos, fichas tecnicas, etc.</p>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) setDocumentFiles(Array.from(e.target.files))
                  }}
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
              onClick={() => router.push("/productos")}
              disabled={loading}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Guardando..." : "Actualizar Producto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
