import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET - Obtener todas las citas
export async function GET(solicitud) {
  const { searchParams } = new URL(solicitud.url)
  const fecha = searchParams.get('fecha')

  let consulta = supabase
    .from('citas')
    .select('*, prospectos(nombre, correo, telefono)')
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true })

  if (fecha) {
    consulta = consulta.eq('fecha', fecha)
  }

  const { data: citas, error } = await consulta

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(citas)
}

// POST - Crear nueva cita
export async function POST(solicitud) {
  const cuerpo = await solicitud.json()

  const { data: cita, error } = await supabase
    .from('citas')
    .insert([{
      prospecto_id: cuerpo.prospecto_id,
      fecha: cuerpo.fecha,
      hora: cuerpo.hora,
      tipo: cuerpo.tipo,
      estado: cuerpo.estado || 'pendiente',
      notas: cuerpo.notas
    }])
    .select('*, prospectos(nombre, correo, telefono)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(cita, { status: 201 })
}

// PATCH - Actualizar estado de una cita
export async function PATCH(solicitud) {
  const cuerpo = await solicitud.json()
  const { id, ...datosActualizacion } = cuerpo

  if (!id) {
    return NextResponse.json({ error: 'Se requiere el ID de la cita' }, { status: 400 })
  }

  const { data: cita, error } = await supabase
    .from('citas')
    .update(datosActualizacion)
    .eq('id', id)
    .select('*, prospectos(nombre, correo, telefono)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(cita)
}

// DELETE - Eliminar una cita
export async function DELETE(solicitud) {
  try {
    const url = solicitud.nextUrl || new URL(solicitud.url)
    const id = url.searchParams.get('id')

    console.log('🗑️ DELETE cita - ID recibido:', id)

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID de la cita' }, { status: 400 })
    }

    const { error } = await supabase
      .from('citas')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ Error eliminando cita:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Cita eliminada:', id)
    return NextResponse.json({ mensaje: 'Cita eliminada correctamente' })
  } catch (e) {
    console.error('❌ Error fatal DELETE cita:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
