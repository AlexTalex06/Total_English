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
      
      // 2. Incrementar contador de interacciones en la campaña para métricas reales
      const { data: c } = await supabase.from('campanas').select('interacciones').eq('id', campanaId).single();
      if (c) {
        await supabase.from('campanas').update({ interacciones: (c.interacciones || 0) + 1 }).eq('id', campanaId);
      }

    } catch (e) {
      console.warn('⚠️ Error silencioso al registrar tracking de campaña:', e.message)
    }
  }

  // Redirigir al URL principal de gracias (Destino 1)
  const fallbackUrl = new URL('/gracias', url.origin)
  return NextResponse.redirect(fallbackUrl)
}
