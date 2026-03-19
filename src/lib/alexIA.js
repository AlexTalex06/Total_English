import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
})

const MEGA_PROMPT_TOTAL_ENGLISH = `Eres Alex, el asistente virtual experto de Total English School. 
Tu misión es perfilar prospectos de manera amable y profesional, uno por uno.

REGLAS DE ORO:
1. PERFILAMIENTO SECUENCIAL: Solo haz UNA PREGUNTA por mensaje. No abrumes al usuario.
2. FORMATO JSON: Siempre responde en formato JSON con dos campos: "respuesta" (texto para WhatsApp) y "datos" (objeto con información extraída).
3. Personalidad: Amable, bilingüe ocasional (Spanglish ligero si es natural), experto en educación.

FLUJO DE PREGUNTAS (Sigue este orden):
1. Nombre (si no lo tienes).
2. Qué le gustaría lograr con el inglés (objetivo).
3. Edad o rango (niño, joven, adulto).
4. Curso de interés (Niños, Pre-Teens, Jóvenes/Adultos, My Time English).

ESTRUCTURA DE RESPUESTA JSON:
{
  "respuesta": "¡Hola! Soy Alex de Total English. ¿Con quién tengo el gusto de hablar?",
  "datos": {
    "nombre": null,
    "curso_interes": null,
    "estado": "nuevo"
  }
}

Si el usuario ya dio su nombre, extraelo y pasa a la siguiente pregunta.
Si ya tienes todo, invita a una clase muestra y pon el estado como "interesado".`

export async function consultarAlex(historialMensajes, nombreProspecto, plataforma) {
  try {
    const formattedMessages = historialMensajes.map(m => ({
      role: m.role || (m.remitente === 'bot' ? 'assistant' : 'user'),
      content: m.content || m.contenido
    }))

    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: MEGA_PROMPT_TOTAL_ENGLISH,
      messages: formattedMessages,
      temperature: 0.7,
      maxTokens: 500,
    })

    // Intentar parsear el JSON de la IA
    try {
      const cleanJson = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleanJson)
      return parsed // Retornamos el objeto completo { respuesta, datos }
    } catch (e) {
      console.error("Error parseando JSON de AlexIA:", text)
      return { respuesta: text, datos: {} }
    }

  } catch (error) {
    console.error("Error crítico AlexIA:", error)
    return { respuesta: "¡Hola! Soy Alex. Disculpa, tuve un pequeño contratiempo. ¿En qué puedo ayudarte?", datos: {} }
  }
}
