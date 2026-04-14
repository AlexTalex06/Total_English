import { supabase } from './supabase'

/**
 * Registra un evento en el historial del prospecto.
 * Estilo 'Mandados' para trazabilidad total.
 */
export async function registrarEvento(prospectoId, tipo, descripcion, metadatos = {}) {
  const { error } = await supabase.from('prospecto_eventos').insert([
    {
      prospecto_id: prospectoId,
      tipo_evento: tipo,
      descripcion,
      metadatos
    }
  ])
  if (error) console.error('Error al registrar evento:', error)
}

/**
 * Cambia el estado de un prospecto y registra el evento automáticamente.
 */
export async function cambiarEstadoProspecto(prospectoId, nuevoEstado, motivo = '') {
  const { data, error } = await supabase
    .from('prospectos')
    .update({ 
      estado: nuevoEstado, 
      actualizado_en: new Date().toISOString() 
    })
    .eq('id', prospectoId)
    .select()
    .single()

  if (error) throw error

  await registrarEvento(
    prospectoId, 
    'cambio_estado', 
    `Estado cambiado a ${nuevoEstado}. ${motivo}`,
    { nuevo_estado: nuevoEstado, motivo }
  )

  return data
}

/**
 * Pausa el bot y escala la conversación a un humano.
 */
export async function escalarAHumano(conversacionId, prospectoId, motivo, categoria = 'otro') {
  const now = new Date().toISOString()
  
  // 1. Pausar bot y poner motivo
  const { error: convError } = await supabase
    .from('conversaciones')
    .update({
      asignado_a_humano: true,
      escalation_reason: motivo,
      escalation_category: categoria,
      escalated_at: now
    })
    .eq('id', conversacionId)

  if (convError) throw convError

  // 2. Registrar en historial del prospecto
  if (prospectoId) {
    await registrarEvento(
      prospectoId,
      'escalamiento',
      `Bot pausado: ${motivo}`,
      { categoria, conversacion_id: conversacionId }
    )
  }
}

/**
 * Agendar cita y actualizar prospecto a 'agendado' en un solo paso logicamente.
 */
export async function agendarCitaTransaccional(prospectoId, datosCita) {
  // 1. Crear la cita
  const { data: cita, error: citaError } = await supabase
    .from('citas')
    .insert([{ ...datosCita, prospecto_id: prospectoId }])
    .select()
    .single()

  if (citaError) throw citaError

  // 2. Cambiar estado del prospecto
  await cambiarEstadoProspecto(prospectoId, 'agendado', `Cita programada para el ${datosCita.fecha}`)

  return cita
}
