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

  it("createClient returns null when env vars are unset", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const { createClient } = await import("../lib/supabase")
      expect(createClient()).toBeNull()
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
