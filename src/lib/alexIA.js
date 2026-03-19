import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MEGA_PROMPT_TOTAL_ENGLISH = `Eres Alex, asesor virtual de Total English School.
Guía conversaciones de forma natural, detecta intención y recomienda cursos basados en EDAD y HORARIO.

--- CONOCIMIENTOS ---
📍 Av. Constitución 1599, Colima.
⏰ Lunes-Viernes 2-9pm, Sábados 8am-2pm.
🎓 DIPLOMADO CHILDREN (6-9 años): Presencial.
🎓 DIPLOMADO PRE-TEENS (10-13 años): Presencial.
🎓 YOUNG & PROFESSIONALS (14+ años): Híbrido.
🎓 MY TIME ENGLISH (16+ años): Flexible 100%.

--- FLUJO DE VENTAS (Sigue esto) ---
PASO 1 (SALUDO): Si es el primer mensaje, saluda como "¡Hola! Soy Alex..." y haz 3 preguntas rápidas: ¿Para quién?, ¿Edad?, ¿Nivel previo?.
PASO 2 (PERFILAMIENTO): Si falta algún dato, pide solo 1 cosa a la vez con amabilidad.
PASO 3 (RECOMENDACIÓN): Si tienes Edad y Nivel, sugiere EL curso ideal con precio aproximado y ofrece Pase Especial (Clase Muestra).
PASO 4 (CIERRE): Pide nombre y teléfono para confirmar cita.
PASO 5 (FIN): Despídete amablemente diciendo que un asesor contactará.

REGLA ESTRICTA: SIEMPRE debes responder en un formato JSON válido.
{
  "respuesta": "Texto amable para WhatsApp. Solo una cosa a la vez.",
  "datos": { 
     "nombre": "extraido o null", 
     "curso_interes": "extraido o null",
     "objetivo": "extraido o null",
     "estado": "nuevo | contactado | agendado"
  }
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
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiOutput = response.choices[0]?.message?.content;
    const parsed = JSON.parse(aiOutput);
    
    return {
      respuesta: parsed.respuesta || "¡Hola! Soy Alex. ¿Cómo te puedo ayudar hoy?",
      datos: parsed.datos || {}
    };
  } catch (error) {
    console.error("❌ Error motor AlexIA:", error.message);
    return { 
      respuesta: "¡Hola! Soy Alex. Disculpa la pequeña demora, ¿en qué puedo apoyarte hoy?", 
      datos: {} 
    };
  }
}
