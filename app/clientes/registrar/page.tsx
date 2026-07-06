"use client"

import type React from "react"

import { crearRegistroProvisional } from "@/lib/provisional-system"
import { useUser } from "@/lib/user-context"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Users, ArrowLeft, Plus, Trash2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase, uploadImage } from "@/lib/supabase"
import { ImageUpload } from "@/components/image-upload"

const COUNTRIES = [
  "Afganistán","Albania","Alemania","Andorra","Angola","Antigua y Barbuda","Arabia Saudita","Argelia","Argentina","Armenia","Australia","Austria","Azerbaiyán","Bahamas","Bangladés","Barbados","Baréin","Bélgica","Belice","Benín","Bielorrusia","Birmania","Bolivia","Bosnia y Herzegovina","Botsuana","Brasil","Brunéi","Bulgaria","Burkina Faso","Burundi","Bután","Cabo Verde","Camboya","Camerún","Canadá","Catar","Chad","Chile","China","Chipre","Colombia","Comoras","Corea del Norte","Corea del Sur","Costa de Marfil","Costa Rica","Croacia","Cuba","Dinamarca","Dominica","Ecuador","Egipto","El Salvador","Emiratos Árabes Unidos","Eritrea","Eslovaquia","Eslovenia","España","Estados Unidos","Estonia","Esuatini","Etiopía","Filipinas","Finlandia","Fiyi","Francia","Gabón","Gambia","Georgia","Ghana","Granada","Grecia","Guatemala","Guinea","Guinea Ecuatorial","Guinea-Bisáu","Guyana","Haití","Honduras","Hungría","India","Indonesia","Irak","Irán","Irlanda","Islandia","Islas Marshall","Islas Salomón","Israel","Italia","Jamaica","Japón","Jordania","Kazajistán","Kenia","Kirguistán","Kiribati","Kuwait","Laos","Lesoto","Letonia","Líbano","Liberia","Libia","Liechtenstein","Lituania","Luxemburgo","Madagascar","Malasia","Malaui","Maldivas","Malí","Malta","Marruecos","Mauricio","Mauritania","México","Micronesia","Moldavia","Mónaco","Mongolia","Montenegro","Mozambique","Namibia","Nauru","Nepal","Nicaragua","Níger","Nigeria","Noruega","Nueva Zelanda","Omán","Países Bajos","Pakistán","Palaos","Panamá","Papúa Nueva Guinea","Paraguay","Perú","Polonia","Portugal","Reino Unido","República Centroafricana","República Checa","República del Congo","República Democrática del Congo","República Dominicana","Ruanda","Rumanía","Rusia","Samoa","San Cristóbal y Nieves","San Marino","San Vicente y las Granadinas","Santa Lucía","Santo Tomé y Príncipe","Senegal","Serbia","Seychelles","Sierra Leona","Singapur","Siria","Somalia","Sri Lanka","Sudáfrica","Sudán","Sudán del Sur","Suecia","Suiza","Surinam","Tailandia","Tanzania","Tayikistán","Timor Oriental","Togo","Tonga","Trinidad y Tobago","Túnez","Turkmenistán","Turquía","Tuvalu","Ucrania","Uganda","Uruguay","Uzbekistán","Vanuatu","Vaticano","Venezuela","Vietnam","Yemen","Yibuti","Zambia","Zimbabue"
]

const ID_TYPES = [
  { value: "CEDULA", label: "Cedula" },
  { value: "RNC", label: "RNC" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "ID_EXTRANJERO", label: "ID Extranjero" },
]

