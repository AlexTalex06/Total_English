-- ============================================
-- Total English - Esquema de Base de Datos
-- Ejecutar este script en la consola SQL de Supabase
-- ============================================

-- Tabla de prospectos (CRM)
CREATE TABLE prospectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT,
  telefono TEXT,
  estado TEXT DEFAULT 'nuevo' CHECK (estado IN ('nuevo','en_proceso','contactado','agendado','cerrado')),
  curso_interes TEXT,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de cursos
CREATE TABLE cursos (
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

-- Tabla de citas
CREATE TABLE citas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id UUID REFERENCES prospectos(id) ON DELETE SET NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmada','cancelada','completada')),
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de campañas
CREATE TABLE campanas (
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

-- Habilitar Row Level Security (RLS)
ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (para desarrollo - ajustar en producción)
CREATE POLICY "Permitir todo prospectos" ON prospectos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo cursos" ON cursos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo citas" ON citas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo campanas" ON campanas FOR ALL USING (true) WITH CHECK (true);
