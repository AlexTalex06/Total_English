import { NextResponse } from 'next/server'

export async function middleware(request) {
  // Allow public paths
  const publicPaths = ['/login', '/api/auth', '/api/webhook', '/gracias']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isPublicPath) {
    return NextResponse.next()
  }

  // Comprobar token en Cookie (Server-side middleware protection superficial)
  // La validación profunda del token JWT sucede en AuthGuard (Frontend) y los Endpoints con JsonWebToken
  const token = request.cookies.get('te_session')?.value

  if (!token) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado - Sin Token' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
