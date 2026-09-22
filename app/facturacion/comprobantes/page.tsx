import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ModuloNoDisponible } from "@/components/modulo-no-disponible"

export default function ComprobantesDisponiblesPage() {
  return (
    <ModuloNoDisponible titulo="Comprobantes Fiscales Disponibles">
      <Link href="/facturacion/comprobantes/registrar">
        <Button style={{ backgroundColor: "#3399cc" }} className="hover:opacity-90 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Registrar Nuevo Bloque
        </Button>
      </Link>
    </ModuloNoDisponible>
  )
}
