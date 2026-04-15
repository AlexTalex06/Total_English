import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import axios from 'axios'

export const dynamic = 'force-dynamic'

export async function POST(solicitud) {
  try {
    const { id } = await solicitud.json()
    const urlObj = new URL(solicitud.url)
    const domainOrigin = urlObj.origin
    console.log('🚀 Iniciando ejecución de campaña ID:', id)

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID de la campaña' }, { status: 400 })
    }

    // 1. Obtener la campaña
    const { data: campana, error: errCamp } = await supabase
      .from('campanas')
      .select('*')
      .eq('id', id)
      .single()

    if (errCamp || !campana) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    }

    if (!campana.nombre_plantilla && campana.canal === 'whatsapp') {
       return NextResponse.json({ error: 'Falta configurar el "Nombre de Plantilla" de Meta en la campaña' }, { status: 400 })
    }

    // 2. Construir query de prospectos basado en el público objetivo
    let query = supabase.from('prospectos').select('id, telefono, nombre, nombre_alumno, estado, curso_interes')
    
    // Filtrar por Estado
    if (campana.publico_estado && campana.publico_estado !== 'Todos') {
      const dbEstado = campana.publico_estado.toLowerCase().replace(' ', '_')
      query = query.eq('estado', dbEstado)
    }

    // Filtrar por Curso de interés
    if (campana.publico_curso && campana.publico_curso !== 'Todos') {
       // Support 'Todos', specific course names. Since user inputs are weird sometimes, we'll use ilike
       query = query.ilike('curso_interes', `%${campana.publico_curso}%`)
    }

    const { data: prospectos, error: errPros } = await query

    if (errPros) {
      return NextResponse.json({ error: 'Error obteniendo audiencia: ' + errPros.message }, { status: 500 })
    }

    if (!prospectos || prospectos.length === 0) {
      return NextResponse.json({ error: 'La audiencia está vacía. Nadie cumple los filtros.' }, { status: 400 })
    }

    // 3. Ejecutar envío masivo a WhatsApp via Meta API
    const token = process.env.META_WHATSAPP_TOKEN
    const phoneId = process.env.META_PHONE_NUMBER_ID
    const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`

    if (!token || !phoneId) {
      return NextResponse.json({ error: 'Faltan credenciales META_WHATSAPP_TOKEN o META_PHONE_NUMBER_ID' }, { status: 500 })
    }

    const headers = {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    }

    let enviadosExitosos = 0

    // Loop seguro para enviar mensajes
    for (const prospecto of prospectos) {
      if (!prospecto.telefono) continue;

      let to = prospecto.telefono.replace(/\D/g, '') // Solo números

      const baseUrl = process.env.NEXT_PUBLIC_URL || domainOrigin || 'https://total-english-crm.vercel.app'
      const uniqueLink = `${baseUrl}/api/track?p=${prospecto.id}&c=${id}`

      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: { 
          name: campana.nombre_plantilla, 
          language: { code: 'es_MX' },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: prospecto.nombre_alumno || prospecto.nombre || "Estimado/a"
                },
                {
                  type: "text",
                  text: campana.nombre || "nuestro evento"
                },
                {
                  type: "text",
                  text: uniqueLink
                }
              ]
            }
          ]
        }
      }

      try {
        await axios.post(url, payload, headers)
        enviadosExitosos++
      } catch (error) {
         console.warn(`⚠️ Falló envío de campaña a ${to}:`, error.response?.data || error.message)
         // Lógica de fallback para México (521 -> 52)
         if (to.startsWith('521') && to.length === 13) {
            payload.to = to.replace('521', '52')
            try {
              await axios.post(url, payload, headers)
              enviadosExitosos++
            } catch (retryError) {
              console.error(`❌ Falló reintento de campaña a ${payload.to}:`, retryError.response?.data || retryError.message)
            }
         }
      }
      
      // Pequeña pausa para no romper el rate-limit de Meta
      await new Promise(r => setTimeout(r, 200)) 
    }

    // 4. Actualizar estado y métricas de la campaña a Completada
    const { data: campanaActualizada } = await supabase
      .from('campanas')
      .update({
        estado: 'completada',
        alcance: (campana.alcance || 0) + enviadosExitosos
      })
      .eq('id', id)
      .select()
      .single()

    return NextResponse.json({ 
      mensaje: 'Campaña ejecutada satisfactoriamente', 
      alcance_esperado: prospectos.length,
      envios_exitosos: enviadosExitosos,
      campana: campanaActualizada
    })

  } catch (error) {
    console.error('❌ Error general en /api/campanas/ejecutar:', error.message)
    return NextResponse.json({ error: 'Error del servidor: ' + error.message }, { status: 500 })
  }
}
