import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { consultarAlex } from '@/lib/alexIA'

// GET - Verificación del webhook de Meta
export async function GET(solicitud) {
  const { searchParams } = new URL(solicitud.url)
  const modo = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const desafio = searchParams.get('hub.challenge')
  const tokenVerificacion = process.env.META_VERIFY_TOKEN

  if (modo === 'subscribe' && token === tokenVerificacion) {
    console.log('✅ Webhook verificado correctamente')
    return new Response(desafio, { status: 200 })
  }
  return NextResponse.json({ error: 'Verificación fallida' }, { status: 403 })
}

// POST - Recibir mensajes de WhatsApp
export async function POST(solicitud) {
  try {
    const cuerpo = await solicitud.json()
    console.log('📩 Mensaje recibido en webhook')

    if (cuerpo.object === 'whatsapp_business_account') {
      const entrada = cuerpo.entry?.[0]
      const cambios = entrada?.changes?.[0]
      const valorMensaje = cambios?.value

      if (valorMensaje?.messages && valorMensaje.messages.length > 0) {
        const mensaje = valorMensaje.messages[0]
        const contactoMeta = valorMensaje.contacts?.[0]
        const remitenteId = mensaje.from 
        const nombrePerfil = contactoMeta?.profile?.name || 'Prospecto'
        const textoMensaje = mensaje.type === 'text' ? mensaje.text?.body : ''

        if (mensaje.type !== 'text') return NextResponse.json({ estado: 'ignorado' }, { status: 200 })

        // 1. CRM: Buscar/Crear Prospecto
        const { data: prosExist } = await supabase.from('prospectos').select('id').eq('telefono', remitenteId).maybeSingle()
        let prospectoId = prosExist?.id
        if (!prospectoId) {
          const { data: nuevoP } = await supabase.from('prospectos').insert({ nombre: nombrePerfil, telefono: remitenteId, estado: 'nuevo' }).select('id').single()
          prospectoId = nuevoP?.id
        }

        // 2. Conversación: Buscar/Crear
        const { data: convExist } = await supabase.from('conversaciones').select('*').eq('id_plataforma', remitenteId).maybeSingle()
        let conversacion = convExist
        if (!conversacion) {
          const { data: nuevaC } = await supabase.from('conversaciones').insert({ prospecto_id: prospectoId, plataforma: 'whatsapp', id_plataforma: remitenteId }).select('*').single()
          conversacion = nuevaC
        }

        // 3. Guardar Mensaje del Usuario
        await supabase.from('mensajes').insert({ conversacion_id: conversacion.id, remitente: 'usuario', contenido: textoMensaje, id_mensaje_meta: mensaje.id })
        await supabase.from('conversaciones').update({ actualizado_en: new Date().toISOString(), ultimo_mensaje: textoMensaje }).eq('id', conversacion.id)

        // 4. GENERAR RESPUESTA ALEXIA (Eliminamos bloqueo de humano para restaurar fluidez)
        const { data: historial } = await supabase.from('mensajes').select('remitente, contenido').eq('conversacion_id', conversacion.id).order('creado_en', { ascending: false }).limit(10)
        
        const historialFormat = (historial || []).reverse().map(m => ({
          role: m.remitente === 'usuario' ? 'user' : 'assistant',
          content: m.contenido
        }))

        // Llamada a la IA (Devuelve JSON { respuesta, datos })
        const { respuesta, datos } = await consultarAlex(historialFormat, nombrePerfil, 'WhatsApp')
        
        // 5. Actualizar CRM con datos detectados
        if (datos && Object.keys(datos).length > 0) {
           await supabase.from('prospectos').update(datos).eq('id', prospectoId)
        }

        // 6. Enviar a Meta
        const enviado = await enviarMensajeWhatsAppAPI(remitenteId, respuesta)
        
        if (enviado) {
           await supabase.from('mensajes').insert({ conversacion_id: conversacion.id, remitente: 'bot', contenido: respuesta })
           await supabase.from('conversaciones').update({ ultimo_mensaje: respuesta }).eq('id', conversacion.id)
        }
      }
    }
    return NextResponse.json({ estado: 'procesado' }, { status: 200 })
  } catch (error) {
    console.error('❌ Error Webhook:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

async function enviarMensajeWhatsAppAPI(to, text) {
  const token = process.env.META_WHATSAPP_TOKEN
  const idNumeroTelefono = process.env.META_PHONE_NUMBER_ID
  let normalizedTo = to.startsWith('521') ? '52' + to.substring(3) : to
  const url = `https://graph.facebook.com/v18.0/${idNumeroTelefono}/messages`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizedTo, type: 'text', text: { body: text } })
    })
    return res.ok
  } catch (e) {
    return false
  }
}
