-- ============================================
-- Total English - Actualización de Campañas
-- Ejecutar en Supabase SQL Editor
-- ============================================

ALTER TABLE campanas ADD COLUMN IF NOT EXISTS publico_estado TEXT DEFAULT 'Todos';
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS publico_curso TEXT DEFAULT 'Todos';
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS nombre_plantilla TEXT;

-- Reafirmar RLS
ALTER TABLE campanas ENABLE ROW LEVEL SECURITY;
