import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireRole, hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - List all users (admin only)
export async function GET(request) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, rol, activo, avatar_url, creado_en')
    .order('creado_en', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - Create user (admin only)
export async function POST(request) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { email, password, nombre, rol = 'asesor' } = body

  if (!email || !password || !nombre) {
    return NextResponse.json({ error: 'Email, contraseña y nombre son requeridos' }, { status: 400 })
  }

  // Check if email exists
  const { data: existing } = await supabase.from('usuarios').select('id').eq('email', email.toLowerCase().trim()).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
  }

  const password_hash = await hashPassword(password)

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .insert({
      email: email.toLowerCase().trim(),
      password_hash,
      nombre,
      rol,
      activo: true
    })
    .select('id, email, nombre, rol, activo, creado_en')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(usuario, { status: 201 })
}

// PATCH - Update user (admin only)
export async function PATCH(request) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { id, ...updateData } = body

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  // If password is being updated, hash it
  if (updateData.password) {
    updateData.password_hash = await hashPassword(updateData.password)
    delete updateData.password
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(updateData)
    .eq('id', id)
    .select('id, email, nombre, rol, activo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE - Deactivate user (admin only)
export async function DELETE(request) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  // Don't let admin delete themselves
  if (id === auth.session.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
  }

  const { error } = await supabase.from('usuarios').update({ activo: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mensaje: 'Usuario desactivado' })
}
