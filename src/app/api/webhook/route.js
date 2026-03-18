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

// POST - Recibir mensajes de WhatsApp / Instagram / Facebook
export async function POST(solicitud) {
  try {
    const cuerpo = await solicitud.json()
    console.log('📩 Mensaje recibido en webhook')

    // 1. Identificar el canal (WhatsApp)
    if (cuerpo.object === 'whatsapp_business_account') {
      const entrada = cuerpo.entry?.[0]
      const cambios = entrada?.changes?.[0]
      const valorMensaje = cambios?.value

      if (valorMensaje?.messages && valorMensaje.messages.length > 0) {
        const mensaje = valorMensaje.messages[0]
        const contactoMeta = valorMensaje.contacts?.[0]
        
        const remitenteId = mensaje.from // Número de teléfono de quien envía
        const nombrePerfil = contactoMeta?.profile?.name || 'Prospecto'
        const tipoMensaje = mensaje.type
        const textoMensaje = tipoMensaje === 'text' ? mensaje.text?.body : ''
        
        // Ignorar estados o mensajes que no son de texto por ahora para simplificar, 
        // aunque el esquema permite audios/imágenes.
        if (tipoMensaje !== 'text') {
           return NextResponse.json({ estado: 'ignorado_no_texto' }, { status: 200 })
        }

        console.log(`📱 WhatsApp - De: ${remitenteId} (${nombrePerfil}): ${textoMensaje}`)

        // 2. Buscar o Crear Prospecto en CRM
        let prospectoId = null
        const { data: prospectoExistente } = await supabase
          .from('prospectos')
          .select('id, nombre')
          .eq('telefono', remitenteId)
          .single()

        if (prospectoExistente) {
          prospectoId = prospectoExistente.id
        } else {
          const { data: nuevoProspecto } = await supabase
            .from('prospectos')
            .insert({ nombre: nombrePerfil, telefono: remitenteId, estado: 'nuevo' })
            .select('id')
            .single()
          if (nuevoProspecto) prospectoId = nuevoProspecto.id
        }

        // 3. Buscar o Crear Conversación
        let conversacion = null
        const { data: convExistente } = await supabase
          .from('conversaciones')
          .select('*')
          .eq('plataforma', 'whatsapp')
          .eq('id_plataforma', remitenteId)
          .single()

        if (convExistente) {
          conversacion = convExistente
        } else {
          const { data: nuevaConv } = await supabase
            .from('conversaciones')
            .insert({ 
              prospecto_id: prospectoId, 
              plataforma: 'whatsapp', 
              id_plataforma: remitenteId 
            })
            .select('*')
            .single()
          conversacion = nuevaConv
        }

        // 4. Guardar el mensaje del usuario en la BD
        await supabase.from('mensajes').insert({
          conversacion_id: conversacion.id,
          remitente: 'usuario',
          contenido: textoMensaje,
          id_mensaje_meta: mensaje.id
        })

        // Actualizar la fecha de la conversación
        await supabase.from('conversaciones')
          .update({ actualizado_en: new Date().toISOString() })
          .eq('id', conversacion.id)

        // 5. Verificar si la IA debe responder
        if (conversacion && !conversacion.asignado_a_humano) {
          
          // Obtener historial reciente para dar contexto a la IA (últimos 15 mensajes)
          const { data: historial } = await supabase
            .from('mensajes')
            .select('remitente, contenido')
            .eq('conversacion_id', conversacion.id)
            .order('creado_en', { ascending: false })
            .limit(15)

          // Invertir para que estén en orden cronológico (de más viejo a nuevo)
          const historialOrdenado = (historial || []).reverse()

          // Consultar a Alex (OpenAI)
          const respuestaIA = await consultarAlex(historialOrdenado, nombrePerfil, 'WhatsApp')

          // Enviar el mensaje a WhatsApp API
          const metaEnviado = await enviarMensajeWhatsApp(remitenteId, respuestaIA)

          // Solo guardamos el mensaje del bot si WhatsApp lo procesó bien (o no logramos validar, pero lo intentamos)
          if (metaEnviado) {
             await supabase.from('mensajes').insert({
              conversacion_id: conversacion.id,
              remitente: 'bot',
              contenido: respuestaIA
            })
          }
        } else {
          console.log(`⏸️ Chat asignado a un humano. La IA ignoró el mensaje de ${remitenteId}.`)
        }
      }
    }

    return NextResponse.json({ estado: 'procesado' }, { status: 200 })
  } catch (error) {
    console.error('❌ Error en webhook global:', error)
    return NextResponse.json({ error: 'Error interno de servidor' }, { status: 500 })
  }
}

// Función auxiliar para enviar mensajes por WhatsApp
async function enviarMensajeWhatsApp(numeroDestino, textoMensaje) {
  const token = process.env.META_WHATSAPP_TOKEN
  const idNumeroTelefono = process.env.META_PHONE_NUMBER_ID

  if (!token || !idNumeroTelefono) {
    console.error('❌ Faltan credenciales de Meta WhatsApp')
    return null
  }

  const url = `https://graph.facebook.com/v18.0/${idNumeroTelefono}/messages`

  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numeroDestino,
        type: 'text',
        text: { body: textoMensaje }
      })
    })

    const datos = await respuesta.json()
    if (datos.error) {
      console.error('❌ Error de Meta API:', datos.error)
      return null
    }
    return datos
  } catch (e) {
    console.error('❌ Fetch error al llamar Meta API:', e)
    return null
  }
}
