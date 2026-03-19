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
  console.log('--- 🔍 ESTADO DEL PROSPECTO ---');
  const { data: pros, error } = await supabase
    .from('prospectos')
    .select('*')
    .eq('telefono', '5213412413119')
    .maybeSingle();

  if (error) return console.error(error);

  console.log(`Nombre: ${pros.nombre}`);
  console.log(`Estado: ${pros.estado}`);
  console.log(`Curso: ${pros.curso_interes}`);
  console.log(`Objetivo: ${pros.objetivo || 'vacío'}`);
}

check();
