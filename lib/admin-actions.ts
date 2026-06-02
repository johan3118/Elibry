import { createClient } from "@/lib/supabase"

interface AccionPendiente {
  tipo_accion: "CREATE" | "UPDATE" | "DELETE"
  modulo: string
  tabla_objetivo: string
  registro_id?: number
  datos_nuevos?: any
  datos_anteriores?: any
  descripcion: string
  usuario_solicitante: string
}

const supabase = createClient()

export async function crearAccionPendiente(
  accion: AccionPendiente,
): Promise<{ success: boolean; error?: string; id?: number }> {
  try {
    const { data, error } = await supabase
      .from("acciones_pendientes")
      .insert([
        {
          tipo_accion: accion.tipo_accion,
          modulo: accion.modulo,
          tabla_objetivo: accion.tabla_objetivo,
          registro_id: accion.registro_id,
          datos_nuevos: accion.datos_nuevos,
          datos_anteriores: accion.datos_anteriores,
          descripcion: accion.descripcion,
          usuario_solicitante: accion.usuario_solicitante,
          estado: "PENDIENTE",
          fecha_solicitud: new Date().toISOString(),
        },
      ])
      .select("id")
      .single()

    if (error) {
      console.error("Error creando acción pendiente:", error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error("Error inesperado:", error)
    return { success: false, error: "Error inesperado al crear la acción pendiente" }
  }
}

// Funciones específicas para cada módulo
export async function crearClientePendiente(
  datosCliente: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  const tipoCliente = datosCliente.tipo_cliente === "EMPRESA" ? "EMPRESA" : "NORMAL"
  const identificador = tipoCliente === "EMPRESA" ? datosCliente.razon_social : datosCliente.nombre_completo

  return crearAccionPendiente({
    tipo_accion: "CREATE",
    modulo: "clientes",
    tabla_objetivo: "clientes",
    datos_nuevos: datosCliente,
    descripcion: `Solicitud de registro de nuevo cliente: ${tipoCliente} - ${identificador}`,
    usuario_solicitante: usuario,
  })
}

export async function actualizarClientePendiente(
  clienteId: number,
  datosNuevos: any,
  datosAnteriores: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  const identificador = datosNuevos.razon_social || datosNuevos.nombre_completo || `ID: ${clienteId}`

  return crearAccionPendiente({
    tipo_accion: "UPDATE",
    modulo: "clientes",
    tabla_objetivo: "clientes",
    registro_id: clienteId,
    datos_nuevos: datosNuevos,
    datos_anteriores: datosAnteriores,
    descripcion: `Solicitud de actualización de cliente: ${identificador}`,
    usuario_solicitante: usuario,
  })
}

export async function eliminarClientePendiente(
  clienteId: number,
  datosCliente: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  const identificador = datosCliente.razon_social || datosCliente.nombre_completo || `ID: ${clienteId}`

  return crearAccionPendiente({
    tipo_accion: "DELETE",
    modulo: "clientes",
    tabla_objetivo: "clientes",
    registro_id: clienteId,
    datos_anteriores: datosCliente,
    descripcion: `Solicitud de eliminación de cliente: ${identificador}`,
    usuario_solicitante: usuario,
  })
}

export async function crearProductoPendiente(
  datosProducto: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  return crearAccionPendiente({
    tipo_accion: "CREATE",
    modulo: "productos",
    tabla_objetivo: "productos",
    datos_nuevos: datosProducto,
    descripcion: `Solicitud de registro de nuevo producto: ${datosProducto.nombre_producto}`,
    usuario_solicitante: usuario,
  })
}

export async function actualizarProductoPendiente(
  productoId: number,
  datosNuevos: any,
  datosAnteriores: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  return crearAccionPendiente({
    tipo_accion: "UPDATE",
    modulo: "productos",
    tabla_objetivo: "productos",
    registro_id: productoId,
    datos_nuevos: datosNuevos,
    datos_anteriores: datosAnteriores,
    descripcion: `Solicitud de actualización de producto: ${datosNuevos.nombre_producto || datosAnteriores.nombre_producto}`,
    usuario_solicitante: usuario,
  })
}

export async function crearReservaPendiente(
  datosReserva: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  return crearAccionPendiente({
    tipo_accion: "CREATE",
    modulo: "reservas",
    tabla_objetivo: "reservas",
    datos_nuevos: datosReserva,
    descripcion: `Solicitud de nueva reserva para cliente ID: ${datosReserva.cliente_id}`,
    usuario_solicitante: usuario,
  })
}

export async function crearPagoPendiente(
  datosPago: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  return crearAccionPendiente({
    tipo_accion: "CREATE",
    modulo: "pagos",
    tabla_objetivo: "pagos",
    datos_nuevos: datosPago,
    descripcion: `Solicitud de registro de pago por $${datosPago.monto}`,
    usuario_solicitante: usuario,
  })
}

export async function crearSuplidorPendiente(
  datosSuplidor: any,
  usuario: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  return crearAccionPendiente({
    tipo_accion: "CREATE",
    modulo: "suplidores",
    tabla_objetivo: "suplidores",
    datos_nuevos: datosSuplidor,
    descripcion: `Solicitud de registro de nuevo suplidor: ${datosSuplidor.razon_social}`,
    usuario_solicitante: usuario,
  })
}
