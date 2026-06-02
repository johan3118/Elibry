import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react"

export default function ReportesPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <BarChart3 className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600">Análisis y estadísticas del negocio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.89</div>
            <p className="text-xs text-muted-foreground">+20.1% desde el mes pasado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reservas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2350</div>
            <p className="text-xs text-muted-foreground">+180.1% desde el mes pasado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12,234</div>
            <p className="text-xs text-muted-foreground">+19% desde el mes pasado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">573</div>
            <p className="text-xs text-muted-foreground">+201 desde el mes pasado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reportes Disponibles</CardTitle>
            <CardDescription>Selecciona el tipo de reporte que deseas generar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">• Reporte de Ventas por Período</p>
              <p className="text-sm text-gray-600">• Reporte de Reservas por Cliente</p>
              <p className="text-sm text-gray-600">• Reporte de Productos Más Vendidos</p>
              <p className="text-sm text-gray-600">• Reporte de Comisiones</p>
              <p className="text-sm text-gray-600">• Reporte de Pagos Pendientes</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription>Funcionalidades en desarrollo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">• Dashboard interactivo con gráficos</p>
              <p className="text-sm text-gray-600">• Exportación a PDF y Excel</p>
              <p className="text-sm text-gray-600">• Reportes programados</p>
              <p className="text-sm text-gray-600">• Análisis predictivo</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
