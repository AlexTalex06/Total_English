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
  const mensaje = '¡Hola! Soy la prueba directa de Total English. Si ves esto, tu Meta API funciona con 521.';
  
  const token = env.META_WHATSAPP_TOKEN;
  const phoneId = env.META_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

  console.log(`--- 🧪 PROBANDO META CON ${to} ---`);
  
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
    console.log('✅ ÉXITO INTENTO 1:', res.data);
  } catch (e) {
    console.warn('❌ FALLÓ INTENTO 1 (521):', e.response?.data || e.message);
    
    console.log('⚠️ Reintentando con 52...');
    const to2 = to.replace('521', '52');
    payload.to = to2;
    payload.text.body = '¡Hola! Prueba reintentada con 52 exitosa.';
    
    try {
      const res2 = await axios.post(url, payload, headers);
      console.log('✅ ÉXITO INTENTO 2 (52):', res2.data);
    } catch (e2) {
      console.error('❌ FALLÓ TAMBIÉN INTENTO 2 (52):', e2.response?.data || e2.message);
    }
  }
}

test();
