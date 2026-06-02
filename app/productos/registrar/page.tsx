"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, ArrowLeft, AlertCircle, Upload, Trash2, File } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase, uploadImage } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/user-context"
import { crearProductoProvisional } from "@/lib/provisional-system"
import { obtenerRegistrosCompletos } from "@/lib/provisional-system"

const COUNTRIES = [
  "Afganistán","Albania","Alemania","Andorra","Angola","Antigua y Barbuda","Arabia Saudita","Argelia","Argentina","Armenia","Australia","Austria","Azerbaiyán","Bahamas","Bangladés","Barbados","Baréin","Bélgica","Belice","Benín","Bielorrusia","Birmania","Bolivia","Bosnia y Herzegovina","Botsuana","Brasil","Brunéi","Bulgaria","Burkina Faso","Burundi","Bután","Cabo Verde","Camboya","Camerún","Canadá","Catar","Chad","Chile","China","Chipre","Colombia","Comoras","Corea del Norte","Corea del Sur","Costa de Marfil","Costa Rica","Croacia","Cuba","Dinamarca","Dominica","Ecuador","Egipto","El Salvador","Emiratos Árabes Unidos","Eritrea","Eslovaquia","Eslovenia","España","Estados Unidos","Estonia","Esuatini","Etiopía","Filipinas","Finlandia","Fiyi","Francia","Gabón","Gambia","Georgia","Ghana","Granada","Grecia","Guatemala","Guinea","Guinea Ecuatorial","Guinea-Bisáu","Guyana","Haití","Honduras","Hungría","India","Indonesia","Irak","Irán","Irlanda","Islandia","Islas Marshall","Islas Salomón","Israel","Italia","Jamaica","Japón","Jordania","Kazajistán","Kenia","Kirguistán","Kiribati","Kuwait","Laos","Lesoto","Letonia","Líbano","Liberia","Libia","Liechtenstein","Lituania","Luxemburgo","Madagascar","Malasia","Malaui","Maldivas","Malí","Malta","Marruecos","Mauricio","Mauritania","México","Micronesia","Moldavia","Mónaco","Mongolia","Montenegro","Mozambique","Namibia","Nauru","Nepal","Nicaragua","Níger","Nigeria","Noruega","Nueva Zelanda","Omán","Países Bajos","Pakistán","Palaos","Panamá","Papúa Nueva Guinea","Paraguay","Perú","Polonia","Portugal","Reino Unido","República Centroafricana","República Checa","República del Congo","República Democrática del Congo","República Dominicana","Ruanda","Rumanía","Rusia","Samoa","San Cristóbal y Nieves","San Marino","San Vicente y las Granadinas","Santa Lucía","Santo Tomé y Príncipe","Senegal","Serbia","Seychelles","Sierra Leona","Singapur","Siria","Somalia","Sri Lanka","Sudáfrica","Sudán","Sudán del Sur","Suecia","Suiza","Surinam","Tailandia","Tanzania","Tayikistán","Timor Oriental","Togo","Tonga","Trinidad y Tobago","Túnez","Turkmenistán","Turquía","Tuvalu","Ucrania","Uganda","Uruguay","Uzbekistán","Vanuatu","Venezuela","Vietnam","Yemen","Yibuti","Zambia","Zimbabue",
]

interface FormData {
  nombre_producto: string
  nombre_original: string
  tipo: string
  suplidor_id: string
  contacto_nombre: string
  contacto_telefono1: string
  contacto_telefono2: string
  contacto_email1: string
  contacto_email2: string
  pais: string
  direccion: string
  comentarios: string
  status: string
}

interface Suplidor {
  id: number
  razon_social: string
  status: string
}

