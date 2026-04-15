import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const url = new URL(request.url)
  const prospectoId = url.searchParams.get('p')
  const campanaId = url.searchParams.get('c')

  if (prospectoId && campanaId) {
    try {
      // 1. Marcar actividad en el prospecto (Para que suba en el orden del inbox)
      await supabase
        .from('prospectos')
        .update({ 
          actualizado_en: new Date().toISOString() 
        })
        .eq('id', prospectoId)

      // Opcional: Podrías insertar en una tabla "logs_campanas" si deseas granularidad
      // await supabase.from('logs_campanas').insert({ prospecto_id: prospectoId, campana_id: campanaId, accion: 'click' })

    } catch (e) {
      console.warn('⚠️ Error silencioso al registrar tracking de campaña:', e.message)
    }
  }

  // Redirigir al URL principal de gracias (Destino 1)
  const fallbackUrl = new URL('/gracias', url.origin)
  return NextResponse.redirect(fallbackUrl)
}
