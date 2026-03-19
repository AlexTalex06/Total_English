
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
  const { data, error } = await supabase.from('prospectos').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
    return;
  }
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    // If table is empty, we can try to get column info from rpc or just try to insert a dummy
    console.log('Table is empty, trying to insert dummy with new columns...');
    const { error: insError } = await supabase.from('prospectos').insert({ nombre: 'Test', lead_score: 'TEST' });
    if (insError && insError.message.includes('column "lead_score" of relation "prospectos" does not exist')) {
      console.log('lead_score column DOES NOT EXIST');
    } else {
      console.log('lead_score column MIGHT EXIST or error was different:', insError);
    }
  }
}

checkColumns();
