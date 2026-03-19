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

async function check() {
  console.log('--- 🔍 AUDITORÍA DE MENSAJES ---');
  const { data: msgs, error } = await supabase
    .from('mensajes')
    .select('remitente, contenido, creado_en')
    .order('creado_en', { ascending: false })
    .limit(5);

  if (error) return console.error(error);

  msgs.forEach(m => {
    console.log(`[${m.creado_en}] ${m.remitente}: ${m.contenido}`);
  });
}

check();
