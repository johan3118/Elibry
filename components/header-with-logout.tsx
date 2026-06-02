"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@/lib/user-context"
import { LogOut, User, Shield, Home } from "lucide-react"
import { useRouter } from "next/navigation"

export function HeaderWithLogout() {
  const { user, logout, isAdmin } = useUser()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2">
          <User className="w-4 h-4" />
          <span className="hidden md:inline">{user.nombre}</span>
          {isAdmin && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
              Admin
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm text-gray-600">
          <div className="font-medium">{user.nombre}</div>
          <div className="text-xs text-gray-500">{user.email}</div>
          <div className="flex items-center mt-1">
            {isAdmin ? (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                <Shield className="w-3 h-3 mr-1" />
                Administrador
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-800 text-xs">
                <User className="w-3 h-3 mr-1" />
                Usuario
              </Badge>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/dashboard")}>
            <Home className="w-4 h-4 mr-2" />
            Dashboard
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
