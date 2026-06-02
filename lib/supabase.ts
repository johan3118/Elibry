import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Singleton para el cliente de Supabase
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null

// Función para crear/obtener el cliente de Supabase
function getSupabaseClient() {
  // Only reuse a cached instance — never cache null
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey)
    return supabaseInstance
  }

  return null
}

// Proxy object so that `supabase.from(...)` always resolves lazily
const supabaseProxy = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    const client = getSupabaseClient()
    if (!client) throw new Error("Supabase client no disponible. Verifica NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.")
    return (client as any)[prop]
  },
})

// Función para crear cliente de Supabase - EXPORT NAMED
export const createClient = () => getSupabaseClient()

// Export default del cliente (proxy — always resolves lazily)
export const supabase = supabaseProxy
export default supabaseProxy

// Función para subir archivos (imágenes y documentos) al bucket "documentos"
export const uploadImage = async (file: File, folder: string, _tipoCliente: string): Promise<string> => {
  const client = getSupabaseClient()
  if (!client) throw new Error("Supabase client no disponible al subir archivo.")

  const BUCKET = "documentos"
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const filePath = `${folder}/${Date.now()}_${safeName}`

  const isImage = file.type.startsWith("image/")

  // For images: validate they can be loaded before uploading
  if (isImage) {
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve() }
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("El archivo de imagen no es válido")) }
      img.src = objectUrl
    })
  }

  const { error } = await client.storage.from(BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) throw new Error(`Error al subir archivo: ${error.message}`)

  const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(filePath)
  return publicData.publicUrl
}

// Tipos para las tablas de la base de datos
export interface Cliente {
  id: number
  tipo_cliente: "EMPRESA" | "NORMAL"
  compania: "MARCA 1" | "MARCA 2"

  // Campos para EMPRESA
  rnc?: string
  razon_social?: string
  nombre_comercial?: string
  responsable?: string

  // Campos para NORMAL
  identificacion?: string
  nombre_completo?: string
  sexo?: "FEMENINO" | "MASCULINO" | "OTROS" | "N/A"
  fecha_nacimiento?: string

  // Campos comunes
  telefonos: string
  email: string
  direccion: string
  observacion?: string
  referido_por?: string
  registrado_por: string
  status: "ACTIVO" | "INACTIVO"
  fecha_creado: string
  fecha_editado: string
  editado_por?: string
  imagen_url?: string
}

export interface Suplidor {
  id: number
  razon_social: string
  nombre_comercial: string
  tipo_documento: string
  numero_documento: string
  telefono: string
  email: string
  direccion: string
  contacto_principal: string
  status: string
  registrado_por: string
  fecha_creado: string
  fecha_editado: string
}

export interface Producto {
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
}

export interface ReservaDetalle {
  id: number
  reserva_id: number
  concepto: string
  descripcion?: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  impuestos: number
  total: number
  noches: number
  pasajeros: number
  fecha_creado: string
  fecha_editado: string
  registrado_por: string
  editado_por?: string
}

export interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  cedula_cliente?: string
  producto_id: number
  referido_por?: string
  atendido_por: string
  fecha_entrada?: string
  fecha_salida?: string
  hora_entrada?: string
  hora_salida?: string
  pasajeros: number
  habitaciones?: number
  precio_unitario: number
  descuento?: number
  impuestos?: number
  precio_total: number
  moneda?: string
  fecha_limite_pago?: string
  fecha_gastos_proveedor?: string
  metodo_pago?: string
  abonado_contabilidad?: number
  proveedor?: string
  proforma?: string
  comision?: string
  factura_enviada_cliente?: string
  factura_recibida_proveedor?: string
  asientos_bus?: string
  grupo?: string
  nota_interna_reserva?: string
  status: string
  balance_reserva?: number
  balance_general?: number
  balance_abonado?: number
  registrado_por: string
  fecha_creado: string
  fecha_editado: string
  editado_por?: string
  factura_url?: string

  // Datos relacionados
  cliente?: {
    nombre: string
    apellido: string
    telefono?: string
    email?: string
    nombre_completo?: string
    razon_social?: string
    telefonos?: string
  }
  producto?: {
    nombre_producto: string
    tipo?: string
    pais?: string
  }
  detalles?: ReservaDetalle[]
}

export interface Colaborador {
  id: number
  nombre: string
  apellido: string
  tipo: string
  comision?: number
  telefono?: string
  email?: string
  notas?: string
  activo: boolean
  status?: string
  registrado_por?: string
  fecha_creado: string
  fecha_editado?: string
}

export interface TipoProducto {
  id: number
  nombre: string
  descripcion: string
  status: string
  registrado_por: string
  fecha_creado: string
  fecha_editado: string
}
