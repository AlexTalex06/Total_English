-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  email text UNIQUE NOT NULL,
  rol text DEFAULT 'Asesor' CHECK (rol IN ('Administrador', 'Asesor')),
  fecha_creacion timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de Cursos
CREATE TABLE IF NOT EXISTS cursos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  beneficios text,
  duracion text,
  nivel text,
  precio numeric,
  capacidad integer,
  edad_minima integer,
  edad_maxima integer,
  imagen_url text, -- Imagen subida a Storage
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Prospectos (CRM Principal)
CREATE TABLE IF NOT EXISTS prospectos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telefono text UNIQUE NOT NULL, -- ID de WhatsApp
  nombre text NOT NULL, -- Contacto original (Tutor/Madre)
  nombre_alumno text, -- Alumno de interés
  parentesco text, -- Relación (Para mi hijo, Para mí)
  edad integer,
  categoria_edad text, -- Children, Pre-Teens, etc.
  nivel text,
  horario text,
  curso_interes text,
  estado text DEFAULT 'Borrador' CHECK (estado IN ('Borrador', 'Contactado', 'Interesado', 'Agendado', 'Convertido', 'Perdido')),
  lead_score text DEFAULT 'FRÍO', -- CALIENTE, TIBIO, FRIO
  pipeline_stage text DEFAULT 'nuevos', -- Kanban phase
  ultimo_contacto timestamp with time zone,
  creado_en timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. Tabla de Citas
CREATE TABLE IF NOT EXISTS citas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id uuid REFERENCES prospectos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora time NOT NULL,
  tipo text DEFAULT 'Asesoría',
  notas text,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada')),
  creado_en timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 5. Tabla de Conversaciones (Integración WhatsApp)
CREATE TABLE IF NOT EXISTS conversaciones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prospecto_id uuid REFERENCES prospectos(id) ON DELETE CASCADE,
  id_plataforma text NOT NULL, -- WhatsApp / FB Messenger
  estado text DEFAULT 'abierta',
  ultimo_mensaje timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 6. Tabla Mensajes (Historial para IA)
CREATE TABLE IF NOT EXISTS mensajes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversacion_id uuid REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente text NOT NULL CHECK (remitente IN ('usuario', 'bot', 'agente')),
  tipo text DEFAULT 'texto',
  contenido text,
  creado_en timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 7. Configuracion Global del Bot
CREATE TABLE IF NOT EXISTS configuracion_bot (
  id integer PRIMARY KEY DEFAULT 1,
  nombre_agente text DEFAULT 'Alex',
  temperatura numeric DEFAULT 0.7,
  agenda_dias text DEFAULT 'Lunes a Sábado',
  agenda_inicio text DEFAULT '09:00',
  agenda_fin text DEFAULT '18:00',
  agenda_brecha integer DEFAULT 30,
  actualizado_en timestamp with time zone
);

-- 8. Tabla de Campañas de Marketing
CREATE TABLE IF NOT EXISTS campanas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  nombre_plantilla text NOT NULL,
  mensaje text,
  estado text DEFAULT 'borrador', -- borrador, activa, completada
  publico_estado text DEFAULT 'Todos',
  publico_curso text DEFAULT 'Todos',
  canal text DEFAULT 'WhatsApp',
  imagen_url text, -- Imagen flyer promocional
  alcance integer DEFAULT 0,
  creado_en timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Insertar configuración inicial
INSERT INTO configuracion_bot (id, nombre_agente, temperatura) VALUES (1, 'Alex', 0.7) ON CONFLICT (id) DO NOTHING;
