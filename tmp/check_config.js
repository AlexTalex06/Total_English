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
  const { data: config, error } = await supabase
    .from('configuracion_bot')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) console.error('Error config:', error);
  else {
    console.log('--- 🤖 CONFIG BOT ---');
    console.log(`Modelo: ${config.modelo}`);
    console.log(`Temperatura: ${config.temperatura}`);
    // console.log(`Prompt: ${config.system_prompt.substring(0, 100)}...`);
  }
}

check();
