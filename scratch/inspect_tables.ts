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

async function listTables() {
  console.log("Listing tables...");
  // Query supabase database schema tables using postgres functions
  const { data, error } = await supabase.rpc('get_tables_info');
  if (error) {
    // If rpc doesn't exist, query via regular postgres system catalogs if possible, or try checking common tables
    console.log("Error running RPC, trying raw select on pg_tables...");
    const { data: tables, error: pgErr } = await supabase
      .from('pg_tables')
      .select('*')
      .limit(1);
    console.log("pg_tables check:", pgErr ? pgErr.message : tables);
  } else {
    console.log("Tables:", data);
  }
}

async function checkCommonTables() {
  const common = ['coupons', 'coupon', 'offers', 'orders', 'products', 'profiles', 'addresses', 'wishlists', 'coupon_users', 'coupon_redemptions'];
  for (const t of common) {
    const { data, error } = await supabase.from(t).select('*').limit(0);
    if (error) {
      console.log(`Table '${t}' query error:`, error.message);
    } else {
      console.log(`Table '${t}' exists!`);
    }
  }
}

async function run() {
  await checkCommonTables();
}

run();
