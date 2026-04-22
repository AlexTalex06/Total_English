// Vercel build fix - Clean version 1.0
import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { consultarAlex } from '@/lib/alexIA'
import { escalarAHumano } from '@/lib/prospectoSync'
import { notificarEscalamientoAdmin, notificarCitaAdmin } from '@/lib/mailer'
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
            // Si no hay prospecto detectado previamente, lo creamos después cuando tengamos datos suficientes
            const { data: nuevaC } = await supabase.from('conversaciones').insert({ 
              prospecto_id: null, 
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
        Nombre Alumno: ${freshPros.nombre_alumno || freshPros.nombre || nombrePerfil || 'Desconocido'}
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
          { role: 'system', content: contextoCrmPlus.replace('{Telefono}', remitenteId) },
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
              // Forzamos el correo verificado del usuario para evitar el error de Resend en modo prueba
              const adminEmail = 'aniygdragon@gmail.com'; 
              console.log('📧 Notificando por email (Modo Seguro):', adminEmail);
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
            if (!prosExist) {
              // Crear Prospecto solo si tenemos datos mínimos (Edad, Nivel o Horario)
              if (datos.edad || datos.nivel || datos.horario || datos.nombre_alumno) {
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
              }
            } else {
              // Si ya existe, actualizamos el mismo registro para evitar duplicados
              const isInvalidName = (n) => !n || ['...', 'desconocido', 'n/a', 'null', 'usuario'].includes(String(n).toLowerCase());
              const updateData = { actualizado_en: new Date().toISOString() };
              
              if (datos.nombre_alumno && !isInvalidName(datos.nombre_alumno)) updateData.nombre_alumno = datos.nombre_alumno;
              if (datos.edad) updateData.edad = parseInt(datos.edad);
              if (datos.nivel && !isInvalidName(datos.nivel)) updateData.nivel = datos.nivel;
              if (datos.horario && !isInvalidName(datos.horario)) updateData.horario = datos.horario;
              if (datos.curso_interes && !isInvalidName(datos.curso_interes)) updateData.curso_interes = datos.curso_interes;
              if (datos.categoria_edad) updateData.categoria_edad = datos.categoria_edad;
              if (datos.lead_score && !isInvalidName(datos.lead_score)) updateData.lead_score = datos.lead_score;

              const { error: crmError } = await supabase.from('prospectos').update(updateData).eq('id', prosExist.id);
              if (crmError) console.error('Error actualizando prospecto:', crmError.message);
            }
          } catch (errSync) {
            console.error('❌ Error fatal en sync CRM:', errSync.message);
          }
        }

        // 5b. GUARDAR NOMBRE DEL ALUMNO (Forzado durante agendamiento)
        if (prosExist && (intencion === 'SCHEDULING_DATE' || intencion === 'CIERRE_CITA')) {
          const isInvalidN = (n) => !n || ['...', 'desconocido', 'n/a', 'null', 'usuario', ''].includes(String(n).toLowerCase().trim());
          
          // Intentar obtener el nombre: 1) del JSON de la IA, 2) del mensaje del usuario (cuando respondió a "¿Cuál es tu nombre?")
          let nombreFinal = datos.nombre_alumno;
          
          if (isInvalidN(nombreFinal) && intencion === 'SCHEDULING_DATE') {
            // Si la IA no extrajo el nombre, el texto del usuario ES el nombre (acaba de responder a la pregunta del nombre)
            const textoLimpio = texto.trim();
            // Validar que parece un nombre (2-5 palabras, sin números, sin URLs)
            if (textoLimpio && textoLimpio.split(/\s+/).length <= 5 && !/\d/.test(textoLimpio) && !textoLimpio.includes('http')) {
              nombreFinal = textoLimpio;
            }
          }
          
          // También buscar en el prospecto existente por si ya se guardó antes
          if (isInvalidN(nombreFinal) && prosExist.nombre_alumno) {
            nombreFinal = prosExist.nombre_alumno;
          }

          if (nombreFinal && !isInvalidN(nombreFinal)) {
            console.log('📌 Guardando nombre_alumno:', nombreFinal);
            await supabase.from('prospectos').update({ nombre_alumno: nombreFinal }).eq('id', prosExist.id);
            prosExist.nombre_alumno = nombreFinal;
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
            const insertCita = { 
              prospecto_id: prosExist.id, 
              fecha: fCitaStr, 
              hora: datos.hora_cita || '16:00', 
              tipo: 'Inscripción / Sesión Informativa', 
              estado: 'pendiente' 
            };
            console.log('📅 Creando cita oficial:', insertCita);
            const { error: insErr } = await supabase.from('citas').insert(insertCita);
            if (insErr) {
              console.error('❌ Error insertando cita:', insErr.message);
            } else {
              await supabase.from('prospectos').update({ estado: 'agendado', lead_score: 'CALIENTE' }).eq('id', prosExist.id)
            }
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
            const nombreFinal = prosExist.nombre_alumno || datos.nombre_alumno || prosExist.nombre || nombrePerfil || 'Alumno';
            const cursoFinal = prosExist.curso_interes || datos.curso_interes || 'Por definir';
            const nivelFinal = prosExist.nivel || datos.nivel || 'No especificado';
            
            const msgAdmin = `🇬🇧 *¡NUEVA CITA AGENDADA EN TOTAL ENGLISH!* 🇬🇧\n\n` +
              `👤 *Alumno:* ${nombreFinal}\n` +
              `📅 *Fecha:* ${fCitaStr}\n` +
              `⏰ *Hora:* ${datos.hora_cita || '16:00'}\n` +
              `📚 *Curso:* ${cursoFinal}\n` +
              `📊 *Nivel:* ${nivelFinal}\n\n` +
              `🔗 *Ver en Citas:* https://total-english-crm.vercel.app/citas`;
            
            console.log('📢 Notificando al admin:', adminPhone);
            await enviarMensajeWhatsApp(adminPhone, msgAdmin);

            // Notificación por Email (Modo Seguro para Resend)
            try {
              const emailAdmin = 'aniygdragon@gmail.com';
              console.log('📧 Notificando cita por email a:', emailAdmin);
              await notificarCitaAdmin({
                adminEmail: emailAdmin,
                nombreAlumno: nombreFinal,
                fecha: fCitaStr,
                hora: datos.hora_cita || '16:00',
                curso: cursoFinal,
                nivel: nivelFinal
              });
            } catch (eMailErr) {
              console.error('❌ Error enviando email de cita:', eMailErr);
            }
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
          ? opciones.map(o => o.replace(/["\[\]]/g, '').trim()).filter(o => o !== '' && !o.toLowerCase().includes('opcional'))
          : null;

        // 8. PREPARAR IMAGEN (Solo en recomendación de curso)
        let imgUrl = null
        try {
          if (intencion === 'COURSE_RECOMMENDED' && datos?.imagen && datos.imagen !== 'null' && datos.imagen !== '...' && datos.imagen !== 'Desconocido') {
            imgUrl = await obtenerImagenCDN(datos.imagen)
          }
        } catch (imgErr) {
          console.error('❌ Error preparando imagen:', imgErr.message)
        }

        // 8. ENVIAR TEXTO E IMAGEN (Lógica agrupada)
        try {
          if (imgUrl) {
            // LÓGICA CON IMAGEN: Enviar recomendación como pie de foto (caption)
            const partesRespuesta = respuesta.split('\n\n').filter(p => p.trim() !== '')
            
            let textoIntro = '';
            let textoCaption = '';
            
            if (partesRespuesta.length > 0 && partesRespuesta[0].toLowerCase().includes('momento')) {
              textoIntro = partesRespuesta[0];
              textoCaption = partesRespuesta.slice(1).join('\n\n');
            } else {
              textoCaption = respuesta;
            }

            // Enviar "Un momento..." como texto separado si existe
            if (textoIntro) {
              await marcarEscribiendo(remitenteId)
              await sleep(1500)
              await enviarMensajeWhatsApp(remitenteId, textoIntro)
              await supabase.from('mensajes').insert({ conversacion_id: convExist.id, remitente: 'bot', contenido: textoIntro, tipo: 'texto' })
            }

            // Enviar la imagen con la recomendación como caption
            await marcarEscribiendo(remitenteId)
            await sleep(2000)
            await enviarMensajeWhatsApp(remitenteId, textoCaption || null, imgUrl)
            await supabase.from('mensajes').insert({
              conversacion_id: convExist.id, remitente: 'bot', contenido: '[Imagen] ' + (textoCaption || ''), tipo: 'imagen', url_archivo: imgUrl
            })

            // Si hay botones (Visita/Llamada), enviarlos como mensaje separado DESPUÉS de la imagen
            if (opcionesLimpias) {
              await sleep(1000)
              await enviarMensajeWhatsApp(remitenteId, '¿Qué prefieres? 👇', null, opcionesLimpias)
            }
          } else {
            // LÓGICA SIN IMAGEN: Enviar múltiples burbujas de texto
            const partesRespuesta = respuesta.split('\n\n').filter(p => p.trim() !== '')
            for (let i = 0; i < partesRespuesta.length; i++) {
              const burbujaActual = partesRespuesta[i].trim()
              if (!burbujaActual) continue

              await marcarEscribiendo(remitenteId)
              await sleep(Math.min(Math.max(burbujaActual.length * 15, 1000), 3000))

              const esUltima = (i === partesRespuesta.length - 1)
              if (esUltima && opcionesLimpias) {
                await enviarMensajeWhatsApp(remitenteId, burbujaActual, null, opcionesLimpias)
              } else {
                await enviarMensajeWhatsApp(remitenteId, burbujaActual)
              }

              await supabase.from('mensajes').insert({
                conversacion_id: convExist.id, remitente: 'bot', contenido: burbujaActual, tipo: 'texto'
              })
            }
          }
        } catch (txtErr) {
          console.error('❌ Error en el flujo de mensajes:', txtErr.message)
        }

        await supabase.from('conversaciones').update({ ultimo_mensaje: respuesta }).eq('id', convExist.id)
        return NextResponse.json({ estado: 'procesado' }, { status: 200 })
      }
    }
    return NextResponse.json({ estado: 'procesado' }, { status: 200 })
  } catch (error) {
    console.error('❌ Error Webhook:', error.message, error.stack)
    return NextResponse.json({ error: 'Error interno' }, { status: 200 })
  }
}

// Helper para asegurar que las imágenes se sirvan desde una URL 100% estable y sin bloqueos de red
async function obtenerImagenCDN(nombreArchivo) {
  if (!nombreArchivo || nombreArchivo.trim() === 'null' || nombreArchivo.trim() === '...') return null
  
  // Solución Definitiva: Usar GitHub Raw como CDN público puro. 
  // Esto evade cualquier bloqueo de Vercel Edge o Supabase bot-protection que Meta estuviera sufriendo.
  const archivoLimpio = nombreArchivo.trim()
  const githubCDN = `https://raw.githubusercontent.com/AlexTalex06/Total_English/main/public/cursos/${archivoLimpio}`
  
  return githubCDN
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
  } catch (e) {}
}

