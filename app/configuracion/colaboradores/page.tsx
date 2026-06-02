import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Edit, Trash2, Phone, Mail } from "lucide-react"

export default function ColaboradoresPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Colaboradores</h1>
            <p className="text-gray-600">Gestionar colaboradores y vendedores</p>
          </div>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Colaborador
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Agregar Colaborador</CardTitle>
              <CardDescription>Registrar nuevo colaborador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input id="nombre" placeholder="Nombre del colaborador" />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="email@ejemplo.com" />
              </div>

              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" placeholder="(809) 000-0000" />
              </div>

              <div>
                <Label htmlFor="comision">Comisión (%)</Label>
                <Input id="comision" type="number" step="0.01" placeholder="5.00" />
              </div>

              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <select className="w-full p-2 border rounded-md">
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="REFERIDOR">Referidor</option>
                  <option value="AGENTE">Agente</option>
                </select>
              </div>

              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Colaborador
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Colaboradores</CardTitle>
              <CardDescription>Colaboradores registrados en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">María González</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        maria@ejemplo.com
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        (809) 123-4567
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">Vendedor</Badge>
                      <Badge variant="outline">5% Comisión</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">Carlos Rodríguez</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        carlos@ejemplo.com
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        (809) 987-6543
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">Agente</Badge>
                      <Badge variant="outline">3% Comisión</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
