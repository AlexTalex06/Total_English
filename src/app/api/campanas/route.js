import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET - Obtener todas las campañas
export async function GET() {
  const { data: campanas, error } = await supabase
    .from('campanas')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(campanas)
}

// POST - Crear nueva campaña
export async function POST(solicitud) {
  const cuerpo = await solicitud.json()

  const datosInsertar = {
    nombre: cuerpo.nombre,
    mensaje: cuerpo.mensaje || null,
    estado: cuerpo.estado || 'borrador',
    canal: cuerpo.canal || 'whatsapp',
    imagen_url: cuerpo.imagen_url || null,
    publico_estado: cuerpo.publico_estado || 'Todos',
    publico_curso: cuerpo.publico_curso || 'Todos',
    audiencia_id: cuerpo.audiencia_id || null,
    nombre_plantilla: cuerpo.nombre_plantilla || null
  }

  const { data: campana, error } = await supabase
    .from('campanas')
    .insert([datosInsertar])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(campana, { status: 201 })
}

// PATCH - Actualizar campaña
export async function PATCH(solicitud) {
  const cuerpo = await solicitud.json()
  const { id, ...datosActualizacion } = cuerpo

  if (!id) {
    return NextResponse.json({ error: 'Se requiere el ID de la campaña' }, { status: 400 })
  }

  const { data: campana, error } = await supabase
    .from('campanas')
    .update(datosActualizacion)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(campana)
}

// DELETE - Eliminar una campaña
export async function DELETE(solicitud) {
  try {
    const url = solicitud.nextUrl || new URL(solicitud.url)
    const id = url.searchParams.get('id')

    console.log('🗑️ DELETE campaña - ID recibido:', id, '- URL:', solicitud.url)

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID de la campaña' }, { status: 400 })
    }

    const { error } = await supabase
      .from('campanas')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ Error eliminando campaña:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Campaña eliminada:', id)
    return NextResponse.json({ mensaje: 'Campaña eliminada correctamente' })
  } catch (e) {
    console.error('❌ Error fatal DELETE campaña:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
