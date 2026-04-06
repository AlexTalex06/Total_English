-- ============================================
-- Total English - Tablas de Autenticación
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT DEFAULT 'asesor' CHECK (rol IN ('admin', 'asesor', 'viewer')),
  avatar_url TEXT,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA DE PERMISOS POR ROL
CREATE TABLE IF NOT EXISTS permisos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rol TEXT NOT NULL,
  modulo TEXT NOT NULL,
  puede_ver BOOLEAN DEFAULT true,
  puede_editar BOOLEAN DEFAULT false,
  puede_eliminar BOOLEAN DEFAULT false,
  UNIQUE(rol, modulo)
);

-- RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo permisos" ON permisos FOR ALL USING (true) WITH CHECK (true);

-- Agregar campo estado_flujo a conversaciones
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS estado_flujo TEXT DEFAULT 'INICIO';
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS datos_flujo JSONB DEFAULT '{}';

-- Agregar campos faltantes a prospectos
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS nombre_alumno TEXT;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS categoria_edad TEXT;

-- DATOS INICIALES DE PERMISOS
INSERT INTO permisos (rol, modulo, puede_ver, puede_editar, puede_eliminar) VALUES
  ('asesor', 'prospectos', true, true, false),
  ('asesor', 'inbox', true, true, false),
  ('asesor', 'citas', true, true, false),
  ('asesor', 'cursos', true, false, false),
  ('asesor', 'campanas', true, false, false),
  ('asesor', 'configuracion', false, false, false),
  ('viewer', 'prospectos', true, false, false),
  ('viewer', 'inbox', true, false, false),
  ('viewer', 'citas', true, false, false),
  ('viewer', 'cursos', true, false, false),
  ('viewer', 'campanas', true, false, false),
  ('viewer', 'configuracion', false, false, false)
ON CONFLICT (rol, modulo) DO NOTHING;
