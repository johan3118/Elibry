"use client"

import type * as React from "react"
import {
  Building2,
  Users,
  Calendar,
  DollarSign,
  FileText,
  BarChart3,
  Settings,
  Truck,
  Package,
  ClipboardList,
  Receipt,
  Search,
  UserCheck,
  CreditCard,
  FileSearch,
  Copy,
  Activity,
  Shield,
  TrendingUp,
  UserCog,
  Tags,
  UserPlus,
  Clock,
  Eye,
  Calculator,
  Banknote,
  Plus,
  HeartHandshake,
  ChevronRight,
  Home,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useUser } from "@/lib/user-context"

const menuItems = [
  {
    title: "Inicio",
    icon: Home,
    url: "/",
  },
  {
    title: "Gestión de Clientes",
    icon: Users,
    items: [
      { title: "Ver Clientes", url: "/clientes", icon: Eye },
      { title: "Registrar Cliente", url: "/clientes/registrar", icon: UserPlus },
      { title: "Balance por Cliente", url: "/clientes/balance", icon: Calculator },
      { title: "Balance por Reserva", url: "/clientes/balance-reserva", icon: Banknote },
    ],
  },
  {
    title: "CRM",
    icon: HeartHandshake,
    items: [
      { title: "Dashboard CRM", url: "/crm", icon: BarChart3 },
      { title: "Seguimiento de Casos", url: "/crm/casos", icon: ClipboardList },
    ],
  },
  {
    title: "Gestión de Reservaciones",
    icon: Calendar,
    items: [
      { title: "Crear Reservación", url: "/reservas/crear", icon: Plus },
      { title: "Reservas Pendientes", url: "/reservas/pendientes", icon: Clock },
      { title: "Buscar Reservas", url: "/reservas", icon: Search },
    ],
  },
  {
    title: "Gestión de Pagos",
    icon: DollarSign,
    items: [
      { title: "Registrar Pago", url: "/pagos/registrar", icon: CreditCard },
      { title: "Buscar Pagos", url: "/pagos/buscar", icon: FileSearch },
      { title: "Ver Pagos", url: "/pagos", icon: Eye },
    ],
  },
  {
    title: "Facturación",
    icon: FileText,
    items: [
      { title: "Generar Factura", url: "/facturacion", icon: Receipt },
      { title: "Generar Proforma", url: "/facturacion/proforma", icon: Copy },
      { title: "Generar Voucher", url: "/facturacion/voucher", icon: FileText },
      { title: "Facturación Fiscal", url: "/facturacion/fiscal", icon: Calculator },
      { title: "Buscar Documentos", url: "/facturacion/buscar", icon: Search },
    ],
  },
  {
    title: "Gestión de Productos",
    icon: Package,
    items: [
      { title: "Ver Productos", url: "/productos", icon: Eye },
      { title: "Registrar Producto", url: "/productos/registrar", icon: Plus },
    ],
  },
  {
    title: "Gestión de Suplidores",
    icon: Truck,
    items: [
      { title: "Ver Suplidores", url: "/suplidores", icon: Eye },
      { title: "Registrar Suplidor", url: "/suplidores/registrar", icon: Plus },
    ],
  },
  {
    title: "Proyectos",
    icon: Building2,
    items: [
      { title: "Ver Proyectos", url: "/proyectos", icon: Eye },
      { title: "Pagos de Proyectos", url: "/proyectos/pagos", icon: CreditCard },
      { title: "Facturas de Proyectos", url: "/proyectos/facturas", icon: Receipt },
    ],
  },
  {
    title: "Reportes",
    icon: BarChart3,
    items: [
      { title: "Dashboard", url: "/dashboard", icon: TrendingUp },
      { title: "Estadísticas", url: "/reportes", icon: Activity },
    ],
  },
  {
    title: "Configuración",
    icon: Settings,
    items: [
      { title: "General", url: "/configuracion", icon: Settings },
      { title: "Colaboradores", url: "/configuracion/colaboradores", icon: UserCheck },
      { title: "Datos Maestros", url: "/configuracion/maestros", icon: Tags },
    ],
  },
]

const adminItems = [
  {
    title: "Administración",
    icon: Shield,
    items: [
      { title: "Panel Admin", url: "/admin", icon: UserCog },
      { title: "Logs del Sistema", url: "/logs", icon: Activity },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { isAdmin } = useUser()

  const allMenuItems = isAdmin ? [...menuItems, ...adminItems] : menuItems

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#00693C] text-white">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Sistema de Gestión</span>
                  <span className="truncate text-xs">Empresarial</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allMenuItems.map((item) =>
                item.items ? (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={item.items.some((sub) => pathname.startsWith(sub.url))}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                <Link href={subItem.url}>
                                  {subItem.icon && <subItem.icon className="size-4" />}
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                      <Link href={item.url}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
