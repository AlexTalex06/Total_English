const { consultarAlex } = require('./src/lib/alexIA');
require('dotenv').config({ path: '.env.local' });

async function testIA() {
  console.log('--- 🧪 TEST DE ALEXIA ---');
  const historial = [
    { role: 'user', content: 'Hola, me interesa el curso de adultos' }
  ];
  
  try {
    const respuesta = await consultarAlex(historial, 'Tester', 'WhatsApp');
    console.log('🤖 Respuesta de Alex:', respuesta);
    
    if (respuesta.includes('[[EXTRACTED_DATA')) {
        console.log('✅ Extracción de datos detectada.');
    } else {
        console.warn('⚠️ No se detectó extracción de datos (esto es normal si es el primer saludo).');
    }
  } catch (e) {
    console.error('❌ Error en test de IA:', e);
  }
}

testIA();
