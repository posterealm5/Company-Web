import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total, razorpay_order_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching orders:", error.message);
    return;
  }

  console.log("Latest orders:");
  console.log(JSON.stringify(orders, null, 2));
}

run();
