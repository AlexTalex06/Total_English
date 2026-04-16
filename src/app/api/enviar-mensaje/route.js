import { NextResponse } from 'next/server'
import axios from 'axios'

export async function POST(solicitud) {
  try {
    const { to, text, plataforma, tipo = 'text', nombrePlantilla = '' } = await solicitud.json()
    
    if (plataforma !== 'whatsapp') {
      return NextResponse.json({ error: 'Plataforma no soportada' }, { status: 400 })
    }

    const token = process.env.META_WHATSAPP_TOKEN
    const phoneId = process.env.META_PHONE_NUMBER_ID
    const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      to: to,
    }

    if (tipo === 'template' && nombrePlantilla) {
      payload.type = 'template'
      payload.template = { name: nombrePlantilla, language: { code: 'es_MX' } }
    } else if (tipo === 'image' && solicitud.url_archivo) {
      payload.type = 'image'
      payload.image = { link: solicitud.url_archivo, caption: text }
    } else {
      payload.type = 'text'
      payload.text = { body: text }
    }

    const headers = {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    }

    try {
      // Intento 1
      const res = await axios.post(url, payload, headers)
      return NextResponse.json({ exito: true, metaResponse: res.data }, { status: 200 })
    } catch (error) {
      console.warn(`⚠️ Falló envío manual inicial a ${to}:`, error.response?.data || error.message)

      // LÓGICA DE MÉXICO: Reintento 521 -> 52
      if (to.startsWith('521') && to.length === 13) {
        const toCorregido = to.replace('521', '52')
        payload.to = toCorregido
        try {
          const resRetry = await axios.post(url, payload, headers)
          return NextResponse.json({ exito: true, metaResponse: resRetry.data, corregido: true }, { status: 200 })
        } catch (retryError) {
          console.error(`❌ Falló también reintento manual a ${toCorregido}:`, retryError.response?.data || retryError.message)
          return NextResponse.json({ error: retryError.response?.data?.error?.message || 'Fallo total en envío manual' }, { status: 400 })
        }
      }
      return NextResponse.json({ error: error.response?.data?.error?.message || 'Error Meta API' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Error al enviar mensaje manual:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
