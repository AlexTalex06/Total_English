import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { supabase } from './supabase'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
})

const DEFAULT_SYSTEM_PROMPT = `
Eres Alex, asesor virtual inteligente de Total English School.
Tu función no es solo responder mensajes, sino guiar conversaciones de forma natural, detectar intención de compra, recomendar cursos, recopilar información del cliente sin fricción, y activar procesos internos.
Siempre debes basarte en el HISTORIAL COMPLETO de la conversación. No trabajes con mensajes aislados, no repitas preguntas. Usa la información previa.
`

export async function consultarAlex(historialMensajes, nombreProspecto, plataforma) {
  try {
    // 1. Obtener la configuración dinámica de la base de datos
    let promptActual = DEFAULT_SYSTEM_PROMPT
    let modelo = 'gpt-4o'
    let temperatura = 0.7

    const { data: config, error } = await supabase
      .from('configuracion_bot')
      .select('*')
      .eq('id', 1)
      .single()

    if (!error && config) {
      promptActual = config.system_prompt
      modelo = config.modelo || 'gpt-4o'
      temperatura = config.temperatura || 0.7
    }

    // 2. Preparar los mensajes para el AI SDK
    const formattedMessages = historialMensajes.map(m => ({
      role: m.remitente === 'usuario' ? 'user' : 'assistant',
      content: m.contenido
    }))

    const INSTRUCCION_OCULTA_MULTIMEDIA = `
---
INSTRUCCIÓN SECRETA DEL SISTEMA:
Eres capaz de enviar Flyers (imágenes) reales por WhatsApp. Si en esta respuesta estás recomendando OPORTUNO Y DIRECTAMENTE un nivel específico (y no lo has enviado antes), TIENES que colocar EXACTAMENTE UNO de estos tokens ocultos al puro final de tu mensaje:
- Si ofreces Diplomado Children (6 a 9 años), pega al final: [IMG:CHILDREN]
- Si ofreces Diplomado Pre-Teens/Juniors, pega al final: [IMG:JUNIORS]
- Si ofreces Young & Professionals / Diplomado Prime, pega al final: [IMG:PRIME]
- Si ofreces My Time English (para ocupados), pega al final: [IMG:MYTIME]
No incluyas corchetes extras ni menciones que enviarás una imagen de sistema, solo pega el token.`

    const contextMessage = {
      role: 'system',
      content: `Estás interactuando con ${nombreProspecto || 'un prospecto'} a través de ${plataforma}. Tu prompt maestro es: \n\n${promptActual}\n\n${INSTRUCCION_OCULTA_MULTIMEDIA}`
    }

    // 3. Consultar a OpenAI
    const res = await generateText({
      model: openai(modelo),
      system: contextMessage.content,
      messages: formattedMessages,
      temperature: temperatura,
      maxTokens: 350, // Permite respuestas un poco más desarrolladas si se requiere
    })

    return res.text || "Disculpa, ¿me podrías repetir la pregunta?"

  } catch (error) {
    console.error("Error al consultar la IA:", error)
    return "En este momento tengo un poco de retraso en la conexión, ¿me podrías confirmar tu interés para que un asesor humano te envíe la información de inmediato?"
  }
}
