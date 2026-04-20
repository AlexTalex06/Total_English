import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET - Obtener todos los prospectos
export async function GET(solicitud) {
  const { searchParams } = new URL(solicitud.url)
  const estado = searchParams.get('estado')
  const busqueda = searchParams.get('busqueda')

  let consulta = supabase
    .from('prospectos')
    .select('*')
    .order('creado_en', { ascending: false })

  if (estado && estado !== 'todos') {
    consulta = consulta.eq('estado', estado)
  }

  if (busqueda) {
    consulta = consulta.or(`nombre.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`)
  }

  const { data: prospectos, error } = await consulta

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(prospectos)
}

// POST - Crear nuevo prospecto
export async function POST(solicitud) {
  const cuerpo = await solicitud.json()

  const { data: prospecto, error } = await supabase
    .from('prospectos')
    .insert([{
      ...cuerpo,
      estado: cuerpo.estado || 'nuevo'
    }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(prospecto, { status: 201 })
}

// PATCH - Actualizar un prospecto
export async function PATCH(solicitud) {
  const cuerpo = await solicitud.json()
  const { id, ...datosActualizacion } = cuerpo

  if (!id) {
    return NextResponse.json({ error: 'Se requiere el ID del prospecto' }, { status: 400 })
  }

  const { data: prospecto, error } = await supabase
    .from('prospectos')
    .update({ ...datosActualizacion, actualizado_en: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(prospecto)
}

// DELETE - Eliminar un prospecto y sus datos asociados
export async function DELETE(solicitud) {
  const { searchParams } = new URL(solicitud.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Se requiere el ID del prospecto' }, { status: 400 })
  }

  try {
    // 1. Buscar conversaciones del prospecto
    const { data: convs } = await supabase.from('conversaciones').select('id').eq('prospecto_id', id)
    
    if (convs && convs.length > 0) {
      const convIds = convs.map(c => c.id)
      // 2. Borrar mensajes de esas conversaciones
      for (const convId of convIds) {
        await supabase.from('mensajes').delete().eq('conversacion_id', convId)
      }
      // 3. Borrar las conversaciones
      await supabase.from('conversaciones').delete().eq('prospecto_id', id)
    }

    // 4. Borrar citas
    await supabase.from('citas').delete().eq('prospecto_id', id)

    // 5. Borrar eventos del prospecto
    await supabase.from('prospecto_eventos').delete().eq('prospecto_id', id)

    // 6. Finalmente borrar el prospecto
    const { error } = await supabase.from('prospectos').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ mensaje: 'Prospecto y datos asociados eliminados correctamente' })
  } catch (error) {
    console.error('Error eliminando prospecto:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
