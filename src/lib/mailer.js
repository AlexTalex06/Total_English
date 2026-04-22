import { Resend } from 'resend'

/**
 * Manda un correo de alerta al administrador cuando la IA de Total English
 * requiere intervención humana.
 * 
 * @param {Object} data - Datos del incidente
 * @param {string} data.adminEmail - Correo del administrador a notificar
 * @param {string} data.nombreProspecto - Nombre del prospecto
 * @param {string} data.telefonoProspecto - Número de WhatsApp
 * @param {string} data.motivo - Motivo de escalamiento o último mensaje
 * @param {string} data.conversacionId - ID de la conversación para crear link directo
 */
export async function notificarEscalamientoAdmin({ adminEmail, nombreProspecto, telefonoProspecto, motivo, conversacionId }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ No se ha configurado RESEND_API_KEY. No se enviará correo de alerta.')
    return { success: false, error: 'API Key missing' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { data, error } = await resend.emails.send({
      from: 'Sistema Total English <onboarding@resend.dev>', // Por defecto Resend permite Enviar a ti mismo desde onboarding.
      to: adminEmail,
      subject: `🚨 Intervención Humana Requerida: ${nombreProspecto}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="background-color: #ef4444; padding: 15px; border-radius: 6px 6px 0 0;">
            <h2 style="color: white; margin: 0;">🚨 Acción Requerida en CRM</h2>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 16px; color: #334155;">
              Hola Admin,
            </p>
            <p style="font-size: 16px; color: #334155;">
              El asesor virtual <strong>AlexIA</strong> ha escalado una conversación contigo debido a que no pudo resolver la duda o el prospecto solicitó un humano explícitamente.
            </p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Prospecto:</strong> ${nombreProspecto || 'Desconocido'}</p>
              <p style="margin: 0 0 10px 0;"><strong>WhatsApp:</strong> ${telefonoProspecto || 'N/A'}</p>
              <p style="margin: 0;"><strong>Motivo / Último Mensaje:</strong> <em>"${motivo}"</em></p>
            </div>

            <a href="https://total-english-crm.vercel.app/inbox?id=${conversacionId}" 
               style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
              Ir al Inbox ahora
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">
            Total English - Sistema CRM Notificador Automático.
          </p>
        </div>
      `
    })

    if (error) {
      console.error('❌ Error enviando email con Resend:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('❌ Excepción enviando email con Resend:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Manda un correo de alerta al administrador cuando se agenda una nueva cita.
 */
export async function notificarCitaAdmin({ adminEmail, nombreAlumno, fecha, hora, curso, nivel }) {
  if (!process.env.RESEND_API_KEY) return { success: false, error: 'API Key missing' }
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { data, error } = await resend.emails.send({
      from: 'Sistema Total English <onboarding@resend.dev>',
      to: adminEmail,
      subject: `📅 Nueva Cita Agendada: ${nombreAlumno}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="background-color: #00236f; padding: 15px; border-radius: 6px 6px 0 0;">
            <h2 style="color: white; margin: 0;">📅 Nueva Cita Confirmada</h2>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 16px; color: #334155;"><strong>Alumno:</strong> ${nombreAlumno}</p>
            <p style="font-size: 16px; color: #334155;"><strong>Fecha:</strong> ${fecha}</p>
            <p style="font-size: 16px; color: #334155;"><strong>Hora:</strong> ${hora}</p>
            <p style="font-size: 16px; color: #334155;"><strong>Curso:</strong> ${curso}</p>
            <p style="font-size: 16px; color: #334155;"><strong>Nivel:</strong> ${nivel}</p>
            
            <a href="https://total-english-crm.vercel.app/citas" 
               style="display: inline-block; background-color: #00236f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
              Ver Calendario de Citas
            </a>
          </div>
        </div>
      `
    })
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

