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

        // 1 & 2. Conversación y Prospecto: Buscar o Crear de forma segura sin UNIQUE en teléfono
        let { data: convExist } = await supabase.from('conversaciones').select('*').eq('id_plataforma', remitenteId).eq('plataforma', 'whatsapp').maybeSingle()
        let prosExist = null;

        if (convExist) {
          const { data: pData } = await supabase.from('prospectos').select('id').eq('id', convExist.prospecto_id).single()
          prosExist = pData;
        } else {
          // Si no hay conversación, creamos el prospecto titular y la conversación
          const { data: nuevoP } = await supabase.from('prospectos').insert({ nombre: nombrePerfil, telefono: remitenteId, estado: 'nuevo' }).select('id').single()
          prosExist = nuevoP
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
        const fechaActualTexto = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Mexico_City' });
        const contextoCrm = `CONTEXTO ACTUAL DEL PROSPECTO:
        Fecha de Hoy: ${fechaActualTexto}
        Edad: ${freshPros.edad || 'Desconocida'}
        Categoría: ${freshPros.categoria_edad || 'Desconocida'}
        Nivel: ${freshPros.nivel || 'Desconocido'}
        Horario: ${freshPros.horario || 'Desconocido'}
        IMPORTANTE: Si ya conoces estos datos, NO los preguntes de nuevo. Solo avanza.`;

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
        
        // 5. Actualizar CRM (Bifurcación Multi-Alumno)
        if (datos && Object.keys(datos).length > 0) {
           try {
             let idTarget = prosExist.id;

             // Bifurcación multi-alumno
             if (datos.nombre_alumno && freshPros.nombre_alumno && datos.nombre_alumno.toLowerCase() !== freshPros.nombre_alumno.toLowerCase()) {
                 console.log(`Bifurcando prospecto de ${freshPros.nombre_alumno} a -> ${datos.nombre_alumno}`);
                 const propObj = { ...freshPros };
                 delete propObj.id; delete propObj.creado_en; delete propObj.actualizado_en;
                 propObj.nombre_alumno = datos.nombre_alumno;
                 propObj.edad = datos.edad ? parseInt(datos.edad) : null;
                 propObj.nivel = datos.nivel || null;
                 propObj.horario = datos.horario || null;
                 propObj.categoria_edad = datos.categoria_edad || null;

                 const { data: nuevoHijo } = await supabase.from('prospectos').insert(propObj).select('id').single();
                 if (nuevoHijo) {
                     await supabase.from('conversaciones').update({ prospecto_id: nuevoHijo.id }).eq('id', convExist.id);
                     idTarget = nuevoHijo.id;
                     prosExist.id = nuevoHijo.id; // Actualizar local para las citas
                 }
             } else {
                 const updateData = { actualizado_en: new Date().toISOString() };
                 if (datos.nombre_alumno) updateData.nombre_alumno = datos.nombre_alumno;
                 if (datos.edad) updateData.edad = parseInt(datos.edad);
                 if (datos.nivel) updateData.nivel = datos.nivel;
                 if (datos.horario) updateData.horario = datos.horario;
                 if (datos.curso_interes) updateData.curso_interes = datos.curso_interes;
                 if (datos.categoria_edad) updateData.categoria_edad = datos.categoria_edad;

                 const { error: crmError } = await supabase.from('prospectos').update(updateData).eq('id', idTarget);
                 if (crmError) console.error('Error actualizando prospecto:', crmError.message);
             }
           } catch (errSync) {
             console.error('❌ Error fatal en sync CRM:', errSync.message);
           }
        }

        // 6. Lógica de Citas (Si la intención es CIERRE_CITA)
        if (intencion === 'CIERRE_CITA') {
          // Evitar duplicados usando .limit(1) para evadir errores 500
          const { data: citasExistentes } = await supabase.from('citas')
            .select('id, fecha, hora')
            .eq('prospecto_id', prosExist.id)
            .eq('estado', 'pendiente')
            .order('timestamp', { ascending: false })
            .limit(1);
            
          const citaExistente = citasExistentes && citasExistentes.length > 0 ? citasExistentes[0] : null;

          let fCitaStr = datos.fecha_cita;
          const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
          if (!fCitaStr || !regexFecha.test(fCitaStr)) {
            const diaDefecto = new Date();
            diaDefecto.setDate(diaDefecto.getDate() + 1);
            fCitaStr = diaDefecto.toISOString().split('T')[0];
          }

          if (!citaExistente) {
            await supabase.from('prospectos').update({ estado: 'agendado' }).eq('id', prosExist.id)
            const insertCita = { prospecto_id: prosExist.id, fecha: fCitaStr, hora: datos.hora_cita || '16:00', tipo: 'Inscripción / Sesión Informativa', estado: 'pendiente' };
            console.log('📅 Creando cita:', insertCita);
            await supabase.from('citas').insert(insertCita);
          } else {
            if (datos.fecha_cita || datos.hora_cita) {
              const updateCita = {
                fecha: (datos.fecha_cita && regexFecha.test(datos.fecha_cita)) ? datos.fecha_cita : citaExistente.fecha,
                hora: datos.hora_cita || citaExistente.hora
              };
              console.log('📅 Actualizando cita existente:', updateCita);
              await supabase.from('citas').update(updateCita).eq('id', citaExistente.id);
            }
          }
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
