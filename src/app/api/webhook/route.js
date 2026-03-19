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

        const mensajeInsert = { 
            conversacion_id: convExist.id, 
            remitente: 'usuario', 
            contenido: texto, 
            id_mensaje_meta: mensajeObj.id,
            tipo: mensajeObj.type === 'image' ? 'imagen' : 'texto'
        }
        if (mensajeObj.type === 'image') {
          mensajeInsert.url_archivo = mensajeObj.image?.url || '' // Note: Meta requires a separate GET to fetch the media URL, but for now we store what we have or a placeholder
          mensajeInsert.contenido = mensajeObj.image?.caption || 'Imagen recibida'
        }
        await supabase.from('mensajes').insert(mensajeInsert)
        await supabase.from('conversaciones').update({ actualizado_en: new Date().toISOString(), ultimo_mensaje: mensajeInsert.contenido }).eq('id', convExist.id)        // 4. Consultar AlexIA
        const { data: historialRaw } = await supabase.from('mensajes').select('remitente, contenido').eq('conversacion_id', convExist.id).order('creado_en', { ascending: false }).limit(10)
        const { data: freshPros } = await supabase.from('prospectos').select('*').eq('id', prosExist.id).single()
        
        const historialFormat = (historialRaw || []).reverse().map(m => ({
          role: m.remitente === 'usuario' ? 'user' : 'assistant',
          content: m.contenido
        }))

        // Inyectar contexto de lo que YA sabemos para que no repita preguntas
        const contextoCrm = `CONTEXTO ACTUAL DEL PROSPECTO:
        Nombre: ${freshPros.nombre || 'Desconocido'}
        Edad: ${freshPros.edad || 'Desconocida'}
        Nivel: ${freshPros.nivel || 'Desconocido'}
        Horario: ${freshPros.horario || 'Desconocido'}
        IMPORTANTE: Si ya conoces estos datos, NO los preguntes de nuevo. Solo confirma si el usuario quiere cambiar algo o sigue con el flujo.`;

        const { respuesta, datos, intencion } = await consultarAlex([
          { role: 'system', content: contextoCrm },
          ...historialFormat
        ], nombrePerfil, 'WhatsApp')
        
        // Evitar bucles
        const ultimaRespuestaBot = (historialRaw || []).find(m => m.remitente === 'bot')?.contenido;
        if (respuesta === ultimaRespuestaBot && intencion !== 'CIERRE_CITA') {
          console.log(`⚠️ Respuesta repetida detectada para ${remitenteId}. Ignorando.`);
          return NextResponse.json({ estado: 'repetido' }, { status: 200 });
        }

        console.log(`🤖 AlexIA (${remitenteId}):`, { intencion, datos })
        
        // 5. Actualizar CRM (Resiliente a columnas faltantes)
        if (datos && Object.keys(datos).length > 0) {
           try {
             const updateData = { actualizado_en: new Date().toISOString() };
             const fallbacks = [];

             if (datos.nombre && datos.nombre !== freshPros.nombre) updateData.nombre = datos.nombre;
             if (datos.edad) updateData.edad = parseInt(datos.edad);
             if (datos.nivel) updateData.nivel = datos.nivel;
             if (datos.horario) updateData.horario = datos.horario;
             if (datos.curso_interes) updateData.curso_interes = datos.curso_interes;

             // Intento de actualización directa
             const { error: crmError } = await supabase.from('prospectos').update(updateData).eq('id', prosExist.id);
             
             if (crmError) {
               console.error('⚠️ Error en update (posible falta de columnas):', crmError.message);
               // Si fallan columnas específicas, guardamos en notas para no perder la info
               const msgNotas = `[Sync Fallido] Datos extraídos: Edad:${datos.edad}, Nivel:${datos.nivel}, Horario:${datos.horario}, Interés:${datos.curso_interes}`;
               await supabase.from('prospectos').update({ 
                 notas: (freshPros.notas ? freshPros.notas + '\n' : '') + msgNotas 
               }).eq('id', prosExist.id);
             } else {
               console.log('✅ CRM Actualizado correctamente');
             }
           } catch (errSync) {
             console.error('❌ Error fatal en sync:', errSync.message);
           }
        }
        // 6. Lógica de Citas (Si la intención es CIERRE_CITA)
        if (intencion === 'CIERRE_CITA') {
          await supabase.from('prospectos').update({ estado: 'agendado' }).eq('id', prosExist.id)
          
          const fechaDefecto = new Date()
          fechaDefecto.setDate(fechaDefecto.getDate() + 1) // Mañana por defecto
          
          const insertCita = {
            prospecto_id: prosExist.id,
            fecha: datos.fecha_cita || fechaDefecto.toISOString().split('T')[0],
            hora: datos.hora_cita || '16:00',
            tipo: 'Inscripción / Sesión Informativa',
            estado: 'pendiente'
          }
          
          console.log('📅 Creando cita:', insertCita);
          await supabase.from('citas').insert(insertCita)
        }

        // 7. Enviar a Meta
        let imagenUrl = null
        if (datos && datos.imagen) {
          const origin = new URL(solicitud.url).origin
          imagenUrl = `${origin}/cursos/${datos.imagen}`
        }

        const enviadoCorrectamente = await enviarMensajeWhatsApp(remitenteId, respuesta, imagenUrl, datos?.opciones)
        
        if (enviadoCorrectamente) {
           await supabase.from('mensajes').insert({ 
             conversacion_id: convExist.id, 
             remitente: 'bot', 
             contenido: respuesta,
             tipo: imagenUrl ? 'imagen' : 'texto',
             url_archivo: imagenUrl || null
           })
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

async function enviarMensajeWhatsApp(to, mensaje, imagen = null, opciones = null) {
  const token = process.env.META_WHATSAPP_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID
  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`

  let payload = {
    messaging_product: "whatsapp",
    to: to,
  }

  if (imagen) {
    payload.type = "image"
    payload.image = { link: imagen, caption: mensaje }
  } else if (opciones && opciones.length > 0) {
    payload.type = "interactive"
    payload.interactive = {
      type: "button",
      body: { text: mensaje },
      action: {
        buttons: opciones.slice(0, 3).map((opt, i) => ({
          type: "reply",
          reply: { id: `btn_${i}`, title: opt.substring(0, 20) }
        }))
      }
    }
  } else {
    payload.type = "text"
    payload.text = { body: mensaje }
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
