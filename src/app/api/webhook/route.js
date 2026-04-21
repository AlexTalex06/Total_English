// Vercel build fix - Clean version 1.0
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
  try {
    const cuerpo = await solicitud.json()

    if (cuerpo.object === 'whatsapp_business_account') {
      const entrada = cuerpo.entry?.[0]
      const cambios = entrada?.changes?.[0]
      const valor = cambios?.value

      if (valor?.messages && valor.messages.length > 0) {
        const mensajeObj = valor.messages[0]
        const contactoMeta = valor.contacts?.[0]
        let remitenteId = mensajeObj.from
        
        // Normalización para México (521 -> 52) para consistencia en búsquedas
        if (remitenteId.startsWith('521') && remitenteId.length === 13) {
          remitenteId = '52' + remitenteId.substring(3)
        }

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
        // Buscar con ambas variantes (52 y 521)
        const variantesId = remitenteId.startsWith('52') ? [remitenteId, remitenteId.replace('52', '521')] : [remitenteId]
        let { data: convExist } = await supabase.from('conversaciones')
          .select('*')
          .in('id_plataforma', variantesId)
          .eq('plataforma', 'whatsapp')
          .maybeSingle()

        // --- FILTRO DE DISPARADORES PARA NUEVOS PROSPECTOS ---
        const PALABRAS_CLAVE = [
          'info', 'información', 'clases', 'hola', 'horarios', 'detalles', 
          'cursos', 'diplomado', 'ingles', 'inglés', 'costo', 'precio', 
          'inscripción', 'mensualidad', 'total', 'english'
        ]
        const textoMin = texto.toLowerCase()
        const dijoPalabraClave = PALABRAS_CLAVE.some(palabra => textoMin.includes(palabra))
        const vieneDeAnuncio = mensajeObj.referral // Detecta clics en anuncios CTWA

        if (!convExist && !dijoPalabraClave && !vieneDeAnuncio) {
          console.log(`🚫 Ignorando mensaje de ${remitenteId}: No es charla activa, no dijo keyword y no viene de anuncio.`)
          return NextResponse.json({ estado: 'ignorado_sin_disparador' }, { status: 200 })
        }
        // --------------------------------------------------------

        // --- LÓGICA DE PROSPECTO POSPUESTA ---
        let prosExist = null;

        // 1. Buscar si la conversación ya tiene un prospecto vinculado
        if (convExist && convExist.prospecto_id) {
          const { data: pData } = await supabase.from('prospectos').select('*').eq('id', convExist.prospecto_id).maybeSingle()
          if (pData) {
            prosExist = pData;
          }
        }

        // 2. Si no tiene en la conversación, buscar por teléfono por si acaso existe uno huérfano
        if (!prosExist) {
          const { data: prosPorTel } = await supabase.from('prospectos').select('*').eq('telefono', remitenteId).order('creado_en', { ascending: false }).limit(1).maybeSingle()
          if (prosPorTel) {
            prosExist = prosPorTel
            // Si lo encontramos por teléfono, vincularlo a la conversación de una vez
            if (convExist) {
              await supabase.from('conversaciones').update({ prospecto_id: prosExist.id }).eq('id', convExist.id)
            }
          }
        }

        // 3. Crear conversación si no existe (SIN prospecto por ahora si no encontramos uno)
        if (!convExist) {
          // Normalizar ID para búsqueda
          const searchId = remitenteId.startsWith('52') ? [remitenteId, remitenteId.replace('52', '521')] : [remitenteId]
          
          const { data: cExist } = await supabase.from('conversaciones')
            .select('*, prospectos(*)')
            .in('id_plataforma', searchId)
            .eq('plataforma', 'whatsapp')
            .maybeSingle()
          
          if (cExist) {
            convExist = cExist
            prosExist = cExist.prospectos
          } else {
            // Si no hay prospecto detectado previamente, lo creamos con el nombre del perfil de WhatsApp
            if (!prosExist) {
              const { data: nuevoP } = await supabase.from('prospectos').insert({
                nombre: nombrePerfil || 'Prospecto WhatsApp',
                telefono: remitenteId,
                estado: 'nuevo'
              }).select('*').single()
              if (nuevoP) {
                prosExist = nuevoP
                console.log(`✅ Prospecto inicial creado con nombre de perfil: ${nombrePerfil}`)
              }
            }

            const { data: nuevaC } = await supabase.from('conversaciones').insert({ 
              prospecto_id: prosExist ? prosExist.id : null, 
              plataforma: 'whatsapp', 
              id_plataforma: remitenteId 
            }).select('*').single()
            convExist = nuevaC
            
            // Pausa de 2 segundos para el primer mensaje (Bienvenida)
            await sleep(2000)
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
        
        let freshPros = prosExist || {};
        if (prosExist?.id) {
          const { data: pData } = await supabase.from('prospectos').select('*').eq('id', prosExist.id).maybeSingle()
          if (pData) freshPros = pData;
        }

        const historialFormat = (historialRaw || []).reverse().map(m => ({
          role: m.remitente === 'usuario' ? 'user' : 'assistant',
          content: m.contenido
        }))

        // OBTENER CITAS PRÓXIMAS PARA EVITAR CONFLICTOS
        const { data: citasFuturasData } = await supabase.from('citas')
          .select('fecha, hora')
          .gte('fecha', new Date().toISOString().split('T')[0])
          .eq('estado', 'pendiente')
          .order('fecha', { ascending: true })
          .limit(20)
        
        const listaCitas = (citasFuturasData || []).map(c => `- ${c.fecha} a las ${c.hora}`).join('\n')

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
        
        CITAS OCUPADAS (NO AGENDAR AQUÍ):
        ${listaCitas || 'No hay citas agendadas aún.'}

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

        // Obtener configuración del bot (horarios, brechas) y citas existentes para evitar cruces
        let configBot = null;
        let citasExistentes = [];
        
        const { data: cnf } = await supabase.from('configuracion_bot').select('*').eq('id', 1).single();
        if (cnf) configBot = cnf;

        // Consultar citas de los próximos 7 días para que la IA sepa qué está ocupado
        if (citasFuturasData) citasExistentes = citasFuturasData;

        const contextoCrmPlus = `${contextoCrm}\n\n## CITAS OCUPADAS ACTUALMENTE:\n${citasExistentes.length > 0 
          ? citasExistentes.map(c => `- ${c.fecha} a las ${c.hora}`).join('\n')
          : 'No hay citas agendadas aún, todos los horarios están libres.'}`;

        const { respuesta, datos, opciones, intencion } = await consultarAlex([
          { role: 'system', content: contextoCrmPlus },
          ...historialFormat
        ], nombrePerfil, 'WhatsApp', tablaDinamicaCursos, configBot)

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
          
          const msjEscalamiento = "Voy a transferir tu solicitud ahora mismo con uno de nuestros asesores.\n\nRevisará tu caso para darte una respuesta personalizada en unos momentos.\n\nUn asesor se pondrá en contacto contigo a la brevedad por este medio para darte seguimiento puntual. ¡Gracias por tu paciencia!";
          
          await enviarMensajeWhatsApp(remitenteId, msjEscalamiento);
          // Dividir por saltos de línea para simular el envío de varios mensajes
          const partesEscalamiento = msjEscalamiento.split('\n\n');
          for (let i = 0; i < partesEscalamiento.length; i++) {
             await supabase.from('mensajes').insert({
               conversacion_id: convExist.id, remitente: 'bot', contenido: partesEscalamiento[i], tipo: 'texto'
             });
          }
          await supabase.from('conversaciones').update({ ultimo_mensaje: partesEscalamiento[partesEscalamiento.length - 1] }).eq('id', convExist.id);

          // --- NOTIFICACIONES AL ADMINISTRADOR ---
          const adminPhone = process.env.ADMIN_PHONE_NUMBER;
          if (adminPhone) {
            const msgAdminEscalamiento = `🚨 *¡SE REQUIERE UN ASESOR HUMANO!* 🚨\n\n` +
              `👤 *Prospecto:* ${prosExist?.nombre_alumno || prosExist?.nombre || nombrePerfil || 'Desconocido'}\n` +
              `📞 *Teléfono:* ${remitenteId}\n` +
              `💬 *Motivo:* El usuario ha solicitado ayuda o el bot no pudo responder.\n\n` +
              `🔗 *Ver en Inbox:* https://total-english-crm.vercel.app/inbox`;
            
            console.log('📢 Notificando al admin por WhatsApp (Escalamiento):', adminPhone);
            await enviarMensajeWhatsApp(adminPhone, msgAdminEscalamiento);
          }

          // Notificación por correo con Resend
          try {
            const { data: admins } = await supabase.from('usuarios').select('email').eq('rol', 'admin');
            const adminEmail = admins && admins.length > 0 ? admins[0].email : null;
            console.log('📧 Intentando notificar por email a:', adminEmail);
            if (adminEmail) {
              const resEmail = await notificarEscalamientoAdmin({
                adminEmail: adminEmail,
                nombreProspecto: prosExist?.nombre_alumno || prosExist?.nombre || nombrePerfil || 'Desconocido',
                telefonoProspecto: remitenteId,
                motivo: texto || 'escalamiento',
                conversacionId: convExist.id
              });
              console.log('📧 Resultado de notificación email:', resEmail);
            } else {
              console.warn('⚠️ No se encontró email de administrador para enviar alerta de escalamiento.');
            }
          } catch (e) {
            console.error('❌ Error enviando notificación de correo:', e);
          }

          return NextResponse.json({ estado: 'escalado' }, { status: 200 });
        }
        // --------------------------------------------

        // 5. Actualizar CRM o Crear Prospecto si ya hay datos suficientes
        if (datos && Object.keys(datos).length > 0) {
          try {
            // Si NO hay prospecto pero AlexIA ya obtuvo datos, lo creamos ahora (Fallback si falló el inicio)
            if (!prosExist) {
              const { data: nuevoP } = await supabase.from('prospectos').insert({
                nombre: datos.nombre || nombrePerfil || 'Interesado',
                nombre_alumno: datos.nombre_alumno || null,
                telefono: remitenteId,
                edad: datos.edad ? parseInt(datos.edad) : null,
                nivel: datos.nivel || null,
                horario: datos.horario || null,
                curso_interes: datos.curso_interes || null,
                estado: 'nuevo'
              }).select('*').single()
              
              if (nuevoP) {
                prosExist = nuevoP
                await supabase.from('conversaciones').update({ prospecto_id: nuevoP.id }).eq('id', convExist.id)
              }
            } else {
              // Si ya existe, actualizamos
              let idTarget = prosExist.id;

              // Bifurcación multi-alumno
               const incomingName = datos.nombre_alumno ? String(datos.nombre_alumno).trim() : null;
               const currentName = prosExist.nombre_alumno ? String(prosExist.nombre_alumno).trim() : null;
               const isInvalidName = (n) => !n || ['...', 'desconocido', 'n/a', 'null'].includes(String(n).toLowerCase());
              
              if (incomingName && !isInvalidName(incomingName) && currentName && !isInvalidName(currentName) && incomingName.toLowerCase() !== currentName.toLowerCase()) {
                console.log(`Bifurcando prospecto de ${currentName} a -> ${incomingName}`);
                const propObj = { ...prosExist };
                delete propObj.id; delete propObj.creado_en; delete propObj.actualizado_en;
                propObj.nombre_alumno = datos.nombre_alumno;
                propObj.edad = datos.edad ? parseInt(datos.edad) : null;
                propObj.nivel = datos.nivel || null;
                propObj.horario = datos.horario || null;
                propObj.categoria_edad = datos.categoria_edad || null;
                propObj.estado = 'nuevo';
                propObj.lead_score = null;

                const { data: nuevoHijo } = await supabase.from('prospectos').insert(propObj).select('*').single();
                if (nuevoHijo) {
                  await supabase.from('conversaciones').update({ prospecto_id: nuevoHijo.id }).eq('id', convExist.id);
                  idTarget = nuevoHijo.id;
                  prosExist = nuevoHijo;
                }
              } else {
                const updateData = { actualizado_en: new Date().toISOString() };
                if (datos.nombre_alumno && !isInvalidName(datos.nombre_alumno)) updateData.nombre_alumno = datos.nombre_alumno;
                if (datos.edad) updateData.edad = parseInt(datos.edad);
                if (datos.nivel && !isInvalidName(datos.nivel)) updateData.nivel = datos.nivel;
                if (datos.horario && !isInvalidName(datos.horario)) updateData.horario = datos.horario;
                if (datos.curso_interes && !isInvalidName(datos.curso_interes)) updateData.curso_interes = datos.curso_interes;
                if (datos.categoria_edad) updateData.categoria_edad = datos.categoria_edad;
                if (datos.parentesco) updateData.parentesco = datos.parentesco;
                if (datos.lead_score && !isInvalidName(datos.lead_score)) updateData.lead_score = datos.lead_score;

                const { error: crmError } = await supabase.from('prospectos').update(updateData).eq('id', idTarget);
                if (crmError) console.error('Error actualizando prospecto:', crmError.message);
              }
            }
          } catch (errSync) {
            console.error('❌ Error fatal en sync CRM:', errSync.message);
          }
        }


        // 6. Lógica de Citas (Si la intención es CIERRE_CITA)
        if (intencion === 'CIERRE_CITA' && prosExist) {
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

        // 7. Enviar a Meta con Pausas y Simulación de Escritura
        let imagenUrl = null
        if (datos && datos.imagen && datos.imagen !== 'null') {
          if (datos.imagen.startsWith('http')) {
            imagenUrl = datos.imagen
          } else {
            // Dominio de producción - Meta necesita una URL pública accesible
            const origin = process.env.NEXT_PUBLIC_BASE_URL || 'https://total-english.vercel.app'
            imagenUrl = `${origin}/cursos/${datos.imagen}`
          }
          console.log('🖼️ Imagen URL construida:', imagenUrl)
        }

        // Preparar opciones (sanitizar)
        const opcionesLimpias = (opciones && Array.isArray(opciones) && opciones.length > 0)
          ? opciones.filter(o => o && typeof o === 'string' && o.trim() !== '')
          : null;

        // Si es recomendación de curso -> FLUJO ESPECIAL con imagen y texto
        if (intencion === 'COURSE_RECOMMENDED') {
          // 1. Intentar extraer el mensaje de espera "Un momento..."
          const partesRespuesta = respuesta.split(/\n\s*\n/).filter(p => p.trim() !== '')
          let msgEspera = "Un momento estoy buscando el mejor diplomado.. 🔍"
          let restoTexto = respuesta
          
          if (partesRespuesta.length > 1) {
            const primerParte = partesRespuesta[0].toLowerCase()
            if (primerParte.includes("un momento") || primerParte.includes("buscando")) {
              msgEspera = partesRespuesta[0].trim()
              restoTexto = partesRespuesta.slice(1).join("\n\n").trim()
            }
          }

          // 2. Enviar mensaje de espera primero
          try {
            await marcarEscribiendo(remitenteId)
            await sleep(800)
            await enviarMensajeWhatsApp(remitenteId, msgEspera)
          } catch (e) {
            console.error('❌ Error enviando mensaje de espera:', e.message)
          }

          // 3. Enviar imagen (vía CDN)
          let imgUrl = null
          try {
            if (datos?.imagen && datos.imagen !== 'null' && datos.imagen !== '...') {
              imgUrl = await obtenerImagenCDN(datos.imagen)
            }

            if (imgUrl) {
              console.log('📤 Enviando Imagen vía CDN:', imgUrl)
              await enviarMensajeWhatsApp(remitenteId, '✨ ¡Aquí tienes la información de tu diplomado!', imgUrl)

              // Guardar imagen en CRM
              await supabase.from('mensajes').insert({
                conversacion_id: convExist.id,
                remitente: 'bot',
                contenido: '[Imagen del curso]',
                tipo: 'imagen',
                url_archivo: imgUrl
              })
            }
          } catch (imgErr) {
            console.error('❌ Error crítico en flujo de imagen:', imgErr.message)
          }

          // 4. Pausa y enviar el texto principal dividido en burbujas
          try {
            const burbujasTexto = restoTexto.split(/\n\s*\n/).filter(b => b.trim() !== '')
            
            for (let i = 0; i < burbujasTexto.length; i++) {
              const esUltima = (i === burbujasTexto.length - 1)
              const burbujaActual = burbujasTexto[i].trim()
              
              if (!burbujaActual) continue;

              await marcarEscribiendo(remitenteId)
              await sleep(1500)

              if (esUltima && opcionesLimpias) {
                console.log('📤 Enviando Botones con burbuja final:', burbujaActual)
                await enviarMensajeWhatsApp(remitenteId, burbujaActual, null, opcionesLimpias)
              } else {
                await enviarMensajeWhatsApp(remitenteId, burbujaActual)
              }

              // Guardar en CRM
              await supabase.from('mensajes').insert({
                conversacion_id: convExist.id,
                remitente: 'bot',
                contenido: burbujaActual,
                tipo: 'texto'
              })
            }
          } catch (txtErr) {
            console.error('❌ Error enviando texto principal:', txtErr.message)
          }
          
          await supabase.from('conversaciones').update({ ultimo_mensaje: restoTexto }).eq('id', convExist.id)
        } else {
          // Para otros mensajes: dividir en burbujas con pausas
          const partes = respuesta.split('\n\n').filter(p => p.trim() !== '')
          
          for (let i = 0; i < partes.length; i++) {
            await marcarEscribiendo(remitenteId)
            const delay = Math.min(Math.max(partes[i].length * 30, 1000), 3000)
            await sleep(delay)
            
            if (i === partes.length - 1 && opcionesLimpias) {
              // Si hay opciones y son más de 3, usar lista. Si no, botones.
              if (opcionesLimpias.length > 3) {
                await enviarListaWhatsApp(remitenteId, partes[i], 'Menú de Diplomados', opcionesLimpias)
              } else {
                await enviarMensajeWhatsApp(remitenteId, partes[i], null, opcionesLimpias)
              }
            } else {
              await enviarMensajeWhatsApp(remitenteId, partes[i])
            }
            
            await supabase.from('mensajes').insert({
              conversacion_id: convExist.id,
              remitente: 'bot',
              contenido: partes[i],
              tipo: 'texto'
            })
          }
          
          await supabase.from('conversaciones').update({ 
            ultimo_mensaje: partes[partes.length - 1] 
          }).eq('id', convExist.id)
        }
      }
    }
    return NextResponse.json({ estado: 'procesado' }, { status: 200 })
  } catch (error) {
    console.error('❌ Error Webhook:', error.message, error.stack)
    return NextResponse.json({ error: 'Error interno' }, { status: 200 })
  }
}

// === FUNCIÓN: Obtener imagen desde Supabase Storage CDN (con cache automático) ===
async function obtenerImagenCDN(nombreArchivo) {
  try {
    const rutaStorage = `cursos/${nombreArchivo}`
    
      const { data: archivos, error: listError } = await supabase.storage.from('chat-media').list('cursos', { search: nombreArchivo })
      if (listError) console.error('❌ Error listando bucket Supabase:', listError.message)
      
      if (archivos && archivos.length > 0) {
        const { data } = supabase.storage.from('chat-media').getPublicUrl(rutaStorage)
        console.log('🖼️ Imagen ya en Supabase:', data.publicUrl)
        return data.publicUrl
      }
      
      const origin = process.env.NEXT_PUBLIC_BASE_URL || 'https://total-english.vercel.app'
      const urlVercel = `${origin}/cursos/${nombreArchivo}`
      console.log('🖼️ Intentando descargar de Vercel para CDN:', urlVercel)
      
      try {
        const response = await axios.get(urlVercel, { responseType: 'arraybuffer', timeout: 8000 })
        const buffer = Buffer.from(response.data)
        const contentType = nombreArchivo.endsWith('.png') ? 'image/png' : 'image/jpeg'
        
        const { error: uploadErr } = await supabase.storage.from('chat-media').upload(rutaStorage, buffer, {
          contentType,
          upsert: true
        })
        
        if (uploadErr) {
          console.error('❌ Error subiendo a Supabase Storage:', uploadErr.message)
          return urlVercel 
        }
        
        const { data } = supabase.storage.from('chat-media').getPublicUrl(rutaStorage)
        return data.publicUrl
      } catch (fetchErr) {
        console.error(`❌ Falló descarga de Vercel (${urlVercel}):`, fetchErr.message)
        return urlVercel // Fallback a URL directa si falla la descarga
      }
  } catch (err) {
    console.error('❌ Error en obtenerImagenCDN:', err.message)
    return null
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function marcarEscribiendo(to) {
  const token = process.env.META_WHATSAPP_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID
  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`
  if (!token || !phoneId) return

  try {
    await axios.post(url, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      sender_action: "typing_on"
    }, { headers: { Authorization: `Bearer ${token}` } })
  } catch (e) {
    // console.log("Error typing_on:", e.message)
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
    // WhatsApp limita el caption a 1024 caracteres
    payload.image = { link: imagen, caption: mensaje ? mensaje.substring(0, 1024) : '' }
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

  console.log('📤 Payload enviado a Meta:', JSON.stringify(payload))

  try {
    const response = await axios.post(url, payload, headers)
    console.log('✅ Meta API respuesta:', JSON.stringify(response.data))
    return true
  } catch (error) {
    const errorData = error.response?.data;
    console.error(`❌ ERROR META API para ${to}:`, JSON.stringify(errorData, null, 2) || error.message)

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

// === FUNCIÓN: Enviar Lista Interactiva de WhatsApp ===
async function enviarListaWhatsApp(to, mensaje, botonTexto, opciones) {
  const token = process.env.META_WHATSAPP_TOKEN
  const phoneId = process.env.META_PHONE_NUMBER_ID
  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: mensaje },
      action: {
        button: botonTexto.substring(0, 20),
        sections: [{
          title: "Diplomados Disponibles",
          rows: opciones.slice(0, 10).map((opt, i) => ({
            id: `diploma_${i}`,
            title: opt.substring(0, 24),
            description: `Información sobre ${opt}`.substring(0, 72)
          }))
        }]
      }
    }
  }

  const headers = {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  }

  try {
    const response = await axios.post(url, payload, headers)
    console.log('✅ Lista enviada:', JSON.stringify(response.data))
    return true
  } catch (error) {
    console.warn(`⚠️ Error enviando lista:`, error.response?.data || error.message)
    // Fallback: enviar como texto simple
    return await enviarMensajeWhatsApp(to, `${mensaje}\n\n${opciones.map((o, i) => `${i+1}. ${o}`).join('\n')}`)
  }
}
