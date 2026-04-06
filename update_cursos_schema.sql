-- ============================================
-- Total English - Actualización de Cursos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Agregar columnas de edad para control de la inteligencia artificial
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS edad_minima INTEGER DEFAULT 0;
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS edad_maxima INTEGER DEFAULT 99;

-- Rezagos de seguridad por si acaso
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo cursos" ON cursos FOR ALL USING (true) WITH CHECK (true);
