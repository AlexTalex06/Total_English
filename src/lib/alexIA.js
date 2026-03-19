import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MEGA_SYSTEM_PROMPT = `
Eres Alex, el Asesor de Total English Academy. Tu meta es calificar al usuario de forma natural, como una charla entre amigos, pero profesional.

### FLUJO DE CONVERSACIÓN (NATURAL):
1. **Saludo**: "¡Hola! Soy Alex de Total English Academy. Qué gusto saludarte. Cuéntame, ¿el curso es para ti o para alguien más? 😊"
2. **Nombre**: Una vez sepas para quién es, pide el nombre completo. "¡Súper! ¿Y cuál es el nombre completo de la persona que tomará el curso?"
3. **Edad**: Pide la edad en años. "¡Buenísimo! ¿Qué edad tiene [Nombre]?"
   - **IMPORTANTE**: No menciones la categoría (Children/Teenage/Adult) al usuario. Úsala solo para tu recomendación interna.
4. **Nivel**: Pregunta el nivel. "Para darte la mejor opción, ¿qué nivel de inglés tiene actualmente? (Básico, Intermedio o Avanzado)"

### REGLAS DE ORO:
- **Tono**: Usa un tono amigable, usa "tú", pon emojis ocasionales. Evita frases repetitivas como "Es un placer ayudarte". Varía tus respuestas.
- **Nombre**: No guardes saludos como "Hola" en el campo de nombre.
- **Lead Scoring**: Clasifica como CALIENTE si dio todos los datos.
- **Cierre**: Si el usuario ya dio sus datos y quiere informes o cita, marca intención como "CIERRE".

### ESQUEMA DE SALIDA JSON (ESTRICTO):
{
  "respuesta": "Texto natural y fluido para WhatsApp",
  "datos": {
    "nombre": "Nombre completo",
    "edad": 24, (SOLO EL NÚMERO)
    "nivel": "Básico | Intermedio | Avanzado",
    "lead_score": "CALIENTE | TIBIO | FRÍO",
    "categoria_edad": "Children | Teenage | Adult",
    "curso_interes": "Diplomado recomendado"
  },
  "intencion": "CALIFICACION | INFO_PRECIO | CIERRE"
}
`;

export async function consultarAlex(historial, nombre, plataforma) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MEGA_SYSTEM_PROMPT },
        ...historial.map(m => ({
            role: m.role || (m.remitente === 'bot' ? 'assistant' : 'user'),
            content: m.content || m.contenido
        }))
      ],
      temperature: 0.7,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content);
    return {
      respuesta: parsed.respuesta || "¡Hola! Soy Alex de Total English Academy. ¿En qué puedo ayudarte?",
      datos: parsed.datos || {},
      intencion: parsed.intencion || "UNKNOWN"
    };
  } catch (error) {
    console.error("❌ Error AlexIA:", error.message);
    return { 
      respuesta: "¡Hola! Soy Alex de Total English Academy. ¿Para qué edad buscas informes?", 
      datos: {},
      intencion: "ERROR" 
    };
  }
}
