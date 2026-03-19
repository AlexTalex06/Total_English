import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT_SISTEMA = `Eres Alex, asistente virtual de Total English.
Tu misión es perfilar un prospecto preguntando UNA sola cosa por mensaje.

FLUJO DE PREGUNTAS:
1. Nombre completo.
2. Objetivo (¿Para qué quiere el inglés?).
3. Rango de edad (Niño, joven, adulto).
4. Curso recomendado.

REGLA ESTRICTA: SIEMPRE debes responder en un formato JSON válido.
Estructura:
{
  "respuesta": "Texto amable para WhatsApp. Solo una pregunta a la vez.",
  "datos": { 
     "nombre": "extraido o null", 
     "curso_interes": "extraido o null",
     "objetivo": "extraido o null"
  }
}`;

export async function consultarAlex(historial, nombre, plataforma) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT_SISTEMA },
        ...historial.map(m => ({
            role: m.role || (m.remitente === 'bot' ? 'assistant' : 'user'),
            content: m.content || m.contenido
        }))
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiOutput = response.choices[0]?.message?.content;
    const parsed = JSON.parse(aiOutput);
    
    return {
      respuesta: parsed.respuesta || "¡Hola! Soy Alex. ¿Cómo te puedo ayudar?",
      datos: parsed.datos || {}
    };
  } catch (error) {
    console.error("❌ Error motor AlexIA (OpenAI SDK):", error.message);
    return { 
      respuesta: "¡Hola! Soy Alex de Total English school. ¿Con quién tengo el gusto de hablar?", 
      datos: {} 
    };
  }
}
