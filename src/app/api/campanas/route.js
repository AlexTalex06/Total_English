import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

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

  const { data: campana, error } = await supabase
    .from('campanas')
    .insert([{
      nombre: cuerpo.nombre,
      mensaje: cuerpo.mensaje,
      estado: cuerpo.estado || 'borrador',
      canal: cuerpo.canal || 'whatsapp',
      imagen_url: cuerpo.imagen_url
    }])
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
