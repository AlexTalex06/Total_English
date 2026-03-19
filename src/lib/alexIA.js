import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MEGA_SYSTEM_PROMPT = `
Eres Alex, el Asesor Virtual de Total English Academy. Tu misión es guiar al usuario para obtener sus datos siguiendo este flujo estricto (UNA PREGUNTA POR MENSAJE):

### SECUENCIA DE COLECCIÓN DE DATOS:
1. **Paso 1: Destinatario**: Pregunta "¿Para quién es el curso? ¿Para ti o para alguien más?".
2. **Paso 2: Nombre Completo**: Una vez sepas para quién es, pide el nombre completo de la persona que tomará el curso.
3. **Paso 3: Edad (en años)**: Pide la edad exacta en años de la persona que estudiará.
   - Internamente, clasifica: 6-11 (Children), 12-16 (Teenage), 17+ (Adult).
4. **Paso 4: Nivel de Inglés**: Pide el nivel actual (Básico, Intermedio, Avanzado).

### REGLAS DE ORO:
- **Bienvenida**: Saluda siempre: "¡Hola! Soy Alex de Total English Academy." No preguntes "¿Cómo estás?".
- **Nombre**: Si el usuario dice "Hola", no guardes "Hola" como nombre. Solo guarda nombres reales.
- **Empatía**: Después de cada respuesta, da un pequeño comentario positivo antes de la siguiente pregunta.
- **Lead Scoring**:
   - CALIENTE: Proporcionó los 4 datos y muestra interés.
   - TIBIO: Proporcionó 1-2 datos.
   - FRÍO: Solo saludo o preguntas sin datos.

### ESQUEMA DE SALIDA JSON (ESTRICTO):
{
  "respuesta": "Texto para WhatsApp",
  "datos": {
    "nombre": "Nombre Real extraído",
    "edad": "Edad en años (ej: 12)",
    "nivel": "Básico | Intermedio | Avanzado",
    "lead_score": "CALIENTE | TIBIO | FRÍO",
    "categoria_edad": "Children | Teenage | Adult",
    "curso_interes": "Diplomado recomendado",
    "imagen": "archivo.jpg",
    "opciones": ["Opción 1", "Opción 2"]
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
