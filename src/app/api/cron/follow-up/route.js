import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import axios from 'axios'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('No autorizado', { status: 401 })
  }

  try {
    // 1. Buscar prospectos que no han tenido actividad en las últimas 24 horas
    // y que están en un estado que permite seguimiento (ej: 'nuevo' o 'agendado' con cita pendiente)
    const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: prospectos, error } = await supabase
      .from('prospectos')
      .select('*, conversaciones(*)')
      .lt('actualizado_en', hace24Horas)
      .is('prospectos_excluidos_seguimiento', null) // Una bandera opcional
      .limit(10)

    if (error) throw error

    let enviados = 0
    for (const pros of prospectos) {
      const conv = pros.conversaciones?.[0]
      if (!conv) continue

      let mensajeSeguimiento = ""
      
      // Lógica de qué mensaje enviar según el estado
      if (pros.estado === 'nuevo' && (!pros.edad || !pros.nivel)) {
        mensajeSeguimiento = `✨ ¡Hola ${pros.nombre_alumno || ''}! ¿Recibiste mi mensaje anterior? Estoy para ayudarte con el mejor curso de inglés. ¿Seguimos?\n\nPor favor dime: ¿Para qué edad buscas? ¿Tienes nivel previo? 🇬🇧 o ¿quieres iniciar de Nivel 1?.`
      } else if (pros.estado === 'agendado' || (pros.lead_score === 'CALIENTE' && !pros.cita_confirmada)) {
        mensajeSeguimiento = `Hola, ${pros.nombre_alumno || ''}. 👋 Me quedé esperando tu confirmación para activar tu clase muestra gratuita, quisiera que no la perdieras.\n\nCuéntame:\n- ¿El presupuesto se sale un poco de lo planeado?\n- ¿Los horarios te preocupan o son complicados?\n- ¿Tienes alguna duda específica que no resolví?\n\n¿Cuál es tu caso? Si me cuentas, puedo revisar el mejor plan para ti.`
      }

      if (mensajeSeguimiento) {
        await enviarMensajeWhatsApp(pros.telefono, mensajeSeguimiento)
        // Actualizar para no volver a enviar pronto
        await supabase.from('prospectos').update({ actualizado_en: new Date().toISOString() }).eq('id', pros.id)
        enviados++
      }
    }

    return NextResponse.json({ success: true, enviados })
  } catch (err) {
    console.error('Error en Cron Follow-up:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

async function enviarMensajeWhatsApp(to, mensaje) {
  const token = process.env.META_WHATSAPP_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID
  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`
  if (!token || !phoneId) return

  try {
    await axios.post(url, {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: mensaje }
    }, { headers: { Authorization: `Bearer ${token}` } })
  } catch (e) {
    console.error("Error enviando seguimiento:", e.message)
  }
}
