import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// DELETE - Eliminar una conversación y sus mensajes
export async function DELETE(solicitud) {
  let id = null
  try {
    const cuerpo = await solicitud.json()
    id = cuerpo.id
  } catch (e) {
    const { searchParams } = new URL(solicitud.url)
    id = searchParams.get('id')
  }

  if (!id) {
    return NextResponse.json({ error: 'Se requiere el ID de la conversación' }, { status: 400 })
  }

  try {
    // 1. Borrar mensajes de la conversación
    await supabase.from('mensajes').delete().eq('conversacion_id', id)
    
    // 2. Borrar la conversación
    const { error } = await supabase.from('conversaciones').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ mensaje: 'Conversación eliminada correctamente' })
  } catch (error) {
    console.error('Error eliminando conversación:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
