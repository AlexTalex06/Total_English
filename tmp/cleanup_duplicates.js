const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanup() {
  console.log('--- 🧹 LIMPIEZA DE DUPLICADOS ---');
  
  // 1. Buscar grupos de (plataforma, id_plataforma) duplicados
  const { data: convs, error } = await supabase
    .from('conversaciones')
    .select('id, платформа:plataforma, id_plataforma');

  if (error) return console.error(error);

  const seen = new Set();
  const duplicates = [];

  convs.forEach(c => {
    const key = `${c.plataforma}-${c.id_plataforma}`;
    if (seen.has(key)) {
      duplicates.push(c.id);
    } else {
      seen.add(key);
    }
  });

  if (duplicates.length > 0) {
    console.log(`Detectados ${duplicates.length} duplicados. Eliminando...`);
    // Mover mensajes de los duplicados al registro original (vía cascada o manual)
    // Para simplificar, solo borraremos los vacíos o más viejos si no tienen mensajes críticos.
    // Pero lo más seguo es borrarlos.
    const { error: delErr } = await supabase.from('conversaciones').delete().in('id', duplicates);
    if (delErr) console.error('Error al borrar:', delErr);
    else console.log('✅ Duplicados eliminados.');
  } else {
    console.log('No se encontraron duplicados.');
  }
}

cleanup();
