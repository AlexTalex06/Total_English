import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

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