export default function RegistrarClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tipoCliente, setTipoCliente] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [tipoIdentificacion, setTipoIdentificacion] = useState("CEDULA")
  const [tipoIdentificacionEmpresa, setTipoIdentificacionEmpresa] = useState("RNC")
  const [emails, setEmails] = useState<string[]>([""])
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [pais, setPais] = useState("República Dominicana")
  const [formData, setFormData] = useState({
    compania: "",
    // Campos para empresa
    rnc: "",
    razon_social: "",
    nombre_comercial: "",
    responsable: "",
    // Campos para cliente normal
    identificacion: "",
    nombre_completo: "",
    sexo: "",
    fecha_nacimiento: "",
    // Campos comunes
    telefonos: "",
    email: "",
    direccion: "",
    observacion: "",
    referido_por: "",
    status: "ACTIVO",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const companias = ["MARCA 1", "MARCA 2"]
  const sexos = ["FEMENINO", "MASCULINO", "OTROS", "N/A"]

  const { user, isAdmin } = useUser()

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!tipoCliente) {
      newErrors.tipoCliente = "Debe seleccionar el tipo de cliente"
    }

    if (!formData.compania) {
      newErrors.compania = "Debe seleccionar la compañía"
    }

    if (tipoCliente === "EMPRESA") {
      if (!formData.rnc.trim()) {
        newErrors.rnc = "La identificación es obligatoria"
      }
      if (!formData.razon_social.trim()) {
        newErrors.razon_social = "La razón social es obligatoria"
      }
      if (!formData.nombre_comercial.trim()) {
        newErrors.nombre_comercial = "El nombre comercial es obligatorio"
      }
      if (!formData.responsable.trim()) {
        newErrors.responsable = "El responsable es obligatorio"
      }
    } else if (tipoCliente === "NORMAL") {
      if (!formData.identificacion.trim()) {
        newErrors.identificacion = "La identificación es obligatoria"
      }
      if (!formData.nombre_completo.trim()) {
        newErrors.nombre_completo = "El nombre completo es obligatorio"
      }
      if (!formData.sexo) {
        newErrors.sexo = "El sexo es obligatorio"
      }
    }

    if (!formData.telefonos.trim()) {
      newErrors.telefonos = "Los teléfonos son obligatorios"
    }

    const validEmails = emails.filter((e) => e.trim() !== "")
    if (validEmails.length === 0) {
      newErrors.email = "Al menos un email es obligatorio"
    } else {
      for (const email of validEmails) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          newErrors.email = `El formato del email "${email}" no es valido`
          break
        }
      }
    }

    if (!formData.direccion.trim()) {
      newErrors.direccion = "La dirección es obligatoria"
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
      let imagenUrl = null
      let documentosUrls: string[] = []

      // Subir imagen solo si es empresa y se seleccionó una
      if (tipoCliente === "EMPRESA" && selectedImage) {
        try {
          imagenUrl = await uploadImage(selectedImage, "clientes-imagenes", "EMPRESA")
        } catch (error) {
          alert(error instanceof Error ? error.message : "Error al subir la imagen")
          setLoading(false)
          return
        }
      }

      // Subir documentos adjuntos
      if (documentFiles.length > 0) {
        for (const file of documentFiles) {
          try {
            const url = await uploadImage(file, "clientes-documentos", file.name)
            if (url) documentosUrls.push(url)
          } catch (error) {
            console.error("Error subiendo documento:", error)
          }
        }
      }

      const clienteData = {
        tipo_cliente: tipoCliente,
        compania: formData.compania,
        // Campos para empresa
        rnc: tipoCliente === "EMPRESA" ? formData.rnc : null,
        razon_social: tipoCliente === "EMPRESA" ? formData.razon_social : null,
        nombre_comercial: tipoCliente === "EMPRESA" ? formData.nombre_comercial : null,
        responsable: tipoCliente === "EMPRESA" ? formData.responsable : null,
        // Campos para cliente normal
        identificacion: tipoCliente === "NORMAL" ? formData.identificacion : null,
        nombre_completo: tipoCliente === "NORMAL" ? formData.nombre_completo : null,
        sexo: tipoCliente === "NORMAL" ? formData.sexo : null,
        fecha_nacimiento: tipoCliente === "NORMAL" && formData.fecha_nacimiento ? formData.fecha_nacimiento : null,
        // Campos comunes
        telefonos: formData.telefonos,
        email: formData.email,
        direccion: formData.direccion,
        pais: pais,
        observacion: formData.observacion || null,
        referido_por: formData.referido_por || null,
        registrado_por: user?.nombre || "Usuario Sistema",
        status: formData.status,
        imagen_url: imagenUrl,
        documentos_urls: documentosUrls.length > 0 ? documentosUrls : null,
      }

      if (isAdmin) {
        // Si es admin, crear el cliente directamente como permanente
        // Primero obtener el máximo ID actual para generar el siguiente
        const { data: maxIdData } = await supabase
          .from("clientes")
          .select("id")
          .order("id", { ascending: false })
          .limit(1)
        
        const nextId = (maxIdData && maxIdData.length > 0 ? maxIdData[0].id : 0) + 1
        
        const { data, error } = await supabase
          .from("clientes")
          .insert([
            {
              id: nextId,
              ...clienteData,
              estado_registro: "PERMANENTE",
            },
          ])
          .select()

        if (error) {
          console.error("Error guardando cliente:", error)
          alert("Error al guardar el cliente: " + error.message)
          return
        }

        alert("Cliente registrado exitosamente")
        router.push("/clientes")
      } else {
        // Si es usuario normal, crear como provisional
        const result = await crearRegistroProvisional("clientes", clienteData, user?.nombre || "Usuario Sistema")

        if (result.success) {
          alert(
            "Cliente registrado exitosamente. Puede usarlo inmediatamente. Los cambios están pendientes de aprobación administrativa.",
          )
          router.push("/clientes")
        } else {
          alert("Error al registrar el cliente: " + result.error)
        }
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Error inesperado al guardar el cliente")
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

  const formatIdentificacion = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, "")

    // Limit to 11 digits for cedula
    const limitedNumbers = numbers.slice(0, 11)

    // Format as XXX-XXXXXXX-X only if we have enough digits
    if (limitedNumbers.length === 0) {
      return ""
    } else if (limitedNumbers.length <= 3) {
      return limitedNumbers
    } else if (limitedNumbers.length <= 10) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 10)}-${limitedNumbers.slice(10)}`
    }
  }

  const formatRNC = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, "")

    // Limit to 9 digits for RNC
    const limitedNumbers = numbers.slice(0, 9)

    // Format as XXX-XXXXX-X only if we have enough digits
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

  const formatTelefonos = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, "")

    // Split into groups of 10 digits (Dominican phone numbers)
    const phoneNumbers = []
    for (let i = 0; i < numbers.length; i += 10) {
      const phoneGroup = numbers.slice(i, i + 10)
      if (phoneGroup.length === 0) {
        continue
      } else if (phoneGroup.length <= 3) {
        phoneNumbers.push(`(${phoneGroup}`)
      } else if (phoneGroup.length <= 6) {
        phoneNumbers.push(`(${phoneGroup.slice(0, 3)}) ${phoneGroup.slice(3)}`)
      } else if (phoneGroup.length <= 10) {
        phoneNumbers.push(`(${phoneGroup.slice(0, 3)}) ${phoneGroup.slice(3, 6)}-${phoneGroup.slice(6)}`)
      }
    }

    return phoneNumbers.join(", ")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
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
              <h1 className="text-2xl font-bold text-blue-600">Registrar Nuevo Cliente</h1>
              <p className="text-sm text-gray-500">Agregar cliente al sistema</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
          {/* Selección de Tipo de Cliente */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-green-600">Tipo de Cliente</CardTitle>
              <CardDescription>Seleccionar si es empresa o cliente normal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipoCliente">Tipo de Cliente *</Label>
                  <Select value={tipoCliente} onValueChange={setTipoCliente}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPRESA">EMPRESA</SelectItem>
                      <SelectItem value="NORMAL">NORMAL</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.tipoCliente && <p className="text-red-500 text-sm">{errors.tipoCliente}</p>}
                </div>
                <div>
                  <Label htmlFor="compania">Compañía *</Label>
                  <Select value={formData.compania} onValueChange={(value) => handleInputChange("compania", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar marca" />
                    </SelectTrigger>
                    <SelectContent>
                      {companias.map((compania) => (
                        <SelectItem key={compania} value={compania}>
                          {compania}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.compania && <p className="text-red-500 text-sm">{errors.compania}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información Principal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">
                  {tipoCliente === "EMPRESA" ? "Información de la Empresa" : "Información Personal"}
                </CardTitle>
                <CardDescription>
                  {tipoCliente === "EMPRESA" ? "Datos de la empresa" : "Datos personales del cliente"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
  {tipoCliente === "EMPRESA" ? (
  <>
  <div>
  <Label htmlFor="tipoIdentificacionEmpresa">Tipo de Documento *</Label>
  <Select value={tipoIdentificacionEmpresa} onValueChange={setTipoIdentificacionEmpresa}>
  <SelectTrigger>
  <SelectValue />
  </SelectTrigger>
  <SelectContent>
  {ID_TYPES.map((t) => (
  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
  ))}
  </SelectContent>
  </Select>
  </div>
  <div>
  <Label htmlFor="rnc">{ID_TYPES.find((t) => t.value === tipoIdentificacionEmpresa)?.label ?? "Identificacion"} *</Label>
  <Input
  id="rnc"
  value={formData.rnc}
  onChange={(e) => handleInputChange("rnc", e.target.value)}
  placeholder={`Ingrese ${ID_TYPES.find((t) => t.value === tipoIdentificacionEmpresa)?.label ?? "identificacion"}`}
  required
  />
  {errors.rnc && <p className="text-red-500 text-sm">{errors.rnc}</p>}
  </div>
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
                      <Label htmlFor="responsable">Responsable *</Label>
                      <Input
                        id="responsable"
                        value={formData.responsable}
                        onChange={(e) => handleInputChange("responsable", e.target.value)}
                        placeholder="Nombre del responsable"
                        required
                      />
                      {errors.responsable && <p className="text-red-500 text-sm">{errors.responsable}</p>}
                    </div>

                    {/* Logo Upload para Empresas */}
                    <div className="pt-4 border-t">
                      <ImageUpload onImageSelect={setSelectedImage} tipoCliente="EMPRESA" disabled={loading} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="tipoIdentificacion">Tipo de Identificación *</Label>
                      <Select value={tipoIdentificacion} onValueChange={setTipoIdentificacion}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ID_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="identificacion">Identificación *</Label>
                      <Input
                        id="identificacion"
                        value={formData.identificacion}
                        onChange={(e) => {
                          if (tipoIdentificacion === "CEDULA") {
                            const formatted = formatIdentificacion(e.target.value)
                            handleInputChange("identificacion", formatted)
                          } else {
                            handleInputChange("identificacion", e.target.value)
                          }
                        }}
                        placeholder={tipoIdentificacion === "CEDULA" ? "001-1234567-8" : tipoIdentificacion === "PASAPORTE" ? "Numero de pasaporte" : "Numero de identificacion"}
                        maxLength={tipoIdentificacion === "CEDULA" ? 13 : 30}
                        required
                      />
                      {errors.identificacion && <p className="text-red-500 text-sm">{errors.identificacion}</p>}
                    </div>
                    <div>
                      <Label htmlFor="nombre_completo">Nombre Completo *</Label>
                      <Input
                        id="nombre_completo"
                        value={formData.nombre_completo}
                        onChange={(e) => handleInputChange("nombre_completo", e.target.value)}
                        placeholder="Nombre completo del cliente"
                        required
                      />
                      {errors.nombre_completo && <p className="text-red-500 text-sm">{errors.nombre_completo}</p>}
                    </div>
                    <div>
                      <Label htmlFor="sexo">Sexo *</Label>
                      <Select value={formData.sexo} onValueChange={(value) => handleInputChange("sexo", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar sexo" />
                        </SelectTrigger>
                        <SelectContent>
                          {sexos.map((sexo) => (
                            <SelectItem key={sexo} value={sexo}>
                              {sexo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.sexo && <p className="text-red-500 text-sm">{errors.sexo}</p>}
                    </div>
                    <div>
                      <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                      <Input
                        id="fecha_nacimiento"
                        type="date"
                        value={formData.fecha_nacimiento}
                        onChange={(e) => handleInputChange("fecha_nacimiento", e.target.value)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Información de Contacto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Información de Contacto</CardTitle>
                <CardDescription>Datos de contacto y referencias</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="telefonos">Teléfonos *</Label>
                  <Input
                    id="telefonos"
                    value={formData.telefonos}
                    onChange={(e) => {
                      const formatted = formatTelefonos(e.target.value)
                      handleInputChange("telefonos", formatted)
                    }}
                    placeholder="(809) 555-0123, (809) 555-0124"
                    required
                  />
                  {errors.telefonos && <p className="text-red-500 text-sm">{errors.telefonos}</p>}
                </div>

                <div>
                  <Label>Emails *</Label>
                  <div className="space-y-2">
                    {emails.map((email, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            const newEmails = [...emails]
                            newEmails[index] = e.target.value
                            setEmails(newEmails)
                            handleInputChange("email", newEmails.filter(Boolean).join(", "))
                          }}
                          placeholder="cliente@email.com"
                        />
                        {emails.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => {
                            const newEmails = emails.filter((_, i) => i !== index)
                            setEmails(newEmails)
                            handleInputChange("email", newEmails.filter(Boolean).join(", "))
                          }} className="text-red-500 hover:text-red-700 shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setEmails([...emails, ""])} className="text-blue-600">
                      <Plus className="w-3 h-3 mr-1" /> Agregar Email
                    </Button>
                  </div>
                  {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="direccion">Dirección *</Label>
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
                  <Label htmlFor="pais">País</Label>
                  <Select value={pais} onValueChange={setPais}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar país" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Documentos Adjuntos</Label>
                  <p className="text-xs text-gray-500 mb-2">PDF, JPG, PNG - Cedula, contratos, etc.</p>
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
                        <div key={i} className="flex items-center justify-between text-sm p-1 bg-gray-50 rounded">
                          <span className="truncate">{file.name}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDocumentFiles(documentFiles.filter((_, idx) => idx !== i))} className="text-red-500 shrink-0">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="referido_por">Referido Por</Label>
                  <Input
                    id="referido_por"
                    value={formData.referido_por}
                    onChange={(e) => handleInputChange("referido_por", e.target.value)}
                    placeholder="Nombre del colaborador/vendedor"
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado del cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                      <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="observacion">Observación</Label>
                  <Textarea
                    id="observacion"
                    value={formData.observacion}
                    onChange={(e) => handleInputChange("observacion", e.target.value)}
                    placeholder="Observaciones adicionales"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/clientes")}
              disabled={loading}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={!tipoCliente || loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Guardando..." : "Guardar Cliente"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
