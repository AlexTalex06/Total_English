import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { conversacion_id } = await req.json()

    if (!conversacion_id) {
      return NextResponse.json({ error: 'Falta conversacion_id' }, { status: 400 })
    }

    // Actualizar todos los mensajes no leídos de esta conversación a leído = true
    const { error } = await supabase
      .from('mensajes')
      .update({ leido: true })
      .eq('conversacion_id', conversacion_id)
      .eq('remitente', 'usuario')
      .eq('leido', false)

    if (error) {
      console.error('Error actualizando mensajes a leídos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error interno API leer mensajes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
