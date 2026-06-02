import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Rutas públicas que no requieren autenticación
  const publicPaths = ["/login"]

  // Verificar si la ruta actual es pública
  const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  // Si es una ruta pública, permitir acceso
  if (isPublicPath) {
    return NextResponse.next()
  }

  // Para rutas protegidas, el AuthGuard manejará la redirección
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
