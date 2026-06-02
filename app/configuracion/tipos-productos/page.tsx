import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Package, Plus, Edit, Trash2 } from "lucide-react"

export default function TiposProductosPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Package className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tipos de Productos</h1>
            <p className="text-gray-600">Gestionar categorías de productos</p>
          </div>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Tipo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Agregar Tipo</CardTitle>
              <CardDescription>Crear nueva categoría de producto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre del Tipo</Label>
                <Input id="nombre" placeholder="Ej: Hotel, Excursión" />
              </div>

              <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <Input id="descripcion" placeholder="Descripción del tipo" />
              </div>

              <div>
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" placeholder="HTL, EXC, etc." />
              </div>

              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Tipo
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Tipos Existentes</CardTitle>
              <CardDescription>Lista de tipos de productos configurados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Hotel</h3>
                    <p className="text-sm text-gray-500">Servicios de hospedaje</p>
                    <Badge variant="secondary" className="mt-1">
                      HTL
                    </Badge>
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
                  <div>
                    <h3 className="font-medium">Excursión</h3>
                    <p className="text-sm text-gray-500">Tours y actividades</p>
                    <Badge variant="secondary" className="mt-1">
                      EXC
                    </Badge>
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
                  <div>
                    <h3 className="font-medium">Transporte</h3>
                    <p className="text-sm text-gray-500">Servicios de transporte</p>
                    <Badge variant="secondary" className="mt-1">
                      TRP
                    </Badge>
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
