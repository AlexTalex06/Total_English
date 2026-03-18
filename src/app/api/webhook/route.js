import { NextResponse } from 'next/server'

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

  console.log('❌ Verificación de webhook fallida')
  return NextResponse.json({ error: 'Verificación fallida' }, { status: 403 })
}

// POST - Recibir mensajes de WhatsApp / Instagram / Facebook
export async function POST(solicitud) {
  const cuerpo = await solicitud.json()

  console.log('📩 Mensaje recibido en webhook:', JSON.stringify(cuerpo, null, 2))

  // Identificar el canal del mensaje
  if (cuerpo.object === 'whatsapp_business_account') {
    // Procesar mensajes de WhatsApp
    const entrada = cuerpo.entry?.[0]
    const cambios = entrada?.changes?.[0]
    const valorMensaje = cambios?.value

    if (valorMensaje?.messages) {
      for (const mensaje of valorMensaje.messages) {
        const remitente = mensaje.from
        const tipoMensaje = mensaje.type
        const textoMensaje = tipoMensaje === 'text' ? mensaje.text?.body : ''
        const marcaTiempo = mensaje.timestamp

        console.log(`📱 WhatsApp - De: ${remitente}, Tipo: ${tipoMensaje}, Texto: ${textoMensaje}`)

        // TODO: Aquí se integrará la lógica del chatbot con IA
        // Por ahora, solo registramos el mensaje
        // En la siguiente fase se implementará:
        // 1. Guardar el mensaje en Supabase
        // 2. Procesar con IA
        // 3. Enviar respuesta automática
      }
    }
  } else if (cuerpo.object === 'instagram') {
    // Procesar mensajes de Instagram
    console.log('📸 Mensaje de Instagram recibido')
    // TODO: Implementar procesamiento de Instagram
  } else if (cuerpo.object === 'page') {
    // Procesar mensajes de Facebook Page
    console.log('📘 Mensaje de Facebook Page recibido')
    // TODO: Implementar procesamiento de Facebook
  }

  // Meta requiere respuesta 200 para confirmar recepción
  return NextResponse.json({ estado: 'recibido' }, { status: 200 })
}

// Función auxiliar para enviar mensajes por WhatsApp (preparada para uso futuro)
async function enviarMensajeWhatsApp(numeroDestino, textoMensaje) {
  const token = process.env.META_WHATSAPP_TOKEN
  const idNumeroTelefono = process.env.META_PHONE_NUMBER_ID

  if (!token || !idNumeroTelefono) {
    console.error('❌ Faltan credenciales de Meta WhatsApp')
    return null
  }

  const url = `https://graph.facebook.com/v18.0/${idNumeroTelefono}/messages`

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
  console.log('📤 Respuesta enviada:', datos)
  return datos
}
