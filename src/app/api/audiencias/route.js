import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET - Obtener todas las audiencias guardadas
export async function GET() {
  const { data, error } = await supabase
    .from('audiencias')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST - Crear una nueva audiencia
export async function POST(solicitud) {
  try {
    const cuerpo = await solicitud.json()

    if (!cuerpo.nombre || !cuerpo.nombre.trim()) {
      return NextResponse.json({ error: 'El nombre de la audiencia es obligatorio' }, { status: 400 })
    }

    // 1. Guardar la audiencia con sus filtros
    const datosInsertar = {
      nombre: cuerpo.nombre.trim(),
      filtro_estado: cuerpo.filtro_estado || 'Todos',
      filtro_curso: cuerpo.filtro_curso || 'Todos',
      filtro_edad_min: cuerpo.filtro_edad_min ? parseInt(cuerpo.filtro_edad_min) : null,
      filtro_edad_max: cuerpo.filtro_edad_max ? parseInt(cuerpo.filtro_edad_max) : null,
      filtro_flexibilidad: cuerpo.filtro_flexibilidad || 'Indistinto',
      total_estimado: cuerpo.total_estimado || 0
    }

    const { data: audiencia, error } = await supabase
      .from('audiencias')
      .insert([datosInsertar])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(audiencia, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE - Eliminar audiencia
export async function DELETE(solicitud) {
  try {
    const url = solicitud.nextUrl || new URL(solicitud.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID de la audiencia' }, { status: 400 })
    }

    // Verificar que no haya campañas activas/pendientes usando esta audiencia
    const { data: campanasVinculadas } = await supabase
      .from('campanas')
      .select('id, nombre, estado')
      .eq('audiencia_id', id)
      .in('estado', ['pendiente', 'aprobada', 'activa'])

    if (campanasVinculadas && campanasVinculadas.length > 0) {
      return NextResponse.json({ 
        error: `No se puede eliminar: ${campanasVinculadas.length} campaña(s) activa(s) usan esta audiencia` 
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('audiencias')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ mensaje: 'Audiencia eliminada correctamente' })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
