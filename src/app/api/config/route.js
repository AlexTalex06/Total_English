import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('configuracion_bot')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json(data || {
      nombre_agente: 'Alex',
      temperatura: 0.7,
      agenda_dias: 'Lunes a Sábado',
      agenda_inicio: '09:00',
      agenda_fin: '18:00',
      agenda_brecha: 30
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    
    // Usamos upsert para asegurar que el registro con ID 1 exista
    const { data, error } = await supabase
      .from('configuracion_bot')
      .upsert({
        id: 1,
        ...body,
        actualizado_en: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error en API Config:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
