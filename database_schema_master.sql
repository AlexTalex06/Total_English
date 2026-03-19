-- ============================================
-- Total English - Esquema de Base de Datos Maestro
-- Versión: 1.1 (Consolidada)
-- ============================================

-- 1. TABLA DE PROSPECTOS (CRM)
CREATE TABLE IF NOT EXISTS prospectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT,
  telefono TEXT,
  estado TEXT DEFAULT 'nuevo' CHECK (estado IN ('nuevo','en_proceso','contactado','agendado','cerrado')),
  curso_interes TEXT,
  edad TEXT,
  nivel TEXT,
  horario TEXT,
  lead_score TEXT,
  categoria_urgencia TEXT,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA DE CURSOS
CREATE TABLE IF NOT EXISTS cursos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  beneficios TEXT,
  duracion TEXT,
  nivel TEXT,
  imagen_url TEXT,
  precio DECIMAL(10,2),
  capacidad INTEGER DEFAULT 10,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA DE CITAS
CREATE TABLE IF NOT EXISTS citas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id UUID REFERENCES prospectos(id) ON DELETE SET NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmada','cancelada','completada')),
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE CAMPAÑAS
CREATE TABLE IF NOT EXISTS campanas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  mensaje TEXT,
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador','activa','programada','completada')),
  canal TEXT DEFAULT 'whatsapp',
  imagen_url TEXT,
  alcance INTEGER DEFAULT 0,
  engagement DECIMAL(5,2) DEFAULT 0,
  clics INTEGER DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA DE CONVERSACIONES (INBOX)
CREATE TABLE IF NOT EXISTS conversaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id UUID REFERENCES prospectos(id) ON DELETE SET NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('whatsapp', 'messenger', 'instagram')),
  id_plataforma TEXT NOT NULL, -- El ID de la persona en WhatsApp/Meta
  asignado_a_humano BOOLEAN DEFAULT false,
  estado TEXT DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  ultimo_mensaje TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plataforma, id_plataforma)
);

-- 6. TABLA DE MENSAJES
CREATE TABLE IF NOT EXISTS mensajes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversacion_id UUID REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente TEXT NOT NULL CHECK (remitente IN ('usuario', 'bot', 'humano')),
  contenido TEXT,
  tipo TEXT DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagen', 'audio', 'documento')),
  url_archivo TEXT,
  leido BOOLEAN DEFAULT false,
  id_mensaje_meta TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA DE CONFIGURACIÓN DE IA (ALEX)
CREATE TABLE IF NOT EXISTS configuracion_bot (
  id INT PRIMARY KEY DEFAULT 1,
  nombre_agente TEXT DEFAULT 'Alex',
  system_prompt TEXT NOT NULL,
  modelo TEXT DEFAULT 'gpt-4o',
  temperatura DECIMAL(3,2) DEFAULT 0.7,
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_single_row CHECK (id = 1)
);

-- ============================================
-- SEGURIDAD (RLS) Y POLÍTICAS
-- ============================================
ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_bot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo prospectos" ON prospectos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo cursos" ON cursos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo citas" ON citas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo campanas" ON campanas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo conversaciones" ON conversaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo mensajes" ON mensajes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo config" ON configuracion_bot FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DATOS INICIALES
-- ============================================
INSERT INTO configuracion_bot (id, nombre_agente, system_prompt, modelo, temperatura) 
VALUES (
  1, 
  'Alex', 
  'Eres Alex, asesor virtual inteligente de Total English School...', 
  'gpt-4o',
  0.7
) ON CONFLICT (id) DO NOTHING;
