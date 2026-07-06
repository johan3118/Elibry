// @vitest-environment node
import { describe, it, expect, vi } from "vitest"

describe("supabase client module", () => {
  it("importing lib/supabase.ts does not throw when env vars are absent", async () => {
    // Save original env
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    try {
      // Clear env vars
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      // Dynamic import should not throw
      expect(async () => {
        await import("../lib/supabase")
      }).not.toThrow()
    } finally {
      // Restore env vars
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      if (originalAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
    }
  })

  it("createClient() never returns null — it returns a lazy proxy that throws on actual use when env vars are unset", async () => {
    // NOTE: createClient() used to return `getSupabaseClient()` directly, which
    // could be `null` when env vars were unset. It now always returns the lazy
    // `supabaseProxy` (same object as the default `supabase` export) so that
    // TypeScript callers don't have to null-check every `createClient()` call
    // site. Runtime behavior on missing env vars is preserved: the proxy still
    // throws a clear error, just when a property is actually accessed instead
    // of the caller getting `null` back.
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const { createClient } = await import("../lib/supabase")
      const client = createClient()
      expect(client).not.toBeNull()
      expect(() => client.from("test_table")).toThrow("Supabase client no disponible")
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      if (originalAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
    }
  })

  it("supabase proxy throws error when accessing property without env vars", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const { supabase } = await import("../lib/supabase")
      expect(() => {
        supabase.from("test_table")
      }).toThrow("Supabase client no disponible")
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      if (originalAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
    }
  })

  it("supabase proxy error message mentions env var names", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const { supabase } = await import("../lib/supabase")
      expect(() => {
        supabase.auth
      }).toThrow(/NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY/)
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      if (originalAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
    }
  })

  it("supabase proxy throws when accessing multiple different properties", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const { supabase } = await import("../lib/supabase")
      expect(() => supabase.from("table")).toThrow()
      expect(() => supabase.auth).toThrow()
      expect(() => supabase.storage).toThrow()
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      if (originalAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
    }
  })
})
