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
