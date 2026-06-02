"use client"

import type React from "react"

import { useUser } from "@/lib/user-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface AuthGuardProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export function AuthGuard({ children, adminOnly = false }: AuthGuardProps) {
  const { user, loading, isAdmin } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login")
        return
      }

      if (adminOnly && !isAdmin) {
        router.push("/dashboard")
        return
      }
    }
  }, [user, loading, isAdmin, adminOnly, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (adminOnly && !isAdmin) {
    return null
  }

  return <>{children}</>
}
