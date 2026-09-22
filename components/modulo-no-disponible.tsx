import type React from "react"

interface ModuloNoDisponibleProps {
  titulo: string
  children?: React.ReactNode
}

export function ModuloNoDisponible({
  titulo,
  children,
}: ModuloNoDisponibleProps) {
  return (
    <div className="container mx-auto min-h-screen bg-gray-50">
      <div className="flex flex-col items-center justify-center py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{titulo}</h1>
        <p className="text-gray-600 text-lg mb-8">
          Este módulo no está disponible aún y no se están mostrando datos
          reales.
        </p>
        {children}
      </div>
    </div>
  )
}
