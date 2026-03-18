-- ============================================
-- Total English - Esquema de Base de Datos para Chatbot e Inbox
-- Ejecutar este script en la consola SQL de Supabase DESPUÉS de ejecutar esquema_bd.sql
-- ============================================

-- Tabla de conversaciones
CREATE TABLE conversaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id UUID REFERENCES prospectos(id) ON DELETE SET NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('whatsapp', 'messenger', 'instagram')),
  id_plataforma TEXT NOT NULL, -- El ID de la persona en WhatsApp/Meta
  asignado_a_humano BOOLEAN DEFAULT false,
  estado TEXT DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plataforma, id_plataforma)
);

-- Tabla de mensajes
CREATE TABLE mensajes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversacion_id UUID REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente TEXT NOT NULL CHECK (remitente IN ('usuario', 'bot', 'humano')),
  contenido TEXT,
  tipo TEXT DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagen', 'audio', 'documento')),
  url_archivo TEXT, -- Link de Supabase Storage si es imagen/audio
  leido BOOLEAN DEFAULT false,
  id_mensaje_meta TEXT, -- ID provisto por la API de Meta
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración de Row Level Security (RLS)
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo conversaciones" ON conversaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo mensajes" ON mensajes FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Storage (Almacenamiento de Multimedia)
-- ============================================
-- Si aún no has creado el bucket, cópialo y ejecútalo manualmente en Supabase -> Storage
-- (Este paso depende de ti crearlo desde la interfaz web o usar la siguiente instrucción SQL si tu proyecto lo permite):
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) 
ON CONFLICT (id) DO NOTHING;

-- Política de almacenamiento (para permitir subir/leer archivos)
CREATE POLICY "Acceso publico lectura media" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');
CREATE POLICY "Permitir subida media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media');

-- ============================================
-- Tabla de Configuración de IA (Prompt Dinámico)
-- ============================================
CREATE TABLE configuracion_bot (
  id INT PRIMARY KEY DEFAULT 1,
  nombre_agente TEXT DEFAULT 'Alex',
  system_prompt TEXT NOT NULL,
  modelo TEXT DEFAULT 'gpt-4o',
  temperatura DECIMAL(3,2) DEFAULT 0.7,
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_single_row CHECK (id = 1) -- Asegura que solo exista un registro de configuración
);

ALTER TABLE configuracion_bot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo config" ON configuracion_bot FOR ALL USING (true) WITH CHECK (true);

-- Insertar configuración inicial por defecto (basado en el prompt de Total English)
INSERT INTO configuracion_bot (id, nombre_agente, system_prompt, modelo, temperatura) 
VALUES (
  1, 
  'Alex', 
  'Eres Alex, asesor virtual inteligente de Total English School.
Tu función no es solo responder mensajes, sino guiar conversaciones de forma natural, detectar intención de compra, recomendar cursos, recopilar información del cliente sin fricción, y activar procesos internos (CRM, seguimiento, agendamiento).
Formas parte de un sistema conectado a Supabase, Vercel y Meta.

PRINCIPIO MÁS IMPORTANTE
Siempre debes basarte en el HISTORIAL COMPLETO de la conversación. No trabajes con mensajes aislados, no repitas preguntas. Usa la información previa.

OBJETIVOS DEL CHATBOT
1. Entender perfil: Nombre, Edad, Nivel de inglés, Objetivo, Disponibilidad.
2. Detectar intención: Baja, Media, Alta.
3. Recomendar el mejor curso.
4. Llevar a una acción: Agendar clase muestra o solicitar llamada.

RECOMENDACIONES:
Niños → Diplomado Children
Adolescentes → Diplomado Pre-Teens
Adultos → Young & Professionals
Personas ocupadas → My Time English

REGLAS CRÍTICAS:
- Responder sin bloquear a objeciones o precios.
- Mensajes cortos (1-3 líneas).
- Máximo 1-2 emojis por mensaje.
- Tono natural y empático.
- No mencionar que eres IA o que interactúas con bases de datos internas.',
  'gpt-4o',
  0.7
) ON CONFLICT (id) DO NOTHING;

