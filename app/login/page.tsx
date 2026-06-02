"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useUser } from "@/lib/user-context"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LogIn, Shield, User } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { login, user, isAdmin } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push("/")
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const success = await login(email, password)
      if (success) {
        router.push("/")
      } else {
        setError("Credenciales incorrectas. Verifica tu email y contraseña.")
      }
    } catch (error) {
      setError("Error inesperado. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (type: "admin" | "user") => {
    if (type === "admin") {
      setEmail("admin@ellibry.com")
      setPassword("admin123")
    } else {
      setEmail("usuario@ellibry.com")
      setPassword("user123")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-blue-600">Grupo Ellibry</CardTitle>
            <CardDescription>Sistema de Gestión Empresarial</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="w-4 h-4 mr-2" />
                {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>

            {/* Credenciales de prueba */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-3 text-center">Credenciales de prueba:</p>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-transparent"
                  onClick={() => fillCredentials("admin")}
                >
                  <Shield className="w-4 h-4 mr-2 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium">Administrador</div>
                    <div className="text-xs text-gray-500">admin@ellibry.com / admin123</div>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-transparent"
                  onClick={() => fillCredentials("user")}
                >
                  <User className="w-4 h-4 mr-2 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium">Usuario</div>
                    <div className="text-xs text-gray-500">usuario@ellibry.com / user123</div>
                  </div>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
