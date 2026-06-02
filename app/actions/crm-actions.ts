"use server"

import { createClient } from "@supabase/supabase-js"

function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function actualizarClienteAction(
  clienteId: number,
  clienteData: Record<string, any>,
) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from("clientes")
      .update(clienteData)
      .eq("id", clienteId)
      .select()

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

export async function actualizarSuplidorAction(
  suplidorId: number,
  suplidorData: Record<string, any>,
) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from("suplidores")
      .update(suplidorData)
      .eq("id", suplidorId)
      .select()
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

export async function crearSuplidorAction(suplidorData: Record<string, any>) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.from("suplidores").insert([suplidorData]).select()
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

export async function crearProductoAction(productoData: Record<string, any>) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.from("productos").insert([productoData]).select()
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

export async function actualizarProductoAction(
  productoId: number,
  productoData: Record<string, any>,
) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from("productos")
      .update(productoData)
      .eq("id", productoId)
      .select()
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

export async function cerrarCasoAction(casoId: number, comentarioCierre?: string) {
  try {
    const supabase = createSupabaseServerClient()
    const fechaCierre = new Date().toISOString().slice(0, 19).replace("T", " ")
    
    const { data, error } = await supabase
      .from("seguimiento_casos")
      .update({
        estado: "CERRADO",
        cerrado_por: "Usuario Actual",
        fecha_cierre: fechaCierre,
        comentario_cierre: comentarioCierre || null,
      })
      .eq("id", casoId)
      .select()
    
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}
