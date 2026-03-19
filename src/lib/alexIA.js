import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
})

const PROMPT_SISTEMA = `Eres Alex, asistente virtual de Total English.
Tu misión es perfilar un prospecto preguntando UNA cosa a la vez.

1. Nombre.
2. Objetivo de estudio.
3. Rango de edad (Niño, joven, adulto).
4. Curso sugerido.

RESPONDE SIEMPRE EN JSON:
{
  "respuesta": "Texto para WhatsApp",
  "datos": { "nombre": "extraido o null", "curso_interes": "extraido o null" }
}`

export async function consultarAlex(historial, nombre, plataforma) {
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: PROMPT_SISTEMA,
      messages: historial,
      temperature: 0.7,
    });

    let respuestaFinal = text;
    let datosFinales = {};

    try {
      // Intento robusto de extraer JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        respuestaFinal = parsed.respuesta || text;
        datosFinales = parsed.datos || {};
      }
    } catch (e) {
      console.warn("Error parseando Alex JSON:", e);
    }

    return { respuesta: respuestaFinal, datos: datosFinales };
  } catch (error) {
    console.error("Error AlexIA:", error);
    return { respuesta: "¡Hola! Soy Alex. Disculpa la demora, ¿en qué puedo apoyarte hoy?", datos: {} };
  }
}
