import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from './supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'total-english-secret-key-2024-innomind'
const TOKEN_EXPIRY = '7d'

// ============ SERVER-SIDE FUNCTIONS ============

export async function loginUser(email, password) {
  const { data: usuario, error } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('activo', true)
    .single()

  if (error || !usuario) {
    return { error: 'Credenciales inválidas' }
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash)
  if (!passwordValida) {
    return { error: 'Credenciales inválidas' }
  }

  // Obtener permisos del rol
  const { data: permisos } = await supabaseAdmin
    .from('permisos')
    .select('*')
    .eq('rol', usuario.rol)

  const token = jwt.sign(
    { 
      id: usuario.id, 
      email: usuario.email, 
      nombre: usuario.nombre, 
      rol: usuario.rol,
      avatar_url: usuario.avatar_url 
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )

  return {
    token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      avatar_url: usuario.avatar_url,
    },
    permisos: permisos || []
  }
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export async function getSessionFromRequest(request) {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    return verifyToken(token)
  }

  // Check cookie
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(/te_session=([^;]+)/)
  if (match) {
    return verifyToken(match[1])
  }

  return null
}

export async function requireAuth(request) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return { error: 'No autorizado', status: 401 }
  }
  return { session }
}

export async function requireRole(request, rolesPermitidos) {
  const { session, error, status } = await requireAuth(request)
  if (error) return { error, status }
  
  if (!rolesPermitidos.includes(session.rol)) {
    return { error: 'Permisos insuficientes', status: 403 }
  }
  return { session }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function createDefaultAdmin() {
  // Check if any user exists
  const { data: existing } = await supabaseAdmin
    .from('usuarios')
    .select('id')
    .limit(1)

  if (existing && existing.length > 0) return null

  const hash = await hashPassword('123456')
  
  const { data: admin, error } = await supabaseAdmin
    .from('usuarios')
    .insert({
      email: 'anapruebastokens@gmail.com',
      password_hash: hash,
      nombre: 'Administrador Total English',
      rol: 'admin',
      activo: true
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating default admin:', error.message)
    return null
  }

  return admin
}
