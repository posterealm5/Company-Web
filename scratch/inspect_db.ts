import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking for coupons table...");
  const { data, error } = await supabase.from('coupons').select('*').limit(1);
  if (error) {
    console.log("Error querying coupons:", error);
  } else {
    console.log("Coupons table exists! Data:", data);
  }
}

check();
