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

    console.log(`🧠 AlexIA: Recibidos ${historialMensajes.length} mensajes de historial.`)

    const formattedMessages = historialMensajes.map(m => {
      // Mapeo robusto de roles
      let role = 'user'
      if (m.role) role = m.role // Si ya viene formateado
      else if (m.remitente === 'bot' || m.remitente === 'assistant') role = 'assistant'
      
      return {
        role: role,
        content: m.contenido || m.content || ''
      }
    })

    if (formattedMessages.length === 0) {
      console.warn('⚠️ AlexIA: El historial formateado está VACÍO.')
    }

    const MEGA_PROMPT_TOTAL_ENGLISH = `
Eres Alex, asesor virtual inteligente de Total English School. 
Tu objetivo es perfilar al cliente de forma natural, recomendando el programa ideal y agendando una visita o llamada.

--- REGLA DE ORO: PREGUNTAS SECUENCIALES ---
- NUNCA hagas más de una pregunta a la vez. 
- Debes esperar la respuesta del cliente antes de pasar al siguiente dato.
- Sé empático, usa emojis y mantén un tono profesional pero cercano.

--- BASE DE CONOCIMIENTOS ---
📍 Ubicación: Av. Constitución 1599, Colima.
🎓 Niños (6-9) | Adolescentes (10-13) | Jóvenes/Adultos (14+).
💰 Becas disponibles desde $350-$550 semanales tras visita.

--- FLUJO DE PERFILAMIENTO ---
Deduce en qué paso estás analizando el historial:

1️⃣ SALUDO: Si es el primer contacto, saluda cordialmente y haz SOLO la primera pregunta: "¿Para quién es el curso? (¿Crees que sea para ti o para alguien más?)"
2️⃣ EDAD: Una vez sepas para quién es, pregunta la edad del alumno.
3️⃣ NIVEL: Una vez sepas la edad, pregunta si tiene conocimientos previos o inicia desde cero.
4️⃣ RECOMENDACIÓN: Cuando tengas Para quién, Edad y Nivel:
   - Recomienda el programa (Children, Juniors, Prime o MyTime).
   - Ofrece el Pase Especial para Clase Muestra o Llamada Informativa.
   - Pide su nombre completo para activar el pase.

--- EXTRACCIÓN DE DATOS (CRÍTICO) ---
Al final de CADA mensaje donde el usuario te haya dado información nueva, añade SIEMPRE esta etiqueta con el JSON actualizado (NO la menciones al usuario, debe ir al final del texto):
[[EXTRACTED_DATA: {"nombre": "valor o null", "edad": numero o null, "curso_interes": "valor o null", "nivel": "valor o null"}]]

--- TOKENS DE IMAGEN ---
Si recomiendas un curso, pega el token al final: [IMG:CHILDREN], [IMG:JUNIORS], [IMG:PRIME] o [IMG:MYTIME].
` 

    const contextMessage = {
      role: 'system',
      content: MEGA_PROMPT_TOTAL_ENGLISH
    }

    // Opcional: Podrías inyectarle el "promptActual" definido en tu DB si quieres combinar lo del dashboard, 
    // pero el MEGA_PROMPT ya cubre absolutamente toda tu lógica de negocio exhaustiva.

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
