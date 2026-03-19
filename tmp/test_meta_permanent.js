const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim();
});

async function test() {
  const to = '5213412413119';
  const mensaje = '¡Hola! Probando con el TOKEN PERMANENTE. Si lees esto, este es el token que sirve.';
  
  const token = env.META_PERMANENT_USER_TOKEN; // Usamos el otro token
  const phoneId = env.META_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

  console.log(`--- 🧪 PROBANDO TOKEN PERMANENTE CON ${to} ---`);
  
  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: mensaje },
  };

  const headers = {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  };

  try {
    const res = await axios.post(url, payload, headers);
    console.log('✅ ÉXITO CON TOKEN PERMANENTE:', res.data);
  } catch (e) {
    console.error('❌ FALLÓ TAMBIÉN EL TOKEN PERMANENTE:', e.response?.data || e.message);
  }
}

test();
