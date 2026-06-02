import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Plus, Search } from "lucide-react"

export default function UsuariosPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
            <p className="text-gray-600">Gestionar usuarios del sistema</p>
          </div>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" placeholder="Buscar por nombre" />
              </div>

              <div>
                <Label htmlFor="rol">Rol</Label>
                <select className="w-full p-2 border rounded-md">
                  <option value="">Todos los roles</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="OPERADOR">Operador</option>
                </select>
              </div>

              <div>
                <Label htmlFor="estado">Estado</Label>
                <select className="w-full p-2 border rounded-md">
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </div>

              <Button className="w-full">
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Usuarios</CardTitle>
              <CardDescription>Usuarios registrados en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No hay usuarios registrados</p>
                <p className="text-sm">Crea el primer usuario del sistema</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
