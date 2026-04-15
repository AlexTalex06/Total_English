import { NextResponse } from 'next/server'
import axios from 'axios'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const token = process.env.META_WHATSAPP_TOKEN
    const accountId = process.env.META_BUSINESS_ACCOUNT_ID

    if (!token || !accountId) {
      return NextResponse.json(
        { error: 'Faltan credenciales META_WHATSAPP_TOKEN o META_BUSINESS_ACCOUNT_ID configuradas en el servidor.' },
        { status: 500 }
      )
    }

    const url = `https://graph.facebook.com/v20.0/${accountId}/message_templates?limit=100`

    const respuesta = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    // Meta devuelve las plantillas en "data"
    // Extraemos campos clave: name, language, status, category, components
    const plantillas = respuesta.data.data.map(t => ({
      id: t.id,
      name: t.name,
      language: t.language,
      status: t.status, // ej. APPROVED, PENDING, REJECTED
      category: t.category,
      components: t.components
    }))

    return NextResponse.json({ plantillas })
  } catch (error) {
    console.error('❌ Error obteniendo plantillas de WhatsApp Cloud API:', error.response?.data || error.message)
    return NextResponse.json(
      { error: 'No se pudieron recuperar las plantillas de Meta.', detalle: error.response?.data || error.message },
      { status: 500 }
    )
  }
}
