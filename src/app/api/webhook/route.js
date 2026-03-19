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
        const { data: prospectoExistente, error: errPros } = await supabase
          .from('prospectos')
          .select('id, nombre')
          .eq('telefono', remitenteId)
          .maybeSingle()

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
        const { data: convExistente, error: errConv } = await supabase
          .from('conversaciones')
          .select('*')
          .eq('plataforma', 'whatsapp')
          .eq('id_plataforma', remitenteId)
          .maybeSingle()

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

        // Actualizar la fecha y el último mensaje de la conversación
        await supabase.from('conversaciones')
          .update({ 
            actualizado_en: new Date().toISOString(),
            ultimo_mensaje: textoMensaje 
          })
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

          // Mapear historial al formato de OpenAI (excluyendo el actual para meterlo nosotros al final)
          const historialOrdenado = (historial || [])
            .filter(m => m.id_mensaje_meta !== mensaje.id) // Filtrar por ID único de Meta, no por contenido
            .reverse()
            .map(m => ({
              role: m.remitente === 'usuario' ? 'user' : 'assistant',
              content: m.contenido
            }))

          // Forzar la inclusión del mensaje actual al FINAL del historial
          historialOrdenado.push({ role: 'user', content: textoMensaje })

          console.log(`🤖 AlexIA en acción. ID de conversación: ${conversacion.id}`)
          console.log(`💬 Historial preparado para enviar a OpenAI (${historialOrdenado.length} msgs)`)
          
          try {
            let respuestaIA = await consultarAlex(historialOrdenado, nombrePerfil, 'WhatsApp')
            console.log(`✨ Respuesta de Alex: "${respuestaIA.substring(0, 50)}..."`)
            
            let tipoEnvio = 'text'
            let imageUrl = null

            // Parseo de los Secret Tokens
            const originHost = solicitud.headers.get('host')
            const protocolo = originHost?.includes('localhost') ? 'http' : 'https'
            const baseUrl = `${protocolo}://${originHost}`
            
            if (respuestaIA.includes('[IMG:CHILDREN]')) {
               tipoEnvio = 'image'
               imageUrl = `${baseUrl}/cursos/children.jpg`
               respuestaIA = respuestaIA.replace('[IMG:CHILDREN]', '').trim()
            } else if (respuestaIA.includes('[IMG:JUNIORS]')) {
               tipoEnvio = 'image'
               imageUrl = `${baseUrl}/cursos/juniors.jpg`
               respuestaIA = respuestaIA.replace('[IMG:JUNIORS]', '').trim()
            } else if (respuestaIA.includes('[IMG:PRIME]')) {
               tipoEnvio = 'image'
               imageUrl = `${baseUrl}/cursos/prime.jpg`
               respuestaIA = respuestaIA.replace('[IMG:PRIME]', '').trim()
            } else if (respuestaIA.includes('[IMG:MYTIME]')) {
               tipoEnvio = 'image'
               imageUrl = `${baseUrl}/cursos/mytime.jpg`
               respuestaIA = respuestaIA.replace('[IMG:MYTIME]', '').trim()
            }

            console.log(`📤 Enviando a Meta: ${tipoEnvio} ${imageUrl || ''}`)
            const metaEnviado = await enviarMensajeWhatsAppAPI(remitenteId, respuestaIA, tipoEnvio, imageUrl)

            if (metaEnviado) {
               console.log('✅ Mensaje entregado con éxito vía Meta')
               await supabase.from('mensajes').insert({
                 conversacion_id: conversacion.id,
                 remitente: 'bot',
                 contenido: respuestaIA
               })
               await supabase.from('conversaciones').update({ ultimo_mensaje: respuestaIA }).eq('id', conversacion.id)
            } else {
               console.error('❌ Meta rechazó el envío del mensaje del bot.')
            }
          } catch (errorAI) {
            console.error('❌ Error crítico en motor AlexIA:', errorAI)
          }
        } else {
           console.log(`⏸️ IA Desactivada (Asignado a Humano).`)
        }
      }
    }

    return NextResponse.json({ estado: 'procesado' }, { status: 200 })
  } catch (error) {
    console.error('❌ Error en webhook global:', error)
    return NextResponse.json({ error: 'Error interno de servidor' }, { status: 500 })
  }
}

// Función auxiliar para enviar mensajes (o Imágenes + Mensajes) a la API de Meta
async function enviarMensajeWhatsAppAPI(to, text, tipoEnvio = 'text', imageUrl = null) {
  const token = process.env.META_WHATSAPP_TOKEN
  const idNumeroTelefono = process.env.META_PHONE_NUMBER_ID

  // Normalización de números de México (521 -> 52)
  let normalizedTo = to
  if (to.startsWith('521')) {
    normalizedTo = '52' + to.substring(3)
  }

  const url = `https://graph.facebook.com/v18.0/${idNumeroTelefono}/messages`

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  try {
    if (tipoEnvio === 'image' && imageUrl) {
      // 1. Enviar primero la imagen limpia
      const payloadImg = {
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'image',
        image: { link: imageUrl }
      }
      const resImg = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payloadImg) })
      if (!resImg.ok) console.error("Error al enviar imagen de Meta:", await resImg.json())
    }

    // 2. Enviar el texto (siempre se envía)
    const payloadTexto = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'text',
      text: { body: text }
    }
    const respuesta = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payloadTexto) })
    
    if (!respuesta.ok) {
      const datosError = await respuesta.json()
      console.error('Meta API Error:', datosError)
      return false
    }
    return true
  } catch (error) {
    console.error('Error HTTP contactando Meta:', error)
    return false
  }
}
