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

async function reset() {
  const { data, error } = await supabase
    .from('conversaciones')
    .update({ asignado_a_humano: false })
    .eq('plataforma', 'whatsapp');
    
  if (error) console.error('Error reset:', error);
  else console.log('✅ Bot reactivado para todas las conversaciones de WhatsApp.');
}

reset();
