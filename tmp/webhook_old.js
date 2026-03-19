import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { consultarAlex } from '@/lib/alexIA'

// GET - Verificaci├│n del webhook de Meta
export async function GET(solicitud) {
  const { searchParams } = new URL(solicitud.url)

  const modo = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const desafio = searchParams.get('hub.challenge')

  const tokenVerificacion = process.env.META_VERIFY_TOKEN

  if (modo === 'subscribe' && token === tokenVerificacion) {
    console.log('Γ£à Webhook verificado correctamente')
    return new Response(desafio, { status: 200 })
  }

  return NextResponse.json({ error: 'Verificaci├│n fallida' }, { status: 403 })
}

// POST - Recibir mensajes de WhatsApp / Instagram / Facebook
export async function POST(solicitud) {
  try {
    const cuerpo = await solicitud.json()
    console.log('≡ƒô⌐ Mensaje recibido en webhook')

    // 1. Identificar el canal (WhatsApp)
    if (cuerpo.object === 'whatsapp_business_account') {
      const entrada = cuerpo.entry?.[0]
      const cambios = entrada?.changes?.[0]
      const valorMensaje = cambios?.value

      if (valorMensaje?.messages && valorMensaje.messages.length > 0) {
        const mensaje = valorMensaje.messages[0]
        const contactoMeta = valorMensaje.contacts?.[0]
        
        const remitenteId = mensaje.from // N├║mero de tel├⌐fono de quien env├¡a
        const nombrePerfil = contactoMeta?.profile?.name || 'Prospecto'
        const tipoMensaje = mensaje.type
        const textoMensaje = tipoMensaje === 'text' ? mensaje.text?.body : ''
        
        // Ignorar estados o mensajes que no son de texto por ahora para simplificar, 
        // aunque el esquema permite audios/im├ígenes.
        if (tipoMensaje !== 'text') {
           return NextResponse.json({ estado: 'ignorado_no_texto' }, { status: 200 })
        }

        console.log(`≡ƒô▒ WhatsApp - De: ${remitenteId} (${nombrePerfil}): ${textoMensaje}`)

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

        // 3. Buscar o Crear Conversaci├│n
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

        // Actualizar la fecha y el ├║ltimo mensaje de la conversaci├│n
        await supabase.from('conversaciones')
          .update({ 
            actualizado_en: new Date().toISOString(),
            ultimo_mensaje: textoMensaje 
          })
          .eq('id', conversacion.id)

        // 5. Verificar si la IA debe responder
        if (conversacion && !conversacion.asignado_a_humano) {
          
          // Obtener historial reciente para dar contexto a la IA (├║ltimos 15 mensajes)
          const { data: historial } = await supabase
            .from('mensajes')
            .select('remitente, contenido')
            .eq('conversacion_id', conversacion.id)
            .order('creado_en', { ascending: false })
            .limit(15)

          // Mapear historial al formato de OpenAI (excluyendo el actual para meterlo nosotros al final)
          const historialOrdenado = (historial || [])
            .filter(m => m.id_mensaje_meta !== mensaje.id) // Filtrar por ID ├║nico de Meta, no por contenido
            .reverse()
            .map(m => ({
              role: m.remitente === 'usuario' ? 'user' : 'assistant',
              content: m.contenido
            }))

          // Forzar la inclusi├│n del mensaje actual al FINAL del historial
          historialOrdenado.push({ role: 'user', content: textoMensaje })

          console.log(`≡ƒñû AlexIA en acci├│n. ID de conversaci├│n: ${conversacion.id}`)
          console.log(`≡ƒÆ¼ Historial preparado para enviar a OpenAI (${historialOrdenado.length} msgs)`)
          
          try {
            let respuestaIA = await consultarAlex(historialOrdenado, nombrePerfil, 'WhatsApp')
            console.log(`Γ£¿ Respuesta de Alex: "${respuestaIA.substring(0, 50)}..."`)
            
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

            console.log(`≡ƒôñ Enviando a Meta: ${tipoEnvio} ${imageUrl || ''}`)
            const metaEnviado = await enviarMensajeWhatsAppAPI(remitenteId, respuestaIA, tipoEnvio, imageUrl)

            if (metaEnviado) {
               console.log('Γ£à Mensaje entregado con ├⌐xito v├¡a Meta')
               await supabase.from('mensajes').insert({
                 conversacion_id: conversacion.id,
                 remitente: 'bot',
                 contenido: respuestaIA
               })
               await supabase.from('conversaciones').update({ ultimo_mensaje: respuestaIA }).eq('id', conversacion.id)
            } else {
               console.error('Γ¥î Meta rechaz├│ el env├¡o del mensaje del bot.')
            }
          } catch (errorAI) {
            console.error('Γ¥î Error cr├¡tico en motor AlexIA:', errorAI)
          }
        } else {
           console.log(`ΓÅ╕∩╕Å IA Desactivada (Asignado a Humano).`)
        }
      }
    }

    return NextResponse.json({ estado: 'procesado' }, { status: 200 })
  } catch (error) {
    console.error('Γ¥î Error en webhook global:', error)
    return NextResponse.json({ error: 'Error interno de servidor' }, { status: 500 })
  }
}

// Funci├│n auxiliar para enviar mensajes (o Im├ígenes + Mensajes) a la API de Meta
async function enviarMensajeWhatsAppAPI(to, text, tipoEnvio = 'text', imageUrl = null) {
  const token = process.env.META_WHATSAPP_TOKEN
  const idNumeroTelefono = process.env.META_PHONE_NUMBER_ID

  // Normalizaci├│n de n├║meros de M├⌐xico (521 -> 52)
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

    // 2. Enviar el texto (siempre se env├¡a)
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
