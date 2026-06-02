"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface User {
  id: string
  email: string
  nombre: string
  rol: "ADMIN" | "USER"
}

interface UserContextType {
  user: User | null
  isAdmin: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// Usuarios de prueba
const USERS = [
  {
    id: "1",
    email: "admin@ellibry.com",
    password: "admin123",
    nombre: "Administrador",
    rol: "ADMIN" as const,
  },
  {
    id: "2",
    email: "usuario@ellibry.com",
    password: "user123",
    nombre: "Usuario Sistema",
    rol: "USER" as const,
  },
]

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay una sesión guardada
    const savedUser = localStorage.getItem("ellibry_user")
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error("Error parsing saved user:", error)
        localStorage.removeItem("ellibry_user")
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    const foundUser = USERS.find((u) => u.email === email && u.password === password)

    if (foundUser) {
      const userData = {
        id: foundUser.id,
        email: foundUser.email,
        nombre: foundUser.nombre,
        rol: foundUser.rol,
      }
      setUser(userData)
      localStorage.setItem("ellibry_user", JSON.stringify(userData))
      return true
    }

    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("ellibry_user")
  }

  const isAdmin = user?.rol === "ADMIN"

  return <UserContext.Provider value={{ user, isAdmin, login, logout, loading }}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
