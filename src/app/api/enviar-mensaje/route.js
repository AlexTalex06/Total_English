import { NextResponse } from 'next/server'

export async function POST(solicitud) {
  try {
    const { to, text, plataforma, tipo = 'text', nombrePlantilla = '' } = await solicitud.json()
    
    // Por el momento solo implementado WhatsApp
    if (plataforma !== 'whatsapp') {
      return NextResponse.json({ error: 'Plataforma no soportada para envío manual aún' }, { status: 400 })
    }

    const token = process.env.META_WHATSAPP_TOKEN
    const idNumeroTelefono = process.env.META_PHONE_NUMBER_ID

    if (!token || !idNumeroTelefono) {
       return NextResponse.json({ error: 'Credenciales Meta no configuradas (META_WHATSAPP_TOKEN / ID)' }, { status: 500 })
    }

    const url = `https://graph.facebook.com/v18.0/${idNumeroTelefono}/messages`

    let metaPayload = {
      messaging_product: 'whatsapp',
      to: to
    }

    if (tipo === 'template' && nombrePlantilla) {
      metaPayload.type = 'template'
      metaPayload.template = {
        name: nombrePlantilla,
        language: { code: 'es_MX' } // o 'es' dependiendo de la configuración del usuario
      }
    } else {
      metaPayload.type = 'text'
      metaPayload.text = { body: text }
    }

    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metaPayload)
    })

    const datos = await respuesta.json()
    
    if (datos.error) {
       console.error('Meta API Error:', datos.error)
       return NextResponse.json({ error: datos.error.message || 'Error desconocido de Meta' }, { status: 400 })
    }
    
    return NextResponse.json({ exito: true, metaResponse: datos }, { status: 200 })
    
  } catch (error) {
    console.error('Error al enviar mensaje manual:', error)
    return NextResponse.json({ error: 'Error interno del servidor al contactar Meta' }, { status: 500 })
  }
}
