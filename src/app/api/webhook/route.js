import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { consultarAlex } from '@/lib/alexIA'
import axios from 'axios'

export async function GET(solicitud) {
  const { searchParams } = new URL(solicitud.url)
  const modo = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const desafio = searchParams.get('hub.challenge')

  if (modo === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new Response(desafio, { status: 200 })
  }
  return NextResponse.json({ error: 'Verificación fallida' }, { status: 403 })
}

export async function POST(solicitud) {
  try {
    const cuerpo = await solicitud.json()

    if (cuerpo.object === 'whatsapp_business_account') {
      const entrada = cuerpo.entry?.[0]
      const cambios = entrada?.changes?.[0]
      const valor = cambios?.value

      if (valor?.messages && valor.messages.length > 0) {
        const mensajeObj = valor.messages[0]
        const contactoMeta = valor.contacts?.[0]
        const remitenteId = mensajeObj.from 
        const nombrePerfil = contactoMeta?.profile?.name || 'Prospecto'
        const texto = mensajeObj.type === 'text' ? mensajeObj.text?.body : ''

        if (mensajeObj.type !== 'text') return NextResponse.json({ estado: 'ignorado' }, { status: 200 })

        // 1. Prospecto: Buscar/Crear
        let { data: prosExist } = await supabase.from('prospectos').select('id').eq('telefono', remitenteId).maybeSingle()
        if (!prosExist) {
          const { data: nuevoP } = await supabase.from('prospectos').insert({ nombre: nombrePerfil, telefono: remitenteId, estado: 'nuevo' }).select('id').single()
          prosExist = nuevoP
        }

        // 2. Conversación: Buscar/Crear
        let { data: convExist } = await supabase.from('conversaciones').select('*').eq('id_plataforma', remitenteId).maybeSingle()
        if (!convExist) {
          const { data: nuevaC } = await supabase.from('conversaciones').insert({ prospecto_id: prosExist.id, plataforma: 'whatsapp', id_plataforma: remitenteId }).select('*').single()
          convExist = nuevaC
        }

        // 3. Guardar Mensaje de Usuario (Evitar duplicados si Meta reintenta)
        const { data: existeMsg } = await supabase.from('mensajes').select('id').eq('id_mensaje_meta', mensajeObj.id).maybeSingle()
        if (existeMsg) return NextResponse.json({ estado: 'ya_procesado' }, { status: 200 })

        await supabase.from('mensajes').insert({ 
            conversacion_id: convExist.id, 
            remitente: 'usuario', 
            contenido: texto, 
            id_mensaje_meta: mensajeObj.id 
        })
        await supabase.from('conversaciones').update({ actualizado_en: new Date().toISOString(), ultimo_mensaje: texto }).eq('id', convExist.id)

        // 4. Consultar AlexIA
        const { data: historialRaw } = await supabase.from('mensajes').select('remitente, contenido').eq('conversacion_id', convExist.id).order('creado_en', { ascending: false }).limit(10)
        
        const historialFormat = (historialRaw || []).reverse().map(m => ({
          role: m.remitente === 'usuario' ? 'user' : 'assistant',
          content: m.contenido
        }))

        const { respuesta, datos } = await consultarAlex(historialFormat, nombrePerfil, 'WhatsApp')
        
        // 5. Actualizar CRM
        if (datos && Object.keys(datos).length > 0) {
           await supabase.from('prospectos').update(datos).eq('id', prosExist.id)
        }

        // 6. Enviar a Meta (CON LÓGICA DE REINTENTO DE MÉXICO 🇲🇽)
        const enviadoCorrectamente = await enviarMensajeWhatsApp(remitenteId, respuesta)
        
        if (enviadoCorrectamente) {
           await supabase.from('mensajes').insert({ conversacion_id: convExist.id, remitente: 'bot', contenido: respuesta })
           await supabase.from('conversaciones').update({ ultimo_mensaje: respuesta }).eq('id', convExist.id)
        }
      }
    }
    return NextResponse.json({ estado: 'procesado' }, { status: 200 })
  } catch (error) {
    console.error('❌ Error Webhook:', error.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

async function enviarMensajeWhatsApp(to, mensaje) {
  const token = process.env.META_WHATSAPP_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID
  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: mensaje },
  }

  const headers = {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  }

  try {
    // Intento 1
    await axios.post(url, payload, headers)
    return true
  } catch (error) {
    console.warn(`⚠️ Error en primer intento para ${to}:`, error.response?.data || error.message)
    
    // LÓGICA DE MÉXICO: Si falla con 521, intentar con 52
    if (to.startsWith('521') && to.length === 13) {
      console.log(`🇲🇽 Intentando reenvío sin el '1' para México...`)
      const toCorregido = to.replace('521', '52')
      payload.to = toCorregido
      try {
        await axios.post(url, payload, headers)
        return true
      } catch (retryError) {
        console.error(`❌ Falló reintento para ${toCorregido}:`, retryError.response?.data || retryError.message)
      }
    }
    return false
  }
}
