-- ============================================
-- Infraestructura para Historial y Escalamiento
-- ============================================

-- 1. Añadir columnas de escalamiento a 'conversaciones'
ALTER TABLE conversaciones 
ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
ADD COLUMN IF NOT EXISTS escalation_category TEXT DEFAULT 'otro',
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- 2. Crear tabla de historial de prospectos (Audit Trail)
CREATE TABLE IF NOT EXISTS prospecto_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id UUID REFERENCES prospectos(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL, -- 'creacion', 'cambio_estado', 'nota', 'escalamiento', 'cita'
  descripcion TEXT,
  metadatos JSONB DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS para la nueva tabla
ALTER TABLE prospecto_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo prospecto_eventos" ON prospecto_eventos FOR ALL USING (true) WITH CHECK (true);

-- 4. Comentarios para identificar las columnas
COMMENT ON COLUMN conversaciones.escalation_reason IS 'Razón por la cual el bot transfirió a un humano';
COMMENT ON COLUMN conversaciones.escalation_category IS 'Categoría del problema (pago, queja, pregunta_especifica)';