export default function RegistrarProductoPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, isAdmin } = useUser()

  const [loading, setLoading] = useState(false)
  const [suplidores, setSuplidores] = useState<Suplidor[]>([])
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [formData, setFormData] = useState<FormData>({
    nombre_producto: "",
    nombre_original: "",
    tipo: "HOTEL",
    suplidor_id: "0",
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

  useEffect(() => {
    cargarSuplidores()
  }, [])

  const cargarSuplidores = async () => {
    try {
      const { data, error } = await obtenerRegistrosCompletos("suplidores")

      if (error) {
        console.error("Error al cargar suplidores:", error)
        return
      }

      const suplidoresActivos = (data || []).filter((s: Suplidor) => s.status === "ACTIVO")
      setSuplidores(suplidoresActivos)
    } catch (error) {
      console.error("Error inesperado al cargar suplidores:", error)
    }
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nombre_producto.trim()) {
      toast({
        title: "Error",
        description: "El nombre del producto es obligatorio",
        variant: "destructive",
      })
      return
    }

    if (!formData.nombre_original.trim()) {
      toast({
        title: "Error",
        description: "El nombre original es obligatorio",
        variant: "destructive",
      })
      return
    }

    if (!formData.contacto_nombre.trim()) {
      toast({
        title: "Error",
        description: "El nombre del contacto es obligatorio",
        variant: "destructive",
      })
      return
    }

    if (!formData.contacto_telefono1.trim()) {
      toast({
        title: "Error",
        description: "Al menos un teléfono de contacto es obligatorio",
        variant: "destructive",
      })
      return
    }

    if (!formData.pais.trim()) {
      toast({
        title: "Error",
        description: "El país es obligatorio",
        variant: "destructive",
      })
      return
    }

    if (!formData.direccion.trim()) {
      toast({
        title: "Error",
        description: "La dirección es obligatoria",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      let imagenUrl = null
      let documentosUrls: string[] = []

      // Subir imagen si existe
      if (selectedImage) {
        try {
          imagenUrl = await uploadImage(selectedImage, "productos-imagenes", selectedImage.name)
        } catch (error) {
          console.error("Error subiendo imagen:", error)
        }
      }

      // Subir documentos adjuntos
      if (documentFiles.length > 0) {
        for (const file of documentFiles) {
          try {
            const url = await uploadImage(file, "productos-documentos", file.name)
            if (url) documentosUrls.push(url)
          } catch (error) {
            console.error("Error subiendo documento:", error)
          }
        }
      }

      let suplidorId = null
      if (formData.suplidor_id && formData.suplidor_id !== "0" && formData.suplidor_id !== "") {
        suplidorId = Number.parseInt(formData.suplidor_id)
      }

      // Construir el campo contactos combinando nombre y datos
      const contactosTexto = `${formData.contacto_nombre.trim()} - Tel: ${formData.contacto_telefono1.trim()}${formData.contacto_telefono2 ? `, ${formData.contacto_telefono2.trim()}` : ""}${formData.contacto_email1 ? ` - Email: ${formData.contacto_email1.trim()}` : ""}${formData.contacto_email2 ? `, ${formData.contacto_email2.trim()}` : ""}`

      // Construir JSONs para telefonos y emails
      const telefonosJson = [formData.contacto_telefono1.trim(), formData.contacto_telefono2?.trim()].filter(Boolean)
      const emailsJson = [formData.contacto_email1?.trim(), formData.contacto_email2?.trim()].filter(Boolean)

      const productoData = {
        codigo: null,
        nombre_producto: formData.nombre_producto.trim(),
        nombre_original: formData.nombre_original.trim(),
        tipo: formData.tipo,
        suplidor_id: suplidorId,
        contactos: contactosTexto,
        telefonos_json: telefonosJson.length > 0 ? telefonosJson : null,
        emails_json: emailsJson.length > 0 ? emailsJson : null,
        pais: formData.pais.trim(),
        direccion: formData.direccion.trim(),
        comentarios: formData.comentarios.trim() || null,
        status: formData.status,
        imagen_url: imagenUrl,
        documentos_urls: documentosUrls.length > 0 ? documentosUrls : null,
      }

      if (isAdmin) {
        // Obtener el siguiente ID disponible
        const { data: maxIdData } = await supabase
          .from("productos")
          .select("id")
          .order("id", { ascending: false })
          .limit(1)
        
        const nextId = (maxIdData && maxIdData.length > 0 ? maxIdData[0].id : 0) + 1

        const { data, error } = await supabase
          .from("productos")
          .insert([
            {
              id: nextId,
              ...productoData,
              estado_registro: "PERMANENTE",
            },
          ])
          .select()

        if (error) {
          console.error("Error al crear producto (admin):", error)
          throw error
        }

        toast({
          title: "Éxito",
          description: "Producto registrado exitosamente",
        })
      } else {
        const result = await crearProductoProvisional(productoData, user?.nombre || "Usuario Sistema")

        if (!result.success) {
          throw new Error(result.error || "Error al crear producto provisional")
        }

        toast({
          title: "Éxito",
          description:
            "Producto registrado como provisional. Estará disponible de inmediato y pendiente de aprobación administrativa.",
        })
      }

      router.push("/productos")
    } catch (error: any) {
      console.error("Error al crear el producto:", error)
      toast({
        title: "Error",
        description: "Error al crear el producto: " + (error.message || "Error desconocido"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              <h1 className="text-2xl font-bold text-blue-600">Registrar Nuevo Producto</h1>
              <p className="text-sm text-gray-500">Registrar un nuevo producto o servicio turístico</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {!isAdmin && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Registro Provisional</p>
                  <p className="text-xs text-blue-700">
                    Este producto estará disponible de inmediato pero quedará como provisional hasta que un
                    administrador lo apruebe.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Información Básica */}
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Información Básica</CardTitle>
                <CardDescription>Datos principales del producto</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tipo">
                      Tipo <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.tipo} onValueChange={(value) => handleInputChange("tipo", value)}>
                      <SelectTrigger id="tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOTEL">Hotel</SelectItem>
                        <SelectItem value="EXCURSION">Excursión</SelectItem>
                        <SelectItem value="TRANSPORTE">Transporte</SelectItem>
                        <SelectItem value="RESTAURANTE">Restaurante</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="nombre_producto">
                      Nombre del Producto <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="nombre_producto"
                      value={formData.nombre_producto}
                      onChange={(e) => handleInputChange("nombre_producto", e.target.value)}
                      placeholder="Nombre del producto"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="nombre_original">
                      Nombre Original <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="nombre_original"
                      value={formData.nombre_original}
                      onChange={(e) => handleInputChange("nombre_original", e.target.value)}
                      placeholder="Nombre original del producto"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="pais">
                      Pais <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.pais} onValueChange={(v) => handleInputChange("pais", v)}>
                      <SelectTrigger id="pais">
                        <SelectValue placeholder="Seleccionar pais" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="suplidor_id">Suplidor (Opcional)</Label>
                    <Select
                      value={formData.suplidor_id}
                      onValueChange={(value) => handleInputChange("suplidor_id", value)}
                    >
                      <SelectTrigger id="suplidor_id">
                        <SelectValue placeholder="Seleccionar suplidor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sin suplidor</SelectItem>
                        {suplidores.map((suplidor) => (
                          <SelectItem key={suplidor.id} value={suplidor.id.toString()}>
                            {suplidor.razon_social}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="direccion">
                      Dirección <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="direccion"
                      value={formData.direccion}
                      onChange={(e) => handleInputChange("direccion", e.target.value)}
                      placeholder="Dirección del producto"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Información de Contacto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Información de Contacto</CardTitle>
                <CardDescription>Datos del contacto principal del producto</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="contacto_nombre">
                    Nombre del Contacto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contacto_nombre"
                    value={formData.contacto_nombre}
                    onChange={(e) => handleInputChange("contacto_nombre", e.target.value)}
                    placeholder="Nombre completo del contacto"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contacto_telefono1">
                      Teléfono 1 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="contacto_telefono1"
                      value={formData.contacto_telefono1}
                      onChange={(e) => handleInputChange("contacto_telefono1", e.target.value)}
                      placeholder="Teléfono principal"
                      required
                    />
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
              </CardContent>
            </Card>

            {/* Imagen y Documentos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-600">Imagen y Documentos</CardTitle>
                <CardDescription>Logo o imagen del producto y documentacion adjunta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Imagen/Logo */}
                <div>
                  <Label>Imagen o Logo (Opcional)</Label>
                  <p className="text-xs text-gray-500 mb-2">JPG, PNG - Imagen representativa del producto</p>
                  <div className="flex items-start gap-4">
                    {imagePreview && (
                      <div className="relative">
                        <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                          onClick={() => {
                            setSelectedImage(null)
                            setImagePreview(null)
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
                        onChange={handleImageChange}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Documentos */}
                <div>
                  <Label>Documentos Adjuntos (Opcional)</Label>
                  <p className="text-xs text-gray-500 mb-2">PDF, JPG, PNG - Contratos, fichas tecnicas, etc.</p>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setDocumentFiles(Array.from(e.target.files))
                      }
                    }}
                  />
                  {documentFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {documentFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
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

            {/* Información Adicional */}
            <Card>
              <CardHeader>
                <CardTitle className="text-purple-600">Informacion Adicional</CardTitle>
                <CardDescription>Detalles y observaciones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="comentarios">Comentarios (Opcional)</Label>
                  <Textarea
                    id="comentarios"
                    value={formData.comentarios}
                    onChange={(e) => handleInputChange("comentarios", e.target.value)}
                    placeholder="Comentarios o notas adicionales"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVO">Activo</SelectItem>
                      <SelectItem value="INACTIVO">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Botones */}
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.push("/productos")} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
                {loading ? "Registrando..." : "Registrar Producto"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
