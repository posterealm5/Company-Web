import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(url!, serviceKey!);

async function listRpcs() {
  const { data, error } = await supabaseAdmin.from('products').select('id').limit(1);
  console.log('DB test:', { data, error });
}

listRpcs().catch(console.error);
