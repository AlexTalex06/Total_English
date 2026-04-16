import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { consultarAlex } from '@/lib/alexIA'
import { escalarAHumano } from '@/lib/prospectoSync'
import { notificarEscalamientoAdmin } from '@/lib/mailer'
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
  // --- PAUSA TEMPORAL DEL WEBHOOK ---
  // Descomenta (quita las diagonales) de la siguiente línea para apagar Total English
  return NextResponse.json({ estado: 'pausado', mensaje: 'Chatbot apagado' }, { status: 200 })
  // ----------------------------------

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

        // Soportar texto de botones interactivos y texto normal
        let texto = ''
        if (mensajeObj.type === 'text') {
          texto = mensajeObj.text?.body || ''
        } else if (mensajeObj.type === 'interactive') {
          texto = mensajeObj.interactive?.button_reply?.title || mensajeObj.interactive?.list_reply?.title || ''
        } else if (mensajeObj.type === 'button') {
          texto = mensajeObj.button?.text || ''
        }

        // Ignorar tipos no soportados (imagen, audio, etc.)
        if (!texto) {
          console.log(`📎 Tipo no soportado: ${mensajeObj.type} de ${remitenteId}`)
          return NextResponse.json({ estado: 'tipo_no_soportado' }, { status: 200 })
        }

        // 1 & 2. Conversación y Prospecto: Buscar o Crear
        let { data: convExist } = await supabase.from('conversaciones').select('*').eq('id_plataforma', remitenteId).eq('plataforma', 'whatsapp').maybeSingle()

        // --- FILTRO DE PALABRAS MÁGICAS PARA NUEVOS PROSPECTOS ---
        const PALABRAS_CLAVE = ['total', 'english', 'ingles']
        const textoMin = texto.toLowerCase()
        const dijoPalabraClave = PALABRAS_CLAVE.some(palabra => textoMin.includes(palabra))

        if (!convExist && !dijoPalabraClave) {
          console.log(`🚫 Ignorando mensaje de ${remitenteId}: No es conversación activa y no dijo la palabra mágica.`)
          return NextResponse.json({ estado: 'ignorado_por_palabra_clave' }, { status: 200 })
        }
        // --------------------------------------------------------

        let prosExist = null;

        if (convExist && convExist.prospecto_id) {
          const { data: pData } = await supabase.from('prospectos').select('id').eq('id', convExist.prospecto_id).single()
          if (pData) {
            prosExist = pData;
          }
        }

        // Si no existe la conversación, o si existe pero el prospecto fue eliminado (prospecto_id nulo)
        if (!prosExist) {
          const { data: nuevoP } = await supabase.from('prospectos').insert({ nombre: nombrePerfil, telefono: remitenteId, estado: 'nuevo' }).select('id').single()
          prosExist = nuevoP
          if (convExist) {
            await supabase.from('conversaciones').update({ prospecto_id: prosExist.id }).eq('id', convExist.id)
          } else {
            const { data: nuevaC } = await supabase.from('conversaciones').insert({ prospecto_id: prosExist.id, plataforma: 'whatsapp', id_plataforma: remitenteId }).select('*').single()
            convExist = nuevaC
          }
        }

        const { data: existeMsg } = await supabase.from('mensajes').select('id').eq('id_mensaje_meta', mensajeObj.id).maybeSingle()
        if (existeMsg) return NextResponse.json({ estado: 'ya_procesado' }, { status: 200 })

        const mensajeInsert = {
          conversacion_id: convExist.id,
          remitente: 'usuario',
          contenido: texto,
          id_mensaje_meta: mensajeObj.id,
          tipo: 'texto'
        }
        await supabase.from('mensajes').insert(mensajeInsert)
        await supabase.from('conversaciones').update({ actualizado_en: new Date().toISOString(), ultimo_mensaje: texto }).eq('id', convExist.id)

        // --- PAUSA DE BOT: SI ESTÁ ASIGNADO A HUMANO, NO CONSULTA A ALEXIA ---
        if (convExist.asignado_a_humano) {
          console.log(`⏸️ Chatbot pausado para ${remitenteId}. El mensaje se guardó en el Inbox para el agente.`)
          return NextResponse.json({ estado: 'pausado_humano' }, { status: 200 })
        }
        // ---------------------------------------------------------------------

        // 4. Consultar AlexIA
        const { data: historialRaw } = await supabase.from('mensajes').select('remitente, contenido').eq('conversacion_id', convExist.id).order('creado_en', { ascending: false }).limit(30)
        const { data: freshPros } = await supabase.from('prospectos').select('*').eq('id', prosExist.id).single()

        const historialFormat = (historialRaw || []).reverse().map(m => ({
          role: m.remitente === 'usuario' ? 'user' : 'assistant',
          content: m.contenido
        }))

        // Inyectar contexto de lo que YA sabemos
        const fechaActualTexto = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Mexico_City' });
        const contextoCrm = `CONTEXTO ACTUAL DEL PROSPECTO:
        Fecha de Hoy: ${fechaActualTexto}
        Nombre Alumno: ${freshPros.nombre_alumno || 'Desconocido'}
        Edad: ${freshPros.edad || 'Desconocida'}
        Categoría: ${freshPros.categoria_edad || 'Desconocida'}
        Nivel: ${freshPros.nivel || 'Desconocido'}
        Horario: ${freshPros.horario || 'Desconocido'}
        Curso de Interés: ${freshPros.curso_interes || 'Desconocido'}
        IMPORTANTE: Si ya conoces estos datos, NO los preguntes de nuevo. Solo avanza al siguiente paso del flujo.`;

        // OBTENER CURSOS REALES DE LA BASE DE DATOS
        const { data: cursosDb } = await supabase.from('cursos').select('*')
        let tablaDinamicaCursos = 'NO HAY CURSOS'
        if (cursosDb && cursosDb.length > 0) {
          tablaDinamicaCursos = cursosDb.map(c => `
🎓 CURSO: ${c.nombre}
   Descripción: ${c.descripcion || 'Sin descripción'}
   Beneficios (Para usar en tu frase espejo): ${c.beneficios || 'Generales'}
   Para Edad/Nivel: ${c.nivel || 'Todas'}
   Imagen Referencia: ${c.imagen_url || 'null'}
   Inversión Ancla: ${c.precio ? '$' + c.precio : 'A Consultar con Asesor'}
          `).join('\n\n')
        }

        const { respuesta, datos, intencion } = await consultarAlex([
          { role: 'system', content: contextoCrm },
          ...historialFormat
        ], nombrePerfil, 'WhatsApp', tablaDinamicaCursos)

        // Evitar bucles - comparar con los últimos 2 mensajes del bot
        const mensajesBot = (historialRaw || []).filter(m => m.remitente === 'bot');
        const ultimasRespuestasBot = mensajesBot.slice(0, 2).map(m => m.contenido?.trim());
        const respuestaTrimmed = respuesta?.trim();

        if (ultimasRespuestasBot.includes(respuestaTrimmed) && intencion !== 'CIERRE_CITA') {
          console.log(`⚠️ Respuesta repetida detectada para ${remitenteId}. Reformulando...`);
          // En vez de ignorar, enviamos un mensaje genérico de avance
          const respuestaAlternativa = "¡Gracias por tu respuesta! 😊 ¿Me puedes dar un poco más de detalle para poder ayudarte mejor?";
          await supabase.from('mensajes').insert({
            conversacion_id: convExist.id,
            remitente: 'bot',
            contenido: respuestaAlternativa,
            tipo: 'texto'
          })
          await enviarMensajeWhatsApp(remitenteId, respuestaAlternativa)
          return NextResponse.json({ estado: 'reformulado' }, { status: 200 });
        }

        console.log(`🤖 AlexIA (${remitenteId}):`, { intencion, datos })

        if (intencion === 'SPECIFIC_QUESTION_PASS_AGENT' || intencion === 'TRANSFER_HUMANO') {
          console.log(`🚨 Escalamiento a humano para ${remitenteId}`);
          const motivo = datos?.escalation_reason || 'Usuario solicitó hablar con un asesor o hizo pregunta compleja';
          const categoria = datos?.escalation_category || 'pregunta_especifica';
          await escalarAHumano(convExist.id, prosExist.id, motivo, categoria);
          
          const msjEscalamiento = respuesta || "Voy a transferir tu solicitud ahora mismo con uno de nuestros asesores. Revisará tu caso para darte una respuesta personalizada en unos momentos. ¡Gracias por tu paciencia!";
          
          await enviarMensajeWhatsApp(remitenteId, msjEscalamiento);
          await supabase.from('mensajes').insert({
            conversacion_id: convExist.id, remitente: 'bot', contenido: msjEscalamiento, tipo: 'texto'
          });
          await supabase.from('conversaciones').update({ ultimo_mensaje: msjEscalamiento }).eq('id', convExist.id);

          // Buscar al primer administrador y mandarle correo con Resend
          try {
            const { data: admins } = await supabase.from('usuarios').select('email').eq('rol', 'admin');
            const adminEmail = admins && admins.length > 0 ? admins[0].email : null;
            if (adminEmail) {
              await notificarEscalamientoAdmin({
                adminEmail: adminEmail,
                nombreProspecto: freshPros?.nombre_alumno || nombrePerfil || 'Desconocido',
                telefonoProspecto: remitenteId,
                motivo: texto || 'escalamiento',
                conversacionId: convExist.id
              });
            } else {
              console.warn('⚠️ No se encontró email de administrador para enviar alerta de escalamiento.');
            }
          } catch (e) {
            console.error('❌ Error enviando notificación de correo:', e);
          }

          return NextResponse.json({ estado: 'escalado' }, { status: 200 });
        }
        // --------------------------------------------

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
              propObj.estado = 'nuevo';
              propObj.lead_score = null;

              const { data: nuevoHijo } = await supabase.from('prospectos').insert(propObj).select('id').single();
              if (nuevoHijo) {
                await supabase.from('conversaciones').update({ prospecto_id: nuevoHijo.id }).eq('id', convExist.id);
                idTarget = nuevoHijo.id;
                prosExist.id = nuevoHijo.id;
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
          const { data: citasExistentes } = await supabase.from('citas')
            .select('id, fecha, hora')
            .eq('prospecto_id', prosExist.id)
            .eq('estado', 'pendiente')
            .order('creado_en', { ascending: false })
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
            await supabase.from('prospectos').update({ estado: 'agendado', lead_score: 'CALIENTE' }).eq('id', prosExist.id)
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
              await supabase.from('prospectos').update({ lead_score: 'CALIENTE' }).eq('id', prosExist.id);
            }
          }

          // --- NOTIFICACIÓN AL ADMINISTRADOR ---
          const adminPhone = process.env.ADMIN_PHONE_NUMBER;
          if (adminPhone) {
            const msgAdmin = `🇬🇧 *¡NUEVA CITA AGENDADA EN TOTAL ENGLISH!* 🇬🇧\n\n` +
              `👤 *Alumno:* ${datos.nombre_alumno || nombrePerfil}\n` +
              `📅 *Fecha:* ${fCitaStr}\n` +
              `⏰ *Hora:* ${datos.hora_cita || '16:00'}\n` +
              `📚 *Curso:* ${datos.curso_interes || 'Por definir'}\n` +
              `📊 *Nivel:* ${datos.nivel || 'No especificado'}\n\n` +
              `🔗 *Ver en Citas:* https://total-english-crm.vercel.app/citas`;
            
            console.log('📢 Notificando al admin:', adminPhone);
            await enviarMensajeWhatsApp(adminPhone, msgAdmin);
          }
        }

        // 7. Enviar a Meta
        let imagenUrl = null
        if (datos && datos.imagen && datos.imagen !== 'null') {
          if (datos.imagen.startsWith('http')) {
            imagenUrl = datos.imagen
          } else {
            const origin = new URL(solicitud.url).origin
            imagenUrl = `${origin}/cursos/${datos.imagen}`
          }
        }

        // Preparar opciones (sanitizar)
        const opcionesLimpias = (datos?.opciones && Array.isArray(datos.opciones) && datos.opciones.length > 0)
          ? datos.opciones.filter(o => o && typeof o === 'string' && o.trim() !== '')
          : null;

        const enviadoCorrectamente = await enviarMensajeWhatsApp(remitenteId, respuesta, imagenUrl, opcionesLimpias)

        const respuestaFinal = enviadoCorrectamente ? respuesta : `[⚠️ WHATSAPP BLOQUEÓ EL ENVÍO (Número No Autorizado)]\n${respuesta}`

        await supabase.from('mensajes').insert({
          conversacion_id: convExist.id,
          remitente: 'bot',
          contenido: respuestaFinal,
          tipo: imagenUrl ? 'imagen' : 'texto',
          url_archivo: imagenUrl || null
        })
        await supabase.from('conversaciones').update({ ultimo_mensaje: respuestaFinal }).eq('id', convExist.id)
      }
    }
    return NextResponse.json({ estado: 'procesado' }, { status: 200 })
  } catch (error) {
    console.error('❌ Error Webhook:', error.message, error.stack)
    // Siempre responder 200 a Meta para evitar que reintente infinitamente
    return NextResponse.json({ error: 'Error interno' }, { status: 200 })
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
