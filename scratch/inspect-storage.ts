import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(url!, serviceKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function inspectStorage() {
  console.log('--- Inspecting storage.objects with service client ---');
  const { data: objects, error: objErr } = await supabaseAdmin.schema('storage' as any)
    .from('objects')
    .select('id, bucket_id, name, owner, created_at')
    .limit(10);
  console.log('Sample storage objects:', { objects, objErr });

  console.log('\n--- Checking profiles and admin users ---');
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, is_admin')
    .eq('is_admin', true);
  console.log('Admin profiles in DB:', { profiles, profErr });
}

inspectStorage().catch(console.error);
