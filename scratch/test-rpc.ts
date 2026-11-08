import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(url!, serviceKey!);

async function testSql() {
  console.log('Testing if any SQL execution functions exist...');
  // Check if exec_sql or similar exists
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: 'SELECT 1;' });
  console.log('exec_sql result:', { data, error });
}

testSql().catch(console.error);
