import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// GET - Obtener todos los cursos
export async function GET() {
  const { data: cursos, error } = await supabase
    .from('cursos')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(cursos)
}

// POST - Crear nuevo curso
export async function POST(solicitud) {
  const cuerpo = await solicitud.json()

  const datosInsertar = {
    nombre: cuerpo.nombre,
    descripcion: cuerpo.descripcion || null,
    beneficios: cuerpo.beneficios || null,
    duracion: cuerpo.duracion || null,
    nivel: cuerpo.nivel || null,
    imagen_url: cuerpo.imagen_url || null,
    precio: cuerpo.precio ? Number(cuerpo.precio) : null,
    capacidad: cuerpo.capacidad ? Number(cuerpo.capacidad) : null
  }

  const { data: curso, error } = await supabase
    .from('cursos')
    .insert([datosInsertar])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(curso, { status: 201 })
}

// PUT - Actualizar un curso
export async function PUT(solicitud) {
  const cuerpo = await solicitud.json()
  const { id, ...datosActualizacion } = cuerpo

  if (!id) {
    return NextResponse.json({ error: 'Se requiere el ID del curso' }, { status: 400 })
  }

  const { data: curso, error } = await supabase
    .from('cursos')
    .update(datosActualizacion)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(curso)
}

// DELETE - Eliminar un curso
export async function DELETE(solicitud) {
  const { searchParams } = new URL(solicitud.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Se requiere el ID del curso' }, { status: 400 })
  }

  const { error } = await supabase
    .from('cursos')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ mensaje: 'Curso eliminado correctamente' })
}
