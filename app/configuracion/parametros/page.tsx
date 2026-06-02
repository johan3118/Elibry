import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Settings, Save } from "lucide-react"

export default function ParametrosPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Settings className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Parámetros del Sistema</h1>
          <p className="text-gray-600">Configuración general y políticas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración General</CardTitle>
            <CardDescription>Parámetros básicos del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="empresa">Nombre de la Empresa</Label>
              <Input id="empresa" defaultValue="Grupo Ellibry" />
            </div>

            <div>
              <Label htmlFor="rnc">RNC</Label>
              <Input id="rnc" placeholder="000-00000-0" />
            </div>

            <div>
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" placeholder="Dirección de la empresa" />
            </div>

            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" placeholder="(809) 000-0000" />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="info@grupoellibry.com" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Facturación</CardTitle>
            <CardDescription>Parámetros para facturación y documentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="itbis">Tasa ITBIS (%)</Label>
              <Input id="itbis" type="number" defaultValue="18" step="0.01" />
            </div>

            <div>
              <Label htmlFor="moneda">Moneda Principal</Label>
              <select className="w-full p-2 border rounded-md">
                <option value="DOP">DOP - Peso Dominicano</option>
                <option value="USD">USD - Dólar Americano</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="auto-factura" />
              <Label htmlFor="auto-factura">Facturación Automática</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="email-factura" />
              <Label htmlFor="email-factura">Envío Automático por Email</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Reservas</CardTitle>
            <CardDescription>Parámetros para el manejo de reservas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="dias-limite">Días Límite para Pago</Label>
              <Input id="dias-limite" type="number" defaultValue="7" />
            </div>

            <div>
              <Label htmlFor="descuento-max">Descuento Máximo (%)</Label>
              <Input id="descuento-max" type="number" defaultValue="20" step="0.01" />
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="confirmar-reserva" />
              <Label htmlFor="confirmar-reserva">Confirmación Automática</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="notif-vencimiento" />
              <Label htmlFor="notif-vencimiento">Notificar Vencimientos</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Seguridad</CardTitle>
            <CardDescription>Parámetros de seguridad y acceso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="sesion-timeout">Timeout de Sesión (minutos)</Label>
              <Input id="sesion-timeout" type="number" defaultValue="60" />
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="doble-factor" />
              <Label htmlFor="doble-factor">Autenticación de Doble Factor</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="log-auditoria" />
              <Label htmlFor="log-auditoria">Log de Auditoría</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="backup-auto" />
              <Label htmlFor="backup-auto">Backup Automático</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end mt-6">
        <Button className="bg-green-600 hover:bg-green-700">
          <Save className="w-4 h-4 mr-2" />
          Guardar Configuración
        </Button>
      </div>
    </div>
  )
}
