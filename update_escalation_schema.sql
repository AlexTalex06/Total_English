ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS escalation_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalation_category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz DEFAULT NULL;
