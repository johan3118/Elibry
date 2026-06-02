import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { UserProvider } from "@/lib/user-context"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Grupo Ellibry - Sistema de Gestión",
  description: "Sistema de gestión empresarial para Grupo Ellibry",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <UserProvider>
          {children}
          <Toaster />
        </UserProvider>
      </body>
    </html>
  )
}
