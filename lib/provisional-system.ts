import { createClient } from "@/lib/supabase"

interface CambioProvisional {
  id?: number
  tabla_afectada: string
  registro_id: number
  tipo_cambio: "CREATE" | "UPDATE" | "DELETE"
  datos_anteriores?: any
  datos_nuevos?: any
  usuario_cambio: string
  dependencias?: any[]
  dependientes?: any[]
}

interface CambioProvisionalSimple {
  tabla: string
  registro_id: number
  campo: string
  valor_anterior: any
  valor_nuevo: any
  tipo_operacion: "CREATE" | "UPDATE" | "DELETE"
  usuario_id: string
  supabase: any
}

// Lazy getter — always returns a fresh/valid client
function getSupabase() {
  const client = createClient()
  if (!client) throw new Error("Supabase client no disponible. Verifica las variables de entorno.")
  return client
}

export async function registrarCambioProvisional(
  cambio: CambioProvisional,
): Promise<{ success: boolean; error?: string; id?: number }> {
  try {
    const supabase = getSupabase()
    const cambioData = {
      tabla_afectada: cambio.tabla_afectada,
      registro_id: cambio.registro_id,
      tipo_cambio: cambio.tipo_cambio,
      datos_anteriores: cambio.datos_anteriores,
      datos_nuevos: cambio.datos_nuevos,
      usuario_cambio: cambio.usuario_cambio,
      dependencias: cambio.dependencias || [],
      dependientes: cambio.dependientes || [],
      estado_cambio: "PENDIENTE",
      fecha_cambio: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("cambios_provisionales").insert([cambioData]).select("id").single()

    if (error) {
      console.error("Error registrando cambio provisional:", error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error("Error inesperado:", error)
    return { success: false, error: "Error inesperado al registrar el cambio" }
  }
}

// Función simplificada para crear cambios provisionales
export async function crearCambioProvisional(
  cambio: CambioProvisionalSimple,
): Promise<{ success: boolean; error?: string; id?: number }> {
  try {
    const cambioData = {
      tabla_afectada: cambio.tabla,
      registro_id: cambio.registro_id,
      tipo_cambio: cambio.tipo_operacion,
      datos_anteriores: { [cambio.campo]: cambio.valor_anterior },
      datos_nuevos: { [cambio.campo]: cambio.valor_nuevo },
      usuario_cambio: cambio.usuario_id,
      dependencias: [],
      dependientes: [],
      estado_cambio: "PENDIENTE",
    }

    const { data, error } = await cambio.supabase
      .from("cambios_provisionales")
      .insert([cambioData])
      .select("id")
      .single()

    if (error) {
      console.error("Error registrando cambio provisional:", error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error("Error inesperado:", error)
    return { success: false, error: "Error inesperado al registrar el cambio" }
  }
}

export async function crearRegistroProvisional(
  tabla: string,
  datos: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const supabase = getSupabase()
    // Limpiar y preparar datos
    const datosLimpios = { ...datos }

    // Manejar campos especiales según la tabla
    if (tabla === "productos") {
      // Si suplidor_id es "0" o vacío, convertir a null
      if (datosLimpios.suplidor_id === "0" || datosLimpios.suplidor_id === "" || datosLimpios.suplidor_id === 0) {
        datosLimpios.suplidor_id = null
      } else if (datosLimpios.suplidor_id) {
        // Asegurar que sea un número
        datosLimpios.suplidor_id = Number.parseInt(datosLimpios.suplidor_id)
      }
    }

    if (tabla === "reservas") {
      // Manejar IDs de cliente y producto
      if (datosLimpios.cliente_id === "0" || datosLimpios.cliente_id === "") {
        datosLimpios.cliente_id = null
      }
      if (datosLimpios.producto_id === "0" || datosLimpios.producto_id === "") {
        datosLimpios.producto_id = null
      }
    }

    // Obtener el siguiente ID disponible
    const { data: maxIdData } = await supabase
      .from(tabla)
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
    
    const nextId = (maxIdData && maxIdData.length > 0 ? maxIdData[0].id : 0) + 1

    // Agregar campos de estado provisional
    const datosConEstado = {
      id: nextId,
      ...datosLimpios,
      estado_registro: "PROVISIONAL",
      usuario_creacion: usuario,
      fecha_provisional: new Date().toISOString(),
    }

    // Insertar en la tabla correspondiente
    const { data: registroCreado, error } = await supabase.from(tabla).insert([datosConEstado]).select().single()

    if (error) {
      console.error(`Error creando registro provisional en ${tabla}:`, error)
      return { success: false, error: error.message }
    }

    // Intentar registrar el cambio, pero no fallar si hay error
    try {
      await registrarCambioProvisional({
        tabla_afectada: tabla,
        registro_id: registroCreado.id,
        tipo_cambio: "CREATE",
        datos_nuevos: datosConEstado,
        usuario_cambio: usuario,
      })
    } catch (auditError) {
      console.warn("Error en auditoría, pero registro creado exitosamente:", auditError)
    }

    return { success: true, data: registroCreado }
  } catch (error) {
    console.error("Error inesperado:", error)
    return { success: false, error: "Error inesperado al crear el registro" }
  }
}

export async function actualizarRegistroProvisional(
  tabla: string,
  id: number,
  datosNuevos: any,
  datosAnteriores: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const supabase = getSupabase()
    // Limpiar y preparar datos
    const datosLimpios = { ...datosNuevos }

    // Manejar campos especiales según la tabla
    if (tabla === "productos") {
      if (datosLimpios.suplidor_id === "0" || datosLimpios.suplidor_id === "" || datosLimpios.suplidor_id === 0) {
        datosLimpios.suplidor_id = null
      } else if (datosLimpios.suplidor_id) {
        datosLimpios.suplidor_id = Number.parseInt(datosLimpios.suplidor_id)
      }
    }

    // Agregar campos de estado provisional
    const datosConEstado = {
      ...datosLimpios,
      estado_registro: "MODIFICADO",
      usuario_creacion: usuario,
      fecha_provisional: new Date().toISOString(),
    }

    // Actualizar en la tabla correspondiente
    const { data: registroActualizado, error } = await supabase
      .from(tabla)
      .update(datosConEstado)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error(`Error actualizando registro provisional en ${tabla}:`, error)
      return { success: false, error: error.message }
    }

    // Registrar el cambio
    try {
      await registrarCambioProvisional({
        tabla_afectada: tabla,
        registro_id: id,
        tipo_cambio: "UPDATE",
        datos_anteriores: datosAnteriores,
        datos_nuevos: datosConEstado,
        usuario_cambio: usuario,
      })
    } catch (auditError) {
      console.warn("Error en auditoría, pero actualización exitosa:", auditError)
    }

    return { success: true, data: registroActualizado }
  } catch (error) {
    console.error("Error inesperado:", error)
    return { success: false, error: "Error inesperado al actualizar el registro" }
  }
}

export async function eliminarRegistroProvisional(
  tabla: string,
  id: number,
  datosAnteriores: any,
  usuario: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase()
    // Marcar como eliminado en lugar de borrar físicamente
    const { error } = await supabase
      .from(tabla)
      .update({
        estado_registro: "ELIMINADO",
        usuario_creacion: usuario,
        fecha_provisional: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error(`Error marcando registro como eliminado en ${tabla}:`, error)
      return { success: false, error: error.message }
    }

    // Registrar el cambio
    try {
      await registrarCambioProvisional({
        tabla_afectada: tabla,
        registro_id: id,
        tipo_cambio: "DELETE",
        datos_anteriores: datosAnteriores,
        usuario_cambio: usuario,
      })
    } catch (auditError) {
      console.warn("Error en auditoría, pero eliminación exitosa:", auditError)
    }

    return { success: true }
  } catch (error) {
    console.error("Error inesperado:", error)
    return { success: false, error: "Error inesperado al eliminar el registro" }
  }
}

// Función para obtener todos los registros (permanentes + provisionales) para usuarios normales
export async function obtenerRegistrosCompletos(tabla: string, supabaseClient?: any) {
  const client = supabaseClient || getSupabase()

  try {
    console.log(`🔍 Obteniendo registros completos de tabla: ${tabla}`)

    const { data, error } = await client
      .from(tabla)
      .select("*")
      .neq("estado_registro", "ELIMINADO") // Excluir eliminados
      .order("id", { ascending: true }) // Cambiar a ordenar por ID para mejor consistencia

    if (error) {
      console.error(`❌ Error obteniendo registros de ${tabla}:`, error)
      return { data: [], error }
    }

    console.log(`✅ Registros obtenidos de ${tabla}:`, data?.length || 0)
    if (data && data.length > 0) {
      console.log(`📋 Rango de IDs: ${Math.min(...data.map((r: any) => r.id))} - ${Math.max(...data.map((r: any) => r.id))}`)
    }
    return { data: data || [], error: null }
  } catch (err) {
    console.error(`❌ Error inesperado obteniendo registros de ${tabla}:`, err)
    return { data: [], error: err }
  }
}

// Función para obtener solo registros permanentes para reportes oficiales
export function obtenerRegistrosPermanentes(tabla: string) {
  const supabase = getSupabase()
  return supabase
    .from(tabla)
    .select("*")
    .eq("estado_registro", "PERMANENTE")
    .order("fecha_creado", { ascending: false })
}

// Función para aprobar cambios provisionales
export async function aprobarCambio(
  cambioId: number,
  adminUser: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase()
    // Obtener el cambio
    const { data: cambio, error: cambioError } = await supabase
      .from("cambios_provisionales")
      .select("*")
      .eq("id", cambioId)
      .single()

    if (cambioError || !cambio) {
      return { success: false, error: "Cambio no encontrado" }
    }

    // Marcar el registro como permanente
    const { error: updateError } = await supabase
      .from(cambio.tabla_afectada)
      .update({
        estado_registro: "PERMANENTE",
        usuario_creacion: null,
        fecha_provisional: null,
      })
      .eq("id", cambio.registro_id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Marcar el cambio como aprobado
    const { error: cambioUpdateError } = await supabase
      .from("cambios_provisionales")
      .update({
        estado_cambio: "APROBADO",
        procesado_por: adminUser,
        fecha_procesamiento: new Date().toISOString(),
      })
      .eq("id", cambioId)

    if (cambioUpdateError) {
      return { success: false, error: cambioUpdateError.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Error aprobando cambio:", error)
    return { success: false, error: "Error inesperado al aprobar el cambio" }
  }
}

// Función para rechazar/revertir cambios provisionales
export async function rechazarCambio(
  cambioId: number,
  adminUser: string,
  notas?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase()
    // Obtener el cambio
    const { data: cambio, error: cambioError } = await supabase
      .from("cambios_provisionales")
      .select("*")
      .eq("id", cambioId)
      .single()

    if (cambioError || !cambio) {
      return { success: false, error: "Cambio no encontrado" }
    }

    // Revertir según el tipo de cambio
    if (cambio.tipo_cambio === "CREATE") {
      // Si fue una creación, eliminar el registro
      await supabase.from(cambio.tabla_afectada).delete().eq("id", cambio.registro_id)
    } else if (cambio.tipo_cambio === "UPDATE") {
      // Si fue una actualización, restaurar datos anteriores
      await supabase
        .from(cambio.tabla_afectada)
        .update({
          ...cambio.datos_anteriores,
          estado_registro: "PERMANENTE",
        })
        .eq("id", cambio.registro_id)
    } else if (cambio.tipo_cambio === "DELETE") {
      // Si fue una eliminación, restaurar el registro
      await supabase
        .from(cambio.tabla_afectada)
        .update({
          estado_registro: "PERMANENTE",
          usuario_creacion: null,
          fecha_provisional: null,
        })
        .eq("id", cambio.registro_id)
    }

    // Marcar el cambio como rechazado
    const { error: cambioUpdateError } = await supabase
      .from("cambios_provisionales")
      .update({
        estado_cambio: "RECHAZADO",
        procesado_por: adminUser,
        fecha_procesamiento: new Date().toISOString(),
        notas_admin: notas,
      })
      .eq("id", cambioId)

    if (cambioUpdateError) {
      return { success: false, error: cambioUpdateError.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Error rechazando cambio:", error)
    return { success: false, error: "Error inesperado al rechazar el cambio" }
  }
}

// Funciones específicas para cada módulo
export interface Cliente {
  id: number
  tipo_cliente: string
  compania: string
  rnc?: string
  razon_social?: string
  nombre_comercial?: string
  responsable?: string
  identificacion?: string
  nombre_completo?: string
  sexo?: string
  fecha_nacimiento?: string
  telefonos: string
  email: string
  direccion: string
  observacion?: string
  referido_por?: string
  status: string
  estado_registro?: string
  usuario_creacion?: string
  fecha_creado: string
  imagen_url?: string
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
  estado_provisional?: string
  registrado_por?: string
  fecha_creado: string
  fecha_editado: string
}

export interface Reserva {
  id: number
  codigo: string
  cliente_id: number
  producto_id: number
  fecha_entrada?: string
  fecha_salida?: string
  precio_total: number
  balance_reserva?: number
  status: string
  estado_registro?: string
  usuario_creacion?: string
  fecha_creado: string
}

export interface Pago {
  id: number
  reserva_id: number
  cliente_id: number
  monto: number
  metodo_pago: string
  fecha_pago: string
  estado: string
  estado_registro?: string
  usuario_creacion?: string
  fecha_creado: string
}

export interface Suplidor {
  id: number
  razon_social: string
  nombre_comercial: string
  identificacion: string
  nombre_responsable: string
  telefono_responsable: string
  email: string
  direccion: string
  pais: string
  status: string
  estado_registro?: string
  usuario_creacion?: string
  fecha_creado: string
}

// Funciones de conveniencia para operaciones específicas por módulo
export async function crearProductoProvisional(datos: any, usuario: string) {
  return crearRegistroProvisional("productos", datos, usuario)
}

export async function actualizarProductoProvisional(id: number, datos: any, datosAnteriores: any, usuario: string) {
  return actualizarRegistroProvisional("productos", id, datos, datosAnteriores, usuario)
}

export async function eliminarProductoProvisional(id: number, datosAnteriores: any, usuario: string) {
  return eliminarRegistroProvisional("productos", id, datosAnteriores, usuario)
}

export async function crearReservaProvisional(datos: any, usuario: string) {
  return crearRegistroProvisional("reservas", datos, usuario)
}

export async function actualizarReservaProvisional(id: number, datos: any, datosAnteriores: any, usuario: string) {
  return actualizarRegistroProvisional("reservas", id, datos, datosAnteriores, usuario)
}

export async function eliminarReservaProvisional(id: number, datosAnteriores: any, usuario: string) {
  return eliminarRegistroProvisional("reservas", id, datosAnteriores, usuario)
}

export async function crearPagoProvisional(datos: any, usuario: string) {
  return crearRegistroProvisional("pagos", datos, usuario)
}

export async function actualizarPagoProvisional(id: number, datos: any, datosAnteriores: any, usuario: string) {
  return actualizarRegistroProvisional("pagos", id, datos, datosAnteriores, usuario)
}

export async function eliminarPagoProvisional(id: number, datosAnteriores: any, usuario: string) {
  return eliminarRegistroProvisional("pagos", id, datosAnteriores, usuario)
}

export async function crearSuplidorProvisional(datos: any, usuario: string) {
  return crearRegistroProvisional("suplidores", datos, usuario)
}

export async function actualizarSuplidorProvisional(id: number, datos: any, datosAnteriores: any, usuario: string) {
  return actualizarRegistroProvisional("suplidores", id, datos, datosAnteriores, usuario)
}

export async function eliminarSuplidorProvisional(id: number, datosAnteriores: any, usuario: string) {
  return eliminarRegistroProvisional("suplidores", id, datosAnteriores, usuario)
}
