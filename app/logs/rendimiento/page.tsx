import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingUp, Search, Filter, Download, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function RendimientoPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/logs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <TrendingUp className="w-8 h-8 text-green-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rendimiento</h1>
            <p className="text-gray-600">Métricas de rendimiento del sistema</p>
          </div>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar Métricas
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo de Respuesta</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">245ms</div>
            <p className="text-xs text-muted-foreground">Promedio últimas 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultas DB</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Conectados ahora</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uso de Memoria</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground">Del total disponible</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="metrica">Métrica</Label>
                <select className="w-full p-2 border rounded-md">
                  <option value="">Todas</option>
                  <option value="response_time">Tiempo de Respuesta</option>
                  <option value="db_queries">Consultas DB</option>
                  <option value="memory_usage">Uso de Memoria</option>
                  <option value="cpu_usage">Uso de CPU</option>
                </select>
              </div>

              <div>
                <Label htmlFor="periodo">Período</Label>
                <select className="w-full p-2 border rounded-md">
                  <option value="1h">Última Hora</option>
                  <option value="24h">Últimas 24 Horas</option>
                  <option value="7d">Últimos 7 Días</option>
                  <option value="30d">Últimos 30 Días</option>
                </select>
              </div>

              <div>
                <Label htmlFor="fecha-desde">Fecha Desde</Label>
                <Input id="fecha-desde" type="date" />
              </div>

              <div>
                <Label htmlFor="fecha-hasta">Fecha Hasta</Label>
                <Input id="fecha-hasta" type="date" />
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
              <CardTitle>Métricas de Rendimiento</CardTitle>
              <CardDescription>Gráficos y estadísticas de rendimiento del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Gráficos de rendimiento próximamente</p>
                <p className="text-sm">Las métricas detalladas aparecerán aquí</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
