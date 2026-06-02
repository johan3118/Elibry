import { createClient } from "@supabase/supabase-js"

let supabaseServerInstance: ReturnType<typeof createClient> | null = null

function getSupabaseServerClient() {
  if (supabaseServerInstance) {
    return supabaseServerInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && supabaseServiceKey) {
    supabaseServerInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    return supabaseServerInstance
  }

  return null
}

export const supabaseServer = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getSupabaseServerClient()
    if (!client) {
      throw new Error(
        "supabaseServer client not available. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
      )
    }
    return (client as any)[prop]
  },
})
