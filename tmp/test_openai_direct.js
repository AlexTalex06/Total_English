const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const fs = require('fs');

// Cargar .env.local manualmente
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim();
});

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  compatibility: 'strict',
});

async function test() {
  console.log('--- 🧪 TEST DIRECTO OPENAI ---');
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'), // Probamos con mini que es más seguro
      system: 'Responde Hola',
      messages: [{ role: 'user', content: 'Hola' }],
    });
    console.log('✅ Respuesta:', text);
  } catch (e) {
    console.error('❌ Error detallado:', e);
  }
}

test();
