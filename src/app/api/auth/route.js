import { NextResponse } from 'next/server'
import { loginUser, verifyToken, createDefaultAdmin } from '@/lib/auth'

// POST - Login
export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    // Create default admin if no users exist
    await createDefaultAdmin()

    const result = await loginUser(email, password)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    const response = NextResponse.json({
      token: result.token,
      usuario: result.usuario,
      permisos: result.permisos
    })

    // Set httpOnly cookie as well
    response.cookies.set('te_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// GET - Verify session
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || ''
      const match = cookieHeader.match(/te_session=([^;]+)/)
      if (!match) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
      }
      const decoded = verifyToken(match[1])
      if (!decoded) {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
      }
      return NextResponse.json({ usuario: decoded })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    return NextResponse.json({ usuario: decoded })
  } catch (error) {
    console.error('Error verificando sesión:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Logout
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('te_session')
  return response
}
