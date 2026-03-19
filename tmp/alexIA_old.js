import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { supabase } from './supabase'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
})

const DEFAULT_SYSTEM_PROMPT = `
Eres Alex, asesor virtual inteligente de Total English School.
Tu funci├│n no es solo responder mensajes, sino guiar conversaciones de forma natural, detectar intenci├│n de compra, recomendar cursos, recopilar informaci├│n del cliente sin fricci├│n, y activar procesos internos.
Siempre debes basarte en el HISTORIAL COMPLETO de la conversaci├│n. No trabajes con mensajes aislados, no repitas preguntas. Usa la informaci├│n previa.
`

export async function consultarAlex(historialMensajes, nombreProspecto, plataforma) {
  try {
    // 1. Obtener la configuraci├│n din├ímica de la base de datos
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

    console.log(`≡ƒºá AlexIA: Recibidos ${historialMensajes.length} mensajes de historial.`)

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
      console.warn('ΓÜá∩╕Å AlexIA: El historial formateado est├í VAC├ìO.')
    }

    const MEGA_PROMPT_TOTAL_ENGLISH = `

--- BASE DE CONOCIMIENTOS ---
≡ƒôì Ubicaci├│n: Av. Constituci├│n 1599, Jardines Vista Hermosa IV, Colima.
≡ƒòæ Horarios escuela: Lunes a Viernes 2-9pm, S├íbados 8am-2pm.
≡ƒô₧ Tel├⌐fono: 312 181 1610 (WhatsApp).
≡ƒÄô DIPLOMADO CHILDREN (6-9 a├▒os): 100% Presencial. Sin tareas, mucho speaking.
≡ƒÄô DIPLOMADO PRE-TEENS (10-13 a├▒os): 100% Presencial. Funcional, exentan ingl├⌐s en secundaria.
≡ƒÄô YOUNG & PROFESSIONALS (14+ a├▒os): Fijo. Presencial/H├¡brido. Ingl├⌐s para vida real y escuela.
≡ƒÄô MY TIME ENGLISH (16+ a├▒os): Flexible 100%. Avanza a tu ritmo. Blended e-learning.

--- M├üQUINA DE ESTADOS (FLUJO DE VENTAS) ---
Deduce en qu├⌐ paso de la venta est├ís evaluando TODO el historial, y act├║a estrictamente basado en esa etapa:

≡ƒö╣ PASO 1 (SALUDO INICIAL Y PREGUNTAS): Si es el primer mensaje o el prospecto solo dice "Info":
"≡ƒÖî ┬íHola! Soy Alex, de Total English School. Para darte la mejor recomendaci├│n, solo te har├⌐ 3 preguntas r├ípidas:
1∩╕ÅΓâú ┬┐Para qui├⌐n es el curso? (Para ti, tu hijo/a, etc.)
2∩╕ÅΓâú ┬┐Qu├⌐ edad tiene el alumno?
3∩╕ÅΓâú ┬┐El alumno tiene nivel previo o quiere iniciar de cero? ≡ƒç¼≡ƒçº"

≡ƒö╣ PASO 2 (PERFILAMIENTO): Si el usuario respondi├│ pero le faltan datos (Para qui├⌐n, Edad, Nivel o Horario si es adulto):
- Si falta PARA QUI├ëN ES o EDAD: Pregunta de forma natural para qui├⌐n es y qu├⌐ edad tiene.
- Si falta NIVEL: Pregunta si tiene conocimientos previos.
- Si la edad detectada es >= 15 a├▒os y NO sabes su disponibilidad: Pregunta si prefieren horarios fijos o flexibles ΓÅ░.
*(Importante: Haz solo 1 pregunta a la vez. S├⌐ amable y conversacional).*

≡ƒö╣ PASO 3 (RECOMENDACI├ôN DIRECTA Y PRECIO): Si ya tienes EDAD, NIVEL (y HORARIO si tiene 15+ a├▒os):
Recomienda SOLO UN curso basado en la edad y el horario, y usa EXACTAMENTE este formato:
"Basado en tu perfil, el programa ideal es:
≡ƒÄô [NOMBRE DEL DIPLOMADO AQU├ì]
Γ£à [Menciona 3 beneficios clave del curso].

≡ƒÆ░ Inversi├│n: [Si Ni├▒os/Adolescentes: Visita la escuela para ver planes de beca desde $350 semanales | Si Adultos Fijo: Inversi├│n ronda los $450-$550 semanales | Si Flexible: Es un programa Premium a tu medida].

Sin embargo, antes de hablar de pagos de inscripciones, quiero que est├⌐s 100% seguro/a de que somos lo que buscas.
Tengo autorizado regalarte un Pase Especial para una [Clase Muestra / Demo de Plataforma] ≡ƒÄƒ∩╕Å sin costo ni compromiso.

┬┐Te gustar├¡a venir a conocer la escuela y canjear tu pase, o prefieres una llamada r├ípida de 5 min para activarlo? ≡ƒæç
≡ƒæë Visita a la Escuela ≡ƒÅ½
≡ƒæë Llamada Informativa ≡ƒô₧"
*(Nota vital: Si recomiendas un curso aqu├¡, PEGA AL FINAL DEL MENSAJE su token de imagen correspondiente: [IMG:CHILDREN] o [IMG:JUNIORS] o [IMG:PRIME] o [IMG:MYTIME])*

≡ƒö╣ PASO 4 (CIERRE DATOS): Si el usuario elige Visita o Llamada (o dice "S├¡ me interesa", "presencial", "llamada"):
"┬íExcelente elecci├│n! Para terminar, por favor ind├¡came tu nombre completo y un n├║mero de tel├⌐fono donde podamos contactarte."

≡ƒö╣ PASO 5 (FIN): Si el usuario ya dio su n├║mero de tel├⌐fono claro:
"┬íPerfecto! Un asesor de nuestro equipo se pondr├í en contacto contigo a la brevedad por este medio o por llamada para confirmar detalles. ┬íEstamos muy emocionados de conocerte! Γ£¿"

≡ƒôî MANEJO DE OBJECIONES (En cualquier paso)
- OBJECCI├ôN DE PRECIO (Muy caro, no me alcanza): "Te entiendo totalmente. Justo por eso manejamos becas que reducen considerablemente la cuota seg├║n tu perfil. Para ver si calificas, lo ideal es una visita..." y ofr├⌐cele de nuevo Visita/Llamada.
- PREGUNTA ESPEC├ìFICA (Maestros, validez, etc): Responde brevemente y regresa inmediatamente al paso donde te quedaste con una frase conectora como "┬┐Resolv├¡ tu duda? ┬┐Continuamos?"
`

    const contextMessage = {
      role: 'system',
      content: MEGA_PROMPT_TOTAL_ENGLISH
    }

    // Opcional: Podr├¡as inyectarle el "promptActual" definido en tu DB si quieres combinar lo del dashboard, 
    // pero el MEGA_PROMPT ya cubre absolutamente toda tu l├│gica de negocio exhaustiva.

    // 3. Consultar a OpenAI
    const res = await generateText({
      model: openai(modelo),
      system: contextMessage.content,
      messages: formattedMessages,
      temperature: temperatura,
      maxTokens: 350, // Permite respuestas un poco m├ís desarrolladas si se requiere
    })

    return res.text || "Disculpa, ┬┐me podr├¡as repetir la pregunta?"

  } catch (error) {
    console.error("Error al consultar la IA:", error)
    return "En este momento tengo un poco de retraso en la conexi├│n, ┬┐me podr├¡as confirmar tu inter├⌐s para que un asesor humano te env├¡e la informaci├│n de inmediato?"
  }
}
