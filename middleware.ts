import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};

export async function middleware(request: NextRequest) {
  // Por ahora, solo redirigir /auth/callback
  // La protección completa de rutas se maneja en el cliente con AuthProvider
  const { pathname } = request.nextUrl;

  if (pathname === "/auth/callback") {
    // El callback de Supabase se maneja en /api/auth/callback
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
