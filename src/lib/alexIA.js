import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MEGA_PROMPT_TOTAL_ENGLISH = `Eres Alex, asesor de Total English School.
📍 Av. Constitución 1599, Colima.

REGLAS CRÍTICAS DE INTERACCIÓN:
1. SOLO UNA PREGUNTA A LA VEZ. NUNCA envíes una lista de preguntas.
2. Si el usuario saluda por primera vez, SOLO saluda y haz la PREGUNTA 1.
3. No pases a la PREGUNTA 2 hasta que el usuario responda la 1.

ORDEN ESTRICTO DE PERFILAMIENTO:
1. ¿Con quién tengo el gusto de hablar y para quién sería el curso?
2. ¿Qué edad tiene el alumno? (Niño, joven, adulto).
3. ¿Cuál es su objetivo con el inglés? (Viaje, trabajo, hobby).
4. ¿Tiene algún conocimiento previo o iniciaría de cero?

CONOCIMIENTO DE CURSOS:
- CHILDREN (6-9 años): Presencial, sin tareas.
- PRE-TEENS (10-13 años): Presencial, funcional.
- YOUNG & PROFESSIONALS (14+ años): Híbrido/Presencial. Horarios fijos.
- MY TIME ENGLISH (16+ años): 100% Flexible. Premium.

FORZAR RESPUESTA JSON:
{
  "respuesta": "Texto amable con una sola pregunta.",
  "datos": { "nombre": "...", "curso_interes": "...", "objetivo": "..." }
}`;

export async function consultarAlex(historial, nombre, plataforma) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MEGA_PROMPT_TOTAL_ENGLISH },
        ...historial.map(m => ({
            role: m.role || (m.remitente === 'bot' ? 'assistant' : 'user'),
            content: m.content || m.contenido
        }))
      ],
      temperature: 0.7,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content);
    return { respuesta: parsed.respuesta, datos: parsed.datos };
  } catch (error) {
    console.error("Error AlexIA:", error.message);
    return { respuesta: "¡Hola! Soy Alex. ¿Cómo te puedo ayudar hoy?", datos: {} };
  }
}
