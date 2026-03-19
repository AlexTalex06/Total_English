const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Cargar .env.local manualmente para evitar dependencia de dotenv
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

async function check() {
  console.log('--- 🔍 DIAGNÓSTICO DE IA ---');
  
  // 1. Verificar conversaciones
  const { data: convs, error: e1 } = await supabase
    .from('conversaciones')
    .select('id, id_plataforma, actualizado_en, asignado_a_humano, prospectos(nombre)')
    .order('actualizado_en', { ascending: false })
    .limit(5);

  if (e1) return console.error('Error Supabase:', e1);

  console.log('Últimas 5 conversaciones:');
  convs.forEach(c => {
    console.log(`- [${c.id_plataforma}] ${c.prospectos?.nombre || '?'}: Asignado a Humano? ${c.asignado_a_humano}`);
  });

  // 2. Verificar mensajes
  const { data: msgs, error: e2 } = await supabase
    .from('mensajes')
    .select('remitente, contenido, creado_en')
    .order('creado_en', { ascending: false })
    .limit(10);

  if (e2) return console.error('Error Mensajes:', e2);

  console.log('\nÚltimos 10 mensajes:');
  msgs.forEach(m => {
    console.log(`- [${m.remitente}] [${m.creado_en}] ${m.contenido.substring(0, 50)}...`);
  });
}

check();