async function uploadImageToMeta(imgUrl) {
  try {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID;
    
    // 1. Descargar la imagen
    const imageRes = await fetch(imgUrl);
    if (!imageRes.ok) throw new Error('No se pudo descargar la imagen');
    const blob = await imageRes.blob();
    
    // 2. Subir a Meta
    const formData = new FormData();
    formData.append('file', blob, 'imagen.jpg');
    formData.append('type', 'image');
    formData.append('messaging_product', 'whatsapp');

    const metaUrl = `https://graph.facebook.com/v18.0/${phoneId}/media`;
    const uploadRes = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    const data = await uploadRes.json();
    return data.id; // Retorna el Media ID de Meta
  } catch (error) {
    console.error('❌ Error subiendo imagen a Meta:', error.message);
    return null;
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
    // Intentar subir a Meta primero para obtener un ID (100% confiable)
    const mediaId = await uploadImageToMeta(imagen);
    payload.type = "image";
    if (mediaId) {
      payload.image = { id: mediaId, caption: mensaje || undefined };
    } else {
      payload.image = { link: imagen, caption: mensaje || undefined };
    }
  } else if (opciones && opciones.length > 0) {
    payload.type = "interactive"
    payload.interactive = {
      type: "button",
      body: { text: (mensaje || '¿Qué prefieres?').substring(0, 1024) },
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
    const response = await axios.post(url, payload, headers)
    return true
  } catch (error) {
    console.error('❌ ERROR META API:', error.response?.data || error.message)
    if (to.startsWith('521') && to.length === 13) {
      payload.to = to.replace('521', '52')
      try {
        await axios.post(url, payload, headers)
        return true
      } catch (retryError) {}
    }
    return false
  }
}

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
    await axios.post(url, payload, headers)
    return true
  } catch (error) {
    return await enviarMensajeWhatsApp(to, `${mensaje}\n\n${opciones.map((o, i) => `${i+1}. ${o}`).join('\n')}`)
  }
}
